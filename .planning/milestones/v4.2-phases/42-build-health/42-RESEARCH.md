# Phase 42: Build Health - Research

**Researched:** 2026-03-07
**Domain:** Build tooling (TypeScript, Biome, Vitest, Xcode, GitHub Actions CI)
**Confidence:** HIGH

## Summary

Phase 42 establishes build pipeline trust for the Isometry project. The current state is better than STATE.md suggests: `tsc --noEmit` already exits cleanly (0 errors -- the 314 TS errors were fixed in the v4.1 session), but 4 test failures remain in SuperGridSizer and the project lacks both a linter and CI pipeline. The work breaks into four discrete areas: (1) fix 4 pre-existing test failures by updating stale expected values, (2) add Biome 2.x as the project linter/formatter, (3) fix the Xcode Run Script input path and regenerate the provisioning profile, and (4) create a GitHub Actions CI workflow.

All four areas are well-understood with no technical risk. Biome 2.x is stable (v2.4.6 current), the test fixes are mechanical (update hardcoded `160px` to `80px` per post-v3.1 API change), and GitHub Actions CI for Node.js projects is commoditized.

**Primary recommendation:** Fix test expectations first (instant verification), then add Biome config + Makefile targets, fix Xcode build path, and finally add GitHub Actions CI workflow last since it depends on all prior steps passing.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Biome handles both linting AND formatting (replaces ESLint + Prettier in one tool)
- Use Biome's "recommended" rules preset -- catches real bugs without being noisy
- Formatting: tabs, 120-character line width
- CI reports lint/format errors only -- developer runs `biome check --write` locally to fix
- No auto-fix commits in CI
- CI trigger: every push to any branch
- CI scope: web only (tsc + biome check + vitest) -- no Xcode builds in CI
- Required check: block merge on failure (branch protection on main)
- Jobs run in parallel: typecheck, lint, and test as separate concurrent jobs with fail-fast
- Fix all TS errors inline -- no exclusions, no suppressions
- Update the 4 SuperGridSizer test expected values from 160px to 80px
- Keep current tsconfig strictness flags as-is
- Update `make ci` target to include biome check
- Fix npm Run Script build phase path in Xcode project
- Regenerate provisioning profile with CloudKit + iCloud entitlements
- Zero Xcode warnings required -- `make check` must pass clean
- Add `make lint` and `make fix` Makefile targets

### Claude's Discretion
- Biome config file structure and specific rule overrides if needed
- GitHub Actions workflow file structure and caching strategy
- Order of TS error fixes across the 9 test files
- Exact npm Run Script path fix in Xcode build phase

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BUILD-01 | tsc --noEmit passes with zero errors on all source and test files | Already passing (0 errors). Verify-only step. |
| BUILD-02 | Biome 2.x lint check passes on all TypeScript source files | Install @biomejs/biome 2.4.x, create biome.json with tabs + 120-width + recommended rules, run `biome check` |
| BUILD-03 | Xcode npm Run Script build phase succeeds | Fix inputPaths from `$(SRCROOT)/../package.json` to `$(SRCROOT)/../../package.json` |
| BUILD-04 | Provisioning profile includes CloudKit and iCloud Documents entitlements | Entitlements file already correct; profile regeneration is manual Apple Developer Console step |
| BUILD-05 | GitHub Actions CI runs tsc, biome check, and vitest on push | Create `.github/workflows/ci.yml` with 3 parallel jobs |
| STAB-02 | All pre-existing test failures fixed (SuperGridSizer + handler tests) | 4 failures in SuperGridSizer `applyWidths` tests -- update expected `160px` to `80px` and fix depth-vs-width param |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @biomejs/biome | ^2.4.6 | Lint + format TypeScript, JSON | Single tool replaces ESLint + Prettier; Rust-based, 10-100x faster |
| typescript | ^5.9.3 | Type checking | Already installed, strict mode enabled |
| vitest | ^4.0.18 | Test runner | Already installed and configured |

### Supporting (CI)
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| actions/checkout | v5 | Git checkout in CI | Every CI workflow |
| actions/setup-node | v6 | Node.js + npm cache | Every CI workflow |
| biomejs/setup-biome | v2 | Install Biome binary without npm | CI lint job (faster than npm install) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Biome | ESLint + Prettier | Two tools, slower, more config -- user decided Biome |
| biomejs/setup-biome | npm install in lint job | setup-biome is faster (downloads single binary), but npm install needed anyway for vitest/tsc |

**Installation:**
```bash
npm install --save-dev @biomejs/biome
npx biome init  # creates biome.json (then customize)
```

## Architecture Patterns

### Recommended Project Structure (additions)
```
.
├── biome.json                    # Biome linter + formatter config
├── .github/
│   └── workflows/
│       └── ci.yml                # GitHub Actions CI workflow
├── Makefile                      # Extended with lint/fix targets
├── package.json                  # Extended with lint/fix scripts
└── native/Isometry/
    └── Isometry.xcodeproj/
        └── project.pbxproj       # Fixed Run Script input path
```

### Pattern 1: Biome Configuration
**What:** Single `biome.json` at project root configuring lint + format rules
**When to use:** Every TypeScript project using Biome
**Example:**
```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.6/schema.json",
  "files": {
    "include": ["src/**", "tests/**"],
    "ignore": ["dist/**", "dist-native/**", "node_modules/**"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "lineWidth": 120,
    "lineEnding": "lf"
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "always",
      "arrowParentheses": "always",
      "trailingCommas": "all"
    }
  },
  "json": {
    "formatter": {
      "enabled": true
    }
  }
}
```
**Source:** [Biome Configuration Reference](https://biomejs.dev/reference/configuration/)

### Pattern 2: GitHub Actions CI with Parallel Jobs
**What:** Three parallel jobs (typecheck, lint, test) triggered on every push
**When to use:** Required for BUILD-05
**Example:**
```yaml
name: CI
on:
  push:
    branches: ['**']

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: biomejs/setup-biome@v2
        with:
          version: latest
      - run: biome ci .

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      - run: npx vitest --run
```
**Source:** [Biome CI Recipe](https://biomejs.dev/recipes/continuous-integration/), [actions/setup-node](https://github.com/actions/setup-node)

### Pattern 3: Makefile Integration
**What:** Add `lint` and `fix` targets alongside existing `ci` pipeline
**When to use:** BUILD-02 implementation
**Example:**
```makefile
.PHONY: lint
lint: ## Run Biome lint + format check
	npx biome check .

.PHONY: fix
fix: ## Auto-fix Biome lint + format issues
	npx biome check --write .

# Updated ci target:
.PHONY: ci
ci: typecheck lint test-web check ## Full CI: typecheck + lint + vitest + xcode
```

### Anti-Patterns to Avoid
- **Running biome check --write in CI:** CI must be read-only. Use `biome ci` or `biome check` (no `--write`) in GitHub Actions.
- **Installing Biome globally in CI:** Use `biomejs/setup-biome@v2` action for the lint job, or install via `npm ci` for consistency.
- **Combining all CI checks in one job:** Parallel jobs provide faster feedback and clearer failure attribution.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Lint config | ESLint config + plugins | `biome.json` with recommended preset | Biome is single-file, zero-plugin, 100x faster |
| Format config | Prettier + .prettierrc | Biome formatter section | Same tool, same config file |
| CI workflow | Shell scripts on a server | GitHub Actions `.yml` | Free for public repos, integrated with branch protection |
| Biome install in CI | `npm install` in lint job | `biomejs/setup-biome@v2` | Downloads binary directly, no node_modules needed |

**Key insight:** Biome replaces two tools (ESLint + Prettier) with a single binary. The entire configuration is one JSON file with sensible defaults. Do not over-configure -- the `recommended` preset is sufficient.

## Common Pitfalls

### Pitfall 1: Biome Formatting Conflicts with Existing Code Style
**What goes wrong:** Running `biome check` on existing codebase produces hundreds of formatting violations (current code uses 2-space indentation, user wants tabs + 120-width).
**Why it happens:** The project has ~20K lines of TypeScript all using spaces. Switching to tabs will diff every file.
**How to avoid:** Run `biome check --write` once to reformat the entire codebase in a single commit before enabling CI checks. This is a one-time bulk operation.
**Warning signs:** CI fails on every file if formatting isn't applied first.

### Pitfall 2: SuperGridSizer Test Fix Scope Confusion
**What goes wrong:** Fixing only the `160px` -> `80px` values but missing the 4th test which has a different issue (depth vs width parameter).
**Why it happens:** Three tests have the same fix (160 -> 80), but the 4th test (`applyWidths accepts optional rowHeaderWidth parameter`) passes `200` as `rowHeaderDepth`, not `rowHeaderWidth`. With depth=200, it generates 200 columns of 80px.
**How to avoid:** The 4th test must be updated to use the new API semantics: pass a small depth value (e.g., 2) and expect `'80px 80px 120px'`, or pass depth=1 with a custom width via the 5th parameter.
**Warning signs:** 3 tests pass but the 4th still fails with massive repeated `80px` strings.

### Pitfall 3: Xcode Input Path vs Shell Script Path
**What goes wrong:** The `inputPaths` in the Xcode Run Script phase references `$(SRCROOT)/../package.json`, which resolves to `native/package.json` -- a nonexistent file. But the `shellScript` correctly computes REPO_ROOT via `dirname(dirname($SRCROOT))`.
**Why it happens:** `$SRCROOT` is `native/Isometry` (2 levels deep), so `../` only goes up 1 level. The input dependency needs `../../`.
**How to avoid:** Fix `inputPaths` to `$(SRCROOT)/../../package.json`. The shell script's `REPO_ROOT` calculation is already correct.
**Warning signs:** Xcode may skip the Run Script phase if input files haven't changed (stale detection fails on wrong path).

### Pitfall 4: CI Node Version Mismatch
**What goes wrong:** CI uses a different Node version than local dev, causing subtle test differences.
**Why it happens:** Local dev uses Node 24.x, CI defaults to whatever `setup-node` provides.
**How to avoid:** Pin `node-version: 22` in CI (LTS). The project doesn't use Node 24-specific APIs. Add `.node-version` file for documentation.
**Warning signs:** Tests pass locally but fail in CI due to V8 differences.

### Pitfall 5: Branch Protection Before CI Exists
**What goes wrong:** Enabling branch protection before the CI workflow is committed and running.
**Why it happens:** GitHub requires at least one successful workflow run before a required status check can reference it.
**How to avoid:** Push the CI workflow first, wait for it to run and pass, THEN configure branch protection rules.
**Warning signs:** Can't find the status check name in branch protection dropdown.

## Code Examples

### SuperGridSizer Test Fix (STAB-02)
```typescript
// Source: tests/views/supergrid/SuperGridSizer.test.ts lines 564-587
// BEFORE (broken): tests expect 160px default row header width
// AFTER (fixed): tests expect 80px (single 80px column, depth=1)

it('applyWidths sets gridTemplateColumns on gridEl', () => {
  sizer.setColWidths(new Map([['note', 200], ['task', 150]]));
  sizer.applyWidths(['note', 'task'], 1.0, gridEl);
  // 80px row header (depth=1) + 200px + 150px
  expect(gridEl.style.gridTemplateColumns).toBe('80px 200px 150px');
});

it('applyWidths scales by zoomLevel', () => {
  sizer.setColWidths(new Map([['note', 100]]));
  sizer.applyWidths(['note'], 2.0, gridEl);
  expect(gridEl.style.gridTemplateColumns).toBe('80px 200px');
});

it('applyWidths with empty leafColKeys sets only row header', () => {
  sizer.applyWidths([], 1.0, gridEl);
  expect(gridEl.style.gridTemplateColumns).toBe('80px');
});

// 4th test: param is rowHeaderDepth (count of 80px columns), not rowHeaderWidth
it('applyWidths accepts optional rowHeaderDepth parameter', () => {
  sizer.setColWidths(new Map([['note', 120]]));
  sizer.applyWidths(['note'], 1.0, gridEl, 2);
  // 2 header columns of 80px + 120px data column
  expect(gridEl.style.gridTemplateColumns).toBe('80px 80px 120px');
});
```

### Xcode Run Script Input Path Fix (BUILD-03)
```
// In project.pbxproj, line 266:
// BEFORE (wrong):
inputPaths = (
    "$(SRCROOT)/../package.json",
);

// AFTER (correct):
inputPaths = (
    "$(SRCROOT)/../../package.json",
);
```

### biome.json (BUILD-02)
```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.6/schema.json",
  "files": {
    "include": ["src/**/*.ts", "tests/**/*.ts"],
    "ignore": ["dist/**", "dist-native/**"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "lineWidth": 120,
    "lineEnding": "lf"
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "always",
      "arrowParentheses": "always",
      "trailingCommas": "all"
    }
  }
}
```

### GitHub Actions CI Workflow (BUILD-05)
```yaml
name: CI

on:
  push:
    branches: ['**']

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: biomejs/setup-biome@v2
        with:
          version: latest
      - run: biome ci .

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      - run: npx vitest --run
```

### Makefile Additions
```makefile
.PHONY: lint
lint: ## Run Biome lint + format check
	npx biome check .

.PHONY: fix
fix: ## Auto-fix Biome lint + format issues
	npx biome check --write .

# Updated ci target (add lint between typecheck and test-web):
.PHONY: ci
ci: typecheck lint test-web check ## Full CI: typecheck + lint + vitest + xcode
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ESLint + Prettier (2 tools) | Biome (1 tool) | 2023-2024 | Single config, 100x faster |
| ESLint flat config migration | Biome recommended preset | 2024 | No migration pain for new setups |
| actions/setup-node@v4 | actions/setup-node@v6 | 2026 | Auto npm caching |
| actions/checkout@v4 | actions/checkout@v5 | 2025 | No functional change |

**Deprecated/outdated:**
- ESLint + Prettier combo: Still works but Biome is the modern standard for new projects
- `biome init` creates config with `recommended: true` by default since v1.x

## Current Codebase State (Verified)

| Check | Status | Details |
|-------|--------|---------|
| `tsc --noEmit` | PASSING (0 errors) | Fixed during v4.1 (280 errors resolved in 31 files) |
| `vitest --run` | 4 FAILURES | SuperGridSizer.test.ts: 4 `applyWidths` tests expect stale `160px` |
| Biome installed | NO | Not in package.json, no biome.json |
| GitHub Actions | NO | No `.github/` directory |
| Xcode build | FUNCTIONAL | Run Script works despite wrong inputPaths (shell script path is correct) |
| Entitlements | CORRECT | CloudKit + iCloud Documents already configured in .entitlements |
| Provisioning profile | NEEDS REGENERATION | Entitlements correct but profile needs Apple Developer Console action |

## Open Questions

1. **Quote style for Biome formatter**
   - What we know: Need to inspect current codebase to determine if single or double quotes are used
   - What's unclear: Whether the bulk reformat will cause merge conflicts with any in-flight work
   - Recommendation: Use single quotes (common in the codebase from manual inspection), and do the bulk reformat as the first commit to minimize conflict surface

2. **Branch protection timing**
   - What we know: GitHub requires at least one workflow run before the check name appears in branch protection settings
   - What's unclear: Whether the user wants to configure branch protection manually or via `gh` CLI
   - Recommendation: Use `gh api` to set branch protection after first CI run succeeds

3. **Provisioning profile regeneration (BUILD-04)**
   - What we know: The `.entitlements` file already has CloudKit + iCloud. The profile itself must be regenerated in Apple Developer Console.
   - What's unclear: Whether this can be verified programmatically or requires manual Xcode signing check
   - Recommendation: Mark as manual step with verification via `xcodebuild -showBuildSettings | grep PROVISIONING`

## Sources

### Primary (HIGH confidence)
- [Biome Configuration Reference](https://biomejs.dev/reference/configuration/) - formatter/linter config schema
- [Biome CI Recipe](https://biomejs.dev/recipes/continuous-integration/) - GitHub Actions workflow patterns
- [Biome v2 Release Blog](https://biomejs.dev/blog/biome-v2/) - type-aware linting, current features
- [actions/setup-node v6](https://github.com/actions/setup-node) - Node.js setup with npm caching
- Local codebase inspection - tsc, vitest, Xcode project, Makefile (verified 2026-03-07)

### Secondary (MEDIUM confidence)
- [Biome Linter](https://biomejs.dev/linter/) - recommended rules preset behavior
- npm registry - @biomejs/biome v2.4.6 is current stable

### Tertiary (LOW confidence)
- None -- all findings verified against official sources or local codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Biome v2 is stable and well-documented; all versions verified
- Architecture: HIGH - patterns are commoditized (biome.json, GitHub Actions YAML, Makefile)
- Pitfalls: HIGH - test failures reproduced locally, Xcode path issue confirmed, formatting migration understood

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable tooling, unlikely to change)
