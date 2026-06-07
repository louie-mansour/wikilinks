package controller

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/louiemansour/wikilinks/service/internal/service"
)

// Search handles GET /api/search?from=X&to=Y.
type Search struct {
	svc *service.Search
}

func NewSearch(svc *service.Search) *Search {
	return &Search{svc: svc}
}

func (c *Search) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/search", c.search)
}

func (c *Search) search(w http.ResponseWriter, r *http.Request) {
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")

	if from == "" || to == "" {
		http.Error(w, `{"error":"from and to are required"}`, http.StatusBadRequest)
		return
	}

	result, err := c.svc.Find(from, to)
	if err != nil {
		var notFound service.ErrTitleNotFound
		switch {
		case errors.As(err, &notFound):
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		case errors.Is(err, service.ErrNoPath):
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "no path found"})
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		}
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
