#!/usr/bin/env bash
set -eo pipefail

DOWNLOAD_BASE='https://storage.nextofuture.com/applications/next-notify'
ROOT="$(cd "$(dirname "$0")" && pwd)"
APP="$ROOT/app"
DIST="$APP/dist"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  echo "nvm not found in $NVM_DIR. Install nvm, then run: nvm install 24.14.0" >&2
  exit 1
fi
. "$NVM_DIR/nvm.sh"
if ! nvm use 24.14.0 >/dev/null; then
  echo 'Node.js 24.14.0 not found. Install it with: nvm install 24.14.0' >&2
  exit 1
fi
set -u

MODE="${2:-}"
if [ -z "$MODE" ]; then
  echo '1. Build: app folder to try locally (publish/)'
  echo '2. Installer: installer and update files for the server (installer/)'
  while [ -z "$MODE" ]; do
    read -r -p 'Choose 1 or 2: ' answer
    case "$answer" in
      1) MODE=build ;;
      2) MODE=installer ;;
    esac
  done
elif [ "$MODE" != build ] && [ "$MODE" != installer ]; then
  echo "Not a mode: $MODE (use build or installer)" >&2
  exit 1
fi
if [ "$MODE" = build ]; then OUT="$ROOT/publish"; else OUT="$ROOT/installer"; fi

cd "$APP"
CURRENT="$(node -p "require('./package.json').version")"
VERSION="${1:-}"
PATTERN='^[0-9]+\.[0-9]+\.[0-9]+$'
if [ "$MODE" = build ]; then
  VERSION="$CURRENT"
elif [ -z "$VERSION" ]; then
  while true; do
    read -r -p "Version [$CURRENT] (Enter keeps it): " answer
    if [ -z "$answer" ]; then VERSION="$CURRENT"; break; fi
    if [[ $answer =~ $PATTERN ]]; then VERSION="$answer"; break; fi
    echo 'Use major.minor.patch, e.g. 2.0.1.'
  done
elif ! [[ $VERSION =~ $PATTERN ]]; then
  echo "Not a version: $VERSION (use major.minor.patch, e.g. 2.0.1)" >&2
  exit 1
fi

if [ "$VERSION" != "$CURRENT" ]; then
  older="$(node -p "const [a, b] = ['$VERSION', '$CURRENT'].map((v) => v.split('.').map(Number)); a[0] - b[0] || a[1] - b[1] || a[2] - b[2]")"
  if [ "$older" -lt 0 ]; then
    echo "Warning: $VERSION is older than $CURRENT: installed copies only update to a newer version." >&2
  fi
  npm version "$VERSION" --no-git-tag-version >/dev/null
  echo "Version changed: $CURRENT -> $VERSION (app/package.json, app/package-lock.json)"
fi

if [ ! -d node_modules ]; then
  echo 'Installing packages ...'
  npm ci
fi

rm -rf "$DIST"
echo "Building Next Notify $VERSION ..."
if [ "$MODE" = build ]; then
  npm run build
  CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --dir
else
  CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist
fi

rm -rf "$OUT"
mkdir -p "$OUT"
shopt -s nullglob

if [ "$MODE" = build ]; then
  folders=()
  for folder in "$DIST"/linux-unpacked "$DIST"/mac-universal; do
    if [ -d "$folder" ]; then folders+=("$folder"); fi
  done
  if [ ${#folders[@]} -eq 0 ]; then
    echo "No app folder found in $DIST" >&2
    exit 1
  fi
  cp -R "${folders[@]}" "$OUT/"
  echo
  echo "Ready in $OUT:"
  for folder in "${folders[@]}"; do echo "  $(basename "$folder")"; done
  echo 'Quit the installed Next Notify before starting it: only one copy can run.'
  exit 0
fi

files=("$DIST"/Next-Notify-*"$VERSION"* "$DIST"/latest*.yml)
if [ ${#files[@]} -eq 0 ]; then
  echo "No installer found in $DIST" >&2
  exit 1
fi
cp "${files[@]}" "$OUT/"

echo
echo "Ready in $OUT:"
feeds=''
for file in "${files[@]}"; do
  name="$(basename "$file")"
  case "$name" in
    latest*.yml) feeds="$feeds${feeds:+, }$name" ;;
  esac
  printf '  %s (%s)\n' "$name" "$(du -h "$file" | cut -f1)"
done
echo
echo "Upload everything in $OUT to $DOWNLOAD_BASE/ in this order:"
echo '  1. the installers, .zip and .blockmap files'
echo "  2. last: $feeds"
