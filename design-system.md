# WikiLinks Design System

> Extracted from `wikilinks-v4.html` — authoritative reference for all UI implementation.

---

## 1. Design Principles

**Warm minimalism.** The palette is built on sand, parchment, and terracotta — a deliberate departure from cold tech-blues. Every surface feels like aged paper rather than a dashboard.

**Data as typography.** Large numeric stats use a display typeface at aggressive letter-spacing (`-3px` at 60px), treating numbers as expressive objects rather than mere readouts.

**Motion as reward, not noise.** Transitions are intentional and subtle — the primary button sweeps a shine on hover, nodes pulse gently to signal rarity. All motion is gated behind `prefers-reduced-motion: no-preference`.

**Information hierarchy through surface, not just size.** Sections are distinguished by background tint (sage-pale, terra-pale, clay-pale) rather than heavy borders or shadows, keeping the layout airy at high data density.

---

## 2. Color Tokens

All colors are defined as CSS custom properties on `:root`.

```css
:root {
  /* Surfaces */
  --sand:        #f5ede0;
  --sand-mid:    #e8d9c4;
  --sand-dark:   #d4c0a4;

  /* Text */
  --ink:         #2c2416;
  --ink-muted:   #7a6a52;
  --ink-faint:   #b8a888;

  /* Primary — Terracotta */
  --terra:       #c4572a;
  --terra-dark:  #a8461f;  /* button hover state */
  --terra-light: #f2d5c8;
  --terra-pale:  #faf0ea;

  /* Secondary — Sage */
  --sage:        #4a7c59;
  --sage-light:  #c8dece;
  --sage-pale:   #edf6ef;

  /* Accent — Clay */
  --clay:        #e8a05a;
  --clay-border: #f5dbb0;  /* clay card borders, record badge border */
  --clay-pale:   #fdf2e3;

  /* Base */
  --white:       #fefcf8;
}
```

### Surfaces
| Token | Value | Usage |
|---|---|---|
| `--white` | `#fefcf8` | Primary card background, top bar, dropdowns |
| `--sand` | `#f5ede0` | Page background, path list header, input background |
| `--sand-mid` | `#e8d9c4` | Standard borders, dividers, dropdown borders |
| `--sand-dark` | `#d4c0a4` | Stronger dividers, path separator arrows, uncommon legend dot border |

### Text
| Token | Value | Usage |
|---|---|---|
| `--ink` | `#2c2416` | Primary text, headings, highlighted crumbs |
| `--ink-muted` | `#7a6a52` | Secondary labels, record keys, node text |
| `--ink-faint` | `#b8a888` | Placeholders, chevron icon, action button base color |

### Primary — Terracotta
| Token | Value | Usage |
|---|---|---|
| `--terra` | `#c4572a` | CTA button, active node border, focus rings, links, "first" tag |
| `--terra-dark` | `#a8461f` | Button hover background |
| `--terra-light` | `#f2d5c8` | Focus-ring box-shadow on inputs, "first" node glow |
| `--terra-pale` | `#faf0ea` | Hover background on crumbs, options, buttons; bento hops card bg |

### Secondary — Sage
| Token | Value | Usage |
|---|---|---|
| `--sage` | `#4a7c59` | Paths found stat number, live pill text/dot, "rare" tag bg |
| `--sage-light` | `#c8dece` | Live pill background, bento paths card border |
| `--sage-pale` | `#edf6ef` | Bento paths card background |

### Accent — Clay
| Token | Value | Usage |
|---|---|---|
| `--clay` | `#e8a05a` | Search time stat number |
| `--clay-border` | `#f5dbb0` | Bento time card border, record badge border |
| `--clay-pale` | `#fdf2e3` | Bento time card background, record badge background |

---

## 3. Typography

Lora is dropped in favour of Figtree throughout. Italic weight (400i) is loaded so existing italic uses (tagline, stat subtitles) continue to render correctly using Figtree's italic variant.

### Font Families
| Token | Value | Role |
|---|---|---|
| `--font-display` | `'Figtree', system-ui, sans-serif` | Wordmark, large stats, section headings |
| `--font-body` | `'Figtree', system-ui, sans-serif` | Tagline and stat subtitles (italic via `font-style: italic`) |
| `--font-ui` | `'Figtree', system-ui, sans-serif` | All interactive controls, body copy, labels |

> All three tokens resolve to the same stack. Keeping three tokens in `:root` preserves the ability to swap any one role independently later without touching component files.

**Google Fonts (Figtree only):**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet">
```

> `display=swap` ensures text is visible in the system fallback font while Figtree loads, preventing invisible text (FOIT) across all browsers.

### Type Scale

Sizes are defined as CSS custom properties in `tokens.css` and referenced via `var(--text-*)` throughout components.

| Token | Size | Role | Weight | Style | Notes |
|---|---|---|---|---|---|
| `--text-wordmark` | 23px | Wordmark | 800 | normal | `letter-spacing: -0.5px` |
| `--text-title` | 17px | Path list title | 700 | normal | Section header |
| `--text-body` | 15px | Body / inputs | 400 | normal | Base `font-size` on `body` |
| `--text-ui` | 14px | Tagline, crumb, dropdown | 400–700 | normal/italic | Tagline uses italic |
| `--text-small` | 13px | Record key, copy button | 400–600 | normal | |
| `--text-label` | 12px | Input label, live pill | 600–700 | normal | Uppercase labels use `letter-spacing: 0.07em` |
| `--text-caption` | 11px | Legend / stat label | 700 | normal | Uppercase, `letter-spacing: 0.07em` |
| `--text-badge` | 10px | Tag / badge | 700 | normal | Pill label |
| `--text-stat-xl` | 61px | Stat — large (paths found) | 800 | normal | `letter-spacing: -3px`, sage color |
| `--text-stat-lg` | 33px | Stat — medium (hops) | 800 | normal | `letter-spacing: -1px` |
| `--text-stat-sm` | 27px | Stat — small (nodes, articles) | 800 | normal | `letter-spacing: -1px` |
| `--text-stat-md` | 29px | Stat — time | 800 | normal | `--clay` color |

---

## 4. Spacing & Layout

### Page Container
```css
.page {
  max-width: 920px;
  margin: 0 auto;
  padding: 0 0 40px;
}
```

### Section Margin Pattern
All sections below the top bar use `margin: 10px–14px 16px 0` on desktop, reducing to `10px 10px 0` on mobile (≤520px).

### Border Radius Tokens
| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `10px` | Nodes, control buttons, action buttons, copy button, select inputs, option icons |
| `--radius-md` | `18px` | Input rows, dropdowns, records card, permalink bar, load-more button, bento cards |
| `--radius-lg` | `26px` | Graph section, path list section |

### Breakpoints

| Breakpoint | What changes |
|---|---|
| `max-width: 520px` | Top bar inputs stack vertically; graph height drops to 320px; bento grid changes from 3-col to 2-col with paths card spanning full width; combo-wrap widens to 260px; page section margins narrow to 10px |
| `max-width: 600px` | Records columns stack vertically (3-col → 1-col); path items stack vertically with down-arrow separators visible and `›` separators hidden; path list header stacks |

---

## 5. Borders

Standard border width is **1.5px** throughout. This is an intentional design decision — do not flatten to 1px.

| Context | Color |
|---|---|
| Top bar bottom | `--sand-mid` |
| Cards, sections, inputs (default) | `--sand-mid` |
| Input row focus | `--terra` |
| Graph section | `--sand-mid` |
| Graph legend | `--sand-mid` |
| Bento paths card | `--sage-light` |
| Bento hops card | `--terra-light` |
| Bento time card | `--clay-border` |
| Node (default) | `--sand-mid` |
| Node (start/end) | `--ink` (2px solid / 2px dashed) |
| Node (active) | `--terra` |
| Record badge | `--clay-border` (1px) |
| Permalink copy btn | `--sand-mid` (hover → `--terra`) |
| Action / ctrl buttons | `--sand-mid` (hover → `--terra`) |

---

## 6. Shadows & Elevation

| Context | Value |
|---|---|
| Combo dropdown | `0 8px 24px rgba(44, 36, 22, 0.10)` |
| Button hover | `0 6px 20px rgba(196, 87, 42, 0.30)` |
| Button active | `0 2px 8px rgba(196, 87, 42, 0.20)` |
| Node glow-terra (peak) | `0 0 0 3px rgba(196,87,42,0.35), 0 0 18px rgba(196,87,42,0.22)` |
| Node glow-sage (peak) | `0 0 0 3px rgba(74,124,89,0.35), 0 0 18px rgba(74,124,89,0.22)` |
| Node glow-sand (peak) | `0 2px 14px rgba(44,36,22,0.12)` |

---

## 7. Component Patterns

### 7.1 Primary Button (`.btn`)

- **Base:** `background: var(--terra)`, `color: var(--white)`, `padding: 12px 28px`, `border-radius: var(--radius-md)`, `font: var(--text-body)/700 var(--font-ui)`, `letter-spacing: 0.01em`, full-width up to 440px max, `::before` shine overlay and `::after` arrow both hidden
- **Hover** *(motion only):* `background: var(--terra-dark)`, `transform: translateY(-2px)`, box-shadow `0 6px 20px rgba(196,87,42,0.30)`, `letter-spacing: 0.04em`; `::before` sweeps shine (`translateX(-100%)` → `translateX(100%)`, 0.45s ease); `::after` arrow fades in
- **Active** *(motion only):* `transform: translateY(0)`, box-shadow `0 2px 8px rgba(196,87,42,0.20)`
- **Focus:** `outline: 2px solid var(--terra)`, `outline-offset: 3px` (via `:focus-visible`)

### 7.2 Autocomplete Combobox (`.combo-wrap`)

- **Base:** Input row `background: var(--sand)`, `border: 1.5px solid var(--sand-mid)`, `border-radius: var(--radius-md)`; input `font: var(--text-body)/600 var(--font-ui)`, `padding: 12px 10px 12px 16px`; leading search icon (`color: var(--ink-faint)`, always visible) signals the field accepts text input; chevron `color: var(--ink-faint)`
- **Focus-within:** `border-color: var(--terra)`, `box-shadow: 0 0 0 3px var(--terra-light)`
- **Dropdown:** `background: var(--white)`, `border: 1.5px solid var(--sand-mid)`, `border-radius: var(--radius-md)`, `box-shadow: 0 8px 24px rgba(44,36,22,0.10)`, `z-index: 100`
- **Option base:** `padding: 10px 14px`, `font: var(--text-ui)/500 var(--font-ui)`, `color: var(--ink-muted)`, bottom border `1px solid var(--sand-mid)`
- **Option hover / aria-selected:** `background: var(--terra-pale)`, `color: var(--terra)`
- **Option match highlight (`<mark>`):** `background: none`, `color: var(--terra)`, `font-weight: 700`
- **No results:** italic, `var(--text-small)`, `var(--ink-faint)`, centered
- **ARIA:** `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"` on input; `role="listbox"` on `<ul>`; `aria-selected` managed per option; keyboard: `ArrowDown/Up` navigate, `Enter` selects, `Escape` closes

### 7.3 Graph Node (`.node`)

- **Default:** `background: var(--sand)`, `border: 1.5px solid var(--sand-mid)`, `border-radius: var(--radius-sm)`, `padding: 5px 12px`, `font: var(--text-label)/500 var(--font-ui)`, `color: var(--ink-muted)`
- **Variant — start:** `border: 2px solid var(--ink)`, `color: var(--ink)`, `font-weight: 700`, `background: var(--white)`, `border-radius: var(--radius-md)`
- **Variant — end:** `border: 2px dashed var(--ink-muted)`, `color: var(--ink)`, `font-weight: 700`, `background: var(--white)`, `border-radius: var(--radius-md)`
- **Variant — active:** `border-color: var(--terra)`, `color: var(--ink)`, `background: var(--terra-pale)`
- **Glow states:** Animated `box-shadow` pulse (see §8). Applied via `.glow-first` (terra), `.glow-rare` (sage), `.glow-uncommon` (sand).

### 7.4 Rarity Tag (`.tag`, `.path-tag`)

Pills applied inline inside node labels and path crumbs.

| Variant | Background | Color |
|---|---|---|
| `first` | `--terra` | `#fff` |
| `rare` | `--sage` | `#fff` |
| `uncommon` | `--sand-mid` | `--ink-muted` |

Base: `font: var(--text-badge)/700 var(--font-ui)`, `padding: 1px 6px`, `border-radius: 8px`, `display: inline-block`, `vertical-align: middle`.

### 7.5 Bento Stat Cards (`.bento-card`)

- **Base:** `background: var(--white)`, `border-radius: var(--radius-md)`, `border: 1.5px solid var(--sand-mid)`
- **Variant — paths (large):** `background: var(--sage-pale)`, `border-color: var(--sage-light)`; stat number uses `var(--sage)`, `var(--text-stat-xl)/800`, `letter-spacing: -3px`; spans 2 grid rows on desktop
- **Variant — hops:** `background: var(--terra-pale)`, `border-color: var(--terra-light)`; stat number uses `var(--terra)`
- **Variant — time:** `background: var(--clay-pale)`, `border-color: var(--clay-border)`; stat number uses `var(--clay)`, `var(--text-stat-md)`
- **Variant — nodes explored:** `background: var(--sand)`, `border-color: var(--sand-dark)`; stat number `var(--text-stat-sm)`, `var(--ink)`
- **Variant — unique articles:** `background: var(--white)`; stat number `var(--text-stat-sm)`, `var(--ink-muted)`

### 7.6 Live Pill (`.bento-live-pill`)

- `background: var(--sage-light)`, `border-radius: 20px`, `padding: 4px 10px`, `font: var(--text-label)/700 var(--font-ui)`, `color: var(--sage)`
- Contains a `6px` circle dot (`background: var(--sage)`)
- Animates via `live-pulse` (see §8)

### 7.7 Control Button (`.ctrl-btn`)

- **Base:** `34×34px`, `background: var(--white)`, `border: 1.5px solid var(--sand-mid)`, `border-radius: var(--radius-sm)`, `font: var(--text-title)/700 var(--font-ui)`, `color: var(--ink-muted)`
- **Hover** *(motion only):* `border-color: var(--terra)`, `color: var(--terra)`
- Transition: `border-color 0.12s, color 0.12s`

### 7.8 Path Item (`.path-item`)

- **Base:** `padding: 14px 20px`, `border-bottom: 1.5px solid var(--sand-mid)`, flex row with `gap: 14px`
- **Hover** *(motion only):* `background: var(--sand)`
- **Crumb link base:** `font: var(--text-ui)/500 var(--font-ui)`, `color: var(--ink-muted)`, `padding: 2px 5px`, `border-radius: 6px`
- **Crumb hover:** `background: var(--terra-pale)`, `color: var(--terra)`
- **Crumb highlighted (`.hl`):** `color: var(--ink)`, `font-weight: 700`
- **Mobile (≤600px):** Stack vertically; `.crumb-sep` (`›`) hidden; `.crumb-arrow` (`↓`) shown between crumbs

### 7.9 Secondary / Ghost Buttons (`.action-btn`, `.permalink-copy`, `.load-more-btn`)

Shared pattern across three components:

- **Base:** `border: 1.5px solid var(--sand-mid)`, `background: transparent` or `var(--sand)`/`var(--white)`, `color: var(--ink-faint)` or `var(--ink-muted)`, `border-radius: var(--radius-sm)` or `var(--radius-md)`, `font: var(--font-ui)`
- **Hover** *(motion only):* `background: var(--terra-pale)`, `border-color: var(--terra)`, `color: var(--terra)`
- Transition: `all 0.12s` or `background 0.12s, border-color 0.12s`

### 7.10 Select (`.path-list-controls select`)

- `padding: 6px 10px`, `border: 1.5px solid var(--sand-mid)`, `border-radius: var(--radius-sm)`, `background: var(--white)`, `color: var(--ink-muted)`, `font: var(--text-small)/500 var(--font-ui)`
- **Cross-browser note:** Native `<select>` appearance varies. Use `appearance: none; -webkit-appearance: none` and add a custom chevron via background-image SVG if visual consistency across browsers is required.

### 7.11 Record Badge (`.rec-badge`)

- `font: var(--text-badge)/700 var(--font-ui)`, `padding: 2px 6px`, `background: var(--clay-pale)`, `color: var(--clay)`, `border: 1px solid var(--clay-border)`, `border-radius: 6px`

---

## 8. Motion & Animation

All keyframe animations and transitions are gated inside `@media (prefers-reduced-motion: no-preference)`. Nothing animates for users who have reduced motion enabled.

### Keyframes

| Name | Duration | Effect | Used on |
|---|---|---|---|
| `glow-terra` | 2s, infinite | `box-shadow` pulses from 2px/0.2 opacity to 3px/0.35 opacity | `.node.glow-first` |
| `glow-sage` | 2.4s, infinite | Same pattern in sage rgba | `.node.glow-rare` |
| `glow-sand` | 2.8s, infinite | Subtle `box-shadow` lift | `.node.glow-uncommon` |
| `live-pulse` | 2s, infinite | `opacity` pulses 1 → 0.6 → 1 | `.bento-live-pill` |

### Transitions

| Element | Transition |
|---|---|
| Input row focus | `border-color 0.15s, box-shadow 0.15s` |
| Combo chevron | `color 0.12s` |
| Dropdown option | `background 0.1s, color 0.1s` |
| Primary button | `background 0.18s, transform 0.12s, box-shadow 0.18s, letter-spacing 0.18s` |
| Button `::before` shine | `transform 0.45s ease` (on hover) |
| Button `::after` arrow | `opacity 0.15s, transform 0.15s` |
| Control button | `border-color 0.12s, color 0.12s` |
| Path item | `background 0.12s` |
| Action / copy buttons | `all 0.12s` |
| Load more button | `all 0.12s` |

General rule: most interactive micro-transitions are **0.12s**. The primary button uses slightly longer durations for a more deliberate feel.

---

## 9. Iconography

**Wordmark icon:** Inline SVG, `16×16px`, white strokes/fills on a `var(--terra)` rounded-square (`border-radius: 8px`, `28×28px` container). `aria-hidden="true"`.

**Chevron (dropdown):** Inline SVG, `12×12px`, `currentColor` stroke, `stroke-width: 1.8`, `stroke-linecap: round`, `stroke-linejoin: round`.

**Graph edges:** SVG `<line>` elements — `var(--sand-dark)` dim at `stroke-width: 1.5`, `var(--terra)` active at `stroke-width: 2.5`.

**Separators / connectors:** Text characters — `→` (between inputs), `›` (desktop crumb separator), `↓` (mobile crumb separator via `.crumb-arrow`).

All icons use `stroke` with `currentColor` or token values; no icon font is used.

---

## 10. Accessibility

- Autocomplete combobox follows the ARIA combobox pattern: `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"` on input; `role="listbox"` + `role="option"` + `aria-selected` on dropdown.
- Keyboard navigation: `ArrowDown/Up` moves focus through options, `Enter` confirms, `Escape` closes.
- Graph section: `aria-label="Path visualization"` on the `<section>`.
- Bento and records sections: `role="region"` with `aria-label`.
- Decorative elements (wordmark icon, live dot, arrow connector): `aria-hidden="true"`.
- Focus ring on primary button: `outline: 2px solid var(--terra)`, `outline-offset: 3px`, via `:focus-visible`.
- Graph control buttons: explicit `aria-label` on each.
- Path list uses semantic `<article>` per path, `<h2>` for the section title.
- All motion is behind `@media (prefers-reduced-motion: no-preference)`.

---

## 11. Cross-Browser Notes

Apply these alongside the component styles. None require separate files — they slot into the relevant component CSS.

### Font rendering
```css
body {
  -webkit-font-smoothing: antialiased;   /* Chrome, Safari, Edge */
  -moz-osx-font-smoothing: grayscale;    /* Firefox on macOS */
  text-rendering: optimizeLegibility;
}
```

### CSS custom properties
Custom properties have full support in all modern browsers (Chrome 49+, Firefox 31+, Safari 9.1+, Edge 16+). No fallbacks needed for the target audience. If IE11 is required, a PostCSS plugin (`postcss-custom-properties`) can inline values at build time.

### `border-radius` on inputs
Safari clips `overflow: hidden` differently on `<input>` elements. Set `border-radius` directly on the `<input>` in addition to the wrapper to prevent jagged corners:
```css
.combo-input-row input[type="text"] {
  border-radius: var(--radius-md);  /* matches wrapper */
}
```

### `appearance` on inputs and selects
```css
input[type="text"],
select {
  -webkit-appearance: none;  /* Safari / older Chrome */
  appearance: none;
}
```
This prevents Safari from applying platform-native inset shadows and rounded corners that override the design.

### `focus-visible` polyfill
`:focus-visible` is supported in Chrome 86+, Firefox 85+, Safari 15.4+. For Safari 15.3 and below, either accept `:focus` as a fallback or use the [focus-visible polyfill](https://github.com/WICG/focus-visible):
```css
/* Fallback for browsers without :focus-visible */
.btn:focus { outline: 2px solid var(--terra); outline-offset: 3px; }
/* Override for browsers that support it — removes ring on mouse click */
.btn:focus:not(:focus-visible) { outline: none; }
```

### `gap` in flexbox
`gap` on flex containers is supported in Chrome 84+, Firefox 63+, Safari 14.1+. For Safari 14.0 and below, use `margin` as a fallback on flex children where gaps are critical (primarily `.inputs-row` and `.path-crumbs`).

### `overflow: hidden` + `border-radius` on Safari
Safari sometimes fails to clip child content to a `border-radius` on the parent. Add `isolation: isolate` to the parent as a fix:
```css
.bento-card,
.graph-section,
.path-list-section {
  isolation: isolate;
}
```

### `1.5px` borders
Sub-pixel border values render correctly in all modern browsers. They may appear as either 1px or 2px on non-retina displays depending on the browser — this is expected and intentional. Do not change to `1px`.

### `box-shadow` as focus ring
`box-shadow: 0 0 0 3px var(--terra-light)` on the input focus state does not respect `border-radius` in older browsers and is clipped by `overflow: hidden`. Ensure `.combo-input-row` does **not** have `overflow: hidden` applied in your component CSS; the current source correctly avoids this.

### `letter-spacing` on buttons
Animating `letter-spacing` via CSS transition is not hardware-accelerated and can cause layout shifts in some browsers. The existing transition (`letter-spacing 0.18s`) is acceptable at the scale of a single button; if jank is observed, remove the `letter-spacing` transition and keep only the remaining button transitions.

### `position: absolute` node layout in the graph
Node elements use `position: absolute` with `top`/`left` percentages. This works consistently across browsers but requires the parent `.graph-section` to have `position: relative` — which the source correctly sets via `overflow: hidden` + implicit containing block. Do not remove `position: relative` from `.graph-section`.

---

## 12. CSS Architecture (Recommended)

```
src/
├── tokens.css          ← All :root custom properties (colors, radii, fonts)
├── reset.css           ← box-sizing, margin/padding reset, body base + font-smoothing
├── typography.css      ← Google Fonts link, font-face notes
├── layout.css          ← .page, .bento-section grid, breakpoints
├── animations.css      ← All @keyframes, wrapped in prefers-reduced-motion
└── components/
    ├── top-bar.css
    ├── combobox.css     ← includes appearance:none fix
    ├── button.css
    ├── graph.css
    ├── bento.css
    ├── records.css
    ├── permalink.css
    └── path-list.css    ← includes select appearance:none fix
```

**Non-negotiable rules:**
- `tokens.css` is imported first; it is the only file that may contain hex values.
- No component file may use a hardcoded hex value — always `var(--token-name)`.
- `animations.css` wraps all `@keyframes` and motion transitions inside `@media (prefers-reduced-motion: no-preference)`.
- Cross-browser fixes (`-webkit-appearance`, `isolation`, font-smoothing) live in the component or reset file they relate to — not scattered inline.
