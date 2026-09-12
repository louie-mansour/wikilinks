import type { Meta, StoryObj } from '@storybook/react';
import { DirectConnectionsPanel } from './DirectConnectionsPanel';

const SAMPLE_ENTRIES = [
  { id: 'Quantum mechanics', outDegree: 4, edgeCountToEnd: 2, ratio: 0.5, inDegree: 12, hitCount: 2, score: 0.36 },
  { id: 'Niels Bohr', outDegree: 3, edgeCountToEnd: 1, ratio: 1 / 3, inDegree: 40, hitCount: 1, score: 0.06 },
  { id: 'Physics', outDegree: 214, edgeCountToEnd: 1, ratio: 1 / 214, inDegree: 50000, hitCount: 1, score: 0.0003 },
];

const meta = {
  title: 'WikiLinks/DirectConnectionsPanel',
  component: DirectConnectionsPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof DirectConnectionsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    entries: SAMPLE_ENTRIES,
  },
};

export const Empty: Story = {
  args: {
    entries: [],
  },
};

export const WithLoadMore: Story = {
  args: {
    entries: SAMPLE_ENTRIES,
    remainingCount: 5,
    totalRemainingCount: 12,
  },
};
