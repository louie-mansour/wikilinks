package controller

import (
	"encoding/json"
	"net/http"
)

// Health handles GET /health.
type Health struct{}

func NewHealth() *Health { return &Health{} }

func (h *Health) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", h.health)
}

func (h *Health) health(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]string{"status": "ok"}); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
	}
}
