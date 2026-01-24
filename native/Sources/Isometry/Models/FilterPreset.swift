import Foundation
import GRDB

/// Saved filter configuration that can be reused across sessions
public struct FilterPreset: Codable, Sendable, Identifiable, Hashable {
    // MARK: - Core Identity
    public let id: String
    public var name: String
    public var isDefault: Bool

    // MARK: - Filter Configuration
    /// Serialized filter state (JSON matching React FilterContext)
    public var filterConfig: String
    /// Human-readable description of active filters
    public var description: String?
    /// Icon name for preset (SF Symbols)
    public var iconName: String?

    // MARK: - Usage Statistics
    /// Number of times this preset has been applied
    public var usageCount: Int
    /// Last time this preset was used
    public var lastUsedAt: Date?

    // MARK: - Metadata
    public var createdAt: Date
    public var modifiedAt: Date

    // MARK: - Sync
    public var syncVersion: Int
    public var lastSyncedAt: Date?

    // MARK: - Initialization
    public init(
        id: String = UUID().uuidString,
        name: String,
        isDefault: Bool = false,
        filterConfig: String,
        description: String? = nil,
        iconName: String? = nil,
        usageCount: Int = 0,
        lastUsedAt: Date? = nil,
        createdAt: Date = Date(),
        modifiedAt: Date = Date(),
        syncVersion: Int = 0,
        lastSyncedAt: Date? = nil
    ) {
        self.id = id
        self.name = name
        self.isDefault = isDefault
        self.filterConfig = filterConfig
        self.description = description
        self.iconName = iconName
        self.usageCount = usageCount
        self.lastUsedAt = lastUsedAt
        self.createdAt = createdAt
        self.modifiedAt = modifiedAt
        self.syncVersion = syncVersion
        self.lastSyncedAt = lastSyncedAt
    }
}

// MARK: - GRDB Record Conformance
extension FilterPreset: FetchableRecord, PersistableRecord {
    public static let databaseTableName = "filter_presets"

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case isDefault = "is_default"
        case filterConfig = "filter_config"
        case description
        case iconName = "icon_name"
        case usageCount = "usage_count"
        case lastUsedAt = "last_used_at"
        case createdAt = "created_at"
        case modifiedAt = "modified_at"
        case syncVersion = "sync_version"
        case lastSyncedAt = "last_synced_at"
    }
}

// MARK: - Computed Properties
extension FilterPreset {
    /// Decoded filter configuration as dictionary
    public var decodedConfig: [String: Any]? {
        guard let data = filterConfig.data(using: .utf8) else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }

    /// Whether this preset is frequently used (>5 uses)
    public var isFrequentlyUsed: Bool {
        return usageCount >= 5
    }

    /// Relative usage frequency description
    public var usageFrequency: String {
        switch usageCount {
        case 0:
            return "Never used"
        case 1...2:
            return "Rarely used"
        case 3...10:
            return "Sometimes used"
        case 11...50:
            return "Frequently used"
        default:
            return "Very frequently used"
        }
    }
}