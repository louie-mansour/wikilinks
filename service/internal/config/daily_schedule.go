// Package config loads the daily-puzzle schedule: a hand-editable, committed
// mapping of calendar date (UTC) to the Wikipedia article hidden for that
// day's "Grill" puzzle. This file is the single source of truth for which
// article is hidden on a given day — there is no per-request randomization
// or algorithmic date-seeded pick.
package config

import (
	"encoding/json"
	"fmt"
	"os"
	"time"
)

// dateLayout is the calendar-date key format used in the schedule file, e.g. "2026-09-08".
const dateLayout = "2006-01-02"

// DailyPuzzle is one day's schedule entry: the hidden article plus a
// category hint ("Person", "Place", "Thing", "Event", "Time period", ...)
// shown to the player before they make their first guess.
type DailyPuzzle struct {
	Article  string `json:"article"`
	Category string `json:"category"`
}

// DailySchedule maps a UTC calendar date to the puzzle scheduled that day.
type DailySchedule struct {
	puzzlesByDate map[string]DailyPuzzle
}

// LoadDailySchedule reads and parses the schedule JSON file at path.
// The file must contain a flat JSON object mapping "YYYY-MM-DD" date
// strings to {"article": ..., "category": ...} entries.
func LoadDailySchedule(path string) (*DailySchedule, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read daily schedule %q: %w", path, err)
	}

	var puzzlesByDate map[string]DailyPuzzle
	if err := json.Unmarshal(data, &puzzlesByDate); err != nil {
		return nil, fmt.Errorf("parse daily schedule %q: %w", path, err)
	}

	return &DailySchedule{puzzlesByDate: puzzlesByDate}, nil
}

// puzzleForDate returns the puzzle scheduled for date's UTC calendar day.
func (s *DailySchedule) puzzleForDate(date time.Time) (DailyPuzzle, error) {
	key := date.UTC().Format(dateLayout)
	puzzle, ok := s.puzzlesByDate[key]
	if !ok {
		return DailyPuzzle{}, fmt.Errorf("no puzzle scheduled for %s", key)
	}
	return puzzle, nil
}

// ArticleForDate returns the hidden article title scheduled for date's UTC
// calendar day. It returns an error (not a panic) if no puzzle is scheduled
// for that date.
func (s *DailySchedule) ArticleForDate(date time.Time) (string, error) {
	puzzle, err := s.puzzleForDate(date)
	if err != nil {
		return "", err
	}
	return puzzle.Article, nil
}

// CategoryForDate returns the category hint scheduled for date's UTC
// calendar day. It returns an error (not a panic) if no puzzle is scheduled
// for that date.
func (s *DailySchedule) CategoryForDate(date time.Time) (string, error) {
	puzzle, err := s.puzzleForDate(date)
	if err != nil {
		return "", err
	}
	return puzzle.Category, nil
}

// Today returns the hidden article title for the current UTC calendar day.
func (s *DailySchedule) Today() (string, error) {
	return s.ArticleForDate(time.Now())
}

// Puzzles returns every puzzle scheduled anywhere in the file, in no
// particular order. It exists for dev mode, which picks a random puzzle from
// the curated schedule instead of an arbitrary end-eligible graph node.
func (s *DailySchedule) Puzzles() []DailyPuzzle {
	puzzles := make([]DailyPuzzle, 0, len(s.puzzlesByDate))
	for _, puzzle := range s.puzzlesByDate {
		puzzles = append(puzzles, puzzle)
	}
	return puzzles
}

// PlaceholderID returns the stable, per-day placeholder node id used to mask
// the real hidden-end article's identity in guess responses. It is identical
// for every guess made on the same UTC calendar day and derived only from the
// date, never the answer itself, so it carries no information about the
// answer's identity.
func PlaceholderID(date time.Time) string {
	return "hidden-" + date.UTC().Format(dateLayout)
}
