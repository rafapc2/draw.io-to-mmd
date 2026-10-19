'use strict';

const { parseStyle, normalizeColor, labelFromCell, makeIdAllocator } = require('./util');
const { SHAPES, shapeFromStyle, edgeKindFromStyle, linkOperator } = require('./shapes');

/**
 * Model (see README "Core model"):
 *   nodes: [{ id, label, html, style, x, y, w, h, parent|null, isGroup }]  absolute x/y
 *   edges: [{ id, source, target, label, html, style, points }]
 * Returns { text, warnings }.
 */
function toMermaid(model, opts) {
  opts = opts || {};
  const withMeta = opts.metadata !== false;
  const warnings = (model.warnings || []).slice();
  const alloc = makeIdAllocator();
  const nodes = model.nodes;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map();
  nodes.forEach((n) => {
    const p = n.parent && byId.has(n.parent) ? n.parent : null;
    if (!children.has(p)) children.set(p, []);
    children.get(p).push(n);
  });
  const isGroup = (n) => (children.get(n.id) || []).length > 0;

  const edges = model.edges.filter((e) => {
    const ok = byId.has(e.source) && byId.has(e.target);
    if (!ok) warnings.push(`Edge ${e.id} skipped: it is not connected to two shapes`);
    return ok;
  });

  // ---- direction: whichever axis the connections mostly follow
  let dx = 0, dy = 0;
  edges.forEach((e) => {
    const a = byId.get(e.source), b = byId.get(e.target);
    dx += Math.abs((b.x + b.w / 2) - (a.x + a.w / 2));
    dy += Math.abs((b.y + b.h / 2) - (a.y + a.h / 2));
  });
  if (!edges.length) {
    const xs = nodes.map((n) => n.x + n.w), ys = nodes.map((n) => n.y + n.h);
    dx = Math.max.apply(null, xs.concat([0])) - Math.min.apply(null, nodes.map((n) => n.x).concat([0]));
    dy = Math.max.apply(null, ys.concat([0])) - Math.min.apply(null, nodes.map((n) => n.y).concat([0]));
  }
  let dir = dx > dy ? 'LR' : 'TD';
  if (dir === 'TD') {
    // bottom-up flows (most edges going up) -> BT
    const up = edges.filter((e) => byId.get(e.target).y < byId.get(e.source).y - 1).length;
    if (edges.length && up > edges.length / 2) dir = 'BT';
  } else {
    const left = edges.filter((e) => byId.get(e.target).x < byId.get(e.source).x - 1).length;
    if (edges.length && left > edges.length / 2) dir = 'RL';
  }

  const lines = [`flowchart ${dir}`];
  const meta = [];
  const styles = [];

  const mid = (n) => {
    const st = parseStyle(n.style);
    const kind = isGroup(n) ? 'group' : st.shape === 'image' || st.image ? 'image' : 'shape';
    return alloc(n.id, { label: labelFromCell(n.label, n.html), kind });
  };
  const label = (n) => {
    const t = labelFromCell(n.label, n.html);
    const st = parseStyle(n.style);
    return !t && (st.shape === 'image' || st.image) ? '\uD83D\uDDBC' : t; // Mermaid cannot show images
  };

  function emitNode(n, indent) {
    const id = mid(n);
    const st = parseStyle(n.style);
    if (isGroup(n)) {
      const title = label(n);
      lines.push(`${indent}subgraph ${id} ["${title || ' '}"]`);
      (children.get(n.id) || []).forEach((c) => emitNode(c, indent + '  '));
      lines.push(`${indent}end`);
    } else {
      const sh = SHAPES[shapeFromStyle(st)];
      lines.push(`${indent}${id}${sh.open}"${label(n) || ' '}"${sh.close}`);
    }
    const props = nodeStyleProps(st);
    if (props.length) styles.push(`  style ${id} ${props.join(',')}`);
    if (withMeta) meta.push(`%% drawio:node ${id} ${JSON.stringify(nodeMeta(n))}`);
  }

  (children.get(null) || []).forEach((n) => emitNode(n, '  '));

  // ---- edges
  const linkStyles = [];
  edges.forEach((e, i) => {
    const st = parseStyle(e.style);
    const op = linkOperator(edgeKindFromStyle(st));
    const text = labelFromCell(e.label, e.html);
    lines.push(`  ${mid(byId.get(e.source))} ${op}${text ? `|"${text}"|` : ''} ${mid(byId.get(e.target))}`);
    const props = edgeStyleProps(st);
    if (props.length) linkStyles.push(`  linkStyle ${i} ${props.join(',')}`);
    if (withMeta) meta.push(`%% drawio:edge ${i} ${JSON.stringify(edgeMeta(e, mid(byId.get(e.source)), mid(byId.get(e.target))))}`);
  });

  const out = lines.concat(styles, linkStyles);
  if (withMeta) {
    out.push('  %% --- draw.io round-trip data (ignored by Mermaid) ---');
    out.push(`  %% drawio:graph ${JSON.stringify({ v: 1, dir })}`);
    meta.forEach((m) => out.push('  ' + m));
  }
  return { text: out.join('\n') + '\n', warnings };
}

function nodeMeta(n) {
  return { id: n.id, x: round(n.x), y: round(n.y), w: round(n.w), h: round(n.h), style: n.style || '' };
}

function edgeMeta(e, s, t) {
  const m = { id: e.id, s, t, style: e.style || '' };
  if (e.points && e.points.length) m.points = e.points.map((p) => ({ x: round(p.x), y: round(p.y) }));
  return m;
}

const round = (v) => Math.round((+v || 0) * 100) / 100;

function nodeStyleProps(st) {
  const p = [];
  const fill = normalizeColor(st.fillColor);
  const stroke = normalizeColor(st.strokeColor);
  const font = normalizeColor(st.fontColor);
  if (fill) p.push(`fill:${fill}`);
  else if (st.fillColor === 'none') p.push('fill:transparent');
  if (stroke) p.push(`stroke:${stroke}`);
  else if (st.strokeColor === 'none') p.push('stroke:transparent');
  if (st.strokeWidth && parseFloat(st.strokeWidth) > 0) p.push(`stroke-width:${num(st.strokeWidth)}px`);
  if (font) p.push(`color:${font}`);
  if (st.dashed === '1') p.push(`stroke-dasharray:${(st.dashPattern || '5 5').replace(/,/g, ' ')}`);
  if (st.fontStyle && (parseInt(st.fontStyle, 10) & 1)) p.push('font-weight:bold');
  if (st.fontStyle && (parseInt(st.fontStyle, 10) & 2)) p.push('font-style:italic');
  if (st.fontSize) p.push(`font-size:${num(st.fontSize)}px`);
  return p;
}

function edgeStyleProps(st) {
  const p = [];
  const stroke = normalizeColor(st.strokeColor);
  const font = normalizeColor(st.fontColor);
  if (stroke) p.push(`stroke:${stroke}`);
  if (st.strokeWidth && parseFloat(st.strokeWidth) > 0) p.push(`stroke-width:${num(st.strokeWidth)}px`);
  if (font) p.push(`color:${font}`);
  return p;
}

const num = (v) => String(Math.round(parseFloat(v) * 100) / 100);

module.exports = { toMermaid };
