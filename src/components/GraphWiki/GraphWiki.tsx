import { useRef, useEffect, useState } from 'react';
import { forceX, forceY } from 'd3-force-3d';
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

export type WikiNodeVariant = 'default' | 'start' | 'end' | 'path';

export interface WikiNode {
  id: string;
  variant?: WikiNodeVariant;
}

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

/** BFS hop depth from the start node along directed links. */
function computeBfsDepths(nodes: WikiNode[], links: WikiLink[]): Map<string, number> {
  const depths = new Map<string, number>();
  const startId = nodes.find(n => n.variant === 'start')?.id ?? nodes[0]?.id;
  if (!startId) return depths;

  const queue = [startId];
  depths.set(startId, 0);

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

    const depths = computeBfsDepths(graphData.nodes, graphData.links);
    const maxDepth = Math.max(0, ...depths.values());
    const xCenter = (maxDepth * LAYER_SPACING) / 2;

    fg.d3Force('center', null);
    fg.d3Force(
      'x',
      forceX((node: WikiNode) =>
        (depths.get(node.id) ?? 0) * LAYER_SPACING - xCenter,
      ).strength(SOFT_LAYER_STRENGTH),
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
