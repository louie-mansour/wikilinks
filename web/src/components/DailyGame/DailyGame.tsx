import { useCallback, useMemo, useState } from 'react';
import { Combobox } from '../Combobox/Combobox';
import { Button } from '../Button/Button';
import { GraphWiki, type GraphData } from '../GraphWiki/GraphWiki';
import { EmptyState } from '../EmptyState/EmptyState';
import { DailyShareSummary } from '../DailyShareSummary/DailyShareSummary';
import { useDebouncedSuggestions } from '../../hooks/useDebouncedSuggestions';
import { submitGuess, type GuessResult } from '../../api/guess';
import {
  buildShareSummary,
  hasAlreadyGuessed,
  MAX_DAILY_GUESSES,
  mergeGraphData,
  puzzleNumberForDate,
  revealHiddenEnd,
} from '../../data/dailyGraph';
import styles from './DailyGame.module.css';

const EMPTY_GRAPH: GraphData = { nodes: [], links: [] };

const TODAY_LABEL = new Date().toLocaleDateString(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function hopLabel(result: GuessResult): string {
  if (result.correct) return 'Correct!';
  if (result.noPathFound) return 'No path found';
  return `${result.minHops} hop${result.minHops === 1 ? '' : 's'}`;
}

function guessesRemainingLabel(guessCount: number): string {
  const remaining = MAX_DAILY_GUESSES - guessCount;
  return `${remaining} guess${remaining === 1 ? '' : 'es'} left`;
}

export function DailyGame() {
  const [guessValue, setGuessValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [graphData, setGraphData] = useState<GraphData>(EMPTY_GRAPH);

  const suggestions = useDebouncedSuggestions('start', guessValue);

  const won = guesses.some((g) => g.correct);
  const lost = guesses.some((g) => g.lost);
  const finished = won || lost;
  const shareSummary = useMemo(
    () => (finished ? buildShareSummary(puzzleNumberForDate(new Date()), guesses, lost) : null),
    [finished, lost, guesses],
  );

  const handleSubmit = useCallback(async () => {
    const guess = guessValue.trim();
    if (!guess || isSubmitting || finished) return;

    if (hasAlreadyGuessed(guesses.map((g) => g.guess), guess)) {
      setError(`You've already guessed "${guess}" — try a different article.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await submitGuess(guess, guesses.length + 1);
      setGuesses((prev) => [...prev, result]);
      if (result.correct) {
        setGraphData((prev) => revealHiddenEnd(prev, result.answer ?? result.guess));
      } else if (result.lost) {
        // The answer, and this guess's own graph (if any path was found), are both
        // revealed in the same response — relabel any earlier placeholder nodes,
        // then merge in the newly-revealed subgraph (already unmasked, so no
        // further relabeling needed for it).
        setGraphData((prev) =>
          mergeGraphData(revealHiddenEnd(prev, result.answer ?? result.guess), result.graphData),
        );
      } else {
        setGraphData((prev) => mergeGraphData(prev, result.graphData));
      }
      setGuessValue('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Guess failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [guessValue, isSubmitting, guesses, finished]);

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <div className={styles.wordmark}>
          <span className={styles.wordmarkIcon} aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="8" cy="3" r="2" fill="white" />
              <circle cx="3" cy="13" r="2" fill="white" />
              <circle cx="13" cy="13" r="2" fill="white" />
              <line x1="8" y1="5" x2="3" y2="11" stroke="white" strokeWidth="1.5" />
              <line x1="8" y1="5" x2="13" y2="11" stroke="white" strokeWidth="1.5" />
            </svg>
          </span>
          Grill
        </div>

        <p className={styles.tagline}>
          <span className={styles.date}>{TODAY_LABEL}</span> · Guess an article to reveal how it connects
          to today's hidden article
        </p>

        {won ? (
          <p className={styles.winBanner}>
            🎉 Solved! The hidden article was <strong>{guesses.find((g) => g.correct)?.answer}</strong>.
          </p>
        ) : lost ? (
          <p className={styles.loseBanner}>
            😔 Out of guesses. The hidden article was{' '}
            <strong>{guesses.find((g) => g.lost)?.answer}</strong>.
          </p>
        ) : (
          <>
            <div className={styles.guessRow}>
              <Combobox
                id="daily-guess"
                label="Guess an article"
                placeholder="Search for an article…"
                value={guessValue}
                suggestions={suggestions.suggestions}
                isLoading={suggestions.isLoading}
                onSelect={setGuessValue}
                onChange={setGuessValue}
                className={styles.combobox}
                analyticsRole="daily-guess"
              />
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={isSubmitting}
                disabled={!guessValue.trim()}
              >
                Guess
              </Button>
            </div>
            <p className={styles.guessesRemaining}>{guessesRemainingLabel(guesses.length)}</p>
          </>
        )}

        {error && <p className={styles.error}>{error}</p>}

        {shareSummary && <DailyShareSummary summary={shareSummary} />}
      </header>

      <div className={styles.graphPanel}>
        {graphData.nodes.length > 0 ? (
          <GraphWiki graphData={graphData} />
        ) : (
          <EmptyState hint="The hidden article is somewhere in here" />
        )}
      </div>

      <div className={styles.feed}>
        <div className={styles.feedHead}>Your guesses — {guesses.length}</div>
        {guesses.map((g, i) => (
          <div key={`${g.guess}-${i}`} className={styles.feedRow}>
            <span className={styles.feedIdx}>{i + 1}</span>
            <span className={`${styles.feedTitle} ${g.noPathFound ? styles.feedTitleDim : ''}`}>
              {g.guess}
            </span>
            <span
              className={`${styles.hopPill} ${g.noPathFound ? styles.hopPillNone : ''} ${g.correct ? styles.hopPillWin : ''} ${g.lost ? styles.hopPillLost : ''}`}
            >
              {hopLabel(g)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
