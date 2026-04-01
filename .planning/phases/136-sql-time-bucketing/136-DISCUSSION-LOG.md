# Phase 136: SQL Time Bucketing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 136-sql-time-bucketing
**Areas discussed:** None (all decisions pre-locked)

---

## Skip Assessment

All user-facing decisions for Phase 136 were already locked in STATE.md under "Key v10.1 architectural constraints":

| Decision | Source |
|----------|--------|
| SQL pattern: `COALESCE(strftime(...), '__NO_DATE__')` | STATE.md |
| Sentinel in SQL, "No Date" in rendering | STATE.md |
| Auto-default: null granularity + time axis → 'month' | STATE.md |
| NULL sorts last via CASE WHEN | STATE.md |
| Time field detection via SchemaProvider | STATE.md + DYNM-10 |
| No UI in this phase | ROADMAP.md `UI hint: no` |

User was presented with the option to discuss anyway or create context directly. User chose "Create context now".

## Claude's Discretion

- Auto-default logic placement (compileAxisExpr vs buildSuperGridQuery vs caller)
- COALESCE wrapping level (STRFTIME_PATTERNS vs compileAxisExpr)
- CalcQuery alignment approach
- Test fixture design

## Deferred Ideas

None.
