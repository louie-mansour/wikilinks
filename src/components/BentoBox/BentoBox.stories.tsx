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
    pathsSub: '4 hops each — shortest possible',
    minHops: 4,
    hopsNote: 'fewest possible',
    nodesExplored: '8,241',
    searchTime: '1.2s',
    uniqueArticles: 14,
  },
};

/* ────────────────────────────────────────
   FewPaths — sparse graph result
──────────────────────────────────────── */
export const FewPaths: Story = {
  args: {
    pathsFound: 3,
    pathsSub: '3 hops each',
    minHops: 3,
    nodesExplored: '412',
    searchTime: '0.3s',
    uniqueArticles: 5,
  },
};

/* ────────────────────────────────────────
   ManyPaths — dense graph result
──────────────────────────────────────── */
export const ManyPaths: Story = {
  args: {
    pathsFound: '1,024',
    pathsSub: '5 hops each',
    minHops: 5,
    nodesExplored: '24,831',
    searchTime: '4.7s',
    uniqueArticles: 38,
  },
};
