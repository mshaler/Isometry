#!/usr/bin/env bash
# check-css-imports.sh — Detect orphan CSS files in src/styles/ that are neither
# imported by a TypeScript file nor linked in index.html.
#
# Exit 0 if all CSS files are referenced. Exit 1 if orphans found.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STYLES_DIR="$PROJECT_ROOT/src/styles"

# CSS files loaded via <link> in index.html (not imported by TS)
EXCEPTIONS=(
	"design-tokens.css"
	"views.css"
	"audit.css"
	"supergrid.css"
	"import-toast.css"
	"action-toast.css"
	"accessibility.css"
	"harness.css"
)

orphans=()

for css_file in "$STYLES_DIR"/*.css; do
	[ -f "$css_file" ] || continue
	basename=$(basename "$css_file")

	# Skip exceptions (loaded via <link> in index.html)
	skip=false
	for exc in "${EXCEPTIONS[@]}"; do
		if [ "$basename" = "$exc" ]; then
			skip=true
			break
		fi
	done
	$skip && continue

	# Skip CSS module files (*.module.css) — they are imported via module syntax
	if [[ "$basename" == *.module.css ]]; then
		continue
	fi

	# Check if any .ts file imports this CSS file
	# Match patterns like: import '../styles/foo.css' or import '../../styles/foo.css'
	if ! grep -rq "$basename" "$PROJECT_ROOT/src/" --include='*.ts' 2>/dev/null; then
		# Also check index.html
		if ! grep -q "$basename" "$PROJECT_ROOT/index.html" 2>/dev/null; then
			orphans+=("$basename")
		fi
	fi
done

if [ ${#orphans[@]} -gt 0 ]; then
	echo "ERROR: Orphan CSS files found (not imported by any .ts file or index.html):"
	for orphan in "${orphans[@]}"; do
		echo "  src/styles/$orphan"
	done
	echo ""
	echo "Fix: Import the CSS file in the TypeScript module that uses it,"
	echo "or add it to the EXCEPTIONS list if loaded via <link> in index.html."
	exit 1
fi

echo "OK: All CSS files in src/styles/ are referenced."
exit 0
