import { useId, useRef, useState, useEffect, useCallback } from 'react';
import { Search, Trash2, Shuffle } from 'lucide-react';
import styles from './Combobox.module.css';
import { trackComboboxSuggestionSelected } from '../../analytics';

export interface Suggestion {
  title: string;
  featured?: boolean;
}

export interface ComboboxProps {
  id: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  value?: string;
  suggestions: Suggestion[];
  isLoading?: boolean;
  onSelect?: (title: string) => void;
  onChange?: (value: string) => void;
  onRandomize?: () => void;
  isRandomizing?: boolean;
  className?: string;
  analyticsRole?: string;
}

/** Split `text` on all occurrences of `query` (case-insensitive), returning
 *  an array of plain-string and <mark> segments. */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className={styles.mark}>{text.slice(idx, idx + query.length)}</mark>
      {highlightMatch(text.slice(idx + query.length), query)}
    </>
  );
}

export function Combobox({
  id,
  label,
  placeholder = 'Search…',
  defaultValue = '',
  value: controlledValue,
  suggestions,
  isLoading = false,
  onSelect,
  onChange,
  onRandomize,
  isRandomizing = false,
  className = '',
  analyticsRole,
}: ComboboxProps) {
  const isControlled = controlledValue !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const value = isControlled ? controlledValue : uncontrolledValue;

  const updateValue = useCallback(
    (next: string) => {
      if (!isControlled) setUncontrolledValue(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const listboxId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const query = value.trim();
  const visibleOptions = suggestions.slice(0, 7);

  const adjustHeight = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);
  const canShowList = query.length > 0;

  // Close on outside click
  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const select = useCallback(
    (title: string, index: number) => {
      updateValue(title);
      setOpen(false);
      setActiveIndex(-1);
      onSelect?.(title);
      trackComboboxSuggestionSelected({
        role: analyticsRole ?? '',
        selected_article: title,
        position_in_list: index,
        query,
        char_count: query.length,
      });
    },
    [onSelect, updateValue, analyticsRole, query]
  );

  function handleClear() {
    updateValue('');
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    updateValue(next);
    setOpen(next.trim().length > 0);
    setActiveIndex(-1);
  }

  function handleInputFocus() {
    if (canShowList) setOpen(true);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter') e.preventDefault();
    if (!open) {
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && canShowList) {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) =>
          prev < visibleOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) =>
          prev > 0 ? prev - 1 : visibleOptions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && visibleOptions[activeIndex]) {
          select(visibleOptions[activeIndex].title, activeIndex);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
        inputRef.current?.blur();
        break;
    }
  }

  const activeOptionId =
    activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  return (
    <div
      ref={wrapperRef}
      className={`${styles.wrap} ${className}`}
      data-open={open ? '' : undefined}
    >
      {/* Visually-hidden label — always present for accessibility */}
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>

      {/* Input row */}
      <div className={styles.inputRow}>
        <span className={styles.searchIcon} aria-hidden="true">
          <Search size={14} strokeWidth={2.5} />
        </span>

        <textarea
          ref={inputRef}
          id={id}
          rows={1}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          className={styles.input}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
        />

        <button
          type="button"
          className={styles.iconBtn}
          aria-label="Clear"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleClear}
        >
          <Trash2 size={14} strokeWidth={2.5} aria-hidden="true" />
        </button>

        {onRandomize && (
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.iconBtnRight}`}
            aria-label="Pick random article"
            disabled={isRandomizing}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onRandomize}
          >
            <Shuffle size={14} strokeWidth={2.5} aria-hidden="true" />
          </button>
        )}

      </div>

      {/* Dropdown listbox — hidden while loading with no prior results */}
      {open && canShowList && (visibleOptions.length > 0 || !isLoading) && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={label}
          className={styles.listbox}
        >
          {visibleOptions.length === 0 ? (
            <li className={styles.noResults} role="option" aria-selected={false}>
              No results
            </li>
          ) : (
            visibleOptions.map((option, i) => (
              <li
                key={option.title}
                id={`${listboxId}-option-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                className={`${styles.option} ${i === activeIndex ? styles.optionActive : ''}`}
                onMouseDown={(e) => {
                  // prevent blur before click registers
                  e.preventDefault();
                  select(option.title, i);
                }}
                onMouseEnter={() => setActiveIndex(i)}
              >
                {highlightMatch(option.title, query)}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
