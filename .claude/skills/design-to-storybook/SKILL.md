---
name: design-to-storybook
description: >
  Converts any hi-fidelity HTML design file and accompanying design system document into
  fully working, production-ready Storybook stories and React + TypeScript components using
  CSS Modules. Use this skill whenever the user asks to build, scaffold, implement, or convert
  UI components into Storybook — even if they just say "add X to Storybook", "make a story
  for Y", "build the [component] component", "turn the design into code", or "set up Storybook
  for this project". Works with any design system and hi-fi HTML reference, regardless of the
  project or design tool used. Covers first-time Storybook project scaffolding AND individual
  component generation from any design system + hi-fi pair.
---

# Design System → Storybook Skill

Converts components from a design system document and hi-fi HTML reference into fully working
React + TypeScript + CSS Modules Storybook components. Works with any design system and any
hi-fi HTML design file.

---

## Before you start

You need two inputs. Ask the user to provide them if not already in context:

1. **Design system document** — a Markdown (or other text) file describing color tokens,
   typography, spacing, component specs, motion rules, and accessibility requirements.
2. **Hi-fi HTML file** — the authoritative visual reference. Used to resolve anything
   ambiguous or missing in the design system.

Once you have both, read them fully before writing any code. Do not guess at token values
or component behaviour — derive everything from the provided documents.

Also check:
- Whether a Storybook project already exists (`.storybook/` present) — if not, run Part A first.
- What components already exist in `src/` to avoid duplication.

---

## Part A — First-time Storybook scaffolding

Run this once per project. Skip if `.storybook/` already exists.

### 1. Scaffold the project

```bash
npm create vite@latest . -- --template react-ts
npm install
npx storybook@latest init
```

When Storybook's init prompt asks about the framework, select **Vite + React**.

### 2. Install dependencies

```bash
npm install --save-dev @storybook/addon-essentials @storybook/addon-interactions @storybook/test
```

### 3. Extract and create `src/tokens.css`

Read the design system's color, typography, spacing, and radius tokens. Create a single
`src/tokens.css` file with all of them as CSS custom properties on `:root`.

**Rules:**

- This is the **only** file that may contain raw values (hex, px, etc.)
- Every token name must come from the design system — do not invent names
- Include base resets and font-smoothing here so they apply globally

```css
/* src/tokens.css — generated from design system */
:root {
  /* paste all tokens from the design system here */
}

*, *::before, *::after { box-sizing: border-box; }

body {
  font-family: var(--font-ui); /* use the token name from the design system */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
```

### 4. Configure `.storybook/preview.ts`

Extract the page background color and any theme surfaces from the design system to populate
the backgrounds list. Use the primary page background as the default.

```ts
import type { Preview } from '@storybook/react';
import '../src/tokens.css';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: '<name-of-primary-background>', // from design system
      values: [
        // derive from design system surface tokens
        { name: '...', value: '...' },
      ],
    },
    layout: 'centered',
  },
};

export default preview;
```

### 5. Create `.storybook/preview-head.html`

If the design system specifies a web font, inject it here. Copy the exact `<link>` tags
from the design system's typography section.

```html
<!-- .storybook/preview-head.html -->
<!-- paste font imports from the design system here -->
```

If no web font is specified, omit this file.

### 6. Recommended `src/` structure

```
src/
├── tokens.css
└── components/
    └── <ComponentName>/
        ├── <ComponentName>.tsx
        ├── <ComponentName>.module.css
        └── <ComponentName>.stories.tsx
```

---

## Building multiple components concurrently

When the user requests two or more independent components, build them in parallel using
the Agent tool — one agent per component. This is safe because each component lives in
its own subdirectory and the only shared file (`src/tokens.css`) is read-only by the time
Part B runs.

**Sequencing rules:**

1. Complete Part A (scaffolding + `tokens.css`) in the current agent before spawning any
   sub-agents — all Part B agents depend on `tokens.css` existing.
2. Identify dependency order among the requested components. Atoms (buttons, inputs, badges)
   must finish before composites that import them (search bars, modals, nav items).
3. Spawn one Agent call per leaf-level (no-dependency) component in a single message so
   they run in parallel. Wait for all to complete, then spawn the next wave for composites.

**Each sub-agent prompt must include:**
- The component name and its entry in the design system
- The path to the design system document and hi-fi HTML file
- The path to `src/tokens.css` (already written by Part A)
- The full Part B instructions from this skill (Steps 1–5)
- An instruction to perform the self-check before finishing

Do not spawn sub-agents for composite components whose atoms haven't been built yet —
always resolve atom dependencies in an earlier wave first.

---

## Part B — Building a component

### Step 1 — Identify the component(s)

Read the design system's component section (usually a numbered list of components with
specs per variant). Map the user's request to the relevant entry.

If the design system doesn't list components explicitly, derive them from the hi-fi HTML:
look for repeated patterns, BEM class names, or clearly grouped UI elements.

For composite components (e.g. a search bar made of an input + button), identify all
sub-components and build bottom-up: atoms first, composites after.

### Step 2 — Write `<Component>.tsx`

Derive the props interface from the design system's variant table for that component.
Every documented variant should map to a prop value (usually a union type).

```tsx
import styles from './ComponentName.module.css';

// Derive from design system variant table
type VariantName = 'default' | 'variant-a' | 'variant-b';

interface ComponentNameProps {
  variant?: VariantName;
  // add other props from the design system spec
  className?: string;
}

export function ComponentName({ variant = 'default', className }: ComponentNameProps) {
  return (
    <div className={`${styles.root} ${styles[variant]} ${className ?? ''}`}>
      {/* implement from hi-fi HTML structure */}
    </div>
  );
}
```

For interactive components (inputs, dropdowns, buttons), check the design system's
accessibility section and implement any required ARIA attributes and keyboard behaviour
directly in the component — not just in stories.

### Step 3 — Write `<Component>.module.css`

```css
/* Always first */
@import '../../tokens.css'; /* adjust path depth as needed */

.root {
  /* base styles — use only var(--token-name), never raw values */
}

.variantA { … }
.variantB { … }

/* Motion always last, always gated */
@media (prefers-reduced-motion: no-preference) {
  .root {
    transition: …; /* durations from design system motion section */
  }
  @keyframes animationName {
    /* keyframe values from design system */
  }
}
```

**Non-negotiable rules:**
- Import `tokens.css` first — every module must do this
- No hardcoded values anywhere — only `var(--token-name)`
- Use the exact border width specified in the design system (it may be 1px, 1.5px, 2px — read it)
- All `transition` and `@keyframes` inside `@media (prefers-reduced-motion: no-preference)`
- Apply any cross-browser fixes the design system documents (appearance, isolation, etc.)

### Step 4 — Write `<Component>.stories.tsx` (CSF3)

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { ComponentName } from './ComponentName';

const meta = {
  title: '<ProjectName>/<ComponentName>', // use the project name from the design system
  component: ComponentName,
  tags: ['autodocs'],
} satisfies Meta<typeof ComponentName>;

export default meta;
type Story = StoryObj<typeof meta>;
```

**Story coverage rules:**
- Every variant documented in the design system needs a story
- Every significant interactive state (hover, focus, disabled, loading) needs a story
- If the design system specifies mobile breakpoints for this component, add a story
  using the `viewport` addon or a wrapper with a constrained width
- Name stories after the design system's own variant names, not generic ones like `Story1`

### Step 5 — Self-check before presenting

- [ ] All CSS uses `var(--token-name)` — no hardcoded values
- [ ] Border widths match the design system exactly
- [ ] All motion is inside `prefers-reduced-motion: no-preference`
- [ ] ARIA attributes and keyboard behaviour match the design system's accessibility section
- [ ] Every documented variant has a corresponding story
- [ ] Cross-browser fixes from the design system are applied
- [ ] Props interface covers all variants in the component spec
- [ ] CSS Module starts with `@import '../../tokens.css'`

---

## Working without a complete design system

Sometimes the design system is incomplete or missing certain details. Resolution order:

1. **Design system document** — primary source, always preferred
2. **Hi-fi HTML file** — inspect class names, inline styles, and computed values
3. **Ask the user** — if both sources are silent on something, ask rather than guess

Never invent token names, color values, or behaviour. If a value isn't in either document,
flag it to the user explicitly before proceeding.

---

## Common pitfalls

- **Don't reuse token names across projects.** Token names come from the provided design
  system only. A new project may use completely different names for the same concept.
- **Composite components need their atoms first.** If a user asks for a search bar and it
  contains a combobox and a button, build those individually before composing them.
- **Animation durations are intentional.** Copy keyframe timings exactly from the design
  system's motion section — staggered durations are often deliberate design decisions.
- **Breakpoints belong in the component, not just stories.** If the design system documents
  a mobile layout change for a component, implement it in the CSS Module with a `@media`
  query, then reference it in a story.
- **ARIA patterns are required, not optional.** If the design system documents a combobox,
  accordion, modal, or other interactive pattern with ARIA requirements, implement the full
  pattern — keyboard navigation included.
