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

// DailySchedule maps a UTC calendar date to the article hidden that day.
type DailySchedule struct {
	articlesByDate map[string]string
}

// LoadDailySchedule reads and parses the schedule JSON file at path.
// The file must contain a flat JSON object mapping "YYYY-MM-DD" date
// strings to article titles.
func LoadDailySchedule(path string) (*DailySchedule, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read daily schedule %q: %w", path, err)
	}

	var articlesByDate map[string]string
	if err := json.Unmarshal(data, &articlesByDate); err != nil {
		return nil, fmt.Errorf("parse daily schedule %q: %w", path, err)
	}

	return &DailySchedule{articlesByDate: articlesByDate}, nil
}

// ArticleForDate returns the hidden article title scheduled for date's UTC
// calendar day. It returns an error (not a panic) if no puzzle is scheduled
// for that date.
func (s *DailySchedule) ArticleForDate(date time.Time) (string, error) {
	key := date.UTC().Format(dateLayout)
	article, ok := s.articlesByDate[key]
	if !ok {
		return "", fmt.Errorf("no puzzle scheduled for %s", key)
	}
	return article, nil
}

// Today returns the hidden article title for the current UTC calendar day.
func (s *DailySchedule) Today() (string, error) {
	return s.ArticleForDate(time.Now())
}

// PlaceholderID returns the stable, per-day placeholder node id used to mask
// the real hidden-end article's identity in guess responses. It is identical
// for every guess made on the same UTC calendar day and derived only from the
// date, never the answer itself, so it carries no information about the
// answer's identity.
func PlaceholderID(date time.Time) string {
	return "hidden-" + date.UTC().Format(dateLayout)
}
