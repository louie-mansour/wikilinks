import type { Meta, StoryObj } from '@storybook/react';
import { Combobox } from './Combobox';

const WIKI_SUGGESTIONS = [
  { title: 'Albert Einstein', featured: true },
  { title: 'Quantum mechanics', featured: true },
  { title: 'Special relativity' },
  { title: 'General relativity' },
  { title: 'Niels Bohr' },
  { title: 'Max Planck' },
  { title: 'Marie Curie', featured: true },
  { title: 'Isaac Newton', featured: true },
  { title: 'Stephen Hawking' },
  { title: 'Richard Feynman' },
  { title: 'Schrödinger equation' },
  { title: 'Wave function' },
  { title: 'Black hole', featured: true },
  { title: 'Big Bang', featured: true },
  { title: 'DNA', featured: true },
  { title: 'Artificial intelligence', featured: true },
];

const meta = {
  title: 'WikiLinks/Combobox',
  component: Combobox,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      story: { height: '360px' },
    },
  },
  args: {
    id: 'wiki-search',
    label: 'Search Wikipedia',
    placeholder: 'Search articles…',
    suggestions: WIKI_SUGGESTIONS,
  },
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

/* ────────────────────────────────────────
   DEFAULT — empty value, featured on focus
──────────────────────────────────────── */
export const Default: Story = {
  name: 'Default',
};

/* ────────────────────────────────────────
   WITH VALUE — pre-filled
──────────────────────────────────────── */
export const WithValue: Story = {
  name: 'With Value',
  args: {
    id: 'wiki-search-prefilled',
    defaultValue: 'Albert Einstein',
  },
};

/* ────────────────────────────────────────
   MOBILE — constrained container
──────────────────────────────────────── */
export const Mobile: Story = {
  name: 'Mobile',
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '280px', width: '100%' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    id: 'wiki-search-mobile',
  },
};
