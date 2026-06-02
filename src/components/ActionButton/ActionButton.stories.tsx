import type { Meta, StoryObj } from '@storybook/react';
import { ActionButton } from './ActionButton';

const meta = {
  title: 'WikiLinks/ActionButton',
  component: ActionButton,
  tags: ['autodocs'],
} satisfies Meta<typeof ActionButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Copy: Story = {
  args: { children: 'Copy' },
};

export const Link: Story = {
  args: { children: 'Link ↗' },
};

export const Pair: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '6px' }}>
      <ActionButton>Copy</ActionButton>
      <ActionButton>Link ↗</ActionButton>
    </div>
  ),
};
