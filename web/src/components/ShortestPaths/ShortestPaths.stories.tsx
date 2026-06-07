import type { Meta, StoryObj } from '@storybook/react';
import { ShortestPaths } from './ShortestPaths';

const SORT_OPTIONS = [
  { value: 'interesting', label: 'Sort: most interesting' },
  { value: 'alpha', label: 'Sort: alphabetical' },
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
    sortValue: 'interesting',
    remainingCount: 242,
  },
};

export const AllLoaded: Story = {
  args: {
    title: '5 shortest paths — 4 hops each',
    paths: SAMPLE_PATHS,
    sortOptions: SORT_OPTIONS,
    sortValue: 'interesting',
    remainingCount: 0,
  },
};

export const FewPaths: Story = {
  args: {
    title: '2 shortest paths — 3 hops each',
    paths: SAMPLE_PATHS.slice(0, 2),
    sortOptions: SORT_OPTIONS,
  },
};

const SEVEN_HOP_PATH = [
  { href: '#', label: 'Albert Einstein', highlighted: true },
  { href: '#', label: 'Theory of relativity' },
  { href: '#', label: 'Spacetime', tag: 'new' as const },
  { href: '#', label: 'General relativity' },
  { href: '#', label: 'Gravitational wave', tag: 'rare' as const },
  { href: '#', label: 'LIGO Scientific Collaboration' },
  { href: '#', label: 'Quantum mechanics', highlighted: true },
];

const LONG_LABEL_PATH = [
  { href: '#', label: 'Albert Einstein', highlighted: true },
  { href: '#', label: 'Nobel Prize in Physics' },
  {
    href: '#',
    label: 'International Union of Pure and Applied Physics',
    tag: 'uncommon' as const,
  },
  { href: '#', label: 'World Conference on Physics and Sustainable Development' },
  { href: '#', label: 'United Nations Educational, Scientific and Cultural Organization' },
  { href: '#', label: 'Member states of the United Nations' },
  { href: '#', label: 'Quantum mechanics', highlighted: true },
];

export const SevenHops: Story = {
  args: {
    title: '12 shortest paths — 7 hops each',
    paths: [
      { id: '7h-1', crumbs: SEVEN_HOP_PATH },
      { id: '7h-2', crumbs: LONG_LABEL_PATH },
      {
        id: '7h-3',
        crumbs: [
          { href: '#', label: 'Albert Einstein', highlighted: true },
          { href: '#', label: 'Patent office' },
          { href: '#', label: 'Bern', tag: 'uncommon' as const },
          { href: '#', label: 'Canton of Bern' },
          { href: '#', label: 'Switzerland' },
          { href: '#', label: 'Central Europe' },
          { href: '#', label: 'Europe', highlighted: true },
        ],
      },
    ],
    sortOptions: SORT_OPTIONS,
    sortValue: 'interesting',
    remainingCount: 9,
  },
};
