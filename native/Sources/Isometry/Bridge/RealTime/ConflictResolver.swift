/**
 * ConflictResolver Actor for Real-Time Database Conflict Detection and Resolution
 *
 * Implements merge-first philosophy with dependency-aware ordering and context-aware
 * conflict resolution. Integrates with ChangeNotificationBridge for conflict event
 * routing and provides automatic resolution for simple conflicts with user deferral
 * for complex scenarios.
 */

import Foundation
import GRDB
import OSLog

/// Types of conflicts that can occur
public enum ConflictType: String, Sendable, Codable {
    case textEdit = "text_edit"
    case propertyUpdate = "property_update"
    case relationshipChange = "relationship_change"
    case structuralChange = "structural_change"
    case deletion = "deletion"
    case concurrent = "concurrent"
}

/// Conflict resolution strategy
public enum ResolutionStrategy: String, Sendable, Codable {
    case automatic = "automatic"
    case mergeFirst = "merge_first"
    case userChoice = "user_choice"
    case deferred = "deferred"
    case lastWriteWins = "last_write_wins"
    case firstWriteWins = "first_write_wins"
}

/// Conflict data structure
public struct ConflictData: Sendable, Codable {
    public let id: String
    public let type: ConflictType
    public let tableName: String
    public let recordId: String
    public let fieldName: String?
    public let localValue: String?
    public let remoteValue: String?
    public let localTimestamp: TimeInterval
    public let remoteTimestamp: TimeInterval
    public let contextData: [String: String]?
    public let dependency: String? // Related record ID for dependency analysis
    public let sequenceNumber: UInt64
    public let sessionId: String?

    public init(
        id: String,
        type: ConflictType,
        tableName: String,
        recordId: String,
        fieldName: String? = nil,
        localValue: String? = nil,
        remoteValue: String? = nil,
        localTimestamp: TimeInterval,
        remoteTimestamp: TimeInterval,
        contextData: [String: String]? = nil,
        dependency: String? = nil,
        sequenceNumber: UInt64,
        sessionId: String? = nil
    ) {
        self.id = id
        self.type = type
        self.tableName = tableName
        self.recordId = recordId
        self.fieldName = fieldName
        self.localValue = localValue
        self.remoteValue = remoteValue
        self.localTimestamp = localTimestamp
        self.remoteTimestamp = remoteTimestamp
        self.contextData = contextData
        self.dependency = dependency
        self.sequenceNumber = sequenceNumber
        self.sessionId = sessionId
    }
}

/// Conflict resolution result
public struct ConflictResolution: Sendable, Codable {
    public let conflictId: String
    public let strategy: ResolutionStrategy
    public let resolvedValue: String?
    public let requiresUserInput: Bool
    public let autoResolved: Bool
    public let resolutionTimestamp: TimeInterval
    public let explanation: String?

    public init(
        conflictId: String,
        strategy: ResolutionStrategy,
        resolvedValue: String?,
        requiresUserInput: Bool,
        autoResolved: Bool,
        explanation: String? = nil
    ) {
        self.conflictId = conflictId
        self.strategy = strategy
        self.resolvedValue = resolvedValue
        self.requiresUserInput = requiresUserInput
        self.autoResolved = autoResolved
        self.resolutionTimestamp = Date().timeIntervalSince1970
        self.explanation = explanation
    }
}

/// Full conflict context for user resolution
public struct ConflictContext: Sendable, Codable {
    public let conflict: ConflictData
    public let fullRecord: [String: Any]?
    public let relatedRecords: [[String: Any]]?
    public let changeHistory: [ConflictData]?
    public let userSessions: [String]?

    // Note: This would need custom Codable implementation for [String: Any]
    // Simplified for now with String representations
    public let fullRecordJson: String?
    public let relatedRecordsJson: String?

    public init(
        conflict: ConflictData,
        fullRecordJson: String?,
        relatedRecordsJson: String?,
        changeHistory: [ConflictData]? = nil,
        userSessions: [String]? = nil
    ) {
        self.conflict = conflict
        self.fullRecord = nil // Would parse from JSON
        self.relatedRecords = nil // Would parse from JSON
        self.changeHistory = changeHistory
        self.userSessions = userSessions
        self.fullRecordJson = fullRecordJson
        self.relatedRecordsJson = relatedRecordsJson
    }
}

/// Configuration for conflict resolver
public struct ConflictResolverOptions: Sendable {
    public let enableAutoResolution: Bool
    public let maxDeferralTime: TimeInterval
    public let contextWindowSize: Int
    public let dependencyAnalysisDepth: Int
    public let enableConflictLog: Bool
    public let mergeFirstThreshold: Double // Similarity threshold for merge-first

    public init(
        enableAutoResolution: Bool = true,
        maxDeferralTime: TimeInterval = 86400, // 24 hours
        contextWindowSize: Int = 10,
        dependencyAnalysisDepth: Int = 3,
        enableConflictLog: Bool = true,
        mergeFirstThreshold: Double = 0.8
    ) {
        self.enableAutoResolution = enableAutoResolution
        self.maxDeferralTime = maxDeferralTime
        self.contextWindowSize = contextWindowSize
        self.dependencyAnalysisDepth = dependencyAnalysisDepth
        self.enableConflictLog = enableConflictLog
        self.mergeFirstThreshold = mergeFirstThreshold
    }
}

/// ConflictResolver Actor for thread-safe conflict management
public actor BridgeConflictResolver {
    // MARK: - Properties

    private let database: IsometryDatabase
    private let options: ConflictResolverOptions
    private let logger = Logger(subsystem: "IsometryBridge", category: "ConflictResolver")

    // Conflict tracking
    private var activeConflicts: [String: ConflictData] = [:]
    private var deferredConflicts: [String: ConflictData] = [:]
    private var conflictLog: [ConflictData] = []
    private var resolutionHistory: [ConflictResolution] = []

    // Resolution patterns learned from user choices
    private var resolutionPatterns: [String: ResolutionStrategy] = [:]

    // Change notification bridge integration
    private weak var changeNotificationBridge: ChangeNotificationBridge?

    // MARK: - Initialization

    public init(
        database: IsometryDatabase,
        options: ConflictResolverOptions = ConflictResolverOptions(),
        changeNotificationBridge: ChangeNotificationBridge? = nil
    ) {
        self.database = database
        self.options = options
        self.changeNotificationBridge = changeNotificationBridge

        // Start deferred conflict cleanup timer
        startDeferredConflictCleanup()
    }

    // MARK: - Public Methods

    /// Detect conflicts for a database change
    public func detectConflicts(
        tableName: String,
        recordId: String,
        changes: [String: Any],
        localTimestamp: TimeInterval,
        sequenceNumber: UInt64
    ) async -> [ConflictData] {
        do {
            // Get current record state from database
            let currentRecord = try await database.fetchRecord(
                table: tableName,
                id: recordId
            )

            guard let record = currentRecord else {
                // Record doesn't exist - no conflicts
                return []
            }

            var conflicts: [ConflictData] = []

            // Check each changed field for conflicts
            for (fieldName, newValue) in changes {
                if let conflict = await detectFieldConflict(
                    tableName: tableName,
                    recordId: recordId,
                    fieldName: fieldName,
                    newValue: newValue,
                    currentRecord: record,
                    localTimestamp: localTimestamp,
                    sequenceNumber: sequenceNumber
                ) {
                    conflicts.append(conflict)
                    activeConflicts[conflict.id] = conflict

                    if options.enableConflictLog {
                        conflictLog.append(conflict)
                        limitConflictLog()
                    }
                }
            }

            // Log detected conflicts
            if !conflicts.isEmpty {
                logger.info("Detected \(conflicts.count) conflicts for \(tableName):\(recordId)")
                for conflict in conflicts {
                    logger.debug("Conflict: \(conflict.type.rawValue) on \(conflict.fieldName ?? "unknown")")
                }
            }

            return conflicts

        } catch {
            logger.error("Failed to detect conflicts: \(error.localizedDescription)")
            return []
        }
    }

    /// Resolve conflicts using configured strategies
    public func resolveConflicts(_ conflicts: [ConflictData]) async -> [ConflictResolution] {
        var resolutions: [ConflictResolution] = []

        // Sort conflicts by dependency order
        let orderedConflicts = await sortConflictsByDependency(conflicts)

        for conflict in orderedConflicts {
            let resolution = await resolveConflict(conflict)
            resolutions.append(resolution)
            resolutionHistory.append(resolution)

            // Remove from active conflicts if resolved
            if resolution.autoResolved {
                activeConflicts.removeValue(forKey: conflict.id)
            } else if resolution.requiresUserInput {
                // Move to deferred conflicts
                deferredConflicts[conflict.id] = conflict
                activeConflicts.removeValue(forKey: conflict.id)
            }

            // Notify bridge of conflict resolution
            if let bridge = changeNotificationBridge {
                await notifyConflictResolution(bridge: bridge, resolution: resolution)
            }
        }

        logger.info("Resolved \(resolutions.count) conflicts, \(resolutions.filter { $0.autoResolved }.count) automatically")

        return resolutions
    }

    /// Get conflict with full context for user resolution
    public func getConflictContext(conflictId: String) async -> ConflictContext? {
        guard let conflict = deferredConflicts[conflictId] ?? activeConflicts[conflictId] else {
            return nil
        }

        do {
            // Get full record context
            let fullRecord = try await database.fetchRecord(
                table: conflict.tableName,
                id: conflict.recordId
            )

            // Get related records based on relationships
            let relatedRecords = try await fetchRelatedRecords(
                tableName: conflict.tableName,
                recordId: conflict.recordId
            )

            // Get change history for this record
            let changeHistory = conflictLog.filter {
                $0.tableName == conflict.tableName && $0.recordId == conflict.recordId
            }.suffix(options.contextWindowSize)

            // Get unique user sessions involved
            let userSessions = Array(Set(conflictLog.compactMap { $0.sessionId }))

            // Convert to JSON for transport
            let fullRecordJson = try? JSONSerialization.data(withJSONObject: fullRecord ?? [:])
                .base64EncodedString()
            let relatedRecordsJson = try? JSONSerialization.data(withJSONObject: relatedRecords)
                .base64EncodedString()

            return ConflictContext(
                conflict: conflict,
                fullRecordJson: fullRecordJson,
                relatedRecordsJson: relatedRecordsJson,
                changeHistory: Array(changeHistory),
                userSessions: userSessions
            )

        } catch {
            logger.error("Failed to get conflict context: \(error.localizedDescription)")
            return nil
        }
    }

    /// Apply user resolution to deferred conflict
    public func applyUserResolution(
        conflictId: String,
        strategy: ResolutionStrategy,
        resolvedValue: String?
    ) async -> Bool {
        guard let conflict = deferredConflicts[conflictId] else {
            logger.warning("Attempted to resolve non-existent deferred conflict: \(conflictId)")
            return false
        }

        do {
            // Apply the resolution to database
            if let resolvedValue = resolvedValue,
               let fieldName = conflict.fieldName {
                try await database.updateRecord(
                    table: conflict.tableName,
                    id: conflict.recordId,
                    changes: [fieldName: resolvedValue]
                )
            }

            // Learn from user choice for pattern recognition
            learnResolutionPattern(conflict: conflict, strategy: strategy)

            // Create resolution record
            let resolution = ConflictResolution(
                conflictId: conflictId,
                strategy: strategy,
                resolvedValue: resolvedValue,
                requiresUserInput: false,
                autoResolved: false,
                explanation: "Resolved by user choice"
            )

            resolutionHistory.append(resolution)
            deferredConflicts.removeValue(forKey: conflictId)

            // Notify bridge
            if let bridge = changeNotificationBridge {
                await notifyConflictResolution(bridge: bridge, resolution: resolution)
            }

            logger.info("Applied user resolution for conflict \(conflictId): \(strategy.rawValue)")
            return true

        } catch {
            logger.error("Failed to apply user resolution: \(error.localizedDescription)")
            return false
        }
    }

    /// Get all active and deferred conflicts
    public func getAllConflicts() -> (active: [ConflictData], deferred: [ConflictData]) {
        return (
            active: Array(activeConflicts.values),
            deferred: Array(deferredConflicts.values)
        )
    }

    /// Get conflict resolution statistics
    public func getStatistics() -> (
        totalConflicts: Int,
        autoResolved: Int,
        userResolved: Int,
        deferred: Int,
        resolutionRate: Double
    ) {
        let totalConflicts = resolutionHistory.count
        let autoResolved = resolutionHistory.filter { $0.autoResolved }.count
        let userResolved = resolutionHistory.filter { !$0.autoResolved && !$0.requiresUserInput }.count
        let deferred = deferredConflicts.count
        let resolutionRate = totalConflicts > 0 ? Double(autoResolved + userResolved) / Double(totalConflicts) : 0.0

        return (
            totalConflicts: totalConflicts,
            autoResolved: autoResolved,
            userResolved: userResolved,
            deferred: deferred,
            resolutionRate: resolutionRate
        )
    }

    // MARK: - Private Methods

    private func detectFieldConflict(
        tableName: String,
        recordId: String,
        fieldName: String,
        newValue: Any,
        currentRecord: [String: Any],
        localTimestamp: TimeInterval,
        sequenceNumber: UInt64
    ) async -> ConflictData? {

        // Get the current value and its last modified timestamp
        guard let currentValue = currentRecord[fieldName],
              let lastModified = currentRecord["lastModified"] as? TimeInterval else {
            return nil
        }

        // Check if there's a timestamp conflict
        let timeDifference = abs(localTimestamp - lastModified)
        let isConflict = timeDifference < 1.0 && !valuesAreEqual(currentValue, newValue)

        if !isConflict {
            return nil
        }

        // Determine conflict type based on field and values
        let conflictType = determineConflictType(
            fieldName: fieldName,
            currentValue: currentValue,
            newValue: newValue
        )

        // Get dependency information
        let dependency = await extractDependency(
            tableName: tableName,
            recordId: recordId,
            fieldName: fieldName
        )

        // Create context data
        let contextData = createContextData(
            tableName: tableName,
            fieldName: fieldName,
            currentRecord: currentRecord
        )

        return ConflictData(
            id: UUID().uuidString,
            type: conflictType,
            tableName: tableName,
            recordId: recordId,
            fieldName: fieldName,
            localValue: String(describing: newValue),
            remoteValue: String(describing: currentValue),
            localTimestamp: localTimestamp,
            remoteTimestamp: lastModified,
            contextData: contextData,
            dependency: dependency,
            sequenceNumber: sequenceNumber,
            sessionId: nil // Would be provided by caller
        )
    }

    private func resolveConflict(_ conflict: ConflictData) async -> ConflictResolution {
        // Check if we have a learned pattern for this type of conflict
        let patternKey = "\(conflict.tableName):\(conflict.fieldName ?? ""):\(conflict.type.rawValue)"

        if let learnedStrategy = resolutionPatterns[patternKey] {
            return await applyResolutionStrategy(conflict: conflict, strategy: learnedStrategy)
        }

        // Determine strategy based on conflict type and merge-first philosophy
        let strategy = determineResolutionStrategy(conflict)

        return await applyResolutionStrategy(conflict: conflict, strategy: strategy)
    }

    private func determineResolutionStrategy(_ conflict: ConflictData) -> ResolutionStrategy {
        switch conflict.type {
        case .textEdit:
            // Text edits can often be automatically merged
            if let local = conflict.localValue,
               let remote = conflict.remoteValue,
               canMergeTextChanges(local: local, remote: remote) {
                return .mergeFirst
            } else {
                return .userChoice
            }

        case .propertyUpdate:
            // Simple property updates can use last-write-wins
            return .lastWriteWins

        case .relationshipChange, .structuralChange:
            // Complex changes require user input
            return .deferred

        case .deletion:
            // Deletions are complex and require user decision
            return .userChoice

        case .concurrent:
            // Concurrent changes use merge-first approach
            return .mergeFirst
        }
    }

    private func applyResolutionStrategy(
        conflict: ConflictData,
        strategy: ResolutionStrategy
    ) async -> ConflictResolution {

        switch strategy {
        case .automatic, .mergeFirst:
            if let mergedValue = await attemptAutoMerge(conflict: conflict) {
                do {
                    if let fieldName = conflict.fieldName {
                        try await database.updateRecord(
                            table: conflict.tableName,
                            id: conflict.recordId,
                            changes: [fieldName: mergedValue]
                        )
                    }

                    return ConflictResolution(
                        conflictId: conflict.id,
                        strategy: strategy,
                        resolvedValue: mergedValue,
                        requiresUserInput: false,
                        autoResolved: true,
                        explanation: "Automatically merged using merge-first strategy"
                    )
                } catch {
                    // Fall back to user choice if auto-merge fails
                    return ConflictResolution(
                        conflictId: conflict.id,
                        strategy: .userChoice,
                        resolvedValue: nil,
                        requiresUserInput: true,
                        autoResolved: false,
                        explanation: "Auto-merge failed, requires user input"
                    )
                }
            }

            // Fall back to user choice
            return ConflictResolution(
                conflictId: conflict.id,
                strategy: .userChoice,
                resolvedValue: nil,
                requiresUserInput: true,
                autoResolved: false,
                explanation: "Unable to auto-merge, requires user decision"
            )

        case .lastWriteWins:
            let resolvedValue = conflict.localTimestamp > conflict.remoteTimestamp ?
                conflict.localValue : conflict.remoteValue

            do {
                if let fieldName = conflict.fieldName, let value = resolvedValue {
                    try await database.updateRecord(
                        table: conflict.tableName,
                        id: conflict.recordId,
                        changes: [fieldName: value]
                    )
                }

                return ConflictResolution(
                    conflictId: conflict.id,
                    strategy: strategy,
                    resolvedValue: resolvedValue,
                    requiresUserInput: false,
                    autoResolved: true,
                    explanation: "Resolved using last-write-wins strategy"
                )
            } catch {
                return ConflictResolution(
                    conflictId: conflict.id,
                    strategy: .userChoice,
                    resolvedValue: nil,
                    requiresUserInput: true,
                    autoResolved: false,
                    explanation: "Last-write-wins failed, requires user input"
                )
            }

        case .firstWriteWins:
            let resolvedValue = conflict.localTimestamp < conflict.remoteTimestamp ?
                conflict.localValue : conflict.remoteValue

            do {
                if let fieldName = conflict.fieldName, let value = resolvedValue {
                    try await database.updateRecord(
                        table: conflict.tableName,
                        id: conflict.recordId,
                        changes: [fieldName: value]
                    )
                }

                return ConflictResolution(
                    conflictId: conflict.id,
                    strategy: strategy,
                    resolvedValue: resolvedValue,
                    requiresUserInput: false,
                    autoResolved: true,
                    explanation: "Resolved using first-write-wins strategy"
                )
            } catch {
                return ConflictResolution(
                    conflictId: conflict.id,
                    strategy: .userChoice,
                    resolvedValue: nil,
                    requiresUserInput: true,
                    autoResolved: false,
                    explanation: "First-write-wins failed, requires user input"
                )
            }

        case .userChoice, .deferred:
            return ConflictResolution(
                conflictId: conflict.id,
                strategy: strategy,
                resolvedValue: nil,
                requiresUserInput: true,
                autoResolved: false,
                explanation: "Requires user decision for resolution"
            )
        }
    }

    // Helper methods for conflict analysis

    private func valuesAreEqual(_ value1: Any, _ value2: Any) -> Bool {
        // Simple equality check - could be enhanced with type-specific comparison
        return String(describing: value1) == String(describing: value2)
    }

    private func determineConflictType(fieldName: String, currentValue: Any, newValue: Any) -> ConflictType {
        if fieldName.contains("text") || fieldName.contains("content") || fieldName.contains("description") {
            return .textEdit
        } else if fieldName.contains("_id") || fieldName.contains("parent") || fieldName.contains("child") {
            return .relationshipChange
        } else if fieldName == "deleted_at" {
            return .deletion
        } else {
            return .propertyUpdate
        }
    }

    private func canMergeTextChanges(local: String, remote: String) -> Bool {
        // Simple text merge feasibility check
        let localLines = local.components(separatedBy: .newlines)
        let remoteLines = remote.components(separatedBy: .newlines)

        // If both versions have similar length, likely mergeable
        let lengthRatio = Double(min(localLines.count, remoteLines.count)) / Double(max(localLines.count, remoteLines.count))

        return lengthRatio >= options.mergeFirstThreshold
    }

    private func attemptAutoMerge(conflict: ConflictData) async -> String? {
        guard let localValue = conflict.localValue,
              let remoteValue = conflict.remoteValue else {
            return nil
        }

        switch conflict.type {
        case .textEdit:
            // Simple line-based merge
            return mergeTextContent(local: localValue, remote: remoteValue)
        case .propertyUpdate:
            // Use most recent value for properties
            return conflict.localTimestamp > conflict.remoteTimestamp ? localValue : remoteValue
        default:
            return nil
        }
    }

    private func mergeTextContent(local: String, remote: String) -> String? {
        let localLines = local.components(separatedBy: .newlines)
        let remoteLines = remote.components(separatedBy: .newlines)

        // Simple merge: combine unique lines from both versions
        var mergedLines = Set<String>()
        mergedLines.formUnion(localLines)
        mergedLines.formUnion(remoteLines)

        return mergedLines.sorted().joined(separator: "\n")
    }

    private func sortConflictsByDependency(_ conflicts: [ConflictData]) async -> [ConflictData] {
        // Simple dependency sorting - could be enhanced with graph analysis
        return conflicts.sorted { (c1, c2) in
            // Resolve relationship changes before property updates
            if c1.type == .relationshipChange && c2.type != .relationshipChange {
                return true
            } else if c1.type != .relationshipChange && c2.type == .relationshipChange {
                return false
            }

            // Otherwise sort by timestamp
            return c1.localTimestamp < c2.localTimestamp
        }
    }

    private func extractDependency(tableName: String, recordId: String, fieldName: String) async -> String? {
        // Extract dependency information based on field relationships
        if fieldName.hasSuffix("_id") {
            return fieldName
        }
        return nil
    }

    private func createContextData(tableName: String, fieldName: String, currentRecord: [String: Any]) -> [String: String] {
        var context: [String: String] = [:]

        context["table"] = tableName
        context["field"] = fieldName

        // Add relevant context fields
        if let title = currentRecord["title"] as? String {
            context["title"] = title
        }
        if let type = currentRecord["type"] as? String {
            context["type"] = type
        }

        return context
    }

    private func fetchRelatedRecords(tableName: String, recordId: String) async throws -> [[String: Any]] {
        // Fetch related records based on relationships
        // This would be enhanced with actual relationship discovery
        return []
    }

    private func learnResolutionPattern(conflict: ConflictData, strategy: ResolutionStrategy) {
        let patternKey = "\(conflict.tableName):\(conflict.fieldName ?? ""):\(conflict.type.rawValue)"
        resolutionPatterns[patternKey] = strategy

        logger.debug("Learned resolution pattern: \(patternKey) -> \(strategy.rawValue)")
    }

    private func limitConflictLog() {
        if conflictLog.count > 1000 {
            conflictLog.removeFirst(conflictLog.count - 1000)
        }
    }

    private func startDeferredConflictCleanup() {
        // Clean up old deferred conflicts periodically
        Task {
            while !Task.isCancelled {
                try await Task.sleep(nanoseconds: 3600_000_000_000) // 1 hour
                await cleanupDeferredConflicts()
            }
        }
    }

    private func cleanupDeferredConflicts() {
        let now = Date().timeIntervalSince1970
        let expiredConflicts = deferredConflicts.filter { (_, conflict) in
            (now - conflict.localTimestamp) > options.maxDeferralTime
        }

        for (conflictId, _) in expiredConflicts {
            deferredConflicts.removeValue(forKey: conflictId)
            logger.info("Cleaned up expired deferred conflict: \(conflictId)")
        }
    }

    private func notifyConflictResolution(bridge: ChangeNotificationBridge, resolution: ConflictResolution) async {
        // Notify the bridge of conflict resolution for UI updates
        let message = [
            "type": "conflict_resolution",
            "conflictId": resolution.conflictId,
            "strategy": resolution.strategy.rawValue,
            "autoResolved": resolution.autoResolved,
            "requiresUserInput": resolution.requiresUserInput,
            "timestamp": resolution.resolutionTimestamp
        ] as [String: Any]

        await bridge.notifyWebView(message: message)
    }
}

// MARK: - Database Extensions

extension IsometryDatabase {
    func fetchRecord(table: String, id: String) async throws -> [String: Any]? {
        return try await read { db in
            try Row.fetchOne(db, sql: "SELECT * FROM \(table) WHERE id = ?", arguments: [id])?.dictionaryValue
        }
    }

    func updateRecord(table: String, id: String, changes: [String: Any]) async throws {
        try await write { db in
            let setPairs = changes.keys.map { "\($0) = ?" }.joined(separator: ", ")
            let sql = "UPDATE \(table) SET \(setPairs), lastModified = ? WHERE id = ?"
            let arguments = Array(changes.values) + [Date().timeIntervalSince1970, id]
            try db.execute(sql: sql, arguments: StatementArguments(arguments))
        }
    }
}