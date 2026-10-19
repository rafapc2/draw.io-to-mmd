#!/bin/sh
# Usage: scripts/sample-test.sh examples/sample02.drawio
# Runs draw.io -> Mermaid -> draw.io and Mermaid(clean) -> draw.io, validates the
# Mermaid with the real parser, and renders screenshots into test-result/.
set -e
cd "$(dirname "$0")/.."
SRC=${1:-examples/sample02.drawio}; N=$(basename "$SRC" .drawio); OUT=test-result; S=$OUT/screenshots
rm -rf "$OUT"; mkdir -p "$S"
node bin/drawio2mmd.js "$SRC" "$OUT/$N.mmd" 2>"$OUT/export-warnings.txt"
node bin/mmd2drawio.js "$OUT/$N.mmd" "$OUT/$N.roundtrip.drawio"
node bin/drawio2mmd.js "$OUT/$N.roundtrip.drawio" "$OUT/$N.roundtrip.mmd"
sed -e '/^ *%%/d' "$OUT/$N.mmd" > "$OUT/$N.clean.mmd"
node bin/mmd2drawio.js "$OUT/$N.clean.mmd" "$OUT/$N.from-clean-mmd.drawio"
node -e "
const fs=require('fs');const {validate}=require('./test/mermaid-validate');
const esc=s=>s.replace(/&/g,'&amp;').replace(/\"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const dio=(f,o)=>fs.writeFileSync(o,'<!doctype html><body style=\"margin:0\"><div class=\"mxgraph\" data-mxgraph=\"'+esc(JSON.stringify({nav:false,toolbar:'',xml:fs.readFileSync(f,'utf8'),'auto-fit':true}))+'\"></div><script src=\"https://viewer.diagrams.net/js/viewer-static.min.js\"></script>');
const mmd=(f,o)=>fs.writeFileSync(o,'<!doctype html><body style=\"margin:0\"><pre class=\"mermaid\">'+fs.readFileSync(f,'utf8').replace(/</g,'&lt;')+'</pre><script src=\"'+process.cwd()+'/node_modules/mermaid/dist/mermaid.min.js\"></script><script>mermaid.initialize({startOnLoad:true,flowchart:{useMaxWidth:false}})</script>');
dio('$SRC','$S/0-original.html');mmd('$OUT/$N.mmd','$S/1-export-mmd.html');
dio('$OUT/$N.roundtrip.drawio','$S/2-roundtrip-drawio.html');dio('$OUT/$N.from-clean-mmd.drawio','$S/3-from-clean-mmd-drawio.html');mmd('$OUT/$N.clean.mmd','$S/4-clean-mmd.html');
(async()=>{for(const f of ['$N.mmd','$N.clean.mmd']){try{await validate(fs.readFileSync('$OUT/'+f,'utf8'));console.log('VALID',f)}catch(e){console.log('INVALID',f,String(e.message).slice(0,200));process.exitCode=1}}})()"
C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for f in $S/*.html; do "$C" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --window-size=1800,1100 --virtual-time-budget=8000 --screenshot="${f%.html}.png" "file://$PWD/$f" >/dev/null 2>&1; done
cat "$OUT/export-warnings.txt"
