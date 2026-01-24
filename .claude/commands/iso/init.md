---
name: iso:init
description: Initialize GSD integration for Isometry (one-time setup)
user-invocable: true
---

<objective>
Set up GSD-style orchestration for Isometry's Foam KB structure. This is a one-time initialization that creates STATE.md, PROJECT.md, REQUIREMENTS.md and enhances existing phase documentation.
</objective>

<context>
This command has already been run! The following files exist:
- docs/STATE.md
- docs/PROJECT.md
- docs/REQUIREMENTS.md
- docs/PHASE-1-FOUNDATION.md (enhanced)
- docs/PHASE-2-VIEWS.md (enhanced)
- docs/PHASE-3-FILTERS.md (enhanced)

GSD integration is complete.
</context>

<process>

## Check if Already Initialized

```bash
if [ -f docs/STATE.md ] && [ -f docs/PROJECT.md ] && [ -f docs/REQUIREMENTS.md ]; then
  echo "✅ GSD integration already initialized!"
  echo ""
  echo "Existing files:"
  ls -lh docs/STATE.md docs/PROJECT.md docs/REQUIREMENTS.md
  echo ""
  echo "Next steps:"
  echo "  /iso:plan-phase 2    - Create plans for Phase 2"
  echo "  /iso:sync-state      - Update STATE.md from current progress"
  exit 0
fi
