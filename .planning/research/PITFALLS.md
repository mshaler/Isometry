# Domain Pitfalls: Error Elimination in Hybrid React/Swift Applications

**Domain:** Error elimination in hybrid React/Swift applications
**Researched:** 2026-01-26
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: TypeScript Migration "Any Virus" Spread

**What goes wrong:**
Temporary `any` types spread throughout the codebase during migration cleanup, creating "TypeScript syntax with JavaScript flexibility" - the worst of both worlds. Teams end up with thousands of `any` annotations that make the codebase feel type-safe but provide no actual safety.

**Why it happens:**
Developers use `any` as a quick fix during migration pressure, then never return to clean it up. The compiler stops complaining, so the technical debt becomes invisible until refactoring or debugging sessions.

**How to avoid:**
- Use `unknown` instead of `any` for better type safety
- Implement custom aliases like `$TSFixMe` with clear naming conventions
- Use `@ts-expect-error` instead of `@ts-ignore` (TypeScript will warn if error no longer exists)
- Set up ESLint rules to flag new `any` usage in CI

**Warning signs:**
- Type coverage dropping below 90%
- Increasing number of runtime type errors
- Developers avoiding type annotations in new code
- IDE autocomplete becoming less helpful

**Phase to address:**
Error Elimination Phase - Create systematic `any` cleanup sprint with automated detection

---

### Pitfall 2: Bridge Invalidation During Cleanup

**What goes wrong:**
In hybrid apps with React/Swift bridges, cleanup operations can trigger bridge invalidation while native modules are still being accessed. This causes mysterious crashes with messages like "bridge has been invalidated" during development reloads or app backgrounding.

**Why it happens:**
Legacy native modules that rely on bridge-specific APIs don't properly handle invalidation timing. Components like RCTImageView get deallocated after the bridge is invalidated, causing lookup failures and memory access violations.

**How to avoid:**
- Implement proper RCTInvalidating protocol conformance in native modules
- Add nil checks for bridge access in all native module methods
- Use weak references to bridge instances in native code
- Test bridge invalidation scenarios explicitly in development

**Warning signs:**
- Random crashes during development reload
- "React not found" errors in AppDelegate.swift
- Bridge deadlocks during navigation
- Native modules returning undefined unexpectedly

**Phase to address:**
Native Bridge Stabilization Phase - Audit all native modules for proper invalidation handling

---

### Pitfall 3: Quarantine Strategy Abandonment

**What goes wrong:**
Teams start with a "quarantine strategy" (excluding files with errors from linting/type checking) but never return to clean up quarantined files. The excluded files list grows indefinitely, creating a parallel codebase that's completely unmonitored.

**Why it happens:**
The immediate pain relief from excluding problematic files makes the problem invisible. Without systematic tracking, teams lose sight of technical debt accumulation and the excluded files become "legacy code" that's too risky to touch.

**How to avoid:**
- Create separate linting configs: one for development (with exclusions) and one for full auditing
- Track quarantined files in a visible dashboard with age metrics
- Set up automated issues for oldest quarantined files
- Allocate specific sprint capacity for "unquarantining" files

**Warning signs:**
- Exclusion list growing faster than it shrinks
- New team members avoiding certain directories
- Different linting rules in different parts of codebase
- "Don't touch that file" becoming common advice

**Phase to address:**
Systematic Cleanup Phase - Create debt reduction sprints with quarantine size targets

---

### Pitfall 4: Database Migration State Leakage

**What goes wrong:**
SQLite migrations in hybrid apps fail to properly clean up state between development reloads, causing schema version mismatches and data corruption. The database schema gets out of sync with TypeScript types, leading to runtime errors that don't surface until production.

**Why it happens:**
Expo's Metro bundler doesn't recognize .sql files by default, causing inconsistent migration loading. State management doesn't properly invalidate caches after schema changes, and migration rollback strategies are often missing in development.

**How to avoid:**
- Add .sql to sourceExts in Metro configuration
- Implement PRAGMA user_version tracking for schema consistency
- Use TanStack Query cache invalidation after migrations
- Test migration scenarios with cold app starts

**Warning signs:**
- "Column doesn't exist" errors in development
- TypeScript types not matching actual database schema
- Query results returning undefined unexpectedly
- Database reset being the only fix for errors

**Phase to address:**
Database Migration Phase - Implement proper migration management and state cleanup

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Using `any` for quick fixes | Eliminates compiler errors immediately | Loses all type safety benefits, spreads virally | Never for production code |
| Excluding files from linting | Reduces noise in CI builds | Creates untouchable legacy code zones | Only during initial migration setup |
| Suppressing warnings globally | Clean build output | Masks real issues, degrades code quality | Never - use targeted suppressions only |
| Skipping migration tests | Faster development iteration | Data corruption in production | Never for schema-changing migrations |
| Ignoring bridge invalidation | Simpler native module code | Random crashes in production | Never - always handle invalidation |

## Integration Gotchas

Common mistakes when connecting React and Swift components.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Native Module Cleanup | Not implementing RCTInvalidating | Always implement invalidate() method |
| State Synchronization | Assuming immediate state updates | Use async/await for bridge communications |
| Type Boundary | Trusting runtime types from bridge | Always validate types at bridge boundaries |
| Metro Bundle Config | Not including .sql in sourceExts | Configure Metro for all resource types |
| Error Handling | Swallowing bridge errors silently | Implement proper error propagation |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Lint rule explosion | Build times increase exponentially | Use opt-out rather than opt-in rules | >500 files |
| Global any types | Autocomplete becomes useless | Incremental typing with unknown | >10% any coverage |
| Uncontrolled exclusions | CI becomes meaningless | Time-boxed exclusion periods | >50 excluded files |
| Bridge polling | UI freezes during data sync | Use event-driven bridge communication | >100 bridge calls/second |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Bridge data validation | Native code trusts JavaScript data | Always validate at native boundaries |
| Error message exposure | Sensitive data in development errors | Sanitize error messages before logging |
| Development/production config | Different error handling in environments | Consistent error handling across environments |

## UX Pitfalls

Common user experience mistakes in error elimination.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Overeager error suppression | Silent failures confuse users | Graceful degradation with user feedback |
| Development-only fixes | Production crashes increase | Test error scenarios in production-like environment |
| Bridge timeout defaults | App appears frozen during sync | Show loading states for bridge operations |
| Type coercion failures | Unexpected behavior in forms | Strict validation with clear error messages |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Type Migration:** Often missing runtime validation — verify types are checked at boundaries
- [ ] **Lint Cleanup:** Often missing CI integration — verify new violations are blocked
- [ ] **Bridge Cleanup:** Often missing invalidation handling — verify proper cleanup on reload
- [ ] **Database Migration:** Often missing rollback strategy — verify reverse migrations work
- [ ] **Error Suppression:** Often missing review schedule — verify suppressions are time-bounded
- [ ] **Native Integration:** Often missing memory management — verify weak references used properly
- [ ] **State Synchronization:** Often missing cache invalidation — verify state consistency across reloads

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Any virus spread | HIGH | 1. Audit codebase with type coverage tools 2. Create targeted refactoring sprints 3. Implement strict rules for new code |
| Bridge invalidation bugs | MEDIUM | 1. Add comprehensive error logging 2. Implement proper RCTInvalidating 3. Add bridge state monitoring |
| Quarantine abandonment | MEDIUM | 1. Create exclusion dashboard 2. Set up automated debt reduction 3. Allocate sprint capacity |
| Database state leakage | HIGH | 1. Reset all local databases 2. Implement proper migration management 3. Add schema validation |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| TypeScript any spread | Error Elimination Phase | Type coverage >95%, zero new any types in CI |
| Bridge invalidation | Native Stabilization Phase | Zero bridge-related crashes in testing |
| Quarantine abandonment | Systematic Cleanup Phase | Quarantine list shrinking week-over-week |
| Database state leakage | Migration Management Phase | All migrations tested with cold starts |
| Lint rule explosion | Configuration Optimization Phase | Build times under 30 seconds |
| Global suppressions | Warning Audit Phase | All suppressions have expiration dates |

## Sources

- [TypeScript Best Practices 2025](https://dev.to/mitu_mariam/typescript-best-practices-in-2025-57hb) - HIGH confidence
- [React Native New Architecture Migration](https://shopify.engineering/react-native-new-architecture) - MEDIUM confidence
- [SwiftLint Large Codebase Strategies](https://medium.com/@chapuyj/fixing-thousands-of-swiftlint-violations-over-time-436691001633) - MEDIUM confidence
- [SQLite Migration Strategies 2025](https://www.sqliteforum.com/p/sqlite-versioning-and-migration-strategies) - MEDIUM confidence
- [JavaScript to TypeScript Migration Guide](https://shubhojit-mitra-dev.medium.com/lets-migrate-to-typescript-an-incremental-adoption-guide-to-type-safe-codebases-30a90711d13f) - MEDIUM confidence
- [React Native Bridge Invalidation Issues](https://github.com/facebook/react-native/commit/8ad810717ee1769aa5ff6c73e0c9bfa8c43a3bac) - HIGH confidence

---
*Pitfalls research for: Error elimination in hybrid React/Swift applications*
*Researched: 2026-01-26*