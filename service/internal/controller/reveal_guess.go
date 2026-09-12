package controller

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/louiemansour/wikilinks/service/internal/service"
)

// RevealGuess handles GET /api/reveal-guess?guess=X — the Reveal-mode
// counterpart to Classic's /api/guess. Its response shape differs (it adds
// the guess's outbound-neighbor reveal alongside the path reveal) so it is a
// distinct, additive route; it never modifies or reuses Classic's response
// shape, and never reveals the real hidden-end article's identity prior to a
// correct or losing guess.
type RevealGuess struct {
	svc *service.Guess
}

func NewRevealGuess(svc *service.Guess) *RevealGuess {
	return &RevealGuess{svc: svc}
}

func (c *RevealGuess) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/reveal-guess", c.revealGuess)
}

func (c *RevealGuess) revealGuess(w http.ResponseWriter, r *http.Request) {
	guess := r.URL.Query().Get("guess")
	if guess == "" {
		http.Error(w, `{"error":"guess is required"}`, http.StatusBadRequest)
		return
	}

	guessNumber := 1
	if raw := r.URL.Query().Get("guessNumber"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 1 {
			http.Error(w, `{"error":"guessNumber must be a positive integer"}`, http.StatusBadRequest)
			return
		}
		guessNumber = n
	}

	result, err := c.svc.SubmitReveal(guess, guessNumber)
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
