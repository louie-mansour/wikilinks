package controller

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/louiemansour/wikilinks/service/internal/service"
)

// Random handles GET /api/random?role=start|end&count=N.
type Random struct {
	svc *service.Random
}

func NewRandom(svc *service.Random) *Random {
	return &Random{svc: svc}
}

func (c *Random) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/random", c.random)
}

func (c *Random) random(w http.ResponseWriter, r *http.Request) {
	role := r.URL.Query().Get("role")
	if role == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "role is required"})
		return
	}

	count := service.DefaultRandomCount
	if raw := r.URL.Query().Get("count"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "count must be a positive integer"})
			return
		}
		count = parsed
	}

	result, err := c.svc.Pick(role, count)
	if err != nil {
		if errors.Is(err, service.ErrInvalidRandomRole) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}

	writeJSON(w, http.StatusOK, result)
}
