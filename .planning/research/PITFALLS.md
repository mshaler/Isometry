# Domain Pitfalls: SuperGrid Implementation

**Domain:** Polymorphic data visualization (SuperGrid foundation)
**Researched:** 2026-02-05
**Context:** Adding SuperGrid features to proven sql.js + D3.js foundation

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: D3 Data Binding Without Key Functions
**What goes wrong:** Manual enter/update/exit patterns without proper key functions cause DOM thrashing and data inconsistency. Elements get created/destroyed unnecessarily, losing state and causing performance degradation.
**Why it happens:** Developers skip the key function parameter in `.data()` calls, defaulting to array index binding
**Consequences:**
- 50% slower rendering on data updates
- Lost selection states during re-renders
- Visual flicker and incorrect animations
- Memory leaks from orphaned event listeners
**Prevention:**
- ALWAYS use `.data(cards, d => d.id)` pattern
- ALWAYS use `.join()` over manual enter/update/exit
- Validate key functions return unique, stable identifiers
**Detection:** Watch for DOM element count mismatches after data updates; monitor for visual flicker during transitions

### Pitfall 2: WASM Memory Overflow with Large sql.js Databases
**What goes wrong:** WebAssembly.instantiate() out of memory errors when loading databases >100MB or during frequent reinitializations. Browser crashes or fails to load.
**Why it happens:**
- sql.js loads entire database into WASM memory space (4GB limit)
- Multiple WASM instances created without proper cleanup
- Page reloads accumulate memory without proper disposal
**Consequences:**
- Application won't start with production data
- Memory leaks causing progressive slowdown
- Safari particularly susceptible to WASM range errors
**Prevention:**
- Implement proper DatabaseService disposal in useEffect cleanup
- Monitor database file size; implement data archiving at 50MB
- Use single DatabaseService instance across app lifecycle
- Add memory monitoring to detect leaks early
**Detection:**
- Monitor WASM heap usage in browser dev tools
- Test with 100MB+ database files
- Check for increasing memory usage on page reloads

### Pitfall 3: SQL Performance Regression from Missing Indexes
**What goes wrong:** SuperGrid dynamic axis queries bypass existing indexes, causing 10x+ slower queries as data grows. What works with 1K records fails with 100K.
**Why it happens:**
- PAFV axis mappings generate dynamic WHERE clauses
- Indexes built for static queries don't match dynamic patterns
- FTS5 fallback to LIKE queries scales poorly
**Consequences:**
- Grid becomes unusable with real-world datasets
- Users abandon app due to perceived "hanging"
- CPU usage spikes block UI interactions
**Prevention:**
- Create composite indexes for common LATCH combinations
- Profile queries with EXPLAIN QUERY PLAN
- Set maximum query time limits (500ms) with user feedback
- Implement query result pagination for large datasets
**Detection:** Monitor query execution times; alert if >100ms for typical operations

## Moderate Pitfalls

Mistakes that cause delays or technical debt.

### Pitfall 4: React-D3 Lifecycle Conflicts
**What goes wrong:** React re-renders conflict with D3 DOM manipulation, causing "double updates" where React overwrites D3 changes or D3 modifies React-controlled elements.
**Prevention:**
- Use refs to create D3-only DOM zones
- Never let React and D3 manage same DOM elements
- Trigger D3 updates via useEffect, not render cycles
- Use React for chrome/controls, D3 for data visualization only

### Pitfall 5: SuperGrid Cell Content Overflow
**What goes wrong:** Nested headers and multi-card cells break layout when content exceeds calculated cell dimensions. Text truncation and visual clipping.
**Prevention:**
- Implement text measurement before rendering
- Add ellipsis handling for long content
- Design responsive cell sizing with minimum dimensions
- Test with worst-case content (long names, many categories)

### Pitfall 6: PAFV State Synchronization Drift
**What goes wrong:** Axis assignments become inconsistent between FilterNav controls and actual grid rendering, causing "phantom" columns or incorrect data display.
**Prevention:**
- Single source of truth for PAFV state in React context
- Validate axis assignments before triggering re-renders
- Add development-mode state consistency checks
- Implement axis assignment snapshots for debugging

### Pitfall 7: Z-Axis Header Spanning Performance
**What goes wrong:** CSS-based header spanning calculations become expensive with deep hierarchies (4+ axis levels), causing layout thrashing.
**Prevention:**
- Limit maximum axis depth to 3 levels initially
- Pre-calculate spanning dimensions, cache results
- Use CSS transforms over layout-triggering properties
- Measure spanning calculation performance, optimize hot paths

## Minor Pitfalls

Mistakes that cause annoyance but are fixable.

### Pitfall 8: Hardcoded Grid Dimensions
**What goes wrong:** Fixed cardWidth/cardHeight constants don't adapt to different screen sizes or content density preferences.
**Prevention:**
- Calculate dimensions based on container size
- Implement density scaling (SuperDensity feature)
- Add responsive breakpoints for mobile vs desktop

### Pitfall 9: Missing Transition States
**What goes wrong:** Abrupt changes during view transitions (grid → kanban) feel jarring without intermediate states.
**Prevention:**
- Add loading states during SQL query execution
- Implement transition animations between view modes
- Show skeleton UI while calculating new layouts

### Pitfall 10: Inconsistent Event Handling
**What goes wrong:** Click/hover behaviors differ between header elements, cells, and cards, confusing users.
**Prevention:**
- Establish consistent interaction patterns early
- Document event handling conventions
- Test interaction flows across all grid elements

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| PAFV Header Implementation | Z-axis spanning performance (#7) | Limit initial depth, profile calculations |
| Dynamic Axis Assignment | State synchronization drift (#6) | Implement validation layer |
| Grid Layout Foundation | Data binding without keys (#1) | Code review mandatory for D3 patterns |
| Database Integration | WASM memory overflow (#2) | Memory monitoring and cleanup testing |
| Filter Integration | SQL performance regression (#3) | Query profiling with real datasets |
| React Integration | Lifecycle conflicts (#4) | Clear DOM ownership boundaries |

## Lessons Learned from IsometryKB

**Historical Context:** CardBoard v1-v3 iterations reveal specific failure patterns:

1. **"Two SuperGrid implementations"** - DOM-based vs D3-based versions diverged without clear canonical source. Prevention: Single implementation with clear ownership.

2. **"We made improvements, but broke what was working before"** - Architectural changes introduced regressions in working features. Prevention: Comprehensive regression testing before major changes.

3. **"Hard to get the backend wired up"** - Bridge complexity led to multiple abandoned approaches. Prevention: Bridge elimination architecture already addresses this.

4. **"RenderEngine not connected to SuperGrid"** - Abstraction layers created integration gaps. Prevention: Direct D3.js approach eliminates middleware complexity.

5. **"Test status contradictions"** - Optimistic test reporting masked real failures. Prevention: Strict test criteria, manual verification of integration tests.

## Integration-Specific Warnings

**Adding SuperGrid to Existing Foundation:**

- **DON'T** modify existing DatabaseService APIs for SuperGrid features - extend through composition
- **DON'T** create new React contexts for SuperGrid state - use existing PAFV/Filter contexts
- **DON'T** introduce new D3 rendering patterns - follow established SuperGrid.ts conventions
- **DO** validate existing sql.js queries still work after SuperGrid additions
- **DO** maintain backward compatibility with current D3 visualization code
- **DO** test memory usage before/after SuperGrid integration

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip key functions in D3 data binding | Faster initial implementation | Performance degradation, state loss | Never - always use key functions |
| Hardcode grid dimensions | Simple initial layout | Poor responsive behavior | Prototype only |
| Manual enter/update/exit over .join() | More explicit control | Harder to maintain, error-prone | Never - .join() is canonical |
| Store full database in WASM memory | Fast queries | Memory overflow with real data | Development only |
| Skip EXPLAIN QUERY PLAN profiling | Faster development | Slow queries at scale | Early prototyping only |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| React-D3 Integration | Letting React manage D3-controlled DOM | Use refs to create D3-only zones |
| PAFV State Management | Creating new context for SuperGrid | Extend existing FilterContext/PAFVContext |
| Database Queries | Using separate DB instances | Single DatabaseService instance with proper cleanup |
| Event Handling | Inconsistent interaction patterns | Establish common event handling conventions |
| Memory Management | Creating new WASM instances | Reuse single sql.js database instance |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Missing key functions in D3 data binding | Visual flicker, slow updates | Always use `d => d.id` key functions | >100 DOM elements |
| WASM memory accumulation | Progressive slowdown | Proper database disposal, memory monitoring | >50MB database size |
| Synchronous SQL queries on main thread | UI freezing | Move queries to web workers (future consideration) | >10K records |
| Missing indexes for dynamic queries | Slow grid updates | Create composite indexes for LATCH combinations | >5K records |
| Header spanning calculations | Layout thrashing | Cache spanning dimensions, use CSS transforms | >3 axis levels |

## Security Considerations

| Consideration | Risk | Prevention |
|---------------|------|------------|
| SQL injection in dynamic queries | Data corruption | Use parameterized queries only |
| Memory dumps containing data | Data exposure | Clear sensitive data from memory |
| Client-side data storage | Data persistence | Understand browser storage limitations |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No loading states during slow queries | Users think app is frozen | Progressive loading indicators |
| Abrupt view transitions | Jarring experience | Smooth animated transitions |
| Inconsistent interaction patterns | Confusion about what's clickable | Unified hover/click behaviors |
| No error recovery from failed queries | Dead-end user experience | Graceful error handling with retry options |

## "Looks Done But Isn't" Checklist

- [ ] **D3 Data Binding:** Often missing key functions — verify `d => d.id` pattern used consistently
- [ ] **Memory Management:** Often missing WASM disposal — verify stable memory usage during extended use
- [ ] **Query Performance:** Often missing index optimization — verify sub-100ms query times with real datasets
- [ ] **React Integration:** Often mixing React/D3 DOM control — verify clean separation of responsibilities
- [ ] **Error Handling:** Often missing query failure recovery — verify graceful degradation on database errors
- [ ] **State Consistency:** Often missing PAFV validation — verify axis assignments stay synchronized
- [ ] **Responsive Design:** Often hardcoded dimensions — verify grid adapts to different screen sizes
- [ ] **Transition States:** Often missing loading indicators — verify user feedback during operations

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| D3 data binding without keys | MEDIUM | Refactor data bindings to include key functions, test performance |
| WASM memory overflow | HIGH | Implement database cleanup, add memory monitoring, reduce data size |
| Missing SQL indexes | LOW | Add indexes for common query patterns, re-test performance |
| React-D3 DOM conflicts | MEDIUM | Refactor to separate React/D3 DOM ownership, test edge cases |
| PAFV state drift | MEDIUM | Add state validation, implement consistency checks |

## Sources

**HIGH Confidence:**
- IsometryKB integration gaps analysis (/Users/mshaler/Developer/Projects/IsometryKB/notes/apple-notes/CardBoard/⚠️ Integration Gaps-.md)
- Existing SuperGrid.ts implementation (/Users/mshaler/Developer/Projects/Isometry/src/d3/SuperGrid.ts)
- DatabaseService architecture (/Users/mshaler/Developer/Projects/Isometry/src/db/DatabaseService.ts)
- SuperGrid architecture specification (/Users/mshaler/Developer/Projects/IsometryKB/V1V2_Port/SuperGrid.md)

**MEDIUM Confidence:**
- D3.js performance optimization best practices (Web search: D3.js grid visualization performance anti-patterns, 2025)
- sql.js WASM memory limitations (Web search: sql.js WASM memory issues, GitHub issues, 2025)
- CardBoard historical failure patterns from IsometryKB evolution

**LOW Confidence:**
- Specific performance metrics (extrapolated from general D3.js patterns)
- Phase-specific timing estimates (based on complexity assessment)
- Integration timing with existing codebase (estimated based on current architecture)

---
*Research focus: SuperGrid implementation pitfalls for Isometry v4 foundation*
*Researched: 2026-02-05*