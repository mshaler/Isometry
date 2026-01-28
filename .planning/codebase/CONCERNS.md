---
version: 1.0
last_updated: 2026-01-28
---

# Codebase Concerns

**Analysis Date:** 2026-01-28

## Tech Debt

**Dual runtime bridge (web → native):**
- Issue: Web app relies on a local Swift server bridge for DB access
- Files: `src/server/native-api-server.ts`, `src/db/NativeAPIClient.ts`, `native/Sources/IsometryAPIServer/main.swift`
- Why: Needed to keep React prototype in sync with native SQLite
- Impact: Dev and runtime require Swift toolchain and a running local server
- Fix approach: Stabilize a long-term API boundary or replace with shared service layer

**Legacy SQL.js path removed:**
- Issue: `src/db/init.ts` now throws for legacy SQL.js usage
- Files: `src/db/init.ts`
- Why: Migration to native provider
- Impact: Any leftover call sites will crash at runtime
- Fix approach: Ensure all code uses provider-based access (`DatabaseProvider` / `useDatabase()`)

## Known Bugs

- No confirmed bugs recorded in codebase docs

## Security Considerations

**Client-side Claude API key exposure risk (dev mode):**
- Risk: Direct browser access to Anthropic API uses `dangerouslyAllowBrowser: true`
- Files: `src/hooks/useClaudeAPI.ts`
- Current mitigation: Proxy path in production via `src/config/security.ts`
- Recommendations: Enforce proxy in all non-local builds; avoid shipping raw keys to client

## Performance Bottlenecks

**Native server startup cost:**
- Problem: `startNativeAPIServer` triggers `swift build` when binary missing
- Files: `src/server/native-api-server.ts`
- Cause: Cold build of Swift package
- Improvement path: Cache build artifacts or prebuild binary in dev setup

## Fragile Areas

**Database provider switching:**
- Why fragile: Multiple providers and bridge paths (WebView vs HTTP)
- Files: `src/db/DatabaseContext.tsx`, `src/db/NativeDatabaseContext.tsx`, `src/db/WebViewDatabaseContext.tsx`
- Common failures: Mismatched provider assumptions, missing server
- Safe modification: Update all providers in parallel, test both bridge paths
- Test coverage: Partial (db tests exist, but end-to-end bridge coverage is limited)

## Scaling Limits

**Local-only data architecture:**
- Current capacity: Single-user local SQLite
- Limit: No multi-user or remote sync
- Symptoms at limit: Cannot collaborate or share data across devices
- Scaling path: Introduce remote sync layer or server-hosted DB

## Dependencies at Risk

**Local API bridge on Vapor:**
- Risk: Tight coupling between web client and Swift server contracts
- Impact: UI breaks if API routes or DTOs change
- Migration plan: Version API routes or generate shared contract types

## Missing Critical Features

**Remote sync / multi-device persistence:**
- Problem: Local-only persistence limits usage
- Current workaround: None (local DB only)
- Blocks: Cross-device access and collaboration
- Implementation complexity: High (requires backend + sync)

## Test Coverage Gaps

**Bridge startup + integration flows:**
- What's not tested: Full lifecycle of starting Swift server and calling from web
- Risk: Regressions in dev setup or API availability
- Priority: Medium
- Difficulty to test: Moderate (requires Swift toolchain in CI)

---

*Concerns audit: 2026-01-28*
*Update as issues are fixed or new ones discovered*
