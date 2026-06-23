import posthog from 'posthog-js';

const key = import.meta.env.VITE_POSTHOG_KEY;
const host = import.meta.env.VITE_POSTHOG_HOST;
const environment = import.meta.env.VITE_APP_ENV ?? 'local';

export function initAnalytics() {
  if (!key) return;
  posthog.init(key, {
    api_host: host ?? 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
  });
  posthog.register({ environment });
}

function capture(event: string, properties?: Record<string, unknown>) {
  if (!key) return;
  posthog.capture(event, { environment, ...properties });
}

export function registerTheme(themeId: string) {
  if (!key) return;
  posthog.register({ theme: themeId });
}

// --- Article Input ---

export function trackComboboxSuggestionSelected(props: {
  role: string;
  selected_article: string;
  position_in_list: number;
  query: string;
  char_count: number;
}) {
  capture('combobox_suggestion_selected', props);
}

// --- Search ---

export function trackSearchClicked(props: {
  start_article: string | null;
  end_article: string | null;
  is_random_start: boolean;
  is_random_end: boolean;
  is_selected_start: boolean;
  is_selected_end: boolean;
}) {
  capture('search_clicked', props);
}

// --- Graph Panel ---

export function trackGraphNodeHighlighted(props: {
  article_name: string;
  node_role: 'start' | 'end' | 'intermediate';
  layer_index: number;
  total_layers: number;
}) {
  capture('graph_node_highlighted', props);
}

export function trackGraphNodeNavigated(props: {
  article_name: string;
  node_role: 'start' | 'end' | 'intermediate';
  layer_index: number;
  total_layers: number;
}) {
  capture('graph_node_navigated', props);
}

// --- Paths List ---

export function trackSortChanged(props: { sort_value: string }) {
  capture('sort_changed', props);
}

export function trackArticleLinkClicked(props: {
  article_title: string;
  hop_index: number;
  path_titles: string[];
}) {
  capture('article_link_clicked', props);
}

export function trackLoadMoreClicked(props: {
  visible_count: number;
  remaining_count: number;
}) {
  capture('load_more_clicked', props);
}

// --- Sharing ---

export function trackCopyLinkClicked(props: { share_url: string }) {
  capture('copy_link_clicked', props);
}

export function trackShareLinkClicked(props: { share_url: string }) {
  capture('share_link_clicked', props);
}

export function trackShareLinkOpened(props: { share_id: string }) {
  capture('share_link_opened', props);
}
