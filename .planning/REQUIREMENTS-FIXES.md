# Requirements Fixes

**Issue Source:** Codex review of REQUIREMENTS.md
**Date:** 2026-02-27

---

## P1 Issues (Must Fix Before Implementation)

### Issue 1: Scope Contradiction — Native Requirements in "Out of Scope" Doc

**Problem:** NSAFE-01..10 are mapped to Phase 7, but "Out of Scope" says native shell and CloudKit are excluded. This creates ownership ambiguity.

**Resolution:** 

The scope statement is correct — the **web runtime build** (Phases 1-6) does not include native implementation. NSAFE requirements are **acceptance criteria for a separate native shell effort**, not part of the web runtime deliverable.

**Action:** Add explicit scoping note to REQUIREMENTS.md:

```markdown
### Native Platform Safety

Requirements derived from `v5/PITFALLS-NATIVE.md`. 

> **Scope Note:** These requirements define acceptance criteria for the **native shell effort** 
> (separate from the web runtime build). They are included here for completeness and to ensure 
> the web runtime's `db.export()` contract is compatible with native persistence needs.
> Phase 7 is a placeholder indicating "after web runtime phases complete."
> 
> The web runtime v1 can ship without NSAFE requirements being implemented — they gate 
> the native app release, not the web runtime release.
```

**v1 Sign-off Impact:** Web runtime v1 can close with Phases 1-6 complete. Native v1 requires Phase 7 (NSAFE-01..10). These are **two separate release gates**.

---

### Issue 2: Undo/Redo Architecture Pre-Selected by WKBR-05

**Problem:** WKBR-05 mandates "inverse SQL command log" which pre-selects the undo architecture before D-009 is formally closed.

**Resolution:**

D-009 in CLAUDE-v5.md **is closed** — command log with inverse operations is the decided architecture. WKBR-05 is correctly aligned with that decision.

**Action:** Add cross-reference to WKBR-05:

```markdown
- [ ] **WKBR-05**: MutationManager generates inverse SQL for every mutation (undo support) — per D-009 decision
```

**No conflict.** The decision log just needs to be marked `Decided` not `Proposed`.

---

### Issue 3: "Compile-Time Throw" Not Implementable for Runtime Input

**Problem:** SAFE-04/SAFE-05 say "throw at compile time" but field/operator validation happens at runtime when filters come from UI.

**Resolution:**

Codex is correct — this is imprecise language. The intent is:
- **TypeScript compile-time:** The `FilterField` and `FilterOperator` types are union types. Passing a string literal not in the union fails `tsc`.
- **Runtime:** When dynamic input arrives (e.g., from JSON), validation throws at runtime.

**Action:** Rewrite SAFE-04 and SAFE-05:

```markdown
- [ ] **SAFE-04**: Unknown fields rejected — TypeScript union type enforces at compile time for literals; 
      runtime validation throws for dynamic input
- [ ] **SAFE-05**: Unknown operators rejected — TypeScript union type enforces at compile time for literals; 
      runtime validation throws for dynamic input
```

This is the standard "parse, don't validate" pattern with TypeScript narrowing.

---

## P2 Issues (Should Fix Before Implementation)

### Issue 4: View Taxonomy Drift — Network vs Graph, Tree Standalone?

**Problem:** Requirements list both `Network` and `Tree` as separate views. If canonical set uses `graph` (covering both), there's a mismatch.

**Resolution:**

The canonical view enum in CLAUDE-v5.md lists **nine views**:
```typescript
type ViewType = 
    | 'list' | 'grid' | 'kanban' | 'calendar' | 'timeline' 
    | 'gallery' | 'network' | 'tree' | 'table';
```

Both `network` and `tree` are distinct views:
- `network`: Force-directed graph (D3 force simulation)
- `tree`: Hierarchical layout (D3 tree/cluster)

**No change needed.** VIEW-08 and VIEW-09 are correctly specified as separate views.

---

### Issue 5: Provider Naming Drift — AxisProvider vs PAFVProvider

**Problem:** Requirements use `AxisProvider`/`ViewProvider` but other docs may use `PAFVProvider`.

**Resolution:**

Review the CLAUDE-v5.md canonical provider list:
- `FilterProvider` — LATCH filtering
- `AxisProvider` — PAFV axis→plane mapping
- `SelectionProvider` — Selected card IDs
- `DensityProvider` — Row/column density
- `ViewProvider` — Current view type

There is no `PAFVProvider`. The axis mapping is handled by `AxisProvider`.

**Action:** Search all v5 docs for `PAFVProvider` and rename to `AxisProvider` if found. The REQUIREMENTS.md naming is correct.

---

### Issue 6: Performance SLOs Underspecified

**Problem:** Latency targets lack test conditions (dataset shape, device class, warm/cold, percentile).

**Resolution:**

Codex is right — these need tightening for deterministic pass/fail.

**Action:** Update PERF requirements:

```markdown
### Performance

Test conditions: MacBook Air M1, 16GB RAM, Chrome 120+, warm state (second run after initial load).
Dataset: 10,000 cards, 50,000 connections, average content size 500 chars.
Metric: p95 latency (95th percentile of 100 runs).

- [ ] **PERF-01**: Card insert p95 <10ms (single card, existing db)
- [ ] **PERF-02**: Bulk insert p95 <1s (1000 cards, single transaction)
- [ ] **PERF-03**: FTS search p95 <100ms (10K cards, 3-word query)
- [ ] **PERF-04**: Graph traversal p95 <500ms (10K cards, 50K connections, depth 3)
- [ ] **PERF-05**: View render p95 <16ms (100 visible cards, SuperGrid)
```

---

## P3 Issues (Can Fix Later)

### Issue 7: DB-01 "Custom FTS5 WASM Build" May Be Unnecessary

**Problem:** As written, DB-01 requires a custom WASM build. If standard sql.js includes FTS5, this adds complexity without value.

**Resolution:**

Check sql.js capabilities:
- Standard sql.js distribution **does include FTS5** since v1.8.0
- Custom build is only needed if you want additional extensions (e.g., R*Tree, JSON1)

**Action:** Rewrite DB-01:

```markdown
- [ ] **DB-01**: sql.js initializes successfully in dev, production, WKWebView, and Vitest; 
      FTS5 capability verified with `SELECT * FROM pragma_compile_options WHERE compile_options LIKE '%FTS5%'`
```

Remove "custom build" language unless R*Tree or other extensions are actually required.

---

## Summary of Required Changes

| Issue | Severity | Action | Owner |
|-------|----------|--------|-------|
| 1. Native scope | P1 | Add scope note clarifying NSAFE is separate release gate | Architect |
| 2. Undo architecture | P1 | Add D-009 cross-reference to WKBR-05; mark D-009 Decided | Architect |
| 3. Compile-time throw | P1 | Rewrite SAFE-04/05 to specify both compile and runtime behavior | Architect |
| 4. View taxonomy | P2 | No change — network and tree are correctly separate | — |
| 5. Provider naming | P2 | Search for PAFVProvider in docs, rename to AxisProvider | Architect |
| 6. Performance SLOs | P2 | Add test conditions, dataset spec, percentile metric | Architect |
| 7. Custom WASM build | P3 | Rewrite DB-01 to verify FTS5 capability, not require custom build | Architect |

---

## Answers to Codex's Open Questions

> Should native safety requirements be moved to a separate native requirements file?

**No.** Keep them in the same file with a clear scope note. This ensures traceability and prevents the native team from missing requirements that were "somewhere else."

> Is Tree truly a required standalone v1 view?

**Yes.** Tree (hierarchical layout) and Network (force-directed) are distinct D3 layout algorithms with different use cases. Both are in the canonical nine-view enum.

> Do you want SAFE-04/05 rewritten as runtime validation requirements?

**Yes, partially.** Rewrite to specify both compile-time (TypeScript union types) and runtime (validation throws) behavior. See Issue 3 resolution above.

---

*Fixes documented: 2026-02-27*
*Source: Codex review findings*
