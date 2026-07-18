import type { Meta, StoryObj } from '@storybook/react';
import { ShortestPaths } from './ShortestPaths';

const SORT_OPTIONS = [
  { value: 'interesting', label: 'Sort: most interesting' },
  { value: 'least-interesting', label: 'Sort: least interesting' },
  { value: 'alpha', label: 'Sort: alphabetical' },
];

const SAMPLE_PATHS = [
  {
    id: 1,
    crumbs: [
      { href: '#', label: 'Albert Einstein', highlighted: true, hitCount: 12 },
      { href: '#', label: 'Physics', hitCount: 1 },
      { href: '#', label: 'Wave function', hitCount: 3 },
      { href: '#', label: 'Quantum mechanics', highlighted: true, hitCount: 12 },
    ],
  },
  {
    id: 2,
    crumbs: [
      { href: '#', label: 'Albert Einstein', highlighted: true, hitCount: 12 },
      { href: '#', label: 'Nobel Prize in Physics', hitCount: 7 },
      { href: '#', label: 'Niels Bohr', hitCount: 12 },
      { href: '#', label: 'Quantum mechanics', highlighted: true, hitCount: 12 },
    ],
  },
  {
    id: 3,
    crumbs: [
      { href: '#', label: 'Albert Einstein', highlighted: true, hitCount: 12 },
      { href: '#', label: 'Special Relativity', hitCount: 12 },
      { href: '#', label: 'Max Planck', hitCount: 7 },
      { href: '#', label: 'Quantum mechanics', highlighted: true, hitCount: 12 },
    ],
  },
  {
    id: 4,
    crumbs: [
      { href: '#', label: 'Albert Einstein', highlighted: true, hitCount: 12 },
      { href: '#', label: 'Germany', hitCount: 12 },
      { href: '#', label: 'Max Planck', hitCount: 7 },
      { href: '#', label: 'Quantum mechanics', highlighted: true, hitCount: 12 },
    ],
  },
  {
    id: 5,
    crumbs: [
      { href: '#', label: 'Albert Einstein', highlighted: true, hitCount: 12 },
      { href: '#', label: 'Science', hitCount: 12 },
      { href: '#', label: 'Niels Bohr', hitCount: 12 },
      { href: '#', label: 'Quantum mechanics', highlighted: true, hitCount: 12 },
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
  { href: '#', label: 'Albert Einstein', highlighted: true, hitCount: 12 },
  { href: '#', label: 'Theory of relativity', hitCount: 12 },
  { href: '#', label: 'Spacetime', hitCount: 1 },
  { href: '#', label: 'General relativity', hitCount: 12 },
  { href: '#', label: 'Gravitational wave', hitCount: 3 },
  { href: '#', label: 'LIGO Scientific Collaboration', hitCount: 12 },
  { href: '#', label: 'Quantum mechanics', highlighted: true, hitCount: 12 },
];

const LONG_LABEL_PATH = [
  { href: '#', label: 'Albert Einstein', highlighted: true, hitCount: 12 },
  { href: '#', label: 'Nobel Prize in Physics', hitCount: 12 },
  {
    href: '#',
    label: 'International Union of Pure and Applied Physics',
    hitCount: 7,
  },
  { href: '#', label: 'World Conference on Physics and Sustainable Development', hitCount: 12 },
  { href: '#', label: 'United Nations Educational, Scientific and Cultural Organization', hitCount: 12 },
  { href: '#', label: 'Member states of the United Nations', hitCount: 12 },
  { href: '#', label: 'Quantum mechanics', highlighted: true, hitCount: 12 },
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
          { href: '#', label: 'Albert Einstein', highlighted: true, hitCount: 12 },
          { href: '#', label: 'Patent office', hitCount: 12 },
          { href: '#', label: 'Bern', hitCount: 7 },
          { href: '#', label: 'Canton of Bern', hitCount: 12 },
          { href: '#', label: 'Switzerland', hitCount: 12 },
          { href: '#', label: 'Central Europe', hitCount: 12 },
          { href: '#', label: 'Europe', highlighted: true, hitCount: 12 },
        ],
      },
    ],
    sortOptions: SORT_OPTIONS,
    sortValue: 'interesting',
    remainingCount: 9,
  },
};
