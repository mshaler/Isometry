# Keep React Prototype Alongside Native Apps

**Date:** 2025-01-16 (V4 dual implementation)
**Status:** Accepted
**Deciders:** Michael, Claude

## Context

With native iOS/macOS apps decided as production target, the question arose: should we keep the React prototype or sunset it?

React prototype advantages: Fast iteration, visual component testing, D3 experimentation.
Native advantages: Production quality, CloudKit sync, platform integration.

Maintain both or go native-only?

## Decision

We will **maintain both implementations in parallel** during V4 development. React prototype is for rapid UI iteration; native apps are for production deployment.

## Options Considered

### Option 1: Native-only (sunset React)

**Pros:**
- No code duplication
- Team focuses on one platform
- Simpler mental model
- Faster to production

**Cons:**
- **Xcode build cycles** - 10-30 second builds vs instant web refresh
- **No visual testing** - Harder to experiment with D3 visualizations
- **Preview limitations** - SwiftUI previews don't support D3.js
- **Design iteration** - Slower feedback loop with designers
- **Learning curve** - Team must be proficient in Swift before experimenting

### Option 2: React-only (defer native)

**Pros:**
- Fast iteration stays primary workflow
- D3 experimentation easy
- Web deployment simple
- Team already knows React/TypeScript

**Cons:**
- No CloudKit sync
- No offline-first on mobile
- Web performance ceiling
- Missing platform integration
- Not the production target (wasted effort)

### Option 3: Dual implementation (CHOSEN)

**Pros:**
- **Fast UI iteration** - React for experimentation, Xcode for production
- **D3 playground** - Test visualizations in browser before porting to Swift
- **Design validation** - Show designers live React prototypes
- **Parallel work** - Frontend team works in React, native team works in Swift
- **Shared architecture** - PAFV/LATCH/GRAPH model same in both
- **Documentation** - React prototype serves as living spec for native implementation
- **Fallback** - If native hits roadblocks, React prototype can ship as PWA

**Cons:**
- Code duplication (TypeScript + Swift)
- Two test suites
- Risk of divergence (features in one but not the other)
- Maintenance burden (keep both updated)

## Rationale

**Key insight: React prototype is a development tool, not a product.**

Use cases for React prototype:
1. **UI experimentation** - Try new view types, layout algorithms
2. **D3 testing** - Prototype force simulations, chart types
3. **State management** - Test FilterContext, PAFVContext patterns
4. **Design handoff** - Show Figma → React → Native progression
5. **Documentation** - Living example of architecture

Use cases for native apps:
1. **Production deployment** - What users actually use
2. **CloudKit sync** - Real offline-first experience
3. **Platform APIs** - Import from Notes/Reminders
4. **Performance** - 60fps graphs with 10k+ nodes

**Workflow:**
```
1. Design → Figma
2. Prototype → React (fast iteration)
3. Validate → User testing with React prototype
4. Implement → Native Swift (production quality)
5. Ship → App Store
```

React prototype is a **build tool**, like Storybook or Figma. Not the end product.

## Consequences

### Positive

- **Faster iteration** - UI experiments don't require Xcode rebuilds
- **Better testing** - Browser DevTools for D3 debugging
- **Designer collaboration** - Live prototypes instead of screenshots
- **Documentation** - React code serves as reference for native implementation
- **Risk mitigation** - If native hits major blocker, React can ship as fallback
- **Hiring flexibility** - Web developers can contribute to React prototype

### Negative

- **Code duplication** - TypeScript logic must be ported to Swift
- **Feature parity risk** - React might lag behind native (or vice versa)
- **Testing overhead** - Must test both implementations
- **Maintenance cost** - Two codebases to update

### Mitigation

- **Shared spec** - Use Foam docs as single source of truth
- **Feature flags** - Mark experimental features clearly
- **React = prototype** - Make clear React is not production target
- **Port, don't sync** - One-way flow: React → Native (not bidirectional)
- **Archive strategy** - When feature is stable in native, freeze React version

## Related

- [[2025-01-16-native-apps-over-electron]] - Why native is production target
- [[INTEGRATION-CONTRACT]] - React prototype architecture
- [[isometry-evolution-timeline]] - V4 dual implementation strategy
