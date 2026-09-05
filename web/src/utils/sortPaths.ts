import type { PathData } from '../components/ShortestPaths/ShortestPaths';

export type SortOrder = 'interesting' | 'least-interesting' | 'alpha';

const newArticleCount = (path: PathData) =>
  path.crumbs.filter((crumb) => crumb.hitCount === 1).length;

const intermediateLabels = (path: PathData) =>
  path.crumbs.slice(1, -1).map((crumb) => crumb.label);

const compareAlpha = (a: PathData, b: PathData) => {
  const aLabels = intermediateLabels(a);
  const bLabels = intermediateLabels(b);
  const len = Math.max(aLabels.length, bLabels.length);
  for (let i = 0; i < len; i += 1) {
    const cmp = (aLabels[i] ?? '').localeCompare(bLabels[i] ?? '');
    if (cmp !== 0) return cmp;
  }
  return 0;
};

export function sortPaths(paths: PathData[], sortOrder: SortOrder): PathData[] {
  return [...paths].sort((a, b) => {
    if (sortOrder === 'alpha') return compareAlpha(a, b);
    const diff = newArticleCount(a) - newArticleCount(b);
    return sortOrder === 'least-interesting' ? diff : -diff;
  });
}
