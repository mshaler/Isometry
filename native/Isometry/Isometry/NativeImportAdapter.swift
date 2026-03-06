import Foundation

// ---------------------------------------------------------------------------
// NativeImportAdapter — Swift-side Native ETL Protocol & Types
// ---------------------------------------------------------------------------
// Defines the contract all native macOS adapters (Reminders, Calendar, Notes)
// conform to. CanonicalCard mirrors the TypeScript CanonicalCard interface
// field-for-field for type-safe JSON bridge transport.
//
// Requirements addressed:
//   - FNDX-01: NativeImportAdapter protocol shared by all adapters
//   - FNDX-05: AsyncStream enables chunked dispatch by coordinator

// ---------------------------------------------------------------------------
// CanonicalCard — Mirrors src/etl/types.ts CanonicalCard exactly
// ---------------------------------------------------------------------------
// Codable for JSON bridge transport. All optional fields use nil (not empty
// strings). Field names use snake_case to match the TypeScript interface so
// JSONEncoder produces keys the JS runtime expects without custom coding keys.

struct CanonicalCard: Codable, Sendable {
    let id: String
    let card_type: String       // "note" | "task" | "event" | "person" | "place" | "file" | "collection"
    let name: String
    let content: String?
    let summary: String?
    let latitude: Double?
    let longitude: Double?
    let location_name: String?
    let created_at: String      // ISO 8601
    let modified_at: String     // ISO 8601
    let due_at: String?         // ISO 8601 or nil
    let completed_at: String?   // ISO 8601 or nil
    let event_start: String?    // ISO 8601 or nil
    let event_end: String?      // ISO 8601 or nil
    let folder: String?
    let tags: [String]
    let status: String?
    let priority: Int
    let sort_order: Int
    let url: String?
    let mime_type: String?
    let is_collective: Bool
    let source: String          // "native_reminders" | "native_calendar" | "native_notes"
    let source_id: String       // Unique per adapter (calendarItemIdentifier, ZIDENTIFIER, etc.)
    let source_url: String?
    let deleted_at: String?
}

// ---------------------------------------------------------------------------
// PermissionStatus
// ---------------------------------------------------------------------------

enum PermissionStatus: Sendable {
    case granted
    case denied
    case notDetermined
    case restricted   // Parental controls, MDM, etc.
}

// ---------------------------------------------------------------------------
// NativeImportError
// ---------------------------------------------------------------------------

enum NativeImportError: Error {
    case permissionDenied
    case chunkFailed(Int)
    case encodingFailed
    case importInProgress
    case adapterError(String)
}

// ---------------------------------------------------------------------------
// NativeImportAdapter Protocol
// ---------------------------------------------------------------------------
// All native adapters conform to this. Yields [CanonicalCard] batches via
// AsyncStream. The coordinator slices batches into 200-card bridge chunks.

protocol NativeImportAdapter: Sendable {
    /// Source identifier string -- matches SourceType on JS side.
    var sourceType: String { get }

    /// Check if permission is currently granted (synchronous).
    func checkPermission() -> PermissionStatus

    /// Request permission (may show system prompt or open Settings).
    func requestPermission() async -> PermissionStatus

    /// Yield cards in batches. Adapter controls internal batch size.
    /// Coordinator slices into 200-card bridge chunks regardless.
    func fetchCards() -> AsyncStream<[CanonicalCard]>
}
