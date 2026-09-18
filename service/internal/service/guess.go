package service

import (
	"fmt"
	"time"

	"github.com/louiemansour/wikilinks/service/internal/graph"
)

// AnswerSource resolves the hidden article and its category hint for a given
// date. In production this is *config.DailySchedule; in dev mode it's a
// RandomAnswerSource that ignores the date and returns a fixed random pick
// for the server's lifetime.
type AnswerSource interface {
	ArticleForDate(date time.Time) (string, error)
	CategoryForDate(date time.Time) (string, error)
}

// Rerollable is an optional capability of an AnswerSource: implementing it
// lets Guess move on to a new answer as soon as a puzzle finishes (see
// maybeReroll below). Only *RandomAnswerSource (local dev mode) implements
// it — production's *config.DailySchedule does not, so maybeReroll is a
// no-op there and the scheduled answer stays put regardless of outcome.
type Rerollable interface {
	Reroll()
}

// maybeReroll asks sched for a new answer once a puzzle has just finished
// (done is the guess's own correct||lost), so a local dev server picks up a
// fresh random target for the very next guess instead of requiring a
// restart. It is a no-op for any AnswerSource that isn't Rerollable.
func (s *Guess) maybeReroll(done bool) {
	if !done {
		return
	}
	if r, ok := s.sched.(Rerollable); ok {
		r.Reroll()
	}
}

// ErrNoPuzzleToday is returned when the daily schedule has no article
// configured for the current UTC calendar day.
type ErrNoPuzzleToday struct{ Err error }

func (e ErrNoPuzzleToday) Error() string { return fmt.Sprintf("no puzzle scheduled: %v", e.Err) }
func (e ErrNoPuzzleToday) Unwrap() error { return e.Err }

// MaxDailyGuesses is the number of incorrect guesses allowed before the
// puzzle is lost and the real answer is revealed.
const MaxDailyGuesses = 5

// Guess is the service backing the daily-mode guess endpoints.
type Guess struct {
	g     *graph.WikipediaGraph
	sched AnswerSource
}

// NewGuess creates a Guess service backed by the given graph and answer source.
func NewGuess(g *graph.WikipediaGraph, sched AnswerSource) *Guess {
	return &Guess{g: g, sched: sched}
}

// Category returns today's category hint (e.g. "Person", "Place"), shown to
// the player before their first guess. It never reveals the answer itself.
func (s *Guess) Category() (string, error) {
	category, err := s.sched.CategoryForDate(time.Now())
	if err != nil {
		return "", ErrNoPuzzleToday{err}
	}
	return category, nil
}

// annotateDirectConnections sets OutDegree/EdgeCountToEnd/InDegree on every
// node in graphData that is a direct backlink of the answer article — i.e.
// id is one of RevNeighbors(answerID) — so the client can build the "direct
// connections to the answer" panel without a further API round trip. Nodes
// that aren't direct backlinks (including the masked/placeholder answer node
// itself, which never resolves via ResolveTitle) are left untouched.
func annotateDirectConnections(g *graph.WikipediaGraph, graphData GraphData, answerID uint32) GraphData {
	backlinks := g.RevNeighbors(answerID)
	if len(backlinks) == 0 {
		return graphData
	}
	isBacklink := make(map[uint32]struct{}, len(backlinks))
	for _, id := range backlinks {
		isBacklink[id] = struct{}{}
	}

	nodes := make([]WikiNode, len(graphData.Nodes))
	copy(nodes, graphData.Nodes)
	for i, node := range nodes {
		id, ok := g.ResolveTitle(node.ID)
		if !ok || id == answerID {
			continue
		}
		if _, ok := isBacklink[id]; !ok {
			continue
		}
		neighbors := g.FwdNeighbors(id)
		edgeCountToEnd := 0
		for _, nb := range neighbors {
			if nb == answerID {
				edgeCountToEnd++
			}
		}
		nodes[i].OutDegree = len(neighbors)
		nodes[i].EdgeCountToEnd = edgeCountToEnd
		nodes[i].InDegree = len(g.RevNeighbors(id))
	}
	graphData.Nodes = nodes
	return graphData
}

// lostAnswer returns answerTitle when the puzzle was just lost, so the
// response's Answer field is populated for a losing guess the same way it is
// for a correct one — empty otherwise so the answer stays masked.
func lostAnswer(lost bool, answerTitle string) string {
	if lost {
		return answerTitle
	}
	return ""
}
