import { useState, useCallback } from 'react';
import { Header } from './components/Header/Header';
import { Graph } from './components/Graph/Graph';
import { BentoBox } from './components/BentoBox/BentoBox';
import { RecordsSection } from './components/RecordsSection/RecordsSection';
import { ShareBar } from './components/ShareBar/ShareBar';
import { ShortestPaths } from './components/ShortestPaths/ShortestPaths';
import { SUGGESTIONS } from './data/suggestions';
import { runMockSearch, formatSearchTime, formatNumber, type SearchResult } from './data/mockSearch';
import styles from './App.module.css';

const SORT_OPTIONS = [
  { value: 'interesting', label: 'Sort: most interesting' },
  { value: 'alpha', label: 'Sort: alphabetical' },
  { value: 'hops', label: 'Sort: fewest hops' },
];

const PAGE_SIZE = 5;

const DEFAULT_START = 'Albert Einstein';
const DEFAULT_END = 'Quantum mechanics';

export function App() {
  const [startArticle, setStartArticle] = useState(DEFAULT_START);
  const [endArticle, setEndArticle] = useState(DEFAULT_END);
  const [result, setResult] = useState<SearchResult | null>(
    () => runMockSearch(DEFAULT_START, DEFAULT_END),
  );
  const [sortOrder, setSortOrder] = useState('interesting');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const handleSearch = useCallback(() => {
    if (!startArticle.trim() || !endArticle.trim()) return;
    setResult(runMockSearch(startArticle.trim(), endArticle.trim()));
    setVisibleCount(PAGE_SIZE);
    setSortOrder('interesting');
  }, [startArticle, endArticle]);

  const sortedPaths = result
    ? [...result.paths].sort((a, b) => {
        if (sortOrder === 'alpha') {
          const aLabel = a.crumbs[1]?.label ?? '';
          const bLabel = b.crumbs[1]?.label ?? '';
          return aLabel.localeCompare(bLabel);
        }
        if (sortOrder === 'hops') return a.crumbs.length - b.crumbs.length;
        return 0; // 'interesting' = original order
      })
    : [];

  const visiblePaths = sortedPaths.slice(0, visibleCount);
  const remainingCount = sortedPaths.length - visibleCount;

  return (
    <div className={styles.page}>
      <Header
        startSuggestions={SUGGESTIONS}
        endSuggestions={SUGGESTIONS}
        startDefaultValue={DEFAULT_START}
        endDefaultValue={DEFAULT_END}
        onStartSelect={setStartArticle}
        onEndSelect={setEndArticle}
        onSearch={handleSearch}
      />

      {result ? (
        <div className={styles.sections} key={`${result.start}|${result.end}`}>
          <Graph
            nodes={result.graphNodes}
            edges={result.graphEdges}
          />

          <BentoBox
            pathsFound={formatNumber(result.pathsFound)}
            pathsSub={`${result.minHops} hops each — shortest possible`}
            minHops={result.minHops}
            hopsNote="fewest possible"
            nodesExplored={formatNumber(result.nodesExplored)}
            searchTime={formatSearchTime(result.searchTimeMs)}
            uniqueArticles={result.uniqueArticles}
          />

          <RecordsSection periods={result.records} />

          <ShareBar
            urlPrefix="wikilinks.app/s/"
            urlCode={result.shareCode}
          />

          <ShortestPaths
            title={`${formatNumber(result.pathsFound)} shortest path${result.pathsFound !== 1 ? 's' : ''} — ${result.minHops} hop${result.minHops !== 1 ? 's' : ''} each`}
            paths={visiblePaths}
            sortOptions={SORT_OPTIONS}
            sortValue={sortOrder}
            onSortChange={(val) => { setSortOrder(val); setVisibleCount(PAGE_SIZE); }}
            remainingCount={remainingCount > 0 ? remainingCount : undefined}
            onLoadMore={() => setVisibleCount((c) => c + PAGE_SIZE)}
          />
        </div>
      ) : (
        <div className={styles.empty}>
          <p className={styles.emptyHint}>Enter two articles and click Find paths to get started.</p>
        </div>
      )}
    </div>
  );
}
