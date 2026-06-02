import type { Meta, StoryObj } from '@storybook/react';
import { ShortestPaths } from './ShortestPaths';

const SORT_OPTIONS = [
  { value: 'interesting', label: 'Sort: most interesting' },
  { value: 'alpha', label: 'Sort: alphabetical' },
];

const MAX_OPTIONS = [
  { value: '300', label: 'Max: 300' },
  { value: '100', label: 'Max: 100' },
  { value: '500', label: 'Max: 500' },
];

const SAMPLE_PATHS = [
  {
    id: 1,
    crumbs: [
      { href: '#', label: 'Albert Einstein', highlighted: true },
      { href: '#', label: 'Physics', tag: 'new' as const },
      { href: '#', label: 'Wave function', tag: 'rare' as const },
      { href: '#', label: 'Quantum mechanics', highlighted: true },
    ],
  },
  {
    id: 2,
    crumbs: [
      { href: '#', label: 'Albert Einstein', highlighted: true },
      { href: '#', label: 'Nobel Prize in Physics', tag: 'uncommon' as const },
      { href: '#', label: 'Niels Bohr' },
      { href: '#', label: 'Quantum mechanics', highlighted: true },
    ],
  },
  {
    id: 3,
    crumbs: [
      { href: '#', label: 'Albert Einstein', highlighted: true },
      { href: '#', label: 'Special Relativity' },
      { href: '#', label: 'Max Planck', tag: 'uncommon' as const },
      { href: '#', label: 'Quantum mechanics', highlighted: true },
    ],
  },
  {
    id: 4,
    crumbs: [
      { href: '#', label: 'Albert Einstein', highlighted: true },
      { href: '#', label: 'Germany' },
      { href: '#', label: 'Max Planck', tag: 'uncommon' as const },
      { href: '#', label: 'Quantum mechanics', highlighted: true },
    ],
  },
  {
    id: 5,
    crumbs: [
      { href: '#', label: 'Albert Einstein', highlighted: true },
      { href: '#', label: 'Science' },
      { href: '#', label: 'Niels Bohr' },
      { href: '#', label: 'Quantum mechanics', highlighted: true },
    ],
  },
];

const meta = {
  title: 'WikiLinks/ShortestPaths',
  component: ShortestPaths,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof ShortestPaths>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: '247 shortest paths — 4 hops each',
    paths: SAMPLE_PATHS,
    sortOptions: SORT_OPTIONS,
    maxOptions: MAX_OPTIONS,
    sortValue: 'interesting',
    maxValue: '300',
    remainingCount: 242,
  },
};

export const AllLoaded: Story = {
  args: {
    title: '5 shortest paths — 4 hops each',
    paths: SAMPLE_PATHS,
    sortOptions: SORT_OPTIONS,
    maxOptions: MAX_OPTIONS,
    sortValue: 'interesting',
    maxValue: '300',
    remainingCount: 0,
  },
};

export const FewPaths: Story = {
  args: {
    title: '2 shortest paths — 3 hops each',
    paths: SAMPLE_PATHS.slice(0, 2),
    sortOptions: SORT_OPTIONS,
    maxOptions: MAX_OPTIONS,
  },
};
