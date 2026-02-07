# Static Analysis Ratchet: Code Quality Floor for AI-Assisted Development

*February 2026*

---

## The Problem

Claude Code generates working code that passes tests but accumulates structural debt: files grow past 500 lines, utils/ becomes a junk drawer, cyclomatic complexity creeps up, dead exports multiply. By the time you notice, 50 TypeScript errors have accumulated and manual intervention becomes painful.

The HN insight: **static analysis as a ratchet** — a one-way quality floor that prevents AI-generated code from degrading below human-maintainable thresholds.

## The Principle

> "I stitch all the checks in a single `check` command and defined an agent rule to run this before marking task as complete. Finally, I make sure `check` is run as part of a pre-commit hook to make sure that the agent has indeed addressed all the issues."

**Trust but verify.** CLAUDE.md tells Claude Code to run checks. The pre-commit hook enforces it regardless.

---

## The 10-Level Hierarchy (Isometry Implementation)

| Level | Tool | What It Catches | Status |
|-------|------|-----------------|--------|
| 1 | `tsc --noEmit` | Type errors, unused locals/params | ✅ Have |
| 2 | ESLint (recommended + typescript-eslint) | Basic code smells | ✅ Have (weak) |
| 3 | ESLint + sonarjs | Cyclomatic complexity, cognitive complexity | ❌ Add |
| 4 | ESLint | Max line length (120 chars) | ❌ Add |
| 5 | ESLint | Max file length (300 lines) | ❌ Add |
| 6 | knip | Unused exports, dead dependencies, orphan files | ❌ Add |
| 7 | jscpd | Copy-paste detection (≥25 lines duplicated) | ❌ Add |
| 8 | dependency-cruiser | Module boundary violations | ❌ Add |
| 9 | Custom script | utils/ and hooks/ directory size limits | ❌ Add |
| 10 | (deferred) | Security scanning — evaluate after core levels stable | — |

### Level Thresholds (Isometry-Specific)

These are the **starting thresholds** calibrated to current codebase state. The ratchet tightens over time.

```
Cyclomatic complexity:    max 15 per function (warn), 25 (error)
Cognitive complexity:     max 20 per function (warn), 30 (error)
Max line length:          120 characters (error), ignoreUrls + ignoreStrings
Max file length:          300 lines (warn), 500 lines (error)
Duplication threshold:    25 tokens minimum, 5% max duplicate ratio
Max utils/ files:         30 (currently ~45 — will require cleanup)
Max hooks/ files:         35 (currently ~50 — will require cleanup)
```

**Why these numbers?** The file/directory limits are deliberately tighter than current state. This means Level 5 and Level 9 will fail initially, which is the point — they identify the cleanup work needed before Phase 35 implementation begins.

---

## Implementation

### Phase A: Enhanced ESLint (Levels 2-5)

Upgrade eslint.config.js with complexity and length rules. Uses `eslint-plugin-sonarjs` for cognitive complexity (superior to cyclomatic for human readability assessment).

### Phase B: Dead Code Detection (Level 6)

knip identifies unused exports, unused dependencies, and orphan files. Critical for a codebase with multiple false starts (v1/v2/v3 artifacts in src/).

### Phase C: Duplication Detection (Level 7)

jscpd catches copy-paste between files. AI-generated code is especially prone to this — Claude Code often duplicates patterns rather than extracting shared utilities.

### Phase D: Module Boundaries (Level 8-9)

dependency-cruiser enforces architectural rules:
- `src/db/` cannot import from `src/components/`
- `src/types/` cannot import from anything except other types
- `src/utils/` cannot import from `src/components/` or `src/contexts/`
- Circular dependency detection

Custom script monitors directory sizes to prevent junk drawer accumulation.

### Phase E: Pre-commit Hook + Agent Rule

- lefthook (lighter than husky) runs `npm run check` on pre-commit
- CLAUDE.md GSD pattern updated to include check step

---

## Unified Check Command

```json
{
  "scripts": {
    "check": "npm run check:types && npm run check:lint && npm run check:unused && npm run check:duplication && npm run check:boundaries && npm run check:directory-health",
    "check:types": "tsc --noEmit",
    "check:lint": "eslint src --max-warnings 0",
    "check:unused": "knip",
    "check:duplication": "jscpd src --min-tokens 25 --max-percentage 5 --reporters console",
    "check:boundaries": "depcruise src --config .dependency-cruiser.cjs --validate",
    "check:directory-health": "node scripts/check-directory-health.mjs",
    "check:quick": "npm run check:types && npm run check:lint"
  }
}
```

`check:quick` exists for rapid iteration — types + lint only. Full `check` runs before commits.

---

## GSD Pattern Integration

The static analysis ratchet introduces **three GSD variants** (see CLAUDE.md for full details):

### Feature GSD (building new capabilities)
```
1. Spec → 2. Plan → 3. Implement → 4. Test → 5. Check → 6. Commit (feat:)
```
Step 5 (`npm run check`) is new. The pre-commit hook makes it mandatory. If check fails on code you wrote, fix it before committing.

### Refactor GSD (improving existing structure)
```
1. Diagnose → 2. Scope → 3. Verify pre-state → 4. Refactor → 5. Verify post-state → 6. Commit (refactor:)
```
Triggered by `npm run check` failures in pre-existing code, ratchet tightening, or directory health violations. One structural concern per cycle. Never mixed with feature work.

Key constraint: **change structure only, not behavior.** Tests must pass identically before and after. If refactoring reveals a bug, fix it in a separate `fix:` commit.

### Analysis GSD (understanding before acting)
```
1. Survey → 2. Identify → 3. Prioritize → 4. Plan → 5. Document
```
Produces no commits — produces a prioritized list of Refactor GSD cycles. Run before starting any new phase, after returning from a break, or when check failures indicate systemic issues.

### The Phase Sequence

When starting a new implementation phase (e.g., Phase 35 SuperGrid features):

```
Analysis GSD          → understand current state, identify blockers
  └→ Refactor GSD(s)   → fix structural issues that would impede feature work
      └→ Feature GSD(s) → build the actual capabilities
```

This means Phase 35 starts with `npm run check` and a dependency graph survey, not with writing new code. Cleanup first, build second.

---

## Rollout Sequence

**Week 1:** Levels 1-5 (ESLint enhancement) + pre-commit hook
- Install sonarjs plugin, configure complexity/length rules
- Set initial thresholds permissive enough to pass on current code
- Install lefthook, configure pre-commit
- Update CLAUDE.md with quality gate

**Week 2:** Level 6 (knip)
- Install and configure knip
- Run initial scan, triage results
- Remove genuinely dead code
- Add exceptions for intentionally unused exports (barrel files, future API surface)

**Week 3:** Levels 7-8 (jscpd + dependency-cruiser)
- Install and configure both tools
- Establish module boundary rules matching five-layer architecture
- Run initial scan, fix violations or adjust rules

**Week 4:** Level 9 (directory health) + ratchet tightening
- Build custom directory health script
- Tighten thresholds based on cleanup progress
- Establish monitoring baseline

---

## Decision: Why Not Semgrep (Level 10)?

Deferred, not rejected. Semgrep is valuable for security scanning but:
1. Isometry runs client-side only (no server, no auth, no PII in v4)
2. The attack surface is minimal until CloudKit sync is implemented
3. Adding 10 checks at once creates configuration fatigue
4. Revisit when Phase 3 (CloudKit sync) approaches

---

## Success Criteria

After full rollout, you should be able to:

1. **Jump into any file** and understand it in <60 seconds (max 300 lines, low complexity)
2. **Find any function** by what it does, not where it's hidden (no junk drawers)
3. **Delete any export** with confidence if knip says it's unused
4. **Add a new feature** without accidentally violating module boundaries
5. **Review Claude Code output** and trust that structural quality is maintained even when you weren't watching

The ratchet only tightens. Quality goes up, never back down.

---

*Document Version: 1.0*
*Last Updated: February 2026*
*Applies to: Isometry v4 TypeScript codebase*
