import type { GraphData, WikiLink, WikiNode, WikiNodeVariant } from '../components/GraphWiki/GraphWiki';

/**
 * === Grill: Reveal — client-side graph accumulation ===
 *
 * This module is the Reveal-mode sibling of `dailyGraph.ts` (Classic). It
 * folds each `/api/reveal-guess` response (see `RevealGuessResponse` below,
 * mirroring `service.RevealGuessResult` in
 * `service/internal/service/reveal.go`) into one running, deduped graph and
 * tracks a **per-node reveal state** in addition to the existing
 * `GraphWiki`/`WikiNode` shape. Consumers (issue 04's `GraphWikiReveal`
 * canvas, issue 05's revealed-neighbors panel, issue 07's win/loss full
 * reveal, issue 08's persistence) should read this file top-to-bottom — it
 * is meant to be self-explanatory without any other context.
 *
 * ## Node states (`RevealNodeState`)
 *
 * - `'unknown'` — the hidden article's node specifically. There is exactly
 *   one of these at any time (before a win/loss reveal). It is present in
 *   the graph from the very first render, before any guess is made — see
 *   `createInitialRevealGraph`. Rendered as "Unknown" until solved.
 * - `'named'` — revealed via some guess's *neighbor reveal* (the guessed
 *   article's outbound links, all named). Has a real title, is hoverable on
 *   canvas, and belongs in the revealed-neighbors side panel.
 * - `'blank'` — appears only via a *path reveal* (the shortest-path subgraph
 *   between a guess and the hidden article) and has not (yet) been
 *   independently named via a neighbor reveal. Deliberately has no `label`
 *   even though the server-computed path technically knows its title —
 *   Reveal mode's whole mechanic is that path nodes render as blank,
 *   unlabeled circles until confirmed by name (see spec, story 7).
 *
 * ## The one hard constraint: `blank → named` is one-way
 *
 * The moment any guess (this one or a past/future one) names a node via its
 * neighbor reveal, that node is `named` forever. A later merge that only
 * re-sees the same node via a *path* reveal must never downgrade it back to
 * `blank`. `mergeRevealGuess` below enforces this by always upgrading
 * (`blank`/absent → `named`) and never downgrading (`named` → `blank`).
 *
 * The other transition, `unknown → named`, happens exactly once, for the
 * hidden node specifically, on a winning or losing guess (full reveal). This
 * module doesn't drive that transition on its own (issue 07 does), but
 * exposes `revealNode` as the primitive it should use — see below.
 *
 * ## Node identity
 *
 * Every non-hidden node's id is its real Wikipedia article title, exactly
 * like Classic's path/guess nodes (`buildGuessGraphData` in
 * `service/internal/service/guess.go` sets `WikiNode.ID` to the title
 * string). The hidden node's id is the stable per-day placeholder id
 * (`config.PlaceholderID` server-side) — pass the same string in as
 * `hiddenId` on every call so the "Unknown" node's identity never drifts
 * across guesses or across a page reload.
 */
export type RevealNodeState = 'named' | 'blank' | 'unknown';

/** A `WikiNode` (see `GraphWiki.tsx`) plus this module's reveal-state tag. */
export interface RevealNode extends WikiNode {
  state: RevealNodeState;
}

/** The accumulated Reveal-mode graph — a drop-in `GraphData`-shaped object
 * (nodes/links) except each node additionally carries `state`. Suitable for
 * canvas rendering (issue 04) and side-panel listing (issue 05) as-is. */
export interface RevealGraphData {
  nodes: RevealNode[];
  links: WikiLink[];
}

/** One outbound neighbor of a guessed article, resolved to its title.
 * Mirrors `graph.NeighborInfo` (`service/internal/graph/graph.go`). The
 * hidden article is always filtered out of this list server-side, so it
 * never needs special-casing here. */
export interface RevealNeighbor {
  id: number;
  title: string;
}

/**
 * The JSON response shape of `/api/reveal-guess`, mirroring
 * `service.RevealGuessResult` (`service/internal/service/reveal.go`) field
 * for field. Read that file for authoritative field semantics; summarized:
 *
 * - `neighbors` — this guess's neighbor reveal (→ `named` nodes).
 * - `graphData` — this guess's path reveal, same shape Classic uses, with
 *   the hidden article masked behind the stable per-day placeholder id
 *   (`hiddenId`) unless `correct`/`lost` is true (→ `blank`/unknown nodes).
 * - `answer` — only populated on `correct`/`lost`; the real hidden title.
 */
export interface RevealGuessResponse {
  guess: string;
  correct: boolean;
  lost?: boolean;
  answer?: string;
  neighbors: RevealNeighbor[];
  noPathFound?: boolean;
  pathsFound: number;
  minHops: number;
  paths: string[][];
  graphData: GraphData;
  maxHops: number;
  maxPaths: number;
}

/**
 * The graph state to render before any guess has been made: just the
 * hidden article's `unknown` node, labeled "Unknown", at id `hiddenId`
 * (the day's stable placeholder id).
 */
export function createInitialRevealGraph(hiddenId: string): RevealGraphData {
  return {
    nodes: [{ id: hiddenId, variant: 'hidden-end', label: 'Unknown', state: 'unknown' }],
    links: [],
  };
}

function linkKey(link: WikiLink): string {
  return `${link.source}→${link.target}`;
}

/**
 * Merge one `/api/reveal-guess` response into the running accumulated graph.
 * `hiddenId` must be the same stable per-day placeholder id passed to
 * `createInitialRevealGraph` (and present in `response.graphData` wherever
 * the hidden article appears masked) so the "Unknown" node's identity lines
 * up across every call.
 *
 * Merge order matters for correctness, not just cosmetics: neighbor-reveal
 * nodes are folded in first (establishing `named` state), then path-reveal
 * nodes are folded in second and only ever added as `blank` when not
 * already present/named — this is what makes `blank → named` one-way (see
 * module doc above). Edges accumulate without duplication, keyed by
 * `source→target`, same convention as `dailyGraph.ts`'s `mergeGraphData`.
 */
export function mergeRevealGuess(
  accumulated: RevealGraphData,
  response: RevealGuessResponse,
  hiddenId: string,
): RevealGraphData {
  const nodes = [...accumulated.nodes];
  const indexById = new Map(nodes.map((n, i) => [n.id, i]));

  function upsertNamed(id: string, label: string, variant?: WikiNodeVariant) {
    const existingIndex = indexById.get(id);
    if (existingIndex === undefined) {
      indexById.set(id, nodes.length);
      nodes.push({ id, label, variant, state: 'named' });
      return;
    }
    const existing = nodes[existingIndex];
    if (existing.state === 'unknown') return; // unknown→named is issue 07's call, not ours
    if (existing.state !== 'named') {
      nodes[existingIndex] = { ...existing, label, state: 'named' };
    }
  }

  function upsertBlank(id: string, variant?: WikiNodeVariant) {
    const existingIndex = indexById.get(id);
    if (existingIndex === undefined) {
      indexById.set(id, nodes.length);
      nodes.push({ id, variant, state: 'blank' }); // deliberately no label — see module doc
      return;
    }
    // Node already known (named, blank, or unknown) — never downgrade or overwrite.
  }

  // 1. Neighbor reveal: always named.
  for (const neighbor of response.neighbors) {
    upsertNamed(neighbor.title, neighbor.title, 'default');
  }

  // 2. Path reveal: the hidden node is handled via its persistent `unknown`
  //    entry (or a future full-reveal transition) — skip it here. Every
  //    other path node becomes `blank` unless already named/known.
  for (const node of response.graphData.nodes) {
    if (node.id === hiddenId) continue;
    upsertBlank(node.id, node.variant);
  }

  const links = [...accumulated.links];
  const linkKeys = new Set(links.map(linkKey));
  for (const link of response.graphData.links) {
    const key = linkKey(link);
    if (!linkKeys.has(key)) {
      linkKeys.add(key);
      links.push(link);
    }
  }

  return { nodes, links };
}

/**
 * Transition a single node to `named` with a real title — the primitive
 * issue 07's win/loss full reveal should drive: once per blank node
 * (real title now known) and once for the hidden node itself (id
 * `hiddenId`, `unknown → named`, whose `variant` should also flip from
 * `'hidden-end'` to `'end'` by the caller if desired via `variant`).
 * No-op if `id` isn't present in the graph. Never called from
 * `mergeRevealGuess` itself — kept as an explicit, separate step so a
 * regular guess response can never accidentally trigger a full reveal.
 */
export function revealNode(
  graph: RevealGraphData,
  id: string,
  title: string,
  variant?: WikiNodeVariant,
): RevealGraphData {
  const index = graph.nodes.findIndex((n) => n.id === id);
  if (index === -1) return graph;
  const nodes = [...graph.nodes];
  nodes[index] = { ...nodes[index], label: title, state: 'named', ...(variant ? { variant } : {}) };
  return { nodes, links: graph.links };
}
