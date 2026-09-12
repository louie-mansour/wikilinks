import { Button } from '../Button/Button';
import type { RevealGraphData } from '../../data/revealGraph';
import styles from './RevealedNeighborsPanel.module.css';

export interface RevealedNeighborsPanelProps {
  /** The accumulated Reveal-mode graph (see `revealGraph.ts`) — same object
   *  passed to `GraphWikiReveal`. This component derives its row list by
   *  filtering to `named`-state nodes itself; no separate API call. */
  graphData: RevealGraphData;
  /** Number of additional named nodes available beyond what's currently
   *  rendered, for the "Load N more of M" control. Omit/0 to hide it. */
  remainingCount?: number;
  /** Total remaining named nodes not yet shown, if different from
   *  `remainingCount` (e.g. paging in smaller batches than the full tail). */
  totalRemainingCount?: number;
  onLoadMore?: () => void;
  /** Fired with a node's id when its row is clicked, so a parent can
   *  highlight/center that node on `GraphWikiReveal`'s canvas. */
  onNodeSelect?: (id: string) => void;
}

/**
 * `RevealedNeighborsPanel` — Reveal mode's sibling of Classic's
 * `DirectConnectionsPanel`, for the persistent list of every `named`-state
 * node revealed so far (see `docs/grill-reveal-mode/issues/05-revealed-neighbors-panel.md`).
 *
 * Unlike `DirectConnectionsPanel`, this list is **not** filtered to
 * backlinks of a specific answer and carries no relevance scoring — it is
 * every outbound neighbor named by any guess so far, in reveal order.
 * `RevealNode`/`RevealGraphData` (see `revealGraph.ts`) don't currently tag
 * a node with "which guess revealed this", so grouping per guess isn't
 * available without changing that module (out of scope here per the
 * accompanying issue, which explicitly allows plain reveal order); the
 * `nodes` array's insertion order already reflects reveal order since
 * `mergeRevealGuess` only ever appends newly-named nodes.
 *
 * A deliberately controlled/presentational component: it owns no state of
 * its own (not even pagination offset) so that issue 08 can later persist
 * the accumulated `graphData` (and any pagination cursor a parent tracks)
 * across reloads without this component needing to change.
 */
export function RevealedNeighborsPanel({
  graphData,
  remainingCount,
  totalRemainingCount,
  onLoadMore,
  onNodeSelect,
}: RevealedNeighborsPanelProps) {
  const namedNodes = graphData.nodes.filter((node) => node.state === 'named');

  return (
    <section className={styles.section} aria-label="Revealed articles">
      <div className={styles.listHeader}>
        <h2 className={styles.title}>Revealed articles</h2>
      </div>

      {namedNodes.length === 0 ? (
        <p className={styles.empty}>No articles revealed yet.</p>
      ) : (
        <ul className={styles.list}>
          {namedNodes.map((node) => (
            <li key={node.id}>
              <button
                type="button"
                className={styles.row}
                onClick={() => onNodeSelect?.(node.id)}
              >
                <span className={styles.rowTitle}>{node.label ?? node.id}</span>
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
