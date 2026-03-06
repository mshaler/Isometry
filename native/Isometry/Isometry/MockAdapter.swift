#if DEBUG
import Foundation

// ---------------------------------------------------------------------------
// MockAdapter — DEBUG-only Mock Adapter for Pipeline Validation
// ---------------------------------------------------------------------------
// Yields exactly 3 hardcoded CanonicalCards for end-to-end pipeline testing.
// Validates FNDX-08: cards flow from Swift adapter through bridge to DB.
//
// NOTE: This entire file is wrapped in #if DEBUG — never ships in production.

struct MockAdapter: NativeImportAdapter {
    let sourceType = "native_notes"

    func checkPermission() -> PermissionStatus {
        .granted
    }

    func requestPermission() async -> PermissionStatus {
        .granted
    }

    func fetchCards() -> AsyncStream<[CanonicalCard]> {
        AsyncStream { continuation in
            let cards: [CanonicalCard] = [
                CanonicalCard(
                    id: UUID().uuidString,
                    card_type: "note",
                    name: "Mock Note 1",
                    content: "This is a mock note from the native ETL pipeline",
                    summary: nil,
                    latitude: nil,
                    longitude: nil,
                    location_name: nil,
                    created_at: "2024-01-15T10:00:00Z",
                    modified_at: "2024-01-15T10:00:00Z",
                    due_at: nil,
                    completed_at: nil,
                    event_start: nil,
                    event_end: nil,
                    folder: "Mock Folder",
                    tags: ["mock", "test"],
                    status: nil,
                    priority: 0,
                    sort_order: 0,
                    url: nil,
                    mime_type: nil,
                    is_collective: false,
                    source: "native_notes",
                    source_id: "mock-001",
                    source_url: nil,
                    deleted_at: nil
                ),
                CanonicalCard(
                    id: UUID().uuidString,
                    card_type: "note",
                    name: "Mock Note 2",
                    content: "Second mock note",
                    summary: nil,
                    latitude: nil,
                    longitude: nil,
                    location_name: nil,
                    created_at: "2024-01-15T11:00:00Z",
                    modified_at: "2024-01-15T11:00:00Z",
                    due_at: nil,
                    completed_at: nil,
                    event_start: nil,
                    event_end: nil,
                    folder: "Mock Folder",
                    tags: [],
                    status: nil,
                    priority: 0,
                    sort_order: 1,
                    url: nil,
                    mime_type: nil,
                    is_collective: false,
                    source: "native_notes",
                    source_id: "mock-002",
                    source_url: nil,
                    deleted_at: nil
                ),
                CanonicalCard(
                    id: UUID().uuidString,
                    card_type: "note",
                    name: "Mock Note 3",
                    content: "Third mock note",
                    summary: nil,
                    latitude: nil,
                    longitude: nil,
                    location_name: nil,
                    created_at: "2024-01-15T12:00:00Z",
                    modified_at: "2024-01-15T12:00:00Z",
                    due_at: nil,
                    completed_at: nil,
                    event_start: nil,
                    event_end: nil,
                    folder: "Another Folder",
                    tags: ["test"],
                    status: nil,
                    priority: 0,
                    sort_order: 2,
                    url: nil,
                    mime_type: nil,
                    is_collective: false,
                    source: "native_notes",
                    source_id: "mock-003",
                    source_url: nil,
                    deleted_at: nil
                ),
            ]
            continuation.yield(cards)
            continuation.finish()
        }
    }
}

// ---------------------------------------------------------------------------
// LargeMockAdapter — DEBUG-only Stress Test Adapter (5,000 cards)
// ---------------------------------------------------------------------------
// Validates FNDX-05: 200-card chunked dispatch handles 5,000+ cards
// without WKWebView process termination.

struct LargeMockAdapter: NativeImportAdapter {
    let sourceType = "native_notes"

    func checkPermission() -> PermissionStatus {
        .granted
    }

    func requestPermission() async -> PermissionStatus {
        .granted
    }

    func fetchCards() -> AsyncStream<[CanonicalCard]> {
        AsyncStream { continuation in
            let batchSize = 500
            let totalCards = 5000
            let batchCount = totalCards / batchSize

            for batchIndex in 0..<batchCount {
                var batch: [CanonicalCard] = []
                batch.reserveCapacity(batchSize)

                for cardIndex in 0..<batchSize {
                    let globalIndex = batchIndex * batchSize + cardIndex
                    let paddedIndex = String(format: "%05d", globalIndex)
                    batch.append(CanonicalCard(
                        id: UUID().uuidString,
                        card_type: "note",
                        name: "Stress Card \(globalIndex)",
                        content: "Synthetic stress test card \(globalIndex)",
                        summary: nil,
                        latitude: nil,
                        longitude: nil,
                        location_name: nil,
                        created_at: "2024-01-15T10:00:00Z",
                        modified_at: "2024-01-15T10:00:00Z",
                        due_at: nil,
                        completed_at: nil,
                        event_start: nil,
                        event_end: nil,
                        folder: "Stress Test",
                        tags: [],
                        status: nil,
                        priority: 0,
                        sort_order: globalIndex,
                        url: nil,
                        mime_type: nil,
                        is_collective: false,
                        source: "native_notes",
                        source_id: "stress-\(paddedIndex)",
                        source_url: nil,
                        deleted_at: nil
                    ))
                }
                continuation.yield(batch)
            }
            continuation.finish()
        }
    }
}
#endif
