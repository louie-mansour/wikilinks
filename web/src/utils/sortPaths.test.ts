import { describe, expect, it } from 'vitest';
import { sortPaths } from './sortPaths';
import type { PathData } from '../components/ShortestPaths/ShortestPaths';

const path = (id: string, labels: string[], hitCounts: number[]): PathData => ({
  id,
  crumbs: labels.map((label, i) => ({
    href: `/wiki/${label}`,
    label,
    hitCount: hitCounts[i],
  })),
});

describe('sortPaths', () => {
  it('sorts alphabetically by the full intermediate hop sequence, not just the first hop', () => {
    // Both paths share the same first intermediate hop ("Special Relativity"),
    // so an alphabetical sort must fall through to the second hop to order them.
    const a = path('a', ['Albert Einstein', 'Special Relativity', 'Zebra', 'Quantum mechanics'], [12, 12, 12, 12]);
    const b = path('b', ['Albert Einstein', 'Special Relativity', 'Aardvark', 'Quantum mechanics'], [12, 12, 12, 12]);

    const sorted = sortPaths([a, b], 'alpha');

    expect(sorted.map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('sorts alphabetically by first hop when first hops differ', () => {
    const a = path('a', ['Albert Einstein', 'Zebra', 'Quantum mechanics'], [12, 12, 12]);
    const b = path('b', ['Albert Einstein', 'Aardvark', 'Quantum mechanics'], [12, 12, 12]);

    const sorted = sortPaths([a, b], 'alpha');

    expect(sorted.map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('sorts by most interesting (most new articles first)', () => {
    const a = path('a', ['S', 'X', 'Y', 'E'], [12, 1, 1, 12]); // 2 new articles
    const b = path('b', ['S', 'X', 'Y', 'E'], [12, 1, 12, 12]); // 1 new article

    const sorted = sortPaths([a, b], 'interesting');

    expect(sorted.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('sorts by least interesting (fewest new articles first)', () => {
    const a = path('a', ['S', 'X', 'Y', 'E'], [12, 1, 1, 12]); // 2 new articles
    const b = path('b', ['S', 'X', 'Y', 'E'], [12, 1, 12, 12]); // 1 new article

    const sorted = sortPaths([a, b], 'least-interesting');

    expect(sorted.map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('does not mutate the input array', () => {
    const a = path('a', ['S', 'Zebra', 'E'], [12, 12, 12]);
    const b = path('b', ['S', 'Aardvark', 'E'], [12, 12, 12]);
    const input = [a, b];

    sortPaths(input, 'alpha');

    expect(input).toEqual([a, b]);
  });
});
