import Foundation
import GRDB
import OSLog

/// GRDB transaction management layer providing transaction scoping and coordination
///
/// Wraps IsometryDatabase write operations with transaction safety and handles
/// flat transaction nesting where nested calls join existing transactions.
/// Integrates with ChangeNotificationBridge for transaction-aware change events.
public actor TransactionCoordinator {
    // MARK: - Properties

    private let database: IsometryDatabase
    private let logger = OSLog(subsystem: "IsometryTransaction", category: "Coordinator")

    /// Current transaction scope stack for flat nesting behavior
    private var transactionStack: [TransactionScope] = []

    /// Integration with Phase 19 change notifications
    private var changeNotificationBridge: ChangeNotificationBridge?

    // Forward declarations for placeholder types
    // ChangeNotificationBridge is defined in Bridge/RealTime/ChangeNotificationBridge.swift

    // MARK: - Transaction Scope

    private struct TransactionScope {
        let id: String
        let correlationId: String
        let startTime: Date
        var operationCount: Int = 0
        var changeEvents: [ChangeEvent] = []
    }

    private struct ChangeEvent {
        let tableName: String
        let operation: String
        let recordId: String?
        let timestamp: Date
    }

    // MARK: - Initialization

    public init(database: IsometryDatabase) {
        self.database = database
        os_log("TransactionCoordinator initialized", log: logger, type: .info)
    }

    /// Configure integration with Phase 19 ChangeNotificationBridge
    public func configure(changeNotificationBridge: ChangeNotificationBridge?) {
        self.changeNotificationBridge = changeNotificationBridge
        os_log("TransactionCoordinator configured with change notifications", log: logger, type: .info)
    }

    // MARK: - Transaction Coordination

    /// Execute operation within transaction scope with flat nesting behavior
    /// - Parameters:
    ///   - correlationId: Hierarchical correlation ID for debugging
    ///   - operation: Database operation to execute
    /// - Returns: Operation result
    /// - Throws: Database errors or transaction errors
    public func executeInTransaction<T>(
        correlationId: String,
        operation: @escaping (Database) async throws -> T
    ) async throws -> T {
        // Check if we're already in a transaction scope (flat nesting)
        if let currentScope = transactionStack.last {
            os_log("Joining existing transaction scope: %@ for correlation: %@", log: logger, type: .debug, currentScope.id, correlationId)
            return try await executeInExistingScope(correlationId: correlationId, operation: operation)
        } else {
            os_log("Creating new transaction scope for correlation: %@", log: logger, type: .debug, correlationId)
            return try await executeInNewScope(correlationId: correlationId, operation: operation)
        }
    }

    /// Execute write operation with transaction coordination
    /// - Parameters:
    ///   - correlationId: Correlation ID for tracking
    ///   - operation: Write operation to execute
    /// - Returns: Operation result
    public func write<T>(
        correlationId: String,
        operation: @escaping (Database) async throws -> T
    ) async throws -> T {
        return try await executeInTransaction(correlationId: correlationId) { [self] db in
            // Use BEGIN IMMEDIATE to prevent SQLite deadlocks (research pitfall prevention)
            if transactionStack.isEmpty {
                try db.execute(sql: "BEGIN IMMEDIATE")
            }

            let result = try await operation(db)

            // Record change event for notifications
            await self.recordChangeEvent(
                tableName: "unknown", // Would be determined by operation analysis
                operation: "write",
                recordId: nil
            )

            return result
        }
    }

    /// Execute read operation (no transaction needed, but tracking for metrics)
    /// - Parameters:
    ///   - correlationId: Correlation ID for tracking
    ///   - operation: Read operation to execute
    /// - Returns: Operation result
    public func read<T>(
        correlationId: String,
        operation: @escaping (Database) async throws -> T
    ) async throws -> T {
        os_log("Executing read operation for correlation: %@", log: logger, type: .debug, correlationId)

        return try await database.read { db in
            try await operation(db)
        }
    }

    // MARK: - Transaction State Management

    /// Get current transaction scope information
    /// - Returns: Current scope details or nil if no active transaction
    public func getCurrentScope() -> (id: String, correlationId: String, operationCount: Int, duration: TimeInterval)? {
        guard let scope = transactionStack.last else { return nil }

        return (
            id: scope.id,
            correlationId: scope.correlationId,
            operationCount: scope.operationCount,
            duration: Date().timeIntervalSince(scope.startTime)
        )
    }

    /// Check if currently within a transaction scope
    /// - Returns: True if in transaction
    public func isInTransaction() -> Bool {
        return !transactionStack.isEmpty
    }

    /// Get transaction nesting depth
    /// - Returns: Current nesting level
    public func getTransactionDepth() -> Int {
        return transactionStack.count
    }

    // MARK: - Private Implementation

    private func executeInNewScope<T>(
        correlationId: String,
        operation: @escaping (Database) async throws -> T
    ) async throws -> T {
        let scopeId = generateScopeId()
        let scope = TransactionScope(
            id: scopeId,
            correlationId: correlationId,
            startTime: Date()
        )

        transactionStack.append(scope)
        os_log("Started new transaction scope: %@", log: logger, type: .debug, scopeId)

        do {
            let result = try await database.write { db in
                try await operation(db)
            }

            // Commit scope and notify change events
            await commitScope()
            return result

        } catch {
            // Rollback scope on error
            await rollbackScope(error: error)
            throw error
        }
    }

    private func executeInExistingScope<T>(
        correlationId: String,
        operation: @escaping (Database) async throws -> T
    ) async throws -> T {
        guard var currentScope = transactionStack.last else {
            throw TransactionCoordinatorError.noActiveTransaction
        }

        // Increment operation count for current scope
        currentScope.operationCount += 1
        transactionStack[transactionStack.count - 1] = currentScope

        os_log("Executing operation in existing scope: %@ (op #%d)", log: logger, type: .debug, currentScope.id, currentScope.operationCount)

        // Execute within existing transaction context
        return try await database.write { db in
            try await operation(db)
        }
    }

    private func commitScope() async {
        guard var scope = transactionStack.popLast() else { return }

        let duration = Date().timeIntervalSince(scope.startTime)
        os_log("Committed transaction scope: %@ (%d ops, %.3fs)", log: logger, type: .info, scope.id, scope.operationCount, duration)

        // Notify change events if integrated with Phase 19
        await notifyChangeEvents(scope.changeEvents, scopeId: scope.id)
    }

    private func rollbackScope(error: Error) async {
        guard let scope = transactionStack.popLast() else { return }

        let duration = Date().timeIntervalSince(scope.startTime)
        os_log("Rolled back transaction scope: %@ due to error: %@", log: logger, type: .error, scope.id, error.localizedDescription)
        os_log("Scope duration: %.3fs, operations: %d", log: logger, type: .debug, duration, scope.operationCount)

        // Clear any accumulated change events
        // No notifications sent for rolled back transactions
    }

    private func recordChangeEvent(tableName: String, operation: String, recordId: String?) async {
        guard var scope = transactionStack.last else { return }

        let event = ChangeEvent(
            tableName: tableName,
            operation: operation,
            recordId: recordId,
            timestamp: Date()
        )

        scope.changeEvents.append(event)
        transactionStack[transactionStack.count - 1] = scope
    }

    private func notifyChangeEvents(_ events: [ChangeEvent], scopeId: String) async {
        guard !events.isEmpty else { return }

        os_log("Notifying %d change events for scope: %@", log: logger, type: .debug, events.count, scopeId)

        // Integration point with Phase 19 ChangeNotificationBridge
        for event in events {
            await changeNotificationBridge?.notifyChange(
                tableName: event.tableName,
                operation: event.operation,
                recordId: event.recordId,
                correlationId: scopeId
            )
        }
    }

    private func generateScopeId() -> String {
        return "scope_\(UUID().uuidString.prefix(8))_\(Int(Date().timeIntervalSince1970))"
    }
}

// MARK: - Transaction Coordinator Errors

public enum TransactionCoordinatorError: Error, LocalizedError {
    case noActiveTransaction
    case nestedTransactionNotSupported
    case transactionTimeout
    case databaseError(Error)

    public var errorDescription: String? {
        switch self {
        case .noActiveTransaction:
            return "No active transaction scope"
        case .nestedTransactionNotSupported:
            return "Nested transactions not supported (use flat nesting)"
        case .transactionTimeout:
            return "Transaction scope timeout"
        case .databaseError(let error):
            return "Database error in transaction scope: \(error.localizedDescription)"
        }
    }
}

// MARK: - Integration Extensions

extension TransactionCoordinator {
    // Note: Batch operations can be implemented by calling executeInTransaction multiple times
    // with the same correlationId - flat nesting will ensure they join the same transaction

    /// Execute operation with retry logic on transaction conflicts
    /// - Parameters:
    ///   - correlationId: Correlation ID
    ///   - maxRetries: Maximum retry attempts (default: 3)
    ///   - operation: Operation to execute
    /// - Returns: Operation result
    public func executeWithRetry<T>(
        correlationId: String,
        maxRetries: Int = 3,
        operation: @escaping (Database) async throws -> T
    ) async throws -> T {
        var attempt = 0
        var lastError: Error?

        while attempt <= maxRetries {
            do {
                return try await executeInTransaction(correlationId: "\(correlationId).retry\(attempt)") { db in
                    try await operation(db)
                }
            } catch {
                lastError = error

                // Check if error is retryable (SQLITE_BUSY, SQLITE_LOCKED)
                if isRetryableError(error) && attempt < maxRetries {
                    attempt += 1
                    let backoffMs = UInt64(100 * (1 << attempt)) // Exponential backoff: 200ms, 400ms, 800ms
                    try await Task.sleep(nanoseconds: backoffMs * 1_000_000)
                    os_log("Retrying transaction operation (attempt %d) for correlation: %@", log: logger, type: .debug, attempt + 1, correlationId)
                    continue
                }

                throw error
            }
        }

        throw lastError ?? TransactionCoordinatorError.noActiveTransaction
    }

    private func isRetryableError(_ error: Error) -> Bool {
        // Check for SQLite busy/locked errors that are typically retryable
        let errorDescription = error.localizedDescription.lowercased()
        return errorDescription.contains("busy") ||
               errorDescription.contains("locked") ||
               errorDescription.contains("database is locked")
    }
}