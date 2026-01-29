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

    // MARK: - PAFV Bridge Integration
    /// Sequence ID for bridge message ordering
    public var sequenceId: UInt64
    /// Last PAFV update timestamp for conflict resolution
    public var lastPAFVUpdate: Date?
    /// Serialized facet mappings (JSON) for React facet names
    public var facetMappings: String?

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
        lastSyncedAt: Date? = nil,
        sequenceId: UInt64 = 0,
        lastPAFVUpdate: Date? = nil,
        facetMappings: String? = nil
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
        self.sequenceId = sequenceId
        self.lastPAFVUpdate = lastPAFVUpdate
        self.facetMappings = facetMappings
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
        case sequenceId = "sequence_id"
        case lastPAFVUpdate = "last_pafv_update"
        case facetMappings = "facet_mappings"
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

// MARK: - PAFV Integration
extension ViewConfig {
    /// Create ViewConfig from React PAFVState
    public static func fromPAFVState(
        _ pafvState: PAFVState,
        sequenceId: UInt64,
        baseConfig: ViewConfig
    ) throws -> ViewConfig {
        // Map React mappings to native axis strings
        let xMapping = pafvState.mappings.first(where: { $0.plane == "x" })?.axis ?? "time"
        let yMapping = pafvState.mappings.first(where: { $0.plane == "y" })?.axis ?? "category"

        // Create facet mappings JSON
        let facetMappingsDict = pafvState.mappings.reduce(into: [String: String]()) { result, mapping in
            result[mapping.plane] = mapping.facet
        }

        let facetMappingsData = try JSONSerialization.data(withJSONObject: facetMappingsDict)
        let facetMappingsString = String(data: facetMappingsData, encoding: .utf8)

        // Determine origin pattern from view mode
        let originPattern = pafvState.viewMode == "grid" ? "anchor" : baseConfig.originPattern

        var newConfig = baseConfig
        newConfig.xAxisMapping = xMapping
        newConfig.yAxisMapping = yMapping
        newConfig.originPattern = originPattern
        newConfig.sequenceId = sequenceId
        newConfig.lastPAFVUpdate = Date()
        newConfig.modifiedAt = Date()
        newConfig.facetMappings = facetMappingsString

        return newConfig
    }

    /// Export ViewConfig back to React PAFV mapping format
    public func toPAFVMapping() -> [String: Any] {
        var mappings: [[String: Any]] = []

        // Add X axis mapping
        mappings.append([
            "plane": "x",
            "axis": xAxisMapping,
            "facet": extractFacetName(for: "x") ?? "default"
        ])

        // Add Y axis mapping
        mappings.append([
            "plane": "y",
            "axis": yAxisMapping,
            "facet": extractFacetName(for: "y") ?? "default"
        ])

        return [
            "mappings": mappings,
            "viewMode": originPattern == "anchor" ? "grid" : "list",
            "sequenceId": sequenceId
        ]
    }

    /// Extract facet name for a plane from stored facetMappings JSON
    private func extractFacetName(for plane: String) -> String? {
        guard let facetMappingsString = facetMappings,
              let data = facetMappingsString.data(using: .utf8),
              let mappings = try? JSONSerialization.jsonObject(with: data) as? [String: String] else {
            return nil
        }

        return mappings[plane]
    }

    /// Validate ViewConfig consistency for PAFV bridge updates
    public func validatePAFVConsistency() -> Bool {
        // Ensure axis mappings are valid LATCH values
        let validAxes = ["location", "alphabet", "time", "category", "hierarchy"]

        guard validAxes.contains(xAxisMapping),
              validAxes.contains(yAxisMapping) else {
            return false
        }

        // Ensure sequence ID is reasonable (not ancient)
        if let lastUpdate = lastPAFVUpdate {
            let timeSinceUpdate = Date().timeIntervalSince(lastUpdate)
            if timeSinceUpdate > 3600 { // 1 hour
                return false
            }
        }

        return true
    }
}

// MARK: - PAFV State Type (for bridge integration)
public struct PAFVState {
    public let mappings: [PAFVAxisMapping]
    public let viewMode: String

    public init(mappings: [PAFVAxisMapping], viewMode: String) {
        self.mappings = mappings
        self.viewMode = viewMode
    }
}

public struct PAFVAxisMapping {
    public let plane: String
    public let axis: String
    public let facet: String

    public init(plane: String, axis: String, facet: String) {
        self.plane = plane
        self.axis = axis
        self.facet = facet
    }
}