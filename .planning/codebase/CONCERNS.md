# Codebase Concerns

**Analysis Date:** 2026-01-25

## Tech Debt

**Legacy sql.js Migration:**
- Issue: Incomplete migration from sql.js to native database providers
- Files: `src/db/init.ts`, `src/types/sql.js.d.ts` (deleted)
- Impact: Legacy code throws errors if accessed, deprecated warnings in console
- Fix approach: Remove legacy init.ts completely, ensure all components use DatabaseContext

**Extensive TODO Comments:**
- Issue: 50+ TODO comments indicating incomplete implementations
- Files: `src/dsl/parser.ts`, `src/components/notebook/CaptureComponent.tsx`, `src/utils/officeDocumentProcessor.ts`, `native/Sources/Isometry/Models/CommandHistory.swift`
- Impact: Unfinished features, potential user confusion, incomplete functionality
- Fix approach: Create tracking issues for each TODO, prioritize by user impact

**Manual Parser Implementation:**
- Issue: Hand-coded DSL parser instead of generated parser from grammar
- Files: `src/dsl/parser.ts:13`, `src/dsl/parser.ts:26`
- Impact: Error-prone parsing, difficult to extend DSL, maintenance burden
- Fix approach: Implement PEG.js grammar and generate parser

**Office Document Processing Gaps:**
- Issue: Incomplete DOCX export with missing packaging implementation
- Files: `src/utils/officeDocumentProcessor.ts:544`, `src/utils/officeDocumentProcessor.ts:273-274`
- Impact: Non-functional document export feature
- Fix approach: Implement proper DOCX packaging with relationships and content types

## Known Bugs

**Missing Error Notifications:**
- Symptoms: Silent failures in notebook operations
- Files: `src/components/notebook/CaptureComponent.tsx:48`, `src/components/notebook/TemplateManager.tsx:233,245,260`
- Trigger: Any error during capture or template operations
- Workaround: Check browser console for errors

**Sync Queue Not Implemented:**
- Symptoms: Data changes not queued for synchronization
- Files: `src/utils/sync-manager.ts:48`
- Trigger: Any data modification in offline mode
- Workaround: None - feature incomplete

**WebView Bridge Connection Failures:**
- Symptoms: Errors when database operations fail in native app
- Files: `src/db/WebViewClient.ts:35,45,87,107,126,133`
- Trigger: Using React prototype without native app context
- Workaround: Use HTTP API mode instead

## Security Considerations

**No Input Sanitization:**
- Risk: SQL injection through DSL compiler
- Files: `src/dsl/compiler.ts:50,68`
- Current mitigation: Limited to internal use, but accepts any value type
- Recommendations: Add proper parameterized query building, input validation

**Hard-coded Development Paths:**
- Risk: Path disclosure in production builds
- Files: `src/hooks/useCommandRouter.ts:111`
- Current mitigation: Only in development mode
- Recommendations: Use environment variables for all paths

**Extensive DEBUG Sections:**
- Risk: Debug code in production builds, potential information disclosure
- Files: Multiple Swift files with `#if DEBUG` blocks
- Current mitigation: Compile-time conditional compilation
- Recommendations: Audit all DEBUG blocks for sensitive information

**localStorage Usage Without Encryption:**
- Risk: Sensitive filter presets stored in plain text
- Files: `src/utils/filter-presets.ts:10,39,74,90,121`
- Current mitigation: Only stores filter configurations
- Recommendations: Consider encryption for sensitive filter data

## Performance Bottlenecks

**Large File Size Concerns:**
- Problem: Several files over 500+ lines indicating complexity
- Files: `src/utils/migration-validator.ts` (777 lines), `src/utils/sqliteSyncManager.ts` (731 lines), `src/db/migration-safety.ts` (730 lines)
- Cause: Monolithic implementations, extensive validation logic
- Improvement path: Extract smaller, focused modules with single responsibilities

**Heavy Database Migration Logic:**
- Problem: Complex migration validation with performance monitoring
- Files: `src/db/migration-safety.ts`, `src/utils/migration-validator.ts`
- Cause: Comprehensive safety checks and rollback procedures
- Improvement path: Implement lazy validation, background processing

**Native Database File Size:**
- Problem: Single database file approaching 1200 lines
- Files: `native/Sources/Isometry/Database/IsometryDatabase.swift` (1205 lines)
- Cause: All database operations in single actor
- Improvement path: Split into focused repository classes

## Fragile Areas

**DSL Compilation Chain:**
- Files: `src/dsl/parser.ts`, `src/dsl/compiler.ts`, `src/dsl/autocomplete.ts`
- Why fragile: Hand-coded parser, lacks comprehensive error handling
- Safe modification: Always add tests before changes, validate grammar carefully
- Test coverage: Partial - lacks edge case testing

**WebView Bridge Communication:**
- Files: `src/db/WebViewClient.ts`, `src/utils/webview-bridge.ts`, `native/Sources/Isometry/WebView/WebViewBridge.swift`
- Why fragile: Complex message passing between React and Swift, error handling spans multiple layers
- Safe modification: Test in both WebView and standalone modes
- Test coverage: Limited integration testing

**Database Migration System:**
- Files: `src/db/migration-safety.ts`, `src/utils/migration-validator.ts`, `src/db/PerformanceMonitor.ts`
- Why fragile: Complex validation chains, rollback procedures, performance monitoring
- Safe modification: Always test with representative data, validate rollback procedures
- Test coverage: Extensive but mainly unit tests

**D3 Visualization Rendering:**
- Files: `src/components/notebook/D3VisualizationRenderer.tsx` (684 lines), `src/d3/hooks/useD3DataBinding.ts`
- Why fragile: Complex D3 lifecycle management, data binding patterns
- Safe modification: Preserve existing data join patterns, test rendering performance
- Test coverage: Component tests exist but limited integration

## Scaling Limits

**Single Database Actor:**
- Current capacity: All database operations through single Swift actor
- Limit: Potential bottleneck for concurrent operations
- Scaling path: Implement database connection pooling, read replicas

**In-Memory Caching:**
- Current capacity: Limited browser memory for query caches
- Limit: Large datasets may cause memory pressure
- Scaling path: Implement LRU eviction, persistent cache storage

## Dependencies at Risk

**Swift Package Dependencies:**
- Risk: GRDB.swift dependency for native database operations
- Impact: Core database functionality would break
- Migration plan: No viable alternative - maintain compatibility

**D3.js Version Lock:**
- Risk: Using specific D3 version with custom data binding patterns
- Impact: Visualization system heavily coupled to current version
- Migration plan: Gradual migration to newer D3 patterns, maintain compatibility layer

## Missing Critical Features

**Comprehensive Error Reporting:**
- Problem: Silent failures throughout the application
- Blocks: User troubleshooting, error diagnosis
- Priority: High - affects user experience

**Data Synchronization:**
- Problem: Sync queue implementation incomplete
- Blocks: Offline usage, data consistency across devices
- Priority: Medium - workaround exists (online-only usage)

**Node Picker Interface:**
- Problem: Disabled node selection UI in property editor
- Blocks: Relationship creation, data linking
- Priority: Medium - affects advanced features

## Test Coverage Gaps

**DSL Parser Edge Cases:**
- What's not tested: Complex nested queries, malformed input handling
- Files: `src/dsl/parser.ts`, `src/dsl/compiler.ts`
- Risk: Parser crashes on edge cases, incorrect SQL generation
- Priority: High

**WebView Bridge Error Scenarios:**
- What's not tested: Connection failures, message corruption, timeout handling
- Files: `src/db/WebViewClient.ts`, `src/utils/webview-bridge.ts`
- Risk: App crashes when bridge communication fails
- Priority: High

**Migration Rollback Procedures:**
- What's not tested: Actual rollback execution, data integrity after rollback
- Files: `src/db/migration-safety.ts`, `src/utils/migration-validator.ts`
- Risk: Data loss during failed migrations
- Priority: Medium

**D3 Rendering Performance:**
- What's not tested: Large dataset rendering, memory usage patterns
- Files: `src/components/notebook/D3VisualizationRenderer.tsx`
- Risk: Browser crashes with large visualizations
- Priority: Medium

---

*Concerns audit: 2026-01-25*