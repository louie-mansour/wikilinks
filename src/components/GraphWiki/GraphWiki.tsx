import { useRef, useEffect, useState, useCallback, MutableRefObject } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import styles from './GraphWiki.module.css';

// Design-system token values as constants.
// Canvas can't read CSS custom properties, so we inline the hex values here.
const C = {
  bg:          '#fefcf8',   // --white
  nodeDefault: '#e8d9c4',   // --sand-mid
  nodePath:    '#c4572a',   // --terra
  nodeStart:   '#2c2416',   // --ink
  nodeEnd:     '#7a6a52',   // --ink-muted
  linkDefault: '#d4c0a4',   // --sand-dark
} as const;

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

export interface GraphWikiProps {
  graphData: GraphData;
}

export function GraphWiki({ graphData }: GraphWikiProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<{ d3Force: (n: string) => { strength: (s: number) => void }; zoomToFit: (ms: number, px: number) => void } | null>(null);
  const [dims, setDims] = useState({ width: 800, height: 560 });

  // Track container size so the canvas fills the wrapper exactly.
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

  // Custom canvas painter: filled circles, no labels.
  const paintNode = useCallback(
    (node: WikiNode, ctx: CanvasRenderingContext2D) => {
      const isLarge = node.variant === 'start' || node.variant === 'end';
      const r = isLarge ? 6 : 4;
      const x = (node as { x?: number }).x ?? 0;
      const y = (node as { y?: number }).y ?? 0;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);

      if (node.variant === 'end') {
        ctx.fillStyle = C.bg;
        ctx.fill();
        ctx.strokeStyle = C.nodeEnd;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.fillStyle =
          node.variant === 'start' ? C.nodeStart :
          node.variant === 'path'  ? C.nodePath  :
                                     C.nodeDefault;
        ctx.fill();
      }
    },
    [],
  );

  // Zoom to fit smoothly once the simulation has settled.
  const onEngineStop = useCallback(() => {
    fgRef.current?.zoomToFit(400, 40);
  }, []);

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <ForceGraph2D
        ref={fgRef as MutableRefObject<never>}
        graphData={graphData as never}
        width={dims.width}
        height={dims.height}
        backgroundColor={C.bg}
        // Nodes
        nodeLabel=""
        nodeCanvasObject={paintNode as never}
        nodeCanvasObjectMode={() => 'replace'}
        nodeVal={(n: WikiNode) => (n.variant === 'start' || n.variant === 'end' ? 2.25 : 1)}
        nodeRelSize={4}
        // Links
        linkColor={() => C.linkDefault}
        linkWidth={() => 1}
        // Layer nodes by hop-distance: same distance from start = same column
        dagMode="lr"
        dagLevelDistance={110}
        // Physics — settle y-positions within each layer before first paint
        warmupTicks={300}
        cooldownTicks={100}
        d3AlphaDecay={0.03}
        d3VelocityDecay={0.4}
        onEngineStop={onEngineStop}
        // Stop re-drawing once the simulation has settled (saves CPU)
        autoPauseRedraw
      />
    </div>
  );
}
