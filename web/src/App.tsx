import { useState, useCallback } from 'react';
import { Header } from './components/Header/Header';
import { GraphWiki } from './components/GraphWiki/GraphWiki';
import { BentoBox } from './components/BentoBox/BentoBox';
import { RecordsSection } from './components/RecordsSection/RecordsSection';
import { ShareBar } from './components/ShareBar/ShareBar';
import { ShortestPaths } from './components/ShortestPaths/ShortestPaths';
import { EmptyState } from './components/EmptyState/EmptyState';
import { LoadingState } from './components/LoadingState/LoadingState';
import {
  resolveSearchArticles,
  animateRoulette,
} from './data/suggestions';
import { useDebouncedSuggestions } from './hooks/useDebouncedSuggestions';
import { searchPaths, formatSearchTime, formatNumber, type SearchResult } from './data/mockSearch';
import styles from './App.module.css';

const SORT_OPTIONS = [
  { value: 'interesting', label: 'Sort: most interesting' },
  { value: 'alpha', label: 'Sort: alphabetical' },
  { value: 'hops', label: 'Sort: fewest hops' },
];

const PAGE_SIZE = 5;

export function App() {
  const [startArticle, setStartArticle] = useState('');
  const [endArticle, setEndArticle] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [isRouletting, setIsRouletting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [sortOrder, setSortOrder] = useState('interesting');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const startSuggestions = useDebouncedSuggestions('start', startArticle);
  const endSuggestions = useDebouncedSuggestions('end', endArticle);

  const handleSearch = useCallback(async () => {
    if (isRouletting || isSearching) return;

    const needsStartRandom = !startArticle.trim();
    const needsEndRandom = !endArticle.trim();
    const { start, end } = resolveSearchArticles(startArticle, endArticle);

    try {
      const rouletteTasks: Promise<void>[] = [];
      if (needsStartRandom) {
        rouletteTasks.push(animateRoulette(start, setStartArticle));
      } else {
        setStartArticle(start);
      }
      if (needsEndRandom) {
        rouletteTasks.push(animateRoulette(end, setEndArticle));
      } else {
        setEndArticle(end);
      }

      if (rouletteTasks.length > 0) {
        setIsRouletting(true);
        await Promise.all(rouletteTasks);
        setIsRouletting(false);
      }

      setIsSearching(true);
      const data = await searchPaths(start, end);
      setResult(data);
      setVisibleCount(PAGE_SIZE);
      setSortOrder('interesting');
    } finally {
      setIsRouletting(false);
      setIsSearching(false);
    }
  }, [startArticle, endArticle, isRouletting, isSearching]);

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
      <div className={styles.pageHeader}>
        <Header
          startSuggestions={startSuggestions.suggestions}
          endSuggestions={endSuggestions.suggestions}
          startSuggestionsLoading={startSuggestions.isLoading}
          endSuggestionsLoading={endSuggestions.isLoading}
          startValue={startArticle}
          endValue={endArticle}
          onStartSelect={setStartArticle}
          onEndSelect={setEndArticle}
          onStartChange={setStartArticle}
          onEndChange={setEndArticle}
          onSearch={handleSearch}
          isSearching={isRouletting || isSearching}
          searchLabel={
            isRouletting
              ? 'Picking articles…'
              : isSearching
                ? 'Finding paths…'
                : 'Find paths'
          }
        />
      </div>

      {isRouletting || isSearching ? (
        <LoadingState phase={isRouletting ? 'articles' : 'paths'} />
      ) : result ? (
        <div className={styles.sections} key={`${result.start}|${result.end}`}>
          <GraphWiki graphData={result.graphData} />

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
        <EmptyState />
      )}
    </div>
  );
}
