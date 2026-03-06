import Foundation
import EventKit
import os

// ---------------------------------------------------------------------------
// RemindersAdapter — EventKit-based Reminders Import
// ---------------------------------------------------------------------------
// Fetches incomplete reminders plus recently completed reminders (last 30 days)
// from macOS Reminders via EventKit. Maps each EKReminder to a CanonicalCard
// with card_type "task". List names become the folder field.
//
// Requirements addressed:
//   - RMDR-01: Import incomplete + last-30-days completed reminders
//   - RMDR-02: List name → folder field
//   - RMDR-03: Dedup via calendarItemIdentifier as source_id
//   - RMDR-04: Recurrence metadata on recurring reminders
//   - RMDR-05: Imported as task-type cards

private let logger = Logger(subsystem: "works.isometry.app", category: "RemindersAdapter")

struct RemindersAdapter: NativeImportAdapter {
    let sourceType = "native_reminders"

    // Shared ISO 8601 formatter for all date conversions.
    private static let isoFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        formatter.timeZone = TimeZone(identifier: "UTC")!
        return formatter
    }()

    // MARK: - Permission (EventKit authorization)

    func checkPermission() -> PermissionStatus {
        switch EKEventStore.authorizationStatus(for: .reminder) {
        case .fullAccess:
            return .granted
        case .authorized:
            // Pre-iOS 17 migration path
            return .granted
        case .denied:
            return .denied
        case .notDetermined:
            return .notDetermined
        case .restricted:
            return .restricted
        case .writeOnly:
            // Write-only doesn't help us read
            return .denied
        @unknown default:
            return .notDetermined
        }
    }

    func requestPermission() async -> PermissionStatus {
        let store = EKEventStore()
        do {
            let granted = try await store.requestFullAccessToReminders()
            return granted ? .granted : .denied
        } catch {
            logger.error("Reminders permission request failed: \(error.localizedDescription)")
            return .denied
        }
    }

    // MARK: - Fetch Cards

    func fetchCards() -> AsyncStream<[CanonicalCard]> {
        AsyncStream { continuation in
            let store = EKEventStore()
            let calendars = store.calendars(for: .reminder)

            guard !calendars.isEmpty else {
                logger.info("No reminder lists found")
                continuation.finish()
                return
            }

            logger.info("Found \(calendars.count) reminder lists")

            // RMDR-01: Fetch incomplete reminders
            let incompletePredicate = store.predicateForIncompleteReminders(
                withDueDateStarting: nil,
                ending: nil,
                calendars: calendars
            )

            store.fetchReminders(matching: incompletePredicate) { incompleteReminders in
                var allCards: [CanonicalCard] = []

                if let reminders = incompleteReminders {
                    logger.info("Fetched \(reminders.count) incomplete reminders")
                    let cards = reminders.compactMap { self.reminderToCard($0) }
                    allCards.append(contentsOf: cards)
                }

                // RMDR-01: Fetch recently completed (last 30 days)
                let thirtyDaysAgo = Calendar.current.date(byAdding: .day, value: -30, to: Date())!
                let completedPredicate = store.predicateForCompletedReminders(
                    withCompletionDateStarting: thirtyDaysAgo,
                    ending: Date(),
                    calendars: calendars
                )

                store.fetchReminders(matching: completedPredicate) { completedReminders in
                    if let reminders = completedReminders {
                        logger.info("Fetched \(reminders.count) completed reminders (last 30 days)")
                        let cards = reminders.compactMap { self.reminderToCard($0) }
                        allCards.append(contentsOf: cards)
                    }

                    logger.info("Total reminder cards: \(allCards.count)")
                    if !allCards.isEmpty {
                        continuation.yield(allCards)
                    }
                    continuation.finish()
                }
            }
        }
    }

    // MARK: - EKReminder → CanonicalCard

    /// Convert an EKReminder to a CanonicalCard.
    /// RMDR-03: calendarItemIdentifier is the source_id for dedup.
    /// RMDR-05: card_type is always "task".
    private func reminderToCard(_ reminder: EKReminder) -> CanonicalCard? {
        // calendarItemIdentifier is the stable dedup key (RMDR-03)
        let sourceId = reminder.calendarItemIdentifier
        guard !sourceId.isEmpty else {
            logger.warning("Reminder missing calendarItemIdentifier — skipping")
            return nil
        }

        let name = reminder.title ?? "Untitled Reminder"

        // Build content from notes + recurrence info
        var contentParts: [String] = []
        if let notes = reminder.notes, !notes.isEmpty {
            contentParts.append(notes)
        }

        // RMDR-04: Recurrence metadata
        if let rules = reminder.recurrenceRules, !rules.isEmpty {
            let ruleDescriptions = rules.map { describeRecurrence($0) }
            contentParts.append("Recurrence: " + ruleDescriptions.joined(separator: "; "))
        }

        let content = contentParts.isEmpty ? nil : contentParts.joined(separator: "\n\n")

        // Dates: EventKit provides Foundation Date objects directly
        let now = Self.isoFormatter.string(from: Date())
        let createdAt: String
        if let created = reminder.creationDate {
            createdAt = Self.isoFormatter.string(from: created)
        } else {
            createdAt = now
        }

        let modifiedAt: String
        if let modified = reminder.lastModifiedDate {
            modifiedAt = Self.isoFormatter.string(from: modified)
        } else {
            modifiedAt = createdAt
        }

        // Due date from date components
        let dueAt: String?
        if let dueDateComponents = reminder.dueDateComponents,
           let dueDate = Calendar.current.date(from: dueDateComponents) {
            dueAt = Self.isoFormatter.string(from: dueDate)
        } else {
            dueAt = nil
        }

        // Completion date
        let completedAt: String?
        if reminder.isCompleted, let completionDate = reminder.completionDate {
            completedAt = Self.isoFormatter.string(from: completionDate)
        } else {
            completedAt = nil
        }

        // RMDR-02: List name → folder
        let folder = reminder.calendar?.title

        // Status based on completion
        let status: String? = reminder.isCompleted ? "done" : "active"

        // Priority: EventKit uses 0 (none), 1 (high), 5 (medium), 9 (low)
        // Map to our 0-based priority (0=none, 1=low, 2=medium, 3=high)
        let priority: Int
        switch reminder.priority {
        case 1...4:   priority = 3  // High
        case 5:       priority = 2  // Medium
        case 6...9:   priority = 1  // Low
        default:      priority = 0  // None
        }

        // Location: check alarms for location-based reminders
        let latitude: Double?
        let longitude: Double?
        let locationName: String?
        if let alarm = reminder.alarms?.first(where: { $0.structuredLocation != nil }),
           let structured = alarm.structuredLocation,
           let geoLocation = structured.geoLocation {
            latitude = geoLocation.coordinate.latitude
            longitude = geoLocation.coordinate.longitude
            locationName = structured.title
        } else {
            latitude = nil
            longitude = nil
            locationName = nil
        }

        // URL
        let url = reminder.url?.absoluteString

        return CanonicalCard(
            id: UUID().uuidString,
            card_type: "task",  // RMDR-05
            name: name,
            content: content,
            summary: nil,
            latitude: latitude,
            longitude: longitude,
            location_name: locationName,
            created_at: createdAt,
            modified_at: modifiedAt,
            due_at: dueAt,
            completed_at: completedAt,
            event_start: nil,
            event_end: nil,
            folder: folder,  // RMDR-02
            tags: [],
            status: status,
            priority: priority,
            sort_order: 0,
            url: url,
            mime_type: nil,
            is_collective: false,
            source: "native_reminders",
            source_id: sourceId,  // RMDR-03
            source_url: nil,
            deleted_at: nil
        )
    }

    // MARK: - Recurrence Description (RMDR-04)

    /// Produce a human-readable recurrence string for card content.
    private func describeRecurrence(_ rule: EKRecurrenceRule) -> String {
        let freq: String
        switch rule.frequency {
        case .daily:   freq = "daily"
        case .weekly:  freq = "weekly"
        case .monthly: freq = "monthly"
        case .yearly:  freq = "yearly"
        @unknown default: freq = "recurring"
        }

        let interval = rule.interval
        if interval == 1 {
            return freq.capitalized
        } else {
            return "Every \(interval) \(freq)"
        }
    }
}
