import { useRef, useEffect, useState, useMemo } from 'react';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';
import { forceLink, forceManyBody, forceX as d3ForceX, forceY as d3ForceY } from 'd3-force-3d';
import styles from './GraphWikiReveal.module.css';
import { useCanvasColors } from '../../theme/useTheme';
import type { CanvasColors } from '../../theme/readCanvasColors';
import type { RevealGraphData, RevealNode, RevealNodeState } from '../../data/revealGraph';
import type { WikiLink } from './GraphWiki';

/**
 * `GraphWikiReveal` — Reveal mode's canvas. A sibling of `GraphWiki`, not a
 * modification of it (see `.claude/rules/graphwiki-node-connections.md` and
 * `docs/grill-reveal-mode/issues/04-graphwiki-reveal-component.md`).
 *
 * It reuses `GraphWiki`'s BFS-layered force-layout approach (depth-anchored
 * `forceX`/`forceY`, springy link force, light charge repulsion) but is a
 * separate component free to add the hover-to-reveal-title interaction that
 * `GraphWiki` deliberately excludes for its own (Classic) minimalism
 * contract.
 *
 * Rendering rules per node `state` (see `revealGraph.ts`):
 *  - `named`  — normal filled circle, hoverable tooltip shows the title.
 *  - `blank`  — muted dashed-outline circle, never hoverable (no title to show).
 *  - `unknown`— visually distinct fixed style, permanent on-canvas "Unknown"
 *               label, until a win/loss full reveal flips it to `named`.
 */

const NODE_REL_SIZE  = 4;
const BORDER_STD     = 1.5;
const LAYER_SPACING  = 280;
const NODE_V_SPACING = 20;
const FIT_PADDING    = 40;
const MIN_V_SPACING  = 4;
const MOBILE_LAYOUT_MAX_WIDTH = 520;

const RADIUS_DEFAULT = 10; // named / blank
const RADIUS_UNKNOWN = 13; // unknown gets a slightly larger, terminal-like size

type GraphOrientation = 'horizontal' | 'vertical';

function graphOrientation(viewportWidth: number): GraphOrientation {
  return viewportWidth <= MOBILE_LAYOUT_MAX_WIDTH ? 'vertical' : 'horizontal';
}

/** Force-graph mutates nodes with simulation coordinates at runtime. */
type SimNode = RevealNode & {
  fx?: number;
  fy?: number;
  x?: number;
  y?: number;
};

function linkEndId(val: string | { id: string }): string {
  return typeof val === 'string' ? val : val.id;
}

// A link's source/target is mutated in-place from a string id to a node-object
// reference once ForceGraph2D's simulation resolves it. Reused link objects
// (the accumulated reveal graph carries the same link objects forward across
// guesses) arrive here already resolved to a *stale* node object from a
// previous render — d3-force only re-resolves an endpoint when it's still a
// plain string, so a stale reference never updates again and the link
// renders frozen while nodes move on. Rebuilding fresh {source, target}
// string pairs every time forces re-resolution against the current nodes.
function resetLinkEndpoints(links: WikiLink[]): WikiLink[] {
  return links.map((l) => ({
    source: linkEndId(l.source as string | { id: string }),
    target: linkEndId(l.target as string | { id: string }),
  }));
}

function findUnknownId(nodes: RevealNode[]): string | undefined {
  return nodes.find((n) => n.state === 'unknown')?.id;
}

/** BFS hop depth, rooted at the unknown/hidden node when present, else the first node. */
function computeBfsDepths(nodes: RevealNode[], links: WikiLink[]): Map<string, number> {
  const depths = new Map<string, number>();
  const rootId = findUnknownId(nodes) ?? nodes[0]?.id;
  if (!rootId) return depths;

  const queue = [rootId];
  depths.set(rootId, 0);

  while (queue.length > 0) {
    const id = queue.shift()!;
    const d = depths.get(id)! + 1;
    for (const link of links) {
      const src = linkEndId(link.source as string | { id: string });
      const tgt = linkEndId(link.target as string | { id: string });
      if (src === id && !depths.has(tgt)) {
        depths.set(tgt, d);
        queue.push(tgt);
      }
      if (tgt === id && !depths.has(src)) {
        depths.set(src, d);
        queue.push(src);
      }
    }
  }

  return depths;
}

/** Same layered-position idea as `GraphWiki`: depth on the primary axis,
 *  even spread on the cross axis, centred at (0, 0). */
function computeLayeredPositions(
  nodes: RevealNode[],
  links: WikiLink[],
  orientation: GraphOrientation,
): Map<string, { x: number; y: number }> {
  const depths = computeBfsDepths(nodes, links);
  const totalDepth = depths.size > 0 ? Math.max(...depths.values()) : 0;
  const depthCenter = (totalDepth * LAYER_SPACING) / 2;

  const layers = new Map<number, string[]>();
  for (const node of nodes) {
    const d = depths.get(node.id) ?? 0;
    if (!layers.has(d)) layers.set(d, []);
    layers.get(d)!.push(node.id);
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const [depth, ids] of layers) {
    const depthCoord = depth * LAYER_SPACING - depthCenter;
    const n = ids.length;
    const crossSpacing = Math.max(MIN_V_SPACING, NODE_V_SPACING);
    for (let i = 0; i < n; i++) {
      const crossCoord = n === 1 ? 0 : (i - (n - 1) / 2) * crossSpacing;
      positions.set(
        ids[i],
        orientation === 'horizontal'
          ? { x: depthCoord, y: crossCoord }
          : { x: crossCoord, y: depthCoord },
      );
    }
  }

  return positions;
}

function setInitialPositions(
  nodes: RevealNode[],
  positions: Map<string, { x: number; y: number }>,
): void {
  for (const node of nodes) {
    const sim = node as SimNode;
    const pos = positions.get(node.id);
    if (pos) {
      sim.x = pos.x;
      sim.y = pos.y;
      delete sim.fx;
      delete sim.fy;
    }
  }
}

interface GraphBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

function radiusForState(state: RevealNodeState): number {
  return state === 'unknown' ? RADIUS_UNKNOWN : RADIUS_DEFAULT;
}

function nodeVal(state: RevealNodeState): number {
  return (radiusForState(state) / NODE_REL_SIZE) ** 2;
}

function computeFitBounds(
  nodes: RevealNode[],
  links: WikiLink[],
  orientation: GraphOrientation,
): GraphBounds | null {
  const positions = computeLayeredPositions(nodes, links, orientation);
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;

  for (const node of nodes) {
    const pos = positions.get(node.id);
    if (!pos) continue;
    const r = radiusForState(node.state);
    xMin = Math.min(xMin, pos.x - r);
    xMax = Math.max(xMax, pos.x + r);
    yMin = Math.min(yMin, pos.y - r);
    yMax = Math.max(yMax, pos.y + r);
  }

  if (!isFinite(xMin)) return null;
  return { xMin, xMax, yMin, yMax };
}

function fitGraphView(
  fg: ForceGraphMethods<RevealNode, WikiLink>,
  bounds: GraphBounds,
  width: number,
  height: number,
  durationMs: number,
): void {
  const graphW = bounds.xMax - bounds.xMin;
  const graphH = bounds.yMax - bounds.yMin;
  if (graphW <= 0 || graphH <= 0) return;

  const cx = (bounds.xMin + bounds.xMax) / 2;
  const cy = (bounds.yMin + bounds.yMax) / 2;
  const k = Math.min(
    (width - FIT_PADDING * 2) / graphW,
    (height - FIT_PADDING * 2) / graphH,
  );

  fg.centerAt(cx, cy, durationMs);
  fg.zoom(k, durationMs);
}

/** `blank` nodes deliberately have no `label` (see `revealGraph.ts`), so this
 *  never falls back to raw ids for them; `unknown` always reads "Unknown". */
function nodeDisplayName(node: RevealNode): string {
  if (node.state === 'unknown') return 'Unknown';
  if (node.state === 'blank') return '';
  return node.label ?? node.id;
}

function nodeFill(state: RevealNodeState, colors: CanvasColors): string {
  if (state === 'unknown') return colors.sandDark;
  if (state === 'blank') return colors.white;
  return colors.terra;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

/** Permanent "Unknown" pill below the unknown node — the one exception to
 *  "no on-canvas labels" (see issue 04 rendering rules). */
function drawUnknownLabel(
  node: SimNode,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  colors: CanvasColors,
): void {
  if (node.x == null || node.y == null) return;
  const text = 'Unknown';
  const fontSize = 12 / globalScale;
  const padX = 8 / globalScale;
  const padY = 4 / globalScale;
  ctx.font = `600 ${fontSize}px 'Figtree', system-ui, sans-serif`;
  const textW = ctx.measureText(text).width;
  const boxW = textW + padX * 2;
  const boxH = fontSize * 1.2 + padY * 2;
  const r = radiusForState('unknown');
  const gap = 6 / globalScale;
  const cx = node.x;
  const cy = node.y + r + boxH / 2 + gap;

  ctx.beginPath();
  roundRect(ctx, cx - boxW / 2, cy - boxH / 2, boxW, boxH, 6 / globalScale);
  ctx.fillStyle = colors.white;
  ctx.fill();
  ctx.strokeStyle = colors.ink;
  ctx.lineWidth = BORDER_STD / globalScale;
  ctx.stroke();

  ctx.fillStyle = colors.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy);
}

export interface GraphWikiRevealProps {
  /** The accumulated Reveal-mode graph — see `revealGraph.ts`. */
  graphData: RevealGraphData;
  /** Fires once after the graph has fitted to its container. */
  onReady?: () => void;
}

export function GraphWikiReveal({ graphData, onReady }: GraphWikiRevealProps) {
  const colors = useCanvasColors();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods<RevealNode, WikiLink>>();
  const readyNotifiedRef = useRef(false);
  const [dims, setDims] = useState({ width: 800, height: 440 });

  const orientation = graphOrientation(dims.width);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setDims({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Set initial x/y without pinning — simulation starts from correct positions.
  const positionedData = useMemo(() => {
    const positions = computeLayeredPositions(graphData.nodes, graphData.links, orientation);
    setInitialPositions(graphData.nodes, positions);
    return { nodes: graphData.nodes, links: resetLinkEndpoints(graphData.links) };
  }, [graphData, orientation]);

  const fitBounds = useMemo(
    () => computeFitBounds(positionedData.nodes, positionedData.links, orientation),
    [positionedData, orientation],
  );

  useEffect(() => {
    readyNotifiedRef.current = false;
  }, [graphData]);

  useEffect(() => {
    if (!fitBounds) return;

    let raf = 0;
    let cancelled = false;
    const fit = () => {
      const fg = fgRef.current;
      if (!fg) {
        raf = requestAnimationFrame(fit);
        return;
      }
      fitGraphView(fg, fitBounds, dims.width, dims.height, 0);
      if (!readyNotifiedRef.current) {
        readyNotifiedRef.current = true;
        raf = requestAnimationFrame(() => {
          if (!cancelled) onReady?.();
        });
      }
    };
    fit();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [fitBounds, dims, onReady]);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;

    const positions = computeLayeredPositions(positionedData.nodes, positionedData.links, orientation);

    fg.d3Force('link', forceLink<SimNode, WikiLink>()
      .id((n) => n.id)
      .strength(0.25)
      .distance(LAYER_SPACING),
    );
    fg.d3Force('charge', forceManyBody<SimNode>().strength(-120));

    const depthStrength = 0.7;
    const crossStrength = 0.5;
    fg.d3Force('x', d3ForceX<SimNode>()
      .x((n) => positions.get(n.id)?.x ?? 0)
      .strength(orientation === 'horizontal' ? depthStrength : crossStrength),
    );
    fg.d3Force('y', d3ForceY<SimNode>()
      .y((n) => positions.get(n.id)?.y ?? 0)
      .strength(orientation === 'horizontal' ? crossStrength : depthStrength),
    );

    fg.d3Force('center', null);
    fg.d3ReheatSimulation();
  }, [positionedData, orientation]);

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <ForceGraph2D
        ref={fgRef}
        width={dims.width}
        height={dims.height}
        backgroundColor={colors.white}
        nodeId="id"
        // Only `named` nodes have a title to reveal; `blank` and `unknown`
        // render an empty tooltip, i.e. no hover reveal at all.
        nodeLabel={(n) => (n as RevealNode).state === 'named' ? nodeDisplayName(n as RevealNode) : ''}
        nodeAutoColorBy={null}
        nodeColor={(n) => nodeFill((n as RevealNode).state, colors)}
        nodeVal={(n) => nodeVal((n as RevealNode).state)}
        graphData={positionedData}
        nodeRelSize={NODE_REL_SIZE}
        enableZoomInteraction={(e) => (e as WheelEvent).ctrlKey}
        linkColor={() => colors.graphLink}
        linkWidth={BORDER_STD}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const n = node as SimNode;
          const state = n.state;
          const r = Math.sqrt(nodeVal(state)) * NODE_REL_SIZE;

          ctx.beginPath();
          ctx.arc(n.x!, n.y!, r, 0, 2 * Math.PI);
          ctx.fillStyle = nodeFill(state, colors);
          ctx.fill();

          if (state === 'blank') {
            // Dashed outline — "known to exist, not yet identified".
            ctx.save();
            ctx.setLineDash([3 / globalScale, 3 / globalScale]);
            ctx.strokeStyle = colors.sandDark;
            ctx.lineWidth = BORDER_STD / globalScale;
            ctx.stroke();
            ctx.restore();
          } else {
            ctx.strokeStyle = colors.ink;
            ctx.lineWidth = BORDER_STD / globalScale;
            ctx.stroke();
          }

          if (state === 'unknown') {
            drawUnknownLabel(n, ctx, globalScale, colors);
          }
        }}
        nodeCanvasObjectMode={() => 'replace'}
      />
    </div>
  );
}
