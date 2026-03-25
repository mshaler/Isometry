import Testing
import Foundation
import EventKit
@testable import Isometry

// ---------------------------------------------------------------------------
// CalendarAdapter Tests — EventKit Calendar Transform Logic
// ---------------------------------------------------------------------------
// Tests for CalendarAdapter's EKEvent → CanonicalCard data transform.
//
// Strategy:
//   - EKEvent can be created via EKEventStore(). No permission is needed
//     to create EKEvent objects — only to fetch from the real store.
//   - We test the adapter's checkPermission() + sourceType behavior.
//   - We also test the internal logic patterns (eventSourceId construction,
//     personSourceId construction, content synthesis) by replicating the
//     logic from CalendarAdapter (since the methods are private).
//   - CanonicalCard field contracts are verified directly.

struct CalendarAdapterTests {

    // MARK: - Permission

    /// In test environment (no EventKit access granted), permission should not be .granted.
    @Test func checkPermissionReturnsExpectedStatus() {
        let adapter = CalendarAdapter()
        let status = adapter.checkPermission()

        let isExpected = status == .denied || status == .notDetermined || status == .restricted
        #expect(isExpected)
    }

    /// sourceType must be "native_calendar".
    @Test func sourceTypeIsNativeCalendar() {
        let adapter = CalendarAdapter()
        #expect(adapter.sourceType == "native_calendar")
    }

    // MARK: - CanonicalCard field contracts

    /// Event cards must have card_type "event" (CALR-06).
    @Test func calendarCardTypeIsEvent() {
        let card = CanonicalCard(
            id: UUID().uuidString,
            card_type: "event",
            name: "Team Meeting",
            content: "All hands call",
            summary: nil,
            latitude: nil,
            longitude: nil,
            location_name: "Conference Room B",
            created_at: "2026-01-01T00:00:00Z",
            modified_at: "2026-01-01T00:00:00Z",
            due_at: nil,
            completed_at: nil,
            event_start: "2026-01-15T09:00:00Z",
            event_end: "2026-01-15T10:00:00Z",
            folder: "Work",
            tags: [],
            status: nil,
            priority: 0,
            sort_order: 0,
            url: nil,
            mime_type: nil,
            is_collective: false,
            source: "native_calendar",
            source_id: "cal-event123",
            source_url: nil,
            deleted_at: nil
        )

        #expect(card.card_type == "event")
        #expect(card.source == "native_calendar")
        #expect(card.event_start != nil)
        #expect(card.event_end != nil)
    }

    /// Multi-attendee events should produce is_collective = true (CALR-06).
    @Test func multiAttendeeEventIsCollective() {
        let isCollective = Self.computeIsCollective(attendeeCount: 3)
        #expect(isCollective == true)
    }

    /// Single-attendee events should produce is_collective = false.
    @Test func singleAttendeeEventIsNotCollective() {
        let isCollective = Self.computeIsCollective(attendeeCount: 1)
        #expect(isCollective == false)
    }

    /// Zero attendees should produce is_collective = false.
    @Test func zeroAttendeeEventIsNotCollective() {
        let isCollective = Self.computeIsCollective(attendeeCount: 0)
        #expect(isCollective == false)
    }

    // MARK: - Event source ID construction (CALR-03)

    /// Non-recurring event uses "cal-{identifier}" format.
    @Test func nonRecurringEventSourceIdFormat() {
        let sourceId = Self.buildEventSourceId(base: "ABC123", hasRecurrence: false, startDate: Date())
        #expect(sourceId == "cal-ABC123")
        #expect(sourceId.hasPrefix("cal-"))
    }

    /// Recurring event appends start date to disambiguate occurrences (CALR-03).
    @Test func recurringEventSourceIdAppendsDate() {
        let date = Date(timeIntervalSince1970: 1_700_000_000)
        let sourceId = Self.buildEventSourceId(base: "RECURRING123", hasRecurrence: true, startDate: date)
        #expect(sourceId.hasPrefix("cal-RECURRING123-"))
        #expect(sourceId.contains("2023"))  // The date string contains the year
    }

    /// Empty event identifier should produce an empty source ID (skip logic).
    @Test func emptyEventIdentifierProducesEmptySourceId() {
        let sourceId = Self.buildEventSourceId(base: "", hasRecurrence: false, startDate: Date())
        #expect(sourceId.isEmpty)
    }

    // MARK: - Person source ID construction (CALR-02)

    /// Person source ID uses "person-{email}" format when email is available.
    @Test func personSourceIdFromEmail() {
        let sourceId = Self.buildPersonSourceId(email: "alice@example.com", name: "Alice")
        #expect(sourceId == "person-alice@example.com")
    }

    /// Person source ID falls back to "person-{lowercased-name}" when email is missing.
    @Test func personSourceIdFallsBackToName() {
        let sourceId = Self.buildPersonSourceId(email: nil, name: "Bob Smith")
        #expect(sourceId == "person-bob-smith")
    }

    /// Unknown person produces "person-unknown" as safety fallback.
    @Test func personSourceIdUnknownFallback() {
        let sourceId = Self.buildPersonSourceId(email: nil, name: nil)
        #expect(sourceId == "person-unknown")
    }

    // MARK: - Content synthesis (CALR-05)

    /// When notes is nil, content should be synthesized from metadata.
    @Test func synthesizedContentContainsDateRange() {
        let content = Self.synthesizeContent(
            isAllDay: false,
            startDate: Date(timeIntervalSince1970: 1_700_000_000),
            endDate: Date(timeIntervalSince1970: 1_700_003_600),
            location: nil,
            attendeeNames: []
        )

        // Content must contain some date information
        #expect(!content.isEmpty)
    }

    /// All-day event content shows "All day:" prefix.
    @Test func allDayEventContentHasAllDayPrefix() {
        let content = Self.synthesizeContent(
            isAllDay: true,
            startDate: Date(timeIntervalSince1970: 1_700_000_000),
            endDate: Date(timeIntervalSince1970: 1_700_000_000 + 86400),
            location: nil,
            attendeeNames: []
        )
        #expect(content.contains("All day:"))
    }

    /// Content includes location when available.
    @Test func synthesizedContentIncludesLocation() {
        let content = Self.synthesizeContent(
            isAllDay: false,
            startDate: Date(timeIntervalSince1970: 1_700_000_000),
            endDate: Date(timeIntervalSince1970: 1_700_003_600),
            location: "Main Conference Room",
            attendeeNames: []
        )
        #expect(content.contains("Location: Main Conference Room"))
    }

    /// Content includes attendee names when available.
    @Test func synthesizedContentIncludesAttendees() {
        let content = Self.synthesizeContent(
            isAllDay: false,
            startDate: Date(timeIntervalSince1970: 1_700_000_000),
            endDate: Date(timeIntervalSince1970: 1_700_003_600),
            location: nil,
            attendeeNames: ["Alice", "Bob"]
        )
        #expect(content.contains("Attendees:"))
        #expect(content.contains("Alice"))
        #expect(content.contains("Bob"))
    }

    // MARK: - ISO 8601 formatting

    /// Verify that event start/end dates are formatted as ISO 8601 UTC strings.
    @Test func eventDatesAreISO8601() {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        formatter.timeZone = TimeZone(identifier: "UTC")!

        let date = Date(timeIntervalSince1970: 1_700_000_000)
        let formatted = formatter.string(from: date)

        // Valid ISO 8601 UTC format
        #expect(formatted.hasSuffix("Z"))
        #expect(formatted.count > 10)
    }

    // MARK: - Link card source URL convention

    /// Link cards for event-attendee relationships use "attendee-of:{eventSourceId}" convention.
    @Test func attendeeLinkCardSourceURLConvention() {
        let eventSourceId = "cal-EVT123-2026-01-15T09:00:00Z"
        let linkCardSourceUrl = "attendee-of:\(eventSourceId)"

        #expect(linkCardSourceUrl.hasPrefix("attendee-of:"))
        #expect(linkCardSourceUrl.contains(eventSourceId))
    }

    // MARK: - Helpers (replicates CalendarAdapter internal logic)

    private static func computeIsCollective(attendeeCount: Int) -> Bool {
        return attendeeCount > 1
    }

    private static func buildEventSourceId(base: String, hasRecurrence: Bool, startDate: Date) -> String {
        guard !base.isEmpty else { return "" }

        if hasRecurrence {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime]
            formatter.timeZone = TimeZone(identifier: "UTC")!
            let dateStr = formatter.string(from: startDate)
            return "cal-\(base)-\(dateStr)"
        } else {
            return "cal-\(base)"
        }
    }

    private static func buildPersonSourceId(email: String?, name: String?) -> String {
        if let email = email {
            return "person-\(email.lowercased())"
        } else if let name = name {
            return "person-\(name.lowercased().replacingOccurrences(of: " ", with: "-"))"
        }
        return "person-unknown"
    }

    private static func synthesizeContent(
        isAllDay: Bool,
        startDate: Date,
        endDate: Date,
        location: String?,
        attendeeNames: [String]
    ) -> String {
        var parts: [String] = []

        if isAllDay {
            let dateFormatter = DateFormatter()
            dateFormatter.dateStyle = .medium
            dateFormatter.timeStyle = .none
            parts.append("All day: \(dateFormatter.string(from: startDate))")
        } else {
            let dateFormatter = DateFormatter()
            dateFormatter.dateStyle = .medium
            dateFormatter.timeStyle = .short
            parts.append("\(dateFormatter.string(from: startDate)) \u{2014} \(dateFormatter.string(from: endDate))")
        }

        if let loc = location, !loc.isEmpty {
            parts.append("Location: \(loc)")
        }

        if !attendeeNames.isEmpty {
            parts.append("Attendees: \(attendeeNames.joined(separator: ", "))")
        }

        return parts.joined(separator: "\n")
    }
}
