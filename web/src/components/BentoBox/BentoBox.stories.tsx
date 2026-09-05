import type { Meta, StoryObj } from '@storybook/react';
import { BentoBox } from './BentoBox';

const meta = {
  title: 'WikiLinks/BentoBox',
  component: BentoBox,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'sand' },
  },
} satisfies Meta<typeof BentoBox>;

export default meta;
type Story = StoryObj<typeof meta>;

/* ────────────────────────────────────────
   Default — typical search result
──────────────────────────────────────── */
export const Default: Story = {
  args: {
    pathsFound: 247,
    fromArticle: 'Philosophy',
    toArticle: 'Banana',
    minHops: 4,
    searchTimeMs: '1,200 ms',
    pathArticles: 14,
    firstArticles: 2,
  },
};

/* ────────────────────────────────────────
   FewPaths — sparse graph result
──────────────────────────────────────── */
export const FewPaths: Story = {
  args: {
    pathsFound: 3,
    fromArticle: 'Cat',
    toArticle: 'Dog',
    minHops: 3,
    searchTimeMs: '340 ms',
    pathArticles: 5,
    firstArticles: 1,
  },
};

/* ────────────────────────────────────────
   ManyFirstDiscoveries — high first-discoveries count
──────────────────────────────────────── */
export const ManyFirstDiscoveries: Story = {
  args: {
    pathsFound: 247,
    fromArticle: 'Philosophy',
    toArticle: 'Banana',
    minHops: 4,
    searchTimeMs: '1,200 ms',
    pathArticles: 180,
    firstArticles: 166,
  },
};

/* ────────────────────────────────────────
   ManyPaths — dense graph result
──────────────────────────────────────── */
export const ManyPaths: Story = {
  args: {
    pathsFound: '1,024',
    fromArticle: 'Mathematics',
    toArticle: 'Music',
    minHops: 5,
    searchTimeMs: '3,120 ms',
    pathArticles: 38,
    firstArticles: 0,
  },
};

/* ────────────────────────────────────────
   LongArticleNames — wrap stress test
──────────────────────────────────────── */
export const LongArticleNames: Story = {
  args: {
    pathsFound: 20,
    fromArticle: 'International Covenant on Civil and Political Rights',
    toArticle:
      'History of the National Register of Historic Places listings in Manhattan above 59th to 110th Streets',
    minHops: 4,
    searchTimeMs: '860 ms',
    pathArticles: 11,
    firstArticles: 3,
  },
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
};
