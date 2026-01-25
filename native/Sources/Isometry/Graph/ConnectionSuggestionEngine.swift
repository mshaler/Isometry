import Foundation
import GRDB

/// Connection suggestion for linking nodes based on graph analysis
public struct ConnectionSuggestion: Identifiable, Sendable {
    public let id = UUID()
    public let nodeId: String
    public let reason: String
    public let confidence: Double
    public let type: SuggestionType

    public enum SuggestionType: String, Codable, CaseIterable, Sendable {
        case similarContent = "similar_content"
        case sameCommunity = "same_community"
        case sharedTags = "shared_tags"
        case mutualConnections = "mutual_connections"
        case temporalProximity = "temporal_proximity"
        case semanticSimilarity = "semantic_similarity"
    }

    public init(nodeId: String, reason: String, confidence: Double, type: SuggestionType) {
        self.nodeId = nodeId
        self.reason = reason
        self.confidence = confidence
        self.type = type
    }
}

/// Configuration options for connection suggestions
public struct SuggestionOptions {
    public let maxSuggestions: Int
    public let minConfidence: Double
    public let includeTypes: [ConnectionSuggestion.SuggestionType]
    public let excludeExistingConnections: Bool

    public init(
        maxSuggestions: Int = 10,
        minConfidence: Double = 0.3,
        includeTypes: [ConnectionSuggestion.SuggestionType] = ConnectionSuggestion.SuggestionType.allCases,
        excludeExistingConnections: Bool = true
    ) {
        self.maxSuggestions = maxSuggestions
        self.minConfidence = minConfidence
        self.includeTypes = includeTypes
        self.excludeExistingConnections = excludeExistingConnections
    }
}

/// Connection suggestion engine for graph analytics
/// Implements intelligent connection discovery from CardBoard v1/v2
public actor ConnectionSuggestionEngine {
    private let database: IsometryDatabase

    public init(database: IsometryDatabase) {
        self.database = database
    }

    // MARK: - Public API

    /// Generate connection suggestions for a specific node
    public func suggestConnections(
        for nodeId: String,
        options: SuggestionOptions = SuggestionOptions()
    ) async throws -> [ConnectionSuggestion] {
        var allSuggestions: [ConnectionSuggestion] = []

        // Collect suggestions from each enabled type
        if options.includeTypes.contains(.sharedTags) {
            let tagSuggestions = try await findSharedTagConnections(nodeId: nodeId)
            allSuggestions.append(contentsOf: tagSuggestions)
        }

        if options.includeTypes.contains(.sameCommunity) {
            let communitySuggestions = try await findCommunityConnections(nodeId: nodeId)
            allSuggestions.append(contentsOf: communitySuggestions)
        }

        if options.includeTypes.contains(.mutualConnections) {
            let mutualSuggestions = try await findMutualConnections(nodeId: nodeId)
            allSuggestions.append(contentsOf: mutualSuggestions)
        }

        if options.includeTypes.contains(.temporalProximity) {
            let temporalSuggestions = try await findTemporalProximityConnections(nodeId: nodeId)
            allSuggestions.append(contentsOf: temporalSuggestions)
        }

        if options.includeTypes.contains(.similarContent) {
            let contentSuggestions = try await findSimilarContentConnections(nodeId: nodeId)
            allSuggestions.append(contentsOf: contentSuggestions)
        }

        // Filter existing connections if requested
        if options.excludeExistingConnections {
            let existingConnections = try await getExistingConnections(for: nodeId)
            allSuggestions = allSuggestions.filter { suggestion in
                !existingConnections.contains(suggestion.nodeId)
            }
        }

        // Deduplicate and sort by confidence
        let deduped = deduplicateSuggestions(allSuggestions)
        let filtered = deduped.filter { $0.confidence >= options.minConfidence }
        let sorted = filtered.sorted { $0.confidence > $1.confidence }

        return Array(sorted.prefix(options.maxSuggestions))
    }

    /// Get connection suggestions for multiple nodes efficiently
    public func batchSuggestConnections(
        for nodeIds: [String],
        options: SuggestionOptions = SuggestionOptions()
    ) async throws -> [String: [ConnectionSuggestion]] {
        var results: [String: [ConnectionSuggestion]] = [:]

        for nodeId in nodeIds {
            let suggestions = try await suggestConnections(for: nodeId, options: options)
            results[nodeId] = suggestions
        }

        return results
    }

    // MARK: - Shared Tags Analysis

    private func findSharedTagConnections(nodeId: String) async throws -> [ConnectionSuggestion] {
        let query = """
        WITH node_tags AS (
            SELECT json_each.value as tag
            FROM nodes, json_each(nodes.tags)
            WHERE nodes.id = ? AND nodes.deleted_at IS NULL
        ),
        matching_nodes AS (
            SELECT
                n.id,
                n.name,
                COUNT(*) as shared_count,
                GROUP_CONCAT(DISTINCT t.value, ', ') as shared_tags
            FROM nodes n, json_each(n.tags) as t
            WHERE n.id != ?
                AND n.deleted_at IS NULL
                AND t.value IN (SELECT tag FROM node_tags)
            GROUP BY n.id, n.name
            HAVING shared_count > 0
        )
        SELECT id, name, shared_count, shared_tags
        FROM matching_nodes
        ORDER BY shared_count DESC
        LIMIT 10
        """

        return try await database.read { db in
            let rows = try Row.fetchAll(db, sql: query, arguments: [nodeId, nodeId])
            return rows.map { row in
                let sharedCount: Int = row["shared_count"]
                let sharedTags: String = row["shared_tags"] ?? ""
                let confidence = min(0.8, 0.2 + Double(sharedCount) * 0.15)

                return ConnectionSuggestion(
                    nodeId: row["id"],
                    reason: "Shares \(sharedCount) tag(s): \(sharedTags)",
                    confidence: confidence,
                    type: .sharedTags
                )
            }
        }
    }

    // MARK: - Community Analysis

    private func findCommunityConnections(nodeId: String) async throws -> [ConnectionSuggestion] {
        // First, find nodes that share connections with the target node
        let query = """
        WITH target_connections AS (
            SELECT DISTINCT
                CASE WHEN source_id = ? THEN target_id ELSE source_id END as connected_id
            FROM edges
            WHERE (source_id = ? OR target_id = ?)
                AND deleted_at IS NULL
        ),
        community_nodes AS (
            SELECT DISTINCT
                CASE WHEN e.source_id IN (SELECT connected_id FROM target_connections)
                     THEN e.target_id ELSE e.source_id END as candidate_id,
                COUNT(DISTINCT CASE WHEN e.source_id IN (SELECT connected_id FROM target_connections)
                               THEN e.source_id ELSE e.target_id END) as mutual_count
            FROM edges e
            WHERE e.deleted_at IS NULL
                AND (e.source_id IN (SELECT connected_id FROM target_connections)
                     OR e.target_id IN (SELECT connected_id FROM target_connections))
                AND e.source_id != ? AND e.target_id != ?
                AND CASE WHEN e.source_id IN (SELECT connected_id FROM target_connections)
                         THEN e.target_id ELSE e.source_id END != ?
            GROUP BY candidate_id
            HAVING mutual_count >= 2
        )
        SELECT
            cn.candidate_id as id,
            n.name,
            cn.mutual_count
        FROM community_nodes cn
        JOIN nodes n ON n.id = cn.candidate_id
        WHERE n.deleted_at IS NULL
        ORDER BY cn.mutual_count DESC
        LIMIT 5
        """

        return try await database.read { db in
            let rows = try Row.fetchAll(db, sql: query, arguments: [nodeId, nodeId, nodeId, nodeId, nodeId, nodeId])
            return rows.map { row in
                let mutualCount: Int = row["mutual_count"]
                let confidence = min(0.7, 0.3 + Double(mutualCount) * 0.1)

                return ConnectionSuggestion(
                    nodeId: row["id"],
                    reason: "Same community (\(mutualCount) mutual connections)",
                    confidence: confidence,
                    type: .sameCommunity
                )
            }
        }
    }

    // MARK: - Mutual Connections Analysis

    private func findMutualConnections(nodeId: String) async throws -> [ConnectionSuggestion] {
        let query = """
        WITH my_connections AS (
            SELECT DISTINCT
                CASE WHEN source_id = ? THEN target_id ELSE source_id END as connected_id
            FROM edges
            WHERE (source_id = ? OR target_id = ?)
                AND deleted_at IS NULL
        ),
        mutual_candidates AS (
            SELECT
                CASE WHEN e.source_id IN (SELECT connected_id FROM my_connections)
                     THEN e.target_id ELSE e.source_id END as candidate_id,
                COUNT(*) as mutual_count,
                GROUP_CONCAT(DISTINCT
                    CASE WHEN e.source_id IN (SELECT connected_id FROM my_connections)
                         THEN e.source_id ELSE e.target_id END, ', ') as mutual_nodes
            FROM edges e
            WHERE e.deleted_at IS NULL
                AND (e.source_id IN (SELECT connected_id FROM my_connections)
                     OR e.target_id IN (SELECT connected_id FROM my_connections))
                AND e.source_id != ? AND e.target_id != ?
                AND CASE WHEN e.source_id IN (SELECT connected_id FROM my_connections)
                         THEN e.target_id ELSE e.source_id END
                    NOT IN (SELECT connected_id FROM my_connections UNION SELECT ?)
            GROUP BY candidate_id
            HAVING mutual_count > 0
        )
        SELECT
            mc.candidate_id as id,
            n.name,
            mc.mutual_count,
            mc.mutual_nodes
        FROM mutual_candidates mc
        JOIN nodes n ON n.id = mc.candidate_id
        WHERE n.deleted_at IS NULL
        ORDER BY mc.mutual_count DESC
        LIMIT 8
        """

        return try await database.read { db in
            let rows = try Row.fetchAll(db, sql: query, arguments: [nodeId, nodeId, nodeId, nodeId, nodeId, nodeId])
            return rows.map { row in
                let mutualCount: Int = row["mutual_count"]
                let confidence = min(0.6, 0.2 + Double(mutualCount) * 0.1)

                return ConnectionSuggestion(
                    nodeId: row["id"],
                    reason: "\(mutualCount) mutual connection(s)",
                    confidence: confidence,
                    type: .mutualConnections
                )
            }
        }
    }

    // MARK: - Temporal Proximity Analysis

    private func findTemporalProximityConnections(nodeId: String) async throws -> [ConnectionSuggestion] {
        let query = """
        WITH target_node AS (
            SELECT created_at, modified_at, folder
            FROM nodes
            WHERE id = ? AND deleted_at IS NULL
        ),
        temporal_candidates AS (
            SELECT
                n.id,
                n.name,
                n.created_at,
                n.modified_at,
                ABS(julianday(n.created_at) - julianday(t.created_at)) as creation_diff_days,
                ABS(julianday(n.modified_at) - julianday(t.modified_at)) as modified_diff_days,
                CASE WHEN n.folder = t.folder THEN 1 ELSE 0 END as same_folder
            FROM nodes n
            CROSS JOIN target_node t
            WHERE n.id != ?
                AND n.deleted_at IS NULL
                AND (
                    ABS(julianday(n.created_at) - julianday(t.created_at)) <= 7 OR
                    ABS(julianday(n.modified_at) - julianday(t.modified_at)) <= 3
                )
        )
        SELECT
            id,
            name,
            creation_diff_days,
            modified_diff_days,
            same_folder,
            CASE
                WHEN creation_diff_days <= 1 THEN 'created same day'
                WHEN creation_diff_days <= 7 THEN 'created same week'
                WHEN modified_diff_days <= 1 THEN 'modified same day'
                ELSE 'modified recently'
            END as proximity_reason
        FROM temporal_candidates
        WHERE creation_diff_days <= 7 OR modified_diff_days <= 3
        ORDER BY
            same_folder DESC,
            LEAST(creation_diff_days, modified_diff_days) ASC
        LIMIT 6
        """

        return try await database.read { db in
            let rows = try Row.fetchAll(db, sql: query, arguments: [nodeId, nodeId])
            return rows.map { row in
                let creationDiff: Double = row["creation_diff_days"]
                let modifiedDiff: Double = row["modified_diff_days"]
                let sameFolder: Int = row["same_folder"]
                let proximityReason: String = row["proximity_reason"]

                // Calculate confidence based on temporal proximity and folder similarity
                let timeFactor = 1.0 / (1.0 + min(creationDiff, modifiedDiff))
                let folderBonus = sameFolder == 1 ? 0.2 : 0.0
                let confidence = min(0.5, 0.1 + timeFactor * 0.3 + folderBonus)

                return ConnectionSuggestion(
                    nodeId: row["id"],
                    reason: "Temporal proximity (\(proximityReason))",
                    confidence: confidence,
                    type: .temporalProximity
                )
            }
        }
    }

    // MARK: - Content Similarity Analysis

    private func findSimilarContentConnections(nodeId: String) async throws -> [ConnectionSuggestion] {
        let query = """
        WITH target_node AS (
            SELECT name, content, folder
            FROM nodes
            WHERE id = ? AND deleted_at IS NULL
        ),
        content_candidates AS (
            SELECT
                n.id,
                n.name,
                n.content,
                LENGTH(n.name) as name_length,
                LENGTH(n.content) as content_length,
                CASE WHEN n.folder = t.folder THEN 1 ELSE 0 END as same_folder
            FROM nodes n
            CROSS JOIN target_node t
            WHERE n.id != ?
                AND n.deleted_at IS NULL
                AND (
                    -- Similar name length (within 50% difference)
                    ABS(LENGTH(n.name) - LENGTH(t.name)) <= (LENGTH(t.name) * 0.5) OR
                    -- Same folder
                    n.folder = t.folder OR
                    -- Similar content length (within 30% difference)
                    ABS(LENGTH(COALESCE(n.content, '')) - LENGTH(COALESCE(t.content, '')))
                        <= (LENGTH(COALESCE(t.content, '')) * 0.3)
                )
        )
        SELECT
            id,
            name,
            name_length,
            content_length,
            same_folder,
            CASE
                WHEN same_folder = 1 THEN 'same folder'
                WHEN ABS(name_length - (SELECT LENGTH(name) FROM target_node)) <= 5 THEN 'similar name length'
                ELSE 'similar content length'
            END as similarity_reason
        FROM content_candidates
        ORDER BY
            same_folder DESC,
            ABS(name_length - (SELECT LENGTH(name) FROM target_node)) ASC
        LIMIT 5
        """

        return try await database.read { db in
            let rows = try Row.fetchAll(db, sql: query, arguments: [nodeId, nodeId])
            return rows.map { row in
                let sameFolder: Int = row["same_folder"]
                let similarityReason: String = row["similarity_reason"]

                // Simple content similarity scoring
                let folderBonus = sameFolder == 1 ? 0.3 : 0.0
                let baseConfidence = sameFolder == 1 ? 0.4 : 0.2
                let confidence = min(0.6, baseConfidence + folderBonus)

                return ConnectionSuggestion(
                    nodeId: row["id"],
                    reason: "Content similarity (\(similarityReason))",
                    confidence: confidence,
                    type: .similarContent
                )
            }
        }
    }

    // MARK: - Helper Methods

    private func getExistingConnections(for nodeId: String) async throws -> Set<String> {
        let query = """
        SELECT DISTINCT
            CASE WHEN source_id = ? THEN target_id ELSE source_id END as connected_id
        FROM edges
        WHERE (source_id = ? OR target_id = ?)
            AND deleted_at IS NULL
        """

        return try await database.read { db in
            let rows = try Row.fetchAll(db, sql: query, arguments: [nodeId, nodeId, nodeId])
            return Set(rows.map { $0["connected_id"] as String })
        }
    }

    private func deduplicateSuggestions(_ suggestions: [ConnectionSuggestion]) -> [ConnectionSuggestion] {
        var bestSuggestions: [String: ConnectionSuggestion] = [:]

        for suggestion in suggestions {
            if let existing = bestSuggestions[suggestion.nodeId] {
                // Keep the suggestion with higher confidence
                if suggestion.confidence > existing.confidence {
                    bestSuggestions[suggestion.nodeId] = suggestion
                }
            } else {
                bestSuggestions[suggestion.nodeId] = suggestion
            }
        }

        return Array(bestSuggestions.values)
    }

    // MARK: - Analytics & Metrics

    /// Get suggestion engine performance metrics
    public func getSuggestionMetrics() async throws -> SuggestionMetrics {
        let totalNodesQuery = "SELECT COUNT(*) as count FROM nodes WHERE deleted_at IS NULL"
        let totalEdgesQuery = "SELECT COUNT(*) as count FROM edges WHERE deleted_at IS NULL"
        let avgTagsQuery = "SELECT AVG(json_array_length(tags)) as avg_tags FROM nodes WHERE deleted_at IS NULL AND json_array_length(tags) > 0"

        return try await database.read { db in
            let totalNodes: Int = try Row.fetchOne(db, sql: totalNodesQuery)?["count"] ?? 0
            let totalEdges: Int = try Row.fetchOne(db, sql: totalEdgesQuery)?["count"] ?? 0
            let avgTags: Double = try Row.fetchOne(db, sql: avgTagsQuery)?["avg_tags"] ?? 0.0

            return SuggestionMetrics(
                totalNodes: totalNodes,
                totalEdges: totalEdges,
                averageTagsPerNode: avgTags,
                graphDensity: totalNodes > 0 ? Double(totalEdges) / Double(totalNodes * (totalNodes - 1) / 2) : 0.0
            )
        }
    }
}

/// Metrics for suggestion engine performance analysis
public struct SuggestionMetrics: Sendable {
    public let totalNodes: Int
    public let totalEdges: Int
    public let averageTagsPerNode: Double
    public let graphDensity: Double

    public init(totalNodes: Int, totalEdges: Int, averageTagsPerNode: Double, graphDensity: Double) {
        self.totalNodes = totalNodes
        self.totalEdges = totalEdges
        self.averageTagsPerNode = averageTagsPerNode
        self.graphDensity = graphDensity
    }
}

// MARK: - Extensions for convenience

extension ConnectionSuggestionEngine {
    /// Convenience method for getting suggestions with shared tags only
    public func suggestBySharedTags(for nodeId: String, limit: Int = 5) async throws -> [ConnectionSuggestion] {
        let options = SuggestionOptions(
            maxSuggestions: limit,
            minConfidence: 0.2,
            includeTypes: [.sharedTags]
        )
        return try await suggestConnections(for: nodeId, options: options)
    }

    /// Convenience method for getting community-based suggestions only
    public func suggestByCommunity(for nodeId: String, limit: Int = 5) async throws -> [ConnectionSuggestion] {
        let options = SuggestionOptions(
            maxSuggestions: limit,
            minConfidence: 0.3,
            includeTypes: [.sameCommunity, .mutualConnections]
        )
        return try await suggestConnections(for: nodeId, options: options)
    }
}