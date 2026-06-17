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
  isLoading?: boolean;
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
  isLoading = false,
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

  const query = value.trim();
  const visibleOptions = suggestions.slice(0, 7);
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
    (title: string) => {
      updateValue(title);
      setOpen(false);
      setActiveIndex(-1);
      onSelect?.(title);
    },
    [onSelect, updateValue]
  );

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    updateValue(next);
    setOpen(next.trim().length > 0);
    setActiveIndex(-1);
  }

  function handleInputFocus() {
    if (canShowList) setOpen(true);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
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
