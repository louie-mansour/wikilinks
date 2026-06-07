import type { Suggestion } from '../components/Combobox/Combobox';

export const SUGGESTIONS: Suggestion[] = [
  { title: 'Albert Einstein', featured: true },
  { title: 'Quantum mechanics', featured: true },
  { title: 'Marie Curie', featured: true },
  { title: 'Isaac Newton', featured: true },
  { title: 'Black hole', featured: true },
  { title: 'Big Bang', featured: true },
  { title: 'DNA', featured: true },
  { title: 'Artificial intelligence', featured: true },
  { title: 'World War II', featured: true },
  { title: 'Leonardo da Vinci', featured: true },
  { title: 'William Shakespeare', featured: true },
  { title: 'Special relativity' },
  { title: 'General relativity' },
  { title: 'Niels Bohr' },
  { title: 'Max Planck' },
  { title: 'Stephen Hawking' },
  { title: 'Richard Feynman' },
  { title: 'Schrödinger equation' },
  { title: 'Wave function' },
  { title: 'Thermodynamics' },
  { title: 'Classical mechanics' },
  { title: 'Theory of everything' },
  { title: 'Evolution' },
  { title: 'Charles Darwin' },
  { title: 'Photosynthesis' },
  { title: 'Human brain' },
  { title: 'Ancient Rome' },
  { title: 'Philosophy' },
  { title: 'Mathematics' },
  { title: 'Beethoven' },
  { title: 'French Revolution' },
  { title: 'Periodic table' },
  { title: 'Plate tectonics' },
  { title: 'Climate change' },
  { title: 'Roman Empire' },
];

const ARTICLE_TITLES = SUGGESTIONS.map((s) => s.title);

export function pickRandomArticle(exclude?: string): string {
  const pool = exclude
    ? ARTICLE_TITLES.filter((title) => title !== exclude)
    : ARTICLE_TITLES;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Fills empty start/end with random distinct articles from suggestions. */
export function resolveSearchArticles(
  start: string,
  end: string,
): { start: string; end: string } {
  const resolvedStart = start.trim() || pickRandomArticle();
  let resolvedEnd = end.trim() || pickRandomArticle(resolvedStart);
  if (resolvedEnd === resolvedStart) {
    resolvedEnd = pickRandomArticle(resolvedStart);
  }
  return { start: resolvedStart, end: resolvedEnd };
}

const ROULETTE_DURATION_MS = 1000;
const ROULETTE_MIN_TICK_MS = 35;
const ROULETTE_MAX_TICK_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function pickRouletteFrame(pool: string[], finalTitle: string, progress: number): string {
  if (progress >= 0.88) return finalTitle;
  let pick = pool[Math.floor(Math.random() * pool.length)];
  while (pick === finalTitle && pool.length > 1 && progress < 0.7) {
    pick = pool[Math.floor(Math.random() * pool.length)];
  }
  return pick;
}

/** Cycles random article titles in `onTick`, easing to a stop on `finalTitle`. */
export async function animateRoulette(
  finalTitle: string,
  onTick: (value: string) => void,
): Promise<void> {
  const pool = ARTICLE_TITLES.filter((title) => title !== finalTitle);
  const frames = pool.length > 0 ? pool : ARTICLE_TITLES;

  let elapsed = 0;
  onTick(pickRouletteFrame(frames, finalTitle, 0));

  while (elapsed < ROULETTE_DURATION_MS) {
    const progress = elapsed / ROULETTE_DURATION_MS;
    const delay =
      ROULETTE_MIN_TICK_MS +
      (ROULETTE_MAX_TICK_MS - ROULETTE_MIN_TICK_MS) * progress * progress;
    await sleep(delay);
    elapsed += delay;
    const nextProgress = Math.min(elapsed / ROULETTE_DURATION_MS, 1);
    onTick(pickRouletteFrame(frames, finalTitle, nextProgress));
  }

  onTick(finalTitle);
}
