import type { Meta, StoryObj } from '@storybook/react';
import { ShareBar } from './ShareBar';

const meta = {
  title: 'WikiLinks/ShareBar',
  component: ShareBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof ShareBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    shareBaseUrl: 'https://wikilinks.app/s/',
    urlCode: 'aE3f9k',
    onActivate: () => new Promise((resolve) => setTimeout(resolve, 800)),
  },
};

export const LongCode: Story = {
  args: {
    shareBaseUrl: 'https://wikilinks.app/s/',
    urlCode: 'xK2mP9qR4',
    onActivate: () => new Promise((resolve) => setTimeout(resolve, 800)),
  },
};

export const Localhost: Story = {
  args: {
    shareBaseUrl: 'http://localhost:5173/s/',
    urlCode: 'aE3f9k',
    onActivate: () => new Promise((resolve) => setTimeout(resolve, 800)),
  },
};
