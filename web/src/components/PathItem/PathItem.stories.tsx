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
      { href: '#', label: 'Albert Einstein', highlighted: true, hitCount: 12 },
      { href: '#', label: 'Physics', hitCount: 1 },
      { href: '#', label: 'Wave function', hitCount: 3 },
      { href: '#', label: 'Quantum mechanics', highlighted: true, hitCount: 12 },
    ],
  },
};

export const WithUncommonTag: Story = {
  args: {
    number: 2,
    crumbs: [
      { href: '#', label: 'Albert Einstein', highlighted: true, hitCount: 12 },
      { href: '#', label: 'Nobel Prize in Physics', hitCount: 7 },
      { href: '#', label: 'Niels Bohr', hitCount: 12 },
      { href: '#', label: 'Quantum mechanics', highlighted: true, hitCount: 12 },
    ],
  },
};

export const NoTags: Story = {
  args: {
    number: 5,
    crumbs: [
      { href: '#', label: 'Albert Einstein', highlighted: true, hitCount: 12 },
      { href: '#', label: 'Science', hitCount: 12 },
      { href: '#', label: 'Niels Bohr', hitCount: 12 },
      { href: '#', label: 'Quantum mechanics', highlighted: true, hitCount: 12 },
    ],
  },
};

export const SevenHops: Story = {
  args: {
    number: 1,
    crumbs: [
      { href: '#', label: 'Albert Einstein', highlighted: true, hitCount: 12 },
      { href: '#', label: 'Theory of relativity', hitCount: 12 },
      { href: '#', label: 'Spacetime', hitCount: 1 },
      { href: '#', label: 'General relativity', hitCount: 12 },
      { href: '#', label: 'Gravitational wave', hitCount: 3 },
      { href: '#', label: 'LIGO Scientific Collaboration', hitCount: 12 },
      { href: '#', label: 'Quantum mechanics', highlighted: true, hitCount: 12 },
    ],
  },
};

export const MultipleItems: Story = {
  args: {
    number: 1,
    crumbs: [{ href: '#', label: 'Example', hitCount: 12 }],
  },
  render: () => (
    <div style={{ background: 'var(--white)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1.5px solid var(--sand-mid)' }}>
      <PathItem
        number={1}
        crumbs={[
          { href: '#', label: 'Albert Einstein', highlighted: true, hitCount: 12 },
          { href: '#', label: 'Physics', hitCount: 1 },
          { href: '#', label: 'Wave function', hitCount: 3 },
          { href: '#', label: 'Quantum mechanics', highlighted: true, hitCount: 12 },
        ]}
      />
      <PathItem
        number={2}
        crumbs={[
          { href: '#', label: 'Albert Einstein', highlighted: true, hitCount: 12 },
          { href: '#', label: 'Nobel Prize in Physics', hitCount: 7 },
          { href: '#', label: 'Niels Bohr', hitCount: 12 },
          { href: '#', label: 'Quantum mechanics', highlighted: true, hitCount: 12 },
        ]}
      />
      <PathItem
        number={3}
        crumbs={[
          { href: '#', label: 'Albert Einstein', highlighted: true, hitCount: 12 },
          { href: '#', label: 'Special Relativity', hitCount: 12 },
          { href: '#', label: 'Max Planck', hitCount: 7 },
          { href: '#', label: 'Quantum mechanics', highlighted: true, hitCount: 12 },
        ]}
      />
    </div>
  ),
};
