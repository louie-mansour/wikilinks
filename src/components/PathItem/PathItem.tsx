import { Badge } from '../Badge/Badge';
import { Button } from '../Button/Button';
import styles from './PathItem.module.css';

export interface Crumb {
  href: string;
  label: string;
  highlighted?: boolean;
  tag?: 'new' | 'rare' | 'uncommon';
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
              <span className={styles.sep} aria-hidden="true">›</span>
            )}
            <a
              href={crumb.href}
              className={`${styles.crumb} ${crumb.highlighted ? styles.crumbHl : ''}`}
            >
              {crumb.label}
              {crumb.tag && (
                <Badge variant={crumb.tag} />
              )}
            </a>
          </span>
        ))}
      </div>

      <div className={styles.actions}>
        <Button variant="action" onClick={onCopy}>Copy</Button>
        <Button variant="action" onClick={onLink}>Link ↗</Button>
      </div>
    </article>
  );
}
