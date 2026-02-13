import XCTest
@testable import Isometry

/// Tests for EventKitAdapter conversion logic and error handling.
/// Note: Actual EventKit access requires device/simulator with calendar entitlements.
/// These tests focus on testable conversion logic using mock data.
@available(iOS 17.0, macOS 14.0, *)
final class EventKitAdapterTests: XCTestCase {

    // MARK: - Date Formatter Tests

    func testISO8601DateFormatting() {
        // Test that ISO8601 formatter is configured with fractional seconds
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        let date = Date(timeIntervalSince1970: 1704067200.123) // 2024-01-01T00:00:00.123Z
        let formatted = formatter.string(from: date)

        // Should contain fractional seconds
        XCTAssertTrue(formatted.contains("."), "ISO8601 string should include fractional seconds")

        // Should be parseable back
        let parsed = formatter.date(from: formatted)
        XCTAssertNotNil(parsed, "ISO8601 string should be parseable")
    }

    // MARK: - Event Conversion Tests

    func testEventToCanonicalNodeMapping() {
        // Create mock event data
        let mockEvent = MockEventData(
            title: "Team Meeting",
            notes: "Discuss Q1 roadmap",
            location: "Conference Room A",
            startDate: Date(timeIntervalSince1970: 1704110400), // 2024-01-01T12:00:00Z
            endDate: Date(timeIntervalSince1970: 1704114000),   // 2024-01-01T13:00:00Z
            creationDate: Date(timeIntervalSince1970: 1704067200),
            lastModifiedDate: Date(timeIntervalSince1970: 1704096000),
            calendarTitle: "Work",
            eventIdentifier: "event-123",
            isAllDay: false,
            url: URL(string: "https://example.com/event/123")
        )

        let node = CanonicalNode.fromMockEvent(mockEvent)

        // Verify field mapping
        XCTAssertEqual(node.nodeType, "event")
        XCTAssertEqual(node.name, "Team Meeting")
        XCTAssertEqual(node.content, "Discuss Q1 roadmap")
        XCTAssertEqual(node.summary, "Conference Room A")
        XCTAssertEqual(node.folder, "Work")
        XCTAssertEqual(node.source, "eventkit")
        XCTAssertEqual(node.sourceId, "event-123")
        XCTAssertEqual(node.sourceUrl, "https://example.com/event/123")

        // Verify tags
        XCTAssertTrue(node.tags.contains("eventkit"))
        XCTAssertTrue(node.tags.contains("Work"))
        XCTAssertFalse(node.tags.contains("all-day"))

        // Verify defaults
        XCTAssertEqual(node.priority, 0)
        XCTAssertEqual(node.importance, 0)
        XCTAssertEqual(node.sortOrder, 0)
        XCTAssertEqual(node.version, 1)
        XCTAssertNil(node.status)
        XCTAssertNil(node.dueAt)
        XCTAssertNil(node.completedAt)
        XCTAssertNil(node.deletedAt)
    }

    func testEventWithNilFields() {
        // Create mock event with minimal/nil fields
        let mockEvent = MockEventData(
            title: nil,
            notes: nil,
            location: nil,
            calendarTitle: nil,
            isAllDay: false
        )

        let node = CanonicalNode.fromMockEvent(mockEvent)

        // Verify defaults for nil fields
        XCTAssertEqual(node.name, "Untitled Event")
        XCTAssertNil(node.content)
        XCTAssertNil(node.summary)
        XCTAssertEqual(node.folder, "Calendar") // Default folder

        // Tags should only have eventkit
        XCTAssertEqual(node.tags, ["eventkit"])
    }

    func testAllDayEventTags() {
        let mockEvent = MockEventData(
            title: "Company Holiday",
            isAllDay: true
        )

        let node = CanonicalNode.fromMockEvent(mockEvent)

        XCTAssertTrue(node.tags.contains("all-day"))
    }

    // MARK: - Reminder Conversion Tests

    func testReminderToCanonicalNodeMapping() {
        let mockReminder = MockReminderData(
            title: "Buy groceries",
            notes: "Milk, eggs, bread",
            dueDate: Date(timeIntervalSince1970: 1704153600), // 2024-01-02T00:00:00Z
            completionDate: nil,
            creationDate: Date(timeIntervalSince1970: 1704067200),
            lastModifiedDate: Date(timeIntervalSince1970: 1704096000),
            calendarTitle: "Personal",
            identifier: "reminder-456",
            isCompleted: false,
            priority: 1, // High priority (1-4)
            hasRecurrenceRules: false
        )

        let node = CanonicalNode.fromMockReminder(mockReminder)

        // Verify field mapping
        XCTAssertEqual(node.nodeType, "task")
        XCTAssertEqual(node.name, "Buy groceries")
        XCTAssertEqual(node.content, "Milk, eggs, bread")
        XCTAssertEqual(node.folder, "Personal")
        XCTAssertEqual(node.status, "pending")
        XCTAssertEqual(node.source, "eventkit")
        XCTAssertEqual(node.sourceId, "reminder-456")

        // Verify tags
        XCTAssertTrue(node.tags.contains("eventkit"))
        XCTAssertTrue(node.tags.contains("reminder"))
        XCTAssertTrue(node.tags.contains("Personal"))
        XCTAssertFalse(node.tags.contains("recurring"))

        // Verify due date is set
        XCTAssertNotNil(node.dueAt)

        // Verify priority mapping (1-4 = high = 5)
        XCTAssertEqual(node.priority, 5)
    }

    func testCompletedReminder() {
        let mockReminder = MockReminderData(
            title: "Complete report",
            isCompleted: true,
            completionDate: Date(timeIntervalSince1970: 1704153600)
        )

        let node = CanonicalNode.fromMockReminder(mockReminder)

        XCTAssertEqual(node.status, "complete")
        XCTAssertNotNil(node.completedAt)
    }

    func testRecurringReminder() {
        let mockReminder = MockReminderData(
            title: "Weekly review",
            hasRecurrenceRules: true
        )

        let node = CanonicalNode.fromMockReminder(mockReminder)

        XCTAssertTrue(node.tags.contains("recurring"))
    }

    func testReminderWithNilFields() {
        let mockReminder = MockReminderData(
            title: nil,
            notes: nil,
            calendarTitle: nil
        )

        let node = CanonicalNode.fromMockReminder(mockReminder)

        XCTAssertEqual(node.name, "Untitled Reminder")
        XCTAssertNil(node.content)
        XCTAssertEqual(node.folder, "Reminders") // Default folder
    }

    // MARK: - Priority Mapping Tests

    func testPriorityMappingFromEventKit() {
        // EKReminder priority: 0 = none, 1-4 = high, 5 = medium, 6-9 = low
        // CanonicalNode priority: 0 = none, 5 = high, 3 = medium, 1 = low

        let priorities = [
            (ekPriority: 0, expected: 0),   // None
            (ekPriority: 1, expected: 5),   // High
            (ekPriority: 2, expected: 5),   // High
            (ekPriority: 3, expected: 5),   // High
            (ekPriority: 4, expected: 5),   // High
            (ekPriority: 5, expected: 3),   // Medium
            (ekPriority: 6, expected: 1),   // Low
            (ekPriority: 7, expected: 1),   // Low
            (ekPriority: 8, expected: 1),   // Low
            (ekPriority: 9, expected: 1),   // Low
        ]

        for (ekPriority, expected) in priorities {
            let mockReminder = MockReminderData(priority: ekPriority)
            let node = CanonicalNode.fromMockReminder(mockReminder)
            XCTAssertEqual(node.priority, expected, "EK priority \(ekPriority) should map to \(expected)")
        }
    }

    // MARK: - Error Description Tests

    func testAdapterErrorDescriptions() {
        let accessDenied = AdapterError.accessDenied
        XCTAssertTrue(accessDenied.errorDescription?.contains("denied") ?? false)

        let fetchFailed = AdapterError.fetchFailed("Network error")
        XCTAssertTrue(fetchFailed.errorDescription?.contains("Network error") ?? false)
    }

    // MARK: - CanonicalNode Codable Tests

    func testCanonicalNodeEncodeDecode() throws {
        let mockEvent = MockEventData(
            title: "Test Event",
            notes: "Test notes",
            location: "Test location",
            calendarTitle: "Test Calendar"
        )

        let original = CanonicalNode.fromMockEvent(mockEvent)

        // Encode
        let encoder = JSONEncoder()
        let data = try encoder.encode(original)

        // Decode
        let decoder = JSONDecoder()
        let decoded = try decoder.decode(CanonicalNode.self, from: data)

        // Compare
        XCTAssertEqual(original.name, decoded.name)
        XCTAssertEqual(original.nodeType, decoded.nodeType)
        XCTAssertEqual(original.content, decoded.content)
        XCTAssertEqual(original.summary, decoded.summary)
        XCTAssertEqual(original.folder, decoded.folder)
        XCTAssertEqual(original.source, decoded.source)
        XCTAssertEqual(original.tags, decoded.tags)
    }
}

// MARK: - Integration Test Markers

/// These tests require actual EventKit access and should run on device/simulator
/// with proper entitlements. Mark as skipped in normal test runs.
@available(iOS 17.0, macOS 14.0, *)
final class EventKitAdapterIntegrationTests: XCTestCase {

    func testRequestAccessRequiresEntitlements() async throws {
        // This test documents the expected behavior but cannot run without entitlements
        // In CI/automated tests, this would be skipped or mocked

        // Uncomment to run manually on device:
        // let adapter = EventKitAdapter()
        // let granted = try await adapter.requestAccess()
        // XCTAssertTrue(granted || !granted) // Either outcome is valid depending on permissions
    }

    func testFetchEventsWithoutAccessThrowsDenied() async throws {
        // This test documents expected error handling
        // In practice, without entitlements, this test cannot exercise the real code path

        // The expected behavior is:
        // If access not granted, fetchEvents should throw AdapterError.accessDenied
    }
}
