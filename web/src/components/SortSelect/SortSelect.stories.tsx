import type { Meta, StoryObj } from '@storybook/react';
import { SortSelect } from './SortSelect';

const meta = {
  title: 'WikiLinks/SortSelect',
  component: SortSelect,
  tags: ['autodocs'],
} satisfies Meta<typeof SortSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SortOrder: Story = {
  args: {
    label: 'Sort order',
    options: [
      { value: 'interesting', label: 'Sort: most interesting' },
      { value: 'least-interesting', label: 'Sort: least interesting' },
      { value: 'alpha', label: 'Sort: alphabetical' },
    ],
  },
};

export const MaxPaths: Story = {
  args: {
    label: 'Max paths',
    options: [
      { value: '300', label: 'Max: 300' },
      { value: '100', label: 'Max: 100' },
      { value: '500', label: 'Max: 500' },
    ],
  },
};

export const Pair: Story = {
  args: {
    label: 'Sort order',
    options: [{ value: 'interesting', label: 'Sort: most interesting' }],
  },
  render: () => (
    <div style={{ display: 'flex', gap: '8px' }}>
      <SortSelect
        label="Sort order"
        options={[
          { value: 'interesting', label: 'Sort: most interesting' },
          { value: 'least-interesting', label: 'Sort: least interesting' },
          { value: 'alpha', label: 'Sort: alphabetical' },
        ]}
      />
      <SortSelect
        label="Max paths"
        options={[
          { value: '300', label: 'Max: 300' },
          { value: '100', label: 'Max: 100' },
          { value: '500', label: 'Max: 500' },
        ]}
      />
    </div>
  ),
};
