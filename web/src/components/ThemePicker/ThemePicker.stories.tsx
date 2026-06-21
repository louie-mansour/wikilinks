import type { Meta, StoryObj } from '@storybook/react';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { ThemePicker } from './ThemePicker';

const meta = {
  title: 'WikiLinks/ThemePicker',
  component: ThemePicker,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'sand' },
  },
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof ThemePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
