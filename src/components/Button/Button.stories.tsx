import type { Meta, StoryObj } from '@storybook/react';
import { userEvent, within } from '@storybook/test';
import { Button } from './Button';

const meta = {
  title: 'WikiLinks/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/* ────────────────────────────────────────
   PRIMARY — §7.1
──────────────────────────────────────── */

export const Primary: Story = {
  name: 'Primary / Default',
  args: {
    variant: 'primary',
    children: 'Find paths',
  },
};

export const PrimaryHover: Story = {
  name: 'Primary / Hover',
  args: {
    variant: 'primary',
    children: 'Find paths',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(canvas.getByRole('button'));
  },
};

export const PrimaryActive: Story = {
  name: 'Primary / Active',
  args: {
    variant: 'primary',
    children: 'Find paths',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const btn = canvas.getByRole('button');
    await userEvent.pointer({ target: btn, keys: '[MouseLeft>]' });
  },
};

export const PrimaryFocused: Story = {
  name: 'Primary / Focus (keyboard)',
  args: {
    variant: 'primary',
    children: 'Find paths',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByRole('button').focus();
  },
};

/* ────────────────────────────────────────
   ACTION — §7.9 permalink bar
──────────────────────────────────────── */

export const Action: Story = {
  name: 'Action / Default',
  args: {
    variant: 'action',
    children: 'Copy link',
  },
  parameters: {
    backgrounds: { default: 'white' },
  },
};

export const ActionHover: Story = {
  name: 'Action / Hover',
  args: {
    variant: 'action',
    children: 'Copy link',
  },
  parameters: {
    backgrounds: { default: 'white' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(canvas.getByRole('button'));
  },
};

export const ActionCopied: Story = {
  name: 'Action / Copied state',
  args: {
    variant: 'action',
    children: 'Copied!',
  },
  parameters: {
    backgrounds: { default: 'white' },
  },
};

/* ────────────────────────────────────────
   SECONDARY — §7.9 path list footer
──────────────────────────────────────── */

export const Secondary: Story = {
  name: 'Secondary / Default',
  args: {
    variant: 'secondary',
    children: 'Load 242 more paths',
  },
  parameters: {
    backgrounds: { default: 'sand' },
  },
};

export const SecondaryHover: Story = {
  name: 'Secondary / Hover',
  args: {
    variant: 'secondary',
    children: 'Load 242 more paths',
  },
  parameters: {
    backgrounds: { default: 'sand' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(canvas.getByRole('button'));
  },
};

/* ────────────────────────────────────────
   ALL VARIANTS — overview
──────────────────────────────────────── */

export const AllVariants: Story = {
  name: 'All Variants',
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'sand' },
  },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '20px', padding: '24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-muted)' }}>Primary</span>
        <Button variant="primary">Find paths</Button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-muted)' }}>Action</span>
        <Button variant="action">Copy link</Button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-muted)' }}>Secondary</span>
        <Button variant="secondary">Load 242 more paths</Button>
      </div>
    </div>
  ),
};
