import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './Badge';

const meta = {
  title: 'WikiLinks/Badge',
  component: Badge,
  tags: ['autodocs'],
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const First: Story = {
  args: { variant: 'first', children: 'first' },
};

export const Rare: Story = {
  args: { variant: 'rare', children: 'rare' },
};

export const Uncommon: Story = {
  args: { variant: 'uncommon', children: 'uncommon' },
};

export const Record: Story = {
  args: { variant: 'record', children: '★ record' },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <Badge variant="first">first</Badge>
      <Badge variant="rare">rare</Badge>
      <Badge variant="uncommon">uncommon</Badge>
      <Badge variant="record">★ record</Badge>
    </div>
  ),
};
