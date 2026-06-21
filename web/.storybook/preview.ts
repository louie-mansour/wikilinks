import type { Preview } from '@storybook/react';
import React from 'react';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import '../src/tokens.css';

const preview: Preview = {
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
  parameters: {
    backgrounds: {
      default: 'sand',
      values: [
        { name: 'sand', value: '#f5ede0' },
        { name: 'white', value: '#fefcf8' },
        { name: 'terra-pale', value: '#faf0ea' },
        { name: 'sage-pale', value: '#edf6ef' },
      ],
    },
    layout: 'centered',
  },
};

export default preview;
