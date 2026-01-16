import Foundation

/// Errors that can occur during database operations
public enum DatabaseError: LocalizedError, Sendable {
    case notInitialized
    case schemaLoadFailed(underlying: Error)
    case migrationFailed(version: Int, underlying: Error)
    case queryFailed(sql: String, underlying: Error)
    case nodeNotFound(id: String)
    case edgeNotFound(id: String)
    case duplicateNode(id: String)
    case duplicateEdge(sourceId: String, targetId: String, type: String)
    case invalidPath(from: String, to: String)
    case circularReference(nodeId: String)
    case transactionFailed(underlying: Error)

    public var errorDescription: String? {
        switch self {
        case .notInitialized:
            return "Database has not been initialized"
        case .schemaLoadFailed(let error):
            return "Failed to load database schema: \(error.localizedDescription)"
        case .migrationFailed(let version, let error):
            return "Migration to version \(version) failed: \(error.localizedDescription)"
        case .queryFailed(let sql, let error):
            return "Query failed [\(sql.prefix(50))...]: \(error.localizedDescription)"
        case .nodeNotFound(let id):
            return "Node not found: \(id)"
        case .edgeNotFound(let id):
            return "Edge not found: \(id)"
        case .duplicateNode(let id):
            return "Node already exists: \(id)"
        case .duplicateEdge(let sourceId, let targetId, let type):
            return "Edge already exists: \(sourceId) -> \(targetId) [\(type)]"
        case .invalidPath(let from, let to):
            return "No valid path from \(from) to \(to)"
        case .circularReference(let nodeId):
            return "Circular reference detected involving node: \(nodeId)"
        case .transactionFailed(let error):
            return "Transaction failed: \(error.localizedDescription)"
        }
    }
}
