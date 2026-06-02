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

export function RecordsSection({ periods }: RecordsSectionProps) {
  return (
    <div className={styles.section} role="region" aria-label="Records">
      <div className={styles.header}>Records — this pair</div>
      <div className={styles.cols}>
        {periods.map((p) => (
          <div key={p.period} className={styles.col}>
            <div className={styles.period}>{p.period}</div>
            {p.rows.map((row) => (
              <div key={row.key} className={styles.row}>
                <span className={styles.key}>{row.key}</span>
                <span className={styles.val}>
                  {row.value}
                  {row.badge && <Badge variant="record" />}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
