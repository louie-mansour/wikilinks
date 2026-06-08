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
