import EventKit
import Foundation

// Note: Uses CanonicalNode from Bridge/CanonicalNode.swift
// The CanonicalNode type was consolidated there per 71-01-PLAN.md

// MARK: - Adapter Errors

/// Errors that can occur during native adapter operations
public enum AdapterError: Error, LocalizedError {
    case accessDenied
    case fetchFailed(String)

    public var errorDescription: String? {
        switch self {
        case .accessDenied:
            return "Access to calendar or reminders was denied. Please enable access in Settings."
        case .fetchFailed(let reason):
            return "Failed to fetch data: \(reason)"
        }
    }
}

// MARK: - EventKitAdapter

/// Actor-based adapter for fetching calendar events and reminders from EventKit
/// and converting them to CanonicalNode format for SuperGrid visualization.
///
/// Usage:
/// ```swift
/// let adapter = EventKitAdapter()
/// let granted = try await adapter.requestAccess()
/// if granted {
///     let events = try await adapter.fetchEvents(
///         from: Date(),
///         to: Date().addingTimeInterval(86400 * 30) // Next 30 days
///     )
/// }
/// ```
@available(iOS 17.0, macOS 14.0, *)
public actor EventKitAdapter {
    private let eventStore = EKEventStore()
    private let dateFormatter: ISO8601DateFormatter

    public init() {
        dateFormatter = ISO8601DateFormatter()
        dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    }

    // MARK: - Access Control

    /// Request full access to calendar events (iOS 17+)
    /// - Returns: Boolean indicating whether access was granted
    /// - Throws: Error if the request fails
    public func requestAccess() async throws -> Bool {
        try await eventStore.requestFullAccessToEvents()
    }

    /// Request full access to reminders (iOS 17+)
    /// - Returns: Boolean indicating whether access was granted
    /// - Throws: Error if the request fails
    public func requestRemindersAccess() async throws -> Bool {
        try await eventStore.requestFullAccessToReminders()
    }

    // MARK: - Fetch Events

    /// Fetch calendar events within a date range and convert to CanonicalNode format.
    /// - Parameters:
    ///   - from: Start date of the range
    ///   - to: End date of the range
    /// - Returns: Array of CanonicalNode representing calendar events
    /// - Throws: AdapterError.accessDenied if not authorized, AdapterError.fetchFailed on error
    public func fetchEvents(from startDate: Date, to endDate: Date) async throws -> [CanonicalNode] {
        // Check authorization status
        let status = EKEventStore.authorizationStatus(for: .event)
        guard status == .fullAccess else {
            throw AdapterError.accessDenied
        }

        // Create predicate for all calendars in date range
        let predicate = eventStore.predicateForEvents(
            withStart: startDate,
            end: endDate,
            calendars: nil
        )

        // Fetch events (synchronous, thread-safe)
        let events = eventStore.events(matching: predicate)

        // Convert to CanonicalNode array
        return events.map { event in
            convertEventToNode(event)
        }
    }

    /// Fetch incomplete reminders and convert to CanonicalNode format.
    /// - Returns: Array of CanonicalNode representing incomplete reminders
    /// - Throws: AdapterError.accessDenied if not authorized, AdapterError.fetchFailed on error
    public func fetchReminders() async throws -> [CanonicalNode] {
        // Check authorization status
        let status = EKEventStore.authorizationStatus(for: .reminder)
        guard status == .fullAccess else {
            throw AdapterError.accessDenied
        }

        // Create predicate for incomplete reminders
        let predicate = eventStore.predicateForIncompleteReminders(
            withDueDateStarting: nil,
            ending: nil,
            calendars: nil
        )

        // Fetch reminders using continuation wrapper (async bridge for callback API)
        let reminders = try await withCheckedThrowingContinuation { continuation in
            eventStore.fetchReminders(matching: predicate) { reminders in
                if let reminders = reminders {
                    continuation.resume(returning: reminders)
                } else {
                    continuation.resume(throwing: AdapterError.fetchFailed("Unable to fetch reminders"))
                }
            }
        }

        // Convert to CanonicalNode array
        return reminders.map { reminder in
            convertReminderToNode(reminder)
        }
    }

    // MARK: - Conversion Helpers

    /// Convert EKEvent to CanonicalNode
    private func convertEventToNode(_ event: EKEvent) -> CanonicalNode {
        let now = Date()

        return CanonicalNode(
            id: UUID().uuidString,
            nodeType: "event",
            name: event.title ?? "Untitled Event",
            content: event.notes,
            summary: event.location,
            createdAt: dateFormatter.string(from: event.creationDate ?? now),
            modifiedAt: dateFormatter.string(from: event.lastModifiedDate ?? now),
            dueAt: nil,
            completedAt: nil,
            eventStart: dateFormatter.string(from: event.startDate),
            eventEnd: dateFormatter.string(from: event.endDate),
            folder: event.calendar?.title ?? "Calendar",
            tags: buildEventTags(event),
            status: nil,
            priority: 0,
            importance: 0,
            sortOrder: 0,
            source: "eventkit",
            sourceId: event.eventIdentifier,
            sourceUrl: event.url?.absoluteString,
            deletedAt: nil,
            version: 1,
            properties: nil
        )
    }

    /// Convert EKReminder to CanonicalNode
    private func convertReminderToNode(_ reminder: EKReminder) -> CanonicalNode {
        let now = Date()

        return CanonicalNode(
            id: UUID().uuidString,
            nodeType: "task",
            name: reminder.title ?? "Untitled Reminder",
            content: reminder.notes,
            summary: nil,
            createdAt: dateFormatter.string(from: reminder.creationDate ?? now),
            modifiedAt: dateFormatter.string(from: reminder.lastModifiedDate ?? now),
            dueAt: formatDueDateComponents(reminder.dueDateComponents),
            completedAt: reminder.completionDate.map { dateFormatter.string(from: $0) },
            eventStart: nil,
            eventEnd: nil,
            folder: reminder.calendar?.title ?? "Reminders",
            tags: buildReminderTags(reminder),
            status: reminder.isCompleted ? "complete" : "pending",
            priority: mapPriority(reminder.priority),
            importance: 0,
            sortOrder: 0,
            source: "eventkit",
            sourceId: reminder.calendarItemIdentifier,
            sourceUrl: reminder.url?.absoluteString,
            deletedAt: nil,
            version: 1,
            properties: nil
        )
    }

    /// Build tags array for an event
    private func buildEventTags(_ event: EKEvent) -> [String] {
        var tags = ["eventkit"]
        if let calendarTitle = event.calendar?.title {
            tags.append(calendarTitle)
        }
        if event.isAllDay {
            tags.append("all-day")
        }
        return tags
    }

    /// Build tags array for a reminder
    private func buildReminderTags(_ reminder: EKReminder) -> [String] {
        var tags = ["eventkit", "reminder"]
        if let calendarTitle = reminder.calendar?.title {
            tags.append(calendarTitle)
        }
        if reminder.hasRecurrenceRules {
            tags.append("recurring")
        }
        return tags
    }

    /// Format DateComponents to ISO8601 string
    private func formatDueDateComponents(_ components: DateComponents?) -> String? {
        guard let components = components,
              let date = Calendar.current.date(from: components) else {
            return nil
        }
        return dateFormatter.string(from: date)
    }

    /// Map EKReminder priority (0-9) to CanonicalNode priority (0-5)
    /// EKReminder: 0 = none, 1-4 = high, 5 = medium, 6-9 = low
    private func mapPriority(_ ekPriority: Int) -> Int {
        switch ekPriority {
        case 0:
            return 0  // None
        case 1...4:
            return 5  // High
        case 5:
            return 3  // Medium
        case 6...9:
            return 1  // Low
        default:
            return 0
        }
    }
}

// MARK: - Testing Support

/// Helper struct for testing event-to-node conversion without actual EventKit
/// This allows unit tests to validate field mapping logic.
public struct MockEventData: Sendable {
    public let title: String?
    public let notes: String?
    public let location: String?
    public let startDate: Date
    public let endDate: Date
    public let creationDate: Date?
    public let lastModifiedDate: Date?
    public let calendarTitle: String?
    public let eventIdentifier: String
    public let isAllDay: Bool
    public let url: URL?

    public init(
        title: String? = nil,
        notes: String? = nil,
        location: String? = nil,
        startDate: Date = Date(),
        endDate: Date = Date().addingTimeInterval(3600),
        creationDate: Date? = nil,
        lastModifiedDate: Date? = nil,
        calendarTitle: String? = nil,
        eventIdentifier: String = UUID().uuidString,
        isAllDay: Bool = false,
        url: URL? = nil
    ) {
        self.title = title
        self.notes = notes
        self.location = location
        self.startDate = startDate
        self.endDate = endDate
        self.creationDate = creationDate
        self.lastModifiedDate = lastModifiedDate
        self.calendarTitle = calendarTitle
        self.eventIdentifier = eventIdentifier
        self.isAllDay = isAllDay
        self.url = url
    }
}

/// Helper struct for testing reminder-to-node conversion
public struct MockReminderData: Sendable {
    public let title: String?
    public let notes: String?
    public let dueDate: Date?
    public let completionDate: Date?
    public let creationDate: Date?
    public let lastModifiedDate: Date?
    public let calendarTitle: String?
    public let identifier: String
    public let isCompleted: Bool
    public let priority: Int
    public let hasRecurrenceRules: Bool
    public let url: URL?

    public init(
        title: String? = nil,
        notes: String? = nil,
        dueDate: Date? = nil,
        completionDate: Date? = nil,
        creationDate: Date? = nil,
        lastModifiedDate: Date? = nil,
        calendarTitle: String? = nil,
        identifier: String = UUID().uuidString,
        isCompleted: Bool = false,
        priority: Int = 0,
        hasRecurrenceRules: Bool = false,
        url: URL? = nil
    ) {
        self.title = title
        self.notes = notes
        self.dueDate = dueDate
        self.completionDate = completionDate
        self.creationDate = creationDate
        self.lastModifiedDate = lastModifiedDate
        self.calendarTitle = calendarTitle
        self.identifier = identifier
        self.isCompleted = isCompleted
        self.priority = priority
        self.hasRecurrenceRules = hasRecurrenceRules
        self.url = url
    }
}

// MARK: - Event Conversion Testing

/// Extension for converting mock data to CanonicalNode for testing
public extension CanonicalNode {
    /// Create a CanonicalNode from MockEventData for testing
    static func fromMockEvent(_ mock: MockEventData) -> CanonicalNode {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let now = Date()

        var tags = ["eventkit"]
        if let calendarTitle = mock.calendarTitle {
            tags.append(calendarTitle)
        }
        if mock.isAllDay {
            tags.append("all-day")
        }

        return CanonicalNode(
            id: UUID().uuidString,
            nodeType: "event",
            name: mock.title ?? "Untitled Event",
            content: mock.notes,
            summary: mock.location,
            createdAt: formatter.string(from: mock.creationDate ?? now),
            modifiedAt: formatter.string(from: mock.lastModifiedDate ?? now),
            dueAt: nil,
            completedAt: nil,
            eventStart: formatter.string(from: mock.startDate),
            eventEnd: formatter.string(from: mock.endDate),
            folder: mock.calendarTitle ?? "Calendar",
            tags: tags,
            status: nil,
            priority: 0,
            importance: 0,
            sortOrder: 0,
            source: "eventkit",
            sourceId: mock.eventIdentifier,
            sourceUrl: mock.url?.absoluteString,
            deletedAt: nil,
            version: 1,
            properties: nil
        )
    }

    /// Create a CanonicalNode from MockReminderData for testing
    static func fromMockReminder(_ mock: MockReminderData) -> CanonicalNode {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let now = Date()

        var tags = ["eventkit", "reminder"]
        if let calendarTitle = mock.calendarTitle {
            tags.append(calendarTitle)
        }
        if mock.hasRecurrenceRules {
            tags.append("recurring")
        }

        // Map priority
        let mappedPriority: Int
        switch mock.priority {
        case 0:
            mappedPriority = 0
        case 1...4:
            mappedPriority = 5
        case 5:
            mappedPriority = 3
        case 6...9:
            mappedPriority = 1
        default:
            mappedPriority = 0
        }

        return CanonicalNode(
            id: UUID().uuidString,
            nodeType: "task",
            name: mock.title ?? "Untitled Reminder",
            content: mock.notes,
            summary: nil,
            createdAt: formatter.string(from: mock.creationDate ?? now),
            modifiedAt: formatter.string(from: mock.lastModifiedDate ?? now),
            dueAt: mock.dueDate.map { formatter.string(from: $0) },
            completedAt: mock.completionDate.map { formatter.string(from: $0) },
            eventStart: nil,
            eventEnd: nil,
            folder: mock.calendarTitle ?? "Reminders",
            tags: tags,
            status: mock.isCompleted ? "complete" : "pending",
            priority: mappedPriority,
            importance: 0,
            sortOrder: 0,
            source: "eventkit",
            sourceId: mock.identifier,
            sourceUrl: mock.url?.absoluteString,
            deletedAt: nil,
            version: 1,
            properties: nil
        )
    }
}
