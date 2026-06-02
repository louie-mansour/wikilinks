import { Combobox, type Suggestion } from '../Combobox/Combobox';
import { Button } from '../Button/Button';
import styles from './Header.module.css';

interface HeaderProps {
  startSuggestions: Suggestion[];
  endSuggestions: Suggestion[];
  onStartSelect?: (title: string) => void;
  onEndSelect?: (title: string) => void;
  onSearch?: () => void;
}

export function Header({
  startSuggestions,
  endSuggestions,
  onStartSelect,
  onEndSelect,
  onSearch,
}: HeaderProps) {
  return (
    <header className={styles.topBar}>
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
        WikiLinks
      </div>

      <p className={styles.tagline}>
        Find the shortest route between any two Wikipedia articles
      </p>

      <div className={styles.searchForm}>
        <div className={styles.inputsRow}>
          <div className={styles.inputGroup}>
            <span className={styles.inputLabel} aria-hidden="true">Start article</span>
            <Combobox
              id="header-start"
              label="Start article"
              placeholder="e.g. Albert Einstein"
              suggestions={startSuggestions}
              onSelect={onStartSelect}
            />
          </div>

          <div className={`${styles.inputGroup} ${styles.arrowGroup}`}>
            <span className={`${styles.inputLabel} ${styles.labelSpacer}`} aria-hidden="true">&nbsp;</span>
            <span className={styles.arrowConnector} aria-hidden="true">→</span>
          </div>

          <div className={styles.inputGroup}>
            <span className={styles.inputLabel} aria-hidden="true">End article</span>
            <Combobox
              id="header-end"
              label="End article"
              placeholder="e.g. Quantum mechanics"
              suggestions={endSuggestions}
              onSelect={onEndSelect}
            />
          </div>
        </div>

        <Button variant="primary" className={styles.searchButton} onClick={onSearch}>
          Find paths
        </Button>
      </div>
    </header>
  );
}
