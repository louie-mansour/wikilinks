package controller

import (
	"errors"
	"net/http"
	"strconv"

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
	mux.HandleFunc("GET /api/daily-info", c.dailyInfo)
}

// dailyInfo serves today's category hint (e.g. "Person", "Place") so the
// client can show it before the player's first guess, without exposing
// anything about the hidden article itself.
func (c *Guess) dailyInfo(w http.ResponseWriter, _ *http.Request) {
	category, err := c.svc.Category()
	if err != nil {
		var noPuzzle service.ErrNoPuzzleToday
		if errors.As(err, &noPuzzle) {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"category": category})
}

func (c *Guess) guess(w http.ResponseWriter, r *http.Request) {
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

	result, err := c.svc.Submit(guess, guessNumber)
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
