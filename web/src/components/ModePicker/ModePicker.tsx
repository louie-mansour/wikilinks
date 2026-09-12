import styles from './ModePicker.module.css';

export type GameMode = 'classic' | 'reveal';

export interface ModePickerProps {
  /** Which mode's page this picker is rendered on. */
  active: GameMode;
}

/**
 * Small linked toggle between Classic (`/daily`) and Reveal (`/daily/reveal`)
 * mode, rendered on both pages (see
 * `docs/grill-reveal-mode/issues/08-persistence-mode-picker-routing.md`).
 *
 * Plain `<a>` links, not client-side navigation — `App.tsx`'s routing is a
 * one-shot `window.location.pathname` check on render, with no listener for
 * in-app navigation, so a full page load is the correct way to switch modes
 * without introducing a router.
 */
export function ModePicker({ active }: ModePickerProps) {
  return (
    <div className={styles.picker} role="tablist" aria-label="Game mode">
      <a
        href="/daily"
        role="tab"
        aria-current={active === 'classic' ? 'page' : undefined}
        aria-selected={active === 'classic'}
        className={`${styles.tab} ${active === 'classic' ? styles.tabActive : ''}`}
      >
        Classic
      </a>
      <a
        href="/daily/reveal"
        role="tab"
        aria-current={active === 'reveal' ? 'page' : undefined}
        aria-selected={active === 'reveal'}
        className={`${styles.tab} ${active === 'reveal' ? styles.tabActive : ''}`}
      >
        Reveal
      </a>
    </div>
  );
}
