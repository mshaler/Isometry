# CloudKit Sync Over Firebase/Supabase

**Date:** 2025-01-19 (CloudKit implementation)
**Status:** Accepted
**Deciders:** Michael, Claude

## Context

Native iOS/macOS apps need cross-device sync (iPhone ↔ iPad ↔ Mac). Three approaches considered:

1. CloudKit (Apple's native sync)
2. Firebase Firestore
3. Supabase (open-source Firebase alternative)

This decision impacts user experience (Apple account vs separate login), deployment complexity, and privacy story.

## Decision

We will use **CloudKit** for all sync operations. No third-party backend needed.

## Options Considered

### Option 1: Firebase Firestore

**Pros:**
- Platform agnostic (could add Android later)
- Mature ecosystem, good documentation
- Real-time sync out of the box
- Offline support built-in
- Web SDK available (React prototype could use same backend)

**Cons:**
- **Requires Google account** - Extra login step for users
- **Monthly costs** - Firestore pricing at scale
- **Privacy concerns** - Data stored on Google servers
- **Lock-in** - Hard to migrate away from Firestore data model
- **Setup complexity** - Firebase project, API keys, security rules
- **Not native** - Swift SDK is wrapper around REST API

### Option 2: Supabase

**Pros:**
- Open source (can self-host)
- PostgreSQL backend (standard SQL)
- Real-time subscriptions
- Good TypeScript support
- Potentially cheaper than Firebase

**Cons:**
- **Requires account** - Extra login (email or OAuth)
- **Backend deployment** - Self-hosting or Supabase cloud
- **Not native** - Swift client is community-maintained
- **Sync complexity** - Must build conflict resolution
- **Privacy trade-off** - Data on third-party servers (unless self-hosted)

### Option 3: CloudKit (CHOSEN)

**Pros:**
- **Zero-config for users** - Automatic login with Apple ID
- **Zero cost** - Free for reasonable usage (1PB transfer/month)
- **Privacy-first** - End-to-end encryption for user data
- **Native iOS/macOS** - First-class Swift support
- **Automatic sync** - CKSyncEngine handles conflict resolution
- **Container isolation** - User data stays in user's iCloud
- **No backend to manage** - Apple hosts everything
- **Offline-first** - Works without internet, syncs when connected
- **Platform integration** - System settings for sync controls

**Cons:**
- **Apple ecosystem only** - No Android, no Windows
- **iCloud dependency** - Requires iCloud account (most iOS users have one)
- **Debugging harder** - CloudKit Console less powerful than Firebase Console
- **Schema changes tricky** - CKRecord schema changes require migration
- **Development container** - Requires Apple Developer account for CloudKit Dashboard

## Rationale

**Key insight: Target users are already in Apple ecosystem.**

User profile for Isometry:
- Uses iPhone, iPad, Mac
- Values privacy
- Expects "it just works" sync (like Notes, Reminders)
- Willing to pay for software, not for server hosting

CloudKit matches this profile perfectly.

**Privacy story:**
- Firebase/Supabase: Data on third-party servers → requires trust
- CloudKit: Data in user's iCloud → user controls their data

**User experience:**
- Firebase/Supabase: Sign up → email verification → log in on each device
- CloudKit: Install app → automatic sync (already logged in with Apple ID)

**Cost story:**
- Firebase: $0.18/GB stored + $0.02/GB network
- Supabase: Self-hosted (DevOps cost) or $25/month cloud
- CloudKit: Free (up to 1PB transfer, more than we'll ever need)

## Consequences

### Positive

- **Zero user friction** - No signup, no login screens
- **Zero backend cost** - No servers to pay for or manage
- **Privacy by default** - E2E encryption for user data
- **Native experience** - Sync toggles in Settings.app
- **Offline-first** - SQLite local, CloudKit syncs when online
- **Development velocity** - No backend to build/deploy/maintain

### Negative

- **Apple ecosystem only** - No Android/Windows support (acceptable for V4)
- **iCloud requirement** - Users without iCloud can't sync (rare on iOS)
- **CloudKit learning curve** - Less familiar than Firebase
- **Debugging challenges** - CloudKit Console less developer-friendly
- **Developer account needed** - $99/year for CloudKit Dashboard access

### Mitigation

- **Documentation** - Comprehensive CloudKit setup guide
- **Local-first architecture** - App works fully offline, sync is bonus
- **CKSyncEngine** - Use Apple's official sync engine (iOS 17+) when possible
- **Manual sync fallback** - iOS 15+ uses manual CloudKit operations
- **Error handling** - Graceful degradation if iCloud unavailable

## Related

- [[SQLITE-MIGRATION-PLAN]] - CloudKit + SQLite architecture
- [[2025-01-16-native-apps-over-electron]] - Why native matters
- [[isometry-evolution-timeline]] - CloudKit implementation commits
