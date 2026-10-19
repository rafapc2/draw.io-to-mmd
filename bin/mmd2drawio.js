#!/usr/bin/env node
'use strict';
const fs = require('fs');
const { cellsToXml } = require('../src/core/xml');
const { fromMermaid, modelToCells } = require('../src/core');

const [input, output] = process.argv.slice(2);
if (!input || input === '-h' || input === '--help') {
  console.error('Usage: mmd2drawio <diagram.mmd> [out.drawio]   (prints to stdout when no output is given)');
  process.exit(input ? 0 : 1);
}
const model = fromMermaid(fs.readFileSync(input, 'utf8'));
model.warnings.forEach((w) => console.error('warning: ' + w));
const xml = cellsToXml(modelToCells(model));
if (output) fs.writeFileSync(output, xml); else process.stdout.write(xml);
