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
    nodesExplored: '8,241',
    searchTime: '1.2s',
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
    nodesExplored: '412',
    searchTime: '0.3s',
    pathArticles: 5,
    firstArticles: 1,
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
    nodesExplored: '24,831',
    searchTime: '4.7s',
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
    nodesExplored: '2,104',
    searchTime: '0.9s',
    pathArticles: 11,
    firstArticles: 3,
  },
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
};
