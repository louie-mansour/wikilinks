import type { GraphData } from '../components/GraphWiki/GraphWiki';
import type { PathData } from '../components/ShortestPaths/ShortestPaths';
import type { RecordPeriod } from '../components/RecordsSection/RecordsSection';
import { assignGraphLabels, buildGraphForDegrees } from './buildGraphData';

export interface SearchResult {
  start: string;
  end: string;
  noPathFound?: boolean;
  pathsFound: number;
  minHops: number;
  nodesExplored: number;
  searchTimeMs: number;
  uniqueArticles: number;
  newArticles: number;
  paths: PathData[];
  graphData: GraphData;
  records: RecordPeriod[];
  shareCode: string;
  maxHops: number;
  maxPaths: number;
}

function wikiUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title).replace(/%20/g, '_')}`;
}

// ─── Canonical result ────────────────────────────────────────────────────────

const EINSTEIN_QUANTUM: SearchResult = {
  start: 'Albert Einstein',
  end: 'Quantum mechanics',
  pathsFound: 247,
  minHops: 4,
  nodesExplored: 8241,
  searchTimeMs: 1200,
  uniqueArticles: 14,
  newArticles: 2,
  shareCode: 'aE3f9k',
  maxHops: 10,
  maxPaths: 1000,
  graphData: buildGraphForDegrees(4, 8),
  paths: [
    {
      id: 1,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true, hitCount: 12 },
        { href: wikiUrl('Physics'), label: 'Physics', hitCount: 1 },
        { href: wikiUrl('Wave function'), label: 'Wave function', hitCount: 3 },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true, hitCount: 12 },
      ],
    },
    {
      id: 2,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true, hitCount: 12 },
        { href: wikiUrl('Nobel Prize in Physics'), label: 'Nobel Prize in Physics', hitCount: 7 },
        { href: wikiUrl('Niels Bohr'), label: 'Niels Bohr', hitCount: 12 },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true, hitCount: 12 },
      ],
    },
    {
      id: 3,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true, hitCount: 12 },
        { href: wikiUrl('Special Relativity'), label: 'Special Relativity', hitCount: 12 },
        { href: wikiUrl('Max Planck'), label: 'Max Planck', hitCount: 7 },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true, hitCount: 12 },
      ],
    },
    {
      id: 4,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true, hitCount: 12 },
        { href: wikiUrl('Germany'), label: 'Germany', hitCount: 12 },
        { href: wikiUrl('Max Planck'), label: 'Max Planck', hitCount: 7 },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true, hitCount: 12 },
      ],
    },
    {
      id: 5,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true, hitCount: 12 },
        { href: wikiUrl('Science'), label: 'Science', hitCount: 12 },
        { href: wikiUrl('Niels Bohr'), label: 'Niels Bohr', hitCount: 12 },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true, hitCount: 12 },
      ],
    },
    {
      id: 6,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true, hitCount: 12 },
        { href: wikiUrl('History of physics'), label: 'History of physics', hitCount: 12 },
        { href: wikiUrl('Classical mechanics'), label: 'Classical mechanics', hitCount: 12 },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true, hitCount: 12 },
      ],
    },
    {
      id: 7,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true, hitCount: 12 },
        { href: wikiUrl('Thermodynamics'), label: 'Thermodynamics', hitCount: 12 },
        { href: wikiUrl('Wave function'), label: 'Wave function', hitCount: 3 },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true, hitCount: 12 },
      ],
    },
    {
      id: 8,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true, hitCount: 12 },
        { href: wikiUrl('Special Relativity'), label: 'Special Relativity', hitCount: 12 },
        { href: wikiUrl('Lorentz transform'), label: 'Lorentz transform', hitCount: 12 },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true, hitCount: 12 },
      ],
    },
    {
      id: 9,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true, hitCount: 12 },
        { href: wikiUrl('Nobel Prize in Physics'), label: 'Nobel Prize in Physics', hitCount: 7 },
        { href: wikiUrl('Max Planck'), label: 'Max Planck', hitCount: 7 },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true, hitCount: 12 },
      ],
    },
    {
      id: 10,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true, hitCount: 12 },
        { href: wikiUrl('Germany'), label: 'Germany', hitCount: 12 },
        { href: wikiUrl('Niels Bohr'), label: 'Niels Bohr', hitCount: 1 },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true, hitCount: 12 },
      ],
    },
    {
      id: 11,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true, hitCount: 12 },
        { href: wikiUrl('Physics'), label: 'Physics', hitCount: 1 },
        { href: wikiUrl('Thermodynamics'), label: 'Thermodynamics', hitCount: 12 },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true, hitCount: 12 },
      ],
    },
    {
      id: 12,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true, hitCount: 12 },
        { href: wikiUrl('Science'), label: 'Science', hitCount: 12 },
        { href: wikiUrl('Classical mechanics'), label: 'Classical mechanics', hitCount: 12 },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true, hitCount: 12 },
      ],
    },
    {
      id: 13,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true, hitCount: 12 },
        { href: wikiUrl('History of physics'), label: 'History of physics', hitCount: 12 },
        { href: wikiUrl('Thermodynamics'), label: 'Thermodynamics', hitCount: 12 },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true, hitCount: 12 },
      ],
    },
    {
      id: 14,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true, hitCount: 12 },
        { href: wikiUrl('Special Relativity'), label: 'Special Relativity', hitCount: 12 },
        { href: wikiUrl('Wave function'), label: 'Wave function', hitCount: 3 },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true, hitCount: 12 },
      ],
    },
    {
      id: 15,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true, hitCount: 12 },
        { href: wikiUrl('Germany'), label: 'Germany', hitCount: 12 },
        { href: wikiUrl('History of physics'), label: 'History of physics', hitCount: 12 },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true, hitCount: 12 },
      ],
    },
  ],
  records: [
    {
      period: 'Past day',
      rows: [
        { key: 'Most paths found', value: '300' },
        { key: 'Most articles in paths', value: '9', badge: true },
        { key: 'Most articles explored', value: '3,892', badge: true },
        { key: 'Longest path', value: '7 hops', badge: true },
      ],
    },
    {
      period: 'Past week',
      rows: [
        { key: 'Most paths found', value: '300', badge: true },
        { key: 'Most articles in paths', value: '11' },
        { key: 'Most articles explored', value: '5,211' },
        { key: 'Longest path', value: '8 hops' },
      ],
    },
    {
      period: 'All time',
      rows: [
        { key: 'Most paths found', value: '300', badge: true },
        { key: 'Most articles in paths', value: '14', badge: true },
        { key: 'Most articles explored', value: '12,048', badge: true },
        { key: 'Longest path', value: '9 hops', badge: true },
      ],
    },
  ],
};

// ─── Generic generator ────────────────────────────────────────────────────────

const INTERMEDIATES = [
  'Philosophy', 'Mathematics', 'Science', 'History',
  'Biology', 'Chemistry', 'Astronomy', 'Literature',
  'Technology', 'Politics', 'Economics', 'Geography',
  'Classical antiquity', 'Medieval Europe', 'Renaissance',
  'Industrial Revolution', 'Enlightenment', 'Romanticism',
];

function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33 ^ s.charCodeAt(i)) >>> 0;
  return h;
}

function seededPick<T>(arr: T[], seed: number, count: number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  let s = seed;
  for (let i = 0; i < count && copy.length > 0; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const idx = s % copy.length;
    result.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return result;
}

function buildGenericResult(start: string, end: string): SearchResult {
  const seed = hash(start + end);
  const s = (n: number) => ((seed * n + 12345) >>> 0);

  const hops = (s(1) % 2) + 3; // 3 or 4
  const intermCount = hops - 1;
  const intermediates = seededPick(
    INTERMEDIATES.filter((t) => t !== start && t !== end),
    seed,
    intermCount,
  );

  const pathsFound = (s(2) % 18) + 3;
  const nodesExplored = (s(3) % 4000) + 500;
  const searchTimeMs = (s(4) % 2800) + 200;
  const uniqueArticles = intermediates.length + 2 + (s(5) % 4);

  const graphData = assignGraphLabels(buildGraphForDegrees(hops, 8), start, end, seed);

  // ── Paths ─────────────────────────────────────────────────────────────────
  const paths: PathData[] = [];
  const pathInters = seededPick(INTERMEDIATES.filter((t) => t !== start && t !== end), seed + 2, pathsFound);
  const HIT_COUNTS = [1, 3, 7, 12, 12];
  for (let i = 0; i < pathsFound; i++) {
    const inter = pathInters[i % pathInters.length];
    const hitCount = HIT_COUNTS[(i + s(i + 10)) % HIT_COUNTS.length];
    paths.push({
      id: i + 1,
      crumbs: [
        { href: wikiUrl(start), label: start, highlighted: true, hitCount: 12 },
        ...(hops === 4
          ? [{ href: wikiUrl(inter), label: inter, hitCount }]
          : []),
        { href: wikiUrl(intermediates[0]), label: intermediates[0], hitCount: 12 },
        { href: wikiUrl(end), label: end, highlighted: true, hitCount: 12 },
      ],
    });
  }

  // ── Records ───────────────────────────────────────────────────────────────
  const prevAllTime = {
    paths: pathsFound + (s(6) % 50) + 5,
    articlesInPaths: uniqueArticles + (s(7) % 5) + 1,
    articlesExplored: nodesExplored + (s(8) % 5000) + 500,
    hops: hops + (s(9) % 3) + 1,
  };
  const prevWeek = {
    paths: pathsFound + (s(11) % 35),
    articlesInPaths: uniqueArticles + (s(12) % 3),
    articlesExplored: nodesExplored + (s(13) % 2000),
    hops: hops + 2,
  };
  const prevDay = {
    paths: pathsFound + (s(14) % 20),
    articlesInPaths: uniqueArticles + 1,
    articlesExplored: nodesExplored + (s(15) % 1000),
    hops: hops + 1,
  };

  function recordPeriod(
    period: string,
    prev: {
      paths: number;
      articlesInPaths: number;
      articlesExplored: number;
      hops: number;
    },
  ): RecordPeriod {
    const pathsVal = Math.max(pathsFound, prev.paths);
    const articlesInPathsVal = Math.max(uniqueArticles, prev.articlesInPaths);
    const articlesExploredVal = Math.max(nodesExplored, prev.articlesExplored);
    const hopsVal = Math.max(hops, prev.hops);
    return {
      period,
      rows: [
        {
          key: 'Most paths found',
          value: String(pathsVal),
          badge: pathsFound > prev.paths,
        },
        {
          key: 'Most articles in paths',
          value: String(articlesInPathsVal),
          badge: uniqueArticles > prev.articlesInPaths,
        },
        {
          key: 'Most articles explored',
          value: String(articlesExploredVal),
          badge: nodesExplored > prev.articlesExplored,
        },
        {
          key: 'Longest path',
          value: `${hopsVal} hops`,
          badge: hops > prev.hops,
        },
      ],
    };
  }

  const records: RecordPeriod[] = [
    recordPeriod('Past day', prevDay),
    recordPeriod('Past week', prevWeek),
    recordPeriod('All time', prevAllTime),
  ];

  const newArticles = new Set(
    paths.flatMap((path) =>
      path.crumbs.filter((crumb) => crumb.hitCount === 1).map((crumb) => crumb.label),
    ),
  ).size;

  return {
    start,
    end,
    pathsFound,
    minHops: hops,
    nodesExplored,
    searchTimeMs,
    uniqueArticles,
    newArticles,
    paths,
    graphData,
    records,
    shareCode: 'mock00',
    maxHops: 10,
    maxPaths: 1000,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function runMockSearch(start: string, end: string): SearchResult {
  const key = `${start.toLowerCase()}|${end.toLowerCase()}`;
  if (key === 'albert einstein|quantum mechanics') return EINSTEIN_QUANTUM;
  return buildGenericResult(start, end);
}

const SEARCH_DELAY_MS = 10000;

/** Simulates a network request before returning mock search results. */
export function searchPaths(start: string, end: string): Promise<SearchResult> {
  return new Promise((resolve) => {
    window.setTimeout(
      () => resolve(runMockSearch(start, end)),
      SEARCH_DELAY_MS,
    );
  });
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}
