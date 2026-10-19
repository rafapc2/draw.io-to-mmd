'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const mx = require('./mxgraph-env');
const { DOMParser } = require('@xmldom/xmldom');
const { xmlToCells } = require('../src/core/xml');
const adapter = require('../src/adapter');
const { validate } = require('./mermaid-validate');

const sample = fs.readFileSync(path.join(__dirname, '../examples/sample.drawio'), 'utf8');

const descendants = (graph, cell = graph.getDefaultParent(), acc = []) => {
  graph.getModel().getChildCells(cell, true, true).forEach((c) => { acc.push(c); descendants(graph, c, acc); });
  return acc;
};

function newGraph() {
  const graph = new mx.mxGraph(document.getElementById('c'));
  return graph;
}

/** Loads flat cells into a real mxGraph model the way draw.io would. */
function loadSample(graph) {
  const flat = xmlToCells(sample, DOMParser);
  const model = graph.getModel();
  const byId = { 0: model.getRoot() };
  const layer = graph.getDefaultParent();
  byId['1'] = layer;
  model.beginUpdate();
  try {
    flat.filter((c) => c.vertex).forEach((c) => {
      const g = c.geometry;
      const cell = new mx.mxCell(c.value, new mx.mxGeometry(g.x, g.y, g.w, g.h), c.style);
      cell.setId(c.id); cell.setVertex(true);
      byId[c.id] = cell;
    });
    const edgeIds = new Set(flat.filter((c) => c.edge).map((c) => c.id));
    flat.filter((c) => c.vertex && !edgeIds.has(c.parent)).forEach((c) => { model.add(byId[c.parent], byId[c.id]); });
    flat.filter((c) => c.edge).forEach((c) => {
      const geo = new mx.mxGeometry(); geo.relative = true;
      if (c.geometry && c.geometry.points.length) geo.points = c.geometry.points.map((p) => new mx.mxPoint(p.x, p.y));
      const cell = new mx.mxCell(c.value, geo, c.style);
      cell.setId(c.id); cell.setEdge(true);
      byId[c.id] = cell;
      model.add(byId[c.parent] || layer, cell);
      model.setTerminal(cell, byId[c.source] || null, true);
      model.setTerminal(cell, byId[c.target] || null, false);
    });
    // edge labels are vertices parented to their edge
    flat.filter((c) => c.vertex && edgeIds.has(c.parent)).forEach((c) => { model.add(byId[c.parent], byId[c.id]); });
  } finally { model.endUpdate(); }
  return graph;
}

test('adapter: exports a live mxGraph model to valid Mermaid', async () => {
  const graph = loadSample(newGraph());
  const r = adapter.exportMermaid(graph);
  await validate(r.text);
  assert.match(r.text, /subgraph grp \["Backend"\]/);
  assert.match(r.text, /-->\|"go"\|/);
  assert.match(r.text, /fill:#d5e8d4/);
});

test('adapter: selection export', () => {
  const graph = loadSample(newGraph());
  const model = graph.getModel();
  graph.setSelectionCells([model.getCell('start-1'), model.getCell('chk')]);
  const r = adapter.exportMermaid(graph, { selectionOnly: true });
  assert.match(r.text, /start_1/);
  assert.match(r.text, /chk/);
  assert.doesNotMatch(r.text, /Orders DB/);
});

test('adapter: Mermaid import creates native cells with geometry, styles, parents, edges', () => {
  const graph = newGraph();
  const text = fs.readFileSync(path.join(__dirname, '../examples/sample.mmd'), 'utf8');
  const r = adapter.importMermaid(graph, mx, text, { replace: false });
  const model = graph.getModel();
  const cells = descendants(graph);
  assert.equal(cells.filter((c) => model.isVertex(c)).length, 7); // A B C D E F + Backend
  assert.equal(cells.filter((c) => model.isEdge(c)).length, 6);
  const start = cells.find((c) => c.value === 'Start');
  assert.match(start.style, /fillColor=#d5e8d4/);
  assert.ok(start.geometry.width > 0 && start.geometry.height > 0);
  const worker = cells.find((c) => c.value === 'Worker');
  assert.equal(model.getParent(worker).value, 'Backend services', 'child sits inside the container');
  assert.ok(r.cells.length === 13);
  // every edge is connected on both ends
  cells.filter((c) => model.isEdge(c)).forEach((e) => assert.ok(e.source && e.target));
  const labelled = cells.filter((c) => model.isEdge(c)).map((e) => e.value).filter(Boolean).sort();
  assert.deepEqual(labelled, ['no', 'yes']);
});

test('adapter: real-graph round trip keeps colors, sizes and shapes', async () => {
  const g1 = loadSample(newGraph());
  const mmd = adapter.exportMermaid(g1).text;
  const g2 = newGraph();
  adapter.importMermaid(g2, mx, mmd, { replace: true });
  const m1 = g1.getModel(), m2 = g2.getModel();
  const vs = (g, m) => m.getChildCells(g.getDefaultParent(), true, false);
  const all = (m, cell, acc = []) => { m.getChildCells(cell, true, false).forEach((c) => { acc.push(c); all(m, c, acc); }); return acc; };
  const v1 = all(m1, g1.getDefaultParent()).filter((c) => m1.isVertex(c) && c.style.indexOf('edgeLabel') < 0);
  const v2 = all(m2, g2.getDefaultParent()).filter((c) => m2.isVertex(c));
  assert.equal(v2.length, v1.length);
  for (const a of v1) {
    const b = m2.getCell(a.id);
    assert.ok(b, `cell ${a.id} survives with its id`);
    assert.equal(b.style, a.style);
    ['x', 'y', 'width', 'height'].forEach((k) => assert.equal(b.geometry[k], a.geometry[k], `${a.id}.${k}`));
    assert.equal(m2.getParent(b).id, m1.getParent(a).id);
  }
  assert.ok(vs);

  // edges: ids, ends, styles and *absolute* waypoints survive (e3 sits inside a container)
  const abs = (m, cell) => {
    let dx = 0, dy = 0;
    for (let p = m.getParent(cell); p && m.isVertex(p); p = m.getParent(p)) { dx += p.geometry.x; dy += p.geometry.y; }
    return (cell.geometry.points || []).map((pt) => [pt.x + dx, pt.y + dy]);
  };
  const edges = (g, m) => all(m, g.getDefaultParent()).filter((c) => m.isEdge(c));
  const e1s = edges(g1, m1), e2s = edges(g2, m2);
  assert.equal(e2s.length, e1s.filter((e) => e.source && e.target).length);
  for (const a of e1s.filter((e) => e.source && e.target)) {
    const b = m2.getCell(a.id);
    assert.ok(b, `edge ${a.id} survives`);
    assert.equal(b.source.id, a.source.id); assert.equal(b.target.id, a.target.id);
    assert.equal(b.style, a.style);
    assert.deepEqual(abs(m2, b), abs(m1, a), `waypoints of ${a.id}`);
  }
  assert.deepEqual(abs(m1, m1.getCell('e3')), [[460, 270]], 'fixture sanity: relative (160,150) in grp@(300,120)');
});

test('adapter: import into a non-empty page does not overlap and avoids id clashes', () => {
  const graph = loadSample(newGraph());
  const before = descendants(graph).length;
  const right = graph.getBoundingBoxFromGeometry(graph.getModel().getChildCells(graph.getDefaultParent(), true, true), true);
  const mmd = adapter.exportMermaid(graph).text; // same ids come back
  const r = adapter.importMermaid(graph, mx, mmd, { replace: false });
  const model = graph.getModel();
  const after = descendants(graph).length;
  assert.equal(after, before + r.cells.length);
  const ids = descendants(graph).map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'unique ids');
  const newOnes = r.cells.filter((c) => model.isVertex(c) && model.getParent(c) === graph.getDefaultParent());
  assert.ok(newOnes.every((c) => c.geometry.x >= right.x + right.width), 'inserted to the right of existing shapes');
});

test('adapter: replace clears the page first', () => {
  const graph = loadSample(newGraph());
  adapter.importMermaid(graph, mx, 'flowchart TD\n X-->Y\n', { replace: true });
  const cells = graph.getModel().getChildCells(graph.getDefaultParent(), true, true);
  assert.equal(cells.length, 3);
});

test('adapter: invalid input reports a useful error', () => {
  assert.throws(() => adapter.importMermaid(newGraph(), mx, 'pie title x\n "a": 1', {}), /flowchart|No flowchart/);
  assert.throws(() => adapter.importMermaid(newGraph(), mx, '', {}), /No flowchart/);
});
