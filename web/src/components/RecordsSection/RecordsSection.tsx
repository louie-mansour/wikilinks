import { Badge } from '../Badge/Badge';
import styles from './RecordsSection.module.css';

export interface RecordRow {
  key: string;
  value: string;
  badge?: boolean;
}

export interface RecordPeriod {
  period: string;
  rows: RecordRow[];
}

interface RecordsSectionProps {
  periods: RecordPeriod[];
}

const PERIOD_ORDER = ['Past day', 'Past week', 'All time'];

function sortPeriods(periods: RecordPeriod[]): RecordPeriod[] {
  const rank = new Map(PERIOD_ORDER.map((period, index) => [period, index]));
  return [...periods].sort((a, b) => {
    const aRank = rank.get(a.period) ?? PERIOD_ORDER.length;
    const bRank = rank.get(b.period) ?? PERIOD_ORDER.length;
    return aRank - bRank;
  });
}

export function RecordsSection({ periods }: RecordsSectionProps) {
  const orderedPeriods = sortPeriods(periods);

  return (
    <div className={styles.section} role="region" aria-label="Worldwide leaderboard">
      <div className={styles.header}>Worldwide leaderboard</div>
      <div className={styles.cols}>
        {orderedPeriods.map((p) => (
          <div key={p.period} className={styles.col}>
            <div className={styles.period}>{p.period}</div>
            {p.rows.map((row) => (
              <div key={row.key} className={styles.row}>
                <span className={styles.key}>{row.key}</span>
                <span className={styles.val}>
                  <span className={styles.badgeSlot}>
                    {row.badge && <Badge variant="record" />}
                  </span>
                  <span
                    className={`${styles.value} ${row.badge ? styles.valueRecord : ''}`}
                  >
                    {row.value}
                  </span>
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
