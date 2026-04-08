# Phase 135: UAT - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 135-uat
**Areas discussed:** Test matrix scope, Pass/fail criteria, Preset round-trip verification, Fix iteration boundary

---

## Test Matrix Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Default view only | Import each type, verify auto-switched view and axis config | |
| Default + recommended views | Also check each view with ✦ badge for that dataset type | ✓ |
| All 9 views per type | Full 180-combo matrix | |

**User's choice:** Default + recommended views, expand to full matrix only if needed
**Notes:** User has real sample data for all 20 dataset types. Alto-index preferred as proxy/test dataset (disposable/reloadable). No synthetic fixtures needed.

---

## Pass/Fail Criteria

| Option | Description | Selected |
|--------|-------------|----------|
| Strict | Suboptimal defaults are a fail — fix the registry | |
| Functional | Renders with real data, no errors, no wrong auto-switches | ✓ |
| You decide | Claude uses judgment per dataset type | |

**User's choice:** Functional — initially leaned strict but chose pragmatic
**Notes:** User acknowledged functional is the more pragmatic choice while still achieving a clean milestone

### Fix workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Inline fixes | Find issue, fix immediately, move on | ✓ (default) |
| Log-then-fix | Document all findings, then batch fix | ✓ (>10 findings) |
| You decide | Claude adapts | ✓ (recommended) |

**User's choice:** Inline by default, switch to batch at ~10 findings, or per Claude's recommendation
**Notes:** User explicitly said "or even better, your recommendations" — Claude has latitude to adapt

---

## Preset Round-Trip Verification

| Option | Description | Selected |
|--------|-------------|----------|
| Visual only | Eyeball panel states match | |
| Visual + ui_state snapshot | Programmatic diff of ui_state keys | |
| You decide | Claude picks verification method | ✓ |

**User's choice:** You decide (both questions)

### Starting state

| Option | Description | Selected |
|--------|-------------|----------|
| App default | Fresh load, no customization | |
| Customized | Manually modify panels first | |
| Both | Test from default and customized states | ✓ |

**User's choice:** Both / you decide

---

## Fix Iteration Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Zero defects | Full clean pass with no issues | ✓ |
| Zero P0/P1, P2s logged | Critical fixed, cosmetic tracked | |
| You decide | Claude judges severity | |

**User's choice:** Zero defects (on functional criteria — cosmetic nits logged but don't block)
**Notes:** Claude recommended "zero functional defects" as achievable given the functional pass/fail bar. User agreed. Cosmetic nits documented but not milestone-blocking.

### Iteration cap

| Option | Description | Selected |
|--------|-------------|----------|
| No cap | Keep going until clean | ✓ |
| Time-boxed | 2 full passes max | |
| You decide | | |

**User's choice:** No cap — feature importance justifies thoroughness

---

## Claude's Discretion

- Verification method for preset round-trip (visual, programmatic, or both)
- Starting state customization details for preset test
- Dataset type ordering in test pass
- Exact threshold for inline→batch mode switch
- Whether to expand to full 180-combo matrix

## Deferred Ideas

None — discussion stayed within phase scope
