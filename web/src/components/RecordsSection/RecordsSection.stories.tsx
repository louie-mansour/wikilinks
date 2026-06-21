import type { Meta, StoryObj } from '@storybook/react';
import { RecordsSection } from './RecordsSection';

const DEMO_PERIODS = [
  {
    period: 'All time',
    rows: [
      { key: 'Most paths found', value: '300', badge: true },
      { key: 'Most articles in paths', value: '14', badge: true },
      { key: 'Most articles explored', value: '12,048', badge: true },
      { key: 'Longest path', value: '9 hops', badge: true },
    ],
  },
  {
    period: 'Past week',
    rows: [
      { key: 'Most paths found', value: '300', badge: true },
      { key: 'Most articles in paths', value: '11' },
      { key: 'Most articles explored', value: '5,211' },
      { key: 'Longest path', value: '8 hops' },
    ],
  },
  {
    period: 'Past day',
    rows: [
      { key: 'Most paths found', value: '300' },
      { key: 'Most articles in paths', value: '9', badge: true },
      { key: 'Most articles explored', value: '3,892', badge: true },
      { key: 'Longest path', value: '7 hops', badge: true },
    ],
  },
];

const meta = {
  title: 'WikiLinks/WorldwideLeaderboard',
  component: RecordsSection,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof RecordsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    periods: DEMO_PERIODS,
  },
};

export const WithRecord: Story = {
  args: {
    periods: DEMO_PERIODS,
  },
};

export const SinglePeriod: Story = {
  args: {
    periods: [DEMO_PERIODS[0]],
  },
};
