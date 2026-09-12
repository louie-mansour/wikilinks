package config

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func writeSchedule(t *testing.T, contents string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "daily_schedule.json")
	if err := os.WriteFile(path, []byte(contents), 0o644); err != nil {
		t.Fatalf("write schedule fixture: %v", err)
	}
	return path
}

func TestArticleForDate_SeededDate(t *testing.T) {
	path := writeSchedule(t, `{"2026-09-08": {"article": "Albert Einstein", "category": "Person"}}`)

	sched, err := LoadDailySchedule(path)
	if err != nil {
		t.Fatalf("LoadDailySchedule: %v", err)
	}

	date := time.Date(2026, time.September, 8, 15, 30, 0, 0, time.UTC)
	article, err := sched.ArticleForDate(date)
	if err != nil {
		t.Fatalf("ArticleForDate: %v", err)
	}
	if article != "Albert Einstein" {
		t.Fatalf("article = %q, want %q", article, "Albert Einstein")
	}
}

func TestCategoryForDate_SeededDate(t *testing.T) {
	path := writeSchedule(t, `{"2026-09-08": {"article": "Albert Einstein", "category": "Person"}}`)

	sched, err := LoadDailySchedule(path)
	if err != nil {
		t.Fatalf("LoadDailySchedule: %v", err)
	}

	date := time.Date(2026, time.September, 8, 15, 30, 0, 0, time.UTC)
	category, err := sched.CategoryForDate(date)
	if err != nil {
		t.Fatalf("CategoryForDate: %v", err)
	}
	if category != "Person" {
		t.Fatalf("category = %q, want %q", category, "Person")
	}
}

func TestArticleForDate_UsesUTCCalendarDay(t *testing.T) {
	path := writeSchedule(t, `{"2026-09-08": {"article": "Albert Einstein", "category": "Person"}}`)

	sched, err := LoadDailySchedule(path)
	if err != nil {
		t.Fatalf("LoadDailySchedule: %v", err)
	}

	// 2026-09-08 23:30 in a -05:00 zone is 2026-09-09 04:30 UTC — a different
	// calendar day, so this must not resolve to the 09-08 entry.
	loc := time.FixedZone("UTC-5", -5*60*60)
	date := time.Date(2026, time.September, 8, 23, 30, 0, 0, loc)

	if _, err := sched.ArticleForDate(date); err == nil {
		t.Fatal("expected error resolving a date outside the schedule's UTC day, got nil")
	}
}

func TestArticleForDate_MissingDate(t *testing.T) {
	path := writeSchedule(t, `{"2026-09-08": {"article": "Albert Einstein", "category": "Person"}}`)

	sched, err := LoadDailySchedule(path)
	if err != nil {
		t.Fatalf("LoadDailySchedule: %v", err)
	}

	date := time.Date(2099, time.January, 1, 0, 0, 0, 0, time.UTC)
	if _, err := sched.ArticleForDate(date); err == nil {
		t.Fatal("expected error for a date with no scheduled puzzle, got nil")
	}
}

func TestLoadDailySchedule_MissingFile(t *testing.T) {
	if _, err := LoadDailySchedule(filepath.Join(t.TempDir(), "does_not_exist.json")); err == nil {
		t.Fatal("expected error loading a nonexistent schedule file, got nil")
	}
}

func TestLoadDailySchedule_MalformedJSON(t *testing.T) {
	path := writeSchedule(t, `not valid json`)
	if _, err := LoadDailySchedule(path); err == nil {
		t.Fatal("expected error loading malformed schedule JSON, got nil")
	}
}
