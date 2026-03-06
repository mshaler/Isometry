import Foundation

// ---------------------------------------------------------------------------
// CoreDataTimestampConverter — Apple CoreData Epoch Offset Utility
// ---------------------------------------------------------------------------
// Converts Apple CoreData timestamps (seconds since 2001-01-01 00:00:00 UTC)
// to ISO 8601 strings and Foundation Date objects.
//
// Apple's CoreData epoch is 978,307,200 seconds after Unix epoch (1970-01-01).
// Without this offset, all dates appear ~31 years too early.
//
// Requirements addressed:
//   - FNDX-03: No 31-year offset in imported dates

enum CoreDataTimestampConverter {

    // MARK: - Constants

    /// Seconds between Unix epoch (1970-01-01) and Apple/CoreData epoch (2001-01-01).
    /// This is the canonical offset Apple uses across CoreData, NSDate, and CFAbsoluteTime.
    private static let coreDataEpochOffset: TimeInterval = 978_307_200

    // MARK: - Shared Formatter

    /// ISO 8601 formatter configured for UTC with internet-standard "Z" suffix.
    /// CRITICAL: formatOptions = [.withInternetDateTime] produces the exact format
    /// TypeScript expects (e.g., "2024-01-01T00:00:00Z").
    private static let isoFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        formatter.timeZone = TimeZone(identifier: "UTC")!
        return formatter
    }()

    // MARK: - Conversion Methods

    /// Convert a CoreData timestamp to an ISO 8601 string.
    /// Returns nil for timestamps <= 0 (indicates unset/invalid in CoreData).
    static func toISO8601(_ coreDataTimestamp: Double) -> String? {
        guard let date = toDate(coreDataTimestamp) else { return nil }
        return isoFormatter.string(from: date)
    }

    /// Convert a CoreData timestamp to a Foundation Date.
    /// Returns nil for timestamps <= 0 (indicates unset/invalid in CoreData).
    static func toDate(_ coreDataTimestamp: Double) -> Date? {
        guard coreDataTimestamp > 0 else { return nil }
        let unixTimestamp = coreDataTimestamp + coreDataEpochOffset
        return Date(timeIntervalSince1970: unixTimestamp)
    }
}
