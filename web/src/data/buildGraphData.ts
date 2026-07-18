import type { GraphData, WikiNode, WikiLink } from '../components/GraphWiki/GraphWiki';

const DEFAULT_START = 'Albert Einstein';
const DEFAULT_END   = 'Quantum mechanics';

const MOCK_ARTICLES = [
  'History of physics', 'Special Relativity', 'Nobel Prize in Physics', 'Physics',
  'Germany', 'Science', 'Classical mechanics', 'Lorentz transform', 'Thermodynamics',
  'Wave function', 'Max Planck', 'Niels Bohr',
  'Philosophy', 'Mathematics', 'Biology', 'Chemistry', 'Astronomy', 'Literature',
  'Technology', 'Politics', 'Economics', 'Geography',
  'Classical antiquity', 'Medieval Europe', 'Renaissance',
  'Industrial Revolution', 'Enlightenment', 'Romanticism',
];

function makeRng() {
  let s = 0;
  return () => { const x = Math.sin(++s) * 10000; return x - Math.floor(x); };
}

function bfsLayers(totalNodes: number, fanOut: number): number[] {
  const half: number[] = [];
  let size = fanOut;
  while (true) {
    half.push(size);
    const used = half.reduce((a, b) => a + b, 0) * 2;
    const next = size * fanOut;
    if (used + next * 2 + 2 > totalNodes) break;
    size = next;
  }
  const usedByHalf = half.reduce((a, b) => a + b, 0);
  const plateau    = Math.floor((totalNodes - 2 - usedByHalf * 2) / 2);
  return [...half, plateau, plateau, ...half.slice().reverse()];
}

function seededPick<T>(arr: T[], seed: number, count: number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  let s = seed;
  for (let i = 0; i < count; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % copy.length;
    result.push(copy[j]);
    copy.splice(j, 1);
    if (copy.length === 0) copy.push(...arr);
  }
  return result;
}

/** Attach Wikipedia article titles to graph nodes for hover labels. */
export function assignGraphLabels(
  graphData: GraphData,
  start = DEFAULT_START,
  end = DEFAULT_END,
  seed = 42,
): GraphData {
  const pool = MOCK_ARTICLES.filter((a) => a !== start && a !== end);
  const titles = seededPick(pool, seed, graphData.nodes.length);
  let i = 0;

  const nodes: WikiNode[] = graphData.nodes.map((node) => {
    if (node.id === 'start') return { ...node, label: start };
    if (node.id === 'end') return { ...node, label: end };
    return { ...node, label: titles[i++ % titles.length] };
  });

  return { ...graphData, nodes };
}

function buildGraph(layerSizes: number[], fanOut: number): GraphData {
  const rng = makeRng();

  const nodes: WikiNode[] = [];
  const links: WikiLink[] = [];

  nodes.push({ id: 'start', variant: 'start' });
  const layers: string[][] = [['start']];

  for (let l = 0; l < layerSizes.length; l++) {
    const layer: string[] = [];
    for (let j = 0; j < layerSizes[l]; j++) {
      const id = `n${l}x${j}`;
      const hitCount = rng() < 0.05 ? 1 : 12;
      // One highlighted path node per layer (j === 0); the rest are default.
      nodes.push(j === 0 ? { id, variant: 'path', hitCount } : { id, hitCount });
      layer.push(id);
    }
    layers.push(layer);
  }

  nodes.push({ id: 'end', variant: 'end' });
  layers.push(['end']);

  for (let l = 0; l < layers.length - 1; l++) {
    const from = layers[l];
    const to   = layers[l + 1];

    if (from.length === 1 || to.length === 1) {
      for (const f of from) for (const t of to) links.push({ source: f, target: t });
      continue;
    }

    let edgeFanOut = to.length < from.length
      ? Math.max(1, Math.round(fanOut * to.length / from.length))
      : Math.min(fanOut, to.length);

    // When fanOut saturates the target layer, cap per-source degree so we don't
    // wire every source to every target (unrealistic for equal-width layers).
    if (from.length > 1 && to.length > 1 && edgeFanOut >= to.length) {
      edgeFanOut = Math.max(1, Math.min(fanOut, to.length - 1, Math.ceil(fanOut / 2)));
    }

    const seen    = new Set<string>();
    const covered = new Set<string>();

    const addEdge = (f: string, t: string) => {
      const key = `${f}|${t}`;
      if (seen.has(key)) return false;
      seen.add(key);
      links.push({ source: f, target: t });
      covered.add(t);
      return true;
    };

    for (const f of from) {
      const pool = [...to];
      for (let k = 0; k < edgeFanOut && k < pool.length; k++) {
        const j = k + Math.floor(rng() * (pool.length - k));
        [pool[k], pool[j]] = [pool[j], pool[k]];
        addEdge(f, pool[k]);
      }
    }

    for (const t of to) {
      if (covered.has(t)) continue;
      const shuffled = [...from].sort(() => rng() - 0.5);
      for (const f of shuffled) { if (addEdge(f, t)) break; }
    }

    // Keep the highlighted path chain connected across interior layers.
    if (from.length > 1 && to.length > 1) addEdge(from[0], to[0]);
  }

  return assignGraphLabels({ nodes, links });
}

export function buildMultiPathGraph(totalNodes: number, fanOut: number): GraphData {
  return buildGraph(bfsLayers(totalNodes, fanOut), fanOut);
}

export function buildGraphForDegrees(degrees: number, fanOut: number): GraphData {
  const MAX_LAYER   = 150;
  const numInterior = degrees - 1;

  if (numInterior === 0) {
    return assignGraphLabels({
      nodes: [{ id: 'start', variant: 'start' }, { id: 'end', variant: 'end' }],
      links: [{ source: 'start', target: 'end' }],
    });
  }

  const half: number[] = [];
  for (let i = 0; i < Math.ceil(numInterior / 2); i++) {
    half.push(Math.min(fanOut ** (i + 1), MAX_LAYER));
  }

  const interiorSizes = numInterior % 2 === 1
    ? [...half, ...half.slice(0, -1).reverse()]
    : [...half, ...half.slice().reverse()];

  return buildGraph(interiorSizes, fanOut);
}
