import { useCallback, useEffect, useMemo, useState } from 'react';
import { Combobox } from '../Combobox/Combobox';
import { Button } from '../Button/Button';
import { GraphWiki } from '../GraphWiki/GraphWiki';
import { RevealResultBanner } from '../RevealResultBanner/RevealResultBanner';
import { DailyShareSummary } from '../DailyShareSummary/DailyShareSummary';
import { useDebouncedSuggestions } from '../../hooks/useDebouncedSuggestions';
import { submitRevealGuess } from '../../api/revealGuess';
import { fetchDailyInfo } from '../../api/dailyInfo';
import {
  applyFullReveal,
  buildRevealShareSummary,
  createInitialRevealGraph,
  hasAlreadyGuessedReveal,
  MAX_DAILY_GUESSES,
  mergeRevealGuess,
  toWikiGraphData,
  type RevealGraphData,
  type RevealGuessResponse,
} from '../../data/revealGraph';
import {
  clearStaleRevealState,
  dateKeyUTC,
  loadRevealState,
  revealHiddenId,
  saveRevealState,
} from '../../data/revealPersistence';
import styles from './RevealGame.module.css';

const TODAY_LABEL = new Date().toLocaleDateString(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function hopLabel(result: RevealGuessResponse): string {
  if (result.correct) return 'Correct!';
  if (result.noPathFound) return 'No path found';
  return `${result.minHops} hop${result.minHops === 1 ? '' : 's'}`;
}

function guessesRemainingLabel(guessCount: number): string {
  const remaining = MAX_DAILY_GUESSES - guessCount;
  return `${remaining} guess${remaining === 1 ? '' : 'es'} left`;
}

export function RevealGame() {
  // Both the puzzle date key and the stable per-day hidden-node id are
  // derived once per mount from "now" — the puzzle boundary is the UTC
  // calendar day (see `revealPersistence.ts`), and the schedule/answer comes
  // from the server's `DailySchedule` config.
  const dateKey = useMemo(() => dateKeyUTC(new Date()), []);
  const hiddenId = useMemo(() => revealHiddenId(dateKey), [dateKey]);

  const [hasHydrated, setHasHydrated] = useState(false);
  const [guesses, setGuesses] = useState<RevealGuessResponse[]>([]);
  const [graphData, setGraphData] = useState<RevealGraphData>(() => createInitialRevealGraph(hiddenId));
  const [guessValue, setGuessValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  // Restore this mode's persisted state for today, and garbage-collect any
  // leftover Reveal state from a previous calendar day (date rollover) — see
  // `clearStaleRevealState`.
  useEffect(() => {
    clearStaleRevealState(dateKey);
    const persisted = loadRevealState(dateKey);
    if (persisted) {
      setGuesses(persisted.guesses);
      setGraphData(persisted.graphData);
    }
    setHasHydrated(true);
    // Only ever run once per mount — dateKey is stable for the component's
    // lifetime (a real date rollover means a fresh page load).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchDailyInfo()
      .then((info) => {
        if (!cancelled) setCategory(info.category);
      })
      .catch(() => {
        // Category hint is optional flavor — a failed fetch shouldn't block play.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const won = guesses.some((g) => g.correct);
  const lost = guesses.some((g) => g.lost);
  const finished = won || lost;
  const answer = guesses.find((g) => g.correct || g.lost)?.answer;

  // Note: the Go server's `-dev` flag rerolls to a new random target the
  // instant a puzzle finishes (see `Guess.maybeReroll` in
  // `service/internal/service/guess.go`), but the client does NOT auto-reset
  // to match. The finished result banner sticks around — same as production —
  // until the player clears this mode's persisted state (`grill-reveal:*` in
  // localStorage, see `revealPersistence.ts`) and reloads, same as a real
  // day's rollover would. This is deliberate: an automatic client-side reset
  // right after finishing made dev mode feel like it "immediately reset"
  // instead of giving the player a moment to see the result.
  //
  // Reveal's own share string — see `buildRevealShareSummary`.
  const shareSummary = useMemo(
    () => (finished ? buildRevealShareSummary(guesses) : null),
    [finished, guesses],
  );

  // Persist on every change, once the initial hydration read has happened —
  // otherwise the pre-hydration empty state would immediately clobber
  // whatever was just loaded.
  useEffect(() => {
    if (!hasHydrated) return;
    saveRevealState(dateKey, { date: dateKey, guesses, graphData, won, lost });
  }, [hasHydrated, dateKey, guesses, graphData, won, lost]);

  const suggestions = useDebouncedSuggestions('start', guessValue);

  const wikiGraphData = useMemo(() => toWikiGraphData(graphData), [graphData]);

  const handleSubmit = useCallback(async () => {
    const guess = guessValue.trim();
    if (!guess || isSubmitting || finished) return;

    if (hasAlreadyGuessedReveal(guesses.map((g) => g.guess), guess)) {
      setError(`You've already guessed "${guess}" — try a different article.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    const guessNumber = guesses.length + 1;
    // Every node already on screen from a prior guess — the hidden node's
    // placeholder id is never a real title the server would recognize, so
    // it's excluded (see `submitRevealGuess`'s doc).
    const known = graphData.nodes.map((n) => n.id).filter((id) => id !== hiddenId);
    try {
      const result = await submitRevealGuess(guess, guessNumber, known);
      setGuesses((prev) => [...prev, result]);
      setGraphData((prev) => {
        const merged = mergeRevealGuess(prev, result, hiddenId, guessNumber);
        // Full reveal on either ending — shared primitive, same payload
        // shape for `correct` and `lost` (see `applyFullReveal`'s doc).
        // Loss is this issue's job in full (issue 06); on a *win* this only
        // does the graph-state transition. Building the share string and any
        // win-specific UI beyond `RevealResultBanner`'s generic "won" copy is
        // left to issue 07 — see the TODO below.
        if (result.correct || result.lost) {
          return applyFullReveal(merged, hiddenId, result.answer ?? result.guess);
        }
        return merged;
      });
      setGuessValue('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Guess failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [guessValue, isSubmitting, finished, guesses, hiddenId, graphData]);

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
          Grill: Reveal
        </div>

        <p className={styles.tagline}>
          <span className={styles.date}>{TODAY_LABEL}</span> · Guess an article to reveal its neighbors —
          name every hop before you run out of guesses
        </p>

        {category && <span className={styles.categoryPill}>{category}</span>}

        {finished ? (
          <>
            <RevealResultBanner outcome={won ? 'won' : 'lost'} answer={answer ?? ''} />
            {shareSummary && <DailyShareSummary summary={shareSummary} />}
          </>
        ) : (
          <>
            <div className={styles.guessRow}>
              <Combobox
                id="reveal-guess"
                label="Guess an article"
                placeholder="Search for an article…"
                value={guessValue}
                suggestions={suggestions.suggestions}
                isLoading={suggestions.isLoading}
                onSelect={setGuessValue}
                onChange={setGuessValue}
                className={styles.combobox}
                analyticsRole="reveal-guess"
              />
              <Button
                variant="primary"
                className={styles.guessButton}
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
      </header>

      <div className={styles.mainRow}>
        <div className={styles.graphPanel}>
          <GraphWiki graphData={wikiGraphData} mode="reveal" />
        </div>
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
