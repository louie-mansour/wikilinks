package controller

import (
	"errors"
	"net/http"

	"github.com/louiemansour/wikilinks/service/internal/service"
)

// Guess handles GET /api/guess?guess=X — the daily-mode "Grill" endpoint.
// Unlike /api/search, it never reveals the real hidden-end article's
// identity in its response prior to a correct guess.
type Guess struct {
	svc *service.Guess
}

func NewGuess(svc *service.Guess) *Guess {
	return &Guess{svc: svc}
}

func (c *Guess) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/guess", c.guess)
}

func (c *Guess) guess(w http.ResponseWriter, r *http.Request) {
	guess := r.URL.Query().Get("guess")
	if guess == "" {
		http.Error(w, `{"error":"guess is required"}`, http.StatusBadRequest)
		return
	}

	result, err := c.svc.Submit(guess)
	if err != nil {
		var notFound service.ErrTitleNotFound
		var noPuzzle service.ErrNoPuzzleToday
		switch {
		case errors.As(err, &notFound):
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		case errors.As(err, &noPuzzle):
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		}
		return
	}

	writeJSON(w, http.StatusOK, result)
}
