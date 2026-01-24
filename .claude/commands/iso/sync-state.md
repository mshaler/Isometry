---
name: iso:sync-state
description: Update docs/STATE.md from current git/plan status
user-invocable: true
allowed-tools:
  - Read
  - Edit
  - Bash
  - Glob
  - Grep
---

<objective>
Synchronize docs/STATE.md with current project progress by reading git history, plan completion status, and recent decisions.
</objective>

<context>
@docs/STATE.md
@docs/plans/*.md
@docs/decisions/*.md
</context>

<process>

## 1. Analyze Current Progress

### 1.1 Check Plan Status

```bash
# Count total plans
TOTAL_PLANS=$(ls docs/plans/*.md 2>/dev/null | wc -l)

# Count completed plans (have Completion Summary)
COMPLETED_PLANS=$(grep -l "## Completion Summary" docs/plans/*.md 2>/dev/null | wc -l)

echo "Plans: ${COMPLETED_PLANS}/${TOTAL_PLANS} complete"
```

### 1.2 Check Git Status

```bash
# Recent commits (last 20)
git log --oneline -20

# Current branch
git rev-parse --abbrev-ref HEAD

# Uncommitted changes
git status --porcelain
```

### 1.3 Find Active Phase

```bash
# Find plans without Completion Summary
ACTIVE_PLANS=$(for plan in docs/plans/*.md; do
  if ! grep -q "## Completion Summary" "$plan" 2>/dev/null; then
    echo "$plan"
  fi
done)

# Extract phase number from active plans
if [ -n "$ACTIVE_PLANS" ]; then
  ACTIVE_PHASE=$(echo "$ACTIVE_PLANS" | head -1 | grep -o 'phase-[0-9]' | cut -d'-' -f2)
  echo "Active Phase: ${ACTIVE_PHASE}"
fi
```

### 1.4 Find Recent Decisions

```bash
# List decision files modified in last 30 days
find docs/decisions/ -name "*.md" -mtime -30 2>/dev/null
```

## 2. Extract Lessons Learned

Read Completion Summary sections from completed plans:

```bash
for plan in $(grep -l "## Completion Summary" docs/plans/*.md 2>/dev/null); do
  echo "Reading lessons from: $plan"
  sed -n '/## Completion Summary/,/^##/p' "$plan" | grep "Lessons Learned:"
done
```

## 3. Update STATE.md

Edit docs/STATE.md to update:

### 3.1 Update Header

```markdown
**Last Updated:** $(date +%Y-%m-%d)
**Active Phase:** Phase ${ACTIVE_PHASE} - $(phase_name)
**Blockers:** None | [list]
```

### 3.2 Update Recent Decisions

Add any new decision files from last 30 days:

```markdown
## Recent Decisions

- Decision from $(date) ([[decisions/decision-name]])
- Chose X over Y ([[decisions/another-decision]])
```

### 3.3 Update Active Work

From git status and active plans:

```markdown
## Active Work

- [ ] ${task_from_active_plan}
- [ ] ${uncommitted_work_from_git}
```

### 3.4 Update Accumulated Knowledge

Add lessons learned from completed plan summaries:

```markdown
### What Works

- New insight from Phase ${PHASE}
- Pattern that worked well

### What Doesn't

- Anti-pattern discovered
- Approach that failed

### Open Questions

- Question from plan execution
- Unresolved decision
```

### 3.5 Update Integration Status

Update phase completion percentages:

```markdown
### Phase 1: Foundation ✅

**Status:** Complete

### Phase 2: Views (In Progress)

**Status:** ${PERCENT}% complete

Completed plans: ${COMPLETED} / ${TOTAL}
```

## 4. Commit Changes

```bash
git add docs/STATE.md
git commit -m "docs: sync state from current progress"
```

## 5. Summary

```
✅ STATE.md updated!

Active Phase: ${ACTIVE_PHASE}
Completed Plans: ${COMPLETED}/${TOTAL}
Recent Decisions: ${COUNT}
Lessons Learned: ${COUNT}

Updated sections:
  - Active Work
  - Recent Decisions
  - Accumulated Knowledge
  - Integration Status
```

</process>

<notes>
- Run this periodically (daily or after major work sessions)
- Helps maintain cross-session context
- Extracts lessons automatically from plan SUMMARYs
- Tracks progress toward phase completion
</notes>
