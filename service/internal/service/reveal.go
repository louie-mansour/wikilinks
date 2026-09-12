package service

import (
	"fmt"
	"time"

	"github.com/louiemansour/wikilinks/service/internal/config"
	"github.com/louiemansour/wikilinks/service/internal/graph"
)

// RevealGuessResult is the response payload for a single Reveal-mode guess.
//
// Like GuessResult, the hidden end article's real id/title never appears
// anywhere in this struct prior to a correct guess (or the final, losing
// guess) — it is replaced everywhere by the stable per-day placeholder id
// (config.PlaceholderID). Neighbors is restricted to the guess's outbound
// neighbor(s) that lie on a shortest path to the hidden article (see
// graph.RevealNeighbors), not its full outbound-link list, and always
// excludes the hidden article itself so a direct link to the answer never
// leaks its identity either.
type RevealGuessResult struct {
	Guess       string               `json:"guess"`
	Correct     bool                 `json:"correct"`
	Lost        bool                 `json:"lost,omitempty"`
	Answer      string               `json:"answer,omitempty"`
	Neighbors   []graph.NeighborInfo `json:"neighbors"`
	NoPathFound bool                 `json:"noPathFound,omitempty"`
	PathsFound  int                  `json:"pathsFound"`
	MinHops     int                  `json:"minHops"`
	Paths       [][]string           `json:"paths"`
	GraphData   GraphData            `json:"graphData"`
	MaxHops     int                  `json:"maxHops"`
	MaxPaths    int                  `json:"maxPaths"`
}

// SubmitReveal resolves guessTitle against today's hidden puzzle article and
// returns the Reveal-mode payload: the same shortest-path reveal Classic's
// Submit computes via BidirectionalBFS, masked behind the stable per-day
// placeholder id unless the guess is correct or is the puzzle-losing guess,
// plus the guess's shortest-path-only neighbor reveal (see
// graph.RevealNeighbors) — never the guess's full outbound-link list.
//
// guessNumber is the 1-indexed attempt number for this guess, exactly as
// Classic's Submit expects it. Once guessNumber reaches MaxDailyGuesses
// without a correct guess, the real answer is revealed and the result is
// marked Lost — same cap, same constant, as Classic.
func (s *Guess) SubmitReveal(guessTitle string, guessNumber int) (*RevealGuessResult, error) {
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
		return &RevealGuessResult{
			Guess:      guess,
			Correct:    true,
			Answer:     answerTitle,
			Neighbors:  []graph.NeighborInfo{},
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

	lost := guessNumber >= MaxDailyGuesses
	placeholderID := config.PlaceholderID(now)

	result, found := graph.BidirectionalBFS(s.g, guessID, answerID)
	if !found {
		graphData := GraphData{
			Nodes: []WikiNode{{ID: guess, Variant: "guess", Label: guess}},
			Links: []WikiLink{},
		}
		if lost {
			graphData.Nodes = append(graphData.Nodes, WikiNode{ID: answerTitle, Variant: "end", Label: answerTitle})
		}
		graphData = annotateDirectConnections(s.g, graphData, answerID)
		return &RevealGuessResult{
			Guess:       guess,
			Lost:        lost,
			Answer:      lostAnswer(lost, answerTitle),
			Neighbors:   []graph.NeighborInfo{},
			NoPathFound: true,
			Paths:       [][]string{},
			GraphData:   graphData,
			MaxHops:     graph.MaxDepth,
			MaxPaths:    graph.MaxPaths,
		}, nil
	}

	neighbors := s.g.RevealNeighbors(answerID, result.Paths)

	allPaths := make([][]string, len(result.Paths))
	for i, ids := range result.Paths {
		path := make([]string, len(ids))
		for j, id := range ids {
			if id == answerID {
				if lost {
					path[j] = answerTitle
				} else {
					path[j] = placeholderID
				}
			} else {
				path[j] = s.g.Title(id)
			}
		}
		allPaths[i] = path
	}

	graphData := annotateDirectConnections(s.g, buildGuessGraphData(allPaths, lost), answerID)

	return &RevealGuessResult{
		Guess:      guess,
		Lost:       lost,
		Answer:     lostAnswer(lost, answerTitle),
		Neighbors:  neighbors,
		PathsFound: len(allPaths),
		MinHops:    len(allPaths[0]) - 1,
		Paths:      allPaths,
		GraphData:  graphData,
		MaxHops:    graph.MaxDepth,
		MaxPaths:   graph.MaxPaths,
	}, nil
}
