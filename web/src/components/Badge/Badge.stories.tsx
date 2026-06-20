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
  args: { variant: 'first' },
};

export const Rare: Story = {
  args: { variant: 'rare' },
};

export const Uncommon: Story = {
  args: { variant: 'uncommon' },
};

export const Record: Story = {
  args: { variant: 'record' },
};

export const AllVariants: Story = {
  args: { variant: 'first' },
  render: () => (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <Badge variant="first" />
      <Badge variant="rare" />
      <Badge variant="uncommon" />
      <Badge variant="record" />
    </div>
  ),
};
