'use strict';

const { parseStyle, stringifyStyle, normalizeColor } = require('./util');

/**
 * Mermaid flowchart node shapes <-> draw.io styles.
 * `open`/`close` are the Mermaid delimiters, `style` the base draw.io style
 * and `size` the default geometry used when no sizes are known.
 */
const SHAPES = {
  rect:          { open: '[',   close: ']',   style: 'rounded=0;whiteSpace=wrap;html=1;' },
  round:         { open: '(',   close: ')',   style: 'rounded=1;whiteSpace=wrap;html=1;' },
  stadium:       { open: '([',  close: '])',  style: 'rounded=1;arcSize=50;whiteSpace=wrap;html=1;' },
  subroutine:    { open: '[[',  close: ']]',  style: 'shape=process;whiteSpace=wrap;html=1;backgroundOutline=1;' },
  cylinder:      { open: '[(',  close: ')]',  style: 'shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;', h: 60 },
  circle:        { open: '((',  close: '))',  style: 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;', square: true },
  doublecircle:  { open: '(((', close: ')))', style: 'ellipse;shape=doubleEllipse;whiteSpace=wrap;html=1;aspect=fixed;', square: true },
  rhombus:       { open: '{',   close: '}',   style: 'rhombus;whiteSpace=wrap;html=1;', grow: 1.6 },
  hexagon:       { open: '{{',  close: '}}',  style: 'shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;fixedSize=1;', grow: 1.3 },
  parallelogram: { open: '[/',  close: '/]',  style: 'shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;', grow: 1.3 },
  parallelogram_alt: { open: '[\\', close: '\\]', style: 'shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;flipH=1;', grow: 1.3 },
  trapezoid:     { open: '[/',  close: '\\]', style: 'shape=trapezoid;perimeter=trapezoidPerimeter;whiteSpace=wrap;html=1;fixedSize=1;', grow: 1.3 },
  trapezoid_alt: { open: '[\\', close: '/]',  style: 'shape=trapezoid;perimeter=trapezoidPerimeter;whiteSpace=wrap;html=1;fixedSize=1;flipV=1;', grow: 1.3 },
  asymmetric:    { open: '>',   close: ']',   style: 'shape=step;perimeter=stepPerimeter;whiteSpace=wrap;html=1;fixedSize=1;', grow: 1.2 },
};

/** Infers the Mermaid shape name from a draw.io style (object or string). */
function shapeFromStyle(style) {
  const s = typeof style === 'string' ? parseStyle(style) : style;
  const shape = s.shape || '';
  const flipH = s.flipH === '1';
  const flipV = s.flipV === '1';
  if (shape === 'doubleEllipse') return 'doublecircle';
  if ('ellipse' in s || shape === 'ellipse') return 'circle';
  if ('rhombus' in s || shape === 'rhombus' || shape === 'mxgraph.flowchart.decision') return 'rhombus';
  if (shape === 'hexagon' || shape === 'mxgraph.flowchart.preparation') return 'hexagon';
  if (/^cylinder/.test(shape) || shape === 'datastore' || shape === 'mxgraph.flowchart.database') return 'cylinder';
  if (shape === 'process' || shape === 'mxgraph.flowchart.predefined_process') return 'subroutine';
  if (shape === 'parallelogram' || shape === 'mxgraph.flowchart.data') return flipH ? 'parallelogram_alt' : 'parallelogram';
  if (shape === 'trapezoid') return flipV ? 'trapezoid_alt' : 'trapezoid';
  if (shape === 'step' || shape === 'mxgraph.flowchart.display') return 'asymmetric';
  if (shape === 'mxgraph.flowchart.terminator') return 'stadium';
  if (s.rounded === '1') {
    const arc = parseFloat(s.arcSize);
    return arc >= 40 ? 'stadium' : 'round';
  }
  return 'rect';
}

/** The default size of a Mermaid node shape given its label. */
function defaultSize(shapeName, label) {
  const def = SHAPES[shapeName] || SHAPES.rect;
  const lines = String(label || '').split(/<br\s*\/?>/i);
  const longest = Math.max.apply(null, lines.map((l) => l.replace(/<[^>]+>/g, '').length));
  let w = Math.max(80, Math.round(longest * 8 + 30));
  let h = Math.max(def.h || 40, lines.length * 20 + 20);
  if (def.grow) { w = Math.round(w * def.grow); h = Math.round(h * Math.min(def.grow, 1.4)); }
  if (def.square) { w = h = Math.max(w, h); }
  return { w, h };
}

// ---- edges ---------------------------------------------------------------------

/**
 * Edge head names used in the shared model:
 *  none | arrow | cross | circle
 */
const ARROW_FROM_DRAWIO = {
  none: 'none', classic: 'arrow', classicThin: 'arrow', block: 'arrow', blockThin: 'arrow',
  open: 'arrow', openThin: 'arrow', async: 'arrow', oval: 'circle', ovalThin: 'circle',
  cross: 'cross', diamond: 'circle', diamondThin: 'circle',
};
const ARROW_TO_DRAWIO = { none: 'none', arrow: 'classic', cross: 'cross', circle: 'oval' };

function edgeKindFromStyle(s) {
  if (typeof s === 'string') s = parseStyle(s);
  const end = s.endArrow === undefined ? 'classic' : s.endArrow;
  const start = s.startArrow === undefined ? 'none' : s.startArrow;
  const sw = parseFloat(s.strokeWidth);
  return {
    end: ARROW_FROM_DRAWIO[end] || 'arrow',
    start: ARROW_FROM_DRAWIO[start] || 'none',
    line: s.dashed === '1' || s.dashed === 'true' ? 'dotted' : sw >= 4 ? 'thick' : 'solid',
  };
}

function edgeStyleFromKind(kind, orthogonal) {
  const s = parseStyle((orthogonal === false ? '' : 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;') + 'html=1;');
  s.endArrow = ARROW_TO_DRAWIO[kind.end];
  s.startArrow = ARROW_TO_DRAWIO[kind.start];
  if (kind.end !== 'none') s.endFill = kind.end === 'circle' ? '0' : '1';
  if (kind.line === 'dotted') s.dashed = '1';
  if (kind.line === 'thick') s.strokeWidth = '4';
  return stringifyStyle(s);
}

/** Link operator for a Mermaid edge: `-->`, `-.->`, `<==>`, `--x`, ... */
function linkOperator(kind) {
  const head = { arrow: '>', cross: 'x', circle: 'o', none: '' };
  const tail = { arrow: '<', cross: 'x', circle: 'o', none: '' };
  let body;
  if (kind.line === 'dotted') body = (e) => '-.' + '-' + e;
  else if (kind.line === 'thick') body = (e) => '==' + (e || '=');
  else body = (e) => '--' + (e || '-');
  const e = head[kind.end];
  return tail[kind.start] + body(e);
}

module.exports = {
  SHAPES, shapeFromStyle, defaultSize, edgeKindFromStyle, edgeStyleFromKind, linkOperator, normalizeColor,
};
