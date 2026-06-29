import { useState, useCallback, useEffect, useRef } from 'react';
import { trackSearchClicked, trackShareLinkOpened, trackLoadMoreClicked } from './analytics';
import { Header } from './components/Header/Header';
import { GraphWiki } from './components/GraphWiki/GraphWiki';
import { BentoBox } from './components/BentoBox/BentoBox';
import { RecordsSection } from './components/RecordsSection/RecordsSection';
import { ShareBar } from './components/ShareBar/ShareBar';
import { ShortestPaths } from './components/ShortestPaths/ShortestPaths';
import { EmptyState } from './components/EmptyState/EmptyState';
import { LoadingState } from './components/LoadingState/LoadingState';
import { PanelEnter } from './components/PanelEnter/PanelEnter';
import {
  SUGGESTIONS,
  animateRoulette,
} from './data/suggestions';
import { fetchRandom } from './api/random';
import { useDebouncedSuggestions } from './hooks/useDebouncedSuggestions';
import { formatSearchTime, formatNumber, type SearchResult } from './data/mockSearch';
import { searchPaths } from './api/search';
import { getShare, createShare } from './api/share';
import { SHARE_BASE_URL } from './config';
import styles from './App.module.css';

const SORT_OPTIONS = [
  { value: 'interesting', label: 'Sort: most interesting' },
  { value: 'alpha', label: 'Sort: alphabetical' },
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
  const [isSharedView, setIsSharedView] = useState(false);
  const [isSelectedStart, setIsSelectedStart] = useState(false);
  const [isSelectedEnd, setIsSelectedEnd] = useState(false);
  const searchStartRef = useRef<number>(0);

  useEffect(() => {
    if (result && !result.noPathFound) {
      document.title = `${result.start} → ${result.end} | WikiHop`;
    } else {
      document.title = 'WikiHop — Wikipedia Hop Finder';
    }
  }, [result]);

  useEffect(() => {
    const match = window.location.pathname.match(/^\/s\/([A-Za-z0-9]+)$/);
    if (!match) return;
    const code = match[1];
    setIsSharedView(true);
    setIsSearching(true);
    trackShareLinkOpened({ share_id: code });
    getShare(code)
      .then((data) => {
        setResult(data);
        setStartArticle(data.start);
        setEndArticle(data.end);
      })
      .catch((err: unknown) => {
        setSearchError(err instanceof Error ? err.message : 'Share not found');
      })
      .finally(() => setIsSearching(false));
  }, []);

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
    trackSearchClicked({
      start_article: startArticle.trim() || null,
      end_article: endArticle.trim() || null,
      is_random_start: needsStartRandom,
      is_random_end: needsEndRandom,
      is_selected_start: isSelectedStart,
      is_selected_end: isSelectedEnd,
    });
    searchStartRef.current = Date.now();

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
        if (isSharedView) {
          setIsSharedView(false);
        }
        window.history.pushState(null, '', '/');
      } catch (err) {
        setResult(null);
        setSearchError(err instanceof Error ? err.message : 'Search failed');
      }
    } finally {
      setIsRouletting(false);
      setIsSearching(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startArticle, endArticle, isRouletting, isSearching, isSharedView]);

  const sortedPaths = result
    ? [...result.paths].sort((a, b) => {
        if (sortOrder === 'alpha') {
          const aLabel = a.crumbs[1]?.label ?? '';
          const bLabel = b.crumbs[1]?.label ?? '';
          return aLabel.localeCompare(bLabel);
        }
return 0; // 'interesting' = original order
      })
    : [];

  const visiblePaths = sortedPaths.slice(0, visibleCount);
  const remainingCount = sortedPaths.length - visibleCount;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <PanelEnter index={0}>
          <Header
            startSuggestions={startSuggestions.suggestions}
            endSuggestions={endSuggestions.suggestions}
            startSuggestionsLoading={startSuggestions.isLoading}
            endSuggestionsLoading={endSuggestions.isLoading}
            startValue={startArticle}
            endValue={endArticle}
            onStartSelect={(v) => { setStartArticle(v); setIsSelectedStart(true); }}
            onEndSelect={(v) => { setEndArticle(v); setIsSelectedEnd(true); }}
            onStartChange={(v) => { setStartArticle(v); setIsSelectedStart(false); }}
            onEndChange={(v) => { setEndArticle(v); setIsSelectedEnd(false); }}
            onSearch={handleSearch}
            isSearching={isRouletting || isSearching}
            searchLabel={
              isRouletting
                ? 'Picking articles…'
                : isSearching
                  ? 'Finding paths…'
                  : 'Find paths'
            }
            sharedArticles={
              isSharedView && startArticle && endArticle
                ? { start: startArticle, end: endArticle }
                : undefined
            }
          />
        </PanelEnter>
      </div>

      {isRouletting || isSearching ? (
        <LoadingState phase={isRouletting ? 'articles' : 'paths'} />
      ) : searchError ? (
        <EmptyState hint={searchError} />
      ) : result?.noPathFound ? (
        <div className={styles.sections} key={`${result.start}|${result.end}`}>
          <PanelEnter index={1}>
            <GraphWiki graphData={result.graphData} />
          </PanelEnter>
          <PanelEnter index={2}>
            <EmptyState hint={`No path found between "${result.start}" and "${result.end}" within ${result.maxHops} degrees of separation.`} />
          </PanelEnter>
        </div>
      ) : result ? (
        <div className={styles.sections} key={`${result.start}|${result.end}`}>
          <PanelEnter index={1}>
            <GraphWiki graphData={result.graphData} />
          </PanelEnter>

          <PanelEnter index={2}>
            <BentoBox
              pathsFound={formatNumber(result.pathsFound)}
              fromArticle={result.start}
              toArticle={result.end}
              minHops={result.minHops}
              nodesExplored={formatNumber(result.nodesExplored)}
              searchTime={formatSearchTime(result.searchTimeMs)}
              pathArticles={result.graphData.nodes.length}
              firstArticles={result.newArticles}
            />
          </PanelEnter>

          <PanelEnter index={3}>
            <ShareBar
              shareBaseUrl={SHARE_BASE_URL}
              urlCode={result.shareCode}
              onActivate={async () => {
                await createShare(result);
                window.history.pushState(null, '', `/s/${result.shareCode}`);
              }}
            />
          </PanelEnter>

          <PanelEnter index={4}>
            <RecordsSection periods={result.records} />
          </PanelEnter>

          <PanelEnter index={5}>
            <ShortestPaths
              title={`${formatNumber(result.pathsFound)} shortest path${result.pathsFound !== 1 ? 's' : ''}`}
              paths={visiblePaths}
              sortOptions={SORT_OPTIONS}
              sortValue={sortOrder}
              onSortChange={(val) => { setSortOrder(val); setVisibleCount(PAGE_SIZE); }}
              remainingCount={remainingCount > 0 ? Math.min(PAGE_SIZE, remainingCount) : undefined}
              totalRemainingCount={remainingCount > 0 ? remainingCount : undefined}
              onLoadMore={() => {
                trackLoadMoreClicked({ visible_count: visibleCount, remaining_count: remainingCount ?? 0 });
                setVisibleCount((c) => c + PAGE_SIZE);
              }}
            />
          </PanelEnter>
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
