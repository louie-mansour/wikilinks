import { Badge } from '../Badge/Badge';
import styles from './PathItem.module.css';
import { trackArticleLinkClicked } from '../../analytics';

export interface Crumb {
  href: string;
  label: string;
  highlighted?: boolean;
  hitCount: number;
}

interface PathItemProps {
  number: number;
  crumbs: Crumb[];
}

export function PathItem({ number, crumbs }: PathItemProps) {
  const pathTitles = crumbs.map((c) => c.label);

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
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.crumb} ${crumb.highlighted ? styles.crumbHl : ''}`}
              onClick={() => trackArticleLinkClicked({ article_title: crumb.label, hop_index: i, path_titles: pathTitles })}
            >
              {crumb.label}
              {crumb.hitCount === 1 && (
                <Badge variant="first" />
              )}
            </a>
          </span>
        ))}
      </div>
    </article>
  );
}
