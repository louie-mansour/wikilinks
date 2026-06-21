export const THEME_IDS = [
  'warm',
  'ocean',
  'forest',
  'wikipedia',
  'midnight',
  'obsidian',
  'ember',
  'aurora',
  'deep-sea',
  'moss',
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export type ThemeMode = 'light' | 'dark';

export interface ThemePreset {
  id: ThemeId;
  label: string;
  mode: ThemeMode;
  /** Preview swatches: surface, primary, secondary, accent */
  swatches: [string, string, string, string];
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'warm',
    label: 'Warm',
    mode: 'light',
    swatches: ['#f5ede0', '#c4572a', '#4a7c59', '#e8a05a'],
  },
  {
    id: 'ocean',
    label: 'Ocean',
    mode: 'light',
    swatches: ['#e4edf2', '#1e6b88', '#2a7a68', '#4a90b8'],
  },
  {
    id: 'forest',
    label: 'Forest',
    mode: 'light',
    swatches: ['#e8ebe4', '#4a6828', '#2a6848', '#c89030'],
  },
  {
    id: 'wikipedia',
    label: 'Wikipedia',
    mode: 'light',
    swatches: ['#f6f6f6', '#3366cc', '#14866d', '#996600'],
  },
  {
    id: 'midnight',
    label: 'Midnight',
    mode: 'dark',
    swatches: ['#242018', '#d87048', '#58a878', '#d8a048'],
  },
  {
    id: 'obsidian',
    label: 'Obsidian',
    mode: 'dark',
    swatches: ['#1a2028', '#539bf5', '#3fb950', '#d29922'],
  },
  {
    id: 'ember',
    label: 'Ember',
    mode: 'dark',
    swatches: ['#281818', '#e85555', '#c87878', '#e8a040'],
  },
  {
    id: 'aurora',
    label: 'Aurora',
    mode: 'dark',
    swatches: ['#1a2430', '#9d7cf0', '#34d399', '#f472b6'],
  },
  {
    id: 'deep-sea',
    label: 'Deep Sea',
    mode: 'dark',
    swatches: ['#141c28', '#38bdf8', '#2dd4bf', '#60a5fa'],
  },
  {
    id: 'moss',
    label: 'Moss',
    mode: 'dark',
    swatches: ['#1a241c', '#6db87a', '#4ade80', '#c9a227'],
  },
];

export const DEFAULT_THEME_ID: ThemeId = 'warm';

export const THEME_STORAGE_KEY = 'wikilinks-theme';

export function isThemeId(value: string): value is ThemeId {
  return (THEME_IDS as readonly string[]).includes(value);
}

/** Text colour for theme preview rows on their surface swatch. */
export function themePreviewTextColor(mode: ThemeMode): string {
  return mode === 'light' ? '#202122' : '#e8eef4';
}

/** Picker row background — uses each theme's page surface colour. */
export function themeListBackground(preset: ThemePreset): string {
  return preset.swatches[0];
}
