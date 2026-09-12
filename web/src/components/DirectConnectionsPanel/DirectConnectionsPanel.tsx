import { Button } from '../Button/Button';
import type { DirectConnection } from '../../data/dailyGraph';
import styles from './DirectConnectionsPanel.module.css';

interface DirectConnectionsPanelProps {
  entries: DirectConnection[];
  remainingCount?: number;
  totalRemainingCount?: number;
  onLoadMore?: () => void;
  onRowClick?: (id: string) => void;
}

function percentLabel(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

const compactNumber = new Intl.NumberFormat('en', { notation: 'compact' });

/** Secondary line explaining the non-ratio signals behind a row's rank (see dailyGraph.ts scoreDirectConnection). */
function relevanceMeta(entry: DirectConnection): string {
  const parts = [`${compactNumber.format(entry.inDegree)} incoming link${entry.inDegree === 1 ? '' : 's'}`];
  if (entry.hitCount > 1) {
    parts.push(`seen in ${entry.hitCount} guesses`);
  }
  return parts.join(' · ');
}

export function DirectConnectionsPanel({
  entries,
  remainingCount,
  totalRemainingCount,
  onLoadMore,
  onRowClick,
}: DirectConnectionsPanelProps) {
  return (
    <section className={styles.section} aria-label="Direct connections to the answer">
      <div className={styles.listHeader}>
        <h2 className={styles.title}>Direct connections to the answer</h2>
      </div>

      {entries.length === 0 ? (
        <p className={styles.empty}>No direct connections discovered yet.</p>
      ) : (
        <ul className={styles.list}>
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                className={styles.row}
                onClick={() => onRowClick?.(entry.id)}
              >
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>{entry.id}</span>
                  <span className={styles.rowMeta}>{relevanceMeta(entry)}</span>
                </span>
                <span className={styles.rowFraction}>
                  {entry.edgeCountToEnd}/{entry.outDegree}
                  <span className={styles.rowPercent}>{percentLabel(entry.ratio)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {remainingCount != null && remainingCount > 0 && (
        <div className={styles.loadMore}>
          <Button variant="secondary" onClick={onLoadMore}>
            Load {remainingCount} of {totalRemainingCount ?? remainingCount} more
          </Button>
        </div>
      )}
    </section>
  );
}
