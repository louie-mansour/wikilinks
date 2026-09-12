import { describe, expect, it } from 'vitest';
import {
  applyFullReveal,
  buildRevealShareSummary,
  createInitialRevealGraph,
  hasAlreadyGuessedReveal,
  mergeRevealGuess,
  revealNode,
  type RevealGraphData,
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
  it('never regresses a node named by a later guess back to blank (blank -> named is one-way)', () => {
    let graph = createInitialRevealGraph(HIDDEN_ID);

    // Guess 1: path reveal only surfaces "Hop A" as a blank waypoint.
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
    expect(hopAAfterGuess1?.state).toBe('blank');
    expect(hopAAfterGuess1?.label).toBeUndefined();

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

    // Named vs. blank states line up with neighbor reveal vs. path-only reveal.
    expect(graph.nodes.find((n) => n.id === 'Neighbor A')?.state).toBe('named');
    expect(graph.nodes.find((n) => n.id === 'Neighbor B')?.state).toBe('named');
    expect(graph.nodes.find((n) => n.id === 'Hop A')?.state).toBe('blank');
    expect(graph.nodes.find((n) => n.id === 'Hop B')?.state).toBe('blank');

    // Edges from both guesses accumulate without duplication.
    expect(graph.links).toHaveLength(4);
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
    // Simulate the accumulated graph after 4 incorrect guesses: a mix of
    // named (neighbor-revealed) and blank (path-revealed-only) nodes, plus
    // the still-unknown hidden node.
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

    // Sanity check on setup: some nodes are blank (path-only reveal, including
    // the guess node itself — only a neighbor reveal or full reveal names it),
    // one is unknown.
    expect(graph.nodes.filter((n) => n.state === 'blank')).toHaveLength(3);
    expect(graph.nodes.filter((n) => n.state === 'unknown')).toHaveLength(1);

    // 5th guess comes back lost:true with the real answer.
    const revealed = applyFullReveal(graph, HIDDEN_ID, 'World War II');

    // No node remains blank or unknown — full reveal.
    expect(revealed.nodes.filter((n) => n.state === 'blank')).toHaveLength(0);
    expect(revealed.nodes.filter((n) => n.state === 'unknown')).toHaveLength(0);
    expect(revealed.nodes.every((n) => n.state === 'named')).toBe(true);

    // The formerly-blank nodes now show their real (already-known) titles.
    expect(revealed.nodes.find((n) => n.id === 'Hop A')?.label).toBe('Hop A');
    expect(revealed.nodes.find((n) => n.id === 'Hop B')?.label).toBe('Hop B');
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

  function namedGraph(namedCount: number, otherStates: RevealGraphData['nodes'] = []): RevealGraphData {
    const named = Array.from({ length: namedCount }, (_, i) => ({
      id: `Node ${i}`,
      label: `Node ${i}`,
      state: 'named' as const,
    }));
    return { nodes: [...named, ...otherStates], links: [] };
  }

  it('formats a win with the guess count and total-revealed node count', () => {
    const guesses = [guessResult({ guess: 'A' }), guessResult({ guess: 'B', correct: true })];
    const graph = namedGraph(7);

    expect(buildRevealShareSummary(12, guesses, graph)).toBe(
      'Grill: Reveal #12: solved in 2 guesses (7 nodes revealed)',
    );
  });

  it('uses singular "guess" for a one-guess win', () => {
    const guesses = [guessResult({ guess: 'A', correct: true })];
    const graph = namedGraph(3);

    expect(buildRevealShareSummary(1, guesses, graph)).toBe(
      'Grill: Reveal #1: solved in 1 guess (3 nodes revealed)',
    );
  });

  it('formats a loss as X/5 with the total-revealed node count, ignoring guess count', () => {
    const guesses = Array.from({ length: 5 }, (_, i) => guessResult({ guess: `Guess ${i}` }));
    const graph = namedGraph(9);

    expect(buildRevealShareSummary(3, guesses, graph, true)).toBe(
      'Grill: Reveal #3: X/5 (9 nodes revealed)',
    );
  });

  it('excludes non-named nodes from the total-revealed count', () => {
    const guesses = [guessResult({ guess: 'A', correct: true })];
    const graph = namedGraph(4, [
      { id: 'still-blank', state: 'blank' },
      { id: 'still-unknown', state: 'unknown' },
    ]);

    expect(buildRevealShareSummary(5, guesses, graph)).toBe(
      'Grill: Reveal #5: solved in 1 guess (4 nodes revealed)',
    );
  });
});
