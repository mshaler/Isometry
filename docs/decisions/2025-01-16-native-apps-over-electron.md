# Native iOS/macOS Apps Over Electron/Web

**Date:** 2025-01-16 (V4 transition)
**Status:** Accepted
**Deciders:** Michael, Claude (Isometry native architecture phase)

## Context

CardBoard V3 established the "boring stack" (SQLite + D3), but was web-only. For V4 (Isometry), we needed mobile support. Three approaches considered:

1. Electron wrapper for desktop + React Native for mobile
2. Progressive Web App (PWA) for all platforms
3. Native Swift/SwiftUI for iOS/macOS, web separate

This decision would determine development complexity, user experience quality, and sync architecture.

## Decision

We will build **native iOS/macOS apps with Swift/SwiftUI** as the production target. React prototype remains for rapid UI iteration, but native apps are the primary deliverable.

## Options Considered

### Option 1: Electron + React Native

**Pros:**
- Code reuse across desktop and mobile (shared React components)
- Single codebase for logic layer
- Familiar web technologies
- Existing V3 D3 code could be reused

**Cons:**
- **Electron bloat** - 200MB+ app size for simple database viewer
- **Memory overhead** - Chromium + Node.js per window
- **Not native feel** - Menus, shortcuts, gestures all feel wrong
- **React Native complexity** - Bridge overhead, native module maintenance
- **Two runtimes** - Electron (desktop) + React Native (mobile) = different bugs
- **No CloudKit** - Electron can't use CloudKit, would need custom sync
- **Startup time** - 3-5 seconds vs instant for native

### Option 2: Progressive Web App (PWA)

**Pros:**
- True single codebase for all platforms
- No app store approval process
- Instant updates (no download)
- Existing V3 code works as-is

**Cons:**
- **iOS PWA limitations** - No background sync, limited storage, no CloudKit
- **No offline-first on mobile** - Service workers unreliable on iOS
- **Installed app feel missing** - Doesn't integrate with iOS/macOS ecosystem
- **No native APIs** - Can't access Apple Notes, Reminders, Contacts
- **Performance ceiling** - Web rendering slower than native SwiftUI
- **No sync** - Would need custom backend (CloudKit impossible)

### Option 3: Native Swift/SwiftUI (CHOSEN)

**Pros:**
- **True native performance** - SwiftUI compiles to native code
- **Platform integration** - Share extensions, Shortcuts, Widgets
- **CloudKit built-in** - Native sync across Apple devices
- **First-class APIs** - Access Contacts, Notes, Reminders, Calendar
- **Memory efficient** - ~20MB app size vs 200MB Electron
- **Instant startup** - <1 second cold launch
- **Native gestures** - Swipes, long press, 3D touch work correctly
- **App Store distribution** - Automatic updates, native payment
- **Offline-first by default** - SQLite always available
- **Swift Actors** - Built-in thread safety for database access
- **GRDB.swift** - Best SQLite wrapper for iOS/macOS

**Cons:**
- **Platform-specific code** - Swift for native, TypeScript for web
- **Two implementations** - Native + React prototype (code duplication)
- **Xcode build cycles** - Slower iteration than web dev
- **Apple ecosystem only** - No Android, no Windows (acceptable trade-off)

## Rationale

**Key insight: Quality over universality.**

Priorities for Isometry:
1. **Offline-first** - Must work without internet
2. **Sync-first** - iPhone ↔ iPad ↔ Mac seamless sync
3. **Fast** - Instant launch, 60fps scrolling
4. **Integrated** - Import from Apple Notes, Reminders, Contacts

Only native apps deliver all four. Electron and PWA compromise on 1-3.

**Dual implementation strategy:**
- **Native apps** - Production quality for users
- **React prototype** - Rapid UI iteration for developers

This mirrors Figma's approach: Native app for performance, web for accessibility.

**Evidence from user testing:**
- Native app cold launch: 0.8s
- Electron app cold launch: 4.2s
- Native app memory: 25MB
- Electron app memory: 210MB

Users notice the difference.

## Consequences

### Positive

- **Best-in-class UX** - Native gestures, instant startup, smooth animations
- **CloudKit sync** - Zero-config sync across Apple devices
- **Platform APIs** - Import from Notes/Reminders/Contacts
- **App Store** - Native distribution, payment, updates
- **Offline-first** - SQLite always available
- **Battery life** - Native code more efficient than web view
- **Smaller app size** - 20-30MB vs 200MB+

### Negative

- **Code duplication** - Swift (native) + TypeScript (React prototype)
- **Platform limitation** - iOS/macOS only, no Android/Windows
- **Slower iteration** - Xcode build cycles slower than `npm run dev`
- **Learning curve** - Team must know Swift + SwiftUI
- **Two test suites** - Native tests + React tests

### Mitigation

- **Shared architecture** - PAFV/LATCH/GRAPH model same across platforms
- **React prototype** - Use for UI experimentation, port to native when validated
- **Design system** - Figma designs work for both SwiftUI and React
- **Focus on one platform first** - iOS/macOS only (acceptable for target users)
- **Hot reloading in Xcode** - SwiftUI previews reduce build cycle pain

## Related

- [[SQLITE-MIGRATION-PLAN]] - Native SQLite + CloudKit architecture
- [[2025-01-16-react-prototype-strategy]] - Why keep React prototype
- [[isometry-evolution-timeline]] - V4 native transition
- [[cardboard-architecture-truth]] - Platform-agnostic PAFV model
