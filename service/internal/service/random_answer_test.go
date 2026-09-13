package service

import (
	"testing"

	"github.com/louiemansour/wikilinks/service/internal/config"
)

func TestRandomAnswerSource_RerollWithSingleCandidateIsNoOp(t *testing.T) {
	src, err := NewRandomAnswerSource([]config.DailyPuzzle{{Article: "Albert Einstein", Category: "Person"}})
	if err != nil {
		t.Fatalf("NewRandomAnswerSource: %v", err)
	}

	src.Reroll()

	if got := src.Article(); got != "Albert Einstein" {
		t.Fatalf("Article() after Reroll = %q, want %q", got, "Albert Einstein")
	}
}

func TestRandomAnswerSource_RerollPicksADifferentArticle(t *testing.T) {
	candidates := []config.DailyPuzzle{
		{Article: "Albert Einstein", Category: "Person"},
		{Article: "Eiffel Tower", Category: "Place"},
	}
	src, err := NewRandomAnswerSource(candidates)
	if err != nil {
		t.Fatalf("NewRandomAnswerSource: %v", err)
	}
	before := src.Article()

	for i := 0; i < 20; i++ {
		src.Reroll()
		if src.Article() != before {
			return
		}
	}
	t.Fatalf("Reroll never produced a different article across 20 attempts (still %q)", before)
}
