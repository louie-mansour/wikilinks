import styles from './BentoBox.module.css';

export interface BentoBoxProps {
  pathsFound: number | string;
  pathsSub?: string;
  minHops: number | string;
  hopsNote?: string;
  nodesExplored: number | string;
  searchTime: string;
  uniqueArticles: number | string;
  className?: string;
}

export function BentoBox({
  pathsFound,
  pathsSub,
  minHops,
  hopsNote,
  nodesExplored,
  searchTime,
  uniqueArticles,
  className = '',
}: BentoBoxProps) {
  return (
    <section
      className={`${styles.bentoGrid} ${className}`}
      role="region"
      aria-label="Search statistics"
    >
      {/* Card 1 — Paths Found (large, sage) */}
      <article className={`${styles.bentoCard} ${styles.cardPaths}`}>
        <span className={styles.statLabel}>Paths found</span>
        <span className={styles.statPaths}>{pathsFound}</span>
        {pathsSub && (
          <span className={styles.statSub}>{pathsSub}</span>
        )}
      </article>

      {/* Card 2 — Min Hops (terra) */}
      <article className={`${styles.bentoCard} ${styles.cardHops}`}>
        <span className={styles.statLabel}>Min hops</span>
        <span className={styles.statHops}>{minHops}</span>
        {hopsNote && (
          <span className={styles.statNote}>{hopsNote}</span>
        )}
      </article>

      {/* Card 3 — Nodes Explored (sand) */}
      <article className={`${styles.bentoCard} ${styles.cardNodes}`}>
        <span className={styles.statLabel}>Nodes explored</span>
        <span className={styles.statNodes}>{nodesExplored}</span>
      </article>

      {/* Card 4 — Search Time (clay) */}
      <article className={`${styles.bentoCard} ${styles.cardTime}`}>
        <span className={styles.statLabel}>Search time</span>
        <span className={styles.statTime}>{searchTime}</span>
      </article>

      {/* Card 5 — Unique Articles (white) */}
      <article className={`${styles.bentoCard} ${styles.cardArticles}`}>
        <span className={styles.statLabel}>Unique articles</span>
        <span className={styles.statArticles}>{uniqueArticles}</span>
      </article>
    </section>
  );
}
