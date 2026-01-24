#!/bin/bash
# Sync all knowledge base sources
# Runs GitHub Issues sync and Apple Notes import with auto-commit

set -e  # Exit on error

echo "==================================="
echo "Knowledge Base Sync"
echo "==================================="
echo ""

# GitHub Issues
echo "📋 Syncing GitHub Issues..."
echo ""
python3 scripts/sync-github-issues.py
echo ""

# Apple Notes
echo "📝 Syncing Apple Notes..."
echo ""
python3 scripts/import-apple-notes.py
echo ""

# Summary
echo "==================================="
echo "✅ All syncs complete!"
echo "==================================="
echo ""
echo "Next steps:"
echo "  git push origin main"
echo ""
