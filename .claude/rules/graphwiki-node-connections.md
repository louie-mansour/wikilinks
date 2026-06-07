# GraphWiki — data, connections & rendering

Applies to: `src/components/GraphWiki/**`, `src/data/buildGraphData.ts`, `src/data/mockSearch.ts`

## Visual rendering — keep nodes simple

`GraphWiki` is a **minimal force-graph canvas**: plain circles and thin lines. Follow `src/components/GraphWiki/GraphWiki.tsx` as the source of truth.

**Use `design-system.md` for color tokens only** (`--sand-mid`, `--terra`, `--ink`, `--ink-muted`, `--sand-dark`, `--white`). Map them via the inline `C` constants (canvas cannot read CSS variables).

**Do not implement graph visuals from `designs/`** (hi-fi HTML, wireframes). Those show labeled DOM nodes, rarity tags, glow animations, absolute positioning, SVG legends, and graph controls — out of scope for `GraphWiki`.

### ✅ Keep it simple
- `WikiNode`: `{ id: string; variant?: 'default' | 'start' | 'end' | 'path' }` — nothing else on graph nodes
- Draw **filled circles** only; start/end slightly larger; end gets a stroke ring
- **No labels** on the canvas (`nodeLabel=""`); article names belong in the path list / feed, not on dots
- **No tags, glow, hover tooltips, icons, or rarity** on graph nodes
- Links: single color, 1px width — no active/dim edge styling in the graph

### ❌ Common over-engineering mistakes
- Adding `label`, `tag`, `rarity`, or `glow` fields to `WikiNode` or mock data
- Porting `.node`, `.tag`, `.glow-*` patterns from design HTML into the canvas painter
- Replacing circles with rounded rectangles, text badges, or HTML overlays on nodes
- Building a separate SVG graph alongside ForceGraph2D to match a wireframe

---

## Node counts & connections

WikiLinks graphs model **BFS exploration from start → end**, not the full outbound link list of each Wikipedia page.

## Mental model

- A real article has ~30 outbound links; BFS only **follows a small subset** that advances the search.
- Each column ≈ nodes **discovered at that hop distance** from start (soft `forceX` layering in GraphWiki).
- `nodesExplored` in search results (e.g. 8,241) is the articles **visited during search**; the graph shows only the **frontier layers** (~tens of nodes), not every visited page.

## Node counts

Use `buildGraphForDegrees(degrees, fanOut)` or `buildMultiPathGraph(totalNodes, fanOut)` from `src/data/buildGraphData.ts`. Do not hand-roll layer sizes unless extending those helpers.

| Parameter | Value | Meaning |
|-----------|-------|---------|
| `fanOut` | **5** (project default) | Max links each node in layer L uses toward layer L+1 |
| `degrees` | hop count start→end | Interior layers grow as `fanOut^i`, capped at 150 |
| Example | `buildGraphForDegrees(4, 5)` | Layers `[5, 25, 5]` → **37 nodes**, not 5×25×5 |

Layer sizes by degree with fanOut=5:

| Degrees | Interior layers | Total nodes |
|---------|----------------|-------------|
| 1 | (none) | 2 |
| 2 | `[5]` | 7 |
| 3 | `[5, 5]` | 12 |
| 4 | `[5, 25, 5]` | 37 |
| 5 | `[5, 25, 25, 5]` | 61 |
| 6 | `[5, 25, 125, 25, 5]` | 162 |

**Do not** set per-node degree to ~30 (Wikipedia average). **Do not** make layer size = `previousLayer × 30`.

## Inter-layer links (common pitfalls)

### ❌ Complete bipartite wiring
Connecting every node in layer 2 to every node in layer 3 (`from.length × to.length` edges). This produces a dense "hairball" and is unrealistic.

### ❌ Wikipedia-scale fan-out
Giving each of 25 layer-2 nodes 30 edges into layer 3 → thousands of links and an unusable graph.

### ✅ Sparse, capped fan-out (follow `buildGraph`)
- Each source in layer L links to **~`fanOut` targets** in L+1 (random subset, not all).
- When layers are equal width, cap out-degree below `to.length` so you never wire everyone to everyone.
- Ensure every target has **≥1 incoming** edge (orphan nodes break the BFS story).
- Exception: when one side has a single node (start/end), connect all neighbors to it.

```typescript
// ✅ Prefer existing builders
graphData: buildGraphForDegrees(4, 5)

// ❌ Avoid — complete bipartite between equal layers
for (const a of layer2) for (const b of layer3) links.push({ source: a, target: b });
```

## Sanity checks before committing graph data

1. **Edge count** between two interior layers ≈ `from.length × fanOut`, not `from.length × to.length`.
2. **Visible nodes** match hop layers; total is orders of magnitude below `nodesExplored`.
3. **One highlighted path** (start → … → end) must exist through `variant: 'path'` nodes across consecutive layers.
