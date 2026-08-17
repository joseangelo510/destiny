#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
canonical_url="${PORT_MANIFEST_URL:-https://raw.githubusercontent.com/joseangelo510/destiny/main/PORT_MANIFEST.md}"
local_manifest="$repo_root/.port/PORT_MANIFEST.md"
canonical_manifest="$(mktemp)"
trap 'rm -f "$canonical_manifest"' EXIT

if [[ ! -f "$local_manifest" ]]; then
  echo "PORT PREFLIGHT FAILED: missing $local_manifest" >&2
  exit 1
fi

curl --fail --location --silent --show-error "$canonical_url" --output "$canonical_manifest"

if ! diff --unified "$canonical_manifest" "$local_manifest"; then
  echo "PORT PREFLIGHT FAILED: Replit's manifest differs from GitHub main." >&2
  echo "Port the canonical diff and copy PORT_MANIFEST.md to .port/PORT_MANIFEST.md before publishing." >&2
  exit 1
fi

echo "PORT PREFLIGHT PASSED: Replit manifest matches GitHub main."
