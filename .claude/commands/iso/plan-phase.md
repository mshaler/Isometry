---
name: iso:plan-phase
description: Create detailed execution plans for Isometry phase using docs/ structure
argument-hint: "<phase-number> [--skip-verify]"
user-invocable: true
agent: Plan
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
Create 3-6 executable plan documents in docs/plans/ for the specified phase, using Isometry's existing templates and phase documentation.

Unlike GSD's `.planning/` structure, Isometry uses Foam KB in `docs/` with enhanced wiki-linking and mobile access.
</objective>

<context>
Phase number: $ARGUMENTS

**Available phases:**
- Phase 1: FOUNDATION (✅ Complete)
- Phase 2: VIEWS (🟡 In Progress)
- Phase 3: FILTERS (⚪ Not Started)

@docs/STATE.md
@docs/PHASE-$PHASE*.md
@docs/plans/_TEMPLATE.md
</context>

<process>

## 1. Parse Arguments

Extract phase number from $ARGUMENTS:

```bash
PHASE=$ARGUMENTS
# Strip any flags
PHASE=$(echo "$PHASE" | grep -o '[0-9]' | head -1)

if [ -z "$PHASE" ]; then
  echo "❌ Error: Phase number required"
  echo "Usage: /iso:plan-phase <phase-number>"
  echo "Example: /iso:plan-phase 2"
  exit 1
fi
```

## 2. Read Phase Documentation

Read the phase overview to understand scope:

```bash
cat docs/PHASE-${PHASE}-*.md
```

Also read:
- `docs/STATE.md` - Current project context
- `docs/REQUIREMENTS.md` - Requirements for this phase
- `docs/plans/_TEMPLATE.md` - Plan template structure

## 3. Identify Plan Breakdown

Based on the phase documentation, break the phase into 3-6 logical plans.

**Wave assignment criteria:**
- **Wave 1:** Foundation work with no dependencies
- **Wave 2:** Feature work depending on Wave 1
- **Wave 3:** Integration work depending on Waves 1 + 2

For Phase 2 (example):
- Wave 1: Canvas Renderer, PAFV State
- Wave 2: Grid View, List View
- Wave 3: View Switcher

## 4. Create Plan Files

For each plan:

1. Copy the template:
   ```bash
   cp docs/plans/_TEMPLATE.md "docs/plans/phase-${PHASE}-<plan-name>.md"
   ```

2. Fill out all sections:
   - Add `phase: ${PHASE}` to frontmatter
   - Add `wave: 1|2|3` to frontmatter
   - Write Problem Statement
   - Define Goals and User Stories
   - List affected files in Critical Files section
   - Break down Implementation Steps (with risk ratings)
   - Add verification steps
   - Link to related specs/decisions

3. Save the file

## 5. Update Phase Documentation

Update `docs/PHASE-${PHASE}-*.md` to link to the new plans:

```markdown
## Plans

- [[plans/phase-2-canvas-renderer]] - Wave 1
- [[plans/phase-2-pafv-state]] - Wave 1
- [[plans/phase-2-grid-view]] - Wave 2
- [[plans/phase-2-list-view]] - Wave 2
- [[plans/phase-2-view-switcher]] - Wave 3
```

## 6. Update STATE.md

Update docs/STATE.md to reflect planning activity:

```markdown
## Active Work

- [x] Planning Phase ${PHASE} (5 plans created)
- [ ] Execute Phase ${PHASE}
```

## 7. Summary

Report created plans:

```
✅ Created 5 plans for Phase ${PHASE}:

Wave 1 (parallel):
  - phase-${PHASE}-<plan1>
  - phase-${PHASE}-<plan2>

Wave 2 (parallel):
  - phase-${PHASE}-<plan3>
  - phase-${PHASE}-<plan4>

Wave 3 (sequential):
  - phase-${PHASE}-<plan5>

Next steps:
  Review plans in docs/plans/
  Run: /iso:execute-phase ${PHASE}
```

</process>

<notes>
- This command creates plans but does NOT execute them
- Plans follow Isometry's existing template structure
- Wave assignments optimize for parallel execution
- Each plan should be 60-120 minutes of work
- Plans link to specs/decisions using Foam wiki-links
</notes>
