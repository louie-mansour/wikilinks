import type { Meta, StoryObj } from '@storybook/react';
import { FeedbackWidget } from './FeedbackWidget';

const meta = {
  title: 'WikiLinks/FeedbackWidget',
  component: FeedbackWidget,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof FeedbackWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onRate: (rating) => new Promise((resolve) => setTimeout(() => resolve(`demo-${rating}`), 300)),
    onSubmitComment: () => new Promise((resolve) => setTimeout(resolve, 300)),
  },
};
