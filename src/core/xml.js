'use strict';

// Node/CLI helpers: .drawio / mxGraphModel XML <-> flat cells.
// The browser plugin does not use this file: it reads the live mxGraph model.

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/\n/g, '&#xa;');

function cellsToXml(cells, opts) {
  opts = opts || {};
  const layerId = opts.layerId || '1';
  const out = ['<mxfile host="drawio-mermaid">', `<diagram name="${esc(opts.name || 'Page-1')}" id="mmd-page">`,
    '<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">',
    '<root>', '<mxCell id="0"/>', `<mxCell id="${layerId}" parent="0"/>`];
  cells.forEach((c) => {
    const attrs = [`id="${esc(c.id)}"`, `value="${esc(c.value)}"`, `style="${esc(c.style)}"`];
    attrs.push(c.vertex ? 'vertex="1"' : 'edge="1"', `parent="${esc(c.parent)}"`);
    if (c.source) attrs.push(`source="${esc(c.source)}"`);
    if (c.target) attrs.push(`target="${esc(c.target)}"`);
    const g = c.geometry || {};
    let geo;
    if (c.vertex) geo = `<mxGeometry x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" as="geometry"/>`;
    else {
      const pts = (g.points || []).map((p) => `<mxPoint x="${p.x}" y="${p.y}"/>`).join('');
      geo = `<mxGeometry relative="1" as="geometry">${pts ? `<Array as="points">${pts}</Array>` : ''}</mxGeometry>`;
    }
    out.push(`<mxCell ${attrs.join(' ')}>${geo}</mxCell>`);
  });
  out.push('</root>', '</mxGraphModel>', '</diagram>', '</mxfile>');
  return out.join('\n') + '\n';
}

/** Returns the first page's mxGraphModel element, inflating it when compressed. */
function findGraphModel(xml, DOMParserImpl) {
  const parse = (s) => new DOMParserImpl().parseFromString(s, 'text/xml');
  let doc = parse(xml);
  let model = doc.getElementsByTagName('mxGraphModel')[0];
  if (model) return model;
  const diagram = doc.getElementsByTagName('diagram')[0];
  if (!diagram) throw new Error('No <diagram> or <mxGraphModel> found');
  const zlib = require('zlib');
  const raw = zlib.inflateRawSync(Buffer.from(diagram.textContent.trim(), 'base64')).toString('utf8');
  doc = parse(decodeURIComponent(raw));
  model = doc.getElementsByTagName('mxGraphModel')[0];
  if (!model) throw new Error('Could not read the compressed diagram');
  return model;
}

function xmlToCells(xml, DOMParserImpl) {
  const model = findGraphModel(xml, DOMParserImpl);
  const cells = [];
  const els = model.getElementsByTagName('mxCell');
  for (let i = 0; i < els.length; i++) {
    const el = els[i];
    const geoEl = el.getElementsByTagName('mxGeometry')[0];
    let geometry;
    if (geoEl) {
      const num = (k) => (geoEl.getAttribute(k) ? parseFloat(geoEl.getAttribute(k)) : 0);
      geometry = { x: num('x'), y: num('y'), w: num('width'), h: num('height'), points: [] };
      const pts = geoEl.getElementsByTagName('mxPoint');
      for (let k = 0; k < pts.length; k++) {
        if (pts[k].getAttribute('as') === 'sourcePoint' || pts[k].getAttribute('as') === 'targetPoint') continue;
        geometry.points.push({ x: parseFloat(pts[k].getAttribute('x') || 0), y: parseFloat(pts[k].getAttribute('y') || 0) });
      }
    }
    // shapes with links/tooltips/properties are <UserObject|object label id><mxCell/></...>
    const wrap = el.parentNode && /^(UserObject|object)$/.test(el.parentNode.nodeName) ? el.parentNode : null;
    cells.push({
      id: (wrap && wrap.getAttribute('id')) || el.getAttribute('id'),
      parent: el.getAttribute('parent'),
      vertex: el.getAttribute('vertex') === '1',
      edge: el.getAttribute('edge') === '1',
      value: wrap ? wrap.getAttribute('label') || wrap.getAttribute('value') || '' : el.getAttribute('value') || '',
      style: el.getAttribute('style') || '',
      source: el.getAttribute('source') || null,
      target: el.getAttribute('target') || null,
      geometry,
    });
  }
  return cells;
}

module.exports = { cellsToXml, xmlToCells };
