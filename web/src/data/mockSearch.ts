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
  newArticles: 3,
  shareCode: 'aE3f9k',
  graphData: buildGraphForDegrees(4, 8),
  paths: [
    {
      id: 1,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true },
        { href: wikiUrl('Physics'), label: 'Physics', tag: 'new' },
        { href: wikiUrl('Wave function'), label: 'Wave function', tag: 'rare' },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true },
      ],
    },
    {
      id: 2,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true },
        { href: wikiUrl('Nobel Prize in Physics'), label: 'Nobel Prize in Physics', tag: 'uncommon' },
        { href: wikiUrl('Niels Bohr'), label: 'Niels Bohr' },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true },
      ],
    },
    {
      id: 3,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true },
        { href: wikiUrl('Special Relativity'), label: 'Special Relativity' },
        { href: wikiUrl('Max Planck'), label: 'Max Planck', tag: 'uncommon' },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true },
      ],
    },
    {
      id: 4,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true },
        { href: wikiUrl('Germany'), label: 'Germany' },
        { href: wikiUrl('Max Planck'), label: 'Max Planck', tag: 'uncommon' },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true },
      ],
    },
    {
      id: 5,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true },
        { href: wikiUrl('Science'), label: 'Science' },
        { href: wikiUrl('Niels Bohr'), label: 'Niels Bohr' },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true },
      ],
    },
    {
      id: 6,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true },
        { href: wikiUrl('History of physics'), label: 'History of physics' },
        { href: wikiUrl('Classical mechanics'), label: 'Classical mechanics' },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true },
      ],
    },
    {
      id: 7,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true },
        { href: wikiUrl('Thermodynamics'), label: 'Thermodynamics' },
        { href: wikiUrl('Wave function'), label: 'Wave function', tag: 'rare' },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true },
      ],
    },
    {
      id: 8,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true },
        { href: wikiUrl('Special Relativity'), label: 'Special Relativity' },
        { href: wikiUrl('Lorentz transform'), label: 'Lorentz transform' },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true },
      ],
    },
    {
      id: 9,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true },
        { href: wikiUrl('Nobel Prize in Physics'), label: 'Nobel Prize in Physics', tag: 'uncommon' },
        { href: wikiUrl('Max Planck'), label: 'Max Planck', tag: 'uncommon' },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true },
      ],
    },
    {
      id: 10,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true },
        { href: wikiUrl('Germany'), label: 'Germany' },
        { href: wikiUrl('Niels Bohr'), label: 'Niels Bohr', tag: 'new' },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true },
      ],
    },
    {
      id: 11,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true },
        { href: wikiUrl('Physics'), label: 'Physics', tag: 'new' },
        { href: wikiUrl('Thermodynamics'), label: 'Thermodynamics' },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true },
      ],
    },
    {
      id: 12,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true },
        { href: wikiUrl('Science'), label: 'Science' },
        { href: wikiUrl('Classical mechanics'), label: 'Classical mechanics' },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true },
      ],
    },
    {
      id: 13,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true },
        { href: wikiUrl('History of physics'), label: 'History of physics' },
        { href: wikiUrl('Thermodynamics'), label: 'Thermodynamics' },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true },
      ],
    },
    {
      id: 14,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true },
        { href: wikiUrl('Special Relativity'), label: 'Special Relativity' },
        { href: wikiUrl('Wave function'), label: 'Wave function', tag: 'rare' },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true },
      ],
    },
    {
      id: 15,
      crumbs: [
        { href: wikiUrl('Albert Einstein'), label: 'Albert Einstein', highlighted: true },
        { href: wikiUrl('Germany'), label: 'Germany' },
        { href: wikiUrl('History of physics'), label: 'History of physics' },
        { href: wikiUrl('Quantum mechanics'), label: 'Quantum mechanics', highlighted: true },
      ],
    },
  ],
  records: [
    {
      period: 'All time',
      rows: [
        { key: 'Most paths', value: '300' },
        { key: 'Most nodes', value: '12,048', badge: true },
        { key: 'Longest path', value: '9 hops' },
      ],
    },
    {
      period: 'Past week',
      rows: [
        { key: 'Most paths', value: '300' },
        { key: 'Most nodes', value: '5,211' },
        { key: 'Longest path', value: '8 hops' },
      ],
    },
    {
      period: 'Past day',
      rows: [
        { key: 'Most paths', value: '300' },
        { key: 'Most nodes', value: '3,892' },
        { key: 'Longest path', value: '7 hops' },
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

function generateShareCode(s: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let h = hash(s);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[h % chars.length];
    h = (h * 1664525 + 1013904223) >>> 0;
  }
  return code;
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
  const newArticles = (s(13) % 3) + 1;

  const graphData = assignGraphLabels(buildGraphForDegrees(hops, 8), start, end, seed);

  // ── Paths ─────────────────────────────────────────────────────────────────
  const paths: PathData[] = [];
  const pathInters = seededPick(INTERMEDIATES.filter((t) => t !== start && t !== end), seed + 2, pathsFound);
  const TAGS: Array<'new' | 'rare' | 'uncommon' | undefined> = ['new', 'rare', 'uncommon', undefined, undefined];
  for (let i = 0; i < pathsFound; i++) {
    const inter = pathInters[i % pathInters.length];
    const tag = TAGS[(i + s(i + 10)) % TAGS.length];
    paths.push({
      id: i + 1,
      crumbs: [
        { href: wikiUrl(start), label: start, highlighted: true },
        ...(hops === 4
          ? [{ href: wikiUrl(inter), label: inter, tag }]
          : []),
        { href: wikiUrl(intermediates[0]), label: intermediates[0] },
        { href: wikiUrl(end), label: end, highlighted: true },
      ],
    });
  }

  // ── Records ───────────────────────────────────────────────────────────────
  const prevAllTime = {
    paths: pathsFound + (s(6) % 50) + 5,
    nodes: nodesExplored + (s(7) % 5000) + 500,
    hops: hops + (s(8) % 3) + 1,
  };
  const prevWeek = {
    paths: pathsFound + (s(11) % 35),
    nodes: nodesExplored + (s(12) % 2000),
    hops: hops + 2,
  };
  const prevDay = {
    paths: pathsFound + (s(9) % 20),
    nodes: nodesExplored + (s(10) % 1000),
    hops: hops + 1,
  };

  function recordPeriod(
    period: string,
    prev: { paths: number; nodes: number; hops: number },
  ): RecordPeriod {
    const pathsVal = Math.max(pathsFound, prev.paths);
    const nodesVal = Math.max(nodesExplored, prev.nodes);
    const hopsVal = Math.min(hops, prev.hops);
    return {
      period,
      rows: [
        {
          key: 'Most paths',
          value: String(pathsVal),
          badge: pathsFound > prev.paths,
        },
        {
          key: 'Most nodes',
          value: String(nodesVal),
          badge: nodesExplored > prev.nodes,
        },
        {
          key: 'Longest path',
          value: `${hopsVal} hops`,
          badge: hops < prev.hops,
        },
      ],
    };
  }

  const records: RecordPeriod[] = [
    recordPeriod('All time', prevAllTime),
    recordPeriod('Past week', prevWeek),
    recordPeriod('Past day', prevDay),
  ];

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
    shareCode: generateShareCode(start + end),
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

export function formatSearchTime(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}
