import { Badge } from '../Badge/Badge';
import { ActionButton } from '../ActionButton/ActionButton';
import styles from './PathItem.module.css';

export interface Crumb {
  href: string;
  label: string;
  highlighted?: boolean;
  tag?: 'first' | 'rare' | 'uncommon';
}

interface PathItemProps {
  number: number;
  crumbs: Crumb[];
  onCopy?: () => void;
  onLink?: () => void;
}

export function PathItem({ number, crumbs, onCopy, onLink }: PathItemProps) {
  return (
    <article className={styles.item}>
      <div className={styles.num}>#{number}</div>

      <div className={styles.crumbs}>
        {crumbs.map((crumb, i) => (
          <span key={i} className={styles.crumbGroup}>
            {i > 0 && (
              <>
                <span className={styles.sep} aria-hidden="true">›</span>
                <span className={styles.arrow} aria-hidden="true">↓</span>
              </>
            )}
            <a
              href={crumb.href}
              className={`${styles.crumb} ${crumb.highlighted ? styles.crumbHl : ''}`}
            >
              {crumb.label}
              {crumb.tag && (
                <Badge variant={crumb.tag}>{crumb.tag}</Badge>
              )}
            </a>
          </span>
        ))}
      </div>

      <div className={styles.actions}>
        <ActionButton onClick={onCopy}>Copy</ActionButton>
        <ActionButton onClick={onLink}>Link ↗</ActionButton>
      </div>
    </article>
  );
}
