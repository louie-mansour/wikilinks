import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';
import { forceLink, forceManyBody, forceX as d3ForceX, forceY as d3ForceY } from 'd3-force-3d';
import styles from './GraphWiki.module.css';

// Canvas can't read CSS custom properties — mirror values from tokens.css.
const C = {
  white:    '#fefcf8',  // --white (canvas bg)
  sandDark: '#d4c0a4',  // --sand-dark (links)
  ink:      '#2c2416',  // --ink (start)
  sage:     '#4a7c59',  // --sage (end)
  terra:    '#c4572a',  // --terra (interior nodes)
  terraPale:'#faf0ea',  // --terra-pale (active node bg)
} as const;

const FONT_UI = "'Figtree', system-ui, sans-serif";

const SPACE_1 = 4;   // --space-1
const SPACE_2 = 6;   // --space-2
const SPACE_7 = 20;  // --space-7

const LABEL_FONT_SIZE = 11;
const LABEL_PAD_Y     = 5;
const LABEL_PAD_X     = 12;
const RADIUS_SM       = 10;  // --radius-sm
const RADIUS_MD       = 18;  // --radius-md

const NODE_REL_SIZE = SPACE_1;
const BORDER_STD    = 1.5;
const LAYER_SPACING = SPACE_7 * 10;  // horizontal gap between layers
const NODE_V_SPACING = SPACE_7;      // vertical gap between nodes in the same layer
const FIT_PADDING   = SPACE_7 * 2;

export type WikiNodeVariant = 'default' | 'start' | 'end' | 'path';

export interface WikiNode {
  id: string;
  variant?: WikiNodeVariant;
  /** Wikipedia article title — shown on hover/highlight only. */
  label?: string;
}

/** Force-graph mutates nodes with simulation coordinates at runtime. */
type SimNode = WikiNode & {
  fx?: number;
  fy?: number;
  x?: number;
  y?: number;
};

export interface WikiLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: WikiNode[];
  links: WikiLink[];
}

function resolveVariant(node: WikiNode): WikiNodeVariant {
  if (node.variant) return node.variant;
  if (node.id === 'start') return 'start';
  if (node.id === 'end') return 'end';
  return 'default';
}

function nodeFill(variant: WikiNodeVariant): string {
  if (variant === 'start') return C.ink;
  if (variant === 'end') return C.sage;
  return C.terra;
}

function nodeRadius(variant: WikiNodeVariant): number {
  return variant === 'start' || variant === 'end' ? SPACE_2 : SPACE_1;
}

function nodeVal(variant: WikiNodeVariant): number {
  return (nodeRadius(variant) / NODE_REL_SIZE) ** 2;
}

function terminalIds(nodes: WikiNode[]): { startId?: string; endId?: string } {
  return {
    startId: nodes.find(n => resolveVariant(n) === 'start')?.id,
    endId:   nodes.find(n => resolveVariant(n) === 'end')?.id,
  };
}

// ForceGraph2D mutates link.source/target from strings to node objects in-place.
// This normalizes both forms so BFS works whether or not the simulation has run.
function linkEndId(val: string | { id: string }): string {
  return typeof val === 'string' ? val : val.id;
}

/** BFS hop depth from the start node along directed links. */
function computeBfsDepths(nodes: WikiNode[], links: WikiLink[]): Map<string, number> {
  const depths = new Map<string, number>();
  const rootId = terminalIds(nodes).startId ?? nodes[0]?.id;
  if (!rootId) return depths;

  const queue = [rootId];
  depths.set(rootId, 0);

  while (queue.length > 0) {
    const id = queue.shift()!;
    const d  = depths.get(id)! + 1;
    for (const link of links) {
      const src = linkEndId(link.source as string | { id: string });
      const tgt = linkEndId(link.target as string | { id: string });
      if (src === id && !depths.has(tgt)) {
        depths.set(tgt, d);
        queue.push(tgt);
      }
    }
  }

  return depths;
}

/**
 * Assign every node a pinned (x, y):
 *  x — determined by BFS depth from start (depth 0 = leftmost)
 *  y — nodes within the same layer distributed evenly around the centre line
 *
 * The entire layout is centred at (0, 0) so zoomToFit works symmetrically.
 */
function computeLayeredPositions(
  nodes: WikiNode[],
  links: WikiLink[],
): Map<string, { x: number; y: number }> {
  const depths = computeBfsDepths(nodes, links);
  const { endId } = terminalIds(nodes);

  // If end isn't reachable via links, place it one column past the deepest node.
  const maxReachable = depths.size > 0 ? Math.max(...depths.values()) : 0;
  if (endId && !depths.has(endId)) {
    depths.set(endId, maxReachable + 1);
  }

  const totalDepth = depths.size > 0 ? Math.max(...depths.values()) : 0;
  const xCenter    = (totalDepth * LAYER_SPACING) / 2;

  // Group node IDs by layer depth.
  const layers = new Map<number, string[]>();
  for (const node of nodes) {
    const d = depths.get(node.id) ?? 0;
    if (!layers.has(d)) layers.set(d, []);
    layers.get(d)!.push(node.id);
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const [depth, ids] of layers) {
    const x = depth * LAYER_SPACING - xCenter;
    const n = ids.length;
    for (let i = 0; i < n; i++) {
      const y = n === 1 ? 0 : (i - (n - 1) / 2) * NODE_V_SPACING;
      positions.set(ids[i], { x, y });
    }
  }

  return positions;
}

/** Set initial positions without pinning — physics can move them freely after. */
function setInitialPositions(
  nodes: WikiNode[],
  positions: Map<string, { x: number; y: number }>,
): void {
  for (const node of nodes) {
    const sim = node as SimNode;
    const pos = positions.get(node.id);
    if (pos) {
      sim.x  = pos.x;
      sim.y  = pos.y;
      delete sim.fx;
      delete sim.fy;
    }
  }
}

function linkTouchesNode(link: WikiLink, nodeId: string): boolean {
  return linkEndId(link.source as string | { id: string }) === nodeId
    || linkEndId(link.target as string | { id: string }) === nodeId;
}

function neighborIds(nodeId: string, links: WikiLink[]): Set<string> {
  const ids = new Set<string>();
  for (const link of links) {
    const { source, target } = linkEndpoints(link);
    if (source === nodeId) ids.add(target);
    else if (target === nodeId) ids.add(source);
  }
  return ids;
}

function linkEndpoints(link: WikiLink): { source: string; target: string } {
  return {
    source: linkEndId(link.source as string | { id: string }),
    target: linkEndId(link.target as string | { id: string }),
  };
}

function linksEqual(a: WikiLink, b: { source: string; target: string }): boolean {
  const { source, target } = linkEndpoints(a);
  return source === b.source && target === b.target;
}

function nodeDisplayName(node: WikiNode): string {
  return node.label ?? node.id;
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

function drawHighlightedLabel(
  node: SimNode,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
): void {
  const variant = resolveVariant(node);
  const text = nodeDisplayName(node);
  const isTerminal = variant === 'start' || variant === 'end';
  const fontWeight = isTerminal ? 700 : 500;
  const fontSize = LABEL_FONT_SIZE / globalScale;
  const padY = LABEL_PAD_Y / globalScale;
  const padX = LABEL_PAD_X / globalScale;
  const radius = (isTerminal ? RADIUS_MD : RADIUS_SM) / globalScale;
  const borderW = BORDER_STD / globalScale;

  ctx.font = `${fontWeight} ${fontSize}px ${FONT_UI}`;
  const textW = ctx.measureText(text).width;
  const boxW = textW + padX * 2;
  const boxH = fontSize * 1.2 + padY * 2;

  const nodeR = Math.sqrt(nodeVal(variant)) * NODE_REL_SIZE;
  const cx = node.x!;
  const cy = node.y! - nodeR - boxH / 2 - SPACE_2 / globalScale;
  const x = cx - boxW / 2;
  const y = cy - boxH / 2;

  ctx.beginPath();
  roundRect(ctx, x, y, boxW, boxH, radius);
  ctx.fillStyle = C.terraPale;
  ctx.fill();
  ctx.strokeStyle = C.terra;
  ctx.lineWidth = borderW;
  ctx.stroke();

  ctx.fillStyle = C.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy);
}

export function GraphWiki({ graphData }: { graphData: GraphData }) {
  const wrapperRef     = useRef<HTMLDivElement>(null);
  const fgRef          = useRef<ForceGraphMethods<WikiNode, WikiLink>>();
  const initialFitDone = useRef(false);
  const [dims, setDims] = useState({ width: 800, height: 440 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<{ source: string; target: string } | null>(null);

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
    const positions = computeLayeredPositions(graphData.nodes, graphData.links);
    setInitialPositions(graphData.nodes, positions);
    return graphData;
  }, [graphData]);

  const hoveredNeighborIds = useMemo(
    () => (hoveredNodeId ? neighborIds(hoveredNodeId, positionedData.links) : null),
    [hoveredNodeId, positionedData.links],
  );

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;

    initialFitDone.current = false;

    const positions = computeLayeredPositions(positionedData.nodes, positionedData.links);

    // Springy link force — connects neighbors like rubber bands.
    fg.d3Force('link', forceLink<SimNode, WikiLink>()
      .id((n) => n.id)
      .strength(0.25)
      .distance(LAYER_SPACING),
    );

    // Light repulsion so nodes don't collapse onto each other.
    fg.d3Force('charge', forceManyBody<SimNode>().strength(-120));

    // Strong horizontal anchor keeps nodes locked to their BFS layer column.
    fg.d3Force('x', d3ForceX<SimNode>()
      .x((n) => positions.get(n.id)?.x ?? 0)
      .strength(0.7),
    );
    // Soft vertical anchor lets nodes spring up/down within their column.
    fg.d3Force('y', d3ForceY<SimNode>()
      .y((n) => positions.get(n.id)?.y ?? 0)
      .strength(0.06),
    );

    fg.d3Force('center', null);
    fg.d3ReheatSimulation();
  }, [positionedData]);

  // Fit the view once after the simulation first settles.
  const handleEngineStop = useCallback(() => {
    if (!initialFitDone.current) {
      initialFitDone.current = true;
      fgRef.current?.zoomToFit(400, FIT_PADDING);
    }
  }, []);

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <ForceGraph2D
        ref={fgRef}
        width={dims.width}
        height={dims.height}
        backgroundColor={C.white}
        nodeId="id"
        nodeLabel=""
        nodeAutoColorBy={null}
        nodeColor={(n) => nodeFill(resolveVariant(n))}
        nodeVal={(n) => nodeVal(resolveVariant(n))}
        graphData={positionedData}
        nodeRelSize={NODE_REL_SIZE}
        linkColor={C.sandDark}
        linkWidth={BORDER_STD}
        linkCanvasObject={(link, ctx, globalScale) => {
          const start = link.source as SimNode;
          const end = link.target as SimNode;
          if (start.x == null || start.y == null || end.x == null || end.y == null) return;

          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.strokeStyle = C.ink;
          ctx.lineWidth = BORDER_STD / globalScale;
          ctx.stroke();
        }}
        linkCanvasObjectMode={(link) =>
          (hoveredLink && linksEqual(link, hoveredLink))
          || (hoveredNodeId && linkTouchesNode(link, hoveredNodeId))
            ? 'after'
            : undefined
        }
        nodeCanvasObject={(node, ctx, globalScale) => {
          const r = Math.sqrt(nodeVal(resolveVariant(node))) * NODE_REL_SIZE;
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI);
          ctx.strokeStyle = C.ink;
          ctx.lineWidth = BORDER_STD / globalScale;
          ctx.stroke();

          drawHighlightedLabel(node as SimNode, ctx, globalScale);
        }}
        nodeCanvasObjectMode={(node) =>
          hoveredNodeId === node.id
          || (hoveredNeighborIds?.has(node.id))
          || (hoveredLink && (node.id === hoveredLink.source || node.id === hoveredLink.target))
            ? 'after'
            : undefined
        }
        onNodeHover={(node) => {
          setHoveredNodeId(node?.id ?? null);
          if (node) setHoveredLink(null);
        }}
        onLinkHover={(link) => {
          setHoveredLink(link ? linkEndpoints(link) : null);
          if (link) setHoveredNodeId(null);
        }}
        onEngineStop={handleEngineStop}
        d3AlphaDecay={0.015}
        d3VelocityDecay={0.2}
        autoPauseRedraw
      />
    </div>
  );
}
