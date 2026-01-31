import Foundation
import GRDB
import OSLog

/// Actor managing bridge-level transaction state and coordination across WebView boundaries
///
/// Provides ACID transaction safety by coordinating GRDB write transactions with React operations.
/// Integrates with Phase 18 MessageBatcher and Phase 19 ChangeNotificationBridge for optimized transport.
/// Uses correlation IDs for debugging and hierarchical transaction tracking.
public actor TransactionBridge {
    // MARK: - Properties

    private let database: IsometryDatabase
    private let logger = OSLog(subsystem: "IsometryTransaction", category: "Bridge")

    /// Active transactions tracked by correlation ID
    private var activeTransactions: [String: TransactionContext] = [:]

    /// Transaction timeout duration (30 seconds)
    private let transactionTimeout: TimeInterval = 30.0

    /// Integration with Phase 18 optimization components
    private weak var messageBatcher: MessageBatcher?
    private weak var changeNotificationBridge: ChangeNotificationBridge?

    // Forward declarations for placeholder types
    typealias MessageBatcher = NSObject // Placeholder - to be replaced with actual MessageBatcher
    typealias ChangeNotificationBridge = NSObject // Placeholder - to be replaced with actual ChangeNotificationBridge

    // MARK: - Transaction Context

    private struct TransactionContext {
        let correlationId: String
        let transactionId: String
        let startTime: Date
        let timeoutTask: Task<Void, Never>
        var isCommitted: Bool = false
        var isRolledBack: Bool = false
    }

    // MARK: - Initialization

    public init(database: IsometryDatabase) {
        self.database = database
        os_log("TransactionBridge initialized", log: logger, type: .info)
    }

    /// Configure integration with Phase 18 and Phase 19 components
    func configure(
        messageBatcher: MessageBatcher?,
        changeNotificationBridge: ChangeNotificationBridge?
    ) {
        self.messageBatcher = messageBatcher
        self.changeNotificationBridge = changeNotificationBridge
        os_log("TransactionBridge configured with optimization components", log: logger, type: .info)
    }

    // MARK: - Transaction Lifecycle

    /// Begin a new GRDB write transaction
    /// - Parameter correlationId: Hierarchical correlation ID for debugging
    /// - Returns: Unique transaction ID for subsequent operations
    /// - Throws: TransactionError on failure
    public func beginTransaction(correlationId: String) async throws -> String {
        os_log("Beginning transaction for correlation: %@", log: logger, type: .debug, correlationId)

        // Check for existing transaction with same correlation ID
        if activeTransactions[correlationId] != nil {
            os_log("Transaction already exists for correlation: %@", log: logger, type: .error, correlationId)
            throw TransactionError.transactionAlreadyExists(correlationId)
        }

        let transactionId = generateTransactionId()
        let startTime = Date()

        // Create timeout task for automatic rollback
        let timeoutTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(self?.transactionTimeout ?? 30.0) * 1_000_000_000)
            await self?.handleTransactionTimeout(correlationId: correlationId)
        }

        let context = TransactionContext(
            correlationId: correlationId,
            transactionId: transactionId,
            startTime: startTime,
            timeoutTask: timeoutTask
        )

        activeTransactions[correlationId] = context

        // Start GRDB transaction using BEGIN IMMEDIATE to prevent deadlocks
        try await database.beginImmediateTransaction(transactionId: transactionId)

        os_log("Transaction started: %@ for correlation: %@", log: logger, type: .info, transactionId, correlationId)
        return transactionId
    }

    /// Commit an active transaction
    /// - Parameter transactionId: Transaction ID to commit
    /// - Throws: TransactionError on failure
    public func commitTransaction(transactionId: String) async throws {
        guard let context = findTransactionContext(transactionId: transactionId) else {
            throw TransactionError.transactionNotFound(transactionId)
        }

        guard !context.isCommitted && !context.isRolledBack else {
            throw TransactionError.transactionAlreadyFinalized(transactionId)
        }

        os_log("Committing transaction: %@", log: logger, type: .debug, transactionId)

        // Cancel timeout task
        context.timeoutTask.cancel()

        // Commit GRDB transaction
        try await database.commitTransaction(transactionId: transactionId)

        // Update context state
        var updatedContext = context
        updatedContext.isCommitted = true
        activeTransactions[context.correlationId] = updatedContext

        // Notify change notification bridge of transaction completion
        await notifyTransactionComplete(correlationId: context.correlationId, committed: true)

        // Clean up after successful commit
        activeTransactions.removeValue(forKey: context.correlationId)

        let duration = Date().timeIntervalSince(context.startTime)
        os_log("Transaction committed: %@ (duration: %.3fs)", log: logger, type: .info, transactionId, duration)
    }

    /// Rollback an active transaction
    /// - Parameter transactionId: Transaction ID to rollback
    /// - Throws: TransactionError on failure
    public func rollbackTransaction(transactionId: String) async throws {
        guard let context = findTransactionContext(transactionId: transactionId) else {
            throw TransactionError.transactionNotFound(transactionId)
        }

        guard !context.isCommitted && !context.isRolledBack else {
            throw TransactionError.transactionAlreadyFinalized(transactionId)
        }

        os_log("Rolling back transaction: %@", log: logger, type: .debug, transactionId)

        // Cancel timeout task
        context.timeoutTask.cancel()

        // Rollback GRDB transaction
        try await database.rollbackTransaction(transactionId: transactionId)

        // Update context state
        var updatedContext = context
        updatedContext.isRolledBack = true
        activeTransactions[context.correlationId] = updatedContext

        // Notify change notification bridge of transaction rollback
        await notifyTransactionComplete(correlationId: context.correlationId, committed: false)

        // Clean up after rollback
        activeTransactions.removeValue(forKey: context.correlationId)

        let duration = Date().timeIntervalSince(context.startTime)
        os_log("Transaction rolled back: %@ (duration: %.3fs)", log: logger, type: .info, transactionId, duration)
    }

    /// Execute operation within a transaction atomically
    /// - Parameters:
    ///   - correlationId: Hierarchical correlation ID
    ///   - operation: Async operation to execute within transaction
    /// - Returns: Result of the operation
    /// - Throws: Operation errors or TransactionError
    public func executeInTransaction<T>(
        correlationId: String,
        operation: @escaping () async throws -> T
    ) async throws -> T {
        let transactionId = try await beginTransaction(correlationId: correlationId)

        do {
            let result = try await operation()
            try await commitTransaction(transactionId: transactionId)
            return result
        } catch {
            try? await rollbackTransaction(transactionId: transactionId)
            throw error
        }
    }

    // MARK: - Transaction Query

    /// Get status of active transactions
    /// - Returns: Array of active transaction information
    public func getActiveTransactions() -> [(correlationId: String, transactionId: String, duration: TimeInterval)] {
        let now = Date()
        return activeTransactions.values.map { context in
            (
                correlationId: context.correlationId,
                transactionId: context.transactionId,
                duration: now.timeIntervalSince(context.startTime)
            )
        }
    }

    /// Check if transaction exists for correlation ID
    /// - Parameter correlationId: Correlation ID to check
    /// - Returns: True if transaction exists
    public func hasActiveTransaction(correlationId: String) -> Bool {
        return activeTransactions[correlationId] != nil
    }

    // MARK: - Private Methods

    private func findTransactionContext(transactionId: String) -> TransactionContext? {
        return activeTransactions.values.first { $0.transactionId == transactionId }
    }

    private func generateTransactionId() -> String {
        return "tx_\(UUID().uuidString.prefix(8))_\(Int(Date().timeIntervalSince1970))"
    }

    private func handleTransactionTimeout(correlationId: String) async {
        guard let context = activeTransactions[correlationId],
              !context.isCommitted && !context.isRolledBack else {
            return
        }

        os_log("Transaction timeout for correlation: %@", log: logger, type: .error, correlationId)

        do {
            try await rollbackTransaction(transactionId: context.transactionId)
        } catch {
            os_log("Failed to rollback timed-out transaction %@: %@", log: logger, type: .error, context.transactionId, error.localizedDescription)
        }
    }

    private func notifyTransactionComplete(correlationId: String, committed: Bool) async {
        // Integration point with Phase 19 ChangeNotificationBridge
        // Notify subscribers that transaction-level changes are complete
        // Note: Using placeholder NSObject - this would be replaced with actual ChangeNotificationBridge
        // await changeNotificationBridge?.notifyTransactionComplete(
        //     correlationId: correlationId,
        //     committed: committed
        // )

        // For now, just log the transaction completion
        os_log("Transaction %@ completed for correlation: %@", log: logger, type: .info,
               committed ? "committed" : "rolled back", correlationId)
    }
}

// MARK: - Transaction Errors

public enum TransactionError: Error, LocalizedError {
    case transactionNotFound(String)
    case transactionAlreadyExists(String)
    case transactionAlreadyFinalized(String)
    case databaseError(Error)
    case timeout(String)

    public var errorDescription: String? {
        switch self {
        case .transactionNotFound(let id):
            return "Transaction not found: \(id)"
        case .transactionAlreadyExists(let correlationId):
            return "Transaction already exists for correlation: \(correlationId)"
        case .transactionAlreadyFinalized(let id):
            return "Transaction already finalized: \(id)"
        case .databaseError(let error):
            return "Database error: \(error.localizedDescription)"
        case .timeout(let id):
            return "Transaction timeout: \(id)"
        }
    }
}

// MARK: - Extensions for IsometryDatabase

extension IsometryDatabase {
    /// Begin IMMEDIATE transaction to prevent SQLite deadlocks
    func beginImmediateTransaction(transactionId: String) async throws {
        try await write { db in
            try db.execute(sql: "BEGIN IMMEDIATE")
            // Store transaction metadata for debugging
            try db.execute(
                sql: "INSERT OR REPLACE INTO transaction_log (id, started_at, status) VALUES (?, ?, ?)",
                arguments: [transactionId, Date().timeIntervalSince1970, "active"]
            )
        }
    }

    /// Commit transaction and update metadata
    func commitTransaction(transactionId: String) async throws {
        try await write { db in
            // Update transaction log
            try db.execute(
                sql: "UPDATE transaction_log SET status = ?, completed_at = ? WHERE id = ?",
                arguments: ["committed", Date().timeIntervalSince1970, transactionId]
            )
            try db.execute(sql: "COMMIT")
        }
    }

    /// Rollback transaction and update metadata
    func rollbackTransaction(transactionId: String) async throws {
        try await write { db in
            // Update transaction log
            try db.execute(
                sql: "UPDATE transaction_log SET status = ?, completed_at = ? WHERE id = ?",
                arguments: ["rolled_back", Date().timeIntervalSince1970, transactionId]
            )
            try db.execute(sql: "ROLLBACK")
        }
    }
}