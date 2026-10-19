'use strict';

/**
 * Glue between a live mxGraph (draw.io's editor graph) and the core's flat
 * cells. The mx* constructors are passed in so the same code runs inside
 * draw.io (globals) and in Node tests (the `mxgraph` npm package).
 */
const core = require('./core');

const plainLabel = (cell) => {
  const v = cell.value;
  if (v && typeof v === 'object' && typeof v.getAttribute === 'function') return v.getAttribute('label') || '';
  return v == null ? '' : String(v);
};

/** Cells of the current page (or only the selection) as flat core cells. */
function readCells(graph, selectionOnly) {
  const model = graph.getModel();
  const root = model.getRoot();
  const out = [];
  const selected = new Set();
  const walk = (cell, underSelected) => {
    const isSel = underSelected || (selectionOnly && graph.isCellSelected(cell));
    if (cell !== root && model.getParent(cell) !== root && model.isVisible(cell)) {
      const g = cell.geometry;
      out.push({
        id: cell.id,
        parent: model.getParent(cell).id,
        vertex: model.isVertex(cell),
        edge: model.isEdge(cell),
        value: plainLabel(cell),
        style: cell.style || '',
        source: cell.source ? cell.source.id : null,
        target: cell.target ? cell.target.id : null,
        geometry: g ? {
          x: g.x || 0, y: g.y || 0, w: g.width || 0, h: g.height || 0,
          points: (g.points || []).map((p) => ({ x: p.x, y: p.y })),
        } : undefined,
      });
      if (isSel) selected.add(cell.id);
    }
    for (let i = 0; i < model.getChildCount(cell); i++) walk(model.getChildAt(cell, i), isSel);
  };
  walk(root, false);
  return { cells: out, selected: selectionOnly ? Array.from(selected) : null };
}

function exportMermaid(graph, opts) {
  opts = opts || {};
  const { cells, selected } = readCells(graph, !!opts.selectionOnly);
  const model = core.cellsToModel(cells, selected && selected.length ? { include: selected } : {});
  if (!model.nodes.length) {
    return { text: '', warnings: ['The diagram has no shapes to export'], empty: true };
  }
  return core.toMermaid(model, { metadata: opts.metadata !== false });
}

/**
 * Inserts Mermaid text as native draw.io cells.
 * mx = { mxCell, mxGeometry, mxPoint }, opts.replace clears the current page.
 */
function importMermaid(graph, mx, text, opts) {
  opts = opts || {};
  const model = graph.getModel();
  const parent = graph.getDefaultParent();
  const parsed = core.fromMermaid(text);
  if (!parsed.nodes.length) throw new Error('No flowchart shapes found in the Mermaid text');

  const existing = model.getChildCells(parent, true, true);
  const taken = new Set();
  if (!opts.replace) {
    Object.keys(model.cells || {}).forEach((id) => taken.add(id));
  }

  // new content goes to the right of whatever is already on the page
  if (!opts.replace && existing.length) {
    const b = graph.getBoundingBoxFromGeometry(existing, true) || graph.getGraphBounds();
    const minX = Math.min.apply(null, parsed.nodes.map((n) => n.x));
    const minY = Math.min.apply(null, parsed.nodes.map((n) => n.y));
    const dx = b.x + b.width + 80 - minX, dy = b.y - minY;
    parsed.nodes.forEach((n) => { n.x += dx; n.y += dy; });
    parsed.edges.forEach((e) => e.points.forEach((p) => { p.x += dx; p.y += dy; }));
  }

  const flat = core.modelToCells(parsed, { layerId: parent.id, taken });
  const created = new Map();
  const result = [];

  model.beginUpdate();
  try {
    if (opts.replace) graph.removeCells(existing, true);
    flat.filter((c) => c.vertex).forEach((c) => {
      const g = c.geometry;
      const cell = new mx.mxCell(c.value, new mx.mxGeometry(g.x, g.y, g.w, g.h), c.style);
      cell.setId(c.id);
      cell.setVertex(true);
      cell.setConnectable(true);
      const p = c.parent === parent.id ? parent : created.get(c.parent);
      graph.addCell(cell, p);
      created.set(c.id, cell);
      result.push(cell);
    });
    flat.filter((c) => c.edge).forEach((c) => {
      const geo = new mx.mxGeometry();
      geo.relative = true;
      if (c.geometry.points.length) geo.points = c.geometry.points.map((p) => new mx.mxPoint(p.x, p.y));
      const cell = new mx.mxCell(c.value, geo, c.style);
      cell.setId(c.id);
      cell.setEdge(true);
      graph.addEdge(cell, parent, created.get(c.source), created.get(c.target));
      result.push(cell);
    });
  } finally {
    model.endUpdate();
  }
  return { cells: result, warnings: parsed.warnings };
}

module.exports = { readCells, exportMermaid, importMermaid };
