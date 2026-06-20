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
  SUGGESTIONS,
  animateRoulette,
} from './data/suggestions';
import { fetchRandom } from './api/random';
import { useDebouncedSuggestions } from './hooks/useDebouncedSuggestions';
import { formatSearchTime, formatNumber, type SearchResult } from './data/mockSearch';
import { searchPaths } from './api/search';
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
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isRouletting, setIsRouletting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [sortOrder, setSortOrder] = useState('interesting');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const startSuggestions = useDebouncedSuggestions('start', startArticle);
  const endSuggestions = useDebouncedSuggestions('end', endArticle);

  const fallbackTitles = SUGGESTIONS.map((s) => s.title);

  const pickRandom = (pool: string[], exclude?: string): string => {
    const candidates = exclude ? pool.filter((t) => t !== exclude) : pool;
    const source = candidates.length > 0 ? candidates : pool;
    return source[Math.floor(Math.random() * source.length)];
  };

  const handleSearch = useCallback(async () => {
    if (isRouletting || isSearching) return;

    const needsStartRandom = !startArticle.trim();
    const needsEndRandom = !endArticle.trim();

    let startPool: string[] = [];
    let endPool: string[] = [];

    if (needsStartRandom || needsEndRandom) {
      const [sp, ep] = await Promise.all([
        needsStartRandom ? fetchRandom('start', 20).catch(() => fallbackTitles) : Promise.resolve([]),
        needsEndRandom ? fetchRandom('end', 20).catch(() => fallbackTitles) : Promise.resolve([]),
      ]);
      startPool = sp;
      endPool = ep;
    }

    const resolvedStart = needsStartRandom
      ? pickRandom(startPool)
      : startArticle.trim();

    const resolvedEnd = needsEndRandom
      ? pickRandom(endPool, resolvedStart)
      : endArticle.trim();

    try {
      const rouletteTasks: Promise<void>[] = [];
      if (needsStartRandom) {
        rouletteTasks.push(animateRoulette(resolvedStart, setStartArticle, startPool));
      } else {
        setStartArticle(resolvedStart);
      }
      if (needsEndRandom) {
        rouletteTasks.push(animateRoulette(resolvedEnd, setEndArticle, endPool));
      } else {
        setEndArticle(resolvedEnd);
      }

      if (rouletteTasks.length > 0) {
        setIsRouletting(true);
        await Promise.all(rouletteTasks);
        setIsRouletting(false);
      }

      setIsSearching(true);
      setSearchError(null);
      try {
        const data = await searchPaths(resolvedStart, resolvedEnd);
        setResult(data);
        setVisibleCount(PAGE_SIZE);
        setSortOrder('interesting');
      } catch (err) {
        setResult(null);
        setSearchError(err instanceof Error ? err.message : 'Search failed');
      }
    } finally {
      setIsRouletting(false);
      setIsSearching(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      ) : searchError ? (
        <EmptyState hint={searchError} />
      ) : result?.noPathFound ? (
        <div className={styles.sections} key={`${result.start}|${result.end}`}>
          <GraphWiki graphData={result.graphData} />
          <EmptyState hint={`No path found between "${result.start}" and "${result.end}" within ${result.maxHops} degrees of separation.`} />
        </div>
      ) : result ? (
        <div className={styles.sections} key={`${result.start}|${result.end}`}>
          <GraphWiki graphData={result.graphData} />

          <BentoBox
            pathsFound={formatNumber(result.pathsFound)}
            fromArticle={result.start}
            toArticle={result.end}
            minHops={result.minHops}
            nodesExplored={formatNumber(result.nodesExplored)}
            searchTime={formatSearchTime(result.searchTimeMs)}
            newArticles={result.newArticles}
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
