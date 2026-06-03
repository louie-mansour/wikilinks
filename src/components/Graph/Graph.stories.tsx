import type { Meta, StoryObj } from '@storybook/react';
import { Graph } from './Graph';
import type { GraphEdge, GraphNode } from './Graph';

const meta = {
  title: 'WikiLinks/Graph',
  component: Graph,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'sand' },
  },
} satisfies Meta<typeof Graph>;

export default meta;
type Story = StoryObj<typeof meta>;

/* ────────────────────────────────────────
   Sample data — mirrors wikilinks-v4.html
──────────────────────────────────────── */
const NODES: GraphNode[] = [
  { id: 'einstein',  label: 'Albert Einstein',       top: 4,  left: 43, variant: 'start' },
  { id: 'history',   label: 'History of physics',    top: 22, left: 10 },
  { id: 'relativity',label: 'Special Relativity',    top: 20, left: 30 },
  { id: 'nobel',     label: 'Nobel Prize in Physics', top: 18, left: 47, rarity: 'uncommon' },
  { id: 'physics',   label: 'Physics',               top: 20, left: 55, variant: 'active', rarity: 'first' },
  { id: 'germany',   label: 'Germany',               top: 22, left: 69 },
  { id: 'science',   label: 'Science',               top: 24, left: 77 },
  { id: 'wave',      label: 'Wave function',         top: 44, left: 57, variant: 'active', rarity: 'rare' },
  { id: 'planck',    label: 'Max Planck',            top: 46, left: 68, rarity: 'uncommon' },
  { id: 'quantum',   label: 'Quantum mechanics',     top: 78, left: 43, variant: 'end' },
];

const EDGES: GraphEdge[] = [
  { x1: 50, y1: 8,  x2: 62, y2: 25, active: true },
  { x1: 62, y1: 25, x2: 65, y2: 48, active: true },
  { x1: 65, y1: 48, x2: 50, y2: 82, active: true },
  { x1: 50, y1: 8,  x2: 18, y2: 30 },
  { x1: 50, y1: 8,  x2: 28, y2: 28 },
  { x1: 50, y1: 8,  x2: 38, y2: 25 },
  { x1: 50, y1: 8,  x2: 72, y2: 28 },
  { x1: 50, y1: 8,  x2: 80, y2: 32 },
];

/* ────────────────────────────────────────
   Default
──────────────────────────────────────── */
export const Default: Story = {
  args: {
    nodes: NODES,
    edges: EDGES,
  },
};

/* ────────────────────────────────────────
   EmptyGraph — no nodes or edges yet
──────────────────────────────────────── */
export const EmptyGraph: Story = {
  args: {
    nodes: [],
    edges: [],
  },
};

/* ────────────────────────────────────────
   StartEndOnly — just the two endpoint nodes
──────────────────────────────────────── */
export const StartEndOnly: Story = {
  args: {
    nodes: [
      { id: 'start', label: 'Albert Einstein', top: 10, left: 43, variant: 'start' },
      { id: 'end',   label: 'Quantum mechanics', top: 82, left: 43, variant: 'end' },
    ],
    edges: [],
  },
};
