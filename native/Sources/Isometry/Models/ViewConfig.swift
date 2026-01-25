import Foundation
import GRDB

/// View configuration for SuperGrid - stores user's axis mappings and display preferences
public struct ViewConfig: Codable, Sendable, Identifiable, Hashable {
    // MARK: - Core Identity
    public let id: String
    public var name: String
    public var isDefault: Bool

    // MARK: - SuperGrid Configuration
    /// Origin pattern: "anchor" (spreadsheet) or "bipolar" (matrix)
    public var originPattern: String
    /// X-axis LATCH mapping (e.g., "time", "category", "hierarchy")
    public var xAxisMapping: String
    /// Y-axis LATCH mapping
    public var yAxisMapping: String
    /// Zoom level (0.1 to 5.0)
    public var zoomLevel: Double
    /// Pan offset X coordinate
    public var panOffsetX: Double
    /// Pan offset Y coordinate
    public var panOffsetY: Double

    // MARK: - Filter State
    /// Serialized filter configuration (JSON)
    public var filterConfig: String?

    // MARK: - Metadata
    public var createdAt: Date
    public var modifiedAt: Date
    public var lastUsedAt: Date?

    // MARK: - Sync
    public var syncVersion: Int
    public var lastSyncedAt: Date?

    // MARK: - Initialization
    public init(
        id: String = UUID().uuidString,
        name: String,
        isDefault: Bool = false,
        originPattern: String = "anchor",
        xAxisMapping: String = "time",
        yAxisMapping: String = "category",
        zoomLevel: Double = 1.0,
        panOffsetX: Double = 0.0,
        panOffsetY: Double = 0.0,
        filterConfig: String? = nil,
        createdAt: Date = Date(),
        modifiedAt: Date = Date(),
        lastUsedAt: Date? = nil,
        syncVersion: Int = 0,
        lastSyncedAt: Date? = nil
    ) {
        self.id = id
        self.name = name
        self.isDefault = isDefault
        self.originPattern = originPattern
        self.xAxisMapping = xAxisMapping
        self.yAxisMapping = yAxisMapping
        self.zoomLevel = zoomLevel
        self.panOffsetX = panOffsetX
        self.panOffsetY = panOffsetY
        self.filterConfig = filterConfig
        self.createdAt = createdAt
        self.modifiedAt = modifiedAt
        self.lastUsedAt = lastUsedAt
        self.syncVersion = syncVersion
        self.lastSyncedAt = lastSyncedAt
    }
}

// MARK: - GRDB Record Conformance
extension ViewConfig: FetchableRecord, PersistableRecord {
    public static let databaseTableName = "view_configs"

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case isDefault = "is_default"
        case originPattern = "origin_pattern"
        case xAxisMapping = "x_axis_mapping"
        case yAxisMapping = "y_axis_mapping"
        case zoomLevel = "zoom_level"
        case panOffsetX = "pan_offset_x"
        case panOffsetY = "pan_offset_y"
        case filterConfig = "filter_config"
        case createdAt = "created_at"
        case modifiedAt = "modified_at"
        case lastUsedAt = "last_used_at"
        case syncVersion = "sync_version"
        case lastSyncedAt = "last_synced_at"
    }
}

// MARK: - Defaults and Factory Methods
extension ViewConfig {
    /// Default view configuration for testing and initialization
    public static var `default`: ViewConfig {
        ViewConfig(
            name: "Default Grid",
            isDefault: true
        )
    }

    /// Eisenhower Matrix configuration
    public static var eisenhowerMatrix: ViewConfig {
        ViewConfig(
            name: "Eisenhower Matrix",
            originPattern: "bipolar",
            xAxisMapping: "hierarchy",
            yAxisMapping: "hierarchy"
        )
    }
}

// MARK: - Computed Properties
extension ViewConfig {
    /// Whether this is an Eisenhower Matrix (bipolar importance/urgency)
    public var isEisenhowerMatrix: Bool {
        return originPattern == "bipolar" &&
               xAxisMapping == "hierarchy" &&
               yAxisMapping == "hierarchy"
    }

    /// Whether this view has active filters
    public var hasFilters: Bool {
        return filterConfig != nil && filterConfig != "{}"
    }
}