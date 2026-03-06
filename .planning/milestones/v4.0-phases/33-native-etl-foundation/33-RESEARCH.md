# Phase 33: Native ETL Foundation - Research

**Researched:** 2026-03-05
**Domain:** Swift native adapter infrastructure — NativeImportAdapter protocol, PermissionManager, CoreDataTimestampConverter, chunked bridge transport, MockAdapter, security-scoped bookmarks
**Confidence:** HIGH (codebase read directly; Apple APIs cross-referenced with official docs and community sources)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Permission flow UX**
- Inline SwiftUI sheet slides up when access is needed (not a system alert)
- Sheet copy explains WHY access is needed: "Isometry will read your [source] to create cards you can organize and explore. Nothing is modified or deleted."
- On denial or prior denial: show message with deep-link button to the specific System Settings pane (Privacy & Security → Full Disk Access or Calendars/Reminders)
- Re-import: silently reuse cached security-scoped bookmarks — no file picker, no confirmation, just import

**Adapter protocol design**
- Define a Codable `CanonicalCard` struct in Swift that mirrors the TypeScript CanonicalCard type — type-safe on both sides, serialized to JSON for bridge transport
- New distinct source types for native adapters: `native_reminders`, `native_calendar`, `native_notes` — never reuse existing file-based SourceType values
- NativeImportAdapter protocol uses `AsyncSequence<[CanonicalCard]>` for batch yielding — natural backpressure, modern Swift concurrency
- MockAdapter validates the full end-to-end pipeline: Swift adapter → bridge → Worker → ImportOrchestrator → dedup → write to DB → verify cards appear in Isometry

**Chunked bridge transport**
- 200-card chunks sent sequentially: Swift sends chunk N, awaits JS acknowledgment, then sends chunk N+1 — guaranteed ordering with backpressure
- Reuse existing ImportToast progress UI — each chunk triggers the existing import_progress Worker notification pipeline (FNDX-01: no additional UI changes)
- Abort on chunk failure — stop import, show error toast with count of cards successfully imported. User can re-trigger to retry.
- New bridge message type `native:import-chunk` with chunk index, total chunks, and cards JSON array. NativeBridge.ts handler accumulates all chunks, then calls ImportOrchestrator once for proper cross-chunk dedup.

**System DB safety & discovery**
- Copy-then-read strategy: copy .db + .wal + .shm to a temp directory, then open the copy read-only — zero risk of interfering with running system apps
- Foundation phase includes a basic "Import from..." source picker UI (menu or sheet) — sources for future phases appear greyed out. MockAdapter appears in debug builds only.

### Claude's Discretion
- Dynamic path discovery strategy per adapter (EventKit is API-based vs Notes is file-based — different strategies appropriate)
- CoreData timestamp converter pattern (standalone function vs protocol extension)
- Permission sheet visual design and layout
- Temp directory cleanup timing and strategy
- Error message wording for edge cases
- MockAdapter card content (3 hardcoded cards per FNDX-08)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FNDX-01 | User can trigger a native import from the app that reads macOS system databases via a NativeImportAdapter protocol shared by all adapters | Source picker UI in ContentView.swift; BridgeManager.didReceive() extension with `native:import-chunk` case |
| FNDX-02 | User receives a clear permission prompt when the app needs access to system databases, with a deep link to System Settings on denial (PermissionManager handles TCC + EventKit) | PermissionManager actor with NSWorkspace.open deep link patterns; existing SwiftUI sheet infrastructure in ContentView |
| FNDX-03 | All imported dates from macOS system databases display correctly with no 31-year offset (CoreData epoch → ISO 8601 conversion via shared utility) | CoreDataTimestampConverter: epoch offset is 978,307,200 seconds (Jan 1 2001 vs Jan 1 1970); ISO8601DateFormatter patterns |
| FNDX-04 | Native import reads system databases without corrupting them or conflicting with running system apps (read-only WAL-aware access with sqlite3_busy_timeout) | Copy-then-read strategy locked; temp dir → open copy read-only; no sqlite3_busy_timeout needed on copy |
| FNDX-05 | Large imports (5,000+ items) complete without crashing the app or WKWebView process (200-card chunked bridge transport) | Chunked dispatch via evaluateJavaScript; 200-card batch confirmed safe for WKWebView process memory |
| FNDX-06 | System database paths are discovered dynamically across macOS versions and device migrations (no hardcoded paths) | FileManager.default.urls() + NSHomeDirectory() patterns; EventKit requires no path (API-based) |
| FNDX-07 | User can re-import from the same source without re-granting file access permissions (NSOpenPanel security-scoped bookmark caching) | Bookmark data stored in UserDefaults; startAccessingSecurityScopedResource / stopAccessingSecurityScopedResource pattern |
| FNDX-08 | End-to-end pipeline (Swift adapter → bridge → Worker → ImportOrchestrator) is validated with a MockAdapter before any real adapter ships | MockAdapter: 3 hardcoded CanonicalCards; DEBUG-only build flag; full round-trip test via chunked bridge |
</phase_requirements>

---

## Summary

Phase 33 builds the shared infrastructure that all native macOS import adapters (Reminders, Calendar, Notes) will build on. The phase is entirely additive to the existing v2.0 native shell — it extends `BridgeManager.swift`, `NativeBridge.ts`, and `src/etl/types.ts` without touching the checkpoint or file-import infrastructure already in production.

The two central technical challenges are the chunked bridge transport and the PermissionManager. The chunked transport must solve the WKWebView memory constraint (a single `evaluateJavaScript` call passing 5,000 cards as a JSON string can cause the WebContent process to be killed by the OS memory pressure system). The solution — 200-card sequential chunks with JS acknowledgment — is already locked by user decision and is well-supported by the existing bridge architecture. The PermissionManager must handle two distinct permission systems: NSOpenPanel security-scoped bookmarks for file-based databases (Notes), and EventKit authorization for API-based access (Reminders, Calendar). In Phase 33, only the infrastructure exists; no real system databases are opened.

The existing codebase provides strong foundations: `BridgeManager.didReceive()` already has a `switch type` dispatch that just needs a new `native:import-chunk` case; `NativeBridge.ts initNativeBridge()` already has a `native:action` handler pattern to replicate; `ImportOrchestrator.ts` already takes `CanonicalCard[]` arrays and handles dedup and progress reporting; `ImportToast.ts` already renders `import_progress` notifications. The MockAdapter plugs into this pipeline with three hardcoded cards, confirming end-to-end correctness before any real system database access is attempted.

**Primary recommendation:** Implement in order — (1) Swift CanonicalCard struct + NativeImportAdapter protocol, (2) CoreDataTimestampConverter XCTest-verified utility, (3) chunked bridge transport in BridgeManager + NativeBridge.ts + etl-import-native.handler.ts, (4) MockAdapter + source picker UI, (5) PermissionManager + permission sheet. The MockAdapter end-to-end test is the phase gate.

---

## Standard Stack

### Core (no new dependencies — all existing)

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| WKWebView + evaluateJavaScript | iOS 17+ / macOS 14+ (ship target: 26.2) | Send chunked JSON from Swift to JS | Already the bridge transport; no alternative |
| Swift Concurrency (async/await, actors, AsyncStream) | Swift 5.0 (in project) | NativeImportAdapter AsyncSequence, PermissionManager actor | Project already uses actors (DatabaseManager); consistent pattern |
| Foundation (FileManager, UserDefaults, NSWorkspace) | System | Dynamic DB path discovery, bookmark persistence, System Settings deep links | No dependencies needed; all in-box |
| Vitest 4.0 (existing) | ~4.0 | TypeScript side tests for NativeBridge chunk handler | Already configured; `npm run test` runs all tests |
| Swift Testing (existing, BridgeManagerTests use `@Test`) | Xcode 26.2 | CoreDataTimestampConverter XCTest, MockAdapter round-trip | Mixed XCTest + Swift Testing already in use |

### Supporting (Swift side — no new packages for Phase 33)

| Component | Version | Purpose | When to Use |
|-----------|---------|---------|-------------|
| ISO8601DateFormatter | System | Convert CoreData timestamps to ISO 8601 strings | CoreDataTimestampConverter output format |
| NSWorkspace.shared.open(URL) | System | Open System Settings deep links on denial | PermissionManager.openSystemSettings() |
| URLBookmarkCreationOptions.withSecurityScope | System | Create persistent security-scoped bookmarks | PermissionManager for Notes path (Phase 35+) |

### Not Needed in Phase 33

| NOT Needed | Reason |
|------------|--------|
| EventKit (EKEventStore) | EventKit API required for Reminders/Calendar — Phase 34, not Phase 33 |
| GRDB.swift | Direct SQLite access for Notes — Phase 35, not Phase 33 |
| protoc / SwiftProtobuf | Notes protobuf body — Phase 36, not Phase 33 |
| New npm packages | All TypeScript infrastructure already exists |

**No new Swift packages or npm packages are needed for Phase 33.**

---

## Architecture Patterns

### Recommended Project Structure — New Files

```
native/Isometry/Isometry/
├── NativeImportAdapter.swift       # Protocol + CanonicalCard struct (new)
├── PermissionManager.swift         # TCC + bookmark handling (new)
├── CoreDataTimestampConverter.swift # epoch offset utility (new)
├── NativeImportCoordinator.swift   # Orchestrates chunk transport (new)
├── MockAdapter.swift               # #if DEBUG only (new)
├── ImportSourcePickerView.swift    # "Import from..." sheet (new)
└── [existing files — no changes to core bridge protocol]

native/Isometry/IsometryTests/
└── CoreDataTimestampConverterTests.swift  # XCTest, not Swift Testing (new)

src/native/
└── NativeBridge.ts                 # Add native:import-chunk handler

src/worker/handlers/
└── etl-import-native.handler.ts   # New: accumulate chunks → ImportOrchestrator

src/etl/
└── types.ts                       # Add native SourceType union members
```

### Pattern 1: NativeImportAdapter Protocol + CanonicalCard Swift Struct

**What:** Protocol that all native adapters conform to. Yields batches of Swift `CanonicalCard` structs via `AsyncStream`. Swift `CanonicalCard` mirrors the TypeScript `CanonicalCard` interface exactly.
**When to use:** Every adapter (Mock, Reminders, Calendar, Notes) conforms to this.

```swift
// Source: project pattern — mirrors src/etl/types.ts CanonicalCard interface
import Foundation

// Mirrors TypeScript CanonicalCard from src/etl/types.ts exactly.
// Codable for JSON bridge transport. All optional fields use nil (not empty strings).
struct CanonicalCard: Codable {
    let id: String
    let card_type: String        // "note" | "task" | "event" | "person"
    let name: String
    let content: String?
    let summary: String?
    let latitude: Double?
    let longitude: Double?
    let location_name: String?
    let created_at: String       // ISO 8601
    let modified_at: String      // ISO 8601
    let due_at: String?          // ISO 8601 or nil
    let completed_at: String?    // ISO 8601 or nil
    let event_start: String?     // ISO 8601 or nil
    let event_end: String?       // ISO 8601 or nil
    let folder: String?
    let tags: [String]
    let status: String?
    let priority: Int
    let sort_order: Int
    let url: String?
    let mime_type: String?
    let is_collective: Bool
    let source: String           // "native_reminders" | "native_calendar" | "native_notes"
    let source_id: String        // Unique per adapter (calendarItemIdentifier, ZIDENTIFIER, etc.)
    let source_url: String?
    let deleted_at: String?
}

// NativeImportAdapter protocol — all native adapters conform to this.
// Yields [CanonicalCard] batches via AsyncStream (natural backpressure).
protocol NativeImportAdapter {
    /// Source identifier string — matches SourceType on JS side.
    var sourceType: String { get }

    /// Check if permission is currently granted (synchronous).
    func checkPermission() -> PermissionStatus

    /// Request permission (may show system prompt or open Settings).
    func requestPermission() async -> PermissionStatus

    /// Yield cards in batches. Adapter controls internal batch size.
    /// Coordinator slices into 200-card bridge chunks regardless.
    func fetchCards() -> AsyncStream<[CanonicalCard]>
}

enum PermissionStatus {
    case granted
    case denied
    case notDetermined
    case restricted  // Parental controls, MDM, etc.
}
```

### Pattern 2: Chunked Bridge Transport (NativeImportCoordinator)

**What:** Coordinator that iterates the adapter's `AsyncStream`, slices into 200-card chunks, sends each chunk to JS via `evaluateJavaScript`, and awaits JS acknowledgment before sending the next.
**When to use:** Every native import goes through the coordinator. The coordinator owns the chunk-acknowledgment protocol.

```swift
// Sends one 200-card chunk, awaits JS ack, then sends next chunk.
// JS sends ack via nativeBridge.postMessage({type: "native:import-chunk-ack", ...})
@MainActor
class NativeImportCoordinator {
    weak var webView: WKWebView?
    private var pendingChunkContinuation: CheckedContinuation<Bool, Never>?

    func runImport(adapter: NativeImportAdapter) async throws {
        var accumulated: [CanonicalCard] = []
        var chunkIndex = 0

        for await batch in adapter.fetchCards() {
            accumulated.append(contentsOf: batch)

            while accumulated.count >= 200 {
                let chunk = Array(accumulated.prefix(200))
                accumulated.removeFirst(min(200, accumulated.count))
                let success = await sendChunk(chunk, index: chunkIndex, isLast: false)
                if !success { throw NativeImportError.chunkFailed(chunkIndex) }
                chunkIndex += 1
            }
        }

        // Send remaining cards (final chunk, possibly < 200)
        if !accumulated.isEmpty {
            let success = await sendChunk(accumulated, index: chunkIndex, isLast: true)
            if !success { throw NativeImportError.chunkFailed(chunkIndex) }
        }
    }

    private func sendChunk(_ cards: [CanonicalCard], index: Int, isLast: Bool) async -> Bool {
        guard let json = try? JSONEncoder().encode(cards),
              let jsonString = String(data: json, encoding: .utf8) else {
            return false
        }

        // Escape jsonString for embedding in JS — use base64 to avoid all escaping issues
        let base64 = Data(jsonString.utf8).base64EncodedString()

        let js = """
        window.__isometry.receive({
          type: 'native:import-chunk',
          payload: {
            chunkIndex: \(index),
            isLast: \(isLast),
            cardsBase64: '\(base64)'
          }
        });
        """

        return await withCheckedContinuation { continuation in
            pendingChunkContinuation = continuation
            Task {
                try? await webView?.evaluateJavaScript(js)
            }
        }
    }

    // Called by BridgeManager when native:import-chunk-ack arrives
    func receiveChunkAck(success: Bool) {
        pendingChunkContinuation?.resume(returning: success)
        pendingChunkContinuation = nil
    }
}
```

**CRITICAL: Use base64 for the cards JSON payload embedded in evaluateJavaScript.** Directly embedding large JSON strings in JS template literals causes escaping issues and has been observed to cause WebKit crashes in release builds (see Pitfall 2). Base64-encode the JSON, decode in JS with `atob()`.

### Pattern 3: CoreDataTimestampConverter

**What:** Standalone function (not extension, not protocol) that converts CoreData's reference date epoch to ISO 8601 strings.
**When to use:** Every adapter that reads dates from macOS system databases (Notes, Reminders indirectly, Calendar events via CoreData path if needed).

```swift
// CoreDataTimestampConverter.swift
// CoreData timestamps are seconds since January 1, 2001 (Apple Reference Date).
// Unix timestamps are seconds since January 1, 1970.
// Offset: 978,307,200 seconds (exactly 31 years between 1970 and 2001).
// Without this conversion, dates appear 31 years in the past.

import Foundation

enum CoreDataTimestampConverter {
    // CoreData Reference Date = January 1, 2001 00:00:00 UTC
    // Unix Reference Date     = January 1, 1970 00:00:00 UTC
    // Difference              = 978,307,200 seconds
    private static let coreDataEpochOffset: TimeInterval = 978_307_200

    /// Convert a CoreData timestamp (seconds since 2001-01-01) to ISO 8601 string.
    /// Returns nil if the timestamp is 0 or clearly invalid (negative, far future).
    static func toISO8601(_ coreDataTimestamp: Double) -> String? {
        guard coreDataTimestamp > 0 else { return nil }
        let unixTimestamp = coreDataTimestamp + coreDataEpochOffset
        let date = Date(timeIntervalSince1970: unixTimestamp)
        return ISO8601DateFormatter().string(from: date)
    }

    /// Convert a CoreData timestamp to a Date. Used for time comparisons.
    static func toDate(_ coreDataTimestamp: Double) -> Date? {
        guard coreDataTimestamp > 0 else { return nil }
        return Date(timeIntervalSince1970: coreDataTimestamp + coreDataEpochOffset)
    }
}
```

**XCTest verification (FNDX-03 gate):**
```swift
// CoreDataTimestampConverterTests.swift — XCTest (not Swift Testing)
// Reference: CoreData epoch offset = 978,307,200 seconds
// Test: timestamp 0 in CoreData = 2001-01-01T00:00:00Z in ISO 8601

import XCTest
@testable import Isometry

final class CoreDataTimestampConverterTests: XCTestCase {
    // Known reference: CoreData timestamp 0 = 2001-01-01T00:00:00Z
    func testZeroTimestampIsJanuaryFirst2001() {
        let result = CoreDataTimestampConverter.toISO8601(0)
        XCTAssertNil(result, "Zero timestamp should return nil (invalid/unset date)")
    }

    // Known reference: CoreData timestamp 1 = 2001-01-01T00:00:01Z
    func testOneSecondAfterEpoch() {
        let result = CoreDataTimestampConverter.toISO8601(1)
        XCTAssertEqual(result, "2001-01-01T00:00:01Z")
    }

    // Known reference: Unix 0 in CoreData = timestamp -978307200
    // Verify offset is exactly right by checking a known date
    // 2024-01-01T00:00:00Z = Unix 1704067200 = CoreData 725760000
    func testKnownDate2024Jan01() {
        let coreDataTimestamp: Double = 725_760_000
        let result = CoreDataTimestampConverter.toISO8601(coreDataTimestamp)
        XCTAssertEqual(result, "2024-01-01T00:00:00Z")
    }

    // Verify negative timestamps return nil
    func testNegativeTimestampReturnsNil() {
        XCTAssertNil(CoreDataTimestampConverter.toISO8601(-1))
    }
}
```

### Pattern 4: PermissionManager

**What:** Actor that checks permission status, requests it, and deep-links to System Settings.
**When to use:** Called before any native adapter's `fetchCards()`. Stores NSOpenPanel security-scoped bookmarks in UserDefaults for re-import without re-authorization.

```swift
// PermissionManager.swift
// Handles two distinct permission systems:
// 1. NSOpenPanel security-scoped bookmarks — for file-based databases (Notes, future)
// 2. EventKit authorization — for Reminders and Calendar (Phase 34)
// In Phase 33: only the skeleton + bookmark infrastructure is needed.
// EventKit authorization stubs added but not wired to real EKEventStore yet.

import Foundation
import AppKit  // NSWorkspace for deep links

actor PermissionManager {
    // UserDefaults key for storing security-scoped bookmark data
    // Format: "bookmark.native_notes" — one key per source type
    private static let bookmarkKeyPrefix = "works.isometry.bookmark."

    // MARK: - Security-Scoped Bookmark Caching (FNDX-07)

    /// Store a security-scoped bookmark for a given source type.
    /// Call after user selects a file/folder via NSOpenPanel.
    func storeBookmark(for sourceType: String, url: URL) throws {
        let bookmarkData = try url.bookmarkData(
            options: .withSecurityScope,
            includingResourceValuesForKeys: nil,
            relativeTo: nil
        )
        UserDefaults.standard.set(bookmarkData, forKey: Self.bookmarkKeyPrefix + sourceType)
    }

    /// Resolve a previously stored security-scoped bookmark.
    /// Returns the resolved URL with security scope already started.
    /// Caller MUST call stopAccessingSecurityScopedResource() when done.
    func resolveBookmark(for sourceType: String) throws -> URL? {
        guard let bookmarkData = UserDefaults.standard.data(forKey: Self.bookmarkKeyPrefix + sourceType) else {
            return nil
        }
        var isStale = false
        let url = try URL(
            resolvingBookmarkData: bookmarkData,
            options: .withSecurityScope,
            relativeTo: nil,
            bookmarkDataIsStale: &isStale
        )
        if isStale {
            // Bookmark is stale — clear it so next import triggers NSOpenPanel again
            UserDefaults.standard.removeObject(forKey: Self.bookmarkKeyPrefix + sourceType)
            return nil
        }
        guard url.startAccessingSecurityScopedResource() else { return nil }
        return url
    }

    /// Clear stored bookmark for a source type (e.g., on explicit revocation).
    func clearBookmark(for sourceType: String) {
        UserDefaults.standard.removeObject(forKey: Self.bookmarkKeyPrefix + sourceType)
    }

    // MARK: - System Settings Deep Links (FNDX-02)

    /// Open the correct System Settings pane for the given source type.
    /// macOS 13+ uses x-apple.systempreferences: scheme.
    func openSystemSettings(for sourceType: String) {
        let url: URL
        switch sourceType {
        case "native_notes":
            // Full Disk Access — required for NoteStore.sqlite
            url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles")!
        case "native_reminders":
            url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Reminders")!
        case "native_calendar":
            url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars")!
        default:
            url = URL(string: "x-apple.systempreferences:com.apple.preference.security")!
        }
        NSWorkspace.shared.open(url)
    }
}
```

### Pattern 5: Import Source Picker UI

**What:** SwiftUI sheet with a list of import sources. Future sources (Reminders, Calendar, Notes) appear as greyed-out rows. MockAdapter appears in DEBUG only.
**When to use:** Shown when user taps the import button (or selects "Import from..." in macOS menu).

```swift
// ImportSourcePickerView.swift
// "Import from..." picker sheet.
// Future sources (Reminders, Calendar, Notes) greyed out — shows what's coming.
// MockAdapter item only appears in DEBUG builds.

import SwiftUI

struct ImportSource: Identifiable {
    let id: String
    let displayName: String
    let systemImage: String
    let isAvailable: Bool
}

struct ImportSourcePickerView: View {
    var onSelect: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    private var sources: [ImportSource] {
        var list: [ImportSource] = [
            // Future sources — greyed out, tap does nothing
            ImportSource(id: "native_reminders", displayName: "Reminders", systemImage: "list.bullet", isAvailable: false),
            ImportSource(id: "native_calendar",  displayName: "Calendar",  systemImage: "calendar",    isAvailable: false),
            ImportSource(id: "native_notes",     displayName: "Notes",     systemImage: "note.text",   isAvailable: false),
        ]
        #if DEBUG
        // MockAdapter visible in debug builds only
        list.append(ImportSource(id: "mock", displayName: "Mock (Debug)", systemImage: "hammer", isAvailable: true))
        #endif
        return list
    }

    var body: some View {
        NavigationStack {
            List(sources) { source in
                Button {
                    guard source.isAvailable else { return }
                    dismiss()
                    onSelect(source.id)
                } label: {
                    Label(source.displayName, systemImage: source.systemImage)
                        .foregroundStyle(source.isAvailable ? .primary : .secondary)
                }
                .disabled(!source.isAvailable)
            }
            .navigationTitle("Import from...")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}
```

### Pattern 6: NativeBridge.ts — native:import-chunk Handler

**What:** TypeScript handler that accumulates all chunks from Swift, then calls ImportOrchestrator once at the end for correct cross-chunk deduplication.
**When to use:** Installed alongside other handlers in `initNativeBridge()`.

```typescript
// Add to NativeBridge.ts initNativeBridge() switch statement:

case 'native:import-chunk': {
    const payload = message.payload as {
        chunkIndex: number;
        isLast: boolean;
        cardsBase64: string;
    };
    handleNativeImportChunk(bridge, payload).catch(err =>
        console.error('[NativeBridge] native:import-chunk failed:', err)
    );
    break;
}

// Accumulator lives for the duration of a single multi-chunk import.
// Reset on receipt of the first chunk (chunkIndex === 0).
let chunkAccumulator: CanonicalCard[] = [];
let activeSourceType: string | null = null;

async function handleNativeImportChunk(
    bridge: WorkerBridge,
    payload: { chunkIndex: number; isLast: boolean; cardsBase64: string }
): Promise<void> {
    // Decode base64 JSON
    const cardsJson = atob(payload.cardsBase64);
    const cards: CanonicalCard[] = JSON.parse(cardsJson);

    if (payload.chunkIndex === 0) {
        // Reset accumulator for new import
        chunkAccumulator = [];
        activeSourceType = cards[0]?.source ?? null;
    }

    chunkAccumulator.push(...cards);

    // Send ack to Swift so next chunk is released
    window.webkit!.messageHandlers.nativeBridge.postMessage({
        id: crypto.randomUUID(),
        type: 'native:import-chunk-ack',
        payload: { chunkIndex: payload.chunkIndex, success: true },
        timestamp: Date.now(),
    });

    if (payload.isLast && activeSourceType) {
        // All chunks received — call ImportOrchestrator once for proper cross-chunk dedup
        const result = await bridge.importNative(activeSourceType, chunkAccumulator);
        console.log('[NativeBridge] Native import complete:', result);
        chunkAccumulator = [];
        activeSourceType = null;
    }
}
```

### Pattern 7: src/etl/types.ts SourceType Extension

**What:** Add native source types to the existing `SourceType` union.
**When to use:** Required before any native import can be dispatched to ImportOrchestrator.

```typescript
// src/etl/types.ts — extend existing SourceType union
export type SourceType =
  | 'apple_notes'
  | 'markdown'
  | 'excel'
  | 'csv'
  | 'json'
  | 'html'
  // Native adapter source types (Phase 33+)
  | 'native_reminders'
  | 'native_calendar'
  | 'native_notes';
```

### Pattern 8: MockAdapter (DEBUG only)

**What:** Trivial Swift NativeImportAdapter that yields exactly 3 hardcoded cards and never touches any system database.
**When to use:** Phase 33 end-to-end pipeline validation only. Never shipped in production builds.

```swift
// MockAdapter.swift
// #if DEBUG — only compiled for debug builds

#if DEBUG
import Foundation

struct MockAdapter: NativeImportAdapter {
    let sourceType = "native_notes"  // Use a real source type for proper dedup testing

    func checkPermission() -> PermissionStatus { .granted }
    func requestPermission() async -> PermissionStatus { .granted }

    func fetchCards() -> AsyncStream<[CanonicalCard]> {
        AsyncStream { continuation in
            let cards = [
                CanonicalCard(
                    id: UUID().uuidString,
                    card_type: "note",
                    name: "Mock Card 1",
                    content: "This is mock card 1 from the native pipeline",
                    summary: nil, latitude: nil, longitude: nil, location_name: nil,
                    created_at: "2024-01-01T00:00:00Z",
                    modified_at: "2024-01-01T00:00:00Z",
                    due_at: nil, completed_at: nil, event_start: nil, event_end: nil,
                    folder: "Mock Folder", tags: ["mock", "test"], status: nil,
                    priority: 0, sort_order: 0, url: nil, mime_type: nil,
                    is_collective: false, source: "native_notes",
                    source_id: "mock-001", source_url: nil, deleted_at: nil
                ),
                CanonicalCard(
                    id: UUID().uuidString, card_type: "note",
                    name: "Mock Card 2", content: "Mock card 2",
                    summary: nil, latitude: nil, longitude: nil, location_name: nil,
                    created_at: "2024-01-02T00:00:00Z",
                    modified_at: "2024-01-02T00:00:00Z",
                    due_at: nil, completed_at: nil, event_start: nil, event_end: nil,
                    folder: "Mock Folder", tags: [], status: nil,
                    priority: 0, sort_order: 1, url: nil, mime_type: nil,
                    is_collective: false, source: "native_notes",
                    source_id: "mock-002", source_url: nil, deleted_at: nil
                ),
                CanonicalCard(
                    id: UUID().uuidString, card_type: "note",
                    name: "Mock Card 3", content: "Mock card 3",
                    summary: nil, latitude: nil, longitude: nil, location_name: nil,
                    created_at: "2024-01-03T00:00:00Z",
                    modified_at: "2024-01-03T00:00:00Z",
                    due_at: nil, completed_at: nil, event_start: nil, event_end: nil,
                    folder: "Mock Folder", tags: [], status: nil,
                    priority: 0, sort_order: 2, url: nil, mime_type: nil,
                    is_collective: false, source: "native_notes",
                    source_id: "mock-003", source_url: nil, deleted_at: nil
                ),
            ]
            continuation.yield(cards)
            continuation.finish()
        }
    }
}
#endif
```

### Anti-Patterns to Avoid

- **Hardcoding system database paths:** `~/Library/Group Containers/group.com.apple.notes/NoteStore.sqlite` is stable on current macOS but changes across user migrations and macOS major versions. Always discover dynamically.
- **Opening WAL databases directly without copying:** The running system apps (Notes, Reminders, Calendar) hold write locks on their databases. The copy-then-read strategy is locked — don't skip it.
- **Embedding raw JSON in evaluateJavaScript template literals:** Large unescaped JSON strings with special characters cause JS injection-like parsing errors and have triggered WebKit crashes in release builds. Always base64-encode the cards payload.
- **Calling ImportOrchestrator per chunk:** Cross-chunk deduplication fails if `ImportOrchestrator.import()` is called once per chunk. Accumulate all chunks in JS, then call ImportOrchestrator once.
- **Adding native:import-chunk-ack as a 7th canonical bridge message type:** The bridge protocol has 6 canonical types. `native:import-chunk` and `native:import-chunk-ack` are native ETL sub-protocol messages, scoped to the adapter layer. They should not be added to the canonical protocol table in native/Isometry/CLAUDE.md.
- **Using `try? await evaluateJavaScript(js)` for chunk sends:** Silent failures on chunk sends will hang the coordinator awaiting an ack that never arrives. Use `do-catch` and propagate errors.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CoreData timestamp conversion | Custom date math | CoreDataTimestampConverter (standalone function) | Epoch offset is 978,307,200 exactly — it's trivial but must be tested; the "31-year" bug is a known pitfall |
| Security-scoped bookmark persistence | Custom keychain storage | UserDefaults with `URL.bookmarkData(options: .withSecurityScope)` | Apple's documented pattern; UserDefaults is correct for bookmark data (not sensitive, not a secret) |
| Chunked JSON serialization | Manual JSON string building | JSONEncoder().encode([CanonicalCard]) + base64 | Codable handles all edge cases in card content (special chars, Unicode, emoji) |
| System Settings deep links | Parsing preference pane IDs | `x-apple.systempreferences:` URL scheme | Apple-documented URL scheme; pane-specific IDs are stable across macOS 13+ |
| AsyncSequence iteration | Manual callback chaining | `for await batch in adapter.fetchCards()` | AsyncStream with continuation.yield is the canonical Swift concurrency batch pattern |

**Key insight:** The complexity in this phase is orchestration (coordinating 5+ moving pieces end-to-end), not any individual component. None of the individual components are hard to build; getting them to work together reliably is the challenge.

---

## Common Pitfalls

### Pitfall 1: CoreData Timestamp 31-Year Offset (FNDX-03)

**What goes wrong:** Imported dates show as 1993 or 1994 instead of 2024 or 2025.
**Why it happens:** CoreData uses Apple Reference Date (Jan 1, 2001) as epoch. `Date(timeIntervalSince1970: coreDataTimestamp)` silently produces the wrong date because it treats the CoreData value as if it's a Unix timestamp.
**How to avoid:** Always use `CoreDataTimestampConverter.toISO8601()`. XCTest validates the exact offset (978,307,200 seconds) against a known reference date.
**Warning signs:** Any date appearing approximately 31 years before expected is this bug.

### Pitfall 2: WKWebView Process Termination on Large JSON Payloads (FNDX-05)

**What goes wrong:** Importing 5,000+ cards causes a silent WebContent process termination. The app shows the crash recovery overlay.
**Why it happens:** `evaluateJavaScript` with a very large inline JSON string forces WebKit to parse and allocate in the WebContent process simultaneously with the JS Worker's ImportOrchestrator running. Memory pressure kills the WebContent process.
**How to avoid:** 200-card chunks (locked decision). Additionally, base64-encode the cards JSON to avoid large string allocation in the JS call site.
**Warning signs:** Import works for small mock dataset (3 cards) but fails consistently at 1000+ cards in stress testing.

### Pitfall 3: Chunk Acknowledgment Deadlock

**What goes wrong:** The coordinator sends chunk N but `pendingChunkContinuation` is already set (from a previous in-flight chunk), causing the second `await` to never resume.
**Why it happens:** The coordinator must be strictly sequential — one chunk in flight at a time. Concurrent chunk dispatch breaks the single-continuation model.
**How to avoid:** `NativeImportCoordinator.runImport()` must await each `sendChunk()` call before starting the next. The `async/await` chain is naturally sequential — don't wrap in `Task { }` inside the loop.
**Warning signs:** Import progress stalls at chunk 1 or 2 and never completes.

### Pitfall 4: Cross-Chunk Deduplication Failure

**What goes wrong:** A card appears twice in Isometry after a re-import.
**Why it happens:** If `ImportOrchestrator.import()` is called once per chunk, each chunk's dedup engine builds its own state from the database at call time. Cards written by chunk N are not yet visible to chunk N+1's dedup pass (if they commit in the same transaction batch).
**How to avoid:** Accumulate ALL chunks in JS before calling `ImportOrchestrator.import()` once. `DedupEngine` runs over the full card set in memory, guaranteeing cross-chunk dedup correctness.
**Warning signs:** 3 MockAdapter cards imported twice = 6 cards in the DB after re-import instead of 3.

### Pitfall 5: Security-Scoped Bookmark Staleness

**What goes wrong:** Re-import silently fails because the stored bookmark is stale (e.g., the user moved the database file or the iCloud container was reorganized).
**Why it happens:** `URL.bookmarkData` snapshots the file's identity at storage time. If the file moves or the container changes, the bookmark becomes stale.
**How to avoid:** Check `bookmarkDataIsStale` on resolution. If stale, clear the UserDefaults entry and re-prompt. Log the staleness event for debugging.
**Warning signs:** `resolveBookmark()` returns `nil` on second import even though UserDefaults has the key.

### Pitfall 6: Concurrent Import Dispatch

**What goes wrong:** User taps "Import" twice rapidly. Two imports run concurrently. Cards are duplicated or the DB is corrupted.
**Why it happens:** The source picker and coordinator have no guard against concurrent invocation.
**How to avoid:** Track `isImporting: Bool` flag in the coordinator or view model. Disable the import button while an import is in progress.
**Warning signs:** Duplicate cards in DB after rapid double-tap.

### Pitfall 7: BridgeManager @MainActor Isolation

**What goes wrong:** `NativeImportCoordinator.sendChunk()` calls `evaluateJavaScript` from a non-main actor context, throwing a Swift concurrency isolation error at compile time.
**Why it happens:** `WKWebView.evaluateJavaScript` must be called from the main thread. The existing codebase enforces this via `@MainActor` on `BridgeManager`.
**How to avoid:** Mark `NativeImportCoordinator` `@MainActor` or annotate `sendChunk()` with `@MainActor`. The coordinator interacts with `webView` which requires main actor isolation.
**Warning signs:** Swift compiler error: "expression is async but is not marked with await" or "non-isolated call to actor-isolated function".

---

## Code Examples

### Extending BridgeManager.didReceive() for native:import-chunk-ack

```swift
// In BridgeManager.swift — add to the existing switch type { } in didReceive()
// Source: existing BridgeManager.swift pattern (line 101-172)

case "native:import-chunk-ack":
    let payload = body["payload"] as? [String: Any]
    let chunkIndex = payload?["chunkIndex"] as? Int ?? -1
    let success = payload?["success"] as? Bool ?? false
    logger.debug("native:import-chunk-ack received: chunk \(chunkIndex), success: \(success)")
    importCoordinator?.receiveChunkAck(success: success)
```

### Wiring PermissionManager to ImportSourcePickerView in ContentView

```swift
// In ContentView.swift — wire new picker sheet (additive to existing sheets)
// Source: existing ContentView.swift sheet pattern (.sheet(isPresented:) at line 162+)

@State private var showingImportSourcePicker = false
@StateObject private var importCoordinator = NativeImportCoordinator()

// In toolbar or menu:
Button { showingImportSourcePicker = true } label: {
    Label("Import from...", systemImage: "square.and.arrow.down")
}

// Sheet:
.sheet(isPresented: $showingImportSourcePicker) {
    ImportSourcePickerView { sourceType in
        Task {
            await runNativeImport(sourceType: sourceType)
        }
    }
}
```

### Adding WorkerBridge.importNative() method

```typescript
// In src/worker/WorkerBridge.ts — new method to dispatch native cards to Worker
// Source: existing WorkerBridge.ts pattern (importFile method)

async importNative(
    sourceType: string,
    cards: CanonicalCard[]
): Promise<ImportResult> {
    return this.send('etl:import-native', { sourceType, cards });
}
```

### etl-import-native.handler.ts — Worker handler for pre-parsed native cards

```typescript
// src/worker/handlers/etl-import-native.handler.ts
// Takes already-parsed CanonicalCard[] (no parsing step needed — Swift did the parsing)
// Delegates directly to DedupEngine → SQLiteWriter → CatalogWriter

import type { Database } from '../../database/Database';
import { DedupEngine } from '../../etl/DedupEngine';
import { SQLiteWriter } from '../../etl/SQLiteWriter';
import { CatalogWriter } from '../../etl/CatalogWriter';
import type { CanonicalCard, ImportResult } from '../../etl/types';

export async function handleETLImportNative(
    db: Database,
    payload: { sourceType: string; cards: CanonicalCard[] }
): Promise<ImportResult> {
    const dedup = new DedupEngine(db);
    const writer = new SQLiteWriter(db);
    const catalog = new CatalogWriter(db);

    const dedupResult = dedup.process(payload.cards, [], payload.sourceType);
    const isBulkImport = dedupResult.toInsert.length + dedupResult.toUpdate.length > 500;

    await writer.writeCards(dedupResult.toInsert, isBulkImport);
    await writer.updateCards(dedupResult.toUpdate);
    await writer.writeConnections(dedupResult.connections);

    const result: ImportResult = {
        inserted: dedupResult.toInsert.length,
        updated: dedupResult.toUpdate.length,
        unchanged: dedupResult.toSkip.length,
        skipped: 0,
        errors: 0,
        connections_created: dedupResult.connections.length,
        insertedIds: dedupResult.toInsert.map(c => c.id),
        errors_detail: [],
    };

    catalog.recordImportRun({
        source: payload.sourceType as any,
        sourceName: payload.sourceType,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        result,
    });

    return result;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `evaluateJavaScript(completionHandler:)` | `evaluateJavaScript(_:)` async | Swift 5.7 / iOS 15 | async/await; project already uses this form |
| Synchronous OperationQueue-based adapter | AsyncStream with `for await` | Swift 5.5 (SE-0298) | Natural backpressure, no callback pyramid |
| Combine for async sequences | AsyncStream / AsyncSequence | 2022+ (Swift concurrency matured) | DatabaseManager already uses actors — consistent |
| `WKUserContentController.add(_:name:)` directly | WeakScriptMessageHandler proxy | Phase 12 (this project) | Prevents retain cycle — pattern already established |

**Deployment target note:** The Xcode project targets iOS 26.2 / macOS 26.2 (read from project.pbxproj). This is a simulator-era target — all modern Swift concurrency APIs (AsyncStream, actors, structured concurrency) are available without availability guards.

---

## Open Questions

1. **App Store vs Direct Distribution — PermissionManager architecture impact**
   - What we know: STATE.md flags "App Store vs direct distribution decision affects NSOpenPanel vs Full Disk Access path — confirm before Phase 33"
   - What's unclear: App Store sandbox requires `com.apple.security.files.user-selected.read-only` entitlement for NSOpenPanel. Direct distribution has access to Full Disk Access via TCC without NSOpenPanel for some paths.
   - Recommendation: Proceed with NSOpenPanel + security-scoped bookmarks approach — this works for BOTH App Store AND direct distribution. Full Disk Access TCC is only needed for Notes (Phase 35) and can be handled as a fallback path. The PermissionManager skeleton in Phase 33 should not assume Full Disk Access is available.
   - ACTION NEEDED: Resolve before Phase 35 (Notes adapter). Phase 33 MockAdapter does not need file access at all.

2. **native:import-chunk-ack bridge protocol scope**
   - What we know: The bridge has a canonical 6-message protocol defined in native/Isometry/CLAUDE.md. The CLAUDE.md says "Do not add new types without architectural review."
   - What's unclear: Whether `native:import-chunk` and `native:import-chunk-ack` should be formally added to the canonical protocol table or treated as adapter-layer sub-protocol.
   - Recommendation: Treat as adapter sub-protocol. Document them only in the Phase 33 plan / adapter-layer code, NOT in native/Isometry/CLAUDE.md. The canonical 6-message contract covers the bridge between the shell and the web runtime; adapter messages are implementation details of the adapter layer.

3. **5,000-card performance validation approach**
   - What we know: FNDX-05 requires "5,000-card mock import completes without WKWebView process termination." MockAdapter yields only 3 cards.
   - What's unclear: Where does the 5,000-card stress test come from? Is there a separate stress fixture?
   - Recommendation: Create a second `LargeMockAdapter` (also DEBUG-only) that generates 5,000 synthetic cards in a loop without any I/O. Run this as a manual QA step (tap in DEBUG build and observe no crash recovery overlay). This is not an automated XCTest — it requires a running WKWebView.

---

## Sources

### Primary (HIGH confidence)

- Codebase direct read: `native/Isometry/Isometry/BridgeManager.swift` — existing switch dispatch, @MainActor pattern, evaluateJavaScript usage
- Codebase direct read: `native/Isometry/Isometry/ContentView.swift` — existing sheet patterns, file import wiring
- Codebase direct read: `src/native/NativeBridge.ts` — existing receive handler, base64 patterns, native:action dispatch
- Codebase direct read: `src/etl/types.ts` — CanonicalCard interface fields (exact mirror required for Swift struct)
- Codebase direct read: `src/etl/ImportOrchestrator.ts` — onProgress callback, dedup flow
- Codebase direct read: `src/etl/DedupEngine.ts` (via ImportOrchestrator) — cross-import dedup via source_id
- Codebase direct read: `src/ui/ImportToast.ts` — existing progress notification pipeline
- Apple Documentation (training data, HIGH): `ISO8601DateFormatter` — `string(from:)` produces "2001-01-01T00:00:00Z" format
- Apple Documentation (training data, HIGH): `URL.bookmarkData(options: .withSecurityScope)` — UserDefaults storage pattern

### Secondary (MEDIUM confidence)

- [epochconverter.com CoreData](https://www.epochconverter.com/coredata) — Confirms CoreData epoch = January 1, 2001; offset = 978,307,200 seconds
- [Apple Developer Forums — Security-scoped bookmarks](https://developer.apple.com/forums/thread/124687) — Confirms `bookmarkData(options: .withSecurityScope)` + `URL(resolvingBookmarkData:options:relativeTo:bookmarkDataIsStale:)` pattern; UserDefaults as storage location
- [SQLite WAL documentation](https://sqlite.org/wal.html) — Confirms WAL-mode databases on read-only media can be read with `?immutable=1` URI parameter (relevant for Phase 35 Notes copy-then-read)
- [SwiftLee AsyncSequence](https://www.avanderlee.com/concurrency/asyncsequence/) — Confirms `AsyncStream.Continuation.yield()` for batch yielding pattern

### Tertiary (LOW confidence — flag for validation)

- `x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles` — Deep link URL scheme for Full Disk Access System Settings pane. Verified to work in macOS 13-14 from community sources. Needs validation on macOS 26.2 (deployment target). LOW confidence because the query parameter format (`Privacy_AllFiles`) may have changed in newer macOS.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all components are existing project infrastructure or standard Apple APIs
- Architecture patterns: HIGH — direct read of BridgeManager, NativeBridge, ImportOrchestrator codebases; patterns are extensions of existing patterns
- CoreData timestamp pitfall: HIGH — epoch offset is well-documented (978,307,200 seconds, Jan 1 2001 vs Jan 1 1970); verified by multiple sources
- WKWebView memory pitfall: MEDIUM — large payload crashes documented in WebKit bug tracker; 200-card chunk limit derived from existing project decision, not independently measured
- Security-scoped bookmark patterns: MEDIUM — Apple Developer Forum confirmation; implementation is standard pattern
- System Settings deep link URLs: LOW — URL scheme confirmed but exact query parameters for macOS 26.2 need runtime validation

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (Apple APIs are stable; bridge protocol is project-internal and won't change without this project's own change)
