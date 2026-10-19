'use strict';
// Loads the *built* dist bundle the way draw.io does and drives its dialogs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');
const mx = require('./mxgraph-env');

execSync('npm run build --silent', { cwd: path.join(__dirname, '..') });
const code = fs.readFileSync(path.join(__dirname, '../dist/drawio-mermaid.js'), 'utf8');

function boot() {
  const graph = new mx.mxGraph(document.getElementById('c'));
  const actions = {}, menus = {};
  let dialog = null, alerts = [];
  ['extras', 'exportAs', 'importFrom'].forEach((n) => { menus[n] = { funct() { (this.items = this.items || []).push('base'); } }; });
  const ui = {
    editor: { graph },
    actions: { addAction: (n, f) => { actions[n] = f; } },
    menus: { get: (n) => menus[n], addMenuItems: (m, items) => { m.added = (m.added || []).concat(items); } },
    showDialog: (div) => { dialog = div; },
    hideDialog: () => { dialog = null; },
    alert: (m) => alerts.push(m),
    getCurrentFile: () => ({ getTitle: () => 'demo.drawio' }),
  };
  const sandbox = {
    Draw: { loadPlugin: (fn) => fn(ui) },
    mxResources: { parse() {} },
    mxUtils: { write: (e, t) => e.appendChild(document.createTextNode(t)), button: (l, fn) => { const b = document.createElement('button'); b.textContent = l; b.onclick = fn; return b; } },
    mxCell: mx.mxCell, mxGeometry: mx.mxGeometry, mxPoint: mx.mxPoint,
    document, navigator, URL, Blob, FileReader: window.FileReader, setTimeout,
  };
  vm.runInNewContext(code, sandbox);
  return { graph, actions, menus, ui, get dialog() { return dialog; }, alerts };
}
const btn = (d, label) => Array.from(d.querySelectorAll('button')).find((b) => b.textContent === label);

test('plugin: registers actions and patches the menus', () => {
  const env = boot();
  assert.equal(typeof env.actions.exportMermaid, 'function');
  assert.equal(typeof env.actions.importMermaid, 'function');
  const items = (name) => { const m = {}; env.menus[name].funct.call(env.menus[name], m, null); return m.added; };
  assert.deepEqual(items('extras'), ['-', 'importMermaid', 'exportMermaid']);
  assert.deepEqual(items('exportAs'), ['exportMermaid']);
  assert.deepEqual(items('importFrom'), ['importMermaid']);
  assert.ok(env.menus.extras.items.includes('base'), 'original menu entries are kept');
});

test('plugin: import dialog turns pasted Mermaid into native cells', () => {
  const env = boot();
  env.actions.importMermaid();
  const d = env.dialog;
  d.querySelector('textarea').value = '```mermaid\nflowchart LR\n A[One] -->|go| B((Two))\n```';
  btn(d, 'Import').click();
  assert.equal(env.dialog, null, 'dialog closes on success');
  const cells = env.graph.getModel().getChildCells(env.graph.getDefaultParent(), true, true);
  assert.equal(cells.length, 3);
  assert.equal(env.graph.getSelectionCount(), 3);
});

test('plugin: import dialog shows errors instead of closing', () => {
  const env = boot();
  env.actions.importMermaid();
  const d = env.dialog;
  d.querySelector('textarea').value = 'sequenceDiagram\n A->>B: hi';
  btn(d, 'Import').click();
  assert.ok(env.dialog, 'stays open');
  assert.match(d.textContent, /Import failed: .*flowchart/);
});

test('plugin: export dialog shows Mermaid for the page and reacts to the options', () => {
  const env = boot();
  env.actions.importMermaid();
  env.dialog.querySelector('textarea').value = 'flowchart TD\n A[x] --> B[y]\n';
  btn(env.dialog, 'Import').click();
  env.actions.exportMermaid();
  const d = env.dialog;
  const area = d.querySelector('textarea');
  assert.match(area.value, /^flowchart TD/);
  assert.match(area.value, /%% drawio:node/);
  const box = d.querySelector('input[type=checkbox]');
  box.checked = false; box.dispatchEvent(new window.Event('change'));
  assert.doesNotMatch(area.value, /drawio:/);
});

test('plugin: exporting an empty page explains why there is nothing to export', () => {
  const env = boot();
  env.actions.exportMermaid();
  assert.match(env.dialog.textContent, /no shapes/);
});
