'use strict';
// Real mxGraph (the engine draw.io is built on) running under jsdom.
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><body><div id="c"></div></body>');
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
global.XMLSerializer = dom.window.XMLSerializer;
global.DOMParser = dom.window.DOMParser;
global.Node = dom.window.Node;
global.location = dom.window.location;
global.window.mxLoadResources = false;
global.window.mxLoadStylesheets = false;
const mx = require('mxgraph')({ mxImageBasePath: '', mxBasePath: '' });
module.exports = mx;
