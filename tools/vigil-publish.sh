#!/usr/bin/env bash
# Rebuild the itch package and push it with butler.
#
# butler diffs against the last build and uploads only what changed, so a text
# tweak is a few hundred bytes over the wire and players get it without
# re-downloading. It also keeps every build, so a bad push is one `butler
# revert` away rather than a re-upload.
#
#   ./tools/vigil-publish.sh            push the current source
#   ./tools/vigil-publish.sh --dry      build and check auth, push nothing
#
# Target comes from ITCH_TARGET, or tools/.itch-target (one line, gitignored).
set -euo pipefail
TOOLS="$(cd "$(dirname "$0")" && pwd)"
cd "$TOOLS/.."

DRY=0
[ "${1:-}" = "--dry" ] && DRY=1

TARGET="${ITCH_TARGET:-}"
if [ -z "$TARGET" ] && [ -f "$TOOLS/.itch-target" ]; then
  TARGET="$(tr -d ' \n' < "$TOOLS/.itch-target")"
fi
if [ -z "$TARGET" ]; then
  cat >&2 <<'MSG'
No itch target set. It looks like:  username/vigil:html

Set it once:
    echo 'YOURNAME/vigil:html' > tools/.itch-target
MSG
  exit 1
fi

command -v butler >/dev/null || { echo "butler not on PATH (expected ~/.local/bin/butler)" >&2; exit 1; }

# Fail loudly on missing auth rather than letting butler push into a 401. This
# is the class of bug that has bitten this repo before: a guard that returns
# quietly and lets the caller believe it worked.
if [ ! -f "$HOME/.config/itch/butler_creds" ]; then
  echo "butler is not authenticated. Run:  butler login" >&2
  exit 1
fi

"$TOOLS/vigil-release.sh" "$HOME/Desktop/vigil-itch"

# Version the build by the source commit, so a page build maps back to a diff.
VER="$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M)"
if ! git diff --quiet -- vigil/index.html 2>/dev/null; then VER="$VER-dirty"; fi

if [ "$DRY" = "1" ]; then
  echo "dry run: would push $HOME/Desktop/vigil-itch/build -> $TARGET  (version $VER)"
  butler status "$TARGET" || true
  exit 0
fi

butler push "$HOME/Desktop/vigil-itch/build" "$TARGET" --userversion "$VER"
echo
butler status "$TARGET"
