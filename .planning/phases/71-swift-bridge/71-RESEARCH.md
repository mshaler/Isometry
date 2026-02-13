# Phase 71: Swift Bridge - Research

**Researched:** 2026-02-12
**Domain:** Swift-JavaScript Bridge via WKWebView, Native Framework Adapters
**Confidence:** HIGH

## Summary

Phase 71 implements bidirectional communication between Swift and JavaScript, enabling Swift to delegate file processing to the TypeScript ETL pipeline established in Phases 67-70. The architecture leverages WKWebView's `callAsyncJavaScript` for Swift-to-JS calls and `WKScriptMessageHandler` for JS-to-Swift callbacks.

The codebase already has substantial infrastructure: `window.isometryETL.importFile()` is exposed from Phase 70, `FileSystemMessageHandler.swift` demonstrates the message handler pattern, and `SQLiteFileImporter.swift` shows how to work with native data sources. The primary work is creating `ETLBridge.swift` to orchestrate Swift-to-JS delegation and building native adapters for EventKit, Contacts, and Notes.

**Primary recommendation:** Create ETLBridge.swift using `callAsyncJavaScript` to invoke `window.isometryETL.importFile()`, returning JSON-serialized CanonicalNode arrays. Native adapters should convert framework objects to file-like content (markdown/JSON) and delegate parsing to JS.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| WebKit | native | WKWebView + callAsyncJavaScript | Apple's official way to execute JS in web views |
| EventKit | native | Calendar/Reminders access | Required for system calendar integration |
| Contacts | native | CNContactStore access | Required for system contacts integration |
| Foundation | native | Data, JSON encoding, async/await | Swift runtime essentials |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| GRDB | 6.x | SQLite access (already in project) | Native database operations |
| SandboxValidator | internal | File path validation | Security for file operations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| callAsyncJavaScript | evaluateJavaScript | callAsyncJavaScript handles async functions properly |
| WKScriptMessageHandler | Custom URL scheme | Message handlers are cleaner, better error handling |
| Direct framework import | AppleScript (Notes) | AppleScript requires special permissions, unreliable |

## Architecture Patterns

### Recommended Project Structure
```
native/Sources/Isometry/
├── Bridge/
│   └── ETLBridge.swift          # Main Swift -> JS delegation
├── Adapters/
│   ├── EventKitAdapter.swift    # Calendar/Reminders to CanonicalNode
│   ├── ContactsAdapter.swift    # Contacts to CanonicalNode
│   └── NotesAdapter.swift       # Apple Notes access
└── WebView/
    ├── FileSystemMessageHandler.swift  # (exists) File operations
    └── MessageHandlers.swift           # (exists) Handler routing
```

### Pattern 1: Swift-to-JS Delegation via callAsyncJavaScript
**What:** Swift calls JavaScript functions with arguments, receives JSON results
**When to use:** All file parsing delegated to TypeScript ETL
**Example:**
```swift
// Source: Apple Developer Documentation + existing codebase patterns
public actor ETLBridge {
    private let webView: WKWebView

    /// Import file content via JavaScript ETL pipeline
    func importFile(filename: String, content: Data) async throws -> [CanonicalNode] {
        let base64Content = content.base64EncodedString()

        // Use callAsyncJavaScript to invoke window.isometryETL.importFile
        let js = """
            return await window.isometryETL.importFile(filename, content);
        """

        let result = try await webView.callAsyncJavaScript(
            js,
            arguments: ["filename": filename, "content": base64Content],
            in: nil,
            contentWorld: .page
        )

        // Parse JSON result
        guard let jsonData = (result as? String)?.data(using: .utf8),
              let nodes = try? JSONDecoder().decode([CanonicalNode].self, from: jsonData)
        else {
            throw ETLBridgeError.invalidResponse
        }

        return nodes
    }
}
```

### Pattern 2: Native Adapter Pattern (EventKit/Contacts)
**What:** Convert native framework objects to CanonicalNode directly in Swift
**When to use:** When framework data doesn't need file parsing
**Example:**
```swift
// Source: Existing SQLiteFileImporter patterns + EventKit docs
public actor EventKitAdapter {
    private let eventStore = EKEventStore()

    func fetchCalendarEvents(from: Date, to: Date) async throws -> [CanonicalNode] {
        // Request access (iOS 17+ API)
        let granted = try await eventStore.requestFullAccessToEvents()
        guard granted else { throw AdapterError.accessDenied }

        let predicate = eventStore.predicateForEvents(withStart: from, end: to, calendars: nil)
        let events = eventStore.events(matching: predicate)

        return events.map { event in
            CanonicalNode(
                id: UUID().uuidString,
                nodeType: "event",
                name: event.title ?? "Untitled Event",
                content: event.notes,
                createdAt: event.creationDate?.iso8601 ?? Date().iso8601,
                modifiedAt: event.lastModifiedDate?.iso8601 ?? Date().iso8601,
                eventStart: event.startDate.iso8601,
                eventEnd: event.endDate.iso8601,
                folder: event.calendar?.title ?? "Calendar",
                source: "eventkit",
                sourceId: event.eventIdentifier,
                // ... other LATCH fields
            )
        }
    }
}
```

### Pattern 3: WKScriptMessageHandler for JS-to-Swift Callbacks
**What:** JavaScript posts messages to Swift handlers
**When to use:** Notifications, progress updates, database save triggers
**Example:**
```swift
// Source: Existing FileSystemMessageHandler.swift
public class ETLProgressHandler: NSObject, WKScriptMessageHandler {
    public func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard let body = message.body as? [String: Any],
              let event = body["event"] as? String
        else { return }

        switch event {
        case "importProgress":
            let percent = body["percent"] as? Int ?? 0
            NotificationCenter.default.post(
                name: .etlProgressUpdate,
                object: nil,
                userInfo: ["percent": percent]
            )
        case "importComplete":
            // Handle completion
        default:
            break
        }
    }
}
```

### Anti-Patterns to Avoid
- **Using evaluateJavaScript for async operations:** The completion handler fires immediately, not when JS async completes. Use `callAsyncJavaScript` instead.
- **Blocking main thread during imports:** All imports must be async. Use Swift actors and background threads.
- **Passing large data without base64 encoding:** Binary data corrupts. Always base64-encode file content for JS.
- **Creating retain cycles with message handlers:** Use weak references or MessageHandlerLeakAvoider pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown parsing in Swift | Custom parser | Delegate to JS (gray-matter) | JS ecosystem has better parsers |
| Excel/XLSX parsing | Native parser | Delegate to JS (xlsx) | Complex format, well-solved in npm |
| JSON schema validation | Manual checks | Zod in JS, Codable in Swift | Type-safe, runtime validation |
| WKWebView continuation wrapper | Raw callbacks | Existing async/await patterns | Swift concurrency is cleaner |
| Calendar access permissions | Raw APIs | eventStore.requestFullAccessToEvents() | iOS 17+ simplified API |

**Key insight:** Swift handles native framework access and orchestration; JavaScript handles file format parsing. Don't duplicate the parsing logic that's already in TypeScript.

## Common Pitfalls

### Pitfall 1: callAsyncJavaScript Crash on Nil Return
**What goes wrong:** App crashes with "Unexpectedly found nil while implicitly unwrapping an Optional value"
**Why it happens:** Known WebKit bug (Xcode 15+, iOS 18+) when JS function returns undefined/void
**How to avoid:** Always return a value from JS functions, even if just `{ success: true }`
**Warning signs:** Crashes only when JS doesn't return explicitly

### Pitfall 2: Swift 6 Concurrency Warnings with WKWebView
**What goes wrong:** "Non-sendable type in async let" errors with Swift 6 strict checking
**Why it happens:** WKWebView methods aren't fully annotated for Sendable
**How to avoid:** Use withCheckedThrowingContinuation wrapper, dispatch to MainActor
**Warning signs:** Yellow warnings about Sendable in concurrency contexts

### Pitfall 3: Message Handler Memory Leaks
**What goes wrong:** WKScriptMessageHandler creates retain cycle with WKUserContentController
**Why it happens:** Strong reference cycle between handler and content controller
**How to avoid:** Use weak delegate pattern (MessageHandlerLeakAvoider class)
**Warning signs:** WebView not deallocating, memory growth on navigation

### Pitfall 4: TCC Permissions for Notes Access
**What goes wrong:** AppleScript for Notes times out or fails silently
**Why it happens:** macOS TCC database requires accessibility permissions
**How to avoid:** Use alto-index exports instead of live Notes access; or implement proper entitlements
**Warning signs:** Permission prompts never appearing, silent failures

### Pitfall 5: Content World Isolation
**What goes wrong:** JS can't access window.isometryETL
**Why it happens:** Using wrong WKContentWorld (defaultClient vs page)
**How to avoid:** Use `.page` content world to access page-level globals
**Warning signs:** "undefined is not an object" errors for window properties

## Code Examples

### Complete ETLBridge.swift Pattern
```swift
// Source: Derived from existing FileSystemMessageHandler + etl-consolidation-plan.md
import WebKit
import Foundation

/// Swift model matching TypeScript CanonicalNode
struct CanonicalNode: Codable {
    let id: String
    let nodeType: String
    let name: String
    let content: String?
    let summary: String?
    let createdAt: String
    let modifiedAt: String
    let dueAt: String?
    let completedAt: String?
    let eventStart: String?
    let eventEnd: String?
    let folder: String?
    let tags: [String]
    let status: String?
    let priority: Int
    let importance: Int
    let sortOrder: Int
    let source: String?
    let sourceId: String?
    let sourceUrl: String?
    let deletedAt: String?
    let version: Int
    let properties: [String: AnyCodable]? // JSON extension point
}

/// Result from window.isometryETL.importFile
struct ImportResult: Codable {
    let success: Bool
    let nodeCount: Int
    let errors: [String]?
}

public actor ETLBridge {
    private weak var webView: WKWebView?
    private let decoder = JSONDecoder()

    public init(webView: WKWebView) {
        self.webView = webView
    }

    /// Import file via JS ETL pipeline
    public func importFile(_ url: URL) async throws -> ImportResult {
        guard let webView = webView else {
            throw ETLBridgeError.webViewNotAvailable
        }

        // Read file and encode as base64
        let data = try Data(contentsOf: url)
        let base64 = data.base64EncodedString()
        let filename = url.lastPathComponent

        // Call JS via main actor (WKWebView requires main thread)
        let result = try await MainActor.run {
            try await webView.callAsyncJavaScript(
                """
                const result = await window.isometryETL.importFile(filename, atob(content));
                return JSON.stringify(result);
                """,
                arguments: ["filename": filename, "content": base64],
                in: nil,
                contentWorld: .page
            )
        }

        guard let jsonString = result as? String,
              let jsonData = jsonString.data(using: .utf8)
        else {
            throw ETLBridgeError.invalidResponse
        }

        return try decoder.decode(ImportResult.self, from: jsonData)
    }
}

public enum ETLBridgeError: Error {
    case webViewNotAvailable
    case invalidResponse
    case importFailed(String)
}
```

### EventKit Adapter with Modern Async API
```swift
// Source: Apple EventKit documentation (iOS 17+)
import EventKit

public actor EventKitAdapter {
    private let eventStore = EKEventStore()

    public func requestAccess() async throws -> Bool {
        try await eventStore.requestFullAccessToEvents()
    }

    public func fetchEvents(from: Date, to: Date) async throws -> [CanonicalNode] {
        let predicate = eventStore.predicateForEvents(
            withStart: from,
            end: to,
            calendars: nil
        )

        let events = eventStore.events(matching: predicate)
        let formatter = ISO8601DateFormatter()

        return events.map { event in
            CanonicalNode(
                id: UUID().uuidString,
                nodeType: "event",
                name: event.title ?? "Untitled",
                content: event.notes,
                summary: event.location,
                createdAt: formatter.string(from: event.creationDate ?? Date()),
                modifiedAt: formatter.string(from: event.lastModifiedDate ?? Date()),
                dueAt: nil,
                completedAt: nil,
                eventStart: formatter.string(from: event.startDate),
                eventEnd: formatter.string(from: event.endDate),
                folder: event.calendar?.title,
                tags: [],
                status: nil,
                priority: 0,
                importance: 0,
                sortOrder: 0,
                source: "eventkit",
                sourceId: event.eventIdentifier,
                sourceUrl: nil,
                deletedAt: nil,
                version: 1,
                properties: nil
            )
        }
    }
}
```

### Contacts Adapter
```swift
// Source: Apple Contacts framework documentation
import Contacts

public actor ContactsAdapter {
    private let contactStore = CNContactStore()

    public func requestAccess() async throws -> Bool {
        try await contactStore.requestAccess(for: .contacts)
    }

    public func fetchContacts() async throws -> [CanonicalNode] {
        let keysToFetch: [CNKeyDescriptor] = [
            CNContactGivenNameKey as CNKeyDescriptor,
            CNContactFamilyNameKey as CNKeyDescriptor,
            CNContactOrganizationNameKey as CNKeyDescriptor,
            CNContactEmailAddressesKey as CNKeyDescriptor,
            CNContactPhoneNumbersKey as CNKeyDescriptor,
            CNContactNoteKey as CNKeyDescriptor,
            CNContactIdentifierKey as CNKeyDescriptor
        ]

        let request = CNContactFetchRequest(keysToFetch: keysToFetch)
        var contacts: [CanonicalNode] = []
        let formatter = ISO8601DateFormatter()
        let now = formatter.string(from: Date())

        try contactStore.enumerateContacts(with: request) { contact, _ in
            let fullName = [contact.givenName, contact.familyName]
                .filter { !$0.isEmpty }
                .joined(separator: " ")

            let displayName = fullName.isEmpty ?
                (contact.organizationName.isEmpty ? "Unknown" : contact.organizationName) :
                fullName

            let node = CanonicalNode(
                id: UUID().uuidString,
                nodeType: "person",
                name: displayName,
                content: contact.note,
                summary: contact.organizationName.isEmpty ? nil : contact.organizationName,
                createdAt: now,
                modifiedAt: now,
                dueAt: nil,
                completedAt: nil,
                eventStart: nil,
                eventEnd: nil,
                folder: "Contacts",
                tags: [],
                status: nil,
                priority: 0,
                importance: 0,
                sortOrder: 0,
                source: "contacts",
                sourceId: contact.identifier,
                sourceUrl: nil,
                deletedAt: nil,
                version: 1,
                properties: nil
            )
            contacts.append(node)
        }

        return contacts
    }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| evaluateJavaScript with callbacks | callAsyncJavaScript with async/await | iOS 14+ (2020) | Proper async handling |
| Calendar: requestAccess(to:completion:) | requestFullAccessToEvents() async | iOS 17+ (2023) | Cleaner Swift concurrency |
| Contacts: CNContactStore.requestAccess(for:completionHandler:) | requestAccess(for:) async | iOS 17+ (2023) | Async/await support |
| Manual MessageBridge protocol | Direct callAsyncJavaScript | Architecture change | Eliminated 40KB bridge code |

**Deprecated/outdated:**
- `evaluateJavaScript(_:completionHandler:)`: Still works but doesn't handle async JS properly
- `requestAccess(to:completion:)` for EventKit: Replaced by simpler async API in iOS 17+
- AppleScript for Notes access: Unreliable on modern macOS, TCC issues

## Open Questions

1. **Notes Adapter Implementation**
   - What we know: AppleScript access is unreliable; alto-index exports work well
   - What's unclear: Whether to support live Notes sync or rely on exported files only
   - Recommendation: Use alto-index exported markdown files; defer live sync to future phase

2. **Error Propagation Strategy**
   - What we know: JS throws errors, Swift needs to handle them
   - What's unclear: Best UX for partial import failures
   - Recommendation: Return ImportResult with error array, let caller decide on partial success

3. **WKWebView Lifecycle Management**
   - What we know: Bridge needs initialized WebView with database ready
   - What's unclear: Best initialization point in app lifecycle
   - Recommendation: Initialize after SQLiteProvider confirms database; use lazy initialization

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/etl/bridge/window-export.ts` - current JS API
- Existing codebase: `native/Sources/Isometry/WebView/FileSystemMessageHandler.swift` - message handler pattern
- Existing codebase: `native/Sources/Isometry/Import/SQLiteFileImporter.swift` - native adapter pattern
- Existing codebase: `src/etl/types/canonical.ts` - CanonicalNode schema
- Existing codebase: `src/types/global.d.ts` - window.isometryETL interface

### Secondary (MEDIUM confidence)
- [Apple Developer Documentation: callAsyncJavaScript](https://developer.apple.com/documentation/webkit/wkwebview/3656441-callasyncjavascript) - official API
- [Apple Developer Documentation: EventKit](https://developer.apple.com/documentation/eventkit) - calendar access
- [Apple Developer Documentation: CNContactStore](https://developer.apple.com/documentation/contacts/cncontactstore) - contacts access
- [Two-way communication between iOS WKWebView and web page](https://diamantidis.github.io/2020/02/02/two-way-communication-between-ios-wkwebview-and-web-page)
- [How to Establish Two-Way Communication Bridge (March 2024)](https://oleksandrbandyliuk.dev/posts/2024/03/how-to-establish-two-way-communication-bridge-between-native-ios-swift-app-and-javascript-using-wkwebview/)

### Tertiary (LOW confidence)
- [Swift Forums: Concurrency warning with WKWebView](https://forums.swift.org/t/concurrency-warning-when-using-wkwebview-evaluatejavascript-and-async-let/76836) - Swift 6 issues
- [Apple Developer Forums: evaluateJavaScript crash](https://developer.apple.com/forums/thread/701553) - known WebKit bug

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - using Apple's native frameworks exactly as documented
- Architecture: HIGH - patterns exist in codebase, well-established WKWebView practices
- Pitfalls: MEDIUM - some issues from community reports need validation

**Research date:** 2026-02-12
**Valid until:** 60 days (stable Apple APIs, established patterns)
