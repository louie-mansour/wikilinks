package graph

import "testing"

func TestTitleIndexPrefixSearch(t *testing.T) {
	idx := NewTitleIndex([]string{"Article_C", "Article_A", "Article_D", "Article_B"})

	tests := []struct {
		prefix string
		limit  int
		want   []string
	}{
		{prefix: "article_a", limit: 10, want: []string{"Article_A"}},
		{prefix: "article", limit: 2, want: []string{"Article_A", "Article_B"}},
		{prefix: "article", limit: 10, want: []string{"Article_A", "Article_B", "Article_C", "Article_D"}},
		{prefix: "z", limit: 10, want: nil},
		{prefix: "", limit: 10, want: nil},
		{prefix: "article", limit: 0, want: nil},
	}

	for _, tc := range tests {
		got := idx.PrefixSearch(tc.prefix, tc.limit)
		checkStringSlice(t, "PrefixSearch("+tc.prefix+")", got, tc.want)
	}
}

func TestTitleIndexWordPrefixSearch(t *testing.T) {
	idx := NewTitleIndex([]string{
		"Robert_Munsch",
		"Robert_Frost",
		"Robert_De_Niro",
		"Municipality_of_Munich",
	})

	tests := []struct {
		query   string
		limit   int
		exclude []string
		want    []string
	}{
		// "mun" is a prefix of "munsch" and "munich" — matches both titles
		{query: "mun", limit: 10, exclude: nil, want: []string{"Municipality_of_Munich", "Robert_Munsch"}},
		// "robert mun" matches titles with a "robert" word AND a "mun"-prefix word
		{query: "robert mun", limit: 10, exclude: nil, want: []string{"Robert_Munsch"}},
		// multi-word: both tokens must be word prefixes
		{query: "de niro", limit: 10, exclude: nil, want: []string{"Robert_De_Niro"}},
		// "munch" is NOT a prefix of "munsch" (diverges at 4th char: c vs s)
		{query: "robert munch", limit: 10, exclude: nil, want: nil},
		// exclude already-returned exact matches
		{query: "robert", limit: 10, exclude: []string{"Robert_De_Niro", "Robert_Frost", "Robert_Munsch"}, want: nil},
		// empty query → nil
		{query: "", limit: 10, exclude: nil, want: nil},
		// limit 0 → nil
		{query: "robert", limit: 0, exclude: nil, want: nil},
	}

	for _, tc := range tests {
		got := idx.wordPrefixSearch(tc.query, tc.limit, tc.exclude)
		checkStringSlice(t, "wordPrefixSearch("+tc.query+")", got, tc.want)
	}
}

func TestTitleIndexLevenshteinSearch(t *testing.T) {
	idx := NewTitleIndex([]string{
		"Robert_Munsch",
		"Robert_Frost",
		"Robert_De_Niro",
		"Municipality_of_Munich",
	})

	tests := []struct {
		query   string
		limit   int
		exclude []string
		want    []string
	}{
		// "munch" is edit-distance 1 from "munsch" (insert 's') → match
		{query: "robert munch", limit: 10, exclude: nil, want: []string{"Robert_Munsch"}},
		// short token (<4 chars) requires exact prefix — "mun" matches both
		{query: "mun", limit: 10, exclude: nil, want: []string{"Municipality_of_Munich", "Robert_Munsch"}},
		// exclude already-found results
		{query: "robert munch", limit: 10, exclude: []string{"Robert_Munsch"}, want: nil},
		// empty query → nil
		{query: "", limit: 10, exclude: nil, want: nil},
	}

	for _, tc := range tests {
		got := idx.levenshteinSearch(tc.query, tc.limit, tc.exclude)
		checkStringSlice(t, "levenshteinSearch("+tc.query+")", got, tc.want)
	}
}
