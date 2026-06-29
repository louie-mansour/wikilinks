export const THEME_IDS = ['warm', 'midnight'] as const;

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
    id: 'midnight',
    label: 'Midnight',
    mode: 'dark',
    swatches: ['#242018', '#da7650', '#58a878', '#d8a048'],
  },
];

export const DEFAULT_THEME_ID: ThemeId = 'warm';

export const THEME_STORAGE_KEY = 'wikihop-theme';

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
