package service

import (
	"fmt"
	"math/rand"
	"sync"
	"time"

	"github.com/louiemansour/wikilinks/service/internal/config"
)

// RandomAnswerSource picks one random puzzle from the curated daily schedule
// at construction time and returns it for every date. It exists for local
// dev mode, where we want a hidden article without hand-editing which date's
// entry today resolves to — picking from the schedule's own list (as opposed
// to any end-eligible graph node) keeps the dev-mode answer as
// recognizable/guessable as a real scheduled puzzle.
//
// It also implements Reroll (see guess.go's Rerollable), which Guess calls
// automatically once a puzzle finishes — so a dev server moves on to a fresh
// random answer as soon as a round ends, without a restart.
// Reroll mutates puzzle in place under mu, so it's safe to call concurrently
// with ArticleForDate/CategoryForDate/Article from in-flight requests.
type RandomAnswerSource struct {
	mu         sync.Mutex
	puzzle     config.DailyPuzzle
	candidates []config.DailyPuzzle
}

// NewRandomAnswerSource samples one puzzle uniformly at random from
// candidates (the curated daily schedule's puzzle list).
func NewRandomAnswerSource(candidates []config.DailyPuzzle) (*RandomAnswerSource, error) {
	if len(candidates) == 0 {
		return nil, fmt.Errorf("no scheduled articles available to pick a random dev answer")
	}
	return &RandomAnswerSource{
		puzzle:     candidates[rand.Intn(len(candidates))],
		candidates: candidates,
	}, nil
}

// Article returns the currently active article (the one picked at
// construction time, or by the most recent Reroll).
func (s *RandomAnswerSource) Article() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.puzzle.Article
}

// ArticleForDate ignores date and always returns the currently active
// article, so a dev-mode server keeps a stable answer across requests until
// the next Reroll.
func (s *RandomAnswerSource) ArticleForDate(_ time.Time) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.puzzle.Article, nil
}

// CategoryForDate ignores date and always returns the currently active
// category, mirroring ArticleForDate.
func (s *RandomAnswerSource) CategoryForDate(_ time.Time) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.puzzle.Category, nil
}

// Reroll picks a new random puzzle from candidates, distinct from the
// currently active one when candidates has more than one entry (so a
// finished dev round always moves on to a genuinely different answer rather
// than occasionally re-rolling the same one).
func (s *RandomAnswerSource) Reroll() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.candidates) <= 1 {
		return
	}
	next := s.puzzle
	for next.Article == s.puzzle.Article {
		next = s.candidates[rand.Intn(len(s.candidates))]
	}
	s.puzzle = next
}
