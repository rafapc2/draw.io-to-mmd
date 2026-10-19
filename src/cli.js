'use strict';
const fs = require('fs');
const { DOMParser } = require('@xmldom/xmldom');
const { xmlToCells, cellsToXml } = require('./core/xml');
const { cellsToModel, toMermaid, fromMermaid, modelToCells } = require('./core');

function drawioToMmd(input, output) {
  const cells = xmlToCells(fs.readFileSync(input, 'utf8'), DOMParser);
  const { text, warnings } = toMermaid(cellsToModel(cells));
  warnings.forEach((w) => console.error('warning: ' + w));
  if (output) fs.writeFileSync(output, text); else process.stdout.write(text);
}

function mmdToDrawio(input, output) {
  const model = fromMermaid(fs.readFileSync(input, 'utf8'));
  model.warnings.forEach((w) => console.error('warning: ' + w));
  const xml = cellsToXml(modelToCells(model));
  if (output) fs.writeFileSync(output, xml); else process.stdout.write(xml);
}

const USAGE = `Usage:
  drawio-mermaid to-mmd    <diagram.drawio> [out.mmd]      draw.io -> Mermaid
  drawio-mermaid to-drawio <diagram.mmd>    [out.drawio]   Mermaid -> draw.io
  drawio-mermaid --version
Without an output file the result is printed to stdout.`;

/** Entry point of the all-in-one executable. */
function main(argv) {
  const [cmd, input, output] = argv;
  if (cmd === '--version' || cmd === '-v') { console.log(require('../package.json').version); return 0; }
  const run = { 'to-mmd': drawioToMmd, 'to-drawio': mmdToDrawio }[cmd];
  if (!run || !input) { console.error(USAGE); return cmd === '-h' || cmd === '--help' ? 0 : 1; }
  try { run(input, output); return 0; } catch (e) { console.error('error: ' + e.message); return 1; }
}

module.exports = { drawioToMmd, mmdToDrawio, main };
