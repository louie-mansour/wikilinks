import styles from './EmptyState.module.css';

const DEFAULT_HINT =
  "Enter two articles, or leave blank and click Find paths — we'll pick a pair at random.";

interface EmptyStateProps {
  hint?: string;
  className?: string;
}

export function EmptyState({ hint = DEFAULT_HINT, className = '' }: EmptyStateProps) {
  return (
    <div className={`${styles.root} ${className}`}>
      <p className={styles.hint}>{hint}</p>
    </div>
  );
}
