'use strict';

const { parseStyle } = require('./util');

/**
 * Flat draw.io cells {id, parent, vertex, edge, value, style, source, target,
 * geometry:{x,y,w,h,points}} <-> the plain model used by toMermaid/fromMermaid.
 * Both the plugin (live mxGraph model) and the Node CLI (XML files) go through
 * these two functions, so the conversion logic exists once.
 */

function cellsToModel(cells, opts) {
  opts = opts || {};
  const byId = new Map(cells.map((c) => [c.id, c]));
  const include = opts.include ? new Set(opts.include) : null;
  const warnings = [];
  const ok = (c) => !include || include.has(c.id);
  const isEdgeLabel = (c) => c.vertex && (byId.get(c.parent) || {}).edge;

  const absolute = (c) => {
    let x = (c.geometry && c.geometry.x) || 0, y = (c.geometry && c.geometry.y) || 0;
    for (let p = byId.get(c.parent); p && p.vertex; p = byId.get(p.parent)) {
      x += (p.geometry && p.geometry.x) || 0;
      y += (p.geometry && p.geometry.y) || 0;
    }
    return { x, y };
  };
  // nearest included vertex ancestor
  const parentOf = (c) => {
    for (let p = byId.get(c.parent); p; p = byId.get(p.parent)) {
      if (p.vertex && ok(p) && !isEdgeLabel(p)) return p.id;
    }
    return null;
  };

  const labels = new Map(); // edge id -> label text
  cells.filter(isEdgeLabel).forEach((c) => {
    if (c.value && ok(byId.get(c.parent))) labels.set(c.parent, c.value);
  });

  const nodes = cells.filter((c) => c.vertex && ok(c) && !isEdgeLabel(c)).map((c) => {
    const g = c.geometry || {};
    const a = absolute(c);
    return {
      id: c.id, label: c.value || '', html: parseStyle(c.style).html === '1',
      style: c.style || '', x: a.x, y: a.y, w: g.w || 0, h: g.h || 0, parent: parentOf(c),
    };
  });

  // waypoints are relative to the edge's parent (draw.io re-parents edges into containers)
  const origin = (c) => {
    let x = 0, y = 0;
    for (let p = byId.get(c.parent); p && p.vertex; p = byId.get(p.parent)) {
      x += (p.geometry && p.geometry.x) || 0;
      y += (p.geometry && p.geometry.y) || 0;
    }
    return { x, y };
  };

  if (opts.inferContainers !== false) inferContainers(nodes);

  const edges = cells.filter((c) => c.edge && ok(c)).map((c) => ({
    id: c.id,
    source: c.source, target: c.target,
    label: c.value || labels.get(c.id) || '',
    html: parseStyle(c.style).html === '1',
    style: c.style || '',
    points: ((c.geometry && c.geometry.points) || []).map((pt) => ({ x: pt.x + origin(c).x, y: pt.y + origin(c).y })),
  }));
  edges.forEach((e) => {
    if ((byId.get(e.source) || {}).edge || (byId.get(e.target) || {}).edge) {
      e.source = e.target = null; // edge-to-edge links cannot be expressed
    }
  });
  return { nodes, edges, warnings };
}

/**
 * Diagrams often draw a "container" as a plain big shape with other shapes on
 * top of it (no parent link). Mermaid can only express that as a subgraph, so a
 * free-standing shape that lies completely inside a larger one becomes its child.
 */
function inferContainers(nodes) {
  const area = (n) => n.w * n.h;
  const inside = (b, a) => b.x >= a.x - 1 && b.y >= a.y - 1 && b.x + b.w <= a.x + a.w + 1 && b.y + b.h <= a.y + a.h + 1;
  nodes.forEach((b) => {
    if (b.parent || area(b) <= 0) return;
    let best = null;
    nodes.forEach((a) => {
      if (a === b || area(a) <= area(b) * 1.05 || !inside(b, a)) return;
      if (!best || area(a) < area(best)) best = a;
    });
    if (best) b.parent = best.id;
  });
}

/**
 * Model -> flat cells. `layerId` is the parent for top level cells and
 * `taken` a Set of ids that must not be reused.
 */
function modelToCells(model, opts) {
  opts = opts || {};
  const layerId = opts.layerId || '1';
  const taken = new Set(opts.taken || []);
  taken.add('0'); taken.add(layerId);
  let counter = 0;
  const fresh = (prefix) => { let id; do { id = prefix + (++counter); } while (taken.has(id)); taken.add(id); return id; };

  const ids = new Map();
  model.nodes.forEach((n) => {
    let id = n.id;
    if (id == null || taken.has(String(id))) id = fresh('mmd-');
    else taken.add(String(id));
    ids.set(n.id, String(id));
  });
  const byId = new Map(model.nodes.map((n) => [n.id, n]));

  // parents first
  const ordered = [];
  const seen = new Set();
  const visit = (n) => {
    if (seen.has(n.id)) return;
    seen.add(n.id);
    if (n.parent && byId.has(n.parent)) visit(byId.get(n.parent));
    ordered.push(n);
  };
  model.nodes.forEach(visit);

  const cells = ordered.map((n) => {
    const p = n.parent && byId.get(n.parent);
    return {
      id: ids.get(n.id), vertex: true, value: n.label, style: n.style,
      parent: p ? ids.get(p.id) : layerId,
      geometry: { x: n.x - (p ? p.x : 0), y: n.y - (p ? p.y : 0), w: n.w, h: n.h },
    };
  });
  model.edges.forEach((e) => {
    if (!ids.has(e.source) || !ids.has(e.target)) return;
    let id = e.id;
    if (id == null || taken.has(String(id))) id = fresh('mmd-e');
    else taken.add(String(id));
    cells.push({
      id: String(id), edge: true, value: e.label, style: e.style, parent: layerId,
      source: ids.get(e.source), target: ids.get(e.target),
      geometry: { points: e.points || [] },
    });
  });
  return cells;
}

module.exports = { cellsToModel, modelToCells };
