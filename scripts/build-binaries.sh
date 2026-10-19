#!/usr/bin/env bash
# Builds self-contained executables (no Node needed) for macOS, Linux and Windows into release/.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf release && mkdir -p release
for t in darwin-arm64 darwin-x64 linux-x64 linux-arm64 windows-x64; do
  ext=""; [ "$t" = windows-x64 ] && ext=".exe"
  npx bun build bin/drawio-mermaid.js --compile --minify --target="bun-$t" --outfile "release/drawio-mermaid-$t$ext"
done
(cd release && shasum -a 256 drawio-mermaid-* > SHA256SUMS.txt)
ls -lh release
