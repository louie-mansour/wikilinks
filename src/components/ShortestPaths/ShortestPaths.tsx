import { PathItem, type Crumb } from '../PathItem/PathItem';
import { SortSelect } from '../SortSelect/SortSelect';
import { Button } from '../Button/Button';
import styles from './ShortestPaths.module.css';

export interface PathData {
  id: string | number;
  crumbs: Crumb[];
}

interface ShortestPathsProps {
  title: string;
  paths: PathData[];
  sortOptions: Array<{ value: string; label: string }>;
  maxOptions: Array<{ value: string; label: string }>;
  sortValue?: string;
  maxValue?: string;
  onSortChange?: (value: string) => void;
  onMaxChange?: (value: string) => void;
  remainingCount?: number;
  onLoadMore?: () => void;
}

export function ShortestPaths({
  title,
  paths,
  sortOptions,
  maxOptions,
  sortValue,
  maxValue,
  onSortChange,
  onMaxChange,
  remainingCount,
  onLoadMore,
}: ShortestPathsProps) {
  return (
    <section className={styles.section} aria-label="Shortest paths">
      <div className={styles.listHeader}>
        <h2 className={styles.title}>{title}</h2>
        <div className={styles.controls}>
          <SortSelect
            label="Sort order"
            options={sortOptions}
            value={sortValue}
            onChange={onSortChange}
          />
          <SortSelect
            label="Max paths"
            options={maxOptions}
            value={maxValue}
            onChange={onMaxChange}
          />
        </div>
      </div>

      {paths.map((path, i) => (
        <PathItem
          key={path.id}
          number={i + 1}
          crumbs={path.crumbs}
        />
      ))}

      {remainingCount != null && remainingCount > 0 && (
        <div className={styles.loadMore}>
          <Button variant="secondary" onClick={onLoadMore}>
            Load {remainingCount} more paths
          </Button>
        </div>
      )}
    </section>
  );
}
