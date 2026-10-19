'use strict';
// Validates text with the *real* Mermaid parser (mermaid.parse) under jsdom.
const { JSDOM } = require('jsdom');

let mermaidPromise;
function load() {
  if (!mermaidPromise) {
    const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
    global.window = dom.window;
    global.document = dom.window.document;
    try { global.navigator = dom.window.navigator; } catch (e) { /* node >= 21 has a read-only navigator */ }
    global.DOMParser = dom.window.DOMParser;
    mermaidPromise = import('mermaid').then((m) => {
      m.default.initialize({ startOnLoad: false });
      return m.default;
    });
  }
  return mermaidPromise;
}

/** Resolves true when valid; rejects with Mermaid's own error otherwise. */
async function validate(text) {
  const mermaid = await load();
  return mermaid.parse(text);
}

module.exports = { validate };
