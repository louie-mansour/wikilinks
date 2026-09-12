# 04: `GraphWikiReveal` canvas component

**What to build:** A new sibling canvas component to `GraphWiki` — not a modification of it — that renders the three node states from `03` and adds hover-to-reveal-title for `named` nodes.

**Blocked by:** 03 (graph accumulation & node states)

**Status:** design agreed, not yet implemented

## Why a new component, not a `GraphWiki` change

`.claude/rules/graphwiki-node-connections.md` explicitly forbids hover tooltips, labels, and other decoration on `GraphWiki` nodes — that contract is scoped to the existing minimal explore/Classic canvas and should stay untouched. `GraphWikiReveal` shares `GraphWiki`'s force-layout logic (same underlying force-graph setup) but is a distinct component free to add interactions `GraphWiki` deliberately excludes.

## Rendering rules

- All nodes are plain circles on the canvas — **no permanent on-canvas labels**, consistent with the force-layout minimalism `GraphWiki` established, even though this component diverges on hover behavior.
- `named` nodes: normal fill, hoverable — hovering shows the article title (tooltip).
- `blank` nodes: distinct muted/outline style so they read as "known to exist, not yet identified" — never hoverable (nothing to show).
- `unknown` node (the hidden target): visually distinct from both (e.g. a fixed style + always shows "Unknown" as a lightweight on-canvas or hover label — pick one consistently), until solved.
- On win/loss full reveal (`07`), `unknown` and any remaining `blank` nodes transition their rendering to `named`-style with real titles.

## Checklist

- [ ] New component created (e.g. `src/components/GraphWiki/GraphWikiReveal.tsx`), sharing force-layout setup with `GraphWiki` but independent of its file/rules scope
- [ ] Renders `named`, `blank`, `unknown` states distinctly per above
- [ ] Hover shows title only for `named` nodes
- [ ] Storybook stories covering all three node states plus the post-reveal (win/loss) `named` transition for previously-`blank`/`unknown` nodes
- [ ] Confirm `GraphWiki.tsx` itself is untouched by this work
