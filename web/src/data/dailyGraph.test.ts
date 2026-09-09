import { describe, expect, it } from 'vitest';
import {
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

    expect(merged.nodes).toEqual([...accumulated.nodes, ...noPathGuess.nodes]);
    expect(merged.links).toEqual(accumulated.links);
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
