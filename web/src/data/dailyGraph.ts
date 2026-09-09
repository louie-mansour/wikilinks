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
 */
export function mergeGraphData(accumulated: GraphData, incoming: GraphData): GraphData {
  const nodes = [...accumulated.nodes];
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const node of incoming.nodes) {
    if (!nodeIds.has(node.id)) {
      nodeIds.add(node.id);
      nodes.push(node);
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
