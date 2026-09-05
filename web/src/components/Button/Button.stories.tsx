import type { Meta, StoryObj } from '@storybook/react';
import { userEvent, within } from '@storybook/test';
import { Button } from './Button';

const primaryWidthDecorator = (Story: () => React.JSX.Element) => (
  <div style={{ width: '100%', maxWidth: 440 }}>
    <Story />
  </div>
);

const meta = {
  title: 'WikiLinks/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    loading: {
      control: 'boolean',
      description: 'Primary only — three-dot march animation',
    },
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

export const PrimaryDisabled: Story = {
  name: 'Primary / Disabled',
  decorators: [primaryWidthDecorator],
  args: {
    variant: 'primary',
    children: 'Find paths',
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Muted CTA when both article inputs are empty.',
      },
    },
  },
};

export const PrimaryLoading: Story = {
  name: 'Primary / Loading',
  decorators: [primaryWidthDecorator],
  args: {
    variant: 'primary',
    children: 'Finding paths…',
    loading: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Busy state for the search CTA — label stays for screen readers; three dots march right while `aria-busy` is set.',
      },
    },
  },
};

export const PrimaryLoadingRoulette: Story = {
  name: 'Primary / Loading (picking articles)',
  decorators: [primaryWidthDecorator],
  args: {
    variant: 'primary',
    children: 'Picking articles…',
    loading: true,
  },
};

/* ────────────────────────────────────────
   ACTION — §7.9 path item inline buttons
──────────────────────────────────────── */

export const Action: Story = {
  name: 'Action / Default',
  args: {
    variant: 'action',
    children: 'Copy',
  },
  parameters: {
    backgrounds: { default: 'white' },
  },
};

export const ActionHover: Story = {
  name: 'Action / Hover',
  args: {
    variant: 'action',
    children: 'Copy',
  },
  parameters: {
    backgrounds: { default: 'white' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(canvas.getByRole('button'));
  },
};

export const ActionLink: Story = {
  name: 'Action / Link',
  args: {
    variant: 'action',
    children: 'Link ↗',
  },
  parameters: {
    backgrounds: { default: 'white' },
  },
};

export const ActionPair: Story = {
  name: 'Action / Pair',
  render: () => (
    <div style={{ display: 'flex', gap: '6px' }}>
      <Button variant="action">Copy</Button>
      <Button variant="action">Link ↗</Button>
    </div>
  ),
  parameters: {
    backgrounds: { default: 'white' },
  },
};

/* ────────────────────────────────────────
   PERMALINK — §7.9 share bar
──────────────────────────────────────── */

export const Permalink: Story = {
  name: 'Permalink / Default',
  args: {
    variant: 'permalink',
    children: 'Copy link',
  },
  parameters: {
    backgrounds: { default: 'white' },
  },
};

export const PermalinkHover: Story = {
  name: 'Permalink / Hover',
  args: {
    variant: 'permalink',
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

export const PermalinkCopied: Story = {
  name: 'Permalink / Copied state',
  args: {
    variant: 'permalink',
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', maxWidth: 440 }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--text-label)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-muted)' }}>Primary</span>
        <Button variant="primary">Find paths</Button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', maxWidth: 440 }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--text-label)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-muted)' }}>Primary / Loading</span>
        <Button variant="primary" loading>
          Finding paths…
        </Button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--text-label)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-muted)' }}>Action</span>
        <Button variant="action">Copy</Button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--text-label)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-muted)' }}>Permalink</span>
        <Button variant="permalink">Copy link</Button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--text-label)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-muted)' }}>Secondary</span>
        <Button variant="secondary">Load 242 more paths</Button>
      </div>
    </div>
  ),
};
