import type { Meta, StoryObj } from '@storybook/react';
import { Header } from './Header';

const SUGGESTIONS = [
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
  { title: 'Black hole', featured: true },
  { title: 'Big Bang', featured: true },
  { title: 'DNA', featured: true },
  { title: 'Evolution', featured: true },
  { title: 'Artificial intelligence', featured: true },
  { title: 'World War II', featured: true },
  { title: 'Leonardo da Vinci', featured: true },
];

const meta = {
  title: 'WikiLinks/Header',
  component: Header,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'sand' },
    docs: {
      story: { height: '460px' },
    },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          maxWidth: 920,
          margin: '0 auto',
          padding: '14px 16px 0',
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    startSuggestions: SUGGESTIONS,
    endSuggestions: SUGGESTIONS,
  },
};

export const WithValues: Story = {
  args: {
    startSuggestions: SUGGESTIONS,
    endSuggestions: SUGGESTIONS,
    startValue: 'Albert Einstein',
    endValue: 'Quantum mechanics',
  },
};

export const LongInputs: Story = {
  args: {
    startSuggestions: SUGGESTIONS,
    endSuggestions: SUGGESTIONS,
    startValue: 'International Union of Pure and Applied Physics',
    endValue:
      'United Nations Educational, Scientific and Cultural Organization',
  },
};
