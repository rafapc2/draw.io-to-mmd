# draw.io-to-mmd

Open-source **draw.io plugin** that converts between native draw.io diagrams and **Mermaid flowcharts**.
Plugin de código abierto para **draw.io** que exporta diagramas nativos a **Mermaid** y también importa Mermaid dejándolo como diagrama nativo de draw.io.

- **Export** → Mermaid text keeping shapes, colors (`fill`, `stroke`, text color), line widths, dashes, arrow types, edge labels and containers (`subgraph`).
- **Import** ← Mermaid text becomes real draw.io shapes and connectors (editable, styled, grouped), not an image.
- **Lossless round trip**: Mermaid cannot store sizes or positions, so the export appends `%% drawio:…` comment lines (ignored by Mermaid, GitHub, mermaid.live…) with exact geometry and the original draw.io style. Re-importing the file restores the diagram exactly. Untick the option for a clean `.mmd`.
- **Readable ids**: draw.io's generated ids (`hM1jXrLU…-41`) become `mcp_server`, `api_gateway`, `group_1`, `image_1`… in the Mermaid; the original id is kept in the metadata and restored on import.
- **Hand-written Mermaid** (no metadata) is imported with an automatic layered layout (left→right order, aligned neighbours, loose shapes in a row, edges leaving through the facing side).
- **Containers**: a shape lying fully inside a larger one is exported as a `subgraph` and imported back as a real container. Labels with line breaks (`<div>`) keep them.
- No dependencies at runtime: one self-contained file, `dist/drawio-mermaid.js`.

## Install

draw.io only loads a custom plugin when the editor is **self-hosted** (this is enforced in draw.io's source, `App.js`/`PreConfig.js`):

- `https://app.diagrams.net` **blocks custom plugins**: `?p=` only accepts built-in plugin ids, and the *Custom…* button of the Plugins dialog is hidden because `ALLOW_CUSTOM_PLUGINS` defaults to `false`.
- draw.io Desktop and the Confluence/Jira apps do not load external plugins either.

To use the plugin, run your own draw.io (static `webapp/` folder or the [`jgraph/drawio` Docker image](https://github.com/jgraph/docker-drawio)):

1. Build or copy `dist/drawio-mermaid.js` into that draw.io site, e.g. `webapp/plugins/drawio-mermaid.js`. It **must be served from the same origin** as the editor.
2. Enable custom plugins by defining `window.ALLOW_CUSTOM_PLUGINS = true;` before `js/PreConfig.js` runs (for example a `<script>` at the top of `index.html`; PreConfig only sets the default when it is undefined).
3. Open the editor → **Extras ▸ Plugins… ▸ Custom…**, enter `plugins/drawio-mermaid.js` (a path on that same site), **Add**, **Apply**, reload the tab.
4. You get **Extras ▸ Export to Mermaid…** and **Import from Mermaid…** (also under *File ▸ Export as* / *Import from* when those submenus exist).

> Status: the bundle is tested against the real mxGraph engine and with stubbed dialogs, but I could not load it into a running draw.io editor; steps 2–4 follow draw.io's source and have not been clicked through. Please open an issue if a menu is missing in your version.

Using the hosted app or Desktop? Use the command line below on saved `.drawio` files, or ask draw.io to adopt the plugin as a built-in one.

## Command line

```sh
npm install
node bin/drawio2mmd.js diagram.drawio out.mmd   # .drawio (compressed or not, first page) → Mermaid
node bin/mmd2drawio.js flow.mmd out.drawio      # Mermaid → .drawio (open it in any draw.io)
# or `npm link` to get `drawio2mmd` / `mmd2drawio` on your PATH
```

### Standalone executables (no Node.js needed)

```sh
npm run build:bin      # → release/ (+ SHA256SUMS.txt), cross-compiled with Bun from any OS
```

| File | Platform |
|---|---|
| `drawio-mermaid-darwin-arm64` / `-darwin-x64` | macOS Apple Silicon / Intel |
| `drawio-mermaid-linux-x64` / `-linux-arm64` | Linux |
| `drawio-mermaid-windows-x64.exe` | Windows |

```sh
drawio-mermaid to-mmd    diagram.drawio out.mmd
drawio-mermaid to-drawio flow.mmd out.drawio
```

**Releases:** pushing a tag (`git tag v0.1.0 && git push --tags`) runs `.github/workflows/release.yml`: tests, builds the 5 binaries, runs each one on its native OS and attaches them plus `SHA256SUMS.txt` to a GitHub release.

Each file is ~70–90 MB (it embeds the runtime). Only the macOS arm64 build has been run; the others were cross-compiled and not executed. On macOS, unsigned downloads need `xattr -d com.apple.quarantine <file>` (or right-click ▸ Open); on Linux/macOS run `chmod +x` first.

## What is supported

| draw.io | Mermaid |
|---|---|
| rectangle, rounded, pill/terminator, ellipse/circle, double ellipse, diamond, hexagon, cylinder, process (subroutine), parallelogram, trapezoid, step | `[ ]`, `( )`, `([ ])`, `(( ))`, `((( )))`, `{ }`, `{{ }}`, `[( )]`, `[[ ]]`, `[/ /]`, `[\ \]`, `[/ \]`, `[\ /]`, `> ]` |
| container / swimlane with children (nested) | `subgraph … end` |
| arrow, none, cross, circle heads; start+end arrows | `-->`, `---`, `--x`, `--o`, `<-->`, `x--x`, `o--o` |
| dashed / thick (stroke ≥ 4) lines | `-.->` / `==>` |
| fill, stroke, stroke width, font color/bold/italic/size, dash | `style`, `linkStyle`, `classDef`, `class`, `:::` |
| edge labels (value or label child) | `-->\|text\|`, `-- text -->` |

**Scope:** Mermaid *flowcharts* only (`flowchart` / `graph`). Other diagram types are rejected with a clear message. Not expressed in Mermaid (kept only in the `%% drawio` metadata): gradients, shadows, custom shapes (exported as rectangles), edge routing. Images have no Mermaid equivalent: they appear as a 🖼 placeholder and are restored from the metadata on re-import. Edge label positions are not kept.
Edges that are not connected to two shapes, or that connect to another edge, are skipped with a warning. Only the current page is converted; with a selection you can export just that part. Mermaid v11 `A@{ shape: … }` syntax and edge ids are not parsed yet.

Editing the exported Mermaid and re-importing works: text, shapes, colors and links come from the Mermaid; sizes, positions, waypoints and other styling come from the metadata, matched per shape id and per edge (source, target). Shapes you add to the text have no metadata: the others stay where they were and the new ones are placed as a block to their right (new shapes inside an existing `subgraph` are not resized into it). Deleting or adding edge lines is safe. If the metadata lines are removed, the whole page is auto-laid-out.

## Develop

Requires Node.js 22 or newer (`.nvmrc`).

```sh
npm install
npm run build    # bundle src/plugin.js → dist/drawio-mermaid.js
npm test         # 66 tests
```

Tests validate exported text with the real `mermaid` parser, run the adapter against the real `mxgraph` engine under jsdom, and drive the built bundle's dialogs with a stubbed draw.io `ui`. They do **not** load a live draw.io editor, so UI/menu placement should be checked manually in a browser.

### Sample check

```sh
scripts/sample-test.sh examples/sample02.drawio
```

Runs draw.io → Mermaid → draw.io and a metadata-free import, validates the Mermaid with the real parser and renders screenshots. **Everything is written to `test-result/`** (wiped on each run): `.mmd`, `.drawio`, `export-warnings.txt` and `screenshots/`.

## License

MIT
