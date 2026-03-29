#!/usr/bin/env bash
# check-display-reset.sh — Detect `style.display = ''` anti-pattern in TypeScript source.
#
# Setting style.display = '' removes the inline style entirely, which falls back
# to the CSS cascade. If the element's CSS display is 'none' or a different layout
# mode (e.g., 'flex' vs 'block'), this causes invisible-render bugs.
#
# Fix: Use explicit values like 'flex', 'block', 'grid', or 'none' instead.
#
# WARNING MODE: This script lists violations but exits 0 (does not fail CI).
# TODO: Migrate these files to explicit display values, then change exit to 1:
#   - src/palette/CommandPalette.ts
#   - src/main.ts
#   - src/views/supergrid/SuperGridSelect.ts
#   - src/ui/CollapsibleSection.ts
#   - src/ui/CommandBar.ts
#   - src/ui/NotebookExplorer.ts
#   - src/ui/CardPropertyFields.ts
#   - src/ui/HistogramScrubber.ts

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Search for style.display = '' or style.display = "" in TypeScript source
matches=$(grep -rn "style\.display\s*=\s*['\"]['\"]" "$PROJECT_ROOT/src/" --include='*.ts' 2>/dev/null || true)

if [ -n "$matches" ]; then
	count=$(echo "$matches" | wc -l | tr -d ' ')
	echo "WARNING: Found $count occurrences of style.display = '' (empty string reset):"
	echo ""
	echo "$matches"
	echo ""
	echo "Fix: Replace with explicit display values (e.g., 'flex', 'block', 'none')."
	echo "See: https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/style"
	# WARNING MODE: exit 0 so CI doesn't fail. Change to exit 1 after migration.
	exit 0
fi

echo "OK: No style.display = '' patterns found."
exit 0
