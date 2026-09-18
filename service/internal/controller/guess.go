package controller

import (
	"errors"
	"net/http"

	"github.com/louiemansour/wikilinks/service/internal/service"
)

// Guess serves the daily-mode "Grill" puzzle's category hint. The guess
// submission endpoint itself lives in RevealGuess (/api/reveal-guess).
type Guess struct {
	svc *service.Guess
}

func NewGuess(svc *service.Guess) *Guess {
	return &Guess{svc: svc}
}

func (c *Guess) Register(mux *http.ServeMux) {
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
