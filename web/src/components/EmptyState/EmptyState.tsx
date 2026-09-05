import styles from './EmptyState.module.css';

const DEFAULT_HINT =
  "A graph will be shown  after your seach";

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
