import { useContext, useMemo } from 'react';
import { readCanvasColors, type CanvasColors } from './readCanvasColors';
import { readTypographySizes, type TypographySizes } from './readTypographySizes';
import { ThemeContext } from './ThemeProvider';

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}

export function useCanvasColors(): CanvasColors {
  const { themeId } = useTheme();
  return useMemo(() => readCanvasColors(), [themeId]);
}

export function useTypographySizes(): TypographySizes {
  const { themeId } = useTheme();
  return useMemo(() => readTypographySizes(), [themeId]);
}
