import { useEffect, useState } from 'react';
import type { Suggestion } from '../components/Combobox/Combobox';
import { fetchSuggest, type SuggestRole } from '../api/suggest';

const DEBOUNCE_MS = 150;

export interface DebouncedSuggestions {
  suggestions: Suggestion[];
  isLoading: boolean;
}

export function useDebouncedSuggestions(
  role: SuggestRole,
  query: string,
): DebouncedSuggestions {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const controller = new AbortController();
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      try {
        const nodes = await fetchSuggest(role, trimmed, controller.signal);
        if (cancelled) return;
        setSuggestions(nodes.map((title) => ({ title })));
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setSuggestions([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [role, query]);

  return { suggestions, isLoading };
}
