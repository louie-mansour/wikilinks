package service

import (
	"fmt"
	"time"

	"github.com/louiemansour/wikilinks/service/internal/config"
	"github.com/louiemansour/wikilinks/service/internal/graph"
)

// ErrNoPuzzleToday is returned when the daily schedule has no article
// configured for the current UTC calendar day.
type ErrNoPuzzleToday struct{ Err error }

func (e ErrNoPuzzleToday) Error() string { return fmt.Sprintf("no puzzle scheduled: %v", e.Err) }
func (e ErrNoPuzzleToday) Unwrap() error { return e.Err }

// GuessResult is the response payload for a single daily-mode guess.
//
// Prior to a correct guess, the hidden end article's real id/title never
// appears anywhere in this struct — it is replaced everywhere by a stable,
// per-day placeholder id (see config.PlaceholderID) so the client can merge
// multiple guesses' graphs without learning the answer early.
type GuessResult struct {
	Guess       string     `json:"guess"`
	Correct     bool       `json:"correct"`
	Answer      string     `json:"answer,omitempty"`
	NoPathFound bool       `json:"noPathFound,omitempty"`
	PathsFound  int        `json:"pathsFound"`
	MinHops     int        `json:"minHops"`
	Paths       [][]string `json:"paths"`
	GraphData   GraphData  `json:"graphData"`
	MaxHops     int        `json:"maxHops"`
	MaxPaths    int        `json:"maxPaths"`
}

// Guess is the service backing the daily-mode guess endpoint.
type Guess struct {
	g     *graph.WikipediaGraph
	sched *config.DailySchedule
}

// NewGuess creates a Guess service backed by the given graph and daily schedule.
func NewGuess(g *graph.WikipediaGraph, sched *config.DailySchedule) *Guess {
	return &Guess{g: g, sched: sched}
}

// Submit resolves guessTitle against today's hidden puzzle article and
// returns all shortest paths between them via BidirectionalBFS, with the
// real answer masked behind a stable per-day placeholder id unless the guess
// is correct.
func (s *Guess) Submit(guessTitle string) (*GuessResult, error) {
	now := time.Now()

	answerTitle, err := s.sched.ArticleForDate(now)
	if err != nil {
		return nil, ErrNoPuzzleToday{err}
	}

	guessID, ok := s.g.ResolveTitle(guessTitle)
	if !ok {
		return nil, ErrTitleNotFound{guessTitle}
	}
	answerID, ok := s.g.ResolveTitle(answerTitle)
	if !ok {
		return nil, fmt.Errorf("scheduled answer %q not found in graph", answerTitle)
	}
	guess := s.g.Title(guessID)

	if guessID == answerID {
		return &GuessResult{
			Guess:      guess,
			Correct:    true,
			Answer:     answerTitle,
			PathsFound: 1,
			Paths:      [][]string{{guess}},
			GraphData: GraphData{
				Nodes: []WikiNode{{ID: guess, Variant: "end", Label: guess}},
				Links: []WikiLink{},
			},
			MaxHops:  graph.MaxDepth,
			MaxPaths: graph.MaxPaths,
		}, nil
	}

	placeholderID := config.PlaceholderID(now)

	result, found := graph.BidirectionalBFS(s.g, guessID, answerID)
	if !found {
		return &GuessResult{
			Guess:       guess,
			NoPathFound: true,
			Paths:       [][]string{},
			GraphData: GraphData{
				Nodes: []WikiNode{{ID: guess, Variant: "guess", Label: guess}},
				Links: []WikiLink{},
			},
			MaxHops:  graph.MaxDepth,
			MaxPaths: graph.MaxPaths,
		}, nil
	}

	allPaths := make([][]string, len(result.Paths))
	for i, ids := range result.Paths {
		path := make([]string, len(ids))
		for j, id := range ids {
			if id == answerID {
				path[j] = placeholderID
			} else {
				path[j] = s.g.Title(id)
			}
		}
		allPaths[i] = path
	}

	return &GuessResult{
		Guess:      guess,
		PathsFound: len(allPaths),
		MinHops:    len(allPaths[0]) - 1,
		Paths:      allPaths,
		GraphData:  buildGuessGraphData(allPaths),
		MaxHops:    graph.MaxDepth,
		MaxPaths:   graph.MaxPaths,
	}, nil
}

// buildGuessGraphData mirrors buildGraphData but uses the 'guess'/'hidden-end'
// node variants and never assigns a Label to the placeholder node, so the
// masked node carries no identity beyond its stable placeholder id.
func buildGuessGraphData(allPaths [][]string) GraphData {
	nodeVariant := make(map[string]string)
	type edge struct{ src, dst string }
	linkSet := make(map[edge]struct{})

	for _, path := range allPaths {
		for i, title := range path {
			variant := "path"
			if i == 0 {
				variant = "guess"
			} else if i == len(path)-1 {
				variant = "hidden-end"
			}
			// Don't downgrade guess/hidden-end to path if already set.
			if existing, ok := nodeVariant[title]; !ok || existing == "path" {
				nodeVariant[title] = variant
			}
		}
		for i := 0; i < len(path)-1; i++ {
			linkSet[edge{path[i], path[i+1]}] = struct{}{}
		}
	}

	nodes := make([]WikiNode, 0, len(nodeVariant))
	for title, variant := range nodeVariant {
		label := title
		if variant == "hidden-end" {
			label = ""
		}
		nodes = append(nodes, WikiNode{ID: title, Variant: variant, Label: label})
	}
	links := make([]WikiLink, 0, len(linkSet))
	for e := range linkSet {
		links = append(links, WikiLink{Source: e.src, Target: e.dst})
	}
	return GraphData{Nodes: nodes, Links: links}
}
