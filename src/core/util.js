'use strict';

// ---- draw.io style strings: "k=v;k=v;flag;" -------------------------------

function parseStyle(str) {
  const out = {};
  const order = [];
  String(str || '').split(';').forEach((part) => {
    part = part.trim();
    if (!part) return;
    const i = part.indexOf('=');
    const k = i < 0 ? part : part.slice(0, i);
    const v = i < 0 ? '' : part.slice(i + 1);
    if (!(k in out)) order.push(k);
    out[k] = v;
  });
  Object.defineProperty(out, '__order', { value: order, enumerable: false });
  return out;
}

function stringifyStyle(obj) {
  const keys = obj.__order ? obj.__order.filter((k) => k in obj) : [];
  Object.keys(obj).forEach((k) => { if (keys.indexOf(k) < 0) keys.push(k); });
  return keys.map((k) => (obj[k] === '' ? k : `${k}=${obj[k]}`)).join(';') + (keys.length ? ';' : '');
}

function setStyle(styleStr, key, value) {
  const s = parseStyle(styleStr);
  if (value === null || value === undefined) delete s[key];
  else s[key] = String(value);
  return stringifyStyle(s);
}

// ---- colors ----------------------------------------------------------------

const NAMED = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', lime: '#00ff00',
  blue: '#0000ff', yellow: '#ffff00', orange: '#ffa500', purple: '#800080', pink: '#ffc0cb',
  gray: '#808080', grey: '#808080', silver: '#c0c0c0', brown: '#a52a2a', cyan: '#00ffff',
  magenta: '#ff00ff', navy: '#000080', teal: '#008080', maroon: '#800000', olive: '#808000',
  gold: '#ffd700', violet: '#ee82ee', lightgray: '#d3d3d3', lightgrey: '#d3d3d3',
  lightblue: '#add8e6', lightgreen: '#90ee90', darkgray: '#a9a9a9', darkgrey: '#a9a9a9',
  darkblue: '#00008b', darkgreen: '#006400', darkred: '#8b0000', coral: '#ff7f50',
};

/**
 * Normalizes any color value found in a draw.io style or a Mermaid style to
 * "#rrggbb" (or "#rrggbbaa"). Returns null for none/default/unknown values.
 */
function normalizeColor(value) {
  if (value === undefined || value === null) return null;
  let v = String(value).trim().toLowerCase();
  // draw.io >= 22: light-dark(#fff,#000) -> use the light variant
  const ld = v.match(/^light-dark\(\s*([^,]+?)\s*(?:,|\))/);
  if (ld) v = ld[1];
  if (!v || v === 'none' || v === 'default' || v === 'inherit' || v === 'transparent') return null;
  let m = v.match(/^#([0-9a-f]{3})$/);
  if (m) return '#' + m[1].split('').map((c) => c + c).join('');
  m = v.match(/^#([0-9a-f]{6}|[0-9a-f]{8})$/);
  if (m) return '#' + m[1];
  m = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) {
    return '#' + [m[1], m[2], m[3]].map((n) => Math.min(255, +n).toString(16).padStart(2, '0')).join('');
  }
  if (NAMED[v]) return NAMED[v];
  return null;
}

// ---- text / labels -----------------------------------------------------------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return String.fromCodePoint(code);
    }
    const r = ENTITIES[e.toLowerCase()];
    return r === undefined ? all : r;
  });
}

/** draw.io cell value (HTML when html=1) -> Mermaid label body (unquoted). */
function labelFromCell(value, isHtml) {
  let s = value == null ? '' : String(value);
  if (isHtml) {
    s = s
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(div|p|li|h[1-6])(\s[^>]*)?>/gi, '\n')
      .replace(/<[^>]+>/g, '');
    s = decodeEntities(s).replace(/\n{2,}/g, '\n').replace(/^\n+|\n+$/g, '');
  }
  // Mermaid entity codes keep the quoted label unambiguous
  return s
    .replace(/\r/g, '')
    .trim()
    .replace(/"/g, '#quot;')
    .replace(/</g, '#lt;')
    .replace(/>/g, '#gt;')
    .replace(/\n/g, '<br/>');
}

const MMD_ENT = { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'", nbsp: ' ' };
const KEEP_TAGS = /&lt;(\/?(?:b|i|u|s|strong|em|sub|sup|code))&gt;/gi;

/** Mermaid label (already unquoted) -> HTML for a draw.io value (html=1). */
function labelToCell(label) {
  return String(label)
    .split(/<br\s*\/?>|\\n/i)
    .map((frag) => frag
      .replace(/#(quot|amp|lt|gt|apos|nbsp);/g, (a, n) => MMD_ENT[n])
      .replace(/#(\d+);/g, (a, n) => String.fromCodePoint(+n))
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(KEEP_TAGS, '<$1>'))
    .join('<br>');
}

const RESERVED = new Set(['end', 'graph', 'flowchart', 'subgraph', 'style', 'class', 'classdef',
  'click', 'linkstyle', 'default', 'direction', 'call', 'href', 'interpolate']);

/** Builds unique, Mermaid-safe ids and remembers the mapping from original ids. */
function makeIdAllocator() {
  const used = new Set();
  const map = new Map();
  const counters = {};
  // draw.io's generated ids ("hM1jXrLUJUxfLcrykFqx-41") are unreadable: replace
  // them by a slug of the label, or `shape_1` / `group_1` / `image_1`
  const readable = (o) => /^[A-Za-z][A-Za-z0-9_-]{0,15}$/.test(o);
  return function alloc(original, hint) {
    if (map.has(original)) return map.get(original);
    let id = String(original).replace(/[^A-Za-z0-9_]/g, '_');
    if (hint && !readable(String(original))) {
      const slug = String(hint.label || '').replace(/<[^>]*>/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24).replace(/_+$/, '');
      const kind = hint.kind || 'shape';
      id = /^[a-z]/.test(slug) ? slug : slug ? kind + '_' + slug : kind + '_' + (counters[kind] = (counters[kind] || 0) + 1);
    }
    if (!id || RESERVED.has(id.toLowerCase()) || /^[ox]/i.test(id) && /^[ox]+$/i.test(id) || /^\d/.test(id)) id = 'n' + id;
    let cand = id;
    for (let i = 2; used.has(cand.toLowerCase()); i++) cand = id + '_' + i;
    used.add(cand.toLowerCase());
    map.set(original, cand);
    return cand;
  };
}

module.exports = {
  parseStyle, stringifyStyle, setStyle, normalizeColor,
  decodeEntities, labelFromCell, labelToCell, makeIdAllocator,
};
