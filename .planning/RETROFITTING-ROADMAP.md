# GSD Retrofitting Roadmap: v2.3-v2.6

**Created:** 2026-01-25
**Objective:** Integrate 60+ Swift files (60% of implementation) into GSD methodology
**Strategy:** Option A - Massive Retrofitting
**Timeline:** 2-3 months of planning + verification phases (Swift-only scope)
**Optimization:** Focus only on production Swift implementation (100 files vs 19,733 total files)

## Retrofitting Strategy Overview

### The Challenge (Optimized)
**GSD Architectural Evolution Success:** React/Python served as prototyping scaffolding → Swift is production target

60% of Isometry's **production** implementation exists outside GSD methodology:
- **100 total Swift files** in production codebase (98 + 2 recent additions)
- **60+ files** without requirements traceability
- **5+ major systems** without verification plans
- **Complete phases** implemented but not tracked in GSD

**Scope Optimization:** 19,633 prototyping files → 100 production files (99.5% reduction!)

### Retrofitting Approach (Native-Only)
1. **Extract requirements** from Swift implementations only (production target)
2. **Create new milestones** v2.3-v2.6 for missing Swift functionality
3. **Plan verification phases** for Swift implementations only
4. **Execute verification** to ensure production readiness
5. **Update all GSD artifacts** to reflect Swift-only production focus

### Excluded from Retrofitting (GSD Evolution Success)
- **React/TypeScript (19,610 files):** Prototyping scaffolding → Superseded by Swift ✅
- **Python Scripts (23 files):** Development tooling → Essential functionality migrated ✅
- **Scope Reduction:** 99.5% of files excluded due to architectural evolution ✅

## Milestone Structure for Retrofitting

### 🔄 v2.2 Database Versioning & ETL Operations (Current Focus)
**Status:** Requirements extracted, milestone creation in progress
**Files:** 13 Swift files
**Timeline:** 1 week (requirements ✅, milestone planning in progress)

**Phases:**
- Phase 8.1: Requirements & Foundation Verification
- Phase 8.2: Core Versioning System Verification
- Phase 8.3: ETL Integration Testing
- Phase 8.4: UI & Performance Validation

### 🏗️ v2.3 Production Readiness Infrastructure (Next)
**Status:** Not started
**Files:** 14 Swift files
**Timeline:** 2 weeks (requirements + planning + verification)

**Major Systems:**
- Production verification infrastructure (10 files)
- Beta testing framework (4 files)

**Proposed Phases:**
- Phase 9.1: App Store Compliance Foundation
- Phase 9.2: Performance Verification Systems
- Phase 9.3: Beta Testing Framework
- Phase 9.4: Production Deployment Validation

**Key Requirements to Extract:**
- App Store compliance verification
- Performance validation frameworks
- CloudKit production verification
- Beta feedback collection systems

### 🔍 v2.4 Advanced Analytics & Intelligence (Future)
**Status:** Not started
**Files:** 6 Swift files
**Timeline:** 1.5 weeks (requirements + planning + verification)

**Major Systems:**
- Graph analytics engine (2 files)
- Advanced import systems (4 files)

**Proposed Phases:**
- Phase 10.1: Graph Analytics Foundation
- Phase 10.2: Connection Suggestion Engine
- Phase 10.3: Advanced Import Capabilities
- Phase 10.4: Analytics Integration Verification

**Key Requirements to Extract:**
- Connection suggestion algorithms
- Query optimization and caching
- Office document processing
- Direct Apple app synchronization
- SQLite file import workflows

### 🎯 v2.5 Complete Native Integration Verification (Future)
**Status:** Not started
**Files:** 25+ Swift files (Phases 6.2-6.4 implementations - production-ready)
**Timeline:** 2 weeks (verification-focused since implementation exists)

**Major Systems:**
- Complete notebook interface (13 files)
- Shell integration (5 files)
- Native visualization (8 files)

**Proposed Phases:**
- Phase 11.1: Notebook Interface Verification
- Phase 11.2: Shell Integration Security Audit
- Phase 11.3: SuperGrid Visualization Performance
- Phase 11.4: Platform Integration Compliance

**Key Requirements to Extract:**
- Native markdown editing workflows
- Property management interfaces
- Template system architectures
- Slash command implementations
- Sandbox security frameworks
- SuperGrid visualization performance
- Platform-specific optimizations

### 🌉 v2.6 WebView Bridge & Integration Completion (Future)
**Status:** Not started
**Files:** 5 Swift files (Phase 7.2 + related)
**Timeline:** 1 week (verification-focused since implementation exists)

**Major Systems:**
- WebView bridge implementation (3 files)
- Sync and conflict resolution (2 files)

**Proposed Phases:**
- Phase 12.1: WebView Bridge Security Verification
- Phase 12.2: Message Handler Compliance Audit
- Phase 12.3: Real-time Sync Performance Testing
- Phase 12.4: End-to-End Integration Validation

**Key Requirements to Extract:**
- WKWebView container security
- MessageHandler bridge protocols
- File system abstraction compliance
- Real-time synchronization workflows
- Conflict resolution strategies

## Timeline Summary

| Milestone | Duration | Type | Status |
|-----------|----------|------|--------|
| **v2.2** | 1 week | DB Versioning | 🔄 In Progress |
| **v2.3** | 2 weeks | Production Systems | 📋 Planned |
| **v2.4** | 1.5 weeks | Analytics | 📋 Planned |
| **v2.5** | 2 weeks | Native Verification | 📋 Planned |
| **v2.6** | 1 week | WebView Integration | 📋 Planned |
| **Total** | **7.5 weeks** | **Retrofitting** | **2-3 months** |

## Requirements Extraction Priority

### Immediate (Week 1-2)
1. **Database Versioning** (13 files) - Already extracted ✅
2. **Production Verification** (10 files) - High business impact
3. **Beta Testing** (4 files) - Required for App Store deployment

### Medium Priority (Week 3-4)
4. **Graph Analytics** (2 files) - Performance critical
5. **Advanced Import** (4 files) - User workflow enhancement
6. **WebView Bridge** (3 files) - Architecture completion

### Lower Priority (Week 5-7)
7. **Native Interface Verification** (13 files) - Implementation complete
8. **Shell Security Audit** (5 files) - Security review
9. **SuperGrid Performance** (8 files) - Optimization verification

## Success Criteria

### Phase-Level Success
- [ ] All files have requirements traceability (REQ-IDs)
- [ ] Every implementation has verification plans
- [ ] No functionality exists without GSD tracking
- [ ] All phases have SUMMARY.md completion documentation

### Milestone-Level Success
- [ ] Requirements coverage: 100% of Swift files
- [ ] Verification plans: All major systems tested
- [ ] Integration testing: Cross-system compatibility verified
- [ ] Documentation: Complete API and user guides

### Project-Level Success
- [ ] GSD methodology governs 100% of codebase
- [ ] Requirement traceability from business needs to code
- [ ] Automated verification pipelines for all systems
- [ ] Production deployment confidence: 100%

## Risk Mitigation

### High Risk: Timeline Overrun
**Risk:** 2-3 month timeline proves insufficient for 60+ files
**Mitigation:** Prioritize by business impact, implement parallel workstreams

### Medium Risk: Requirements Extraction Complexity
**Risk:** Existing code lacks clear architectural boundaries
**Mitigation:** Focus on observable behavior over internal structure

### Low Risk: Verification Plan Conflicts
**Risk:** Testing one system breaks another
**Mitigation:** Incremental verification with rollback procedures

## Execution Approach

### Week 1: Foundation (Current)
- ✅ Gap analysis complete
- ✅ STATE.md updated
- ✅ Database versioning requirements extracted
- 🔄 v2.2 milestone creation
- 📋 Production verification requirements extraction

### Week 2-3: Production Systems
- Extract requirements for 14 production files
- Create v2.3 Production Readiness milestone
- Plan 4 verification phases
- Begin Phase 9.1 execution

### Week 4-5: Analytics & Integration
- Extract requirements for 6 analytics files
- Create v2.4 Advanced Analytics milestone
- Extract requirements for 3 WebView files
- Create v2.6 WebView Integration milestone

### Week 6-7: Native Verification
- Create v2.5 Native Integration milestone
- Plan verification phases for 25+ native files
- Execute verification phases in parallel
- Complete all retrofitting documentation

## Next Immediate Actions

1. **Complete v2.2 Database Versioning** (this week)
   - Create milestone structure
   - Plan 4 verification phases
   - Begin Phase 8.1 execution

2. **Start v2.3 Production Readiness** (next week)
   - Extract requirements from 14 production files
   - Focus on App Store compliance and performance verification
   - Plan beta testing framework integration

3. **Parallel Planning** (concurrent)
   - Begin requirements extraction for remaining categories
   - Estimate detailed timelines for each phase
   - Prepare verification infrastructure and tooling

The retrofitting approach prioritizes business-critical systems first while ensuring comprehensive coverage of all implementations. This maintains production stability while bringing the entire codebase under GSD governance.