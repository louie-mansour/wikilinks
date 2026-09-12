package service

import (
	"fmt"
	"math/rand"
	"time"

	"github.com/louiemansour/wikilinks/service/internal/config"
)

// RandomAnswerSource picks one random puzzle from the curated daily schedule
// at construction time and returns it for every date. It exists for local
// dev mode, where we want a hidden article without hand-editing which date's
// entry today resolves to — picking from the schedule's own list (as opposed
// to any end-eligible graph node) keeps the dev-mode answer as
// recognizable/guessable as a real scheduled puzzle.
type RandomAnswerSource struct {
	puzzle config.DailyPuzzle
}

// NewRandomAnswerSource samples one puzzle uniformly at random from
// candidates (the curated daily schedule's puzzle list).
func NewRandomAnswerSource(candidates []config.DailyPuzzle) (*RandomAnswerSource, error) {
	if len(candidates) == 0 {
		return nil, fmt.Errorf("no scheduled articles available to pick a random dev answer")
	}
	return &RandomAnswerSource{puzzle: candidates[rand.Intn(len(candidates))]}, nil
}

// Article returns the article picked at construction time.
func (s *RandomAnswerSource) Article() string { return s.puzzle.Article }

// ArticleForDate ignores date and always returns the article picked at
// construction time, so a dev-mode server keeps a stable answer across
// requests for its lifetime.
func (s *RandomAnswerSource) ArticleForDate(_ time.Time) (string, error) {
	return s.puzzle.Article, nil
}

// CategoryForDate ignores date and always returns the category picked at
// construction time, mirroring ArticleForDate.
func (s *RandomAnswerSource) CategoryForDate(_ time.Time) (string, error) {
	return s.puzzle.Category, nil
}
