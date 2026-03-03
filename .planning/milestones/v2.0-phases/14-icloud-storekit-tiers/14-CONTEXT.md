# Phase 14: iCloud + StoreKit Tiers - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

The database file syncs automatically across devices via iCloud Documents, and the app enforces Free/Pro/Workbench feature tiers via StoreKit 2 subscriptions. Two independent subsystems: (1) iCloud Documents for file-level database sync, (2) StoreKit 2 for subscription management + feature gating.

</domain>

<decisions>
## Implementation Decisions

### Tier Definitions & Feature Gating
- All 9 views (grid, list, kanban, calendar, timeline, network, tree, gallery, supergrid) are Free — no view gating
- Pro tier gates ETL/file import features and future export
- Workbench tier is defined in code (Tier enum, product IDs in .storekit config) but nothing is gated to it in Phase 14 — placeholder for future power features
- iCloud Documents sync is Free for all users — no tier gate on sync
- When a Free user triggers a Pro-gated action (e.g., file import), show a StoreKit upgrade sheet (custom SwiftUI paywall) with purchase options

### Subscription Pricing Structure
- Pro supports Monthly + Yearly billing periods
- Workbench product IDs (monthly + yearly) are defined in the .storekit config file alongside Pro, even though nothing gates to Workbench yet
- Single subscription group: Free → Pro → Workbench upgrade path — Apple handles proration automatically
- 7-day free trial for Pro subscription

### iCloud Sync Experience
- Database file is hidden from iOS Files app — stored in ubiquity container but NOT in the Documents/ subfolder (no NSUbiquitousContainers in Info.plist needed)
- Silent sync — no sync status indicator in the UI, no error banners. Trust iCloud like Notes/Photos.
- Silent fallback to local Application Support storage when iCloud is unavailable (not signed in, disabled, no entitlement). No alert, no prompt.
- Auto-migrate: if a user has an existing local database and then enables iCloud, copy the local database to the ubiquity container automatically on next launch. No user action needed.

### Purchase UI Surface
- Two entry points to purchase: (1) toolbar settings/account button always visible, (2) inline upgrade sheet when hitting a gated feature
- Settings/account view accessible from a toolbar button (gear or person icon) — always visible regardless of sidebar state
- Custom SwiftUI paywall (not Apple's SubscriptionStoreView) — works on iOS 15+ deployment target, full control over branding and messaging
- Include a "Restore Purchases" button on the paywall for App Store review compliance and user confidence

### Claude's Discretion
- Exact paywall visual design (card layout, colors, typography, feature comparison format)
- Settings screen layout and additional content beyond subscription management
- NSFileCoordinator strategy for atomic checkpoint writes (single coordination block vs separate operations)
- Loading/error states in the subscription flow
- Product ID naming convention (research suggests `works.isometry.pro.monthly` pattern — can adjust)

</decisions>

<specifics>
## Specific Ideas

- Upgrade sheet should surface right when the user hits a gate — not make them hunt for a settings screen
- Sync should be invisible — like Apple Notes. If iCloud is on, it just works. If it's off, the app still works locally.
- Auto-migration from local → iCloud should be seamless — user enables iCloud and their data appears on other devices without any manual step
- Restore Purchases button even though StoreKit 2 auto-restores — Apple reviewers sometimes reject without it

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DatabaseManager` (actor): Currently stores in `ApplicationSupport/Isometry/`. Has synchronous `init()` and `init(baseDirectory:)` for tests. Atomic checkpoint write pattern (write .tmp → rotate .db to .bak → rename .tmp to .db). Needs async factory method for iCloud path resolution.
- `BridgeManager` (@MainActor, ObservableObject): Already sends `tier: "free"` stub in `sendLaunchPayload()` — just needs wiring to SubscriptionManager. Has `sendSyncNotification()` stub. Has `native:action` case in `didReceive()` ready for FeatureGate integration.
- `IsometryApp`: Owns `@StateObject BridgeManager` — will also own `SubscriptionManager`. Has scene phase handling and autosave timer.
- `ContentView`: NavigationSplitView with toolbar, file import, view picker. Toolbar is the integration point for settings button.

### Established Patterns
- Actor isolation for database operations (DatabaseManager is an actor)
- @MainActor ObservableObject for bridge state (BridgeManager pattern — SubscriptionManager should follow same pattern)
- Notification-based command dispatch (`.importFile`, `.undoAction`, `.redoAction`)
- WeakScriptMessageHandler proxy for WKWebView retain cycle prevention

### Integration Points
- `DatabaseManager.init()` → needs async factory `makeForProduction()` for iCloud path resolution on background thread
- `BridgeManager.sendLaunchPayload()` → replace hardcoded `"free"` with `subscriptionManager?.currentTier.rawValue`
- `BridgeManager.didReceive()` `native:action` case → add FeatureGate check before dispatching
- `IsometryApp.body` → add `@StateObject SubscriptionManager`, pass to BridgeManager
- `ContentView` toolbar → add settings/account button entry point

</code_context>

<deferred>
## Deferred Ideas

- Workbench-tier gated features — define what power features justify Workbench when the time comes
- NSMetadataQuery for sync progress monitoring — could add sync indicator later if users request it
- CloudKit record-level sync (vs file-level) — explicitly deferred to v2.1+ per STATE.md (SYNC-01/02/03)
- SubscriptionStoreView adoption when deployment target moves to iOS 17+

</deferred>

---

*Phase: 14-icloud-storekit-tiers*
*Context gathered: 2026-03-03*
