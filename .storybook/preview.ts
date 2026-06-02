import type { Preview } from '@storybook/react';
import '../src/tokens.css';

const preview: Preview = {
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
