# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Node **22** is the target (`.nvmrc`, `engines`, CI); don't rely on newer Node features.

- `npm run build` — bundles `src/plugin.js` into the single-file plugin `dist/drawio-mermaid.js` (esbuild IIFE; draw.io loads one script, no imports). `dist/` is committed (rebuild it before committing source changes).
- `npm test` — all tests (`node --test test/*.test.js`; Node's built-in runner). Single file: `node --test test/core.test.js`; single test: `node --test --test-name-pattern="round trip" test/*.test.js`.
- `test/plugin.test.js` rebuilds `dist/` before running, so tests always exercise the real bundle.
- `scripts/sample-test.sh <file.drawio>` — runs export, round trip, clean (metadata-free) import, Mermaid validation and Chrome screenshots. **Always leave test results in `test-result/`** (the script wipes and recreates it; it does not write a REPORT.md).
- `npm run build:bin` — `scripts/build-binaries.sh`: standalone executables for 5 targets in `release/` (gitignored) via `bun build --compile` (bun is a devDependency). Released by `.github/workflows/release.yml` on `v*` tags (smoke-tests each binary on its native OS first). Entry point `bin/drawio-mermaid.js` → `src/cli.js` (`to-mmd` / `to-drawio`).
- CLI: `node bin/drawio2mmd.js in.drawio [out.mmd]`, `node bin/mmd2drawio.js in.mmd [out.drawio]`.

## Architecture

Three layers, so almost everything is testable without a browser:

1. `src/core/` — pure functions, no DOM/mxGraph. Works on a plain **model** `{nodes:[{id,label,html,style,x,y,w,h,parent,isGroup}], edges:[{id,source,target,label,style,points}]}` with *absolute* coordinates; `style` is the raw draw.io style string.
   - `toMermaid.js` model → Mermaid; `fromMermaid.js` Mermaid → model (hand-rolled flowchart parser); `layout.js` layered layout used only when geometry is unknown; `shapes.js` the shape/arrow tables shared by both directions; `util.js` style/color/label helpers.
   - `cells.js` converts flat draw.io cells (`{id,parent,vertex,edge,value,style,geometry}`) ⇄ model. Both the plugin and the CLI go through it (edge-label child vertices, absolute coords, parent ordering, id collisions live here).
   - `xml.js` is Node-only: `.drawio` XML (incl. compressed `<diagram>`) ⇄ flat cells. The plugin never parses XML.
2. `src/adapter.js` — reads/writes a live mxGraph (`readCells`, `exportMermaid`, `importMermaid`). `mx*` constructors are injected so it runs in draw.io and in tests (`mxgraph` npm package).
3. `src/plugin.js` — `Draw.loadPlugin` UI only: two actions, dialogs, menu patches (`ui.menus.get('extras'|'exportAs'|'importFrom').funct`).

### Round-trip design (the non-obvious part)
Mermaid has no sizes/positions, so export appends `%% drawio:graph|node <mermaidId>|edge <index> {json}` comment lines holding id, geometry and the raw draw.io style. On import: metadata supplies geometry/base style **only if every node has metadata**; otherwise everything is auto-laid-out (known sizes kept). If the Mermaid text changed a node's shape or link type, the style is rebuilt from the Mermaid; `style`/`classDef`/`linkStyle` values are applied on top of the base style, skipping values equal to the existing color so original casing survives. Edge metadata lines are numbered by emission order (= `linkStyle` index) but matched on import by (source, target, occurrence) so edited text can't shift them; node metadata is keyed by Mermaid id. If only some nodes have metadata, known ones keep their geometry and new ones are laid out to the right (`layoutNewNodes`). Edge waypoints are stored absolute (draw.io saves them relative to the edge's container parent).

Other behaviours: `cellsToModel(..., {inferContainers})` makes a shape fully inside a larger one (area >1.05×) its child, so it becomes a `subgraph`; empty-label image shapes export as a 🖼 label (cleared on import when the metadata style is an image); `labelFromCell` turns `<div>/<p>/<li>/<hN>` into newlines; `layout.js` handles cycles (first-written direction wins), puts unconnected shapes in a grid and aligns neighbours; `routeEdges` in `fromMermaid.js` sets exit/entry ports and lanes for edges without metadata.

Mermaid ids: `makeIdAllocator(original, {label, kind})` keeps short readable draw.io ids and replaces generated ones with a slug of the label (or `shape_N`/`group_N`/`image_N`); the original id lives in the `%% drawio:node` metadata.

Gotchas encoded in the code: draw.io ids are sanitized for Mermaid (reserved words like `end`, ids starting with digits) via `makeIdAllocator` while the original id is kept in metadata; `none`/`default`/`light-dark()` colors are normalized in `normalizeColor`; "thick" edges mean strokeWidth ≥ 4 (so ordinary 2–3px `linkStyle`s stay `-->`); real Mermaid rejects `rgb(a,b,c)` in `style` lines, so export only emits hex.

Installing: custom plugins load only in a self-hosted draw.io with `ALLOW_CUSTOM_PLUGINS=true` and same-origin file (verified in jgraph/drawio `App.js`/`PreConfig.js`); app.diagrams.net and Desktop block them. The bundle has not been exercised in a live editor.
