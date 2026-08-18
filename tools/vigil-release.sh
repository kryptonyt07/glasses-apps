#!/usr/bin/env bash
# Build the itch.io package from the current source, and smoke the ARTIFACT
# rather than the thing it was made from.
set -e
TOOLS="$(cd "$(dirname "$0")" && pwd)"
cd "$TOOLS/.."
OUT="${1:-$HOME/Desktop/vigil-itch}"
mkdir -p "$OUT/build"
python3 - "$OUT" <<'PY'
import sys
out=sys.argv[1]
src=open('vigil/index.html').read()
old="""if('serviceWorker' in navigator)
  window.addEventListener('load',()=>navigator.serviceWorker.register('../sw.js').catch(()=>{}));"""
assert old in src, 'service worker block shape changed; check it before assuming it was stripped'
src=src.replace(old,"// (no service worker in the itch build: nothing to register against)")
open(out+'/build/index.html','w').write(src)
PY
rm -f "$OUT/vigil.zip"
( cd "$OUT/build" && zip -q -X "$OUT/vigil.zip" index.html )
VIGIL_HTML="$OUT/build/index.html" "$TOOLS/vigil-smoke.sh"
echo "package: $OUT/vigil.zip  ($(wc -c < "$OUT/vigil.zip" | tr -d ' ') bytes)"
