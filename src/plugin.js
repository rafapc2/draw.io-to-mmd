'use strict';

/**
 * draw.io plugin: Mermaid <-> native draw.io diagrams.
 * Adds "Export to Mermaid..." and "Import from Mermaid..." to the Extras menu
 * (and to File > Export as / Import from when those submenus exist).
 */
const adapter = require('./adapter');

/* global Draw, mxResources, mxUtils, mxCell, mxGeometry, mxPoint */
Draw.loadPlugin(function (ui) {
  const graph = ui.editor.graph;

  mxResources.parse('exportMermaid=Export to Mermaid...');
  mxResources.parse('importMermaid=Import from Mermaid...');

  // ---- small DOM helpers ---------------------------------------------------
  const el = (tag, css, text) => {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text) mxUtils.write(e, text);
    return e;
  };
  const textarea = (readOnly) => {
    const t = el('textarea', 'width:100%;height:290px;box-sizing:border-box;font:12px/1.4 Menlo,Consolas,monospace;' +
      'resize:none;white-space:pre;overflow:auto;');
    t.readOnly = !!readOnly;
    t.spellcheck = false;
    return t;
  };
  const row = () => el('div', 'display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap;');
  const button = (label, fn, primary) => {
    const b = mxUtils.button(label, fn);
    b.className = primary ? 'geBtn gePrimaryBtn' : 'geBtn';
    return b;
  };
  const note = () => el('div', 'margin-top:8px;font-size:12px;color:#b00020;white-space:pre-wrap;min-height:16px;');
  const copy = (text) => {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    const t = textarea(false); t.value = text; document.body.appendChild(t); t.select();
    document.execCommand('copy'); document.body.removeChild(t);
    return Promise.resolve();
  };
  const download = (name, text) => {
    const a = el('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const fileName = () => ((ui.getCurrentFile && ui.getCurrentFile() && ui.getCurrentFile().getTitle()) || 'diagram')
    .replace(/\.(drawio|xml|dio)$/i, '');

  // ---- export --------------------------------------------------------------
  function showExport() {
    const hasSelection = !graph.isSelectionEmpty();
    const div = el('div', 'padding:16px;');
    div.appendChild(el('div', 'font-weight:bold;font-size:15px;margin-bottom:8px;', 'Export to Mermaid'));
    const area = textarea(true);
    const msg = note();
    div.appendChild(area);

    const opts = row();
    const meta = el('input'); meta.type = 'checkbox'; meta.checked = true;
    const metaLabel = el('label', 'cursor:pointer;');
    metaLabel.appendChild(meta);
    metaLabel.appendChild(document.createTextNode(' Include draw.io data (exact sizes, positions & styles for a lossless re-import)'));
    opts.appendChild(metaLabel);
    let sel = null;
    if (hasSelection) {
      sel = el('input'); sel.type = 'checkbox'; sel.checked = true;
      const l = el('label', 'cursor:pointer;');
      l.appendChild(sel); l.appendChild(document.createTextNode(' Selection only'));
      opts.appendChild(l);
    }
    div.appendChild(opts);

    const render = () => {
      try {
        const r = adapter.exportMermaid(graph, { metadata: meta.checked, selectionOnly: sel ? sel.checked : false });
        area.value = r.text;
        msg.style.color = r.empty ? '#b00020' : '#8a6d00';
        msg.textContent = (r.warnings || []).join('\n');
      } catch (e) {
        area.value = '';
        msg.style.color = '#b00020';
        msg.textContent = 'Export failed: ' + e.message;
      }
    };
    meta.addEventListener('change', render);
    if (sel) sel.addEventListener('change', render);
    render();
    div.appendChild(msg);

    const btns = row();
    btns.style.justifyContent = 'flex-end';
    btns.appendChild(button('Copy', function () {
      copy(area.value).then(() => { this.textContent = 'Copied'; setTimeout(() => { this.textContent = 'Copy'; }, 1200); });
    }));
    btns.appendChild(button('Download .mmd', () => download(fileName() + '.mmd', area.value)));
    btns.appendChild(button('Close', () => ui.hideDialog(), true));
    div.appendChild(btns);

    ui.showDialog(div, 720, 480, true, true);
    area.focus();
  }

  // ---- import --------------------------------------------------------------
  function showImport() {
    const div = el('div', 'padding:16px;');
    div.appendChild(el('div', 'font-weight:bold;font-size:15px;margin-bottom:8px;', 'Import from Mermaid'));
    const area = textarea(false);
    area.placeholder = 'flowchart TD\n  A[Start] --> B{Ok?}\n  B -->|yes| C([Done])';
    div.appendChild(area);

    const opts = row();
    const mk = (value, label, checked) => {
      const r = el('input'); r.type = 'radio'; r.name = 'mmd-mode'; r.value = value; r.checked = checked;
      const l = el('label', 'cursor:pointer;'); l.appendChild(r); l.appendChild(document.createTextNode(' ' + label));
      opts.appendChild(l);
      return r;
    };
    mk('insert', 'Add to this page', true);
    const replace = mk('replace', 'Replace this page', false);
    div.appendChild(opts);

    const msg = note();
    div.appendChild(msg);

    const file = el('input'); file.type = 'file'; file.accept = '.mmd,.mermaid,.md,.txt'; file.style.display = 'none';
    file.addEventListener('change', () => {
      const f = file.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => { area.value = String(reader.result); };
      reader.readAsText(f);
    });

    const btns = row();
    btns.style.justifyContent = 'flex-end';
    btns.appendChild(file);
    btns.appendChild(button('Open file...', () => file.click()));
    btns.appendChild(button('Cancel', () => ui.hideDialog()));
    btns.appendChild(button('Import', () => {
      msg.style.color = '#b00020';
      msg.textContent = '';
      const text = area.value.replace(/^\s*```(?:mermaid)?\s*\n?|\n?```\s*$/g, ''); // tolerate a pasted code fence
      if (!text.trim()) { msg.textContent = 'Paste some Mermaid text first.'; return; }
      try {
        const r = adapter.importMermaid(graph, { mxCell, mxGeometry, mxPoint }, text, { replace: replace.checked });
        graph.setSelectionCells(r.cells);
        graph.scrollCellToVisible(r.cells[0]);
        ui.hideDialog();
        if (r.warnings.length) ui.alert('Imported with warnings:\n' + r.warnings.join('\n'));
      } catch (e) {
        msg.textContent = 'Import failed: ' + e.message;
      }
    }, true));
    div.appendChild(btns);

    ui.showDialog(div, 720, 480, true, true);
    area.focus();
  }

  ui.actions.addAction('exportMermaid', showExport);
  ui.actions.addAction('importMermaid', showImport);

  // ---- menus ---------------------------------------------------------------
  const addTo = (name, items, separator) => {
    const menu = ui.menus.get(name);
    if (!menu) return false;
    const old = menu.funct;
    menu.funct = function (m, parent) {
      old.apply(this, arguments);
      ui.menus.addMenuItems(m, separator ? ['-'].concat(items) : items, parent);
    };
    return true;
  };
  addTo('extras', ['importMermaid', 'exportMermaid'], true);
  addTo('exportAs', ['exportMermaid'], false);
  addTo('importFrom', ['importMermaid'], false);
});
