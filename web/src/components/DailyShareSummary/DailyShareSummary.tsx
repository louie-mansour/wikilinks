import { useState } from 'react';
import { Button } from '../Button/Button';
import styles from './DailyShareSummary.module.css';

interface DailyShareSummaryProps {
  summary: string;
}

/** Copyable text summary of a solved daily puzzle, following the ShareBar pattern. */
export function DailyShareSummary({ summary }: DailyShareSummaryProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard?.writeText(summary).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={styles.bar}>
      <div className={styles.textRow}>
        <span className={styles.label}>Share</span>
        <span className={styles.summary}>{summary}</span>
      </div>
      <Button variant="permalink" onClick={handleCopy} className={copied ? styles.copied : ''}>
        {copied ? 'Copied!' : 'Copy result'}
      </Button>
    </div>
  );
}
