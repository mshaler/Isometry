#!/bin/bash
# Create GitHub issues for Figma handoff integration
# Run: gh auth login first

set -e

echo "Creating labels..."
gh label create "figma-handoff" --color "7B68EE" --description "From Figma UI export" 2>/dev/null || true
gh label create "d3" --color "F9A03C" --description "D3.js work" 2>/dev/null || true
gh label create "v3.0" --color "22C55E" --description "v3.0 milestone" 2>/dev/null || true

echo "Creating issues..."

gh issue create --title "Canvas D3 Integration" --label "figma-handoff,d3,v3.0" \
  --body "Replace React Card rendering in Canvas.tsx with D3 data binding.

## Tasks
- [ ] Render cards via D3 \`.data().join()\` pattern
- [ ] Support view type switching (grid, kanban, timeline)
- [ ] Handle 1000+ cards at 60fps
- [ ] Respond to PAFV axis assignments"

gh issue create --title "Dynamic Data Binding" --label "figma-handoff,v3.0" \
  --body "Replace hardcoded arrays with SQLite queries.

## Files
- Navigator.tsx - apps, views, datasets dropdowns
- Sidebar.tsx - filter value lists
- PAFVNavigator.tsx - available facets"

gh issue create --title "Command Bar DSL Integration" --label "figma-handoff,v3.0" \
  --body "Wire CommandBar.tsx to DSL parser.

## Features
- [ ] Parse DSL expressions
- [ ] Autocomplete for field names/values
- [ ] Command history (up/down arrows)
- [ ] Error display"

gh issue create --title "Loading & Error States" --label "figma-handoff,v3.0" \
  --body "Add UX polish to all components.

## Components needed
- [ ] Skeleton loader
- [ ] EmptyState
- [ ] ErrorBoundary

Apply to all panels and async operations."

echo "✅ Created 4 issues!"
echo "View: gh issue list --label figma-handoff"
