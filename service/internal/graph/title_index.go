package graph

import (
	"sort"
	"strings"
)

// TitleIndex is a sorted slice of article titles for case-insensitive prefix search.
type TitleIndex struct {
	titles []string
}

// NewTitleIndex copies and sorts titles for prefix lookup.
func NewTitleIndex(titles []string) TitleIndex {
	sorted := append([]string(nil), titles...)
	sort.Slice(sorted, func(i, j int) bool {
		return strings.ToLower(sorted[i]) < strings.ToLower(sorted[j])
	})
	return TitleIndex{titles: sorted}
}

// PrefixSearch returns up to limit titles whose lowercase form has the given prefix.
func (idx TitleIndex) PrefixSearch(prefix string, limit int) []string {
	if prefix == "" || limit <= 0 || len(idx.titles) == 0 {
		return nil
	}

	q := strings.ToLower(prefix)
	n := len(idx.titles)
	i := sort.Search(n, func(j int) bool {
		return strings.ToLower(idx.titles[j]) >= q
	})

	results := make([]string, 0, limit)
	for i < n && len(results) < limit {
		title := idx.titles[i]
		if !strings.HasPrefix(strings.ToLower(title), q) {
			break
		}
		results = append(results, title)
		i++
	}
	return results
}
