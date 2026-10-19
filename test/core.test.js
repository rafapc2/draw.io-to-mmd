'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { DOMParser } = require('@xmldom/xmldom');
const { xmlToCells, cellsToXml } = require('../src/core/xml');
const C = require('../src/core');
const { validate } = require('./mermaid-validate');

const sample = fs.readFileSync(path.join(__dirname, '../examples/sample.drawio'), 'utf8');
const exportSample = () => C.toMermaid(C.cellsToModel(xmlToCells(sample, DOMParser)));

// ---------------------------------------------------------------- export
test('export: output is accepted by the real Mermaid parser', async () => {
  const { text } = exportSample();
  await validate(text);
});

test('export: shapes, colors, arrows and labels are expressed in Mermaid', () => {
  const { text, warnings } = exportSample();
  assert.match(text, /^flowchart (TD|LR|BT|RL)/);
  assert.match(text, /\(\["Start"\]\)/, 'terminator -> stadium');
  assert.match(text, /chk\{"Check<br\/>order & stock"\}/, 'rhombus with HTML label flattened');
  assert.match(text, /\[\("Orders DB"\)\]/, 'cylinder');
  assert.match(text, /\(\("Done"\)\)/, 'ellipse -> circle');
  assert.match(text, /\[\/"Queue"\/\]/, 'parallelogram');
  assert.match(text, /subgraph \w+ \["Backend"\]/);
  assert.match(text, /API #quot;v2#quot;/, 'quotes escaped');
  assert.match(text, /fill:#d5e8d4,stroke:#82b366,color:#1a3d1a/);
  assert.match(text, /fill:#e1d5e7/, 'light-dark() resolves to the light color');
  assert.doesNotMatch(text, /fill:(none|default)|stroke:default/);
  assert.match(text, /-->\|"go"\|/, 'label stored on an edgeLabel child');
  assert.match(text, /<-->/, 'both arrows');
  assert.match(text, /-\.->/, 'dashed');
  assert.match(text, / --- /, 'no arrowhead');
  assert.match(text, /--x /, 'cross head');
  assert.ok(warnings.some((w) => /not connected to two shapes/.test(w)), 'dangling edge reported');
});

test('export: ids that are invalid or reserved in Mermaid are rewritten', () => {
  const text = exportSample().text.split('\n').filter((l) => !/^\s*%%/.test(l)).join('\n');
  assert.doesNotMatch(text, /^\s+end\s*["\[({]/m);
  assert.doesNotMatch(text, /start-1/);
  assert.match(text, /^\s+n?start_1/m);
});

test('export: edge to a container targets the subgraph id', () => {
  const { text } = exportSample();
  assert.match(text, /\n\s+grp -\.-> nend\n/);
});

test('export: metadata can be turned off', () => {
  const m = C.cellsToModel(xmlToCells(sample, DOMParser));
  assert.doesNotMatch(C.toMermaid(m, { metadata: false }).text, /drawio:/);
});

// ---------------------------------------------------------------- import
const SHAPE_CASES = [
  ['A[t]', 'rect'], ['A(t)', 'round'], ['A([t])', 'stadium'], ['A[[t]]', 'subroutine'],
  ['A[(t)]', 'cylinder'], ['A((t))', 'circle'], ['A(((t)))', 'doublecircle'], ['A{t}', 'rhombus'],
  ['A{{t}}', 'hexagon'], ['A[/t/]', 'parallelogram'], ['A[\\t\\]', 'parallelogram_alt'],
  ['A[/t\\]', 'trapezoid'], ['A[\\t/]', 'trapezoid_alt'], ['A>t]', 'asymmetric'], ['A["quoted (t)"]', 'rect'],
];
for (const [src, shape] of SHAPE_CASES) {
  test(`import: shape ${shape} (${src})`, async () => {
    const text = `flowchart TD\n  ${src}\n`;
    await validate(text);
    const r = C.fromMermaid(text);
    assert.equal(r.nodes[0].shape, shape);
    assert.equal(C.shapeFromStyle(r.nodes[0].style), shape === 'rect' ? 'rect' : shape,
      'derived draw.io style maps back to the same shape');
  });
}

const LINK_CASES = [
  ['A --> B', 'solid', 'none', 'arrow'], ['A --- B', 'solid', 'none', 'none'],
  ['A -.-> B', 'dotted', 'none', 'arrow'], ['A -.- B', 'dotted', 'none', 'none'],
  ['A ==> B', 'thick', 'none', 'arrow'], ['A === B', 'thick', 'none', 'none'],
  ['A --o B', 'solid', 'none', 'circle'], ['A --x B', 'solid', 'none', 'cross'],
  ['A <--> B', 'solid', 'arrow', 'arrow'], ['A o--o B', 'solid', 'circle', 'circle'],
  ['A x--x B', 'solid', 'cross', 'cross'], ['A ----> B', 'solid', 'none', 'arrow'],
];
for (const [src, line, start, end] of LINK_CASES) {
  test(`import: link "${src}"`, async () => {
    await validate(`flowchart LR\n  ${src}\n`);
    const e = C.fromMermaid(`flowchart LR\n  ${src}\n`).edges[0];
    assert.deepEqual(e.kind, { line, start, end });
  });
}

test('import: link labels in every syntax', async () => {
  const text = 'flowchart LR\n A -->|"p q"| B\n B -- text --> C\n C == bold ==> D\n D -. dots .-> E\n E -->|x| F\n';
  await validate(text);
  const labels = C.fromMermaid(text).edges.map((e) => e.label);
  assert.deepEqual(labels, ['p q', 'text', 'bold', 'dots', 'x']);
});

test('import: chains, & groups, ; separators, comments', async () => {
  const text = 'graph TB\n %% a comment\n A --> B & C --> D; D --> A\n';
  await validate(text);
  const r = C.fromMermaid(text);
  assert.deepEqual(r.edges.map((e) => e.source + e.target), ['AB', 'AC', 'BD', 'CD', 'DA']);
  assert.equal(r.warnings.length, 0);
});

test('import: subgraphs (nested), classDef/class/:::, style, linkStyle', async () => {
  const text = [
    'flowchart TD',
    '  subgraph outer [Outer box]',
    '    subgraph inner',
    '      X:::hot --> Y',
    '    end',
    '    Z',
    '  end',
    '  Y --> Z',
    '  classDef hot fill:#f96,stroke:#333,stroke-width:4px,color:white',
    '  class Z hot',
    '  style Y fill:#0a141e,stroke-dasharray: 5 5',
    '  linkStyle 0 stroke:#00f,stroke-width:3px',
    '  linkStyle default stroke:#999',
  ].join('\n');
  await validate(text);
  const r = C.fromMermaid(text);
  const n = Object.fromEntries(r.nodes.map((x) => [x.id, x]));
  assert.equal(n.X.parent, 'inner');
  assert.equal(n.inner.parent, 'outer');
  assert.equal(n.Z.parent, 'outer');
  assert.equal(n.outer.label, 'Outer box');
  assert.match(n.X.style, /fillColor=#ff9966/);
  assert.match(n.X.style, /strokeWidth=4/);
  assert.match(n.X.style, /fontColor=#ffffff/);
  assert.match(n.Z.style, /fillColor=#ff9966/);
  assert.match(n.Y.style, /fillColor=#0a141e/);
  assert.match(n.Y.style, /dashed=1/);
  assert.match(r.edges[0].style, /strokeColor=#0000ff/);
  assert.match(r.edges[1].style, /strokeColor=#999999/);
});

test('import: auto layout gives every node a distinct, non-overlapping box', () => {
  const r = C.fromMermaid('flowchart LR\n A-->B\n A-->C\n B-->D\n C-->D\n D-->A\n subgraph g\n E-->F\n end\n B-->E\n');
  const leaf = r.nodes.filter((n) => !n.isGroup);
  for (let i = 0; i < leaf.length; i++) {
    for (let j = i + 1; j < leaf.length; j++) {
      const a = leaf[i], b = leaf[j];
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      assert.ok(!overlap, `${a.id} overlaps ${b.id}`);
    }
  }
  const g = r.nodes.find((n) => n.id === 'g');
  ['E', 'F'].forEach((id) => {
    const n = r.nodes.find((x) => x.id === id);
    assert.ok(n.x >= g.x && n.y >= g.y && n.x + n.w <= g.x + g.w && n.y + n.h <= g.y + g.h, `${id} inside group`);
  });
});

test('import: non-flowchart diagrams are rejected with a clear message', () => {
  assert.throws(() => C.fromMermaid('sequenceDiagram\n A->>B: hi'), /flowchart/);
});

test('import: html and special characters in labels are escaped for draw.io', () => {
  const r = C.fromMermaid('flowchart TD\n A["1 < 2 & #quot;q#quot;<br/>line2 <b>b</b>"]\n');
  assert.equal(r.nodes[0].label, '1 &lt; 2 &amp; "q"<br>line2 <b>b</b>');
});

// ------------------------------------------------------------ round trip
function roundTrip(xml) {
  const m1 = C.cellsToModel(xmlToCells(xml, DOMParser));
  const { text } = C.toMermaid(m1);
  const imported = C.fromMermaid(text);
  const cells = C.modelToCells(imported);
  const m2 = C.cellsToModel(xmlToCells(cellsToXml(cells), DOMParser));
  return { m1, text, m2, imported };
}

test('round trip draw.io -> Mermaid -> draw.io keeps geometry, styles, labels, ids', () => {
  const { m1, m2 } = roundTrip(sample);
  assert.equal(m2.nodes.length, m1.nodes.length);
  const by = new Map(m2.nodes.map((n) => [n.id, n]));
  for (const a of m1.nodes) {
    const b = by.get(a.id);
    assert.ok(b, `node ${a.id} kept its id`);
    assert.deepEqual([b.x, b.y, b.w, b.h], [a.x, a.y, a.w, a.h], `geometry of ${a.id}`);
    assert.equal(b.style, a.style, `style of ${a.id}`);
    assert.equal(b.parent, a.parent, `parent of ${a.id}`);
    assert.equal(C.labelFromCell(b.label, true), C.labelFromCell(a.label, true), `label of ${a.id}`);
  }
  const connected = m1.edges.filter((e) => e.source && e.target && m1.nodes.some((n) => n.id === e.source) && m1.nodes.some((n) => n.id === e.target));
  assert.equal(m2.edges.length, connected.length);
  const e2 = new Map(m2.edges.map((e) => [e.id, e]));
  for (const a of connected) {
    const b = e2.get(a.id);
    assert.ok(b, `edge ${a.id} kept its id`);
    assert.equal(b.source, a.source); assert.equal(b.target, a.target);
    assert.equal(b.style, a.style, `style of edge ${a.id}`);
    assert.deepEqual(b.points, a.points);
    assert.equal(C.labelFromCell(b.label, true), C.labelFromCell(a.label, true));
  }
});

test('round trip is stable: export(import(export(x))) == export(x)', () => {
  const { text, imported } = roundTrip(sample);
  const again = C.toMermaid(C.cellsToModel(xmlToCells(cellsToXml(C.modelToCells(imported)), DOMParser))).text;
  assert.equal(again, text);
});

test('editing the Mermaid text wins over stale metadata', () => {
  const { text } = exportSample();
  const edited = text
    .replace(/(\s)start_1\(\["Start"\]\)/, '$1start_1{{"Begin"}}') // shape + label change
    .replace(/style start_1 fill:#d5e8d4/, 'style start_1 fill:#112233');
  assert.notEqual(edited, text);
  const r = C.fromMermaid(edited);
  const n = r.nodes.find((x) => x.id === 'start-1');
  assert.equal(n.label, 'Begin');
  assert.equal(C.shapeFromStyle(n.style), 'hexagon');
  assert.match(n.style, /fillColor=#112233/);
  assert.equal(n.x, 40); assert.equal(n.w, 140); // geometry still preserved
});

test('hand-written Mermaid (no metadata) imports then exports as valid Mermaid', async () => {
  const src = fs.readFileSync(path.join(__dirname, '../examples/sample.mmd'), 'utf8');
  await validate(src);
  const imported = C.fromMermaid(src);
  assert.equal(imported.warnings.length, 0, imported.warnings.join('; '));
  const back = C.toMermaid(C.cellsToModel(xmlToCells(cellsToXml(C.modelToCells(imported)), DOMParser)));
  await validate(back.text);
});

test('selection export only includes the selected cells', () => {
  const cells = xmlToCells(sample, DOMParser);
  const m = C.cellsToModel(cells, { include: ['start-1', 'chk', 'e1'] });
  assert.deepEqual(m.nodes.map((n) => n.id), ['start-1', 'chk']);
  assert.equal(m.edges.length, 1);
});

test('draw.io <UserObject> wrappers keep their id and label', () => {
  const cells = xmlToCells(sample, DOMParser);
  const tr = cells.find((c) => c.id === 'tr');
  assert.ok(tr && tr.vertex);
  assert.equal(tr.value, 'Queue');
  const { text, warnings } = exportSample();
  assert.match(text, /tr\[\/"Queue"\/\]/);
  assert.ok(!warnings.some((w) => /Edge e5|Edge e6/.test(w)), 'edges to the wrapped shape stay connected');
});

test('compressed <diagram> content (deflate+base64+URI) is read', () => {
  const zlib = require('zlib');
  const inner = sample.match(/<mxGraphModel[\s\S]*<\/mxGraphModel>/)[0];
  const packed = zlib.deflateRawSync(Buffer.from(encodeURIComponent(inner), 'utf8')).toString('base64');
  const file = `<mxfile><diagram name="Page-1" id="z">${packed}</diagram></mxfile>`;
  const a = C.toMermaid(C.cellsToModel(xmlToCells(file, DOMParser))).text;
  assert.equal(a, exportSample().text);
});

test('edge waypoints are absolute even when the edge lives inside a container', () => {
  const m = C.cellsToModel(xmlToCells(sample, DOMParser));
  assert.deepEqual(m.edges.find((e) => e.id === 'e3').points, [{ x: 460, y: 270 }]);
});

test('edit: deleting an edge line does not shift other edges\' metadata', () => {
  const { text } = exportSample();
  const lines = text.split('\n');
  const i = lines.findIndex((l) => /^\s+chk -->\|"yes"\| api$/.test(l));
  assert.ok(i > 0);
  lines.splice(i, 1);
  const r = C.fromMermaid(lines.join('\n'));
  const ids = r.edges.map((e) => e.id);
  assert.ok(!ids.includes('e2'));
  assert.ok(ids.includes('e3') && ids.includes('e4') && ids.includes('e5'));
  const e4 = r.edges.find((e) => e.id === 'e4');
  assert.deepEqual(e4.points, [{ x: 700, y: 100 }]);
  assert.match(e4.style, /strokeColor=#ff0000/);
});

test('edit: a shape added to the text keeps the others in place and lands beside them', () => {
  const { text } = exportSample();
  const edited = text.replace('\n  start_1 -->', '\n  fresh["New one"] --> chk\n  start_1 -->');
  const before = C.fromMermaid(text), after = C.fromMermaid(edited);
  const geo = (r, id) => { const n = r.nodes.find((x) => x.id === id); return [n.x, n.y, n.w, n.h]; };
  ['start-1', 'chk', 'grp', 'api', 'db', 'end', 'tr'].forEach((id) => assert.deepEqual(geo(after, id), geo(before, id), id));
  const fresh = after.nodes.find((n) => n.id === 'fresh');
  const right = Math.max.apply(null, before.nodes.map((n) => n.x + n.w));
  assert.ok(fresh.x >= right && fresh.w > 0 && fresh.h > 0);
  assert.equal(after.edges.length, before.edges.length + 1);
  assert.equal(after.edges.find((e) => e.id === 'e2').source, 'chk', 'existing edge metadata still applies');
});

// ------------------------------------------------- readability improvements
test('export: <div> line breaks in labels are kept', () => {
  assert.equal(C.labelFromCell('Proveedor<div>Auth Server</div>', true), 'Proveedor<br/>Auth Server');
  assert.equal(C.labelFromCell('<div>a</div><div>b</div>', true), 'a<br/>b');
});

test('export: a shape lying fully on top of a bigger one becomes a subgraph child', async () => {
  const mk = (id, x, y, w, h, v) => ({ id, vertex: true, parent: '1', value: v, style: 'html=1;', geometry: { x, y, w, h } });
  const cells = [mk('big', 0, 0, 400, 300, ''), mk('mid', 20, 20, 200, 150, 'Mid'), mk('small', 40, 60, 80, 40, 'S'), mk('out', 500, 0, 80, 40, 'Out')];
  const { text } = C.toMermaid(C.cellsToModel(cells));
  assert.match(text, /subgraph big \[" "\]\n\s+subgraph mid \["Mid"\]\n\s+small\["S"\]\n\s+end\n\s+end/);
  await validate(text);
  const off = C.cellsToModel(cells, { inferContainers: false });
  assert.ok(off.nodes.every((n) => !n.parent));
});

test('export: image shapes get a visible placeholder and lose it again on re-import', () => {
  const cells = [{ id: 'img', vertex: true, parent: '1', value: '', style: 'shape=image;image=data:abc;', geometry: { x: 0, y: 0, w: 50, h: 50 } }];
  const { text } = C.toMermaid(C.cellsToModel(cells));
  assert.match(text, /\u{1F5BC}/u);
  assert.equal(C.fromMermaid(text).nodes[0].label, '');
});

test('import: untitled containers have no title bar; loose shapes go below the connected block', () => {
  const r = C.fromMermaid('flowchart LR\n subgraph g [" "]\n A --> B\n end\n X\n Y\n');
  const g = r.nodes.find((n) => n.id === 'g');
  assert.doesNotMatch(g.style, /swimlane/);
  const a = r.nodes.find((n) => n.id === 'A');
  assert.ok(a.y - g.y < 60, 'no header gap');
  const x = r.nodes.find((n) => n.id === 'X');
  assert.ok(x.y >= g.y + g.h, 'loose shape sits below the group');
});

test('import: auto layout keeps the direction written first when edges form a cycle', () => {
  const r = C.fromMermaid('flowchart LR\n A --> B\n B --> A\n');
  const [a, b] = ['A', 'B'].map((id) => r.nodes.find((n) => n.id === id));
  assert.ok(a.x < b.x);
});

test('import: edges leave and enter through facing sides, antiparallel edges use separate lanes', () => {
  const r = C.fromMermaid('flowchart LR\n A --> B\n B --> A\n');
  const [e1, e2] = r.edges.map((e) => C.parseStyle(e.style));
  assert.equal(e1.exitX, '1'); assert.equal(e1.entryX, '0');
  assert.equal(e2.exitX, '0'); assert.equal(e2.entryX, '1');
  assert.notEqual(e1.exitY, e2.exitY);
});
