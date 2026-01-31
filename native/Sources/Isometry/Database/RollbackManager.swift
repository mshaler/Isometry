import Foundation
import GRDB

/// Information about a transaction for rollback operations
public struct TransactionInfo: Sendable {
    public let id: String
    public let startTime: Date
    public let operations: [TransactionOperation]
    public let correlationId: String
    public let isWriteTransaction: Bool

    public init(id: String, startTime: Date = Date(), operations: [TransactionOperation] = [], correlationId: String, isWriteTransaction: Bool = true) {
        self.id = id
        self.startTime = startTime
        self.operations = operations
        self.correlationId = correlationId
        self.isWriteTransaction = isWriteTransaction
    }
}

/// Individual operation within a transaction
public struct TransactionOperation: Sendable {
    public let id: String
    public let type: OperationType
    public let table: String
    public let recordId: String?
    public let beforeData: [String: Any]?
    public let afterData: [String: Any]?
    public let timestamp: Date

    public enum OperationType: String, Sendable {
        case insert = "insert"
        case update = "update"
        case delete = "delete"
        case bulkUpdate = "bulk_update"
    }

    public init(id: String, type: OperationType, table: String, recordId: String? = nil, beforeData: [String: Any]? = nil, afterData: [String: Any]? = nil, timestamp: Date = Date()) {
        self.id = id
        self.type = type
        self.table = table
        self.recordId = recordId
        self.beforeData = beforeData
        self.afterData = afterData
        self.timestamp = timestamp
    }
}

/// Information about preserved data after rollback
public struct DraftInfo: Sendable {
    public let draftId: String
    public let originalTransactionId: String
    public let preservedOperations: [TransactionOperation]
    public let createdAt: Date
    public let expiresAt: Date

    public init(draftId: String, originalTransactionId: String, preservedOperations: [TransactionOperation], createdAt: Date = Date(), expiresAt: Date = Date().addingTimeInterval(3600 * 24)) {
        self.draftId = draftId
        self.originalTransactionId = originalTransactionId
        self.preservedOperations = preservedOperations
        self.createdAt = createdAt
        self.expiresAt = expiresAt
    }
}

/// Result of rollback operation
public struct RollbackResult: Sendable {
    public let transactionId: String
    public let success: Bool
    public let rollbackDuration: TimeInterval // Target: <50ms
    public let preservedDraftId: String?
    public let operationsRolledBack: Int
    public let error: String?

    public init(transactionId: String, success: Bool, rollbackDuration: TimeInterval, preservedDraftId: String? = nil, operationsRolledBack: Int = 0, error: String? = nil) {
        self.transactionId = transactionId
        self.success = success
        self.rollbackDuration = rollbackDuration
        self.preservedDraftId = preservedDraftId
        self.operationsRolledBack = operationsRolledBack
        self.error = error
    }
}

/// Thread-safe database-level rollback coordinator with smart state preservation
///
/// Provides <50ms transaction rollback with comprehensive cleanup and draft preservation.
/// Integrates with TransactionBridge for coordinated rollback operations across bridge boundaries.
/// Implements smart preservation to save valid operations while discarding problematic ones.
public actor RollbackManager {

    // MARK: - Configuration

    /// Target rollback completion time (50ms requirement)
    private let rollbackTimeLimit: TimeInterval = 0.05

    /// How long to keep draft data before auto-cleanup (24 hours)
    private let draftRetentionPeriod: TimeInterval = 86400

    /// Maximum operations to preserve in a single draft
    private let maxPreservedOperations = 1000

    // MARK: - Dependencies

    private let database: IsometryDatabase
    private let dbWriter: any DatabaseWriter

    // MARK: - State

    private var activeTransactions: [String: TransactionInfo] = [:]
    private var pendingDrafts: [String: DraftInfo] = [:]

    // Performance tracking
    private var rollbackMetrics: [String: TimeInterval] = [:]

    // MARK: - Initialization

    public init(database: IsometryDatabase, dbWriter: any DatabaseWriter) {
        self.database = database
        self.dbWriter = dbWriter
    }

    // MARK: - Transaction Tracking

    /// Registers a transaction for potential rollback
    public func trackTransaction(_ transaction: TransactionInfo) async {
        activeTransactions[transaction.id] = transaction
    }

    /// Removes transaction from tracking (normal completion)
    public func completeTransaction(_ transactionId: String) async {
        activeTransactions.removeValue(forKey: transactionId)
    }

    // MARK: - Rollback Operations

    /// Coordinated rollback with cleanup and optional draft preservation
    /// Returns rollback result with duration metrics and preserved draft info
    public func rollbackTransaction(transactionId: String, preserveDrafts: Bool = true) async throws -> RollbackResult {
        let startTime = Date()

        guard let transaction = activeTransactions[transactionId] else {
            throw RollbackError.transactionNotFound(transactionId)
        }

        do {
            // Start rollback with time tracking
            var preservedDraftId: String?

            // Preserve valid state if requested and transaction has operations
            if preserveDrafts && !transaction.operations.isEmpty {
                if let draftInfo = try await preserveValidState(from: transaction) {
                    preservedDraftId = draftInfo.draftId
                    pendingDrafts[draftInfo.draftId] = draftInfo
                }
            }

            // Perform the actual database rollback
            try await performDatabaseRollback(transaction)

            // Clean up transaction state
            try await cleanupTransactionState(transactionId: transactionId)

            // Calculate rollback duration
            let duration = Date().timeIntervalSince(startTime)
            rollbackMetrics[transactionId] = duration

            // Verify we met the <50ms target
            if duration > rollbackTimeLimit {
                print("⚠️ RollbackManager: Rollback took \(Int(duration * 1000))ms, exceeding 50ms target")
            }

            let result = RollbackResult(
                transactionId: transactionId,
                success: true,
                rollbackDuration: duration,
                preservedDraftId: preservedDraftId,
                operationsRolledBack: transaction.operations.count
            )

            return result

        } catch {
            let duration = Date().timeIntervalSince(startTime)

            let result = RollbackResult(
                transactionId: transactionId,
                success: false,
                rollbackDuration: duration,
                operationsRolledBack: 0,
                error: error.localizedDescription
            )

            throw RollbackError.rollbackFailed(transactionId, error.localizedDescription)
        }
    }

    /// Saves valid portions of failed transaction as drafts for user recovery
    /// Analyzes operations to identify valid database operations vs problematic ones
    public func preserveValidState(from transaction: TransactionInfo) async throws -> DraftInfo? {
        // Analyze operations to determine which ones are safe to preserve
        let validOperations = analyzeValidOperations(transaction.operations)

        guard !validOperations.isEmpty else {
            return nil // Nothing to preserve
        }

        // Limit preserved operations to prevent memory issues
        let limitedOperations = Array(validOperations.prefix(maxPreservedOperations))

        let draftId = generateDraftId()
        let draftInfo = DraftInfo(
            draftId: draftId,
            originalTransactionId: transaction.id,
            preservedOperations: limitedOperations,
            createdAt: Date(),
            expiresAt: Date().addingTimeInterval(draftRetentionPeriod)
        )

        // Store draft in database for persistence across app restarts
        try await storeDraftInfo(draftInfo)

        print("RollbackManager: Preserved \(limitedOperations.count) operations as draft \(draftId)")
        return draftInfo
    }

    /// Removes transaction artifacts and temporary data
    /// Optimized cleanup procedures to meet <50ms target
    public func cleanupTransactionState(transactionId: String) async throws {
        // Remove from active tracking
        activeTransactions.removeValue(forKey: transactionId)

        // Clean up any temporary transaction artifacts in database
        try await dbWriter.write { db in
            // Remove transaction log entries (if any)
            try db.execute(
                sql: "DELETE FROM transaction_log WHERE transaction_id = ?",
                arguments: [transactionId]
            )

            // Clean up any temporary tables or state
            try db.execute(
                sql: "DELETE FROM pending_operations WHERE transaction_id = ?",
                arguments: [transactionId]
            )
        }

        print("RollbackManager: Cleaned up transaction state for \(transactionId)")
    }

    // MARK: - Draft Management

    /// Returns all available drafts for recovery
    public func getAvailableDrafts() async -> [DraftInfo] {
        // Clean up expired drafts first
        await cleanupExpiredDrafts()

        return Array(pendingDrafts.values).sorted { $0.createdAt > $1.createdAt }
    }

    /// Gets specific draft by ID
    public func getDraft(draftId: String) async -> DraftInfo? {
        return pendingDrafts[draftId]
    }

    /// Removes a draft after successful recovery
    public func removeDraft(draftId: String) async throws {
        pendingDrafts.removeValue(forKey: draftId)

        try await dbWriter.write { db in
            try db.execute(
                sql: "DELETE FROM draft_storage WHERE draft_id = ?",
                arguments: [draftId]
            )
        }
    }

    // MARK: - Performance Metrics

    /// Gets rollback performance metrics for monitoring
    public func getRollbackMetrics() async -> [String: TimeInterval] {
        return rollbackMetrics
    }

    /// Clears performance metrics
    public func clearMetrics() async {
        rollbackMetrics.removeAll()
    }

    // MARK: - Private Implementation

    /// Performs the actual database rollback using GRDB transaction capabilities
    private func performDatabaseRollback(_ transaction: TransactionInfo) async throws {
        // Since GRDB handles transaction rollbacks automatically when transactions fail,
        // we primarily need to undo any committed changes from this transaction

        try await dbWriter.write { db in
            // Reverse operations in reverse chronological order
            for operation in transaction.operations.reversed() {
                try undoOperation(operation, in: db)
            }
        }
    }

    /// Undoes a specific operation in the database
    private func undoOperation(_ operation: TransactionOperation, in db: Database) throws {
        switch operation.type {
        case .insert:
            // Undo insert by deleting the record
            if let recordId = operation.recordId {
                try db.execute(
                    sql: "DELETE FROM \(operation.table) WHERE id = ?",
                    arguments: [recordId]
                )
            }

        case .update:
            // Undo update by restoring previous values
            if let recordId = operation.recordId,
               let beforeData = operation.beforeData {
                let setClause = beforeData.keys.map { "\($0) = ?" }.joined(separator: ", ")
                let values = Array(beforeData.values) + [recordId]

                try db.execute(
                    sql: "UPDATE \(operation.table) SET \(setClause) WHERE id = ?",
                    arguments: StatementArguments(values)
                )
            }

        case .delete:
            // Undo delete by re-inserting the record
            if let beforeData = operation.beforeData {
                let columns = beforeData.keys.joined(separator: ", ")
                let placeholders = Array(repeating: "?", count: beforeData.count).joined(separator: ", ")

                try db.execute(
                    sql: "INSERT INTO \(operation.table) (\(columns)) VALUES (\(placeholders))",
                    arguments: StatementArguments(Array(beforeData.values))
                )
            }

        case .bulkUpdate:
            // Complex bulk operations cannot be easily undone - log warning
            print("⚠️ RollbackManager: Cannot undo bulk operation \(operation.id)")
        }
    }

    /// Analyzes operations to identify valid ones for preservation
    private func analyzeValidOperations(_ operations: [TransactionOperation]) -> [TransactionOperation] {
        return operations.filter { operation in
            // Preserve operations that have complete data and are not bulk operations
            switch operation.type {
            case .insert:
                return operation.afterData != nil
            case .update:
                return operation.beforeData != nil && operation.afterData != nil && operation.recordId != nil
            case .delete:
                return operation.beforeData != nil && operation.recordId != nil
            case .bulkUpdate:
                return false // Too complex to preserve reliably
            }
        }
    }

    /// Stores draft information in database for persistence
    private func storeDraftInfo(_ draftInfo: DraftInfo) async throws {
        let operationsJSON = try JSONEncoder().encode(draftInfo.preservedOperations)
        let operationsString = String(data: operationsJSON, encoding: .utf8) ?? ""

        try await dbWriter.write { db in
            try db.execute(sql: """
                INSERT OR REPLACE INTO draft_storage (
                    draft_id, original_transaction_id, preserved_operations,
                    created_at, expires_at
                ) VALUES (?, ?, ?, ?, ?)
                """,
                arguments: [
                    draftInfo.draftId,
                    draftInfo.originalTransactionId,
                    operationsString,
                    draftInfo.createdAt,
                    draftInfo.expiresAt
                ]
            )
        }
    }

    /// Cleans up expired drafts to prevent storage bloat
    private func cleanupExpiredDrafts() async {
        let now = Date()
        let expiredDraftIds = pendingDrafts.compactMap { key, value in
            value.expiresAt < now ? key : nil
        }

        for draftId in expiredDraftIds {
            pendingDrafts.removeValue(forKey: draftId)
        }

        if !expiredDraftIds.isEmpty {
            do {
                try await dbWriter.write { db in
                    for draftId in expiredDraftIds {
                        try db.execute(
                            sql: "DELETE FROM draft_storage WHERE draft_id = ?",
                            arguments: [draftId]
                        )
                    }
                }
            } catch {
                print("⚠️ RollbackManager: Failed to cleanup expired drafts: \(error)")
            }
        }
    }

    /// Generates unique draft ID
    private func generateDraftId() -> String {
        return "draft_\(UUID().uuidString.lowercased().prefix(12))"
    }
}

// MARK: - Error Types

public enum RollbackError: LocalizedError, Sendable {
    case transactionNotFound(String)
    case rollbackFailed(String, String)
    case draftCreationFailed(String)
    case cleanupFailed(String)

    public var errorDescription: String? {
        switch self {
        case .transactionNotFound(let txId):
            return "Transaction not found: \(txId)"
        case .rollbackFailed(let txId, let reason):
            return "Rollback failed for \(txId): \(reason)"
        case .draftCreationFailed(let reason):
            return "Failed to create draft: \(reason)"
        case .cleanupFailed(let reason):
            return "Cleanup failed: \(reason)"
        }
    }
}