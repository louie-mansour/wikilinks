import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './Badge';

const meta = {
  title: 'WikiLinks/Badge',
  component: Badge,
  tags: ['autodocs'],
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const New: Story = {
  args: { variant: 'new' },
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
  render: () => (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <Badge variant="new" />
      <Badge variant="rare" />
      <Badge variant="uncommon" />
      <Badge variant="record" />
    </div>
  ),
};
