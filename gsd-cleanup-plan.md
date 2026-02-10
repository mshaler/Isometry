# GSD Cleanup Execution Plan

## Phase 1: Surgical Error Fixes (188 → 0 errors)

### Batch 1A: Console.log → Service Logger (100 errors)
**Pattern:** Replace `console.log/debug` with service-specific loggers
**Files:** Bridge utilities, webview managers, connection handlers
**Time:** ~2-3 min per fix, ~5 hours total
**Command:**
```bash
npm run check:lint 2>&1 | grep "no-restricted-syntax" | head -20
```

### Batch 1B: Remaining Critical Errors (88 errors)
**Pattern:** Fix remaining error-level violations
**Time:** ~15-30 min per fix
**Command:**
```bash
npm run check:lint 2>&1 | grep " error " | grep -v "no-restricted-syntax"
```

## Phase 2: Refactor GSD (File Length) - STRUCTURAL
**Target:** 124 file length violations → 0 violations

### Batch 2A: Largest Files First (>400 lines)
**Files:** CardDetailModal (364), ConflictResolutionModal (371), D3Canvas (517), etc.
**Strategy:** Extract components, separate concerns
**Time:** ~30-60 min per file

### Batch 2B: Medium Files (300-400 lines)
**Strategy:** Modularize, extract utilities
**Time:** ~15-30 min per file

## Phase 3: Complexity Reduction (93 violations)
**Target:** Reduce cognitive/cyclomatic complexity

### Batch 3A: Highest Complexity Functions
**Strategy:** Extract methods, early returns, guard clauses
**Time:** ~20-40 min per function

## Phase 4: Warning Budget Management
**Target:** 1453 → 700 warnings (reduce by 753)

### Batch 4A: Easy Wins
- Unused variables
- Missing type annotations
- Prefer const over let

### Batch 4B: Systematic Reduction
- Target specific rule categories
- Batch fixes by file/component

## Automated Workflow Commands

### Check Current Status
```bash
npm run check:lint 2>&1 | tail -1 | grep -o "[0-9]* error\|[0-9]* warning"
```

### Fix Specific Rule Type
```bash
# Console.log fixes
npm run check:lint 2>&1 | grep "no-restricted-syntax" | head -10

# File length violations
npm run check:lint 2>&1 | grep "max-lines" | head -10

# Complexity violations
npm run check:lint 2>&1 | grep "complexity" | head -10
```

### Progress Tracking
```bash
# Error count
npm run check:lint 2>&1 | grep -c " error "

# Warning count over budget
npm run check:lint 2>&1 | tail -1 | grep -o "[0-9]*" | tail -1
```

### Commit Pattern
```bash
git add -A
git commit -m "fix(lint): resolve no-restricted-syntax errors (batch 1/10)"
npm run check:lint # verify progress
```

## Success Criteria
1. **Errors: 188 → 0** (quality gate requirement)
2. **Warnings: 1453 → ≤700** (budget compliance)
3. **All files: ≤300 lines** (structural health)
4. **All functions: complexity ≤15** (cognitive load)

## Execution Order
1. **Surgical fixes first** (console.log → loggers)
2. **Structural fixes second** (file splitting)
3. **Complexity reduction third** (function decomposition)
4. **Warning budget last** (polish)

Each batch should be committed atomically with verification.