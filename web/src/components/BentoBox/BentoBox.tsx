import styles from './BentoBox.module.css';

interface SmallStatCardProps {
  label: string;
  value: React.ReactNode;
  note?: string;
  cardClassName: string;
}

function SmallStatCard({ label, value, note, cardClassName }: SmallStatCardProps) {
  return (
    <article className={`${styles.bentoCard} ${styles.smallCard} ${cardClassName}`}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statSmallValue}>{value}</span>
      <span className={styles.statNote}>{note ?? ''}</span>
    </article>
  );
}

export interface BentoBoxProps {
  pathsFound: number | string;
  pathsSub?: string;
  minHops: number | string;
  hopsNote?: string;
  nodesExplored: number | string;
  nodesNote?: string;
  searchTime: string;
  timeNote?: string;
  uniqueArticles: number | string;
  articlesNote?: string;
  className?: string;
}

export function BentoBox({
  pathsFound,
  pathsSub,
  minHops,
  hopsNote,
  nodesExplored,
  nodesNote,
  searchTime,
  timeNote,
  uniqueArticles,
  articlesNote,
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
        {pathsSub && <span className={styles.statSub}>{pathsSub}</span>}
      </article>

      <SmallStatCard
        label="Min hops"
        value={minHops}
        note={hopsNote}
        cardClassName={styles.cardHops}
      />

      <SmallStatCard
        label="Nodes explored"
        value={nodesExplored}
        note={nodesNote}
        cardClassName={styles.cardNodes}
      />

      <SmallStatCard
        label="Search time"
        value={searchTime}
        note={timeNote}
        cardClassName={styles.cardTime}
      />

      <SmallStatCard
        label="Unique articles"
        value={uniqueArticles}
        note={articlesNote}
        cardClassName={styles.cardArticles}
      />
    </section>
  );
}
