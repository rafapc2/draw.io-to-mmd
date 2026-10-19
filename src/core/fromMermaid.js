'use strict';

const {
  parseStyle, stringifyStyle, normalizeColor, labelToCell,
} = require('./util');
const {
  SHAPES, shapeFromStyle, defaultSize, edgeKindFromStyle, edgeStyleFromKind,
} = require('./shapes');
const { layout } = require('./layout');

const ID = /^[\wÀ-￿]+(?:-(?=[\wÀ-￿])[\wÀ-￿]+)*/;

// [open, shape name(s) with their closers] - longest delimiters first
const OPENERS = [
  ['(((', [[')))', 'doublecircle']]],
  ['((', [['))', 'circle']]],
  ['([', [['])', 'stadium']]],
  ['(', [[')', 'round']]],
  ['[[', [[']]', 'subroutine']]],
  ['[(', [[')]', 'cylinder']]],
  ['[/', [['/]', 'parallelogram'], ['\\]', 'trapezoid']]],
  ['[\\', [['\\]', 'parallelogram_alt'], ['/]', 'trapezoid_alt']]],
  ['[', [[']', 'rect']]],
  ['{{', [['}}', 'hexagon']]],
  ['{', [['}', 'rhombus']]],
  ['>', [[']', 'asymmetric']]],
];

// Link operators, most specific first. Each returns { kind, label? , len }.
const HEAD = '(?:>|[xo](?![\\w]))';
const LINKS = [
  // dotted
  { re: new RegExp(`^(<|[xo](?=-))?-\\.+-(${HEAD})?`), build: (m) => ({ line: 'dotted', s: m[1], e: m[2] }) },
  { re: new RegExp(`^(<)?-\\.\\s+(.+?)\\s+\\.+-(${HEAD})?`), build: (m) => ({ line: 'dotted', s: m[1], e: m[3], label: m[2] }) },
  // thick
  { re: new RegExp(`^(<|[xo](?==))?(?:={2,}(${HEAD})|={3,})`), build: (m) => ({ line: 'thick', s: m[1], e: m[2] }) },
  { re: new RegExp(`^(<)?==\\s+(.+?)\\s+={2,}(${HEAD})?`), build: (m) => ({ line: 'thick', s: m[1], e: m[3], label: m[2] }) },
  // solid
  { re: new RegExp(`^(<|[xo](?=-))?(?:-{2,}(${HEAD})|-{3,})`), build: (m) => ({ line: 'solid', s: m[1], e: m[2] }) },
  { re: new RegExp(`^(<)?--\\s+(.+?)\\s+-{2,}(${HEAD})?`), build: (m) => ({ line: 'solid', s: m[1], e: m[3], label: m[2] }) },
];
const HEAD_NAME = { '<': 'arrow', '>': 'arrow', x: 'cross', o: 'circle' };

const PROP_TO_STYLE = {
  fill: 'fillColor', stroke: 'strokeColor', color: 'fontColor',
};

function unquote(s) {
  s = s.trim();
  let m = s.match(/^"([\s\S]*)"$/);
  if (m) s = m[1];
  m = s.match(/^`([\s\S]*)`$/);
  if (m) s = m[1];
  return s;
}

/** Splits "a:b,c:d" respecting parentheses -> {a:'b', c:'d'}. */
function parseProps(str) {
  const out = {};
  let depth = 0, cur = '';
  const parts = [];
  for (const ch of String(str).replace(/;\s*$/, '')) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  parts.push(cur);
  parts.forEach((p) => {
    const i = p.indexOf(':');
    if (i > 0) out[p.slice(0, i).trim().toLowerCase()] = p.slice(i + 1).trim();
  });
  return out;
}

function splitStatements(line) {
  const out = [];
  let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    if (ch === ';' && !q) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

/**
 * Mermaid flowchart text -> parsed structure.
 */
function parse(text) {
  const g = {
    dir: 'TD', nodes: new Map(), edges: [], classDefs: {}, nodeStyles: {}, linkStyles: [],
    defaultLinkStyle: null, meta: { nodes: {}, edges: {}, graph: null }, warnings: [],
  };
  const stack = []; // open subgraphs
  let headerSeen = false;

  function ensure(id) {
    let n = g.nodes.get(id);
    if (!n) {
      n = { id, label: null, shape: null, classes: [], parent: null, isGroup: false, order: g.nodes.size };
      g.nodes.set(id, n);
    }
    const cur = stack.length ? stack[stack.length - 1] : null;
    if (cur && !n.parent && n.id !== cur) n.parent = cur;
    return n;
  }

  function parseNode(s, pos) {
    const m = s.slice(pos).match(ID);
    if (!m) return null;
    const id = m[0];
    pos += id.length;
    const node = ensure(id);
    const rest = s.slice(pos);
    for (const [open, closers] of OPENERS) {
      if (!rest.startsWith(open)) continue;
      let body = rest.slice(open.length);
      let label = null, shape = null, used = 0;
      const lead = body.match(/^\s*"([^"]*)"\s*/);
      if (lead) {
        for (const [close, name] of closers) {
          if (body.slice(lead[0].length).startsWith(close)) {
            label = lead[1]; shape = name; used = open.length + lead[0].length + close.length; break;
          }
        }
      }
      if (shape === null) {
        let best = -1, bestShape = null, bestClose = '';
        for (const [close, name] of closers) {
          const i = body.indexOf(close);
          if (i >= 0 && (best < 0 || i < best)) { best = i; bestShape = name; bestClose = close; }
        }
        if (best < 0) continue;
        label = body.slice(0, best); shape = bestShape; used = open.length + best + bestClose.length;
      }
      node.label = unquote(label);
      node.shape = shape;
      pos += used;
      break;
    }
    // ::: class shortcut
    const cm = s.slice(pos).match(/^:::([\w-]+)/);
    if (cm) { node.classes.push(cm[1]); pos += cm[0].length; }
    return { nodes: [node], pos };
  }

  function parseNodeGroup(s, pos) {
    const all = [];
    for (;;) {
      while (/\s/.test(s[pos] || '')) pos++;
      const r = parseNode(s, pos);
      if (!r) return all.length ? { nodes: all, pos } : null;
      all.push(r.nodes[0]);
      pos = r.pos;
      while (/\s/.test(s[pos] || '')) pos++;
      if (s[pos] === '&') { pos++; continue; }
      return { nodes: all, pos };
    }
  }

  function parseLink(s, pos) {
    const rest = s.slice(pos);
    for (const L of LINKS) {
      const m = rest.match(L.re);
      if (!m) continue;
      const info = L.build(m);
      let consumed = m[0].length;
      let label = info.label || null;
      const lab = rest.slice(consumed).match(/^\s*\|\s*("[^"]*"|[^|]*)\s*\|/);
      if (lab) { label = unquote(lab[1]); consumed += lab[0].length; }
      return {
        kind: {
          line: info.line,
          start: info.s ? HEAD_NAME[info.s] : 'none',
          end: info.e ? HEAD_NAME[info.e] : 'none',
        },
        label: label === null ? '' : unquote(label),
        pos: pos + consumed,
      };
    }
    return null;
  }

  function chain(s) {
    let r = parseNodeGroup(s, 0);
    if (!r) { g.warnings.push(`Unrecognized statement: ${s}`); return; }
    let prev = r.nodes, pos = r.pos;
    for (;;) {
      while (/\s/.test(s[pos] || '')) pos++;
      if (pos >= s.length) return;
      const link = parseLink(s, pos);
      if (!link) { g.warnings.push(`Unrecognized text "${s.slice(pos)}" in: ${s}`); return; }
      r = parseNodeGroup(s, link.pos);
      if (!r) { g.warnings.push(`Missing node after link in: ${s}`); return; }
      prev.forEach((a) => r.nodes.forEach((b) => g.edges.push({
        source: a.id, target: b.id, label: link.label, kind: link.kind,
      })));
      prev = r.nodes; pos = r.pos;
    }
  }

  String(text).replace(/\r/g, '').split('\n').forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    const meta = line.match(/^%%\s*drawio:(node|edge|graph)\s*(\S*)\s*(\{.*\})\s*$/) ||
                 line.match(/^%%\s*drawio:(graph)()\s*(\{.*\})\s*$/);
    if (meta) {
      try {
        const data = JSON.parse(meta[3]);
        if (meta[1] === 'graph') g.meta.graph = data;
        else g.meta[meta[1] + 's'][meta[2]] = data;
      } catch (e) { g.warnings.push('Ignored malformed drawio metadata line'); }
      return;
    }
    if (line.startsWith('%%')) return;

    const head = line.match(/^(?:flowchart|graph)(?:-elk)?\b\s*(TB|TD|BT|RL|LR)?\s*;?$/i);
    if (head && !headerSeen) {
      headerSeen = true;
      if (head[1]) g.dir = head[1].toUpperCase() === 'TB' ? 'TD' : head[1].toUpperCase();
      return;
    }
    if (!headerSeen && /^[a-zA-Z-]+(\s|$)/.test(line) && !/^(flowchart|graph)/i.test(line) &&
        /^(sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|journey|gitGraph|mindmap|timeline)/.test(line)) {
      throw new Error('Only Mermaid flowcharts ("flowchart" / "graph") are supported');
    }
    headerSeen = true;

    splitStatements(line).forEach((st) => {
      let m;
      if ((m = st.match(/^subgraph\s+(.+)$/i))) {
        const spec = m[1].trim();
        let id, title;
        const sm = spec.match(/^([\wÀ-￿-]+)\s*\[\s*([\s\S]*?)\s*\]$/);
        if (sm) { id = sm[1]; title = unquote(sm[2]); } else { id = unquote(spec); title = id; }
        const grp = ensure(id);
        grp.isGroup = true; grp.label = title; grp.shape = 'group';
        stack.push(id);
        return;
      }
      if (/^end$/i.test(st)) { stack.pop(); return; }
      if (/^direction\s/i.test(st) || /^click\s/i.test(st) || /^accTitle|^accDescr|^title\s/i.test(st)) return;
      if ((m = st.match(/^style\s+(\S+)\s+(.+)$/i))) {
        m[1].split(',').forEach((id) => { g.nodeStyles[id] = Object.assign(g.nodeStyles[id] || {}, parseProps(m[2])); });
        return;
      }
      if ((m = st.match(/^classDef\s+(\S+)\s+(.+)$/i))) {
        m[1].split(',').forEach((c) => { g.classDefs[c] = Object.assign(g.classDefs[c] || {}, parseProps(m[2])); });
        return;
      }
      if ((m = st.match(/^class\s+(\S+)\s+(\S+)$/i))) {
        m[1].split(',').forEach((id) => ensure(id).classes.push(m[2]));
        return;
      }
      if ((m = st.match(/^linkStyle\s+(\S+)\s+(.+)$/i))) {
        const props = parseProps(m[2]);
        if (m[1] === 'default') g.defaultLinkStyle = props;
        else m[1].split(',').forEach((i) => { g.linkStyles[+i] = Object.assign(g.linkStyles[+i] || {}, props); });
        return;
      }
      chain(st);
    });
  });
  return g;
}

/** Applies Mermaid style props (fill/stroke/...) on top of a draw.io style. */
function applyNodeProps(styleStr, props) {
  const s = parseStyle(styleStr);
  Object.keys(props).forEach((k) => {
    const v = props[k];
    if (PROP_TO_STYLE[k]) {
      const key = PROP_TO_STYLE[k];
      if (v === 'transparent' || v === 'none') { if (key !== 'fontColor') s[key] = 'none'; return; }
      const c = normalizeColor(v);
      if (c && normalizeColor(s[key]) !== c) s[key] = c;
    } else if (k === 'stroke-width') {
      const w = parseFloat(v);
      if (!isNaN(w) && parseFloat(s.strokeWidth) !== w) s.strokeWidth = String(w);
    } else if (k === 'stroke-dasharray') {
      if (s.dashed !== '1') s.dashed = '1';
      if (!s.dashPattern && /\d/.test(v) && v.replace(/[\s,]+/g, ' ').trim() !== '5 5') s.dashPattern = v.replace(/[\s,]+/g, ' ').trim();
    } else if (k === 'font-weight' && /bold|[6-9]00/.test(v)) {
      s.fontStyle = String((parseInt(s.fontStyle, 10) || 0) | 1);
    } else if (k === 'font-style' && /italic/.test(v)) {
      s.fontStyle = String((parseInt(s.fontStyle, 10) || 0) | 2);
    } else if (k === 'font-size') {
      const f = parseFloat(v);
      if (!isNaN(f) && parseFloat(s.fontSize) !== f) s.fontSize = String(f);
    }
  });
  return stringifyStyle(s);
}

const GROUP_STYLE = 'swimlane;startSize=32;fontStyle=1;container=1;collapsible=0;whiteSpace=wrap;html=1;' +
  'fillColor=#f5f5f5;strokeColor=#9e9e9e;fontColor=#333333;';

/**
 * Edges without saved routing leave and enter shapes through the facing sides
 * (orthogonal routing otherwise cuts through neighbours); parallel/antiparallel
 * edges between the same two shapes get separate lanes.
 */
function routeEdges(nodes, edges) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const isAncestor = (a, b) => { for (let p = b.parent; p; p = (byId.get(p) || {}).parent) if (p === a.id) return true; return false; };
  const pairs = new Map();
  const todo = edges.filter((e) => !e.fromMeta && e.source !== e.target);
  todo.forEach((e) => {
    const k = [e.source, e.target].sort().join('|');
    pairs.set(k, (pairs.get(k) || []).concat(e));
  });
  todo.forEach((e) => {
    const a = byId.get(e.source), b = byId.get(e.target);
    if (!a || !b || isAncestor(a, b) || isAncestor(b, a)) return;
    const list = pairs.get([e.source, e.target].sort().join('|'));
    const k = list.indexOf(e) + 1, n = list.length + 1;
    const dx = (b.x + b.w / 2) - (a.x + a.w / 2), dy = (b.y + b.h / 2) - (a.y + a.h / 2);
    const r2 = (v) => String(Math.round(Math.min(1, Math.max(0, v)) * 100) / 100);
    // lanes run straight through the stretch where both shapes overlap on the cross axis
    const lane = (a0, a1, b0, b1) => {
      const lo = Math.max(a0, b0), hi = Math.min(a1, b1);
      return hi - lo > 10 ? lo + (hi - lo) * k / n : null;
    };
    const s = parseStyle(e.style);
    if (Math.abs(dx) / (a.w + b.w) >= Math.abs(dy) / (a.h + b.h)) {
      const y = lane(a.y, a.y + a.h, b.y, b.y + b.h);
      s.exitX = dx >= 0 ? '1' : '0'; s.entryX = dx >= 0 ? '0' : '1';
      s.exitY = y === null ? r2(k / n) : r2((y - a.y) / a.h);
      s.entryY = y === null ? r2(k / n) : r2((y - b.y) / b.h);
    } else {
      const x = lane(a.x, a.x + a.w, b.x, b.x + b.w);
      s.exitY = dy >= 0 ? '1' : '0'; s.entryY = dy >= 0 ? '0' : '1';
      s.exitX = x === null ? r2(k / n) : r2((x - a.x) / a.w);
      s.entryX = x === null ? r2(k / n) : r2((x - b.x) / b.w);
    }
    e.style = stringifyStyle(s);
  });
}

/**
 * Shapes added to the Mermaid text after export have no metadata: keep every
 * known shape where it was and lay the new ones out as a block to its right.
 */
function layoutNewNodes(nodes, edges, known, dir) {
  const knownIds = new Set(known.map((n) => n.id));
  const fresh = nodes.filter((n) => !knownIds.has(n.id));
  const freshIds = new Set(fresh.map((n) => n.id));
  const saved = new Map(fresh.map((n) => [n.id, n.parent]));
  fresh.forEach((n) => { if (!freshIds.has(n.parent)) n.parent = null; }); // lay out as a free-standing block
  layout(fresh, edges.filter((e) => freshIds.has(e.source) && freshIds.has(e.target)), dir);
  fresh.forEach((n) => { n.parent = saved.get(n.id); });
  const right = Math.max.apply(null, known.map((n) => n.x + n.w));
  const top = Math.min.apply(null, known.map((n) => n.y));
  const dx = right + 80 - Math.min.apply(null, fresh.map((n) => n.x));
  const dy = top - Math.min.apply(null, fresh.map((n) => n.y));
  fresh.forEach((n) => { n.x += dx; n.y += dy; });
}

const GROUP_STYLE_UNTITLED = 'rounded=0;container=1;collapsible=0;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#9e9e9e;';

/**
 * Mermaid text -> model (same shape as toMermaid's input) with draw.io styles
 * and absolute geometry. Geometry comes from `%% drawio:` metadata when every
 * shape has it; otherwise everything is auto-laid-out.
 */
function fromMermaid(text) {
  const g = parse(text);
  const warnings = g.warnings.slice();
  const nodes = [];
  const list = Array.from(g.nodes.values()).sort((a, b) => a.order - b.order);
  const allMeta = list.length > 0 && list.every((n) => g.meta.nodes[n.id] && isFinite(g.meta.nodes[n.id].x));

  list.forEach((n) => {
    const meta = g.meta.nodes[n.id];
    const shape = n.isGroup ? 'group' : (n.shape || 'rect');
    let label = n.label === null ? n.id : n.label;
    if (label.trim() === '' || (label === '\uD83D\uDDBC' && meta && /image/.test(meta.style || ''))) label = '';
    let style;
    if (n.isGroup) {
      style = meta && meta.style ? meta.style : (label ? GROUP_STYLE : GROUP_STYLE_UNTITLED);
      if (!/(^|;)container=1/.test(style)) style += (style.endsWith(';') || !style ? '' : ';') + 'container=1;';
    } else if (meta && meta.style && shapeFromStyle(meta.style) === shape) {
      style = meta.style;
    } else {
      style = SHAPES[shape].style;
    }
    // classDef (in order) then explicit `style` statements
    const classNames = ['default'].concat(n.classes);
    classNames.forEach((c) => { if (g.classDefs[c]) style = applyNodeProps(style, g.classDefs[c]); });
    if (g.nodeStyles[n.id]) style = applyNodeProps(style, g.nodeStyles[n.id]);

    const size = defaultSize(shape === 'group' ? 'rect' : shape, label);
    nodes.push({
      id: (meta && meta.id) || n.id,
      mermaidId: n.id,
      label: labelToCell(label),
      html: true,
      style,
      shape,
      x: meta && isFinite(meta.x) ? meta.x : 0,
      y: meta && isFinite(meta.y) ? meta.y : 0,
      w: meta && meta.w > 0 ? meta.w : size.w,
      h: meta && meta.h > 0 ? meta.h : size.h,
      parent: n.parent,
      isGroup: n.isGroup,
    });
  });

  // resolve parents to final ids
  const finalId = new Map(nodes.map((n) => [n.mermaidId, n.id]));
  nodes.forEach((n) => { n.parent = n.parent ? finalId.get(n.parent) || null : null; });

  // Edge metadata is matched by (source, target, occurrence) so that adding or
  // deleting edge lines in the text cannot shift other edges' ids/styles; files
  // without endpoint info fall back to the emission index.
  const metaList = Object.keys(g.meta.edges).map(Number).sort((a, b) => a - b).map((k) => g.meta.edges[k]);
  const hasEnds = metaList.some((m) => m.s !== undefined);
  const byPair = new Map();
  metaList.forEach((m) => { const k = m.s + '>' + m.t; byPair.set(k, (byPair.get(k) || []).concat(m)); });
  const seenPair = new Map();
  const edges = g.edges.map((e, i) => {
    let meta;
    if (hasEnds) {
      const k = e.source + '>' + e.target;
      const occ = seenPair.get(k) || 0;
      seenPair.set(k, occ + 1);
      meta = (byPair.get(k) || [])[occ];
    } else meta = g.meta.edges[i];
    const kind = e.kind;
    let style;
    if (meta && meta.style) {
      const k = edgeKindFromStyle(meta.style);
      style = k.start === kind.start && k.end === kind.end && k.line === kind.line ? meta.style : edgeStyleFromKind(kind);
    } else {
      style = edgeStyleFromKind(kind);
    }
    [g.defaultLinkStyle, g.linkStyles[i]].forEach((props) => {
      if (!props) return;
      const mapped = {};
      if (props.stroke) mapped.stroke = props.stroke;
      if (props['stroke-width']) mapped['stroke-width'] = props['stroke-width'];
      if (props.color) mapped.color = props.color;
      style = applyNodeProps(style, mapped);
    });
    return {
      id: (meta && meta.id) || null,
      fromMeta: !!meta,
      source: finalId.get(e.source),
      target: finalId.get(e.target),
      label: labelToCell(e.label),
      html: true,
      style,
      kind,
      points: (meta && meta.points) || [],
    };
  });

  const known = nodes.filter((n) => g.meta.nodes[n.mermaidId] && isFinite(g.meta.nodes[n.mermaidId].x));
  if (!known.length) {
    layout(nodes, edges, g.dir);
    edges.forEach((e) => { e.points = []; });
  } else if (known.length < nodes.length) {
    layoutNewNodes(nodes, edges, known, g.dir);
  }
  routeEdges(nodes, edges);
  return { nodes, edges, dir: g.dir, warnings, hasGeometry: allMeta };
}

module.exports = { fromMermaid, parse, parseProps };
