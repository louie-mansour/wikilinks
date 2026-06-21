/** Colors read from CSS custom properties for canvas rendering. */
export interface CanvasColors {
  white: string;
  sandDark: string;
  graphLink: string;
  ink: string;
  sage: string;
  terra: string;
  terraPale: string;
  clayPale: string;
  clay: string;
  clayBorder: string;
}

export function readCanvasColors(el: HTMLElement = document.documentElement): CanvasColors {
  const style = getComputedStyle(el);
  const token = (name: string) => style.getPropertyValue(name).trim();

  return {
    white: token('--white'),
    sandDark: token('--sand-dark'),
    graphLink: token('--graph-link') || token('--sand-dark'),
    ink: token('--ink'),
    sage: token('--sage'),
    terra: token('--terra'),
    terraPale: token('--terra-pale'),
    clayPale: token('--clay-pale'),
    clay: token('--clay'),
    clayBorder: token('--clay-border'),
  };
}
