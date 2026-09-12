import type { GraphData, WikiLink } from '../components/GraphWiki/GraphWiki';
import type { GuessResult } from '../api/guess';

function linkKey(link: WikiLink): string {
  return `${link.source}→${link.target}`;
}

/**
 * Merge a new guess response's subgraph into the running accumulated graph.
 * Nodes/edges already present (matched by stable id / source+target pair —
 * the placeholder id scheme keeps the hidden end node's id identical across
 * every guess for the day) are kept as-is rather than duplicated.
 *
 * `hitCount` is repurposed here to count how many *separate guesses'*
 * revealed subgraphs have included a node (not, as elsewhere, hits within a
 * single search) — a node surfaced by multiple guesses is more likely to sit
 * structurally close to the answer than a one-off appearance. See
 * `buildDirectConnections`.
 */
export function mergeGraphData(accumulated: GraphData, incoming: GraphData): GraphData {
  const nodes = [...accumulated.nodes];
  const indexById = new Map(nodes.map((n, i) => [n.id, i]));
  for (const node of incoming.nodes) {
    const existingIndex = indexById.get(node.id);
    if (existingIndex === undefined) {
      indexById.set(node.id, nodes.length);
      nodes.push({ ...node, hitCount: 1 });
    } else {
      const existing = nodes[existingIndex];
      nodes[existingIndex] = { ...existing, hitCount: (existing.hitCount ?? 1) + 1 };
    }
  }

  const links = [...accumulated.links];
  const linkKeys = new Set(links.map(linkKey));
  for (const link of incoming.links) {
    const key = linkKey(link);
    if (!linkKeys.has(key)) {
      linkKeys.add(key);
      links.push(link);
    }
  }

  return { nodes, links };
}

export interface DirectConnection {
  id: string;
  outDegree: number;
  edgeCountToEnd: number;
  ratio: number;
  inDegree: number;
  hitCount: number;
  score: number;
}

/**
 * Tie-break relevance score for a direct connection candidate, used only to
 * order nodes that have appeared in the same number of guesses (see
 * `buildDirectConnections`):
 *
 * - `ratio` (N/D, edgeCountToEnd/outDegree) — the base signal: how specific
 *   this page's own linking behavior is toward the answer.
 * - `inDegree` — the candidate's own inbound-link count, an obscurity proxy.
 *   A generic hub (large `inDegree`) is discounted logarithmically so it
 *   doesn't outrank a rarely-linked page at the same ratio.
 *
 * `inDegree` defaults to 1 (neutral) when absent so older/partial data still
 * ranks sanely by `ratio` alone.
 */
function scoreDirectConnection(ratio: number, inDegree: number): number {
  return ratio / Math.log2(Math.max(inDegree, 1) + 2);
}

/**
 * Direct connections to the answer discovered so far — nodes in the merged
 * graph that are direct backlinks of the mystery article, per the
 * `outDegree`/`edgeCountToEnd`/`inDegree` fields the guess endpoint annotates
 * on them server-side (see `annotateDirectConnections` in
 * `service/internal/service/guess.go`). Sorted descending primarily by
 * `hitCount` (see `mergeGraphData`) — a node that keeps reappearing across
 * the player's independent guesses is the strongest signal of structural
 * closeness to the answer — with the ratio/inDegree score as a tie-breaker
 * among nodes seen the same number of times.
 */
export function buildDirectConnections(graph: GraphData): DirectConnection[] {
  return graph.nodes
    .filter((n) => (n.edgeCountToEnd ?? 0) > 0 && (n.outDegree ?? 0) > 0)
    .map((n) => {
      const ratio = n.edgeCountToEnd! / n.outDegree!;
      const inDegree = n.inDegree ?? 1;
      const hitCount = n.hitCount ?? 1;
      return {
        id: n.id,
        outDegree: n.outDegree!,
        edgeCountToEnd: n.edgeCountToEnd!,
        ratio,
        inDegree,
        hitCount,
        score: scoreDirectConnection(ratio, inDegree),
      };
    })
    .sort((a, b) => b.hitCount - a.hitCount || b.score - a.score);
}

/** Case-insensitive, trimmed match against the day's guesses made so far. */
export function hasAlreadyGuessed(guessedTitles: string[], candidate: string): boolean {
  const normalized = candidate.trim().toLowerCase();
  return guessedTitles.some((title) => title.trim().toLowerCase() === normalized);
}

/**
 * Relabel the accumulated graph's hidden-end node(s) with the real answer's
 * id/title on a winning guess, in place — no full graph re-fetch. Any links
 * pointing at the old placeholder id are repointed to the answer id, and the
 * result is deduped in case the answer id collides with a node already
 * revealed by an earlier guess.
 */
export function revealHiddenEnd(graph: GraphData, answer: string): GraphData {
  const hiddenIds = new Set(graph.nodes.filter((n) => n.variant === 'hidden-end').map((n) => n.id));
  if (hiddenIds.size === 0) return graph;

  const seenNodeIds = new Set<string>();
  const nodes = graph.nodes
    .map((n) => (hiddenIds.has(n.id) ? { ...n, id: answer, variant: 'end' as const, label: answer } : n))
    .filter((n) => {
      if (seenNodeIds.has(n.id)) return false;
      seenNodeIds.add(n.id);
      return true;
    });

  const seenLinkKeys = new Set<string>();
  const links = graph.links
    .map((l) => ({
      source: hiddenIds.has(l.source) ? answer : l.source,
      target: hiddenIds.has(l.target) ? answer : l.target,
    }))
    .filter((l) => {
      const key = linkKey(l);
      if (seenLinkKeys.has(key)) return false;
      seenLinkKeys.add(key);
      return true;
    });

  return { nodes, links };
}

/** Incorrect guesses allowed before the puzzle is lost and the answer is revealed. */
export const MAX_DAILY_GUESSES = 5;

/** The first scheduled daily puzzle date (Grill #1), UTC calendar day. */
const SCHEDULE_EPOCH_UTC = Date.UTC(2026, 8, 8);

/** Puzzle number ("Grill #N") for date's UTC calendar day. */
export function puzzleNumberForDate(date: Date): number {
  const dayUTC = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((dayUTC - SCHEDULE_EPOCH_UTC) / 86_400_000) + 1;
}

/**
 * Build the copyable share summary text for a finished puzzle, e.g.
 * "Grill #12: 4 guesses (7→4→2→0)" when solved, or "Grill #12: X/5
 * (7→4→2→1→3)" when lost. The hop sequence is each guess's shortest path
 * length in guess order ('X' for a no-path guess), ending in 0 for a
 * winning guess.
 */
export function buildShareSummary(puzzleNumber: number, guesses: GuessResult[], lost = false): string {
  const hopSequence = guesses.map((g) => (g.correct ? 0 : g.noPathFound ? 'X' : g.minHops)).join('→');
  if (lost) {
    return `Grill #${puzzleNumber}: X/${MAX_DAILY_GUESSES} (${hopSequence})`;
  }
  return `Grill #${puzzleNumber}: ${guesses.length} guess${guesses.length === 1 ? '' : 'es'} (${hopSequence})`;
}
