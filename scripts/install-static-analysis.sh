#!/bin/bash
# =============================================================================
# Static Analysis Ratchet — Installation Script
# =============================================================================
# Run: chmod +x scripts/install-static-analysis.sh && ./scripts/install-static-analysis.sh
#
# This installs all tools in the 10-level static analysis hierarchy.
# After installation, run `npm run check` to see current state.
# =============================================================================

set -e

echo "=========================================="
echo "Installing Static Analysis Ratchet"
echo "=========================================="

# Level 3: Complexity rules
echo ""
echo "[Level 3] Installing eslint-plugin-sonarjs..."
npm install --save-dev eslint-plugin-sonarjs

# Level 6: Unused code detection
echo ""
echo "[Level 6] Installing knip..."
npm install --save-dev knip

# Level 7: Code duplication detection
echo ""
echo "[Level 7] Installing jscpd..."
npm install --save-dev jscpd

# Level 8: Module boundary enforcement
echo ""
echo "[Level 8] Installing dependency-cruiser..."
npm install --save-dev dependency-cruiser

# Pre-commit hooks
echo ""
echo "[Hooks] Installing lefthook..."
npm install --save-dev @evilmartians/lefthook

echo ""
echo "=========================================="
echo "Post-installation steps:"
echo "=========================================="
echo ""
echo "1. Replace eslint config:"
echo "   mv eslint.config.js eslint.config.old.js"
echo "   mv eslint.config.new.js eslint.config.js"
echo ""
echo "2. Add scripts to package.json (see below)"
echo ""
echo "3. Install git hooks:"
echo "   npx lefthook install"
echo ""
echo "4. Run initial check to see current state:"
echo "   npm run check"
echo ""
echo "=========================================="
echo "Add these scripts to package.json:"
echo "=========================================="
echo ""
cat << 'SCRIPTS'
"check": "npm run check:types && npm run check:lint && npm run check:unused && npm run check:duplication && npm run check:boundaries && npm run check:directory-health",
"check:quick": "npm run check:types && npm run check:lint",
"check:types": "tsc --noEmit",
"check:lint": "eslint src --max-warnings 0",
"check:unused": "knip",
"check:duplication": "jscpd src --min-tokens 25 --max-percentage 5 --reporters console",
"check:boundaries": "depcruise src --config .dependency-cruiser.cjs --validate",
"check:directory-health": "node scripts/check-directory-health.mjs"
SCRIPTS
echo ""
echo "=========================================="
echo "Done. Run 'npm run check' to see baseline."
echo "=========================================="
