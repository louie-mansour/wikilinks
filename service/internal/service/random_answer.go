package service

import (
	"fmt"
	"time"

	"github.com/louiemansour/wikilinks/service/internal/graph"
)

// minDevAnswerInDegree is the minimum incoming-link count a dev-mode random
// answer must have. Plain end-eligibility (in-degree > 0) admits obscure
// articles — e.g. "7.62mm Thumper" — that are unguessable in practice; a
// higher in-degree floor biases the pick toward recognizable articles,
// mirroring the threshold the real daily schedule generator is meant to use
// (see docs/daily-word-guessing-mode/issues/07-schedule-generation-subcommand.md).
const minDevAnswerInDegree = 50

// RandomAnswerSource picks one random end-eligible article at construction
// time and returns it for every date. It exists for local dev mode, where we
// want a hidden article without hand-editing daily_schedule.json.
type RandomAnswerSource struct {
	article string
}

// NewRandomAnswerSource samples one end-eligible article from g with at
// least minDevAnswerInDegree incoming links.
func NewRandomAnswerSource(g *graph.WikipediaGraph) (*RandomAnswerSource, error) {
	picks := g.RandomEndNodesMinDegree(1, minDevAnswerInDegree)
	if len(picks) == 0 {
		return nil, fmt.Errorf("no end-eligible articles above the minimum in-degree threshold available to pick a random dev answer")
	}
	return &RandomAnswerSource{article: picks[0]}, nil
}

// Article returns the article picked at construction time.
func (s *RandomAnswerSource) Article() string { return s.article }

// ArticleForDate ignores date and always returns the article picked at
// construction time, so a dev-mode server keeps a stable answer across
// requests for its lifetime.
func (s *RandomAnswerSource) ArticleForDate(_ time.Time) (string, error) {
	return s.article, nil
}
