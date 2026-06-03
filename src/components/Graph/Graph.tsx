import styles from './Graph.module.css';

export type NodeVariant = 'default' | 'start' | 'end' | 'active';
export type NodeRarity = 'first' | 'rare' | 'uncommon' | null;

export interface GraphNode {
  id: string;
  label: string;
  /** percentage-based position within the graph canvas */
  top: number;
  left: number;
  variant?: NodeVariant;
  rarity?: NodeRarity;
}

export interface GraphEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  active?: boolean;
}

export interface GraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFit?: () => void;
  className?: string;
}

export function Graph({ nodes, edges, onZoomIn, onZoomOut, onFit, className = '' }: GraphProps) {
  return (
    <section
      className={`${styles.graphSection} ${className}`}
      aria-label="Path visualization"
    >
      {/* SVG edge layer */}
      <svg className={styles.graphSvg} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        {edges.map((edge, i) => (
          <line
            key={i}
            x1={`${edge.x1}%`}
            y1={`${edge.y1}%`}
            x2={`${edge.x2}%`}
            y2={`${edge.y2}%`}
            className={edge.active ? styles.edgeActive : styles.edgeDim}
            strokeWidth={edge.active ? 2.5 : 1.5}
          />
        ))}
      </svg>

      {/* Nodes */}
      {nodes.map((node) => (
        <div
          key={node.id}
          className={[
            styles.node,
            node.variant && styles[node.variant],
            node.rarity && styles[`glow-${node.rarity}`],
          ].filter(Boolean).join(' ')}
          style={{ top: `${node.top}%`, left: `${node.left}%` }}
        >
          {node.label}
          {node.rarity && (
            <span className={`${styles.nodeTag} ${styles[`tag-${node.rarity}`]}`}>
              {node.rarity}
            </span>
          )}
        </div>
      ))}

      {/* Legend */}
      <div className={styles.legend}>
        <div className={styles.legendTitle}>Node rarity</div>
        <div className={styles.legendRow}>
          <span className={`${styles.legendDot} ${styles.legendDotFirst}`} />
          First discovered
        </div>
        <div className={styles.legendRow}>
          <span className={`${styles.legendDot} ${styles.legendDotRare}`} />
          Rare path
        </div>
        <div className={styles.legendRow}>
          <span className={`${styles.legendDot} ${styles.legendDotUncommon}`} />
          Uncommon
        </div>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <button className={styles.ctrlBtn} aria-label="Zoom in" onClick={onZoomIn}>+</button>
        <button className={styles.ctrlBtn} aria-label="Zoom out" onClick={onZoomOut}>−</button>
        <button className={`${styles.ctrlBtn} ${styles.ctrlBtnFit}`} aria-label="Fit" onClick={onFit}>fit</button>
      </div>
    </section>
  );
}
