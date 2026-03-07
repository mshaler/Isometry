import CloudKit
import os

// ---------------------------------------------------------------------------
// SyncTypes -- CKRecord Field Mapping, Queue Types, and Sync Constants
// ---------------------------------------------------------------------------
// Defines the bridge between Isometry's card/connection schema and CloudKit
// CKRecord fields. Provides Codable types for offline queue persistence.
//
// Requirements addressed:
//   - SYNC-03: Zone and record type constants for CKSyncEngine
//   - SYNC-10: PendingChange Codable type for offline queue persistence

private let syncTypesLogger = Logger(subsystem: "works.isometry.app", category: "Sync")

// MARK: - Constants

/// Sync constants for CloudKit record zone and type names.
enum SyncConstants {
    /// Single custom record zone for both Card and Connection record types.
    /// One change token tracks everything (per CONTEXT.md).
    static let zoneID = CKRecordZone.ID(zoneName: "IsometryZone")

    /// CKRecord type name for cards -- 1:1 mapping to sql.js `cards` table.
    static let cardRecordType = "Card"

    /// CKRecord type name for connections -- 1:1 mapping to sql.js `connections` table.
    static let connectionRecordType = "Connection"
}

// MARK: - CodableValue

/// Wraps CKRecord field values for JSON serialization in the offline queue.
/// Cases cover all column types in the card/connection schema.
enum CodableValue: Codable, Equatable, Sendable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)
    case null

    // MARK: Codable

    private enum CodingKeys: String, CodingKey {
        case type, value
    }

    private enum ValueType: String, Codable {
        case string, int, double, bool, null
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(ValueType.self, forKey: .type)
        switch type {
        case .string:
            self = .string(try container.decode(String.self, forKey: .value))
        case .int:
            self = .int(try container.decode(Int.self, forKey: .value))
        case .double:
            self = .double(try container.decode(Double.self, forKey: .value))
        case .bool:
            self = .bool(try container.decode(Bool.self, forKey: .value))
        case .null:
            self = .null
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .string(let v):
            try container.encode(ValueType.string, forKey: .type)
            try container.encode(v, forKey: .value)
        case .int(let v):
            try container.encode(ValueType.int, forKey: .type)
            try container.encode(v, forKey: .value)
        case .double(let v):
            try container.encode(ValueType.double, forKey: .type)
            try container.encode(v, forKey: .value)
        case .bool(let v):
            try container.encode(ValueType.bool, forKey: .type)
            try container.encode(v, forKey: .value)
        case .null:
            try container.encode(ValueType.null, forKey: .type)
        }
    }

    // MARK: Convenience Accessors

    nonisolated var stringValue: String? {
        if case .string(let v) = self { return v }
        return nil
    }

    nonisolated var intValue: Int? {
        if case .int(let v) = self { return v }
        return nil
    }

    nonisolated var doubleValue: Double? {
        if case .double(let v) = self { return v }
        return nil
    }

    nonisolated var boolValue: Bool? {
        if case .bool(let v) = self { return v }
        return nil
    }

    // MARK: Factory from Any

    /// Create a CodableValue from an Any value (e.g., from JSON deserialization).
    /// Maps Swift runtime types to the appropriate CodableValue case.
    static func from(_ value: Any) -> CodableValue {
        switch value {
        case let s as String:
            return .string(s)
        case let i as Int:
            return .int(i)
        case let d as Double:
            return .double(d)
        case let b as Bool:
            return .bool(b)
        case is NSNull:
            return .null
        default:
            // Fallback: convert to string representation
            return .string(String(describing: value))
        }
    }
}

// MARK: - PendingChange

/// Codable struct for offline queue entries. Persisted as JSON array in
/// Application Support/Isometry/sync-queue.json.
/// Survives app restart for SYNC-10 compliance.
struct PendingChange: Codable, Equatable, Sendable {
    /// UUID for deduplication
    let id: String
    /// "Card" or "Connection"
    let recordType: String
    /// Matches card.id or connection.id from sql.js
    let recordId: String
    /// "save" or "delete"
    let operation: String
    /// Field values for saves; nil for deletes
    let fields: [String: CodableValue]?
    /// When the change was queued
    let timestamp: Date
}

// MARK: - CKRecord Card Field Mapping

/// All card string column names from the schema.
private let cardStringFields: Set<String> = [
    "name", "content", "summary", "folder", "tags", "status",
    "card_type", "location_name", "url", "mime_type", "source",
    "source_id", "source_url", "created_at", "modified_at",
    "due_at", "completed_at", "event_start", "event_end", "deleted_at"
]

/// Card integer column names from the schema.
private let cardIntFields: Set<String> = [
    "priority", "sort_order", "is_collective"
]

/// Card double column names from the schema.
private let cardDoubleFields: Set<String> = [
    "latitude", "longitude", "weight"
]

extension CKRecord {

    /// Populate this CKRecord with card fields from a CodableValue dictionary.
    /// Maps each field to the appropriate CKRecordValue type based on column type.
    nonisolated func setCardFields(_ fields: [String: CodableValue]) {
        for (key, value) in fields {
            if cardStringFields.contains(key) {
                switch value {
                case .string(let s):
                    self[key] = s as CKRecordValue
                case .null:
                    self[key] = nil
                default:
                    syncTypesLogger.warning("Card field \(key) expected string, got unexpected type")
                }
            } else if cardIntFields.contains(key) {
                switch value {
                case .int(let i):
                    self[key] = i as CKRecordValue
                case .null:
                    self[key] = nil
                default:
                    syncTypesLogger.warning("Card field \(key) expected int, got unexpected type")
                }
            } else if cardDoubleFields.contains(key) {
                switch value {
                case .double(let d):
                    self[key] = d as CKRecordValue
                case .null:
                    self[key] = nil
                default:
                    syncTypesLogger.warning("Card field \(key) expected double, got unexpected type")
                }
            }
        }
    }

    /// Extract card fields from this CKRecord into a CodableValue dictionary.
    /// Reads all known card columns and wraps values in CodableValue.
    nonisolated func cardFieldsDictionary() -> [String: CodableValue] {
        var result = [String: CodableValue]()

        for key in cardStringFields {
            if let value = self[key] as? String {
                result[key] = .string(value)
            }
        }

        for key in cardIntFields {
            if let value = self[key] as? Int {
                result[key] = .int(value)
            }
        }

        for key in cardDoubleFields {
            if let value = self[key] as? Double {
                result[key] = .double(value)
            }
        }

        return result
    }

    /// Populate this CKRecord with connection fields from a CodableValue dictionary.
    /// source_id and target_id are stored as CKRecord.Reference with .deleteSelf action
    /// to match ON DELETE CASCADE in the SQL schema (per CONTEXT.md).
    nonisolated func setConnectionFields(_ fields: [String: CodableValue], zoneID: CKRecordZone.ID) {
        // source_id as CKRecord.Reference
        if let sourceId = fields["source_id"]?.stringValue {
            let sourceRecordID = CKRecord.ID(recordName: sourceId, zoneID: zoneID)
            self["source_id"] = CKRecord.Reference(
                recordID: sourceRecordID,
                action: .deleteSelf
            )
        }

        // target_id as CKRecord.Reference
        if let targetId = fields["target_id"]?.stringValue {
            let targetRecordID = CKRecord.ID(recordName: targetId, zoneID: zoneID)
            self["target_id"] = CKRecord.Reference(
                recordID: targetRecordID,
                action: .deleteSelf
            )
        }

        // label as string
        if let label = fields["label"]?.stringValue {
            self["label"] = label as CKRecordValue
        }

        // weight as double
        if let weight = fields["weight"]?.doubleValue {
            self["weight"] = weight as CKRecordValue
        }

        // via_card_id as string
        if let viaCardId = fields["via_card_id"]?.stringValue {
            self["via_card_id"] = viaCardId as CKRecordValue
        }
    }
}
