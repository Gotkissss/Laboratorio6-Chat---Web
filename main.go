package main

import (
	"fmt"
	"io"
	"net/http"
)

const serverURL = "https://chat.joelsiervas.online/messages"

func corsHeaders(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

func messagesProxy(w http.ResponseWriter, r *http.Request) {
	corsHeaders(w)

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	req, err := http.NewRequest(r.Method, serverURL, r.Body)
	if err != nil {
		http.Error(w, "Error creando request", http.StatusInternalServerError)
		return
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		http.Error(w, "Error conectando al servidor", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

func main() {
	http.HandleFunc("/messages", messagesProxy)

	fs := http.FileServer(http.Dir("./static"))
	http.Handle("/", fs)

	port := "8080"
	fmt.Println("Servidor corriendo en http://localhost:" + port)
	http.ListenAndServe(":"+port, nil)
}