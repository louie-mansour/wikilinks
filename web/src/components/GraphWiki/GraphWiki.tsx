import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { trackGraphNodeHighlighted, trackGraphNodeNavigated } from '../../analytics';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';
import { forceLink, forceManyBody, forceX as d3ForceX, forceY as d3ForceY } from 'd3-force-3d';
import styles from './GraphWiki.module.css';
import { Badge } from '../Badge/Badge';
import { useCanvasColors } from '../../theme/useTheme';
import type { CanvasColors } from '../../theme/readCanvasColors';

const FONT_UI = "'Figtree', system-ui, sans-serif";

const SPACE_1 = 4;   // --space-1
const SPACE_2 = 6;   // --space-2
const SPACE_7 = 20;  // --space-7

const LABEL_FONT_SIZE = 11;
const LABEL_PAD_Y     = 5;
const LABEL_PAD_X     = 12;
const RADIUS_SM       = 10;  // --radius-sm
const RADIUS_MD       = 18;  // --radius-md


const NODE_REL_SIZE  = SPACE_1;
const BORDER_STD     = 1.5;
const LAYER_SPACING  = SPACE_7 * 14;  // gap between BFS layers along the primary axis
const NODE_V_SPACING = SPACE_7;       // max cross-axis gap; reduced adaptively for dense layers
const FIT_PADDING    = SPACE_7 * 2;
const TARGET_ASPECT  = 1.8;           // desired width:height (horizontal layout)
const MIN_V_SPACING  = 4;             // floor so nodes never fully overlap
const MOBILE_LAYOUT_MAX_WIDTH = 520;  // matches design-system §4 breakpoint

export type WikiNodeVariant = 'default' | 'start' | 'end' | 'path';

export interface WikiNode {
  id: string;
  variant?: WikiNodeVariant;
  /** Wikipedia article title — shown on hover/highlight only. */
  label?: string;
  /** Show the "new" badge next to this node. */
  isNew?: boolean;
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

/** Left-to-right on desktop; top-to-bottom on narrow viewports. */
export type GraphOrientation = 'horizontal' | 'vertical';

function graphOrientation(viewportWidth: number): GraphOrientation {
  return viewportWidth <= MOBILE_LAYOUT_MAX_WIDTH ? 'vertical' : 'horizontal';
}

function resolveVariant(node: WikiNode): WikiNodeVariant {
  if (node.variant) return node.variant;
  if (node.id === 'start') return 'start';
  if (node.id === 'end') return 'end';
  return 'default';
}

function nodeFill(variant: WikiNodeVariant, colors: CanvasColors): string {
  if (variant === 'start') return colors.ink;
  if (variant === 'end') return colors.sage;
  return colors.terra;
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
 *  primary axis — BFS depth from start (depth 0 = start side)
 *  cross axis — nodes within the same layer distributed evenly around centre
 *
 * Horizontal: depth → x (left→right), spread → y.
 * Vertical:   depth → y (top→bottom), spread → x.
 *
 * The entire layout is centred at (0, 0) so zoomToFit works symmetrically.
 */
function computeLayeredPositions(
  nodes: WikiNode[],
  links: WikiLink[],
  orientation: GraphOrientation,
): Map<string, { x: number; y: number }> {
  const depths = computeBfsDepths(nodes, links);
  const { endId } = terminalIds(nodes);

  // If end isn't reachable via links, place it one layer past the deepest node.
  const maxReachable = depths.size > 0 ? Math.max(...depths.values()) : 0;
  if (endId && !depths.has(endId)) {
    depths.set(endId, maxReachable + 1);
  }

  const totalDepth = depths.size > 0 ? Math.max(...depths.values()) : 0;
  const depthCenter = (totalDepth * LAYER_SPACING) / 2;

  // Group node IDs by layer depth.
  const layers = new Map<number, string[]>();
  for (const node of nodes) {
    const d = depths.get(node.id) ?? 0;
    if (!layers.has(d)) layers.set(d, []);
    layers.get(d)!.push(node.id);
  }

  // Scale cross-axis spacing so the bounding box matches the target aspect ratio.
  const maxN = Math.max(...[...layers.values()].map(ids => ids.length), 1);
  const depthSpan = totalDepth * LAYER_SPACING;
  const targetAspect = orientation === 'horizontal' ? TARGET_ASPECT : 1 / TARGET_ASPECT;
  const crossSpacing = maxN <= 1
    ? NODE_V_SPACING
    : Math.max(MIN_V_SPACING, Math.min(NODE_V_SPACING, depthSpan / targetAspect / (maxN - 1)));

  const positions = new Map<string, { x: number; y: number }>();
  for (const [depth, ids] of layers) {
    const depthCoord = depth * LAYER_SPACING - depthCenter;
    const n = ids.length;
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

interface GraphBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** Bounding box from the layered layout, expanded for terminal labels and badges. */
function computeFitBounds(
  nodes: WikiNode[],
  links: WikiLink[],
  width: number,
  height: number,
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
    const r = nodeRadius(resolveVariant(node));
    xMin = Math.min(xMin, pos.x - r);
    xMax = Math.max(xMax, pos.x + r);
    yMin = Math.min(yMin, pos.y - r);
    yMax = Math.max(yMax, pos.y + r);
  }

  if (!isFinite(xMin)) return null;

  const nodeW = xMax - xMin;
  const nodeH = yMax - yMin;
  if (nodeW <= 0 || nodeH <= 0) return { xMin, xMax, yMin, yMax };

  // First-pass zoom from node positions, then inflate bounds for canvas overlays.
  const k = Math.min(
    (width - FIT_PADDING * 2) / nodeW,
    (height - FIT_PADDING * 2) / nodeH,
  );

  const labelExtent = LABEL_FONT_SIZE * 1.2 + LABEL_PAD_Y * 2 + SPACE_2 + SPACE_2;
  let labelHalfW = 0;
  let hasStart = false;
  let hasEnd = false;
  let hasNew = false;

  for (const node of nodes) {
    const variant = resolveVariant(node);
    if (variant === 'start') {
      hasStart = true;
      const text = nodeDisplayName(node);
      labelHalfW = Math.max(labelHalfW, (text.length * 6.5 + LABEL_PAD_X * 2) / 2);
    }
    if (variant === 'end') {
      hasEnd = true;
      const text = nodeDisplayName(node);
      labelHalfW = Math.max(labelHalfW, (text.length * 6.5 + LABEL_PAD_X * 2) / 2);
    }
    if (node.isNew) hasNew = true;
  }

  if (orientation === 'horizontal') {
    if (hasStart || hasEnd) yMin -= labelExtent / k;
  } else {
    if (hasStart) yMin -= labelExtent / k;
    if (hasEnd) yMax += labelExtent / k;
  }
  if (labelHalfW > 0) {
    xMin -= labelHalfW / k;
    xMax += labelHalfW / k;
  }
  if (hasNew) xMax += 40 / k;

  return { xMin, xMax, yMin, yMax };
}

function fitGraphView(
  fg: ForceGraphMethods<WikiNode, WikiLink>,
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

function linkKey(link: WikiLink): string {
  const { source, target } = linkEndpoints(link);
  return `${source}-${target}`;
}

function isLinkHighlighted(
  link: WikiLink,
  activeLink: { source: string; target: string } | null,
  activeNodeId: string | null,
): boolean {
  return (activeLink != null && linksEqual(link, activeLink))
    || (activeNodeId != null && linkTouchesNode(link, activeNodeId));
}

function positionHighlightedLink(
  el: SVGLineElement,
  link: WikiLink,
  fg: ForceGraphMethods<WikiNode, WikiLink>,
): void {
  const start = link.source as unknown as SimNode;
  const end = link.target as unknown as SimNode;
  if (start.x == null || start.y == null || end.x == null || end.y == null) {
    el.style.visibility = 'hidden';
    return;
  }
  const p1 = fg.graph2ScreenCoords(start.x, start.y);
  const p2 = fg.graph2ScreenCoords(end.x, end.y);
  el.setAttribute('x1', String(p1.x));
  el.setAttribute('y1', String(p1.y));
  el.setAttribute('x2', String(p2.x));
  el.setAttribute('y2', String(p2.y));
  el.style.visibility = 'visible';
}

function nodeDisplayName(node: WikiNode): string {
  return node.label ?? node.id;
}

function nodeRole(variant: WikiNodeVariant): 'start' | 'end' | 'intermediate' {
  if (variant === 'start') return 'start';
  if (variant === 'end') return 'end';
  return 'intermediate';
}

function wikiUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title).replace(/%20/g, '_')}`;
}

function deviceSupportsHover(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

function positionLabelLink(
  el: HTMLElement,
  layout: LabelLayout,
  fg: ForceGraphMethods<WikiNode, WikiLink>,
  globalScale: number,
): void {
  const center = fg.graph2ScreenCoords(layout.cx, layout.cy);
  const w = layout.boxW * globalScale;
  const h = layout.boxH * globalScale;
  el.style.left = `${center.x - w / 2}px`;
  el.style.top = `${center.y - h / 2}px`;
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
  el.style.visibility = 'visible';
}

interface LabelLayout {
  cx: number;
  cy: number;
  boxW: number;
  boxH: number;
}

function computeLabelLayout(
  node: SimNode,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  orientation: GraphOrientation,
): LabelLayout | null {
  if (node.x == null || node.y == null) return null;

  const variant = resolveVariant(node);
  const text = nodeDisplayName(node);
  const isTerminal = variant === 'start' || variant === 'end';
  const fontWeight = isTerminal ? 700 : 500;
  const fontSize = LABEL_FONT_SIZE / globalScale;
  const padY = LABEL_PAD_Y / globalScale;
  const padX = LABEL_PAD_X / globalScale;

  ctx.font = `${fontWeight} ${fontSize}px ${FONT_UI}`;
  const textW = ctx.measureText(text).width;
  const boxW = textW + padX * 2;
  const boxH = fontSize * 1.2 + padY * 2;

  const nodeR = Math.sqrt(nodeVal(variant)) * NODE_REL_SIZE;
  const gap = SPACE_2 / globalScale;
  const cx = node.x;
  const labelBelow = orientation === 'vertical' && variant === 'end';
  const cy = labelBelow
    ? node.y + nodeR + boxH / 2 + gap
    : node.y - nodeR - boxH / 2 - gap;

  return { cx, cy, boxW, boxH };
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


function drawLabel(
  node: SimNode,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  orientation: GraphOrientation,
  borderColor: string,
  bgColor: string,
  colors: CanvasColors,
): void {
  const variant = resolveVariant(node);
  const text = nodeDisplayName(node);
  const isTerminal = variant === 'start' || variant === 'end';
  const radius = (isTerminal ? RADIUS_MD : RADIUS_SM) / globalScale;
  const borderW = BORDER_STD / globalScale;
  const layout = computeLabelLayout(node, ctx, globalScale, orientation);
  if (!layout) return;

  const { cx, cy, boxW, boxH } = layout;
  const x = cx - boxW / 2;
  const y = cy - boxH / 2;

  ctx.beginPath();
  roundRect(ctx, x, y, boxW, boxH, radius);
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = borderW;
  ctx.stroke();

  ctx.fillStyle = colors.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy);
}

function drawHighlightedLabel(
  node: SimNode,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  orientation: GraphOrientation,
  colors: CanvasColors,
): void {
  drawLabel(node, ctx, globalScale, orientation, colors.terra, colors.terraPale, colors);
}

function drawTerminalLabel(
  node: SimNode,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  orientation: GraphOrientation,
  colors: CanvasColors,
): void {
  const borderColor = nodeFill(resolveVariant(node), colors);
  drawLabel(node, ctx, globalScale, orientation, borderColor, colors.white, colors);
}

const BADGE_FONT_SIZE = 9;
const BADGE_PAD_X     = 6;
const BADGE_PAD_Y     = 2;
const BADGE_RADIUS    = 6;

function drawBadge(
  node: SimNode,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  colors: CanvasColors,
): void {
  if (node.x == null || node.y == null) return;
  const variant = resolveVariant(node);
  const r        = Math.sqrt(nodeVal(variant)) * NODE_REL_SIZE;
  const fontSize = BADGE_FONT_SIZE / globalScale;
  const padX     = BADGE_PAD_X / globalScale;
  const padY     = BADGE_PAD_Y / globalScale;
  const gap      = SPACE_1 / globalScale;
  const bRadius  = BADGE_RADIUS / globalScale;
  const borderW  = 1 / globalScale;

  ctx.font = `700 ${fontSize}px ${FONT_UI}`;
  const text = '★ first';
  const textW = ctx.measureText(text).width;
  const boxW  = textW + padX * 2;
  const boxH  = fontSize * 1.6 + padY * 2;

  const x = node.x + r + gap;
  const y = node.y - boxH / 2;

  ctx.beginPath();
  roundRect(ctx, x, y, boxW, boxH, bRadius);
  ctx.fillStyle = colors.clayPale;
  ctx.fill();
  ctx.strokeStyle = colors.clayBorder;
  ctx.lineWidth = borderW;
  ctx.stroke();

  ctx.fillStyle = colors.clay;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + padX, node.y);
}

export function GraphWiki({ graphData }: { graphData: GraphData }) {
  const colors = useCanvasColors();
  const wrapperRef     = useRef<HTMLDivElement>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fgRef          = useRef<ForceGraphMethods<WikiNode, WikiLink>>();
  const labelLinkRefs       = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const hoverLabelRefs      = useRef<Map<string, HTMLDivElement>>(new Map());
  const linkLineRefs        = useRef<Map<string, SVGLineElement>>(new Map());
  const highlightedLabelRef = useRef<HTMLAnchorElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 440 });
  const [canHover, setCanHover] = useState(deviceSupportsHover);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<{ source: string; target: string } | null>(null);

  const orientation = graphOrientation(dims.width);

  const bfsDepths = useMemo(
    () => computeBfsDepths(graphData.nodes, graphData.links),
    [graphData],
  );

  const totalLayers = useMemo(
    () => (bfsDepths.size > 0 ? Math.max(...bfsDepths.values()) + 1 : 1),
    [bfsDepths],
  );

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

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setCanHover(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Set initial x/y without pinning — simulation starts from correct positions.
  const positionedData = useMemo(() => {
    const positions = computeLayeredPositions(graphData.nodes, graphData.links, orientation);
    setInitialPositions(graphData.nodes, positions);
    return graphData;
  }, [graphData, orientation]);

  const fitBounds = useMemo(
    () => computeFitBounds(positionedData.nodes, positionedData.links, dims.width, dims.height, orientation),
    [positionedData, dims, orientation],
  );

  const hoveredNeighborIds = useMemo(
    () => (hoveredNodeId ? neighborIds(hoveredNodeId, positionedData.links) : null),
    [hoveredNodeId, positionedData.links],
  );

  const newNodes = useMemo(
    () => positionedData.nodes.filter(n => n.isNew),
    [positionedData.nodes],
  );

  const terminalNodes = useMemo(
    () => positionedData.nodes.filter(n => resolveVariant(n) === 'start' || resolveVariant(n) === 'end'),
    [positionedData.nodes],
  );

  const highlightedInteriorNode = useMemo(() => {
    if (canHover || !hoveredNodeId) return null;
    const node = positionedData.nodes.find(n => n.id === hoveredNodeId);
    if (!node) return null;
    const variant = resolveVariant(node);
    return variant === 'start' || variant === 'end' ? null : node;
  }, [canHover, hoveredNodeId, positionedData.nodes]);

  const hoveredLabelNodes = useMemo(() => {
    if (!canHover) return [];
    const ids = new Set<string>();
    if (hoveredNodeId) {
      ids.add(hoveredNodeId);
      for (const id of neighborIds(hoveredNodeId, positionedData.links)) ids.add(id);
    }
    if (hoveredLink) {
      ids.add(hoveredLink.source);
      ids.add(hoveredLink.target);
    }
    return positionedData.nodes.filter(n => ids.has(n.id));
  }, [canHover, hoveredNodeId, hoveredLink, positionedData.nodes, positionedData.links]);

  const hoveredLinks = useMemo(
    () => canHover
      ? positionedData.links.filter(link => isLinkHighlighted(link, hoveredLink, hoveredNodeId))
      : [],
    [canHover, hoveredLink, hoveredNodeId, positionedData.links],
  );

  const handleRenderFramePost = useCallback(
    (ctx: CanvasRenderingContext2D, globalScale: number) => {
      const fg = fgRef.current;
      if (!fg) return;
      for (const node of newNodes) {
        drawBadge(node as SimNode, ctx, globalScale, colors);
      }
      for (const node of terminalNodes) {
        const sim = node as SimNode;
        const layout = computeLabelLayout(sim, ctx, globalScale, orientation);
        const el = labelLinkRefs.current.get(node.id);
        if (!layout || !el) continue;
        positionLabelLink(el, layout, fg, globalScale);
      }
      for (const link of hoveredLinks) {
        const el = linkLineRefs.current.get(linkKey(link));
        if (!el) continue;
        positionHighlightedLink(el, link, fg);
      }
      for (const node of hoveredLabelNodes) {
        const sim = node as SimNode;
        const layout = computeLabelLayout(sim, ctx, globalScale, orientation);
        const el = hoverLabelRefs.current.get(node.id);
        if (!layout || !el) continue;
        positionLabelLink(el, layout, fg, globalScale);
      }
      for (const id of hoverLabelRefs.current.keys()) {
        if (!hoveredLabelNodes.some(n => n.id === id)) {
          const el = hoverLabelRefs.current.get(id);
          if (el) el.style.visibility = 'hidden';
        }
      }
      const highlightedEl = highlightedLabelRef.current;
      if (highlightedInteriorNode && highlightedEl) {
        const layout = computeLabelLayout(
          highlightedInteriorNode as SimNode,
          ctx,
          globalScale,
          orientation,
        );
        if (layout) positionLabelLink(highlightedEl, layout, fg, globalScale);
      } else if (highlightedEl) {
        highlightedEl.style.visibility = 'hidden';
      }
    },
    [newNodes, terminalNodes, hoveredLinks, hoveredLabelNodes, orientation, highlightedInteriorNode, colors],
  );

  useEffect(() => {
    if (!fitBounds) return;

    let raf = 0;
    const fit = () => {
      const fg = fgRef.current;
      if (!fg) {
        raf = requestAnimationFrame(fit);
        return;
      }
      fitGraphView(fg, fitBounds, dims.width, dims.height, 0);
    };
    fit();
    return () => cancelAnimationFrame(raf);
  }, [fitBounds, dims]);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;

    const positions = computeLayeredPositions(positionedData.nodes, positionedData.links, orientation);

    // Springy link force — connects neighbors like rubber bands.
    fg.d3Force('link', forceLink<SimNode, WikiLink>()
      .id((n) => n.id)
      .strength(0.25)
      .distance(LAYER_SPACING),
    );

    // Light repulsion so nodes don't collapse onto each other.
    fg.d3Force('charge', forceManyBody<SimNode>().strength(-120));

    // Depth-axis anchor (stronger) keeps nodes locked to their BFS layer.
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
    <div ref={wrapperRef} className={styles.wrapper} style={{ cursor: canHover && hoveredNodeId ? 'pointer' : 'default' }}>
      <div className={styles.legend}>
        <div className={styles.legendTitle}>Legend</div>
        <div className={styles.legendRow}>
          <Badge variant="first" />
          First time found
        </div>
      </div>
      {canHover && (
        <svg className={styles.linkOverlay} aria-hidden="true">
          {hoveredLinks.map(link => (
            <line
              key={linkKey(link)}
              className={styles.highlightedLink}
              ref={(el) => {
                const key = linkKey(link);
                if (el) linkLineRefs.current.set(key, el);
                else linkLineRefs.current.delete(key);
              }}
            />
          ))}
        </svg>
      )}
      <div className={styles.labelOverlay}>
        {terminalNodes.map(node => {
          const title = nodeDisplayName(node);
          const variant = resolveVariant(node);
          return (
            <a
              key={node.id}
              href={wikiUrl(title)}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.terminalLabelLink}
              aria-label={`Open ${title} on Wikipedia`}
              onClick={() => trackGraphNodeNavigated({
                article_name: title,
                node_role: nodeRole(variant),
                layer_index: bfsDepths.get(node.id) ?? 0,
                total_layers: totalLayers,
              })}
              ref={(el) => {
                if (el) labelLinkRefs.current.set(node.id, el);
                else labelLinkRefs.current.delete(node.id);
              }}
            />
          );
        })}
        {highlightedInteriorNode && (
          <a
            href={wikiUrl(nodeDisplayName(highlightedInteriorNode))}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.terminalLabelLink}
            aria-label={`Open ${nodeDisplayName(highlightedInteriorNode)} on Wikipedia`}
            onClick={() => trackGraphNodeNavigated({
              article_name: nodeDisplayName(highlightedInteriorNode),
              node_role: nodeRole(resolveVariant(highlightedInteriorNode)),
              layer_index: bfsDepths.get(highlightedInteriorNode.id) ?? 0,
              total_layers: totalLayers,
            })}
            ref={highlightedLabelRef}
          />
        )}
        {hoveredLabelNodes.map(node => (
          <div
            key={node.id}
            className={styles.hoverLabel}
            aria-hidden="true"
            ref={(el) => {
              if (el) hoverLabelRefs.current.set(node.id, el);
              else hoverLabelRefs.current.delete(node.id);
            }}
          >
            {nodeDisplayName(node)}
          </div>
        ))}
      </div>
      <ForceGraph2D
        ref={fgRef}
        width={dims.width}
        height={dims.height}
        backgroundColor={colors.white}
        nodeId="id"
        nodeLabel=""
        nodeAutoColorBy={null}
        nodeColor={(n) => nodeFill(resolveVariant(n), colors)}
        nodeVal={(n) => nodeVal(resolveVariant(n))}
        graphData={positionedData}
        nodeRelSize={NODE_REL_SIZE}
        linkColor={() => 'transparent'}
        linkWidth={BORDER_STD}
        linkCanvasObjectMode={() => 'replace'}
        linkCanvasObject={(link, ctx, globalScale) => {
          const start = link.source as SimNode;
          const end = link.target as SimNode;
          if (start.x == null || start.y == null || end.x == null || end.y == null) return;

          const touchHighlight =
            !canHover && isLinkHighlighted(link, hoveredLink, hoveredNodeId);

          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.strokeStyle = touchHighlight ? colors.ink : colors.graphLink;
          ctx.lineWidth = BORDER_STD / globalScale;
          ctx.stroke();
        }}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const variant = resolveVariant(node);
          const r = Math.sqrt(nodeVal(variant)) * NODE_REL_SIZE;
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI);
          ctx.strokeStyle = colors.ink;
          ctx.lineWidth = BORDER_STD / globalScale;
          ctx.stroke();

          const isHovered =
            hoveredNodeId === node.id
            || hoveredNeighborIds?.has(node.id)
            || (hoveredLink && (node.id === hoveredLink.source || node.id === hoveredLink.target));
          const isTerminal = variant === 'start' || variant === 'end';

          if (isHovered && !canHover) {
            drawHighlightedLabel(node as SimNode, ctx, globalScale, orientation, colors);
          } else if (isTerminal && !(canHover && isHovered)) {
            drawTerminalLabel(node as SimNode, ctx, globalScale, orientation, colors);
          }
        }}
        nodeCanvasObjectMode={(node) => {
          const variant = resolveVariant(node);
          const isTerminal = variant === 'start' || variant === 'end';
          return isTerminal
            || hoveredNodeId === node.id
            || (hoveredNeighborIds?.has(node.id))
            || (hoveredLink && (node.id === hoveredLink.source || node.id === hoveredLink.target))
              ? 'after'
              : undefined;
        }}
        onNodeClick={(node) => {
          const variant = resolveVariant(node);
          const props = {
            article_name: nodeDisplayName(node),
            node_role: nodeRole(variant),
            layer_index: bfsDepths.get(node.id) ?? 0,
            total_layers: totalLayers,
          };
          if (!canHover) {
            trackGraphNodeHighlighted(props);
            setHoveredNodeId(node.id);
            setHoveredLink(null);
            return;
          }
          trackGraphNodeNavigated(props);
          window.open(wikiUrl(nodeDisplayName(node)), '_blank', 'noopener,noreferrer');
        }}
        onBackgroundClick={() => {
          if (!canHover) {
            setHoveredNodeId(null);
            setHoveredLink(null);
          }
        }}
        onNodeHover={(node) => {
          if (!canHover) return;
          setHoveredNodeId(node?.id ?? null);
          if (highlightTimer.current) clearTimeout(highlightTimer.current);
          if (node) {
            setHoveredLink(null);
            const variant = resolveVariant(node);
            highlightTimer.current = setTimeout(() => {
              trackGraphNodeHighlighted({
                article_name: nodeDisplayName(node),
                node_role: nodeRole(variant),
                layer_index: bfsDepths.get(node.id) ?? 0,
                total_layers: totalLayers,
              });
            }, 1000);
          }
        }}
        onLinkHover={(link) => {
          if (!canHover) return;
          setHoveredLink(link ? linkEndpoints(link) : null);
          if (link) setHoveredNodeId(null);
        }}
        onRenderFramePost={handleRenderFramePost}
        d3AlphaDecay={0.015}
        d3VelocityDecay={0.2}
        autoPauseRedraw
      />
    </div>
  );
}
