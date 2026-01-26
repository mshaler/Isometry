import Foundation
import GRDB

/// GSD-based Data Catalog following Sources → Streams → Surfaces hierarchy
/// Provides registry and discovery for ETL data assets
public actor ETLDataCatalog {
    private let database: IsometryDatabase
    private let versionManager: ETLVersionManager

    public init(database: IsometryDatabase, versionManager: ETLVersionManager) {
        self.database = database
        self.versionManager = versionManager
    }

    // MARK: - Sources Management (ETL Origins)

    /// Registers a new ETL data source
    public func registerSource(_ source: ETLDataSource) async throws {
        try await database.insert(source: source)
    }

    /// Lists all available data sources
    public func getAllSources() async throws -> [ETLDataSource] {
        return try await database.getAllSources()
    }

    /// Gets sources by category (Apple ecosystem, Web APIs, etc.)
    public func getSources(by category: ETLSourceCategory) async throws -> [ETLDataSource] {
        return try await database.getSources(by: category)
    }

    /// Updates source status and health metrics
    public func updateSourceHealth(
        sourceId: String,
        status: ETLSourceStatus,
        lastSync: Date? = nil,
        errorCount: Int = 0,
        metrics: ETLSourceMetrics? = nil
    ) async throws {
        try await database.updateSourceHealth(
            sourceId: sourceId,
            status: status,
            lastSync: lastSync,
            errorCount: errorCount,
            metrics: metrics
        )
    }

    // MARK: - Streams Management (Unified Collections)

    /// Registers a new data stream (unified entity collection)
    public func registerStream(_ stream: ETLDataStream) async throws {
        try await database.insert(stream: stream)
    }

    /// Lists all available data streams
    public func getAllStreams() async throws -> [ETLDataStream] {
        return try await database.getAllStreams()
    }

    /// Gets streams by domain (People, Messages, Documents, etc.)
    public func getStreams(by domain: ETLStreamDomain) async throws -> [ETLDataStream] {
        return try await database.getStreams(by: domain)
    }

    /// Links sources to streams (many-to-many relationship)
    public func linkSourceToStream(sourceId: String, streamId: String, transformation: String? = nil) async throws {
        let mapping = ETLSourceStreamMapping(
            id: UUID(),
            sourceId: sourceId,
            streamId: streamId,
            transformation: transformation,
            createdAt: Date(),
            isActive: true
        )
        try await database.insert(sourceStreamMapping: mapping)
    }

    /// Gets stream lineage (which sources contribute to this stream)
    public func getStreamLineage(streamId: String) async throws -> [ETLStreamLineage] {
        return try await database.getStreamLineage(streamId: streamId)
    }

    // MARK: - Surfaces Management (User Views)

    /// Registers a new data surface (PAFV-projected view)
    public func registerSurface(_ surface: ETLDataSurface) async throws {
        try await database.insert(surface: surface)
    }

    /// Lists surfaces by application/use case
    public func getSurfaces(for application: String) async throws -> [ETLDataSurface] {
        return try await database.getSurfaces(for: application)
    }

    /// Gets surfaces that use a specific stream
    public func getSurfaces(using streamId: String) async throws -> [ETLDataSurface] {
        return try await database.getSurfaces(using: streamId)
    }

    // MARK: - Schema Registry

    /// Registers a schema for a stream
    public func registerSchema(_ schema: ETLStreamSchema) async throws {
        try await database.insert(schema: schema)

        // Record schema change in version manager
        try await versionManager.recordSchemaChange(
            streamId: schema.streamId,
            changeType: .addColumn,
            description: "Schema registered: \(schema.name) v\(schema.version)"
        )
    }

    /// Gets the current schema for a stream
    public func getCurrentSchema(for streamId: String) async throws -> ETLStreamSchema? {
        return try await database.getCurrentSchema(for: streamId)
    }

    /// Gets schema evolution history for a stream
    public func getSchemaHistory(for streamId: String) async throws -> [ETLStreamSchema] {
        return try await database.getSchemaHistory(for: streamId)
    }

    // MARK: - Discovery and Search

    /// Searches across all catalog entries
    public func search(query: String, scope: ETLCatalogScope = .all) async throws -> ETLCatalogSearchResults {
        let sources = scope.includesSources ? try await searchSources(query: query) : []
        let streams = scope.includesStreams ? try await searchStreams(query: query) : []
        let surfaces = scope.includesSurfaces ? try await searchSurfaces(query: query) : []

        return ETLCatalogSearchResults(
            query: query,
            sources: sources,
            streams: streams,
            surfaces: surfaces,
            totalResults: sources.count + streams.count + surfaces.count
        )
    }

    /// Gets data lineage graph for visualization
    public func getDataLineageGraph() async throws -> ETLDataLineageGraph {
        let sources = try await getAllSources()
        let streams = try await getAllStreams()
        let surfaces = try await database.getAllSurfaces()
        let mappings = try await database.getAllSourceStreamMappings()

        return ETLDataLineageGraph(
            sources: sources,
            streams: streams,
            surfaces: surfaces,
            sourceStreamMappings: mappings
        )
    }

    /// Gets catalog statistics and health overview
    public func getCatalogStats() async throws -> ETLCatalogStats {
        return ETLCatalogStats(
            sourceCount: try await database.getSourceCount(),
            streamCount: try await database.getStreamCount(),
            surfaceCount: try await database.getSurfaceCount(),
            totalNodes: try await database.getTotalNodeCount(),
            lastUpdated: Date()
        )
    }

    // MARK: - Private Search Helpers

    private func searchSources(query: String) async throws -> [ETLDataSource] {
        return try await database.searchSources(query: query)
    }

    private func searchStreams(query: String) async throws -> [ETLDataStream] {
        return try await database.searchStreams(query: query)
    }

    private func searchSurfaces(query: String) async throws -> [ETLDataSurface] {
        return try await database.searchSurfaces(query: query)
    }
}

// MARK: - Supporting Types

// Configuration for ETL data sources
public struct ETLSourceConfiguration: Codable, Sendable {
    public let settings: [String: String]  // String-only configuration
    public let flags: [String: Bool]       // Boolean flags
    public let numbers: [String: Double]   // Numeric configuration

    public init(settings: [String: String] = [:], flags: [String: Bool] = [:], numbers: [String: Double] = [:]) {
        self.settings = settings
        self.flags = flags
        self.numbers = numbers
    }
}

// Sources (ETL Origins)
public struct ETLDataSource: Codable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let description: String
    public let category: ETLSourceCategory
    public let type: ETLSourceType
    public let connectionString: String?
    public let configuration: ETLSourceConfiguration
    public let status: ETLSourceStatus
    public let healthMetrics: ETLSourceMetrics?
    public let createdAt: Date
    public let lastSync: Date?
    public let errorCount: Int
}

public enum ETLSourceCategory: String, Codable, CaseIterable, Sendable {
    case appleEcosystem = "apple_ecosystem"
    case webAPIs = "web_apis"
    case fileImports = "file_imports"
    case databases = "databases"
    case cloudServices = "cloud_services"
    case nativeCardboard = "native_cardboard"
}

public enum ETLSourceStatus: String, Codable, CaseIterable, Sendable {
    case active = "active"
    case inactive = "inactive"
    case error = "error"
    case syncing = "syncing"
    case configured = "configured"
}

public struct ETLSourceMetrics: Codable, Sendable {
    public let syncFrequencyMinutes: Int
    public let averageLatencyMs: Double
    public let successRate: Double
    public let totalRecordsProcessed: Int
    public let lastSyncDurationSeconds: Double
}

// Streams (Unified Collections)
public struct ETLDataStream: Codable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let description: String
    public let domain: ETLStreamDomain
    public let entityType: String // Node, Edge, Hybrid
    public let schemaId: String
    public let configuration: ETLStreamConfiguration
    public let status: ETLStreamStatus
    public let createdAt: Date
    public let lastUpdated: Date
    public let recordCount: Int
}

public enum ETLStreamDomain: String, Codable, CaseIterable, Sendable {
    case people = "people"
    case messages = "messages"
    case documents = "documents"
    case events = "events"
    case locations = "locations"
    case projects = "projects"
    case media = "media"
    case system = "system"
}

public enum ETLStreamStatus: String, Codable, CaseIterable, Sendable {
    case active = "active"
    case building = "building"
    case error = "error"
    case deprecated = "deprecated"
}

public struct ETLStreamConfiguration: Codable, Sendable {
    public let deduplicationEnabled: Bool
    public let autoRefresh: Bool
    public let refreshIntervalMinutes: Int?
    public let retentionDays: Int?
    public let compressionEnabled: Bool
}

// Surfaces (User Views)
public struct ETLDataSurface: Codable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let description: String
    public let application: String
    public let streamIds: [String]
    public let pafvProjection: PAFVProjection
    public let latchFilters: [String]
    public let graphTraversals: [String]
    public let refreshStrategy: SurfaceRefreshStrategy
    public let createdAt: Date
    public let lastAccessed: Date?
    public let accessCount: Int
}

public struct PAFVProjection: Codable, Sendable {
    public let planes: [String] // Spatial dimensions
    public let axes: [String]   // Organizing principles
    public let facets: [String] // Filtering dimensions
    public let values: [String] // Displayed values
}

public enum SurfaceRefreshStrategy: String, Codable, CaseIterable, Sendable {
    case realTime = "real_time"
    case onDemand = "on_demand"
    case scheduled = "scheduled"
    case cached = "cached"
}

// Schema Management
public struct ETLStreamSchema: Codable, Sendable, Identifiable {
    public let id: String
    public let streamId: String
    public let name: String
    public let version: Int
    public let schema: [ETLSchemaField]
    public let constraints: [ETLSchemaConstraint]
    public let isActive: Bool
    public let createdAt: Date
    public let deprecatedAt: Date?
}

public struct ETLSchemaField: Codable, Sendable {
    public let name: String
    public let type: String
    public let nullable: Bool
    public let defaultValue: String?
    public let description: String?
}

public struct ETLSchemaConstraint: Codable, Sendable {
    public let type: String
    public let fields: [String]
    public let expression: String
    public let description: String?
}

// Relationships and Mappings
public struct ETLSourceStreamMapping: Codable, Sendable {
    public let id: UUID
    public let sourceId: String
    public let streamId: String
    public let transformation: String?
    public let createdAt: Date
    public let isActive: Bool
}

public struct ETLStreamLineage: Codable, Sendable {
    public let streamId: String
    public let sourceId: String
    public let sourceName: String
    public let transformation: String?
    public let contributionPercentage: Double
    public let lastSync: Date?
}

// Search and Discovery
public enum ETLCatalogScope {
    case all
    case sources
    case streams
    case surfaces
    case custom(sources: Bool, streams: Bool, surfaces: Bool)

    var includesSources: Bool {
        switch self {
        case .all, .sources: return true
        case .streams, .surfaces: return false
        case .custom(let sources, _, _): return sources
        }
    }

    var includesStreams: Bool {
        switch self {
        case .all, .streams: return true
        case .sources, .surfaces: return false
        case .custom(_, let streams, _): return streams
        }
    }

    var includesSurfaces: Bool {
        switch self {
        case .all, .surfaces: return true
        case .sources, .streams: return false
        case .custom(_, _, let surfaces): return surfaces
        }
    }
}

public struct ETLCatalogSearchResults: Sendable {
    public let query: String
    public let sources: [ETLDataSource]
    public let streams: [ETLDataStream]
    public let surfaces: [ETLDataSurface]
    public let totalResults: Int
}

public struct ETLDataLineageGraph: Sendable {
    public let sources: [ETLDataSource]
    public let streams: [ETLDataStream]
    public let surfaces: [ETLDataSurface]
    public let sourceStreamMappings: [ETLSourceStreamMapping]

    /// Generates nodes for visualization (D3.js format)
    public var nodes: [LineageNode] {
        var result: [LineageNode] = []

        // Add source nodes
        result.append(contentsOf: sources.map { source in
            LineageNode(
                id: source.id,
                name: source.name,
                type: .source,
                category: source.category.rawValue,
                status: source.status.rawValue
            )
        })

        // Add stream nodes
        result.append(contentsOf: streams.map { stream in
            LineageNode(
                id: stream.id,
                name: stream.name,
                type: .stream,
                category: stream.domain.rawValue,
                status: stream.status.rawValue
            )
        })

        // Add surface nodes
        result.append(contentsOf: surfaces.map { surface in
            LineageNode(
                id: surface.id,
                name: surface.name,
                type: .surface,
                category: surface.application,
                status: "active"
            )
        })

        return result
    }

    /// Generates edges for visualization
    public var edges: [LineageEdge] {
        var result: [LineageEdge] = []

        // Add source → stream edges
        result.append(contentsOf: sourceStreamMappings.map { mapping in
            LineageEdge(
                id: "\(mapping.sourceId)-\(mapping.streamId)",
                source: mapping.sourceId,
                target: mapping.streamId,
                type: .dataFlow,
                label: mapping.transformation
            )
        })

        // Add stream → surface edges
        for surface in surfaces {
            for streamId in surface.streamIds {
                result.append(LineageEdge(
                    id: "\(streamId)-\(surface.id)",
                    source: streamId,
                    target: surface.id,
                    type: .projection,
                    label: "PAFV"
                ))
            }
        }

        return result
    }
}

public struct LineageNode: Codable, Sendable {
    public let id: String
    public let name: String
    public let type: LineageNodeType
    public let category: String
    public let status: String
}

public enum LineageNodeType: String, Codable, CaseIterable, Sendable {
    case source = "source"
    case stream = "stream"
    case surface = "surface"
}

public struct LineageEdge: Codable, Sendable {
    public let id: String
    public let source: String
    public let target: String
    public let type: LineageEdgeType
    public let label: String?
}

public enum LineageEdgeType: String, Codable, CaseIterable, Sendable {
    case dataFlow = "data_flow"
    case projection = "projection"
    case dependency = "dependency"
}

// Statistics
public struct ETLCatalogStats: Sendable {
    public let sourceCount: Int
    public let streamCount: Int
    public let surfaceCount: Int
    public let totalNodes: Int
    public let lastUpdated: Date
}