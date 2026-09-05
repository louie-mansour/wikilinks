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
const METRIC_ORDER = ['Most paths', 'Most articles', 'Longest path'];

function toTitleCase(text: string): string {
  return text.replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());
}

function sortPeriods(periods: RecordPeriod[]): RecordPeriod[] {
  const rank = new Map(PERIOD_ORDER.map((period, index) => [period, index]));
  return [...periods].sort((a, b) => {
    const aRank = rank.get(a.period) ?? PERIOD_ORDER.length;
    const bRank = rank.get(b.period) ?? PERIOD_ORDER.length;
    return aRank - bRank;
  });
}

/** Transpose period->rows(metric) into metric->rows(period), so columns become metrics and rows become periods. */
function transposeToMetricColumns(periods: RecordPeriod[]): RecordPeriod[] {
  const orderedPeriods = sortPeriods(periods);
  const metricRank = new Map(METRIC_ORDER.map((metric, index) => [metric, index]));
  const metricOrder: string[] = [];
  for (const p of orderedPeriods) {
    for (const row of p.rows) {
      if (!metricOrder.includes(row.key)) metricOrder.push(row.key);
    }
  }
  metricOrder.sort((a, b) => (metricRank.get(a) ?? METRIC_ORDER.length) - (metricRank.get(b) ?? METRIC_ORDER.length));

  return metricOrder.map((metricKey) => ({
    period: metricKey,
    rows: orderedPeriods.map((p) => {
      const row = p.rows.find((r) => r.key === metricKey);
      return {
        key: p.period,
        value: row?.value ?? '',
        badge: row?.badge,
      };
    }),
  }));
}

export function RecordsSection({ periods }: RecordsSectionProps) {
  const columns = transposeToMetricColumns(periods);

  return (
    <div className={styles.section} role="region" aria-label="Worldwide leaderboard">
      <div className={styles.header}>Worldwide Leaderboard</div>
      <div className={styles.cols}>
        {columns.map((col) => (
          <div key={col.period} className={styles.col}>
            <div className={styles.period}>{toTitleCase(col.period)}</div>
            {col.rows.map((row) => (
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
