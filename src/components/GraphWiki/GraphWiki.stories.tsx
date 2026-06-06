import type { Meta, StoryObj } from '@storybook/react';
import { GraphWiki } from './GraphWiki';
import { buildGraphForDegrees, buildMultiPathGraph } from '../../data/buildGraphData';

const meta = {
  title: 'WikiLinks/GraphWiki',
  component: GraphWiki,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'sand' },
  },
} satisfies Meta<typeof GraphWiki>;

export default meta;
type Story = StoryObj<typeof meta>;

const DATA_SMALL = buildMultiPathGraph(60,    8);
const DATA_MAIN  = buildMultiPathGraph(1000,  8);

export const Default: Story = {
  args: { graphData: DATA_MAIN },
};

export const Small: Story = {
  args: { graphData: DATA_SMALL },
};

/** 1 degree of separation — start links directly to end. 2 nodes. */
export const Degree1: Story = {
  args: { graphData: buildGraphForDegrees(1, 8) },
};

/** 2 degrees of separation — one intermediate layer of 8 nodes. 10 nodes total. */
export const Degree2: Story = {
  args: { graphData: buildGraphForDegrees(2, 8) },
};

/** 3 degrees of separation — two layers of 8. 18 nodes total. */
export const Degree3: Story = {
  args: { graphData: buildGraphForDegrees(3, 8) },
};

/** 4 degrees of separation — layers [8, 64, 8]. 82 nodes total. */
export const Degree4: Story = {
  args: { graphData: buildGraphForDegrees(4, 8) },
};

/** 5 degrees of separation — layers [8, 64, 64, 8]. 146 nodes total. */
export const Degree5: Story = {
  args: { graphData: buildGraphForDegrees(5, 8) },
};

/** 6 degrees of separation — layers [8, 64, 150, 64, 8]. 296 nodes total. */
export const Degree6: Story = {
  args: { graphData: buildGraphForDegrees(6, 8) },
};
