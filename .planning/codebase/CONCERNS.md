# Codebase Concerns

**Analysis Date:** 2026-01-26

## Tech Debt

**DSL Parser Implementation:**
- Issue: Stub parser with simple field:value matching instead of full PEG.js generated parser
- Files: `src/dsl/parser.ts:13`, `src/dsl/parser.ts:26`, `src/dsl/grammar/IsometryDSL.pegjs`
- Impact: DSL queries limited to basic field:value, no complex boolean logic or operators
- Fix approach: Run `npx pegjs src/dsl/grammar/IsometryDSL.pegjs -o src/dsl/grammar/parser.js` and integrate generated parser

**AutoComplete Schema Loading:**
- Issue: Hardcoded schema fields instead of dynamic loading from SQLite
- Files: `src/dsl/autocomplete.ts:9`
- Impact: Schema changes require code updates, autocomplete suggestions may be stale
- Fix approach: Create schema introspection query to populate SCHEMA_FIELDS from database

**Office Document Processing TODOs:**
- Issue: Missing image extraction and style information in Word processing, incomplete DOCX packaging
- Files: `src/utils/officeDocumentProcessor.ts:278-279`, `src/utils/officeDocumentProcessor.ts:549`
- Impact: Document imports lose formatting and embedded images, exports incompatible with Word/LibreOffice
- Fix approach: Implement image extraction via mammoth.js, style parsing, and proper DOCX ZIP packaging

**Sync Queue Processing:**
- Issue: Sync queue declared but not processed
- Files: `src/utils/sync-manager.ts:72`
- Impact: Data changes may not sync properly between providers
- Fix approach: Implement queue processing with retry logic and conflict resolution

**Cache Invalidation System:**
- Issue: Mutations don't invalidate related query cache
- Files: `src/hooks/useOptimizedQueries.ts:418`
- Impact: Stale data shown after mutations until manual refetch
- Fix approach: Implement cache invalidation tags and dependency tracking

**Command Router Hardcoded Paths:**
- Issue: Terminal CWD hardcoded to project directory
- Files: `src/hooks/useCommandRouter.ts:111`
- Impact: Commands don't respect actual working directory context
- Fix approach: Get actual CWD from terminal context or project state

**Focus Component Stubs:**
- Issue: Notebook focus capture component has placeholder implementation
- Files: `src/components/notebook/NotebookLayout.tsx:51`
- Impact: Focus management incomplete in notebook interface
- Fix approach: Implement proper focus tracking and management logic

**Toolbar Menu Stubs:**
- Issue: Submenus not implemented in toolbar component
- Files: `src/components/Toolbar.tsx:20`
- Impact: Limited functionality in main toolbar interface
- Fix approach: Implement submenu logic when needed based on user requirements

**Coordinate System Placeholders:**
- Issue: Bipolar coordinate system implementation deferred
- Files: `src/utils/coordinate-system.ts:14`, `src/utils/coordinate-system.ts:52`, `src/utils/coordinate-system.ts:72`
- Impact: Limited spatial projection options for Phase 2 Wave 1
- Fix approach: Complete bipolar coordinate implementation in Wave 2

## Known Bugs

**Command Router CWD Hardcoding:**
- Symptoms: Terminal commands always use hardcoded project path instead of actual working directory
- Files: `src/hooks/useCommandRouter.ts:111`
- Trigger: Any terminal command execution
- Workaround: Commands work but don't respect actual working directory

**Placeholder Positioning:**
- Symptoms: Slash command positioning uses hardcoded coordinates instead of cursor position
- Files: `src/hooks/useSlashCommands.ts:246`
- Trigger: Slash commands in notebook interface
- Workaround: Commands appear at fixed position instead of cursor location

**Missing Error Notifications:**
- Symptoms: Silent failures in notebook operations without user feedback
- Files: Throughout notebook components and contexts
- Trigger: Any error during capture or template operations
- Workaround: Check browser console for error messages

**WebView Bridge Connection Failures:**
- Symptoms: Errors when database operations fail in native app context
- Files: `src/db/WebViewDatabaseContext.tsx`, `src/utils/webview-bridge.ts`
- Trigger: Using React prototype without native app context
- Workaround: Use HTTP API mode instead of WebView bridge

## Security Considerations

**API Key Exposure:**
- Risk: Claude API key exposed in browser console with warning message
- Files: `src/hooks/useClaudeAPI.ts:190`
- Current mitigation: Warning message logged about exposure
- Recommendations: Move to server-side proxy or secure environment variable handling

**Hard-coded Development Paths:**
- Risk: Path disclosure in production builds through hardcoded CWD
- Files: `src/hooks/useCommandRouter.ts:111`
- Current mitigation: Only affects development environment
- Recommendations: Use environment variables for all paths, remove hardcoding

**localStorage Usage Without Encryption:**
- Risk: Sensitive filter presets and template data stored in plain text
- Files: `src/utils/filter-presets.ts`, `src/contexts/NotebookContext.tsx`
- Current mitigation: Only stores configuration data
- Recommendations: Consider encryption for sensitive filter and template data

**No Input Sanitization:**
- Risk: Potential injection through DSL compilation and user input
- Files: `src/dsl/compiler.ts`, user input components
- Current mitigation: Limited to internal use
- Recommendations: Add proper input validation and parameterized query building

## Performance Bottlenecks

**Large Component Files:**
- Problem: Several components exceed 500+ lines indicating high complexity
- Files: `src/components/demo/D3ComponentsDemo.tsx` (734 lines), `src/components/notebook/D3VisualizationRenderer.tsx` (672 lines), `src/components/notebook/PropertyEditor.tsx` (527 lines), `src/contexts/NotebookContext.tsx` (504 lines)
- Cause: Complex rendering logic and multiple responsibilities in single components
- Improvement path: Split into smaller focused components with clear responsibilities

**Heavy Utility and Test Files:**
- Problem: Utility and test files with 700+ lines indicate complex implementations
- Files: `src/test/data-integrity-validation.test.ts` (793 lines), `src/utils/migration-validator.ts` (780 lines), `src/test/performance-regression.test.ts` (773 lines), `src/db/migration-safety.ts` (703 lines)
- Cause: Comprehensive but monolithic implementations
- Improvement path: Break into focused modules by responsibility and feature area

**D3 Rendering Without Virtualization:**
- Problem: Client-side rendering without optimization for large datasets
- Files: `src/components/notebook/D3VisualizationRenderer.tsx`, D3 hook implementations
- Cause: Full DOM manipulation for all data points
- Improvement path: Implement virtualization and canvas-based rendering for large datasets

**Native Database Single Actor:**
- Problem: All database operations through single Swift actor
- Files: `native/Sources/Isometry/Database/IsometryDatabase.swift`
- Cause: Centralized database access pattern
- Improvement path: Implement database connection pooling and read replicas

## Fragile Areas

**Notebook Context Provider:**
- Files: `src/contexts/NotebookContext.tsx`
- Why fragile: 500+ lines with complex template management, localStorage interaction, cache invalidation
- Safe modification: Test template CRUD operations thoroughly, ensure localStorage persistence
- Test coverage: Missing tests for error scenarios and edge cases

**WebView Bridge Communication:**
- Files: `src/utils/webview-bridge.ts`, `src/db/WebViewDatabaseContext.tsx`
- Why fragile: Retry logic, exponential backoff, message passing between React and Swift
- Safe modification: Test connection failures and timeout scenarios thoroughly
- Test coverage: Missing integration tests with actual WebView context

**DSL Compilation Chain:**
- Files: `src/dsl/parser.ts`, `src/dsl/compiler.ts`, `src/dsl/autocomplete.ts`
- Why fragile: Hand-coded parser with limited error handling, stub implementation
- Safe modification: Always add tests before changes, validate grammar carefully
- Test coverage: Partial coverage, lacks comprehensive edge case testing

**D3 Visualization Rendering:**
- Files: `src/components/notebook/D3VisualizationRenderer.tsx`, `src/d3/hooks/useD3DataBinding.ts`
- Why fragile: Complex D3 lifecycle management, data binding patterns, enter/update/exit transitions
- Safe modification: Preserve existing data join patterns, test rendering performance
- Test coverage: Component tests exist but limited integration testing

**Database Migration System:**
- Files: `src/db/migration-safety.ts`, `src/utils/migration-validator.ts`
- Why fragile: Complex validation chains, rollback procedures, performance monitoring
- Safe modification: Always test with representative data, validate rollback procedures
- Test coverage: Extensive unit tests but missing end-to-end migration testing

## Scaling Limits

**Notebook Card Storage:**
- Current capacity: localStorage-based template storage with browser quota limits
- Limit: Typically 5-10MB storage, performance degrades with many templates
- Scaling path: Migrate template storage to database with sync capabilities

**Mock Data Size:**
- Current capacity: Hardcoded sample datasets for testing and demos
- Limit: Cannot test with realistic data volumes or user scenarios
- Scaling path: Generate larger datasets programmatically or use database seed scripts

**In-Memory Caching:**
- Current capacity: Limited browser memory for query caches and component state
- Limit: Large datasets may cause memory pressure and browser crashes
- Scaling path: Implement LRU eviction, persistent cache storage, and memory monitoring

**Single Database Actor:**
- Current capacity: All database operations through single Swift actor
- Limit: Potential bottleneck for concurrent operations in native app
- Scaling path: Implement database connection pooling and read replicas

## Dependencies at Risk

**PEG.js Grammar:**
- Risk: PEG.js grammar defined but not generated into functional parser
- Impact: DSL functionality severely limited to simple field:value matching
- Migration plan: Complete parser generation and integration as critical priority

**sql.js Removal:**
- Risk: Legacy sql.js code still present but deprecated
- Impact: Potential runtime errors if legacy code paths accessed
- Migration plan: Complete removal of sql.js references and ensure all code uses native providers

**D3.js Version Lock:**
- Risk: Using specific D3 version with custom data binding patterns
- Impact: Visualization system heavily coupled to current version and patterns
- Migration plan: Gradual migration to newer D3 patterns while maintaining compatibility

## Missing Critical Features

**Error Boundary Implementation:**
- Problem: No React error boundaries for graceful crash recovery
- Blocks: Cannot handle component crashes gracefully, poor user experience
- Priority: High - affects application stability and user experience

**Comprehensive Error Reporting:**
- Problem: Silent failures throughout application with limited user feedback
- Blocks: User troubleshooting, error diagnosis, debugging production issues
- Priority: High - affects user experience and maintainability

**Data Synchronization:**
- Problem: Sync queue implementation incomplete, no offline support
- Blocks: Offline usage, data consistency across devices
- Priority: Medium - workaround exists (online-only usage)

**Performance Monitoring:**
- Problem: Limited performance tracking in production environment
- Blocks: Cannot identify performance regressions or optimization opportunities
- Priority: Medium - affects debugging and optimization efforts

**Focus Management:**
- Problem: Incomplete focus capture and management in notebook interface
- Blocks: Keyboard navigation, accessibility features
- Priority: Medium - affects accessibility and user experience

## Test Coverage Gaps

**DSL Parser Edge Cases:**
- What's not tested: Complex boolean expressions, operator precedence, error recovery, malformed input
- Files: `src/dsl/parser.ts`, `src/dsl/compiler.ts`
- Risk: Query parsing failures in production, incorrect SQL generation
- Priority: High

**Office Document Processing:**
- What's not tested: Large file handling, malformed documents, memory usage, image extraction
- Files: `src/utils/officeDocumentProcessor.ts`
- Risk: Import failures or memory issues with real-world documents
- Priority: Medium

**Notebook Integration Tests:**
- What's not tested: Template synchronization, cache invalidation, offline scenarios, error recovery
- Files: `src/contexts/NotebookContext.tsx`, `src/hooks/useNotebookPerformance.ts`
- Risk: Data loss or corruption in notebook functionality
- Priority: High

**WebView Bridge Reliability:**
- What's not tested: Connection failure recovery, message ordering, timeout handling, native context
- Files: `src/utils/webview-bridge.ts`, `src/db/WebViewDatabaseContext.tsx`
- Risk: Native app integration failures and crashes
- Priority: High

**Migration Safety Validation:**
- What's not tested: Real database migration scenarios, rollback procedures, data integrity validation
- Files: `src/db/migration-safety.ts`, `src/utils/migration-validator.ts`
- Risk: Data loss during database migrations
- Priority: Critical

**D3 Rendering Performance:**
- What's not tested: Large dataset rendering, memory usage patterns, enter/update/exit transitions
- Files: `src/components/notebook/D3VisualizationRenderer.tsx`, `src/d3/hooks/useD3DataBinding.ts`
- Risk: Browser crashes with large visualizations, poor performance
- Priority: Medium

**Command Router Integration:**
- What's not tested: Terminal context switching, command execution in different environments
- Files: `src/hooks/useCommandRouter.ts`, `src/hooks/useSlashCommands.ts`
- Risk: Command failures in different execution contexts
- Priority: Medium

---

*Concerns audit: 2026-01-26*