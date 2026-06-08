package controller

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/louiemansour/wikilinks/service/internal/service"
)

// Suggest handles GET /api/suggest?role=start|end&q=...&limit=10.
type Suggest struct {
	svc *service.Suggest
}

func NewSuggest(svc *service.Suggest) *Suggest {
	return &Suggest{svc: svc}
}

func (c *Suggest) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/suggest", c.suggest)
}

func (c *Suggest) suggest(w http.ResponseWriter, r *http.Request) {
	role := r.URL.Query().Get("role")
	if role == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "role is required"})
		return
	}

	limit := service.DefaultSuggestLimit
	if raw := r.URL.Query().Get("limit"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "limit must be a positive integer"})
			return
		}
		limit = parsed
	}

	result, err := c.svc.Search(role, r.URL.Query().Get("q"), limit)
	if err != nil {
		if errors.Is(err, service.ErrInvalidSuggestRole) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}

	writeJSON(w, http.StatusOK, result)
}
