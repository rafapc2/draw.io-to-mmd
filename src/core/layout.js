'use strict';

let LAYER_GAP = 70;
const NODE_GAP = 40;
const PAD = 24;
const HEADER = 32;

/**
 * Small layered (Sugiyama-style) layout used for Mermaid text that carries no
 * geometry. Works on the plain model: nodes {id,w,h,parent,isGroup}, edges
 * {source,target}. Writes absolute x/y (and w/h of groups) into the nodes.
 *   dir: TD | TB | BT | LR | RL
 */
function layout(nodes, edges, dir) {
  const horizontal = dir === 'LR' || dir === 'RL';
  // leave room for edge labels between layers
  LAYER_GAP = edges.some((e) => e.label) ? (horizontal ? 130 : 90) : 70;
  const reverse = dir === 'BT' || dir === 'RL';
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const kids = new Map();
  nodes.forEach((n) => {
    const p = n.parent && byId.has(n.parent) ? n.parent : null;
    if (!kids.has(p)) kids.set(p, []);
    kids.get(p).push(n);
  });
  const rel = new Map(); // id -> {x,y} relative to parent content origin

  // ancestor chain of a node (self first, root excluded)
  function chain(n) {
    const c = [];
    for (let cur = n; cur; cur = cur.parent && byId.has(cur.parent) ? byId.get(cur.parent) : null) c.push(cur);
    return c;
  }

  function layoutLevel(parentId) {
    const items = kids.get(parentId) || [];
    items.forEach((it) => { if (kids.has(it.id)) layoutGroup(it); });
    if (!items.length) return { w: 0, h: 0 };

    // edges between items of this level
    const idx = new Map(items.map((it, i) => [it.id, i]));
    const links = new Set();
    edges.forEach((e) => {
      const a = byId.get(e.source), b = byId.get(e.target);
      if (!a || !b) return;
      const ca = chain(a), cb = chain(b);
      const ia = ca.find((n) => idx.has(n.id));
      const ib = cb.find((n) => idx.has(n.id));
      if (!ia || !ib || ia === ib) return;
      links.add(idx.get(ia.id) + '>' + idx.get(ib.id));
    });
    const adj = items.map(() => []);
    links.forEach((l) => { const [a, b] = l.split('>').map(Number); adj[a].push(b); });

    // shapes with no connection at this level are set aside and packed in a grid
    const linked = new Set();
    links.forEach((l) => l.split('>').forEach((i) => linked.add(+i)));
    const loose = items.filter((it, i) => !linked.has(i));
    if (loose.length && loose.length < items.length) {
      const rest = items.filter((it, i) => linked.has(i));
      const kidsBackup = kids.get(parentId);
      kids.set(parentId, rest);
      const size = layoutLevel(parentId);
      kids.set(parentId, kidsBackup);
      const maxW = Math.max(size.w, 640);
      let x = 0, y = size.h + LAYER_GAP, rowH = 0;
      loose.forEach((it) => {
        if (x > 0 && x + it.w > maxW) { x = 0; y += rowH + NODE_GAP; rowH = 0; }
        rel.set(it.id, { x, y });
        x += it.w + NODE_GAP; rowH = Math.max(rowH, it.h);
      });
      return { w: Math.max(size.w, x > 0 ? x - NODE_GAP : maxW), h: y + rowH };
    }

    // break cycles with a DFS, then longest-path layering
    const state = items.map(() => 0);
    const dag = items.map(() => []);
    (function visit() {
      function dfs(u) {
        state[u] = 1;
        adj[u].forEach((v) => {
          if (state[v] === 1) return; // back edge: drop
          dag[u].push(v);
          if (state[v] === 0) dfs(v);
        });
        state[u] = 2;
      }
      // start from the sources of the earliest links so that, in a cycle, the
      // direction written first in the text is the one that is kept
      const start = [];
      links.forEach((l) => { const a = +l.split('>')[0]; if (start.indexOf(a) < 0) start.push(a); });
      start.concat(items.map((it, i) => i)).forEach((i) => { if (state[i] === 0) dfs(i); });
    })();
    const layer = items.map(() => 0);
    const indeg = items.map(() => 0);
    dag.forEach((vs) => vs.forEach((v) => indeg[v]++));
    const queue = [];
    indeg.forEach((d, i) => { if (!d) queue.push(i); });
    while (queue.length) {
      const u = queue.shift();
      dag[u].forEach((v) => {
        layer[v] = Math.max(layer[v], layer[u] + 1);
        if (--indeg[v] === 0) queue.push(v);
      });
    }
    const nLayers = Math.max.apply(null, layer) + 1;
    const rows = [];
    for (let l = 0; l < nLayers; l++) rows.push([]);
    items.forEach((it, i) => rows[layer[i]].push(i));

    // barycenter ordering, a few sweeps
    const pos = items.map(() => 0);
    rows.forEach((r) => r.forEach((i, k) => { pos[i] = k; }));
    const preds = items.map(() => []);
    dag.forEach((vs, u) => vs.forEach((v) => preds[v].push(u)));
    for (let sweep = 0; sweep < 4; sweep++) {
      for (let l = 1; l < nLayers; l++) {
        const bc = (i) => (preds[i].length ? preds[i].reduce((s, p) => s + pos[p], 0) / preds[i].length : pos[i]);
        rows[l].sort((a, b) => bc(a) - bc(b) || a - b);
        rows[l].forEach((i, k) => { pos[i] = k; });
      }
      for (let l = nLayers - 2; l >= 0; l--) {
        const bc = (i) => (dag[i].length ? dag[i].reduce((s, p) => s + pos[p], 0) / dag[i].length : pos[i]);
        rows[l].sort((a, b) => bc(a) - bc(b) || a - b);
        rows[l].forEach((i, k) => { pos[i] = k; });
      }
    }

    // coordinates: main axis = layers, cross axis = order inside layer (centred)
    const main = (it) => (horizontal ? it.w : it.h);
    const cross = (it) => (horizontal ? it.h : it.w);
    const order = rows.map((r) => r.slice());
    if (reverse) order.reverse();
    // main axis: one band per layer
    const bandStart = [];
    let m = 0;
    const bandThick = order.map((r) => Math.max.apply(null, r.map((i) => main(items[i]))));
    order.forEach((r, li) => { bandStart[li] = m; m += bandThick[li] + LAYER_GAP; });

    // cross axis: keep the order, but pull every shape towards the average
    // position of its neighbours (forward then backward sweeps), packing overlaps
    const c = items.map(() => 0);
    order.forEach((r) => { let p = 0; r.forEach((i) => { c[i] = p; p += cross(items[i]) + NODE_GAP; }); });
    const neighbours = items.map(() => []);
    dag.forEach((vs, u) => vs.forEach((v) => { neighbours[v].push(u); neighbours[u].push(v); }));
    const center = (i) => c[i] + cross(items[i]) / 2;
    const settle = (r, useNeighbours, reverseSweep) => {
      const seq = reverseSweep ? r.slice().reverse() : r;
      let edge = reverseSweep ? Infinity : -Infinity;
      seq.forEach((i) => {
        const nb = neighbours[i].filter(useNeighbours);
        const want = nb.length ? nb.reduce((s, k) => s + center(k), 0) / nb.length - cross(items[i]) / 2 : c[i];
        if (reverseSweep) { c[i] = Math.min(want, edge - cross(items[i])); edge = c[i] - NODE_GAP; }
        else { c[i] = Math.max(want, edge); edge = c[i] + cross(items[i]) + NODE_GAP; }
      });
    };
    const layerOf = new Map();
    order.forEach((r, li) => r.forEach((i) => layerOf.set(i, li)));
    for (let pass = 0; pass < 3; pass++) {
      order.forEach((r, li) => settle(r, (k) => layerOf.get(k) < li, false));
      for (let li = order.length - 1; li >= 0; li--) settle(order[li], (k) => layerOf.get(k) > li, true);
    }
    const minC = Math.min.apply(null, items.map((it, i) => c[i]));
    const maxC = Math.max.apply(null, items.map((it, i) => c[i] + cross(it)));
    order.forEach((r, li) => r.forEach((i) => {
      const it = items[i];
      const mm = bandStart[li] + (bandThick[li] - main(it)) / 2;
      const cc = c[i] - minC;
      rel.set(it.id, horizontal ? { x: mm, y: cc } : { x: cc, y: mm });
    }));
    const widest = maxC - minC;
    const total = m - LAYER_GAP;
    return horizontal ? { w: total, h: widest } : { w: widest, h: total };
  }

  function layoutGroup(g) {
    const size = layoutLevel(g.id);
    const header = String(g.label || '').trim() ? HEADER : 0; // untitled containers have no title bar
    // shift children below the header and inside the padding
    (kids.get(g.id) || []).forEach((c) => {
      const r = rel.get(c.id);
      rel.set(c.id, { x: r.x + PAD, y: r.y + PAD + header });
    });
    g.w = Math.max(size.w + PAD * 2, 140);
    g.h = size.h + PAD * 2 + header;
  }

  layoutLevel(null);

  function place(parentId, ox, oy) {
    (kids.get(parentId) || []).forEach((n) => {
      const r = rel.get(n.id);
      n.x = Math.round(ox + r.x);
      n.y = Math.round(oy + r.y);
      place(n.id, n.x, n.y);
    });
  }
  place(null, 40, 40);
}

module.exports = { layout };
