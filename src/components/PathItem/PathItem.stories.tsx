import type { Meta, StoryObj } from '@storybook/react';
import { PathItem } from './PathItem';

const meta = {
  title: 'WikiLinks/PathItem',
  component: PathItem,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'white' },
  },
} satisfies Meta<typeof PathItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithFirstTag: Story = {
  args: {
    number: 1,
    crumbs: [
      { href: '#', label: 'Albert Einstein', highlighted: true },
      { href: '#', label: 'Physics', tag: 'new' },
      { href: '#', label: 'Wave function', tag: 'rare' },
      { href: '#', label: 'Quantum mechanics', highlighted: true },
    ],
  },
};

export const WithUncommonTag: Story = {
  args: {
    number: 2,
    crumbs: [
      { href: '#', label: 'Albert Einstein', highlighted: true },
      { href: '#', label: 'Nobel Prize in Physics', tag: 'uncommon' },
      { href: '#', label: 'Niels Bohr' },
      { href: '#', label: 'Quantum mechanics', highlighted: true },
    ],
  },
};

export const NoTags: Story = {
  args: {
    number: 5,
    crumbs: [
      { href: '#', label: 'Albert Einstein', highlighted: true },
      { href: '#', label: 'Science' },
      { href: '#', label: 'Niels Bohr' },
      { href: '#', label: 'Quantum mechanics', highlighted: true },
    ],
  },
};

export const SevenHops: Story = {
  args: {
    number: 1,
    crumbs: [
      { href: '#', label: 'Albert Einstein', highlighted: true },
      { href: '#', label: 'Theory of relativity' },
      { href: '#', label: 'Spacetime', tag: 'new' },
      { href: '#', label: 'General relativity' },
      { href: '#', label: 'Gravitational wave', tag: 'rare' },
      { href: '#', label: 'LIGO Scientific Collaboration' },
      { href: '#', label: 'Quantum mechanics', highlighted: true },
    ],
  },
};

export const MultipleItems: Story = {
  render: () => (
    <div style={{ background: 'var(--white)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1.5px solid var(--sand-mid)' }}>
      <PathItem
        number={1}
        crumbs={[
          { href: '#', label: 'Albert Einstein', highlighted: true },
          { href: '#', label: 'Physics', tag: 'new' },
          { href: '#', label: 'Wave function', tag: 'rare' },
          { href: '#', label: 'Quantum mechanics', highlighted: true },
        ]}
      />
      <PathItem
        number={2}
        crumbs={[
          { href: '#', label: 'Albert Einstein', highlighted: true },
          { href: '#', label: 'Nobel Prize in Physics', tag: 'uncommon' },
          { href: '#', label: 'Niels Bohr' },
          { href: '#', label: 'Quantum mechanics', highlighted: true },
        ]}
      />
      <PathItem
        number={3}
        crumbs={[
          { href: '#', label: 'Albert Einstein', highlighted: true },
          { href: '#', label: 'Special Relativity' },
          { href: '#', label: 'Max Planck', tag: 'uncommon' },
          { href: '#', label: 'Quantum mechanics', highlighted: true },
        ]}
      />
    </div>
  ),
};
