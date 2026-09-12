import type { Meta, StoryObj } from '@storybook/react';
import { RevealedNeighborsPanel } from './RevealedNeighborsPanel';
import type { RevealGraphData } from '../../data/revealGraph';

const HIDDEN_ID = '__hidden__';

const SAMPLE_GRAPH: RevealGraphData = {
  nodes: [
    { id: HIDDEN_ID, variant: 'hidden-end', label: 'Unknown', state: 'unknown' },
    { id: 'Quantum mechanics', label: 'Quantum mechanics', variant: 'default', state: 'named' },
    { id: 'Niels Bohr', label: 'Niels Bohr', variant: 'default', state: 'named' },
    { id: 'Physics', variant: 'default', state: 'blank' },
    { id: 'Copenhagen interpretation', label: 'Copenhagen interpretation', variant: 'default', state: 'named' },
  ],
  links: [],
};

const meta = {
  title: 'WikiLinks/RevealedNeighborsPanel',
  component: RevealedNeighborsPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof RevealedNeighborsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    graphData: SAMPLE_GRAPH,
  },
};

export const Empty: Story = {
  args: {
    graphData: { nodes: [{ id: HIDDEN_ID, variant: 'hidden-end', label: 'Unknown', state: 'unknown' }], links: [] },
  },
};

export const WithLoadMore: Story = {
  args: {
    graphData: SAMPLE_GRAPH,
    remainingCount: 5,
    totalRemainingCount: 12,
  },
};
