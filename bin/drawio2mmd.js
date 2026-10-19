#!/usr/bin/env node
'use strict';
const fs = require('fs');
const { DOMParser } = require('@xmldom/xmldom');
const { xmlToCells } = require('../src/core/xml');
const { cellsToModel, toMermaid } = require('../src/core');

const [input, output] = process.argv.slice(2);
if (!input || input === '-h' || input === '--help') {
  console.error('Usage: drawio2mmd <diagram.drawio> [out.mmd]   (prints to stdout when no output is given)');
  process.exit(input ? 0 : 1);
}
const cells = xmlToCells(fs.readFileSync(input, 'utf8'), DOMParser);
const { text, warnings } = toMermaid(cellsToModel(cells));
warnings.forEach((w) => console.error('warning: ' + w));
if (output) fs.writeFileSync(output, text); else process.stdout.write(text);
