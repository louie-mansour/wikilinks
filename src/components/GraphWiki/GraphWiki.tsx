import { useRef, useEffect, useState } from 'react';
import { forceX } from 'd3-force-3d';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';
import styles from './GraphWiki.module.css';

// Canvas can't read CSS custom properties — mirror values from tokens.css.
const C = {
  white:    '#fefcf8',  // --white (canvas bg)
  sandDark: '#d4c0a4',  // --sand-dark (links)
  ink:      '#2c2416',  // --ink (start)
  sage:     '#4a7c59',  // --sage (end)
  terra:    '#c4572a',  // --terra (interior nodes)
} as const;

const SPACE_1 = 4;   // --space-1
const SPACE_2 = 6;   // --space-2
const SPACE_7 = 20;  // --space-7

const NODE_REL_SIZE = SPACE_1;
const BORDER_STD = 1.5;
const LAYER_SPACING = SPACE_7 * 10;
const FIT_PADDING = SPACE_7 * 2;
const SOFT_LAYER_STRENGTH = 0.2;
const TERMINAL_LINK_STRENGTH = 0.06;
const INTERIOR_LINK_STRENGTH = 0.35;
const TERMINAL_REPEL_STRENGTH = 80;

export type WikiNodeVariant = 'default' | 'start' | 'end' | 'path';

export interface WikiNode {
  id: string;
  variant?: WikiNodeVariant;
}

/** Force-graph mutates nodes with simulation coordinates at runtime. */
type SimNode = WikiNode & {
  fx?: number;
  fy?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
};

type ParsedLink = WikiLink & { source: WikiNode; target: WikiNode };

type D3Force = {
  (alpha: number): void;
  initialize?: (nodes: SimNode[]) => void;
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
    endId: nodes.find(n => resolveVariant(n) === 'end')?.id,
  };
}

/** BFS hop depth from the start node along directed links. */
function computeBfsDepths(
  nodes: WikiNode[],
  links: WikiLink[],
  originId?: string,
): Map<string, number> {
  const depths = new Map<string, number>();
  const rootId = originId ?? terminalIds(nodes).startId ?? nodes[0]?.id;
  if (!rootId) return depths;

  const queue = [rootId];
  depths.set(rootId, 0);

  while (queue.length > 0) {
    const id = queue.shift()!;
    const nextDepth = depths.get(id)! + 1;
    for (const { source, target } of links) {
      if (source === id && !depths.has(target)) {
        depths.set(target, nextDepth);
        queue.push(target);
      }
    }
  }

  return depths;
}

/** BFS hop depth from the end node along reverse directed links. */
function computeReverseBfsDepths(nodes: WikiNode[], links: WikiLink[]): Map<string, number> {
  const depths = new Map<string, number>();
  const { endId } = terminalIds(nodes);
  if (!endId) return depths;

  const queue = [endId];
  depths.set(endId, 0);

  while (queue.length > 0) {
    const id = queue.shift()!;
    const nextDepth = depths.get(id)! + 1;
    for (const { source, target } of links) {
      if (target === id && !depths.has(source)) {
        depths.set(source, nextDepth);
        queue.push(source);
      }
    }
  }

  return depths;
}

function terminalXPositions(
  nodes: WikiNode[],
  links: WikiLink[],
): {
  startX: number;
  endX: number;
  fromStart: Map<string, number>;
  fromEnd: Map<string, number>;
} {
  const fromStart = computeBfsDepths(nodes, links);
  const fromEnd = computeReverseBfsDepths(nodes, links);
  const { endId, startId } = terminalIds(nodes);

  if (endId && !fromStart.has(endId)) {
    fromStart.set(endId, Math.max(0, ...fromStart.values()) + 1);
  }
  if (startId && !fromEnd.has(startId)) {
    fromEnd.set(startId, Math.max(0, ...fromEnd.values()) + 1);
  }

  const maxDepth = Math.max(0, ...fromStart.values());
  const xCenter = (maxDepth * LAYER_SPACING) / 2;

  return {
    startX: -xCenter,
    endX: maxDepth * LAYER_SPACING - xCenter,
    fromStart,
    fromEnd,
  };
}

/** Layer x from equal weighting of hop distance to start and end. */
function symmetricLayerX(
  nodeId: string,
  fromStart: Map<string, number>,
  fromEnd: Map<string, number>,
  startX: number,
  endX: number,
): number {
  const ds = fromStart.get(nodeId);
  const de = fromEnd.get(nodeId);

  if (ds != null && de != null && ds + de > 0) {
    return startX + (ds / (ds + de)) * (endX - startX);
  }
  if (ds != null) {
    const maxD = Math.max(1, ...fromStart.values());
    return startX + (ds / maxD) * (endX - startX);
  }
  if (de != null) {
    const maxD = Math.max(1, ...fromEnd.values());
    return endX - (de / maxD) * (endX - startX);
  }

  return (startX + endX) / 2;
}

function linkTouchesTerminal(link: ParsedLink): boolean {
  const v1 = resolveVariant(link.source);
  const v2 = resolveVariant(link.target);
  return v1 === 'start' || v1 === 'end' || v2 === 'start' || v2 === 'end';
}

/** Push interior nodes away from start and end with equal strength. */
function forceTerminalRepel(strength: number): D3Force {
  let nodes: SimNode[] = [];

  function force(alpha: number) {
    const start = nodes.find(n => resolveVariant(n) === 'start');
    const end = nodes.find(n => resolveVariant(n) === 'end');
    if (!start || !end) return;

    const terminals = [start, end];
    for (const node of nodes) {
      const variant = resolveVariant(node);
      if (variant === 'start' || variant === 'end') continue;
      if (node.x == null || node.y == null) continue;

      for (const terminal of terminals) {
        const tx = terminal.fx ?? terminal.x ?? 0;
        const ty = terminal.y ?? 0;
        let dx = node.x - tx;
        let dy = node.y - ty;
        const dist = Math.hypot(dx, dy) || 1;
        const push = (strength * alpha) / dist;
        dx = (dx / dist) * push;
        dy = (dy / dist) * push;
        node.vx = (node.vx ?? 0) + dx;
        node.vy = (node.vy ?? 0) + dy;
      }
    }
  }

  force.initialize = (simNodes: SimNode[]) => { nodes = simNodes; };
  return force;
}

function pinTerminalNodes(
  nodes: WikiNode[],
  startX: number,
  endX: number,
): void {
  for (const node of nodes) {
    const sim = node as SimNode;
    const variant = resolveVariant(node);
    if (variant === 'start') {
      sim.fx = startX;
      delete sim.fy;
    } else if (variant === 'end') {
      sim.fx = endX;
      delete sim.fy;
    } else {
      delete sim.fx;
      delete sim.fy;
    }
  }
}

export function GraphWiki({ graphData }: { graphData: GraphData }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods<WikiNode, WikiLink>>();
  const [dims, setDims] = useState({ width: 800, height: 440 });
  const shouldAutoFitRef = useRef(true);

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
    shouldAutoFitRef.current = true;

    const fg = fgRef.current;
    if (!fg) return;

    const { startX, endX, fromStart, fromEnd } = terminalXPositions(
      graphData.nodes,
      graphData.links,
    );

    pinTerminalNodes(graphData.nodes, startX, endX);

    fg.d3Force('center', null);
    fg.d3Force(
      'x',
      forceX((node: WikiNode) =>
        symmetricLayerX(node.id, fromStart, fromEnd, startX, endX),
      ).strength((node: WikiNode) => {
        const variant = resolveVariant(node);
        return variant === 'start' || variant === 'end' ? 0 : SOFT_LAYER_STRENGTH;
      }),
    );
    fg.d3Force('terminalRepel', forceTerminalRepel(TERMINAL_REPEL_STRENGTH));

    const linkForce = fg.d3Force('link') as {
      strength?: (fn: (link: ParsedLink) => number) => unknown;
    } | undefined;
    linkForce?.strength?.((link) =>
      linkTouchesTerminal(link) ? TERMINAL_LINK_STRENGTH : INTERIOR_LINK_STRENGTH,
    );

    fg.d3ReheatSimulation();
  }, [graphData]);

  const stopAutoFit = () => { shouldAutoFitRef.current = false; };

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <ForceGraph2D
        ref={fgRef}
        width={dims.width}
        height={dims.height}
        backgroundColor={C.white}
        nodeId="id"
        nodeLabel=""
        // Must be set before graphData — force-graph's default nodeAutoColorBy ({})
        // assigns the same auto-palette color to every node missing a `color` field.
        nodeAutoColorBy={null}
        nodeColor={(n) => nodeFill(resolveVariant(n))}
        nodeVal={(n) => nodeVal(resolveVariant(n))}
        graphData={graphData}
        nodeRelSize={NODE_REL_SIZE}
        linkColor={C.sandDark}
        linkWidth={BORDER_STD}
        warmupTicks={300}
        cooldownTicks={100}
        d3AlphaDecay={0.03}
        d3VelocityDecay={0.4}
        onEngineStop={() => {
          if (!shouldAutoFitRef.current) return;
          shouldAutoFitRef.current = false;
          fgRef.current?.zoomToFit(400, FIT_PADDING);
        }}
        onNodeDrag={stopAutoFit}
        onZoom={stopAutoFit}
        autoPauseRedraw
      />
    </div>
  );
}
