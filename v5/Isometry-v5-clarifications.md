# Isometry v5 Review: Clarifying Questions Answered

**Date:** February 2026

This document provides definitive answers to the clarifying questions raised in the spec review.

---

## Review Input Summary

### Findings (highest impact first)

1. **[P1] Core data model is self-contradictory on whether edges are cards.**  
`SPEC` says “Edges are cards” and defines explicit edge types, but `Cards.md` says connections are not cards and explicitly says not to predefine edge types. This will break schema, ETL mapping, and graph APIs.

2. **[P1] Worker/Provider contracts diverge across docs (unimplementable as written).**  
There are two incompatible WorkerBridge protocols (`type/payload` envelope vs flat message types), and `exec()` return semantics conflict with provider usage (`changes` object vs row arrays).

3. **[P1] Query compilation currently allows SQL injection paths.**  
`FilterProvider` interpolates `field` and raw `compiledSQL` directly into SQL fragments without allowlisting or AST validation.

4. **[P1] Search schema is incompatible with card schema and likely breaks FTS joins.**  
`SearchExplorer` uses `title`/`source_name` and `content_rowid='id'`, while `cards` defines `name`/`source`; also joins compare `c.id` to FTS rowid.

5. **[P2] State-tier persistence rules conflict (selection persisted vs ephemeral).**  
`SPEC` marks selection as Tier 3 non-persistent, while `Providers.md` puts `SelectionProvider` in Tier 1 global persistence.

6. **[P2] View taxonomy drifts across documents.**  
`SPEC` emphasizes Gallery/Charts; module docs define Calendar/Table; provider enums also include Calendar/Table and omit Gallery/Charts.

7. **[P2] Credential storage guidance is inconsistent and under-specified.**  
Slack flow says Keychain, but implementation shows storing credentials in SQLite settings (even if “encrypted”), with no key management contract.

8. **[P3] SQLite as sole system-of-record is diluted by localStorage persistence in multiple modules.**  
This may be intentional for UI cache, but currently it conflicts with “all data elements persisted in SQLite.”

### Recommendations

1. Create a single canonical “contracts” doc for `Card/Connection model`, `View enum`, `Worker protocol`, and `Provider interfaces`, then make every module import/reference that source.
2. Add a hard SQL safety rule: allowlisted column registry + parameterized values only; forbid raw SQL fragments from UI/state.
3. Define an explicit FTS contract (`cards` columns + rowid strategy) and reuse the same SQL snippets across `Cards`, `SearchExplorer`, and `WorkerBridge`.
4. Add a “consistency CI check” for docs: duplicated type definitions must match (`ViewType`, message types, tier tables).
5. Separate persistence classes: authoritative (SQLite) vs ephemeral cache (`localStorage`) and document exactly what can never leave SQLite.
6. Add robustness requirements for ETL: idempotency keys, resumable imports, per-source watermarking, and deterministic conflict policy tests.

### Clarifying Questions

1. Do you want to commit to “edges are cards” or “edges are lightweight relations” for v5?
2. Which WorkerBridge spec is canonical: `/Modules/WorkerBridge.md` or `/Modules/Core/WorkerBridge.md`?
3. Is `SelectionProvider` intended to persist across app restarts, or only within-session?
4. Final v5 view set: Gallery/Charts or Calendar/Table?
5. Should Slack tokens ever be persisted in SQLite, or strictly Keychain-only with short-lived in-memory access tokens?

---

## Question 1: Edges as Cards vs Lightweight Relations

**Question:** Do you want to commit to **"edges are cards"** or **"edges are lightweight relations"** for v5?

**Answer:** **Edges are lightweight relations.**

**Rationale:**
- The `via_card_id` pattern already captures "rich" edges — a connection *through* a Note/Event/Resource
- Full LPG edges-as-cards adds schema complexity not needed for v1
- Connection richness comes from what they bridge, not from their own columns

**Concrete Decision:**
```
Cards: nodes (note, task, event, resource, person)
Connections: lightweight joins (source_id, target_id, via_card_id, label, weight)
```

**Canonical Reference:** [Contracts.md §2 Connection Schema](./Modules/Core/Contracts.md#2-connection-schema)

---

## Question 2: Which WorkerBridge Spec is Canonical?

**Question:** Which WorkerBridge spec is canonical: `/Modules/WorkerBridge.md` or `/Modules/Core/WorkerBridge.md`?

**Answer:** **`/Modules/Core/WorkerBridge.md`** is canonical.

**Action Taken:**
- `/Modules/WorkerBridge.md` now redirects to `/Modules/Core/WorkerBridge.md`
- Core/WorkerBridge.md references [Contracts.md §4 WorkerBridge Protocol](./Modules/Core/Contracts.md#4-workerbridge-protocol)

**Rationale:**
- Co-located with `Providers.md` and `Contracts.md`
- Single location for all core infrastructure specs

---

## Question 3: SelectionProvider Persistence

**Question:** Is `SelectionProvider` intended to persist across app restarts, or only within-session?

**Answer:** **Within-session only (Tier 3 ephemeral).**

**Rationale:**
- Selection is transient UI state, not meaningful across sessions
- User expects a clean slate on app launch
- Reduces state restoration complexity

**Concrete Decision:**
| Provider | Tier | Persists |
|----------|------|----------|
| FilterProvider | 1 | ✅ Yes |
| DensityProvider | 1 | ✅ Yes |
| PAFVProvider | 2 | ✅ Yes (per family) |
| **SelectionProvider** | **3** | **❌ No** |

**Canonical Reference:** [Contracts.md §6 State Persistence Tiers](./Modules/Core/Contracts.md#6-state-persistence-tiers)

---

## Question 4: Final v5 View Set

**Question:** Final v5 view set: `Gallery/Charts` or `Calendar/Table`?

**Answer:** **Both.** The full v5 view set is:

| View | Family | v5 Status |
|------|--------|-----------|
| `list` | LATCH | ✅ Core |
| `grid` | LATCH | ✅ Core |
| `gallery` | LATCH | ✅ Pro |
| `kanban` | LATCH | ✅ Pro |
| `calendar` | LATCH | ✅ Pro |
| `timeline` | LATCH | ✅ Pro |
| `table` | LATCH | ✅ Pro |
| `supergrid` | LATCH | ✅ Pro |
| `graph` | GRAPH | ✅ Pro |
| `map` | LATCH | 🔶 Workbench |
| `charts` | LATCH | 🔶 Workbench |

**Canonical Reference:** [Contracts.md §3 View Types](./Modules/Core/Contracts.md#3-view-types)

---

## Question 5: Slack Token Storage

**Question:** Should Slack tokens ever be persisted in SQLite, or strictly Keychain-only with short-lived in-memory access tokens?

**Answer:** **Keychain only. Never SQLite.**

**Concrete Decision:**
- Access tokens, refresh tokens, API keys → **Keychain**
- Non-sensitive metadata (team_id, team_name, scope) → SQLite `settings` table is acceptable

**Implementation:**
```typescript
// WebView requests token from native shell via bridge
const { token } = await nativeBridge.requestNativeAction({
  kind: 'getCredential',
  service: 'slack'
});

// Token lives in memory for API calls, never written to SQLite
```

**Canonical Reference:** [Contracts.md §8 Credential Storage](./Modules/Core/Contracts.md#8-credential-storage)

---

## Summary of Decisions

| Question | Decision |
|----------|----------|
| Edges model | Lightweight relations (not cards) |
| Canonical WorkerBridge | `/Modules/Core/WorkerBridge.md` |
| Selection persistence | Tier 3 ephemeral (no persist) |
| View set | 11 views total (see table above) |
| Credential storage | Keychain only, never SQLite |

---

## Files Modified

The following files were updated to align with these decisions:

| File | Changes |
|------|---------|
| `Modules/Core/Contracts.md` | **Created** — Single source of truth |
| `Modules/Core/WorkerBridge.md` | Added Contracts.md reference |
| `Modules/Core/Providers.md` | Added SQL safety allowlist, fixed FTS rowid, fixed persistence tiers |
| `Modules/WorkerBridge.md` | Replaced with redirect to Core/WorkerBridge.md |
| `Modules/SearchExplorer.md` | Fixed FTS schema (name not title, rowid joins) |
| `Modules/SlackETL.md` | Fixed token storage (Keychain not SQLite) |

---

*Document Version: 1.0*
*Created: February 2026*
