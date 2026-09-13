import type { GraphData, WikiLink, WikiNode, WikiNodeVariant } from '../components/GraphWiki/GraphWiki';
import { MAX_DAILY_GUESSES } from './dailyGraph';

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
 * - `'named'` — revealed, via some guess's *neighbor reveal* (the guessed
 *   article's outbound links) or its *path reveal* (the shortest-path
 *   subgraph between that guess and the hidden article, capped at
 *   `revealPathNodeCap` — see `service/internal/service/reveal.go`). Both
 *   reveal a real title immediately; a path/backlink node is never left as
 *   an unlabeled placeholder just because a neighbor reveal hasn't
 *   independently surfaced it too — that defeats the entire point of the
 *   cap mechanic (up to 50 nodes revealed per guess). Has a real title, is
 *   hoverable on canvas, and belongs in the revealed-neighbors side panel.
 * - `'blank'` — the article the player actually *guessed*, specifically
 *   (and, for a stale persisted graph, any path node saved before path
 *   nodes were named immediately). Its `id` is a real, known title (not a
 *   secret — the player just typed it), but it isn't independently
 *   "revealed" until named via a neighbor reveal or full reveal — mirrors
 *   the backend's own accounting, where `revealPathNodeCap` is explicitly a
 *   cap on *non-guess, non-target* nodes.
 *
 * ## The one hard constraint: state only ever upgrades, never downgrades
 *
 * The moment any guess (this one or a past/future one) names a node — via
 * either its neighbor reveal or its path reveal — that node is `named`
 * forever. `mergeRevealGuess` below enforces this by always upgrading
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
 *   (`hiddenId`) unless `correct`/`lost` is true (→ `named`/unknown nodes).
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
 * Neighbor-reveal nodes are folded in first, then path-reveal nodes second —
 * both via `upsertNamed`, so either can name a node first and neither can
 * ever downgrade it afterward (see module doc above). Edges accumulate
 * without duplication, keyed by `source→target`, same convention as
 * `dailyGraph.ts`'s `mergeGraphData`.
 */
export function mergeRevealGuess(
  accumulated: RevealGraphData,
  response: RevealGuessResponse,
  hiddenId: string,
  guessNumber?: number,
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

  // This guess's own node — always the article the player just typed. If it's
  // brand new, add it as `blank` (see module doc). If it happens to match a
  // node already in the graph (e.g. a title surfaced earlier as some other
  // guess's neighbor/path reveal), convert that node to `variant: 'guess'` so
  // it's visually marked as guessed too, tagged with this guess's number —
  // except the hidden/target node, which is never converted (guarded by the
  // `state === 'unknown'` check; the caller also never routes the hidden
  // node's placeholder id or the revealed answer title through here, see the
  // loop below).
  function upsertBlank(id: string, variant?: WikiNodeVariant) {
    const existingIndex = indexById.get(id);
    if (existingIndex === undefined) {
      indexById.set(id, nodes.length);
      nodes.push({ id, variant, guessNumber, state: 'blank' }); // deliberately no label — see module doc
      return;
    }
    const existing = nodes[existingIndex];
    if (existing.state === 'unknown') return; // never convert the hidden/target node
    if (existing.variant !== 'guess') {
      nodes[existingIndex] = { ...existing, variant: 'guess', guessNumber };
    }
  }

  // 1. Neighbor reveal: always named.
  for (const neighbor of response.neighbors) {
    upsertNamed(neighbor.title, neighbor.title, 'default');
  }

  // 2. Path reveal: the hidden node is handled via its persistent `unknown`
  //    entry (or a future full-reveal transition) — skip it here. The guess
  //    node itself stays `blank` (real title, just not independently
  //    "revealed" — only a neighbor reveal or full reveal names it, same as
  //    before), matching the backend's own accounting: `revealPathNodeCap`
  //    (`service/internal/service/reveal.go`) is explicitly a cap on
  //    non-guess, non-target nodes. Every other path/backlink node — the up
  //    to 50 nodes that cap exists to reveal, radiating outward from the
  //    guess and then backfilled around the target — is named immediately;
  //    that is the whole point of the cap mechanic, so one of these nodes
  //    must never sit there as an unlabeled placeholder. On a correct/losing
  //    guess the server unmasks the hidden node's id to the real answer
  //    title (see `RevealGuessResponse.answer` doc above), so it no longer
  //    equals `hiddenId` — match on `response.answer` too, or this loop
  //    would insert a second node for the same target article.
  for (const node of response.graphData.nodes) {
    if (node.id === hiddenId || (response.answer && node.id === response.answer)) continue;
    if (node.variant === 'guess') {
      upsertBlank(node.id, node.variant);
      continue;
    }
    upsertNamed(node.id, node.id, node.variant);
  }

  const links = [...accumulated.links];
  const linkKeys = new Set(links.map(linkKey));

  function addLink(link: WikiLink) {
    const key = linkKey(link);
    if (!linkKeys.has(key)) {
      linkKeys.add(key);
      links.push(link);
    }
  }

  for (const link of response.graphData.links) {
    addLink(link);
  }

  // The server reports neighbor titles alone (see `graph.NeighborInfo` /
  // `RevealNeighbors`) — it never emits edges for them, and `RevealNeighbors`
  // is deliberately uncapped (every index-1 node across every shortest path,
  // not just the ones `buildRevealGraphData` had cap budget to keep — see
  // `service/internal/service/reveal.go`). So most of `response.neighbors`
  // has no revealed continuation toward the target this guess: synthesizing
  // a guess -> neighbor edge for all of them would draw a line from the
  // guess to a node that, as far as the revealed graph shows, goes nowhere —
  // exactly the "connected to guess but doesn't eventually link to the
  // target" bug reported against this mode. Only wire the edge when the
  // neighbor is also part of this guess's own capped, connected path reveal
  // (`response.graphData.nodes`), which `buildRevealGraphData` guarantees is
  // a real, complete chain through to the target; the node itself is still
  // named above so it still appears in the revealed-neighbors panel, just
  // without a misleading edge on the canvas.
  const connectedNodeIds = new Set(response.graphData.nodes.map((n) => n.id));
  for (const neighbor of response.neighbors) {
    if (!connectedNodeIds.has(neighbor.title)) continue;
    addLink({ source: response.guess, target: neighbor.title });
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

/**
 * Adapt a `RevealGraphData` to the plain `GraphData` shape `GraphWiki` (the
 * sandbox/Classic canvas) expects, reusing `GraphWiki`'s own BFS-layered
 * layout unmodified (see `.claude/rules/graphwiki-node-connections.md`) —
 * this module does the adapting, not `GraphWiki` itself.
 *
 * `GraphWiki`'s layering roots depth 0 at every `variant: 'start'` node, or —
 * when there is none — every `variant: 'guess'` node (a multi-source BFS, see
 * `rootIds`/`computeBfsDepths` in `GraphWiki.tsx`). Reveal has no start
 * article (every guess is its own independent root funneling toward the one
 * hidden article), so no synthetic node is needed here: passing `graph.nodes`
 * and `graph.links` straight through already gives `GraphWiki` one root per
 * guess.
 *
 * Per-state mapping:
 * - `named` — passes through as-is (variant included, e.g. a `guess` node
 *   that was later confirmed by a neighbor reveal, or the hidden node once
 *   revealed via `revealNode`/`applyFullReveal`, already carrying `variant:
 *   'end'`).
 * - `unknown` — the hidden node pre-reveal: mapped to `variant: 'end'` (so
 *   `GraphWiki` treats it as the layout's terminal end, same as Classic's
 *   revealed answer) with its `label` ("Unknown") passed through so it never
 *   renders its placeholder `id` as text.
 * - `blank`, `variant: 'guess'` — the article the player actually typed;
 *   passes through as `variant: 'guess'` with no `label`, so `GraphWiki`
 *   falls back to its `id` (the real guess title — not a secret, the player
 *   just typed it) rather than the empty string it uses for `hidden-end`.
 * - `blank`, otherwise — only reachable via a stale graph persisted before
 *   path nodes were named immediately (`mergeRevealGuess` no longer
 *   produces this combination itself): mapped to `hidden-end` so
 *   `GraphWiki` renders it as an unlabeled masked node.
 *
 * One filter runs before any of the above: a plain (`variant: 'default'` or
 * unset), non-guess `named` node with zero incident links — a neighbor
 * reveal (`upsertNamed(..., 'default')` in `mergeRevealGuess`) that never
 * turned out to be part of any guess's connected path reveal, so
 * `mergeRevealGuess` deliberately drew no edge for it (see its "dead-end
 * neighbor" comment above) — is dropped from the canvas graph entirely
 * rather than passed through. `GraphWiki`'s layout still has to place every
 * node it's given somewhere, and for a node with no edges that "somewhere"
 * is one column past the farthest connected node (see
 * `computeBfsDepthsFromEnd` in `GraphWiki.tsx`) — every dead-end neighbor
 * from every guess piles into that same stray column, rendering as a
 * cluster of floating, unconnected dots (the bug this filter exists to
 * fix). The node stays `named` in `graph.nodes` untouched — still counted
 * by `buildRevealShareSummary` and still available to a future
 * revealed-neighbors side panel — this filter only affects what reaches the
 * canvas.
 *
 * Every other variant is exempt even when linkless, because each is already
 * a meaningful anchor on its own rather than incidental clutter: `guess`
 * (a guess with `noPathFound` stays linkless by design, per
 * `service/internal/service/reveal.go`'s `SubmitReveal`), `end`/`hidden-end`
 * (the target — linkless before any guess as `unknown`, and, after a full
 * reveal with no path ever having been drawn to it, still linkless as
 * `named`), and `path`/`backlink` (always linked in practice, per
 * `buildRevealGraphData`, but not this filter's concern either way).
 */
export function toWikiGraphData(graph: RevealGraphData): GraphData {
  const connectedIds = new Set<string>();
  for (const link of graph.links) {
    connectedIds.add(link.source);
    connectedIds.add(link.target);
  }

  const visibleNodes = graph.nodes.filter((n) => {
    const isDeadEndNeighbor = n.state === 'named' && (n.variant === 'default' || n.variant === undefined);
    return !isDeadEndNeighbor || connectedIds.has(n.id);
  });

  const nodes: WikiNode[] = visibleNodes.map((n): WikiNode => {
    if (n.state === 'named') {
      return { id: n.id, label: n.label, variant: n.variant, guessNumber: n.guessNumber };
    }
    if (n.state === 'unknown') {
      return { id: n.id, label: n.label, variant: 'end' };
    }
    if (n.variant === 'guess') {
      return { id: n.id, variant: 'guess', guessNumber: n.guessNumber };
    }
    return { id: n.id, variant: 'hidden-end' };
  });

  return { nodes, links: graph.links };
}

/**
 * Client-side repeat-guess prevention for Reveal mode — the Reveal sibling
 * of Classic's `hasAlreadyGuessed` (`dailyGraph.ts`). Same case-insensitive,
 * trimmed match against the day's guesses made so far, checked purely
 * client-side (no network round-trip) before a guess is even submitted.
 * Kept as its own copy here (rather than importing from `dailyGraph.ts`) so
 * this module stays self-contained per its module doc above; the logic is
 * intentionally identical.
 */
export function hasAlreadyGuessedReveal(guessedTitles: string[], candidate: string): boolean {
  const normalized = candidate.trim().toLowerCase();
  return guessedTitles.some((title) => title.trim().toLowerCase() === normalized);
}

/**
 * The full-reveal transition driven by a winning **or losing** guess (see
 * `docs/grill-reveal-mode/issues/06-guess-limit-loss-state.md` for loss,
 * `07-win-detection-full-reveal-share.md` for win) — both endings deliver
 * the same payload shape from `/api/reveal-guess` (`lost`/`correct` +
 * `answer`), and both should drive this exact same client transition, so it
 * lives here as one shared primitive rather than being duplicated per
 * outcome:
 *
 * - The hidden node (`hiddenId`, `state: 'unknown'`) flips to `named` with
 *   the real `answerTitle`, via `revealNode` (variant `'end'`).
 * - Every remaining `blank` node flips to `named` too — using its own `id`
 *   as the label. This is not new data from the server: per this module's
 *   "Node identity" doc above, a `blank` node's `id` has been its real
 *   Wikipedia title all along; `blank` only ever meant "known to exist, not
 *   yet *confirmed* by name" on screen. Full reveal is the point that
 *   distinction stops mattering.
 *
 * Already-`named` nodes are untouched (idempotent, matches `revealNode`'s
 * own no-op-when-already-named behavior via the one-way transition rule).
 */
export function applyFullReveal(
  graph: RevealGraphData,
  hiddenId: string,
  answerTitle: string,
): RevealGraphData {
  let next = revealNode(graph, hiddenId, answerTitle, 'end');
  for (const node of graph.nodes) {
    if (node.state === 'blank') {
      next = revealNode(next, node.id, node.id);
    }
  }
  return next;
}

/**
 * Build the copyable share summary text for a finished Reveal puzzle,
 * mirroring `buildShareSummary` (`dailyGraph.ts`, Classic) but in Reveal's
 * own format — no hop-chain, since Reveal's mechanic is "how much of the
 * graph did you have to expose", not "how short a path did you find":
 *
 * - Win: `Grill: Reveal #N: solved in {guessCount} guesses ({totalRevealed} nodes revealed)`
 * - Loss: `Grill: Reveal #N: X/5 ({totalRevealed} nodes revealed)`
 *
 * `totalRevealed` is derived from `graph` directly (count of `named`-state
 * nodes) rather than passed in separately, so callers can't drift it out of
 * sync with what's actually on screen — pass `graph` *after* `applyFullReveal`
 * has already run so the just-resolved hidden node and any formerly-blank
 * nodes are counted too.
 */
export function buildRevealShareSummary(
  puzzleNumber: number,
  guesses: RevealGuessResponse[],
  graph: RevealGraphData,
  lost = false,
): string {
  const totalRevealed = graph.nodes.filter((n) => n.state === 'named').length;
  if (lost) {
    return `Grill: Reveal #${puzzleNumber}: X/${MAX_DAILY_GUESSES} (${totalRevealed} nodes revealed)`;
  }
  return `Grill: Reveal #${puzzleNumber}: solved in ${guesses.length} guess${guesses.length === 1 ? '' : 'es'} (${totalRevealed} nodes revealed)`;
}
