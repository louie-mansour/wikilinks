import type { Meta, StoryObj } from '@storybook/react';
import { RevealResultBanner } from './RevealResultBanner';

const meta = {
  title: 'WikiLinks/RevealResultBanner',
  component: RevealResultBanner,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof RevealResultBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Won: Story = {
  args: {
    outcome: 'won',
    answer: 'World War II',
  },
};

export const Lost: Story = {
  args: {
    outcome: 'lost',
    answer: 'World War II',
  },
};
