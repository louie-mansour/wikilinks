import { Badge } from '../Badge/Badge';
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
}

export function PathItem({ number, crumbs }: PathItemProps) {
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
    </article>
  );
}
