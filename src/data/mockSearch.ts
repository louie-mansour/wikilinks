import type { GraphNode, GraphEdge } from '../components/Graph/Graph';
import type { PathData } from '../components/ShortestPaths/ShortestPaths';
import type { RecordPeriod } from '../components/RecordsSection/RecordsSection';

export interface SearchResult {
  start: string;
  end: string;
  pathsFound: number;
  minHops: number;
  nodesExplored: number;
  searchTimeMs: number;
  uniqueArticles: number;
  paths: PathData[];
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  records: RecordPeriod[];
  shareCode: string;
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
  shareCode: 'aE3f9k',
  graphNodes: [
    { id: 'einstein',   label: 'Albert Einstein',        top: 8,  left: 50, variant: 'start' },
    { id: 'history',    label: 'History of physics',     top: 26, left: 13 },
    { id: 'relativity', label: 'Special Relativity',     top: 24, left: 31 },
    { id: 'nobel',      label: 'Nobel Prize in Physics', top: 22, left: 49, rarity: 'uncommon' },
    { id: 'physics',    label: 'Physics',                top: 24, left: 62, variant: 'active', rarity: 'first' },
    { id: 'germany',    label: 'Germany',                top: 26, left: 73 },
    { id: 'science',    label: 'Science',                top: 28, left: 83 },
    { id: 'classical',  label: 'Classical mechanics',    top: 54, left: 9 },
    { id: 'lorentz',    label: 'Lorentz transform',      top: 52, left: 25 },
    { id: 'thermo',     label: 'Thermodynamics',         top: 51, left: 41 },
    { id: 'wave',       label: 'Wave function',          top: 52, left: 60, variant: 'active', rarity: 'rare' },
    { id: 'planck',     label: 'Max Planck',             top: 54, left: 72, rarity: 'uncommon' },
    { id: 'bohr',       label: 'Niels Bohr',             top: 56, left: 82 },
    { id: 'quantum',    label: 'Quantum mechanics',      top: 82, left: 50, variant: 'end' },
  ],
  graphEdges: [
    // dim edges
    { x1: 50, y1: 8,  x2: 13, y2: 26 },
    { x1: 50, y1: 8,  x2: 31, y2: 24 },
    { x1: 50, y1: 8,  x2: 49, y2: 22 },
    { x1: 50, y1: 8,  x2: 73, y2: 26 },
    { x1: 50, y1: 8,  x2: 83, y2: 28 },
    { x1: 13, y1: 26, x2: 9,  y2: 54 },
    { x1: 31, y1: 24, x2: 25, y2: 52 },
    { x1: 31, y1: 24, x2: 41, y2: 51 },
    { x1: 49, y1: 22, x2: 41, y2: 51 },
    { x1: 73, y1: 26, x2: 72, y2: 54 },
    { x1: 83, y1: 28, x2: 82, y2: 56 },
    { x1: 9,  y1: 54, x2: 50, y2: 82 },
    { x1: 25, y1: 52, x2: 50, y2: 82 },
    { x1: 41, y1: 51, x2: 50, y2: 82 },
    { x1: 72, y1: 54, x2: 50, y2: 82 },
    { x1: 82, y1: 56, x2: 50, y2: 82 },
    // active path: Einstein → Physics → Wave function → Quantum
    { x1: 50, y1: 8,  x2: 62, y2: 24, active: true },
    { x1: 62, y1: 24, x2: 60, y2: 52, active: true },
    { x1: 60, y1: 52, x2: 50, y2: 82, active: true },
  ],
  paths: [
    {
      id: 1,
      crumbs: [
        { href: '#', label: 'Albert Einstein', highlighted: true },
        { href: '#', label: 'Physics', tag: 'new' },
        { href: '#', label: 'Wave function', tag: 'rare' },
        { href: '#', label: 'Quantum mechanics', highlighted: true },
      ],
    },
    {
      id: 2,
      crumbs: [
        { href: '#', label: 'Albert Einstein', highlighted: true },
        { href: '#', label: 'Nobel Prize in Physics', tag: 'uncommon' },
        { href: '#', label: 'Niels Bohr' },
        { href: '#', label: 'Quantum mechanics', highlighted: true },
      ],
    },
    {
      id: 3,
      crumbs: [
        { href: '#', label: 'Albert Einstein', highlighted: true },
        { href: '#', label: 'Special Relativity' },
        { href: '#', label: 'Max Planck', tag: 'uncommon' },
        { href: '#', label: 'Quantum mechanics', highlighted: true },
      ],
    },
    {
      id: 4,
      crumbs: [
        { href: '#', label: 'Albert Einstein', highlighted: true },
        { href: '#', label: 'Germany' },
        { href: '#', label: 'Max Planck', tag: 'uncommon' },
        { href: '#', label: 'Quantum mechanics', highlighted: true },
      ],
    },
    {
      id: 5,
      crumbs: [
        { href: '#', label: 'Albert Einstein', highlighted: true },
        { href: '#', label: 'Science' },
        { href: '#', label: 'Niels Bohr' },
        { href: '#', label: 'Quantum mechanics', highlighted: true },
      ],
    },
    {
      id: 6,
      crumbs: [
        { href: '#', label: 'Albert Einstein', highlighted: true },
        { href: '#', label: 'History of physics' },
        { href: '#', label: 'Classical mechanics' },
        { href: '#', label: 'Quantum mechanics', highlighted: true },
      ],
    },
    {
      id: 7,
      crumbs: [
        { href: '#', label: 'Albert Einstein', highlighted: true },
        { href: '#', label: 'Thermodynamics' },
        { href: '#', label: 'Wave function', tag: 'rare' },
        { href: '#', label: 'Quantum mechanics', highlighted: true },
      ],
    },
    {
      id: 8,
      crumbs: [
        { href: '#', label: 'Albert Einstein', highlighted: true },
        { href: '#', label: 'Special Relativity' },
        { href: '#', label: 'Lorentz transform' },
        { href: '#', label: 'Quantum mechanics', highlighted: true },
      ],
    },
    {
      id: 9,
      crumbs: [
        { href: '#', label: 'Albert Einstein', highlighted: true },
        { href: '#', label: 'Nobel Prize in Physics', tag: 'uncommon' },
        { href: '#', label: 'Max Planck', tag: 'uncommon' },
        { href: '#', label: 'Quantum mechanics', highlighted: true },
      ],
    },
    {
      id: 10,
      crumbs: [
        { href: '#', label: 'Albert Einstein', highlighted: true },
        { href: '#', label: 'Germany' },
        { href: '#', label: 'Niels Bohr' },
        { href: '#', label: 'Quantum mechanics', highlighted: true },
      ],
    },
    {
      id: 11,
      crumbs: [
        { href: '#', label: 'Albert Einstein', highlighted: true },
        { href: '#', label: 'Physics', tag: 'new' },
        { href: '#', label: 'Thermodynamics' },
        { href: '#', label: 'Quantum mechanics', highlighted: true },
      ],
    },
    {
      id: 12,
      crumbs: [
        { href: '#', label: 'Albert Einstein', highlighted: true },
        { href: '#', label: 'Science' },
        { href: '#', label: 'Classical mechanics' },
        { href: '#', label: 'Quantum mechanics', highlighted: true },
      ],
    },
    {
      id: 13,
      crumbs: [
        { href: '#', label: 'Albert Einstein', highlighted: true },
        { href: '#', label: 'History of physics' },
        { href: '#', label: 'Thermodynamics' },
        { href: '#', label: 'Quantum mechanics', highlighted: true },
      ],
    },
    {
      id: 14,
      crumbs: [
        { href: '#', label: 'Albert Einstein', highlighted: true },
        { href: '#', label: 'Special Relativity' },
        { href: '#', label: 'Wave function', tag: 'rare' },
        { href: '#', label: 'Quantum mechanics', highlighted: true },
      ],
    },
    {
      id: 15,
      crumbs: [
        { href: '#', label: 'Albert Einstein', highlighted: true },
        { href: '#', label: 'Germany' },
        { href: '#', label: 'History of physics' },
        { href: '#', label: 'Quantum mechanics', highlighted: true },
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
      period: 'Past day',
      rows: [
        { key: 'Most paths', value: '300' },
        { key: 'Most nodes', value: '3,892' },
        { key: 'Longest path', value: '7 hops' },
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

  // ── Graph layout ──────────────────────────────────────────────────────────
  // Layers: start (top) → intermediates (middle) → end (bottom)
  const layers = [
    [{ id: 'start', label: start, top: 8, left: 50, variant: 'start' as const }],
    intermediates.map((label, i) => ({
      id: `inter-${i}`,
      label,
      top: hops === 3 ? 46 : 28,
      left: intermCount === 1 ? 50 : 20 + (i * 60) / (intermCount - 1),
      rarity: i === 0 ? ('first' as const) : i === 1 ? ('rare' as const) : null,
      variant: i === 0 ? ('active' as const) : ('default' as const),
    })),
    [{ id: 'end', label: end, top: 82, left: 50, variant: 'end' as const }],
  ];

  if (hops === 4) {
    // Add a second intermediate layer
    const bridge = seededPick(
      INTERMEDIATES.filter((t) => !intermediates.includes(t) && t !== start && t !== end),
      seed + 1,
      intermCount,
    );
    layers.splice(2, 0,
      bridge.map((label, i) => ({
        id: `bridge-${i}`,
        label,
        top: 60,
        left: intermCount === 1 ? 50 : 20 + (i * 60) / (intermCount - 1),
        rarity: null as const,
        variant: 'default' as const,
      })),
    );
  }

  const graphNodes: GraphNode[] = layers.flat() as GraphNode[];

  const graphEdges: GraphEdge[] = [];
  for (let li = 0; li < layers.length - 1; li++) {
    for (const from of layers[li]) {
      for (const to of layers[li + 1]) {
        graphEdges.push({ x1: from.left, y1: from.top, x2: to.left, y2: to.top });
      }
    }
  }
  // Highlight first path's edges as active
  for (let li = 0; li < layers.length - 1; li++) {
    const from = layers[li][0];
    const to = layers[li + 1][0];
    const edge = graphEdges.find(
      (e) => e.x1 === from.left && e.y1 === from.top && e.x2 === to.left && e.y2 === to.top,
    );
    if (edge) edge.active = true;
  }

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
        { href: '#', label: start, highlighted: true },
        ...(hops === 4
          ? [{ href: '#', label: inter, tag }]
          : []),
        { href: '#', label: intermediates[0] },
        { href: '#', label: end, highlighted: true },
      ],
    });
  }

  // ── Records ───────────────────────────────────────────────────────────────
  const records: RecordPeriod[] = [
    {
      period: 'All time',
      rows: [
        { key: 'Most paths', value: String(pathsFound + (s(6) % 50) + 10) },
        { key: 'Most nodes', value: String(nodesExplored + (s(7) % 5000) + 1000), badge: true },
        { key: 'Longest path', value: `${hops + (s(8) % 3)} hops` },
      ],
    },
    {
      period: 'Past day',
      rows: [
        { key: 'Most paths', value: String(pathsFound + (s(9) % 20)) },
        { key: 'Most nodes', value: String(nodesExplored + (s(10) % 1000)) },
        { key: 'Longest path', value: `${hops + 1} hops` },
      ],
    },
    {
      period: 'Past week',
      rows: [
        { key: 'Most paths', value: String(pathsFound + (s(11) % 35)) },
        { key: 'Most nodes', value: String(nodesExplored + (s(12) % 2000)) },
        { key: 'Longest path', value: `${hops + 2} hops` },
      ],
    },
  ];

  return {
    start,
    end,
    pathsFound,
    minHops: hops,
    nodesExplored,
    searchTimeMs,
    uniqueArticles,
    paths,
    graphNodes,
    graphEdges,
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
