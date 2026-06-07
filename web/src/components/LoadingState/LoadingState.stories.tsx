import type { Meta, StoryObj } from '@storybook/react';
import { LoadingState } from './LoadingState';

const meta = {
  title: 'WikiLinks/LoadingState',
  component: LoadingState,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    phase: {
      control: 'radio',
      options: ['articles', 'paths'],
    },
  },
} satisfies Meta<typeof LoadingState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PickingArticles: Story = {
  args: { phase: 'articles' },
};

export const FindingPaths: Story = {
  args: { phase: 'paths' },
};
