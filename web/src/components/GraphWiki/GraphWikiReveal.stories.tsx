import type { Meta, StoryObj } from '@storybook/react';
import { GraphWikiReveal } from './GraphWikiReveal';
import type { RevealGraphData } from '../../data/revealGraph';

const HIDDEN_ID = 'placeholder-day-1';

/** One `unknown` node, a mix of `named` (revealed via neighbor reveal) and
 *  `blank` (revealed only via path reveal, not yet independently named)
 *  nodes — the steady state during an in-progress Reveal-mode round. */
const ALL_STATES: RevealGraphData = {
  nodes: [
    { id: 'Nikola Tesla', label: 'Nikola Tesla', state: 'named' },
    { id: 'Electricity', label: 'Electricity', state: 'named' },
    { id: 'Magnetism', label: 'Magnetism', state: 'named' },
    { id: 'blank-1', state: 'blank' },
    { id: 'blank-2', state: 'blank' },
    { id: HIDDEN_ID, variant: 'hidden-end', label: 'Unknown', state: 'unknown' },
  ],
  links: [
    { source: 'Nikola Tesla', target: 'Electricity' },
    { source: 'Nikola Tesla', target: 'Magnetism' },
    { source: 'Electricity', target: 'blank-1' },
    { source: 'blank-1', target: 'blank-2' },
    { source: 'blank-2', target: HIDDEN_ID },
  ],
};

/** Same graph, but with the hidden node and both blank nodes now `named`
 *  with real titles — the post win/loss full-reveal transition (issue 07
 *  drives this; the component just needs to render whatever state it's
 *  given). `blank → named` picks up a label for the first time; `unknown →
 *  named` additionally flips `variant` from `hidden-end` to `end`. */
const POST_REVEAL: RevealGraphData = {
  nodes: [
    { id: 'Nikola Tesla', label: 'Nikola Tesla', state: 'named' },
    { id: 'Electricity', label: 'Electricity', state: 'named' },
    { id: 'Magnetism', label: 'Magnetism', state: 'named' },
    { id: 'blank-1', label: 'Electromagnetism', state: 'named' },
    { id: 'blank-2', label: 'Electric motor', state: 'named' },
    { id: HIDDEN_ID, variant: 'end', label: 'Alternating current', state: 'named' },
  ],
  links: ALL_STATES.links,
};

const meta = {
  title: 'WikiLinks/GraphWikiReveal',
  component: GraphWikiReveal,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'sand' },
  },
} satisfies Meta<typeof GraphWikiReveal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** All three node states visible at once: `named` (filled), `blank` (dashed
 *  outline, unlabeled), and the single `unknown` node showing "Unknown". */
export const AllStates: Story = {
  args: { graphData: ALL_STATES },
};

/** Hover a `named` node to see its title tooltip. `blank` nodes show nothing
 *  on hover (they have no title to reveal); the `unknown` node always shows
 *  "Unknown" on-canvas regardless of hover. */
export const HoverNamedNode: Story = {
  args: { graphData: ALL_STATES },
  parameters: {
    docs: {
      description: {
        story: 'Hover "Nikola Tesla", "Electricity", or "Magnetism" to see the title tooltip. The two blank nodes and the Unknown node are not hoverable.',
      },
    },
  },
};

/** Post win/loss full reveal: previously-`blank`/`unknown` nodes have
 *  flipped to `named` style with real titles. */
export const PostReveal: Story = {
  args: { graphData: POST_REVEAL },
};

/** Zero-hop edge case: just the initial `unknown` node, before any guess. */
export const InitialUnknownOnly: Story = {
  args: {
    graphData: {
      nodes: [{ id: HIDDEN_ID, variant: 'hidden-end', label: 'Unknown', state: 'unknown' }],
      links: [],
    },
  },
};
