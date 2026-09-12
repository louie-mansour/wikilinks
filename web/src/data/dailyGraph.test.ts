import { describe, expect, it } from 'vitest';
import {
  buildDirectConnections,
  buildShareSummary,
  hasAlreadyGuessed,
  mergeGraphData,
  puzzleNumberForDate,
  revealHiddenEnd,
} from './dailyGraph';
import type { GraphData } from '../components/GraphWiki/GraphWiki';
import type { GuessResult } from '../api/guess';

describe('mergeGraphData', () => {
  it('merges two sequential guess responses into one deduped graph', () => {
    const first: GraphData = {
      nodes: [
        { id: 'guess-1', variant: 'guess' },
        { id: 'hop-a' },
        { id: 'placeholder-end', variant: 'hidden-end' },
      ],
      links: [
        { source: 'guess-1', target: 'hop-a' },
        { source: 'hop-a', target: 'placeholder-end' },
      ],
    };

    const second: GraphData = {
      nodes: [
        { id: 'guess-2', variant: 'guess' },
        { id: 'hop-a' }, // rediscovered via a different guess, shared with `first`
        { id: 'placeholder-end', variant: 'hidden-end' }, // same stable placeholder id
      ],
      links: [
        { source: 'guess-2', target: 'hop-a' },
        { source: 'hop-a', target: 'placeholder-end' }, // duplicate edge
      ],
    };

    const merged = mergeGraphData(first, second);

    expect(merged.nodes.map((n) => n.id).sort()).toEqual(
      ['guess-1', 'guess-2', 'hop-a', 'placeholder-end'].sort(),
    );
    expect(merged.links).toHaveLength(3);
  });

  it('keeps previously revealed nodes/edges visible untouched when nothing new is discovered', () => {
    const accumulated: GraphData = {
      nodes: [{ id: 'guess-1', variant: 'guess' }, { id: 'placeholder-end', variant: 'hidden-end' }],
      links: [{ source: 'guess-1', target: 'placeholder-end' }],
    };
    const noPathGuess: GraphData = {
      nodes: [{ id: 'guess-2', variant: 'guess' }],
      links: [],
    };

    const merged = mergeGraphData(accumulated, noPathGuess);

    expect(merged.nodes).toEqual([...accumulated.nodes, { id: 'guess-2', variant: 'guess', hitCount: 1 }]);
    expect(merged.links).toEqual(accumulated.links);
  });

  it('increments hitCount each time a node reappears across separate guesses', () => {
    const first: GraphData = {
      nodes: [{ id: 'guess-1', variant: 'guess' }, { id: 'hop-a' }],
      links: [{ source: 'guess-1', target: 'hop-a' }],
    };
    const second: GraphData = {
      nodes: [{ id: 'guess-2', variant: 'guess' }, { id: 'hop-a' }],
      links: [{ source: 'guess-2', target: 'hop-a' }],
    };
    const third: GraphData = {
      nodes: [{ id: 'guess-3', variant: 'guess' }, { id: 'hop-a' }],
      links: [{ source: 'guess-3', target: 'hop-a' }],
    };

    const empty: GraphData = { nodes: [], links: [] };
    const merged = mergeGraphData(mergeGraphData(mergeGraphData(empty, first), second), third);

    expect(merged.nodes.find((n) => n.id === 'hop-a')?.hitCount).toBe(3);
    expect(merged.nodes.find((n) => n.id === 'guess-1')?.hitCount).toBe(1);
  });
});

describe('revealHiddenEnd', () => {
  it('relabels the placeholder node in an already-accumulated graph with the real answer', () => {
    const accumulated: GraphData = {
      nodes: [
        { id: 'guess-1', variant: 'guess' },
        { id: 'hop-a' },
        { id: 'placeholder-end', variant: 'hidden-end' },
      ],
      links: [
        { source: 'guess-1', target: 'hop-a' },
        { source: 'hop-a', target: 'placeholder-end' },
      ],
    };

    const revealed = revealHiddenEnd(accumulated, 'World War II');

    expect(revealed.nodes).toContainEqual({ id: 'World War II', variant: 'end', label: 'World War II' });
    expect(revealed.nodes.some((n) => n.id === 'placeholder-end')).toBe(false);
    expect(revealed.links).toContainEqual({ source: 'hop-a', target: 'World War II' });
    expect(revealed.links.some((l) => l.target === 'placeholder-end')).toBe(false);
  });

  it('dedupes if the answer id already exists in the graph (e.g. guessed earlier)', () => {
    const accumulated: GraphData = {
      nodes: [
        { id: 'World War II', variant: 'guess' },
        { id: 'placeholder-end', variant: 'hidden-end' },
      ],
      links: [{ source: 'World War II', target: 'placeholder-end' }],
    };

    const revealed = revealHiddenEnd(accumulated, 'World War II');

    expect(revealed.nodes).toHaveLength(1);
    expect(revealed.links).toHaveLength(1);
  });

  it('is a no-op when there is no hidden-end node', () => {
    const accumulated: GraphData = {
      nodes: [{ id: 'World War II', variant: 'end' }],
      links: [],
    };

    expect(revealHiddenEnd(accumulated, 'World War II')).toEqual(accumulated);
  });
});

describe('buildDirectConnections', () => {
  it('sorts annotated nodes descending by combined score and ignores unannotated ones', () => {
    const graph: GraphData = {
      nodes: [
        { id: 'guess-1', variant: 'guess' },
        { id: 'Generic Hub', outDegree: 1000, edgeCountToEnd: 1, inDegree: 50000 },
        { id: 'Specific Article', outDegree: 2, edgeCountToEnd: 1, inDegree: 3 },
        { id: 'placeholder-end', variant: 'hidden-end' },
      ],
      links: [],
    };

    const connections = buildDirectConnections(graph);

    expect(connections.map((c) => c.id)).toEqual(['Specific Article', 'Generic Hub']);
    expect(connections[0].score).toBeGreaterThan(connections[1].score);
  });

  it('defaults inDegree/hitCount to neutral (1) when absent, falling back to ratio order', () => {
    const graph: GraphData = {
      nodes: [
        { id: 'Generic Hub', outDegree: 1000, edgeCountToEnd: 1 },
        { id: 'Specific Article', outDegree: 2, edgeCountToEnd: 1 },
      ],
      links: [],
    };

    const connections = buildDirectConnections(graph);

    expect(connections.map((c) => c.id)).toEqual(['Specific Article', 'Generic Hub']);
    expect(connections[0]).toMatchObject({ inDegree: 1, hitCount: 1 });
  });

  it('boosts a node that reappeared across multiple guesses (hitCount) over an obscurer one-off', () => {
    const graph: GraphData = {
      nodes: [
        { id: 'Seen Once', outDegree: 2, edgeCountToEnd: 1, inDegree: 2, hitCount: 1 },
        { id: 'Seen Thrice', outDegree: 2, edgeCountToEnd: 1, inDegree: 2, hitCount: 3 },
      ],
      links: [],
    };

    expect(buildDirectConnections(graph).map((c) => c.id)).toEqual(['Seen Thrice', 'Seen Once']);
  });

  it('ranks by hitCount first, even over a much stronger ratio', () => {
    const graph: GraphData = {
      nodes: [
        { id: 'Seen Once, Strong Ratio', outDegree: 2, edgeCountToEnd: 1, inDegree: 2, hitCount: 1 },
        { id: 'Seen Twice, Weak Ratio', outDegree: 1000, edgeCountToEnd: 1, inDegree: 2, hitCount: 2 },
      ],
      links: [],
    };

    expect(buildDirectConnections(graph).map((c) => c.id)).toEqual([
      'Seen Twice, Weak Ratio',
      'Seen Once, Strong Ratio',
    ]);
  });

  it('discounts a high-inDegree generic hub relative to an obscure page at the same ratio/hitCount', () => {
    const graph: GraphData = {
      nodes: [
        { id: 'Hub', outDegree: 2, edgeCountToEnd: 1, inDegree: 100000, hitCount: 1 },
        { id: 'Obscure', outDegree: 2, edgeCountToEnd: 1, inDegree: 2, hitCount: 1 },
      ],
      links: [],
    };

    expect(buildDirectConnections(graph).map((c) => c.id)).toEqual(['Obscure', 'Hub']);
  });

  it('returns an empty list when nothing has been annotated yet', () => {
    const graph: GraphData = {
      nodes: [{ id: 'guess-1', variant: 'guess' }],
      links: [],
    };

    expect(buildDirectConnections(graph)).toEqual([]);
  });
});

describe('puzzleNumberForDate', () => {
  it('returns 1 for the schedule epoch date', () => {
    expect(puzzleNumberForDate(new Date(Date.UTC(2026, 8, 8)))).toBe(1);
  });

  it('increments once per UTC calendar day after the epoch', () => {
    expect(puzzleNumberForDate(new Date(Date.UTC(2026, 8, 21)))).toBe(14);
  });
});

describe('buildShareSummary', () => {
  it('formats guess count and hop-count sequence, ending in 0 for the winning guess', () => {
    const guesses: GuessResult[] = [
      { guess: 'A', correct: false, pathsFound: 1, minHops: 7, paths: [], graphData: { nodes: [], links: [] }, maxHops: 6, maxPaths: 5 },
      { guess: 'B', correct: false, pathsFound: 1, minHops: 4, paths: [], graphData: { nodes: [], links: [] }, maxHops: 6, maxPaths: 5 },
      { guess: 'C', correct: false, pathsFound: 1, minHops: 2, paths: [], graphData: { nodes: [], links: [] }, maxHops: 6, maxPaths: 5 },
      { guess: 'World War II', correct: true, answer: 'World War II', pathsFound: 1, minHops: 0, paths: [], graphData: { nodes: [], links: [] }, maxHops: 6, maxPaths: 5 },
    ];

    expect(buildShareSummary(12, guesses)).toBe('Grill #12: 4 guesses (7→4→2→0)');
  });

  it('pluralizes a single guess correctly', () => {
    const guesses: GuessResult[] = [
      { guess: 'World War II', correct: true, answer: 'World War II', pathsFound: 1, minHops: 0, paths: [], graphData: { nodes: [], links: [] }, maxHops: 6, maxPaths: 5 },
    ];

    expect(buildShareSummary(1, guesses)).toBe('Grill #1: 1 guess (0)');
  });

  it('formats a lost puzzle as X/5 with the losing guess in the hop sequence', () => {
    const guesses: GuessResult[] = [
      { guess: 'A', correct: false, pathsFound: 1, minHops: 7, paths: [], graphData: { nodes: [], links: [] }, maxHops: 6, maxPaths: 5 },
      { guess: 'B', correct: false, pathsFound: 1, minHops: 4, paths: [], graphData: { nodes: [], links: [] }, maxHops: 6, maxPaths: 5 },
      { guess: 'C', correct: false, pathsFound: 1, minHops: 2, paths: [], graphData: { nodes: [], links: [] }, maxHops: 6, maxPaths: 5 },
      { guess: 'D', correct: false, pathsFound: 1, minHops: 1, paths: [], graphData: { nodes: [], links: [] }, maxHops: 6, maxPaths: 5 },
      { guess: 'E', correct: false, lost: true, answer: 'World War II', pathsFound: 1, minHops: 3, paths: [], graphData: { nodes: [], links: [] }, maxHops: 6, maxPaths: 5 },
    ];

    expect(buildShareSummary(12, guesses, true)).toBe('Grill #12: X/5 (7→4→2→1→3)');
  });

  it('uses X for a no-path guess in the hop sequence', () => {
    const guesses: GuessResult[] = [
      { guess: 'A', correct: false, noPathFound: true, pathsFound: 0, minHops: 0, paths: [], graphData: { nodes: [], links: [] }, maxHops: 6, maxPaths: 5 },
    ];

    expect(buildShareSummary(12, guesses)).toBe('Grill #12: 1 guess (X)');
  });
});

describe('hasAlreadyGuessed', () => {
  it('blocks resubmitting a guess already made for the day', () => {
    expect(hasAlreadyGuessed(['Basketball', 'Ohio'], 'Basketball')).toBe(true);
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(hasAlreadyGuessed(['Basketball'], '  basketball  ')).toBe(true);
  });

  it('allows a genuinely new guess', () => {
    expect(hasAlreadyGuessed(['Basketball', 'Ohio'], 'Football')).toBe(false);
  });
});
