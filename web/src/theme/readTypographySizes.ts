/** Font sizes read from CSS custom properties for canvas rendering. */
export interface TypographySizes {
  label: number;
  badge: number;
}

export function readTypographySizes(el: HTMLElement = document.documentElement): TypographySizes {
  const style = getComputedStyle(el);
  const px = (name: string, fallback: number) => {
    const raw = style.getPropertyValue(name).trim();
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  };

  return {
    label: px('--text-label', 12),
    badge: px('--text-badge', 10),
  };
}
