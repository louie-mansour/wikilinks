import { describe, expect, it } from 'vitest';
import {
  applyFullReveal,
  buildRevealShareSummary,
  createInitialRevealGraph,
  hasAlreadyGuessedReveal,
  mergeRevealGuess,
  revealNode,
  toWikiGraphData,
  type RevealGuessResponse,
} from './revealGraph';

const HIDDEN_ID = 'hidden-2026-09-11';

function response(overrides: Partial<RevealGuessResponse>): RevealGuessResponse {
  return {
    guess: 'Guess',
    correct: false,
    neighbors: [],
    pathsFound: 0,
    minHops: 0,
    paths: [],
    graphData: { nodes: [], links: [] },
    maxHops: 10,
    maxPaths: 10000,
    ...overrides,
  };
}

describe('createInitialRevealGraph', () => {
  it('seeds a single unknown node before any guess', () => {
    const graph = createInitialRevealGraph(HIDDEN_ID);
    expect(graph.nodes).toEqual([{ id: HIDDEN_ID, variant: 'hidden-end', label: 'Unknown', state: 'unknown' }]);
    expect(graph.links).toEqual([]);
  });
});

describe('mergeRevealGuess', () => {
  it('names a node the moment any guess reveals it, whether by neighbor reveal or path reveal', () => {
    let graph = createInitialRevealGraph(HIDDEN_ID);

    // Guess 1: path reveal surfaces "Hop A" as a waypoint — named immediately,
    // per the reveal-cap mechanic (up to 50 path/backlink nodes revealed per guess).
    const guess1 = response({
      guess: 'Guess One',
      neighbors: [],
      graphData: {
        nodes: [
          { id: 'Guess One', variant: 'guess' },
          { id: 'Hop A', variant: 'path' },
          { id: HIDDEN_ID, variant: 'hidden-end' },
        ],
        links: [
          { source: 'Guess One', target: 'Hop A' },
          { source: 'Hop A', target: HIDDEN_ID },
        ],
      },
    });
    graph = mergeRevealGuess(graph, guess1, HIDDEN_ID);

    const hopAAfterGuess1 = graph.nodes.find((n) => n.id === 'Hop A');
    expect(hopAAfterGuess1?.state).toBe('named');
    expect(hopAAfterGuess1?.label).toBe('Hop A');

    // Guess 2: an unrelated guess's neighbor reveal happens to name "Hop A".
    const guess2 = response({
      guess: 'Guess Two',
      neighbors: [{ id: 42, title: 'Hop A' }],
      graphData: { nodes: [{ id: 'Guess Two', variant: 'guess' }], links: [] },
    });
    graph = mergeRevealGuess(graph, guess2, HIDDEN_ID);

    const hopAAfterGuess2 = graph.nodes.find((n) => n.id === 'Hop A');
    expect(hopAAfterGuess2?.state).toBe('named');
    expect(hopAAfterGuess2?.label).toBe('Hop A');

    // Guess 3: "Hop A" resurfaces on yet another path — must stay named.
    const guess3 = response({
      guess: 'Guess Three',
      neighbors: [],
      graphData: {
        nodes: [
          { id: 'Guess Three', variant: 'guess' },
          { id: 'Hop A', variant: 'path' },
        ],
        links: [{ source: 'Guess Three', target: 'Hop A' }],
      },
    });
    graph = mergeRevealGuess(graph, guess3, HIDDEN_ID);

    const hopAAfterGuess3 = graph.nodes.find((n) => n.id === 'Hop A');
    expect(hopAAfterGuess3?.state).toBe('named');
    expect(hopAAfterGuess3?.label).toBe('Hop A');
  });

  it('does not duplicate nodes or edges already accumulated on a repeated guess', () => {
    let graph = createInitialRevealGraph(HIDDEN_ID);

    const guess = response({
      guess: 'Guess One',
      neighbors: [{ id: 1, title: 'Neighbor A' }],
      graphData: {
        nodes: [
          { id: 'Guess One', variant: 'guess' },
          { id: 'Hop A', variant: 'path' },
          { id: HIDDEN_ID, variant: 'hidden-end' },
        ],
        links: [
          { source: 'Guess One', target: 'Hop A' },
          { source: 'Hop A', target: HIDDEN_ID },
        ],
      },
    });

    graph = mergeRevealGuess(graph, guess, HIDDEN_ID);
    const nodeCountAfterFirst = graph.nodes.length;
    const linkCountAfterFirst = graph.links.length;

    // Re-submit the exact same response (simulating a repeated/duplicate guess).
    graph = mergeRevealGuess(graph, guess, HIDDEN_ID);

    expect(graph.nodes).toHaveLength(nodeCountAfterFirst);
    expect(graph.links).toHaveLength(linkCountAfterFirst);
    expect(graph.nodes.filter((n) => n.id === 'Neighbor A')).toHaveLength(1);
    expect(graph.nodes.filter((n) => n.id === 'Hop A')).toHaveLength(1);
  });

  it('merges two guesses into one coherent graph object suitable for canvas rendering', () => {
    let graph = createInitialRevealGraph(HIDDEN_ID);

    const guess1 = response({
      guess: 'Guess One',
      neighbors: [{ id: 1, title: 'Neighbor A' }],
      graphData: {
        nodes: [
          { id: 'Guess One', variant: 'guess' },
          { id: 'Hop A', variant: 'path' },
          { id: HIDDEN_ID, variant: 'hidden-end' },
        ],
        links: [
          { source: 'Guess One', target: 'Hop A' },
          { source: 'Hop A', target: HIDDEN_ID },
        ],
      },
    });
    const guess2 = response({
      guess: 'Guess Two',
      neighbors: [{ id: 2, title: 'Neighbor B' }],
      graphData: {
        nodes: [
          { id: 'Guess Two', variant: 'guess' },
          { id: 'Hop B', variant: 'path' },
          { id: HIDDEN_ID, variant: 'hidden-end' },
        ],
        links: [
          { source: 'Guess Two', target: 'Hop B' },
          { source: 'Hop B', target: HIDDEN_ID },
        ],
      },
    });

    graph = mergeRevealGuess(graph, guess1, HIDDEN_ID);
    graph = mergeRevealGuess(graph, guess2, HIDDEN_ID);

    const ids = graph.nodes.map((n) => n.id).sort();
    expect(ids).toEqual(
      [HIDDEN_ID, 'Guess One', 'Guess Two', 'Hop A', 'Hop B', 'Neighbor A', 'Neighbor B'].sort(),
    );

    // Exactly one unknown node (the hidden article), never duplicated across merges.
    expect(graph.nodes.filter((n) => n.state === 'unknown')).toHaveLength(1);
    expect(graph.nodes.find((n) => n.id === HIDDEN_ID)?.label).toBe('Unknown');

    // Both neighbor reveal and path reveal name nodes immediately.
    expect(graph.nodes.find((n) => n.id === 'Neighbor A')?.state).toBe('named');
    expect(graph.nodes.find((n) => n.id === 'Neighbor B')?.state).toBe('named');
    expect(graph.nodes.find((n) => n.id === 'Hop A')?.state).toBe('named');
    expect(graph.nodes.find((n) => n.id === 'Hop B')?.state).toBe('named');

    // Edges from both guesses accumulate without duplication — 2 path edges
    // per guess. Neither guess's `graphData` includes its neighbor
    // ('Neighbor A' / 'Neighbor B') as a path node, so no guess->neighbor
    // edge is synthesized for either (see the dead-end regression tests
    // below) — they're named for the revealed-neighbors panel only.
    expect(graph.links).toHaveLength(4);
    expect(graph.links).toEqual(
      expect.arrayContaining([
        { source: 'Guess One', target: 'Hop A' },
        { source: 'Guess Two', target: 'Hop B' },
      ]),
    );
    expect(graph.links).not.toEqual(
      expect.arrayContaining([{ source: 'Guess One', target: 'Neighbor A' }]),
    );
  });

  it('tags the guess\'s own node with its 1-based guess number', () => {
    let graph = createInitialRevealGraph(HIDDEN_ID);

    graph = mergeRevealGuess(
      graph,
      response({ guess: 'Guess One', graphData: { nodes: [{ id: 'Guess One', variant: 'guess' }], links: [] } }),
      HIDDEN_ID,
      1,
    );
    graph = mergeRevealGuess(
      graph,
      response({ guess: 'Guess Two', graphData: { nodes: [{ id: 'Guess Two', variant: 'guess' }], links: [] } }),
      HIDDEN_ID,
      2,
    );

    expect(graph.nodes.find((n) => n.id === 'Guess One')?.guessNumber).toBe(1);
    expect(graph.nodes.find((n) => n.id === 'Guess Two')?.guessNumber).toBe(2);
  });

  it('converts an already-named node into a guess node when it is later guessed directly', () => {
    let graph = createInitialRevealGraph(HIDDEN_ID);

    // Guess 1 names "Hop A" as a plain connecting article via neighbor reveal.
    graph = mergeRevealGuess(
      graph,
      response({
        guess: 'Guess One',
        neighbors: [{ id: 1, title: 'Hop A' }],
        graphData: { nodes: [{ id: 'Guess One', variant: 'guess' }], links: [] },
      }),
      HIDDEN_ID,
      1,
    );
    expect(graph.nodes.find((n) => n.id === 'Hop A')).toMatchObject({ variant: 'default', state: 'named' });

    // Guess 2 is literally "Hop A" — the existing node should flip to a guess
    // node (tagged with guess #2) rather than staying a plain connecting node.
    graph = mergeRevealGuess(
      graph,
      response({
        guess: 'Hop A',
        graphData: { nodes: [{ id: 'Hop A', variant: 'guess' }], links: [] },
      }),
      HIDDEN_ID,
      2,
    );

    const hopA = graph.nodes.find((n) => n.id === 'Hop A');
    expect(hopA?.variant).toBe('guess');
    expect(hopA?.guessNumber).toBe(2);
    expect(hopA?.state).toBe('named'); // stays named — already-revealed title isn't downgraded
    expect(hopA?.label).toBe('Hop A');
  });

  it('never converts the hidden/target node into a guess node', () => {
    let graph = createInitialRevealGraph(HIDDEN_ID);

    // A malformed/defensive case: the hidden placeholder id appears tagged as
    // this guess's own node. It must stay unknown, never become a guess node.
    graph = mergeRevealGuess(
      graph,
      response({ guess: 'Guess One', graphData: { nodes: [{ id: HIDDEN_ID, variant: 'guess' }], links: [] } }),
      HIDDEN_ID,
      1,
    );

    const hidden = graph.nodes.find((n) => n.id === HIDDEN_ID);
    expect(hidden?.state).toBe('unknown');
    expect(hidden?.variant).toBe('hidden-end');
  });

  it('synthesizes a guess->neighbor edge only when the neighbor is also part of this guess\'s connected path reveal', () => {
    // Regression test: `RevealNeighbors` (server-side) is deliberately
    // uncapped — it returns every index-1 node across every shortest path,
    // while `graphData` is capped at `revealPathNodeCap` nodes total. A
    // neighbor missing from `graphData.nodes` has no revealed continuation
    // toward the target this guess, so drawing a guess->neighbor edge for it
    // would show a node "connected to the guess" that visually dead-ends —
    // the exact bug reported against this mode.
    let graph = createInitialRevealGraph(HIDDEN_ID);

    const guess = response({
      guess: 'Guess One',
      neighbors: [
        { id: 1, title: 'Connected Neighbor' }, // also a path node below
        { id: 2, title: 'Orphaned Neighbor' }, // not part of graphData at all
      ],
      graphData: {
        nodes: [
          { id: 'Guess One', variant: 'guess' },
          { id: 'Connected Neighbor', variant: 'path' },
          { id: HIDDEN_ID, variant: 'hidden-end' },
        ],
        links: [
          { source: 'Guess One', target: 'Connected Neighbor' },
          { source: 'Connected Neighbor', target: HIDDEN_ID },
        ],
      },
    });

    graph = mergeRevealGuess(graph, guess, HIDDEN_ID);

    // Both neighbors are still named (revealed-neighbors panel shows both).
    expect(graph.nodes.find((n) => n.id === 'Connected Neighbor')?.state).toBe('named');
    expect(graph.nodes.find((n) => n.id === 'Orphaned Neighbor')?.state).toBe('named');

    // Only the connected neighbor gets a canvas edge from the guess.
    expect(graph.links).toEqual(
      expect.arrayContaining([{ source: 'Guess One', target: 'Connected Neighbor' }]),
    );
    expect(graph.links.some((l) => l.source === 'Guess One' && l.target === 'Orphaned Neighbor')).toBe(
      false,
    );
  });

  it('remaps a losing guess\'s links from the unmasked answer title back to hiddenId, so the target node stays connected', () => {
    // Regression test: on the losing (5th) guess, the server unmasks the
    // hidden node's id to the real answer title everywhere in that guess's
    // own graphData — nodes *and* links (see `reveal.go`'s `SubmitReveal`:
    // `path[j] = answerTitle` when `lost`). The node loop above already
    // matches on `response.answer` to avoid inserting a duplicate target
    // node, but the accumulated target node itself keeps id === hiddenId
    // forever (`revealNode` only ever changes its label). Left unmapped,
    // this guess's final edge into the target would reference an id no node
    // in the graph has, stranding this guess's whole connected cluster from
    // the target on canvas — the bug reported as "the guess and the nodes
    // around it congregate together but aren't connected to the rest of the
    // graph".
    let graph = createInitialRevealGraph(HIDDEN_ID);

    const losingGuess = response({
      guess: 'Guess Five',
      lost: true,
      answer: 'World War II',
      graphData: {
        nodes: [
          { id: 'Guess Five', variant: 'guess' },
          { id: 'Hop A', variant: 'path' },
          { id: 'World War II', variant: 'end', label: 'World War II' },
        ],
        links: [
          { source: 'Guess Five', target: 'Hop A' },
          { source: 'Hop A', target: 'World War II' },
        ],
      },
    });

    graph = mergeRevealGuess(graph, losingGuess, HIDDEN_ID, 5);

    // No node was created under the real answer title — the target stays
    // the single, stable hiddenId node.
    expect(graph.nodes.some((n) => n.id === 'World War II')).toBe(false);
    expect(graph.nodes.filter((n) => n.id === HIDDEN_ID)).toHaveLength(1);

    // The final hop's link is remapped to hiddenId, keeping this guess's
    // cluster connected to the target node.
    expect(graph.links).toEqual(
      expect.arrayContaining([
        { source: 'Guess Five', target: 'Hop A' },
        { source: 'Hop A', target: HIDDEN_ID },
      ]),
    );
    expect(graph.links.some((l) => l.target === 'World War II')).toBe(false);
  });
});

describe('revealNode', () => {
  it('transitions the hidden node from unknown to named with a real title', () => {
    const graph = createInitialRevealGraph(HIDDEN_ID);
    const revealed = revealNode(graph, HIDDEN_ID, 'World War II', 'end');

    const hiddenNode = revealed.nodes.find((n) => n.id === HIDDEN_ID);
    expect(hiddenNode?.state).toBe('named');
    expect(hiddenNode?.label).toBe('World War II');
    expect(hiddenNode?.variant).toBe('end');
  });

  it('is a no-op when the node id is not present in the graph', () => {
    const graph = createInitialRevealGraph(HIDDEN_ID);
    const revealed = revealNode(graph, 'not-there', 'Whatever');
    expect(revealed).toEqual(graph);
  });
});

describe('hasAlreadyGuessedReveal', () => {
  it('matches case-insensitively and ignores surrounding whitespace', () => {
    expect(hasAlreadyGuessedReveal(['World War II', 'Physics'], '  world war ii  ')).toBe(true);
    expect(hasAlreadyGuessedReveal(['World War II'], 'Physics')).toBe(false);
  });

  it('returns false for an empty guess list', () => {
    expect(hasAlreadyGuessedReveal([], 'Anything')).toBe(false);
  });
});

describe('applyFullReveal', () => {
  it('flips the hidden node and every blank node to named on a losing guess (5th incorrect guess)', () => {
    // Simulate the accumulated graph after 4 incorrect guesses: path nodes
    // are named immediately by the reveal-cap mechanic, the guess node
    // itself stays blank (only a neighbor reveal or full reveal names it),
    // and the hidden node is still unknown.
    let graph = createInitialRevealGraph(HIDDEN_ID);
    graph = mergeRevealGuess(
      graph,
      response({
        guess: 'Guess One',
        neighbors: [{ id: 1, title: 'Neighbor A' }],
        graphData: {
          nodes: [
            { id: 'Guess One', variant: 'guess' },
            { id: 'Hop A', variant: 'path' },
            { id: 'Hop B', variant: 'path' },
            { id: HIDDEN_ID, variant: 'hidden-end' },
          ],
          links: [
            { source: 'Guess One', target: 'Hop A' },
            { source: 'Hop A', target: 'Hop B' },
            { source: 'Hop B', target: HIDDEN_ID },
          ],
        },
      }),
      HIDDEN_ID,
    );

    // Sanity check on setup: the guess node is blank, path nodes and the
    // neighbor reveal are already named, the hidden node is unknown.
    expect(graph.nodes.filter((n) => n.state === 'blank')).toHaveLength(1); // Guess One
    expect(graph.nodes.filter((n) => n.state === 'unknown')).toHaveLength(1);
    expect(graph.nodes.filter((n) => n.state === 'named')).toHaveLength(3); // Hop A, Hop B, Neighbor A

    // 5th guess comes back lost:true with the real answer.
    const revealed = applyFullReveal(graph, HIDDEN_ID, 'World War II');

    // No node remains blank or unknown — full reveal.
    expect(revealed.nodes.filter((n) => n.state === 'blank')).toHaveLength(0);
    expect(revealed.nodes.filter((n) => n.state === 'unknown')).toHaveLength(0);
    expect(revealed.nodes.every((n) => n.state === 'named')).toBe(true);

    // The already-named path nodes keep their real titles.
    expect(revealed.nodes.find((n) => n.id === 'Hop A')?.label).toBe('Hop A');
    expect(revealed.nodes.find((n) => n.id === 'Hop B')?.label).toBe('Hop B');

    // The formerly-blank guess node now shows its real (already-known) title.
    expect(revealed.nodes.find((n) => n.id === 'Guess One')?.label).toBe('Guess One');

    // The hidden node resolves to the real answer and flips variant to 'end'.
    const hiddenNode = revealed.nodes.find((n) => n.id === HIDDEN_ID);
    expect(hiddenNode?.label).toBe('World War II');
    expect(hiddenNode?.variant).toBe('end');

    // Already-named nodes are untouched.
    expect(revealed.nodes.find((n) => n.id === 'Neighbor A')?.label).toBe('Neighbor A');
  });

  it('is idempotent when there are no blank/unknown nodes left', () => {
    let graph = createInitialRevealGraph(HIDDEN_ID);
    graph = revealNode(graph, HIDDEN_ID, 'World War II', 'end');

    const revealedAgain = applyFullReveal(graph, HIDDEN_ID, 'World War II');
    expect(revealedAgain).toEqual(graph);
  });
});

describe('toWikiGraphData', () => {
  it('passes guess nodes through with no synthetic start node, and maps the unknown node to end', () => {
    let graph = createInitialRevealGraph(HIDDEN_ID);
    graph = mergeRevealGuess(
      graph,
      response({
        guess: 'Guess One',
        neighbors: [{ id: 1, title: 'Neighbor A' }],
        graphData: {
          nodes: [
            { id: 'Guess One', variant: 'guess' },
            { id: 'Hop A', variant: 'path' },
            { id: HIDDEN_ID, variant: 'hidden-end' },
          ],
          links: [
            { source: 'Guess One', target: 'Hop A' },
            { source: 'Hop A', target: HIDDEN_ID },
          ],
        },
      }),
      HIDDEN_ID,
    );

    const wiki = toWikiGraphData(graph);

    // No synthetic start node: GraphWiki roots its layout at every 'guess' node directly.
    expect(wiki.nodes.some((n) => n.variant === 'start')).toBe(false);

    // The still-hidden node is mapped to 'end' so GraphWiki roots its layout on it.
    const hidden = wiki.nodes.find((n) => n.id === HIDDEN_ID);
    expect(hidden?.variant).toBe('end');
    expect(hidden?.label).toBe('Unknown');

    // The guess node (blank, real title, not a secret) keeps variant 'guess' with no label.
    const guessNode = wiki.nodes.find((n) => n.id === 'Guess One');
    expect(guessNode?.variant).toBe('guess');
    expect(guessNode?.label).toBeUndefined();

    // The path-only waypoint is named immediately (the reveal-cap mechanic)
    // and passes through with its real variant and title.
    const hop = wiki.nodes.find((n) => n.id === 'Hop A');
    expect(hop?.variant).toBe('path');
    expect(hop?.label).toBe('Hop A');

    // "Neighbor A" is a dead-end neighbor reveal — named (see the panel-count
    // assertions elsewhere) but never wired into this guess's connected path
    // reveal, so it stays linkless in `graph.links` and is filtered out of
    // the canvas graph (see `toWikiGraphData`'s dead-end-neighbor filter).
    expect(wiki.nodes.some((n) => n.id === 'Neighbor A')).toBe(false);
  });

  it('drops linkless neighbor nodes from the canvas graph while keeping them named in the accumulated graph', () => {
    // Regression test for the floating-dot-cluster bug: a guess's neighbor
    // reveal can name several nodes that never end up part of any guess's
    // connected path reveal, so they stay linkless in `RevealGraphData`.
    // Passed straight through to `GraphWiki`, every one of them lands in the
    // same stray "past the farthest connected node" column and renders as an
    // unconnected cluster of dots. `toWikiGraphData` should filter them out
    // of the canvas graph while `mergeRevealGuess` still keeps them named.
    let graph = createInitialRevealGraph(HIDDEN_ID);
    graph = mergeRevealGuess(
      graph,
      response({
        guess: 'Guess One',
        neighbors: [
          { id: 1, title: 'Connected Neighbor' },
          { id: 2, title: 'Orphaned Neighbor A' },
          { id: 3, title: 'Orphaned Neighbor B' },
        ],
        graphData: {
          nodes: [
            { id: 'Guess One', variant: 'guess' },
            { id: 'Connected Neighbor', variant: 'path' },
            { id: HIDDEN_ID, variant: 'hidden-end' },
          ],
          links: [
            { source: 'Guess One', target: 'Connected Neighbor' },
            { source: 'Connected Neighbor', target: HIDDEN_ID },
          ],
        },
      }),
      HIDDEN_ID,
      1,
    );

    // Still named/counted in the accumulated graph (revealed-neighbors panel, share summary).
    expect(graph.nodes.find((n) => n.id === 'Orphaned Neighbor A')?.state).toBe('named');
    expect(graph.nodes.find((n) => n.id === 'Orphaned Neighbor B')?.state).toBe('named');

    const wiki = toWikiGraphData(graph);
    const wikiIds = wiki.nodes.map((n) => n.id);

    expect(wikiIds).not.toContain('Orphaned Neighbor A');
    expect(wikiIds).not.toContain('Orphaned Neighbor B');
    expect(wikiIds).toContain('Connected Neighbor');
    expect(wikiIds).toContain('Guess One');
  });

  it('keeps a linkless guess node (no path found) and the pre-guess unknown node on the canvas', () => {
    // Both are meaningful anchors on their own, not incidental dead-end
    // clutter, so the linkless filter must not drop them.
    let graph = createInitialRevealGraph(HIDDEN_ID);

    const initialWiki = toWikiGraphData(graph);
    expect(initialWiki.nodes.map((n) => n.id)).toContain(HIDDEN_ID);

    graph = mergeRevealGuess(
      graph,
      response({
        guess: 'No Path Guess',
        noPathFound: true,
        graphData: { nodes: [{ id: 'No Path Guess', variant: 'guess' }], links: [] },
      }),
      HIDDEN_ID,
      1,
    );

    const wiki = toWikiGraphData(graph);
    expect(wiki.nodes.map((n) => n.id)).toContain('No Path Guess');
  });

  it('passes through the revealed hidden node as a named end node after a full reveal', () => {
    let graph = createInitialRevealGraph(HIDDEN_ID);
    graph = applyFullReveal(graph, HIDDEN_ID, 'World War II');

    const wiki = toWikiGraphData(graph);
    const hidden = wiki.nodes.find((n) => n.id === HIDDEN_ID);
    expect(hidden).toEqual({ id: HIDDEN_ID, label: 'World War II', variant: 'end' });
  });
});

describe('buildRevealShareSummary', () => {
  function guessResult(overrides: Partial<RevealGuessResponse> = {}): RevealGuessResponse {
    return {
      guess: 'Guess',
      correct: false,
      neighbors: [],
      pathsFound: 0,
      minHops: 0,
      paths: [],
      graphData: { nodes: [], links: [] },
      maxHops: 10,
      maxPaths: 10000,
      ...overrides,
    };
  }

  it('formats hop counts as digit emojis, ending with a tick for the winning guess', () => {
    const guesses = [
      guessResult({ guess: 'A', minHops: 7 }),
      guessResult({ guess: 'B', minHops: 4 }),
      guessResult({ guess: 'C', minHops: 2 }),
      guessResult({ guess: 'Answer', correct: true, minHops: 0 }),
    ];

    expect(buildRevealShareSummary(guesses)).toBe('7️⃣ 4️⃣ 2️⃣ ✅');
  });

  it('formats a single winning guess as a tick', () => {
    const guesses = [guessResult({ guess: 'A', correct: true, minHops: 0 })];

    expect(buildRevealShareSummary(guesses)).toBe('✅');
  });

  it('includes every guess hop emoji on a loss', () => {
    const guesses = [
      guessResult({ guess: 'A', minHops: 7 }),
      guessResult({ guess: 'B', minHops: 4 }),
      guessResult({ guess: 'C', minHops: 2 }),
      guessResult({ guess: 'D', minHops: 1 }),
      guessResult({ guess: 'E', lost: true, answer: 'Answer', minHops: 3 }),
    ];

    expect(buildRevealShareSummary(guesses)).toBe('7️⃣ 4️⃣ 2️⃣ 1️⃣ 3️⃣');
  });

  it('uses a cross emoji for a no-path guess', () => {
    const guesses = [
      guessResult({ guess: 'A', noPathFound: true, pathsFound: 0 }),
      guessResult({ guess: 'B', correct: true, minHops: 0 }),
    ];

    expect(buildRevealShareSummary(guesses)).toBe('❌ ✅');
  });
});
