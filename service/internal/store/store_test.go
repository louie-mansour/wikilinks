package store

import (
	"database/sql"
	"path/filepath"
	"testing"
)

func TestSaveFeedbackRating_and_UpdateFeedbackComment(t *testing.T) {
	st, err := New(filepath.Join(t.TempDir(), "test.db"), 0)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	defer st.Close()

	id, err := st.SaveFeedbackRating(3)
	if err != nil {
		t.Fatalf("SaveFeedbackRating: %v", err)
	}
	if id == 0 {
		t.Fatal("expected non-zero id")
	}

	var rating int
	var comment string
	if err := st.db.QueryRow(`SELECT rating, comment FROM feedback WHERE id = ?`, id).Scan(&rating, &comment); err != nil {
		t.Fatalf("select after insert: %v", err)
	}
	if rating != 3 || comment != "" {
		t.Fatalf("rating=%d comment=%q, want rating=3 comment=\"\"", rating, comment)
	}

	if err := st.UpdateFeedbackComment(id, "Loved it!"); err != nil {
		t.Fatalf("UpdateFeedbackComment: %v", err)
	}
	if err := st.db.QueryRow(`SELECT comment FROM feedback WHERE id = ?`, id).Scan(&comment); err != nil {
		t.Fatalf("select after update: %v", err)
	}
	if comment != "Loved it!" {
		t.Fatalf("comment = %q, want %q", comment, "Loved it!")
	}
}

func TestUpdateFeedbackComment_missingID(t *testing.T) {
	st, err := New(filepath.Join(t.TempDir(), "test.db"), 0)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	defer st.Close()

	if err := st.UpdateFeedbackComment(999, "no such row"); err != sql.ErrNoRows {
		t.Fatalf("err = %v, want sql.ErrNoRows", err)
	}
}

func TestAnnotateRecordBadges_allTimeRecordBadgesEveryWindow(t *testing.T) {
	previous := []RecordPeriod{
		{
			Period: "All time",
			Rows: []RecordRow{
				{Key: "Most paths", Value: "15"},
				{Key: "Most articles", Value: "10"},
				{Key: "Longest path", Value: "3 hops"},
			},
		},
		{
			Period: "Past week",
			Rows: []RecordRow{
				{Key: "Most paths", Value: "20"},
				{Key: "Most articles", Value: "12"},
				{Key: "Longest path", Value: "4 hops"},
			},
		},
	}

	current := []RecordPeriod{
		{
			Period: "All time",
			Rows: []RecordRow{
				{Key: "Most paths", Value: "20"},
				{Key: "Most articles", Value: "12"},
				{Key: "Longest path", Value: "4 hops"},
			},
		},
		{
			Period: "Past day",
			Rows: []RecordRow{
				{Key: "Most paths", Value: "20"},
				{Key: "Most articles", Value: "12"},
				{Key: "Longest path", Value: "4 hops"},
			},
		},
		{
			Period: "Past week",
			Rows: []RecordRow{
				{Key: "Most paths", Value: "20"},
				{Key: "Most articles", Value: "12"},
				{Key: "Longest path", Value: "4 hops"},
			},
		},
	}

	meta := SearchMeta{
		PathsFound:      20,
		ArticlesInPaths: 12,
		NodesExplored:   5138199,
		MinHops:         4,
	}

	got := AnnotateRecordBadges(current, previous, meta)

	wantBadge := map[string]map[string]bool{
		"All time": {
			"Most paths": true,
			"Most articles":    true,
			"Longest path":     true,
		},
		"Past day": {
			"Most paths": true,
			"Most articles":    true,
			"Longest path":     true,
		},
		"Past week": {
			"Most paths": true,
			"Most articles":    true,
			"Longest path":     true,
		},
	}

	for _, period := range got {
		for _, row := range period.Rows {
			want, ok := wantBadge[period.Period][row.Key]
			if !ok {
				t.Fatalf("unexpected row %q in period %q", row.Key, period.Period)
			}
			if row.Badge != want {
				t.Errorf("period %q row %q: badge = %v, want %v", period.Period, row.Key, row.Badge, want)
			}
		}
	}
}

func TestAnnotateRecordBadges_longestPathBeatsPrevious(t *testing.T) {
	previous := []RecordPeriod{
		{
			Period: "All time",
			Rows: []RecordRow{
				{Key: "Most paths", Value: "10"},
				{Key: "Most articles", Value: "5"},
				{Key: "Longest path", Value: "3 hops"},
			},
		},
	}

	current := []RecordPeriod{
		{
			Period: "All time",
			Rows: []RecordRow{
				{Key: "Most paths", Value: "10"},
				{Key: "Most articles", Value: "5"},
				{Key: "Longest path", Value: "6 hops"},
			},
		},
	}

	meta := SearchMeta{PathsFound: 10, ArticlesInPaths: 5, NodesExplored: 100, MinHops: 6}
	got := AnnotateRecordBadges(current, previous, meta)

	if !got[0].Rows[2].Badge {
		t.Fatal("expected badge on Longest path row when beating previous max hops")
	}
}

func TestAnnotateRecordBadges_shortestPathLegacyKey(t *testing.T) {
	previous := []RecordPeriod{
		{
			Period: "All time",
			Rows: []RecordRow{
				{Key: "Most paths", Value: "10"},
				{Key: "Most articles", Value: "5"},
				{Key: "Shortest path", Value: "3 hops"},
			},
		},
	}

	current := []RecordPeriod{
		{
			Period: "All time",
			Rows: []RecordRow{
				{Key: "Most paths", Value: "10"},
				{Key: "Most articles", Value: "5"},
				{Key: "Longest path", Value: "6 hops"},
			},
		},
	}

	meta := SearchMeta{PathsFound: 10, ArticlesInPaths: 5, NodesExplored: 100, MinHops: 6}
	got := AnnotateRecordBadges(current, previous, meta)

	if !got[0].Rows[2].Badge {
		t.Fatal("expected badge on Longest path row when beating legacy Shortest path prev")
	}
}

func TestAnnotateRecordBadges_legacyMostPathsFoundKey(t *testing.T) {
	previous := []RecordPeriod{
		{
			Period: "All time",
			Rows: []RecordRow{
				{Key: "Most paths found", Value: "10"},
				{Key: "Most articles", Value: "5"},
				{Key: "Longest path", Value: "3 hops"},
			},
		},
	}

	current := []RecordPeriod{
		{
			Period: "All time",
			Rows: []RecordRow{
				{Key: "Most paths", Value: "15"},
				{Key: "Most articles", Value: "5"},
				{Key: "Longest path", Value: "3 hops"},
			},
		},
	}

	meta := SearchMeta{PathsFound: 15, ArticlesInPaths: 5, MinHops: 3}
	got := AnnotateRecordBadges(current, previous, meta)

	if !got[0].Rows[0].Badge {
		t.Fatal("expected badge on Most paths row when beating legacy Most paths found prev")
	}
}

func TestAnnotateRecordBadges_legacyMostArticlesInPathsKey(t *testing.T) {
	previous := []RecordPeriod{
		{
			Period: "All time",
			Rows: []RecordRow{
				{Key: "Most paths", Value: "10"},
				{Key: "Most articles in paths", Value: "5"},
				{Key: "Longest path", Value: "3 hops"},
			},
		},
	}

	current := []RecordPeriod{
		{
			Period: "All time",
			Rows: []RecordRow{
				{Key: "Most paths", Value: "10"},
				{Key: "Most articles", Value: "8"},
				{Key: "Longest path", Value: "3 hops"},
			},
		},
	}

	meta := SearchMeta{PathsFound: 10, ArticlesInPaths: 8, MinHops: 3}
	got := AnnotateRecordBadges(current, previous, meta)

	if !got[0].Rows[1].Badge {
		t.Fatal("expected badge on Most articles row when beating legacy Most articles in paths prev")
	}
}
