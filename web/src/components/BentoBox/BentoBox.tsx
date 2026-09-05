import styles from './BentoBox.module.css';

interface SmallStatCardProps {
  label: string;
  value: React.ReactNode;
  cardClassName: string;
  subtext?: React.ReactNode;
}

function SmallStatCard({ label, value, cardClassName, subtext }: SmallStatCardProps) {
  return (
    <article className={`${styles.bentoCard} ${styles.smallCard} ${cardClassName}`}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statSmallValue}>{value}</span>
      {subtext ? <span className={styles.statSmallSub}>{subtext}</span> : null}
    </article>
  );
}

function isSingularPath(pathsFound: number | string): boolean {
  const count =
    typeof pathsFound === 'number'
      ? pathsFound
      : parseInt(String(pathsFound).replace(/,/g, ''), 10);
  return count === 1;
}

export interface BentoBoxProps {
  pathsFound: number | string;
  fromArticle: string;
  toArticle: string;
  minHops: number | string;
  searchTimeMs: number | string;
  pathArticles: number | string;
  firstArticles?: number;
  className?: string;
}

export function BentoBox({
  pathsFound,
  fromArticle,
  toArticle,
  minHops,
  searchTimeMs,
  pathArticles,
  firstArticles = 0,
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
        <span className={styles.statSub}>
          Shortest path{isSingularPath(pathsFound) ? '' : 's'} from{' '}
          <span className={styles.statSubArticle}>{fromArticle}</span> to{' '}
          <span className={styles.statSubArticle}>{toArticle}</span>
        </span>
      </article>

      <SmallStatCard
        label="Articles in paths"
        value={pathArticles}
        cardClassName={styles.cardArticles}
      />

      <SmallStatCard
        label="Search time"
        value={searchTimeMs}
        cardClassName={styles.cardNodes}
      />

      <SmallStatCard
        label="Shortest path"
        value={minHops}
        cardClassName={styles.cardHops}
      />

      <SmallStatCard
        label="New discoveries"
        value={firstArticles}
        cardClassName={styles.cardFirst}
        subtext={<>You're the <strong>first person</strong> to uncover these</>}
      />
    </section>
  );
}
