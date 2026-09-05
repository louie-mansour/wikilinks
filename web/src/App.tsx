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
import { FeedbackWidget } from './components/FeedbackWidget/FeedbackWidget';
import {
  SUGGESTIONS,
  animateRoulette,
} from './data/suggestions';
import { fetchRandom } from './api/random';
import { useDebouncedSuggestions } from './hooks/useDebouncedSuggestions';
import { formatNumber, type SearchResult } from './data/mockSearch';
import { searchPaths } from './api/search';
import { getShare, createShare } from './api/share';
import { submitFeedbackRating, submitFeedbackComment } from './api/feedback';
import { SHARE_BASE_URL } from './config';
import styles from './App.module.css';

const SORT_OPTIONS = [
  { value: 'interesting', label: 'Sort: most interesting' },
  { value: 'least-interesting', label: 'Sort: least interesting' },
  { value: 'alpha', label: 'Sort: alphabetical' },
];

const PAGE_SIZE = 20;
const SCROLL_DELAY_AFTER_GRAPH_MS = 1200;
const SCROLL_DURATION_MS = 1400;
const USER_SCROLL_DIVERGENCE_PX = 10;

const USER_SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
]);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

function isUserScrollKey(event: KeyboardEvent): boolean {
  return USER_SCROLL_KEYS.has(event.key)
    && !event.ctrlKey
    && !event.metaKey
    && !event.altKey;
}

type SmoothScrollCallbacks = {
  onComplete?: () => void;
  onUserInterrupt?: () => void;
};

function smoothScrollToElement(el: HTMLElement, callbacks?: SmoothScrollCallbacks): () => void {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    el.scrollIntoView({ block: 'start' });
    callbacks?.onComplete?.();
    return () => {};
  }

  const scrollMarginTop = Number.parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  const targetY = window.scrollY + el.getBoundingClientRect().top - scrollMarginTop;
  const startY = window.scrollY;
  const distance = targetY - startY;
  if (Math.abs(distance) < 2) {
    callbacks?.onComplete?.();
    return () => {};
  }

  const start = performance.now();
  const easeInOutCubic = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

  let rafId = 0;
  let cancelled = false;
  let expectedY = startY;

  const cleanup = () => {
    window.removeEventListener('scroll', onScroll);
  };

  const interrupt = () => {
    if (cancelled) return;
    cancelled = true;
    cancelAnimationFrame(rafId);
    cleanup();
    callbacks?.onUserInterrupt?.();
  };

  const onScroll = () => {
    if (cancelled) return;
    if (Math.abs(window.scrollY - expectedY) > USER_SCROLL_DIVERGENCE_PX) {
      interrupt();
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });

  const step = (now: number) => {
    if (cancelled) return;

    const progress = Math.min((now - start) / SCROLL_DURATION_MS, 1);
    expectedY = startY + distance * easeInOutCubic(progress);
    window.scrollTo(0, expectedY);

    if (progress < 1) {
      rafId = requestAnimationFrame(step);
      return;
    }

    cancelled = true;
    cleanup();
    callbacks?.onComplete?.();
  };

  rafId = requestAnimationFrame(step);

  return interrupt;
}

function attachUserScrollListeners(
  onUserScroll: () => void,
  { includeScroll = false }: { includeScroll?: boolean } = {},
): () => void {
  const handleWheel = () => onUserScroll();
  const handleTouchMove = () => onUserScroll();
  const handleScroll = () => onUserScroll();
  const handleKeyDown = (event: KeyboardEvent) => {
    if (isEditableTarget(event.target)) return;
    if (isUserScrollKey(event)) onUserScroll();
  };

  window.addEventListener('wheel', handleWheel, { passive: true });
  window.addEventListener('touchmove', handleTouchMove, { passive: true });
  window.addEventListener('keydown', handleKeyDown);
  if (includeScroll) {
    window.addEventListener('scroll', handleScroll, { passive: true });
  }

  return () => {
    window.removeEventListener('wheel', handleWheel);
    window.removeEventListener('touchmove', handleTouchMove);
    window.removeEventListener('keydown', handleKeyDown);
    if (includeScroll) {
      window.removeEventListener('scroll', handleScroll);
    }
  };
}

export function App() {
  const [startArticle, setStartArticle] = useState('');
  const [endArticle, setEndArticle] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isRouletting, setIsRouletting] = useState(false);
  const [isStartRouletting, setIsStartRouletting] = useState(false);
  const [isEndRouletting, setIsEndRouletting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [sortOrder, setSortOrder] = useState('interesting');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isSharedView, setIsSharedView] = useState(false);
  const [isSelectedStart, setIsSelectedStart] = useState(false);
  const [isSelectedEnd, setIsSelectedEnd] = useState(false);
  const searchStartRef = useRef<number>(0);
  const graphPanelRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const cancelSmoothScrollRef = useRef<(() => void) | null>(null);
  const removeScrollListenersRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (result && !result.noPathFound) {
      document.title = `${result.start} → ${result.end} | WikiHop`;
    } else {
      document.title = 'WikiHop — Wikipedia Hop Finder';
    }
  }, [result]);

  const finishAutoScroll = useCallback(() => {
    removeScrollListenersRef.current?.();
    removeScrollListenersRef.current = null;
    cancelSmoothScrollRef.current = null;
    scrollTimerRef.current = undefined;
  }, []);

  const cancelAutoScroll = useCallback(() => {
    if (scrollTimerRef.current) {
      clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = undefined;
    }
    cancelSmoothScrollRef.current?.();
    cancelSmoothScrollRef.current = null;
    removeScrollListenersRef.current?.();
    removeScrollListenersRef.current = null;
  }, []);

  const handleGraphReady = useCallback(() => {
    cancelAutoScroll();
    removeScrollListenersRef.current = attachUserScrollListeners(cancelAutoScroll, {
      includeScroll: true,
    });

    scrollTimerRef.current = setTimeout(() => {
      scrollTimerRef.current = undefined;
      removeScrollListenersRef.current?.();
      removeScrollListenersRef.current = attachUserScrollListeners(cancelAutoScroll);

      const el = graphPanelRef.current;
      if (!el) {
        finishAutoScroll();
        return;
      }

      cancelSmoothScrollRef.current = smoothScrollToElement(el, {
        onComplete: finishAutoScroll,
        onUserInterrupt: cancelAutoScroll,
      });
    }, SCROLL_DELAY_AFTER_GRAPH_MS);
  }, [cancelAutoScroll, finishAutoScroll]);

  useEffect(() => () => {
    cancelAutoScroll();
  }, [cancelAutoScroll]);

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
    if (isRouletting || isSearching || isStartRouletting || isEndRouletting) return;

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
  }, [startArticle, endArticle, isRouletting, isSearching, isSharedView, isStartRouletting, isEndRouletting]);

  const handleStartRandomize = useCallback(async () => {
    if (isStartRouletting || isRouletting || isSearching) return;
    setIsStartRouletting(true);
    try {
      const pool = await fetchRandom('start', 20).catch(() => fallbackTitles);
      const pick = pickRandom(pool, endArticle.trim() || undefined);
      await animateRoulette(pick, setStartArticle, pool);
    } finally {
      setIsStartRouletting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStartRouletting, isRouletting, isSearching, endArticle]);

  const handleEndRandomize = useCallback(async () => {
    if (isEndRouletting || isRouletting || isSearching) return;
    setIsEndRouletting(true);
    try {
      const pool = await fetchRandom('end', 20).catch(() => fallbackTitles);
      const pick = pickRandom(pool, startArticle.trim() || undefined);
      await animateRoulette(pick, setEndArticle, pool);
    } finally {
      setIsEndRouletting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEndRouletting, isRouletting, isSearching, startArticle]);

  const newArticleCount = (path: SearchResult['paths'][number]) =>
    path.crumbs.filter((crumb) => crumb.hitCount === 1).length;

  const sortedPaths = result
    ? [...result.paths].sort((a, b) => {
        if (sortOrder === 'alpha') {
          const aLabel = a.crumbs[1]?.label ?? '';
          const bLabel = b.crumbs[1]?.label ?? '';
          return aLabel.localeCompare(bLabel);
        }
        const diff = newArticleCount(a) - newArticleCount(b);
        return sortOrder === 'least-interesting' ? diff : -diff;
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
            onStartRandomize={handleStartRandomize}
            onEndRandomize={handleEndRandomize}
            isStartRandomizing={isStartRouletting}
            isEndRandomizing={isEndRouletting}
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
        <div ref={graphPanelRef} className={styles.sections} key={`${result.start}|${result.end}`}>
          <PanelEnter index={1}>
            <GraphWiki graphData={result.graphData} onReady={handleGraphReady} />
          </PanelEnter>
          <PanelEnter index={2}>
            <EmptyState hint={`No path found between "${result.start}" and "${result.end}" within ${result.maxHops} degrees of separation.`} />
          </PanelEnter>
        </div>
      ) : result ? (
        <div ref={graphPanelRef} className={styles.sections} key={`${result.start}|${result.end}`}>
          <PanelEnter index={1}>
            <GraphWiki graphData={result.graphData} onReady={handleGraphReady} />
          </PanelEnter>

          <PanelEnter index={2}>
            <BentoBox
              pathsFound={formatNumber(result.pathsFound)}
              fromArticle={result.start}
              toArticle={result.end}
              minHops={result.minHops}
              nodesExplored={formatNumber(result.nodesExplored)}
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

      <FeedbackWidget onRate={submitFeedbackRating} onSubmitComment={submitFeedbackComment} />
    </div>
  );
}
