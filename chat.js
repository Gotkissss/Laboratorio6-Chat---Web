//  Configuración

const API_URL    = 'https://chat.joelsiervas.online/messages';
const REFRESH_MS = 3000;
const MAX_CHARS  = 140;

//  Referencias al DOM
const messagesList = document.getElementById('messages-list');
const messagesWrap = document.getElementById('messages-wrap');
const emptyState   = document.getElementById('empty-state');
const msgInput     = document.getElementById('msg-input');
const nameInput    = document.getElementById('name-input');
const sendBtn      = document.getElementById('send-btn');
const charCount    = document.getElementById('char-count');
const statusDot    = document.getElementById('status-dot');
const statusText   = document.getElementById('status-text');

//  Estado
const knownIds = new Set();

//  Persistir nombre entre sesiones

nameInput.value = localStorage.getItem('chat_name') || '';

nameInput.addEventListener('input', () => {
  localStorage.setItem('chat_name', nameInput.value.trim());
});


//  Contador de caracteres

msgInput.addEventListener('input', () => {
  const len = msgInput.value.length;
  charCount.textContent = `${len} / ${MAX_CHARS}`;

  if (len >= MAX_CHARS) {
    charCount.className = 'limit';
  } else if (len >= 110) {
    charCount.className = 'warn';
  } else {
    charCount.className = '';
  }

  autoResize();
});

function autoResize() {
  msgInput.style.height = 'auto';
  msgInput.style.height = Math.min(msgInput.scrollHeight, 120) + 'px';
}


msgInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener('click', sendMessage);


//  Enviar mensaje
async function sendMessage() {
  const text = msgInput.value.trim();
  const name = nameInput.value.trim() || 'anónimo';

  if (!text) return;

  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: name, text: text })
    });

    msgInput.value = '';
    msgInput.style.height = 'auto';
    charCount.textContent = `0 / ${MAX_CHARS}`;
    charCount.className = '';

    await loadMessages();
  } catch (err) {
    console.error('Error al enviar:', err);
  }
}

//  Cargar mensajes del servidor

async function loadMessages() {
  try {
    const res  = await fetch(API_URL);
    const data = await res.json();


    const msgs = Array.isArray(data) ? data : (data.messages || []);

    setStatus(true);
    renderMessages(msgs);
  } catch (err) {
    setStatus(false);
    console.error('Error al cargar mensajes:', err);
  }
}


//  Indicador de estado de conexión

function setStatus(online) {
  if (online) {
    statusDot.classList.add('online');
    statusText.textContent = 'conectado';
  } else {
    statusDot.classList.remove('online');
    statusText.textContent = 'sin conexión';
  }
}


//  Renderizar mensajes nuevos

function renderMessages(msgs) {

  const atBottom =
    messagesWrap.scrollHeight - messagesWrap.scrollTop - messagesWrap.clientHeight < 80;

  const myName   = nameInput.value.trim() || 'anónimo';
  let   addedAny = false;

  if (msgs.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  msgs.forEach((msg) => {
    const id = msg.id ?? (msg.user + '::' + msg.message + '::' + (msg.timestamp || ''));

    if (knownIds.has(id)) return;
    knownIds.add(id);
    addedAny = true;

    const isMe  = (msg.user || msg.name || '') === myName;
    const el    = buildBubble(msg, isMe);
    messagesList.appendChild(el);
  });


  if (addedAny && atBottom) {
    messagesWrap.scrollTop = messagesWrap.scrollHeight;
  }
}


//  Construir burbuja de mensaje

function buildBubble(msg, isMe) {
  const wrapper = document.createElement('div');
  wrapper.className = `msg ${isMe ? 'me' : 'other'}`;

  // nombre
  const sender = document.createElement('div');
  sender.className = 'sender';
  sender.textContent = msg.user || msg.name || 'anónimo';

  // burbuja
  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  const text = msg.message || msg.text || '';

  // texto con links clicables
  bubble.appendChild(buildTextNode(text));


  const imgUrl = extractImageUrl(text);
  if (imgUrl) {
    const img = document.createElement('img');
    img.className = 'preview-img';
    img.src       = imgUrl;
    img.alt       = 'imagen adjunta';
    img.loading   = 'lazy';
    img.addEventListener('click', () => window.open(imgUrl, '_blank'));
    img.addEventListener('error', () => img.remove());
    bubble.appendChild(img);
  }


  else {
    const webUrl = extractWebUrl(text);
    if (webUrl) {
      fetchLinkPreview(webUrl, bubble);
    }
  }

  // hora
  const time = document.createElement('time');
  const ts   = msg.timestamp || msg.created_at || Date.now();
  time.textContent = new Date(ts).toLocaleTimeString('es', {
    hour:   '2-digit',
    minute: '2-digit'
  });
  bubble.appendChild(time);

  wrapper.appendChild(sender);
  wrapper.appendChild(bubble);
  return wrapper;
}


//  Texto con links clicables

function buildTextNode(raw) {
  const span  = document.createElement('span');
  const urlRe = /https?:\/\/[^\s]+/g;
  let last = 0;
  let match;

  while ((match = urlRe.exec(raw)) !== null) {
    if (match.index > last) {
      span.appendChild(document.createTextNode(raw.slice(last, match.index)));
    }

    const a = document.createElement('a');
    a.href       = match[0];
    a.textContent = match[0];
    a.target     = '_blank';
    a.rel        = 'noopener noreferrer';
    span.appendChild(a);

    last = match.index + match[0].length;
  }

  if (last < raw.length) {
    span.appendChild(document.createTextNode(raw.slice(last)));
  }

  return span;
}


//  Detectar URL de imagen en el texto

function extractImageUrl(text) {
  const match = text.match(/https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg|bmp)(\?\S*)?/i);
  return match ? match[0] : null;
}


//  Detectar cualquier URL en el texto

function extractWebUrl(text) {
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
}

//  Preview de enlace web (Open Graph)
async function fetchLinkPreview(url, bubble) {
  const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;

  try {
    const res  = await fetch(proxy);
    const data = await res.json();
    const html = data.contents || '';

    const parser = new DOMParser();
    const doc    = parser.parseFromString(html, 'text/html');

    const og = (prop) =>
      doc.querySelector(`meta[property="og:${prop}"]`)?.content ||
      doc.querySelector(`meta[name="og:${prop}"]`)?.content ||
      null;

    const title = og('title') || doc.title || url;
    const desc  = og('description') || doc.querySelector('meta[name="description"]')?.content || '';
    const image = og('image') || '';
    const host  = new URL(url).hostname;

    const card = document.createElement('a');
    card.className = 'link-card';
    card.href      = url;
    card.target    = '_blank';
    card.rel       = 'noopener noreferrer';

    if (image) {
      const img = document.createElement('img');
      img.src = image;
      img.alt = title;
      img.addEventListener('error', () => img.remove());
      card.appendChild(img);
    }

    const body = document.createElement('div');
    body.className = 'link-card-body';

    const titleEl = document.createElement('div');
    titleEl.className   = 'link-card-title';
    titleEl.textContent = title;

    const hostEl = document.createElement('div');
    hostEl.className   = 'link-card-host';
    hostEl.textContent = host;

    body.appendChild(titleEl);

    if (desc) {
      const descEl = document.createElement('div');
      descEl.className   = 'link-card-desc';
      descEl.textContent = desc;
      body.appendChild(descEl);
    }

    body.appendChild(hostEl);
    card.appendChild(body);

    const timeEl = bubble.querySelector('time');
    bubble.insertBefore(card, timeEl);

  } catch (_) {
  }
}


//  Auto-refresh
loadMessages();
setInterval(loadMessages, REFRESH_MS);