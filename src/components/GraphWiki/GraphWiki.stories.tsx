import type { Meta, StoryObj } from '@storybook/react';
import { GraphWiki, type GraphData, type WikiNode, type WikiLink } from './GraphWiki';

const meta = {
  title: 'WikiLinks/GraphWiki',
  component: GraphWiki,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'sand' },
  },
} satisfies Meta<typeof GraphWiki>;

export default meta;
type Story = StoryObj<typeof meta>;

/* ────────────────────────────────────────
   Deterministic RNG
──────────────────────────────────────── */
function makeRng() {
  let s = 0;
  return () => { const x = Math.sin(++s) * 10000; return x - Math.floor(x); };
}

/**
 * Computes layer sizes following the natural BFS-expansion model.
 *
 * L0 = fanOut (start links to exactly fanOut articles).
 * Each subsequent expanding layer is fanOut× larger.
 * The remaining nodes fill two equal plateau layers in the middle.
 * The contracting half mirrors the expanding half.
 *
 * Example: bfsLayers(1000, 5) → [5, 25, 125, 344, 344, 125, 25, 5]
 * This ensures every node, including start, has fanOut connections.
 */
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

/**
 * Builds a layered shortest-path graph from explicit interior layer sizes.
 * Every edge goes strictly layer i → layer i+1.
 */
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
      nodes.push({ id, variant: 'path' });
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

    const edgeFanOut = to.length < from.length
      ? Math.max(1, Math.round(fanOut * to.length / from.length))
      : Math.min(fanOut, to.length);

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
  }

  return { nodes, links };
}

function buildMultiPathGraph(totalNodes: number, fanOut: number): GraphData {
  return buildGraph(bfsLayers(totalNodes, fanOut), fanOut);
}

/**
 * Builds a graph with exactly `degrees` hops from start to end.
 * Interior layers expand as fanOut^1, fanOut^2, … then mirror back,
 * capped at 150 nodes per layer for visual clarity.
 */
function buildGraphForDegrees(degrees: number, fanOut: number): GraphData {
  const MAX_LAYER   = 150;
  const numInterior = degrees - 1;

  if (numInterior === 0) {
    return {
      nodes: [{ id: 'start', variant: 'start' }, { id: 'end', variant: 'end' }],
      links: [{ source: 'start', target: 'end' }],
    };
  }

  const half: number[] = [];
  for (let i = 0; i < Math.ceil(numInterior / 2); i++) {
    half.push(Math.min(fanOut ** (i + 1), MAX_LAYER));
  }

  const interiorSizes = numInterior % 2 === 1
    ? [...half, ...half.slice(0, -1).reverse()]   // odd: peak layer is the center
    : [...half, ...half.slice().reverse()];        // even: two equal middle layers

  return buildGraph(interiorSizes, fanOut);
}

/* Pre-built at module load — stable across story re-renders */
const DATA_SMALL = buildMultiPathGraph(60,    8);
const DATA_MAIN  = buildMultiPathGraph(1000,  8);

/* ────────────────────────────────────────
   Stories
──────────────────────────────────────── */

export const Default: Story = {
  args: { graphData: DATA_MAIN },
};

export const Small: Story = {
  args: { graphData: DATA_SMALL },
};

/** 1 degree of separation — start links directly to end. 2 nodes. */
export const Degree1: Story = {
  args: { graphData: buildGraphForDegrees(1, 8) },
};

/** 2 degrees of separation — one intermediate layer of 8 nodes. 10 nodes total. */
export const Degree2: Story = {
  args: { graphData: buildGraphForDegrees(2, 8) },
};

/** 3 degrees of separation — two layers of 8. 18 nodes total. */
export const Degree3: Story = {
  args: { graphData: buildGraphForDegrees(3, 8) },
};

/** 4 degrees of separation — layers [8, 64, 8]. 82 nodes total. */
export const Degree4: Story = {
  args: { graphData: buildGraphForDegrees(4, 8) },
};

/** 5 degrees of separation — layers [8, 64, 64, 8]. 146 nodes total. */
export const Degree5: Story = {
  args: { graphData: buildGraphForDegrees(5, 8) },
};

/** 6 degrees of separation — layers [8, 64, 150, 64, 8]. 296 nodes total. */
export const Degree6: Story = {
  args: { graphData: buildGraphForDegrees(6, 8) },
};
