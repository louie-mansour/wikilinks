import { Combobox, type Suggestion } from '../Combobox/Combobox';
import { Button } from '../Button/Button';
import { ThemePicker } from '../ThemePicker/ThemePicker';
import styles from './Header.module.css';

const DEFAULT_TAGLINE =
  'Find all the shortest paths spanning any two Wikipedia articles';

interface HeaderProps {
  startSuggestions: Suggestion[];
  endSuggestions: Suggestion[];
  startSuggestionsLoading?: boolean;
  endSuggestionsLoading?: boolean;
  startValue?: string;
  endValue?: string;
  onStartSelect?: (title: string) => void;
  onEndSelect?: (title: string) => void;
  onStartChange?: (value: string) => void;
  onEndChange?: (value: string) => void;
  onSearch?: () => void;
  isSearching?: boolean;
  searchLabel?: string;
  onStartRandomize?: () => void;
  onEndRandomize?: () => void;
  isStartRandomizing?: boolean;
  isEndRandomizing?: boolean;
  /** When set, replaces the default tagline (shared link view). */
  sharedArticles?: { start: string; end: string };
}

export function Header({
  startSuggestions,
  endSuggestions,
  startSuggestionsLoading = false,
  endSuggestionsLoading = false,
  startValue = '',
  endValue = '',
  onStartSelect,
  onEndSelect,
  onStartChange,
  onEndChange,
  onSearch,
  isSearching = false,
  searchLabel = 'Find paths',
  onStartRandomize,
  onEndRandomize,
  isStartRandomizing = false,
  isEndRandomizing = false,
  sharedArticles,
}: HeaderProps) {
  const canSearch = Boolean(startValue.trim() && endValue.trim());

  return (
    <header className={styles.topBar}>
      <div className={styles.themePicker}>
        <ThemePicker />
      </div>

      <div className={styles.wordmark}>
        <span className={styles.wordmarkIcon} aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="8" cy="3" r="2" fill="white" />
            <circle cx="3" cy="13" r="2" fill="white" />
            <circle cx="13" cy="13" r="2" fill="white" />
            <line x1="8" y1="5" x2="3" y2="11" stroke="white" strokeWidth="1.5" />
            <line x1="8" y1="5" x2="13" y2="11" stroke="white" strokeWidth="1.5" />
          </svg>
        </span>
        WikiHop
      </div>

      <p className={styles.tagline}>
        {sharedArticles ? (
          <>
            Welcome! Someone shared this search with you.
            <br />
            It shows shortest Wikipedia paths between{' '}
            <strong>{sharedArticles.start}</strong> and{' '}
            <strong>{sharedArticles.end}</strong>.
            <br />
            <br />
            Enter articles below to find your own shortest paths.
          </>
        ) : (
          DEFAULT_TAGLINE
        )}
      </p>

      <div className={styles.searchForm}>
        <div className={styles.inputsRow}>
          <div className={styles.inputGroup}>
            <span className={styles.inputLabel} aria-hidden="true">Start Article</span>
            <Combobox
              id="header-start"
              label="Start Article"
              placeholder="Type article here"
              value={startValue}
              suggestions={startSuggestions}
              isLoading={startSuggestionsLoading}
              onSelect={onStartSelect}
              onChange={onStartChange}
              onRandomize={onStartRandomize}
              isRandomizing={isStartRandomizing}
              className={styles.combobox}
              analyticsRole="start"
            />
          </div>

          <div className={`${styles.inputGroup} ${styles.arrowGroup}`}>
            <span className={`${styles.inputLabel} ${styles.labelSpacer}`} aria-hidden="true">&nbsp;</span>
            <span className={styles.arrowConnector} aria-hidden="true">→</span>
          </div>

          <div className={styles.inputGroup}>
            <span className={styles.inputLabel} aria-hidden="true">End Article</span>
            <Combobox
              id="header-end"
              label="End Article"
              placeholder="Type article here"
              value={endValue}
              suggestions={endSuggestions}
              isLoading={endSuggestionsLoading}
              onSelect={onEndSelect}
              onChange={onEndChange}
              onRandomize={onEndRandomize}
              isRandomizing={isEndRandomizing}
              className={styles.combobox}
              analyticsRole="end"
            />
          </div>
        </div>

        <Button
          variant="primary"
          className={styles.searchButton}
          onClick={onSearch}
          loading={isSearching}
          disabled={!canSearch}
        >
          {searchLabel}
        </Button>
      </div>
    </header>
  );
}
