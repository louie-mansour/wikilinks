import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Combobox, type ComboboxProps, type Suggestion } from './Combobox';

const WIKI_SUGGESTIONS: Suggestion[] = [
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

function filterLocalSuggestions(all: Suggestion[], query: string): Suggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return all
    .filter((s) => s.title.toLowerCase().includes(q))
    .slice(0, 7);
}

function ComboboxDemo({
  allSuggestions,
  defaultValue = '',
  ...props
}: Omit<ComboboxProps, 'suggestions' | 'value' | 'onChange'> & {
  allSuggestions: Suggestion[];
}) {
  const [value, setValue] = useState(defaultValue);
  const suggestions = filterLocalSuggestions(allSuggestions, value);

  return (
    <Combobox
      {...props}
      value={value}
      onChange={setValue}
      suggestions={suggestions}
    />
  );
}

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
    suggestions: [],
  },
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

/* ────────────────────────────────────────
   DEFAULT — empty value, type to filter
──────────────────────────────────────── */
export const Default: Story = {
  name: 'Default',
  render: (args) => (
    <ComboboxDemo {...args} allSuggestions={WIKI_SUGGESTIONS} />
  ),
};

/* ────────────────────────────────────────
   WITH VALUE — pre-filled
──────────────────────────────────────── */
export const WithValue: Story = {
  name: 'With Value',
  render: (args) => (
    <ComboboxDemo
      {...args}
      id="wiki-search-prefilled"
      allSuggestions={WIKI_SUGGESTIONS}
      defaultValue="Albert Einstein"
    />
  ),
};

export const LongValue: Story = {
  name: 'Long Value',
  render: (args) => (
    <ComboboxDemo
      {...args}
      id="wiki-search-long"
      allSuggestions={WIKI_SUGGESTIONS}
      defaultValue="United Nations Educational, Scientific and Cultural Organization"
    />
  ),
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
  render: (args) => (
    <ComboboxDemo {...args} id="wiki-search-mobile" allSuggestions={WIKI_SUGGESTIONS} />
  ),
};
