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
    urlPrefix: 'wikilinks.app/s/',
    urlCode: 'aE3f9k',
  },
};

export const LongCode: Story = {
  args: {
    urlPrefix: 'wikilinks.app/s/',
    urlCode: 'xK2mP9qR4',
  },
};
