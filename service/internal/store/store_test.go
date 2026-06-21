package store

import "testing"

func TestAnnotateRecordBadges_allTimeRecordBadgesEveryWindow(t *testing.T) {
	previous := []RecordPeriod{
		{
			Period: "All time",
			Rows: []RecordRow{
				{Key: "Most paths found", Value: "15"},
				{Key: "Most articles in paths", Value: "10"},
				{Key: "Most articles explored", Value: "5000000"},
				{Key: "Longest path", Value: "3 hops"},
			},
		},
		{
			Period: "Past week",
			Rows: []RecordRow{
				{Key: "Most paths found", Value: "20"},
				{Key: "Most articles in paths", Value: "12"},
				{Key: "Most articles explored", Value: "5138199"},
				{Key: "Longest path", Value: "4 hops"},
			},
		},
	}

	current := []RecordPeriod{
		{
			Period: "All time",
			Rows: []RecordRow{
				{Key: "Most paths found", Value: "20"},
				{Key: "Most articles in paths", Value: "12"},
				{Key: "Most articles explored", Value: "5138199"},
				{Key: "Longest path", Value: "4 hops"},
			},
		},
		{
			Period: "Past day",
			Rows: []RecordRow{
				{Key: "Most paths found", Value: "20"},
				{Key: "Most articles in paths", Value: "12"},
				{Key: "Most articles explored", Value: "5138199"},
				{Key: "Longest path", Value: "4 hops"},
			},
		},
		{
			Period: "Past week",
			Rows: []RecordRow{
				{Key: "Most paths found", Value: "20"},
				{Key: "Most articles in paths", Value: "12"},
				{Key: "Most articles explored", Value: "5138199"},
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
			"Most paths found":               true,
			"Most articles in paths":   true,
			"Most articles explored":   true,
			"Longest path":             true,
		},
		"Past day": {
			"Most paths found":               true,
			"Most articles in paths":   true,
			"Most articles explored":   true,
			"Longest path":             true,
		},
		"Past week": {
			"Most paths found":               true,
			"Most articles in paths":   true,
			"Most articles explored":   true,
			"Longest path":             true,
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
				{Key: "Most paths found", Value: "10"},
				{Key: "Most articles in paths", Value: "5"},
				{Key: "Most articles explored", Value: "100"},
				{Key: "Longest path", Value: "3 hops"},
			},
		},
	}

	current := []RecordPeriod{
		{
			Period: "All time",
			Rows: []RecordRow{
				{Key: "Most paths found", Value: "10"},
				{Key: "Most articles in paths", Value: "5"},
				{Key: "Most articles explored", Value: "100"},
				{Key: "Longest path", Value: "6 hops"},
			},
		},
	}

	meta := SearchMeta{PathsFound: 10, ArticlesInPaths: 5, NodesExplored: 100, MinHops: 6}
	got := AnnotateRecordBadges(current, previous, meta)

	if !got[0].Rows[3].Badge {
		t.Fatal("expected badge on Longest path row when beating previous max hops")
	}
}

func TestAnnotateRecordBadges_shortestPathLegacyKey(t *testing.T) {
	previous := []RecordPeriod{
		{
			Period: "All time",
			Rows: []RecordRow{
				{Key: "Most paths found", Value: "10"},
				{Key: "Most articles in paths", Value: "5"},
				{Key: "Most articles explored", Value: "100"},
				{Key: "Shortest path", Value: "3 hops"},
			},
		},
	}

	current := []RecordPeriod{
		{
			Period: "All time",
			Rows: []RecordRow{
				{Key: "Most paths found", Value: "10"},
				{Key: "Most articles in paths", Value: "5"},
				{Key: "Most articles explored", Value: "100"},
				{Key: "Longest path", Value: "6 hops"},
			},
		},
	}

	meta := SearchMeta{PathsFound: 10, ArticlesInPaths: 5, NodesExplored: 100, MinHops: 6}
	got := AnnotateRecordBadges(current, previous, meta)

	if !got[0].Rows[3].Badge {
		t.Fatal("expected badge on Longest path row when beating legacy Shortest path prev")
	}
}

func TestAnnotateRecordBadges_legacyMostNodesKey(t *testing.T) {
	previous := []RecordPeriod{
		{
			Period: "All time",
			Rows: []RecordRow{
				{Key: "Most paths found", Value: "10"},
				{Key: "Most nodes", Value: "100"},
				{Key: "Longest path", Value: "3 hops"},
			},
		},
	}

	current := []RecordPeriod{
		{
			Period: "All time",
			Rows: []RecordRow{
				{Key: "Most paths found", Value: "10"},
				{Key: "Most articles explored", Value: "200"},
				{Key: "Longest path", Value: "3 hops"},
			},
		},
	}

	meta := SearchMeta{PathsFound: 10, NodesExplored: 200, MinHops: 3}
	got := AnnotateRecordBadges(current, previous, meta)

	if !got[0].Rows[1].Badge {
		t.Fatal("expected badge on Most articles explored row when beating legacy Most nodes prev")
	}
}
