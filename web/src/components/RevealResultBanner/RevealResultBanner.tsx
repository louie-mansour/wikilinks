import styles from './RevealResultBanner.module.css';

export type RevealOutcome = 'won' | 'lost';

export interface RevealResultBannerProps {
  /** Whether the game ended in a correct guess or a spent guess cap. */
  outcome: RevealOutcome;
  /** The real hidden article title, as delivered by the full-reveal payload
   *  (`answer` field on a `correct`/`lost` `/api/reveal-guess` response). */
  answer: string;
}

/**
 * `RevealResultBanner` — Reveal mode's end-of-game banner.
 *
 * Renders the two end states with distinct, non-generic copy (per
 * `docs/grill-reveal-mode/issues/06-guess-limit-loss-state.md`'s "distinct
 * from win state's messaging" requirement, and `07`'s "distinct from
 * Classic's" requirement): different wording/emoji from Classic's
 * `DailyGame` win/lose banners (`src/components/DailyGame/DailyGame.tsx`),
 * and different wording between `won` and `lost` here too, so the two
 * outcomes are never confusable at a glance.
 *
 * This issue (06) only drives the `lost` path end-to-end (via
 * `applyFullReveal` in `revealGraph.ts`); `won` is included here as the
 * natural sibling case so issue 07's win-handling work has a banner to
 * render into without introducing a second component.
 */
export function RevealResultBanner({ outcome, answer }: RevealResultBannerProps) {
  if (outcome === 'won') {
    return (
      <p className={styles.wonBanner} role="status">
        🔓 Revealed! The hidden article was <strong>{answer}</strong>.
      </p>
    );
  }

  return (
    <p className={styles.lostBanner} role="status">
      🔒 Out of guesses — the answer is revealed: <strong>{answer}</strong>.
    </p>
  );
}
