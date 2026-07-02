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

// wordPrefixSearch returns titles where every whitespace/underscore token in query
// is a prefix of at least one word in the title. Titles in exclude are skipped.
// Used to supplement PrefixSearch with fuzzy word-boundary matches.
func (idx TitleIndex) wordPrefixSearch(query string, limit int, exclude []string) []string {
	tokens := titleTokens(query)
	if len(tokens) == 0 || limit <= 0 {
		return nil
	}

	excluded := excludeSet(exclude)

	results := make([]string, 0, limit)
	for _, title := range idx.titles {
		if len(results) >= limit {
			break
		}
		lower := strings.ToLower(title)
		if _, skip := excluded[lower]; skip {
			continue
		}
		words := splitWords(lower)
		if allPrefixMatch(tokens, words) {
			results = append(results, title)
		}
	}
	return results
}

// levenshteinSearch returns titles where every query token fuzzy-matches
// (edit distance ≤ 1 for tokens ≥ 4 chars, else exact prefix) at least one
// word in the title. Titles in exclude are skipped. Scans at most maxScan
// entries so the response stays fast even over millions of titles.
func (idx TitleIndex) levenshteinSearch(query string, limit int, exclude []string) []string {
	tokens := titleTokens(query)
	if len(tokens) == 0 || limit <= 0 {
		return nil
	}

	excluded := excludeSet(exclude)

	const maxScan = 500_000
	scan := len(idx.titles)
	if scan > maxScan {
		scan = maxScan
	}

	results := make([]string, 0, limit)
	for i := 0; i < scan && len(results) < limit; i++ {
		title := idx.titles[i]
		lower := strings.ToLower(title)
		if _, skip := excluded[lower]; skip {
			continue
		}
		words := splitWords(lower)
		if allFuzzyMatch(tokens, words) {
			results = append(results, title)
		}
	}
	return results
}

// stopWordSearch strips common function words from query and retries with the
// remaining tokens. For 4+ meaningful tokens it allows 1 unmatched token
// (≥75% match), handling sentence-like queries such as
// "Conference in San Francisco over the weekend".
func (idx TitleIndex) stopWordSearch(query string, limit int, exclude []string) []string {
	tokens := filterStopWords(titleTokens(query))
	if len(tokens) == 0 || limit <= 0 {
		return nil
	}
	// Allow 1 miss for queries with 4+ meaningful tokens; otherwise require all.
	minMatch := len(tokens) - len(tokens)/4
	if minMatch < 1 {
		minMatch = 1
	}
	excluded := excludeSet(exclude)
	results := make([]string, 0, limit)
	for _, title := range idx.titles {
		if len(results) >= limit {
			break
		}
		lower := strings.ToLower(title)
		if _, skip := excluded[lower]; skip {
			continue
		}
		if softPrefixMatch(tokens, splitWords(lower), minMatch) {
			results = append(results, title)
		}
	}
	return results
}

// softPrefixMatch counts how many tokens are a prefix of at least one word,
// returning true if the count meets minMatch.
func softPrefixMatch(tokens, words []string, minMatch int) bool {
	matched := 0
	for _, tok := range tokens {
		for _, w := range words {
			if strings.HasPrefix(w, tok) {
				matched++
				break
			}
		}
	}
	return matched >= minMatch
}

// stopWords is a conservative set of English function words that are unlikely
// to be the meaningful part of a Wikipedia article title.
var stopWords = map[string]struct{}{
	"a": {}, "an": {}, "the": {}, "and": {}, "or": {}, "but": {}, "nor": {},
	"in": {}, "on": {}, "at": {}, "to": {}, "for": {}, "of": {}, "by": {},
	"with": {}, "from": {}, "as": {}, "into": {}, "onto": {}, "over": {},
	"under": {}, "about": {}, "above": {}, "than": {}, "up": {}, "out": {},
	"is": {}, "are": {}, "was": {}, "were": {}, "be": {}, "been": {}, "being": {},
	"it": {}, "its": {}, "this": {}, "that": {}, "these": {}, "those": {},
	"i": {}, "me": {}, "my": {}, "we": {}, "our": {}, "you": {}, "your": {},
	"he": {}, "she": {}, "they": {}, "them": {}, "his": {}, "her": {}, "their": {},
}

func filterStopWords(tokens []string) []string {
	out := make([]string, 0, len(tokens))
	for _, t := range tokens {
		if _, isStop := stopWords[t]; !isStop {
			out = append(out, t)
		}
	}
	return out
}

// titleTokens splits a query on whitespace and underscores, lowercased.
func titleTokens(query string) []string {
	return strings.FieldsFunc(strings.ToLower(query), func(r rune) bool {
		return r == '_' || r == ' ' || r == '\t'
	})
}

func splitWords(lower string) []string {
	return strings.FieldsFunc(lower, func(r rune) bool { return r == '_' || r == ' ' })
}

func excludeSet(exclude []string) map[string]struct{} {
	s := make(map[string]struct{}, len(exclude))
	for _, t := range exclude {
		s[strings.ToLower(t)] = struct{}{}
	}
	return s
}

// allPrefixMatch reports whether every token is a prefix of at least one word.
func allPrefixMatch(tokens, words []string) bool {
	for _, tok := range tokens {
		found := false
		for _, w := range words {
			if strings.HasPrefix(w, tok) {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

// allFuzzyMatch reports whether every token fuzzy-matches at least one word
// (edit distance ≤ 1 for tokens ≥ 4 chars; exact prefix for shorter tokens).
func allFuzzyMatch(tokens, words []string) bool {
	for _, tok := range tokens {
		maxDist := 0
		if len(tok) >= 4 {
			maxDist = 1
		}
		found := false
		for _, w := range words {
			if levenshteinLE(tok, w, maxDist) {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

// levenshteinLE reports whether edit distance between a and b is ≤ maxDist.
// It treats b as a word and a as the query token: b may be longer (a prefix
// match also counts as distance 0). We compute distance against b[:len(a)+maxDist]
// so a short query matches the start of a long word.
func levenshteinLE(a, b string, maxDist int) bool {
	// Trim b to a reasonable length to avoid penalising long words too harshly.
	cap := len(a) + maxDist
	if cap > len(b) {
		cap = len(b)
	}
	b = b[:cap]

	if len(a) == 0 {
		return len(b) <= maxDist
	}

	// dp row — one allocation per call, small strings only.
	prev := make([]int, len(b)+1)
	for j := range prev {
		prev[j] = j
	}
	curr := make([]int, len(b)+1)

	for i, ca := range a {
		curr[0] = i + 1
		for j, cb := range b {
			cost := 1
			if ca == cb {
				cost = 0
			}
			curr[j+1] = min3(curr[j]+1, prev[j+1]+1, prev[j]+cost)
		}
		prev, curr = curr, prev
	}
	return prev[len(b)] <= maxDist
}

func min3(a, b, c int) int {
	if a < b {
		if a < c {
			return a
		}
		return c
	}
	if b < c {
		return b
	}
	return c
}
