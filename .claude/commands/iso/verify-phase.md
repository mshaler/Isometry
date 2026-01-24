---
name: iso:verify-phase
description: Verify Isometry phase completed all requirements
argument-hint: "<phase-number>"
user-invocable: true
agent: gsd-verifier
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
---

<objective>
Check that the specified phase delivered all requirements from docs/REQUIREMENTS.md and docs/PHASE-{N}*.md. Create verification report documenting results.
</objective>

<context>
Phase: $ARGUMENTS

@docs/REQUIREMENTS.md
@docs/PHASE-$PHASE*.md
@docs/STATE.md
</context>

<process>

## 1. Load Phase Requirements

```bash
PHASE=$ARGUMENTS

# Read requirements for this phase
cat docs/REQUIREMENTS.md | sed -n "/### Phase ${PHASE}:/,/### Phase/p"

# Read phase documentation
cat docs/PHASE-${PHASE}-*.md
```

Extract all checkboxes and acceptance criteria.

## 2. Load Plan Summaries

```bash
# Find all completed plans for this phase
PLANS=$(grep -l "^phase: ${PHASE}$" docs/plans/*.md)

for plan in $PLANS; do
  echo "Reading: $plan"
  # Extract Completion Summary section
  sed -n '/## Completion Summary/,$p' "$plan"
done
```

## 3. Test Each Requirement

For each requirement in REQUIREMENTS.md, verify:

### Phase 1 Verification

```bash
# SQLite schema exists
sqlite3 isometry.db ".schema" | grep "CREATE TABLE nodes"

# Sample data loaded
sqlite3 isometry.db "SELECT COUNT(*) FROM nodes"
# Expected: 6891

# TypeScript types compile
npm run typecheck

# Swift types compile
cd native && swift build
```

### Phase 2 Verification

```bash
# React dev server starts
npm run dev &
sleep 5
curl http://localhost:5173
kill %1

# Canvas component exists
test -f src/components/Canvas.tsx

# D3 integration
grep "import.*d3" src/components/Canvas.tsx

# Views exist
ls src/components/GridView.tsx src/components/ListView.tsx
```

### Phase 3 Verification

```bash
# Filter compiler exists
test -f src/filters/LATCHCompiler.ts

# SQL generator exists
test -f src/filters/SQLGenerator.ts

# Tests pass
npm test -- FilterCompiler.test.ts
```

## 4. Create Verification Report

Create `docs/plans/phase-${PHASE}-VERIFICATION.md`:

```markdown
# Phase ${PHASE} Verification Report

**Date:** $(date +%Y-%m-%d)
**Status:** PASS | PARTIAL | FAIL

## Requirements Checklist

- [x] Requirement 1 - ✅ PASS
- [x] Requirement 2 - ✅ PASS
- [ ] Requirement 3 - ❌ FAIL (reason)

## Test Results

### Automated Tests

\`\`\`bash
npm test
# Results: 23 passed, 1 failed
\`\`\`

### Manual Tests

- [x] Canvas renders cards
- [x] Pan/zoom works smoothly
- [ ] View switching preserves filters (BUG: filters reset)

## Gaps Found

1. **View Switcher Filter Reset**
   - Severity: Medium
   - Impact: UX degradation
   - Fix: Add filter state to ViewContext

## Recommendations

- Fix gaps before marking phase complete
- Create gap closure plan: phase-${PHASE}-gap-closure-1.md
- Re-verify after fixes

## Sign-Off

Phase ${PHASE} is: READY | NOT READY
```

## 5. Identify Gaps

If any requirements failed:

```bash
echo ""
echo "⚠️  Gaps found in Phase ${PHASE}"
echo ""
echo "Creating gap closure plan..."
```

Create `docs/plans/phase-${PHASE}-gap-closure-1.md` with:
- Failed requirements
- Proposed fixes
- Wave assignment (typically Wave 4)

## 6. Update STATE.md

```markdown
## Phase ${PHASE} Status

- Verification: $(date +%Y-%m-%d)
- Status: PASS | GAPS FOUND
- Report: [[plans/phase-${PHASE}-VERIFICATION]]
```

## 7. Summary

```
📊 Phase ${PHASE} Verification Report

✅ Passed: 8/10 requirements
❌ Failed: 2/10 requirements

Gaps:
  1. View switcher filter reset
  2. URL state not persisting

Next steps:
  Fix gaps in phase-${PHASE}-gap-closure-1.md
  Re-run: /iso:verify-phase ${PHASE}
```

</process>

<notes>
- Verification runs after /iso:execute-phase
- Creates formal verification report
- Identifies gaps and creates gap closure plans
- Phase is not "complete" until verification passes
</notes>
