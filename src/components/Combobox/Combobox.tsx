import { useId, useRef, useState, useEffect, useCallback } from 'react';
import styles from './Combobox.module.css';

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
  onSelect?: (title: string) => void;
  onChange?: (value: string) => void;
  className?: string;
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
  onSelect,
  onChange,
  className = '',
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
  const inputRef = useRef<HTMLInputElement>(null);

  // Derive visible options
  const query = value.trim();
  const visibleOptions: Suggestion[] = query
    ? suggestions
        .filter((s) => s.title.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 7)
    : suggestions.filter((s) => s.featured).slice(0, 6);

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
    (title: string) => {
      updateValue(title);
      setOpen(false);
      setActiveIndex(-1);
      onSelect?.(title);
    },
    [onSelect, updateValue]
  );

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    updateValue(e.target.value);
    setOpen(true);
    setActiveIndex(-1);
  }

  function handleInputFocus() {
    setOpen(true);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
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
          select(visibleOptions[activeIndex].title);
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

  function handleChevronClick() {
    if (open) {
      setOpen(false);
      setActiveIndex(-1);
    } else {
      setOpen(true);
      inputRef.current?.focus();
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
        <input
          ref={inputRef}
          id={id}
          type="text"
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

        {/* Chevron toggle */}
        <button
          type="button"
          aria-label={open ? 'Close suggestions' : 'Open suggestions'}
          aria-hidden="true"
          tabIndex={-1}
          className={styles.chevron}
          onClick={handleChevronClick}
        >
          {/* 12×12 SVG chevron, §9 */}
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            focusable="false"
          >
            <polyline
              points="2,4 6,8 10,4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Dropdown listbox */}
      {open && (
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
                  select(option.title);
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
