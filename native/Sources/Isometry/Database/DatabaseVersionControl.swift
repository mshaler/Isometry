import Foundation
import GRDB

/// GSD-based Database Version Control System
/// Provides git-like branching, merging, and rollback for all database changes
/// Enables parallel analytics and synthetic operations with isolation
public actor DatabaseVersionControl {
    private let database: IsometryDatabase
    private let storageManager: ContentAwareStorageManager
    private var activeBranches: [String: DatabaseBranch] = [:]
    private var currentBranch: String = "main"

    public init(database: IsometryDatabase, storageManager: ContentAwareStorageManager) {
        self.database = database
        self.storageManager = storageManager

        // Initialize main branch
        let mainBranch = DatabaseBranch(
            name: "main",
            id: UUID(),
            parentId: nil,
            createdAt: Date(),
            createdBy: "system",
            description: "Main production branch",
            isProtected: true,
            changeCount: 0,
            lastCommit: nil
        )
        activeBranches["main"] = mainBranch
    }

    // MARK: - Branch Operations (GSD Pattern)

    /// Creates a new branch from current HEAD
    public func createBranch(
        name: String,
        description: String? = nil,
        fromBranch: String? = nil,
        creator: String = "user"
    ) async throws -> DatabaseBranch {

        let sourceBranch = fromBranch ?? currentBranch

        guard let parentBranch = activeBranches[sourceBranch] else {
            throw DatabaseVersionError.branchNotFound(sourceBranch)
        }

        guard activeBranches[name] == nil else {
            throw DatabaseVersionError.branchAlreadyExists(name)
        }

        // Phase 1: Create branch snapshot
        let branchId = UUID()
        let snapshot = try await createDatabaseSnapshot(
            branchId: branchId,
            description: "Branch \(name) created from \(sourceBranch)"
        )

        // Phase 2: Initialize branch structure
        let branch = DatabaseBranch(
            name: name,
            id: branchId,
            parentId: parentBranch.id,
            createdAt: Date(),
            createdBy: creator,
            description: description ?? "Branch created from \(sourceBranch)",
            isProtected: false,
            changeCount: 0,
            lastCommit: snapshot.commitId
        )

        // Phase 3: Register branch
        activeBranches[name] = branch
        try await database.insertBranch(branch)
        try await database.insertSnapshot(snapshot)

        print("✅ Branch '\(name)' created from '\(sourceBranch)'")
        return branch
    }

    /// Switches to a different branch
    public func switchBranch(_ branchName: String) async throws {
        guard let targetBranch = activeBranches[branchName] else {
            throw DatabaseVersionError.branchNotFound(branchName)
        }

        // Phase 1: Commit any uncommitted changes on current branch
        try await commitPendingChanges(reason: "Auto-commit before branch switch")

        // Phase 2: Apply branch state
        try await applyBranchState(targetBranch)

        // Phase 3: Update current branch
        currentBranch = branchName

        print("✅ Switched to branch '\(branchName)'")
    }

    /// Merges source branch into target branch
    public func mergeBranch(
        from sourceBranch: String,
        into targetBranch: String,
        strategy: MergeStrategy = .autoResolve,
        commitMessage: String? = nil
    ) async throws -> DatabaseMergeResult {

        guard let source = activeBranches[sourceBranch] else {
            throw DatabaseVersionError.branchNotFound(sourceBranch)
        }

        guard let target = activeBranches[targetBranch] else {
            throw DatabaseVersionError.branchNotFound(targetBranch)
        }

        // Phase 1: Analyze merge conflicts
        let conflicts = try await analyzeMergeConflicts(from: source, into: target)

        if !conflicts.isEmpty && strategy == .autoResolve {
            throw DatabaseVersionError.mergeConflicts(conflicts)
        }

        // Phase 2: Create merge commit
        let mergeCommit = try await performMerge(
            from: source,
            into: target,
            conflicts: conflicts,
            strategy: strategy,
            message: commitMessage
        )

        // Phase 3: Update branch state
        try await updateBranchAfterMerge(target, mergeCommit: mergeCommit)

        let result = DatabaseMergeResult(
            mergeCommitId: mergeCommit.id,
            conflictsResolved: conflicts.count,
            mergedChanges: mergeCommit.changeCount,
            strategy: strategy,
            completedAt: Date()
        )

        print("✅ Merged '\(sourceBranch)' into '\(targetBranch)' - \(conflicts.count) conflicts resolved")
        return result
    }

    /// Rolls back to a previous commit
    public func rollback(
        to commitId: UUID,
        preserveChanges: Bool = false
    ) async throws -> DatabaseRollbackResult {

        let targetCommit = try await database.getCommit(id: commitId)
        guard let commit = targetCommit else {
            throw DatabaseVersionError.commitNotFound(commitId)
        }

        // Phase 1: Create safety snapshot if preserving changes
        var safetySnapshot: DatabaseSnapshot? = nil
        if preserveChanges {
            safetySnapshot = try await createDatabaseSnapshot(
                branchId: UUID(),
                description: "Safety snapshot before rollback"
            )
        }

        // Phase 2: Apply rollback
        try await applyRollback(to: commit)

        // Phase 3: Update branch state
        guard let currentBranchObj = activeBranches[currentBranch] else {
            throw DatabaseVersionError.branchNotFound(currentBranch)
        }

        var updatedBranch = currentBranchObj
        updatedBranch.lastCommit = commitId
        updatedBranch.changeCount += 1
        activeBranches[currentBranch] = updatedBranch

        let result = DatabaseRollbackResult(
            targetCommitId: commitId,
            rollbackCommitId: UUID(),
            preservedChanges: safetySnapshot != nil,
            safetySnapshotId: safetySnapshot?.id,
            completedAt: Date()
        )

        print("✅ Rolled back to commit \(commitId.uuidString.prefix(8))")
        return result
    }

    // MARK: - Parallel Analytics Support

    /// Creates an analytics branch for parallel data processing
    public func createAnalyticsBranch(
        name: String,
        basedOn: String? = nil,
        configuration: AnalyticsConfiguration
    ) async throws -> AnalyticsBranch {

        let sourceBranch = basedOn ?? currentBranch
        let branch = try await createBranch(
            name: "analytics/\(name)",
            description: "Analytics branch for \(configuration.analysisType)",
            fromBranch: sourceBranch,
            creator: "analytics_engine"
        )

        let analyticsBranch = AnalyticsBranch(
            baseBranch: branch,
            configuration: configuration,
            isolationLevel: .snapshot,
            temporaryTables: [],
            computedViews: [],
            isEphemeral: true
        )

        // Set up analytics-specific database structures
        try await setupAnalyticsEnvironment(analyticsBranch)

        return analyticsBranch
    }

    /// Creates synthetic data branch for testing and modeling
    public func createSyntheticBranch(
        name: String,
        generator: SyntheticDataGenerator,
        preserveSchema: Bool = true
    ) async throws -> SyntheticBranch {

        let branch = try await createBranch(
            name: "synthetic/\(name)",
            description: "Synthetic data branch - \(generator.description)",
            creator: "synthetic_engine"
        )

        let syntheticBranch = SyntheticBranch(
            baseBranch: branch,
            generator: generator,
            preserveSchema: preserveSchema,
            dataScale: generator.scale,
            isEphemeral: true
        )

        // Generate synthetic data
        try await generateSyntheticData(syntheticBranch)

        return syntheticBranch
    }

    // MARK: - Change Tracking and Commits

    /// Commits all pending changes with detailed tracking
    public func commit(
        message: String,
        author: String = "user",
        metadata: [String: String] = [:]
    ) async throws -> DatabaseCommit {

        // Phase 1: Collect all changes
        let changes = try await collectPendingChanges()

        guard !changes.isEmpty else {
            throw DatabaseVersionError.noChangesToCommit
        }

        // Phase 2: Create change diff
        let changeDiff = try await createChangeDiff(changes)

        // Phase 3: Store change artifacts
        let changeArtifacts = try await storeChangeArtifacts(changeDiff)

        // Phase 4: Create commit
        let commit = DatabaseCommit(
            id: UUID(),
            branchName: currentBranch,
            parentCommitId: activeBranches[currentBranch]?.lastCommit,
            message: message,
            author: author,
            timestamp: Date(),
            changeCount: changes.count,
            changeDiff: changeDiff,
            artifactIds: changeArtifacts.map(\.id),
            metadata: metadata
        )

        // Phase 5: Apply commit
        try await database.insertCommit(commit)

        // Phase 6: Update branch
        var currentBranchObj = activeBranches[currentBranch]!
        currentBranchObj.lastCommit = commit.id
        currentBranchObj.changeCount += 1
        activeBranches[currentBranch] = currentBranchObj

        print("✅ Committed \(changes.count) changes to '\(currentBranch)'")
        return commit
    }

    /// Gets detailed change history for a branch
    public func getChangeHistory(
        branch: String? = nil,
        limit: Int = 50,
        includeArtifacts: Bool = false
    ) async throws -> [DatabaseCommit] {

        let targetBranch = branch ?? currentBranch
        return try await database.getCommitHistory(
            branch: targetBranch,
            limit: limit,
            includeArtifacts: includeArtifacts
        )
    }

    // MARK: - Conflict Resolution

    /// Analyzes potential merge conflicts between branches
    private func analyzeMergeConflicts(
        from source: DatabaseBranch,
        into target: DatabaseBranch
    ) async throws -> [DatabaseConflict] {

        var conflicts: [DatabaseConflict] = []

        // Get changes from both branches since common ancestor
        let commonAncestor = try await findCommonAncestor(source, target)
        let sourceChanges = try await getChangesSince(source, commonAncestor)
        let targetChanges = try await getChangesSince(target, commonAncestor)

        // Detect conflicts
        for sourceChange in sourceChanges {
            for targetChange in targetChanges {
                if let conflict = detectConflict(sourceChange, targetChange) {
                    conflicts.append(conflict)
                }
            }
        }

        return conflicts
    }

    private func detectConflict(
        _ change1: DatabaseChange,
        _ change2: DatabaseChange
    ) -> DatabaseConflict? {

        // Same record modified in both branches
        if change1.recordId == change2.recordId &&
           change1.table == change2.table &&
           change1.operation != change2.operation {

            return DatabaseConflict(
                id: UUID(),
                type: .modificationConflict,
                table: change1.table,
                recordId: change1.recordId,
                sourceChange: change1,
                targetChange: change2,
                detectedAt: Date()
            )
        }

        return nil
    }

    // MARK: - Snapshot Management

    private func createDatabaseSnapshot(
        branchId: UUID,
        description: String
    ) async throws -> DatabaseSnapshot {

        // Create comprehensive database snapshot
        let snapshotId = UUID()
        let timestamp = Date()

        // Get current database state
        let tableStates = try await captureTableStates()
        let indexStates = try await captureIndexStates()
        let triggerStates = try await captureTriggerStates()

        // Store snapshot data using Content Aware Storage
        let snapshotData = DatabaseSnapshotData(
            tables: tableStates,
            indexes: indexStates,
            triggers: triggerStates,
            metadata: [
                "branch_id": branchId.uuidString,
                "timestamp": ISO8601DateFormatter().string(from: timestamp)
            ]
        )

        let snapshotContent = try JSONEncoder().encode(snapshotData)
        let storedSnapshot = try await storageManager.store(
            content: snapshotContent,
            filename: "snapshot-\(snapshotId.uuidString).json",
            mimeType: "application/json",
            metadata: [
                "type": "database_snapshot",
                "branch_id": branchId.uuidString,
                "description": description
            ]
        )

        return DatabaseSnapshot(
            id: snapshotId,
            commitId: UUID(),
            branchId: branchId,
            description: description,
            timestamp: timestamp,
            dataSize: snapshotContent.count,
            tableCount: tableStates.count,
            storageId: storedSnapshot.id
        )
    }

    // MARK: - Private Helper Methods

    private func commitPendingChanges(reason: String) async throws {
        let pendingChanges = try await collectPendingChanges()
        if !pendingChanges.isEmpty {
            _ = try await commit(message: reason, author: "system")
        }
    }

    private func applyBranchState(_ branch: DatabaseBranch) async throws {
        // Apply the database state for the specified branch
        if let lastCommit = branch.lastCommit {
            let commit = try await database.getCommit(id: lastCommit)
            if let commitData = commit {
                try await applyCommitState(commitData)
            }
        }
    }

    private func applyCommitState(_ commit: DatabaseCommit) async throws {
        // Apply the database changes from a specific commit
        // This would involve replaying the changeDiff
    }

    private func performMerge(
        from source: DatabaseBranch,
        into target: DatabaseBranch,
        conflicts: [DatabaseConflict],
        strategy: MergeStrategy,
        message: String?
    ) async throws -> DatabaseCommit {

        // Resolve conflicts based on strategy
        let resolvedChanges = try await resolveConflicts(conflicts, strategy: strategy)

        // Create merge commit
        return DatabaseCommit(
            id: UUID(),
            branchName: target.name,
            parentCommitId: target.lastCommit,
            message: message ?? "Merge '\(source.name)' into '\(target.name)'",
            author: "system",
            timestamp: Date(),
            changeCount: resolvedChanges.count,
            changeDiff: DatabaseChangeDiff(changes: resolvedChanges, conflicts: conflicts),
            artifactIds: [],
            metadata: [
                "merge_source": source.name,
                "merge_strategy": strategy.rawValue,
                "conflicts_count": String(conflicts.count)
            ]
        )
    }

    private func resolveConflicts(
        _ conflicts: [DatabaseConflict],
        strategy: MergeStrategy
    ) async throws -> [DatabaseChange] {

        var resolvedChanges: [DatabaseChange] = []

        for conflict in conflicts {
            switch strategy {
            case .autoResolve:
                throw DatabaseVersionError.mergeConflicts([conflict])

            case .preferSource:
                resolvedChanges.append(conflict.sourceChange)

            case .preferTarget:
                resolvedChanges.append(conflict.targetChange)

            case .manual:
                // Manual resolution would be handled through UI
                throw DatabaseVersionError.manualResolutionRequired([conflict])

            case .lastWriterWins:
                let latestChange = conflict.sourceChange.timestamp > conflict.targetChange.timestamp
                    ? conflict.sourceChange
                    : conflict.targetChange
                resolvedChanges.append(latestChange)
            }
        }

        return resolvedChanges
    }

    private func updateBranchAfterMerge(_ branch: DatabaseBranch, mergeCommit: DatabaseCommit) async throws {
        var updatedBranch = branch
        updatedBranch.lastCommit = mergeCommit.id
        updatedBranch.changeCount += 1
        activeBranches[branch.name] = updatedBranch
        try await database.updateBranch(updatedBranch)
    }

    private func applyRollback(to commit: DatabaseCommit) async throws {
        // Apply rollback by reversing changes from commit
        if let changeDiff = commit.changeDiff {
            for change in changeDiff.changes {
                try await reverseChange(change)
            }
        }
    }

    private func reverseChange(_ change: DatabaseChange) async throws {
        // Reverse a specific database change
        switch change.operation {
        case .insert:
            // Delete the inserted record
            try await database.deleteRecord(table: change.table, id: change.recordId)
        case .update:
            // Restore previous values
            if let previousValues = change.previousValues {
                try await database.updateRecord(table: change.table, id: change.recordId, values: previousValues.toDictionary())
            }
        case .delete:
            // Restore deleted record
            if let previousValues = change.previousValues {
                try await database.insertRecord(table: change.table, id: change.recordId, values: previousValues.toDictionary())
            }
        }
    }

    private func setupAnalyticsEnvironment(_ branch: AnalyticsBranch) async throws {
        // Set up temporary tables and views for analytics
        switch branch.configuration.analysisType {
        case .aggregation:
            try await createAggregationTables(branch)
        case .timeSeries:
            try await createTimeSeriesTables(branch)
        case .graph:
            try await createGraphAnalysisTables(branch)
        case .ml:
            try await createMLFeatureTables(branch)
        }
    }

    private func generateSyntheticData(_ branch: SyntheticBranch) async throws {
        // Generate synthetic data based on configuration
        let generator = branch.generator
        try await generator.generate(in: database, scale: branch.dataScale)
    }

    // MARK: - Change Collection and Analysis

    private func collectPendingChanges() async throws -> [DatabaseChange] {
        // Collect all uncommitted database changes
        return try await database.getPendingChanges()
    }

    private func createChangeDiff(_ changes: [DatabaseChange]) async throws -> DatabaseChangeDiff {
        return DatabaseChangeDiff(changes: changes, conflicts: [])
    }

    private func storeChangeArtifacts(_ diff: DatabaseChangeDiff) async throws -> [StoredContent] {
        var artifacts: [StoredContent] = []

        // Store change diff as artifact
        let diffData = try JSONEncoder().encode(diff)
        let storedDiff = try await storageManager.store(
            content: diffData,
            filename: "change-diff-\(UUID().uuidString).json",
            mimeType: "application/json",
            metadata: ["type": "change_diff"]
        )
        artifacts.append(storedDiff)

        return artifacts
    }

    // MARK: - State Capture Methods

    private func captureTableStates() async throws -> [DatabaseTableState] {
        return try await database.getAllTableStates()
    }

    private func captureIndexStates() async throws -> [DatabaseIndexState] {
        return try await database.getAllIndexStates()
    }

    private func captureTriggerStates() async throws -> [DatabaseTriggerState] {
        return try await database.getAllTriggerStates()
    }

    private func findCommonAncestor(_ branch1: DatabaseBranch, _ branch2: DatabaseBranch) async throws -> UUID? {
        // Find common ancestor commit between two branches
        return try await database.findCommonAncestor(branch1.id, branch2.id)
    }

    private func getChangesSince(_ branch: DatabaseBranch, _ ancestorCommit: UUID?) async throws -> [DatabaseChange] {
        return try await database.getChangesSince(branch.id, ancestorCommit)
    }

    // MARK: - Analytics Helper Methods

    private func createAggregationTables(_ branch: AnalyticsBranch) async throws {
        // Create temporary aggregation tables
    }

    private func createTimeSeriesTables(_ branch: AnalyticsBranch) async throws {
        // Create time series analysis tables
    }

    private func createGraphAnalysisTables(_ branch: AnalyticsBranch) async throws {
        // Create graph analysis tables
    }

    private func createMLFeatureTables(_ branch: AnalyticsBranch) async throws {
        // Create machine learning feature tables
    }
}

// MARK: - Supporting Types

public struct DatabaseBranch: Codable, Sendable {
    public var name: String
    public let id: UUID
    public let parentId: UUID?
    public let createdAt: Date
    public let createdBy: String
    public let description: String
    public let isProtected: Bool
    public var changeCount: Int
    public var lastCommit: UUID?
}

public struct DatabaseCommit: Codable, Sendable {
    public let id: UUID
    public let branchName: String
    public let parentCommitId: UUID?
    public let message: String
    public let author: String
    public let timestamp: Date
    public let changeCount: Int
    public let changeDiff: DatabaseChangeDiff?
    public let artifactIds: [UUID]
    public let metadata: [String: String]
}

// Type-safe database change values
public struct DatabaseChangeValues: Codable, Sendable {
    public let strings: [String: String]?
    public let numbers: [String: Double]?
    public let booleans: [String: Bool]?
    public let dates: [String: Date]?

    public init(strings: [String: String]? = nil, numbers: [String: Double]? = nil, booleans: [String: Bool]? = nil, dates: [String: Date]? = nil) {
        self.strings = strings
        self.numbers = numbers
        self.booleans = booleans
        self.dates = dates
    }

    /// Converts to [String: Any] format for database operations
    public func toDictionary() -> [String: Any] {
        var result: [String: Any] = [:]

        strings?.forEach { result[$0.key] = $0.value }
        numbers?.forEach { result[$0.key] = $0.value }
        booleans?.forEach { result[$0.key] = $0.value }
        dates?.forEach { result[$0.key] = $0.value }

        return result
    }
}

public struct DatabaseChange: Codable, Sendable {
    public let id: UUID
    public let table: String
    public let recordId: String
    public let operation: DatabaseOperation
    public let timestamp: Date
    public let previousValues: DatabaseChangeValues?
    public let newValues: DatabaseChangeValues?
    public let author: String
}

public enum DatabaseOperation: String, Codable, CaseIterable, Sendable {
    case insert = "INSERT"
    case update = "UPDATE"
    case delete = "DELETE"
}

public struct DatabaseChangeDiff: Codable, Sendable {
    public let changes: [DatabaseChange]
    public let conflicts: [DatabaseConflict]
}

public struct DatabaseConflict: Codable, Sendable {
    public let id: UUID
    public let type: ConflictType
    public let table: String
    public let recordId: String
    public let sourceChange: DatabaseChange
    public let targetChange: DatabaseChange
    public let detectedAt: Date
}

public enum ConflictType: String, Codable, CaseIterable, Sendable {
    case modificationConflict = "modification_conflict"
    case deletionConflict = "deletion_conflict"
    case schemaConflict = "schema_conflict"
}

public enum MergeStrategy: String, Codable, CaseIterable, Sendable {
    case autoResolve = "auto_resolve"
    case preferSource = "prefer_source"
    case preferTarget = "prefer_target"
    case manual = "manual"
    case lastWriterWins = "last_writer_wins"
}

public struct DatabaseSnapshot: Codable, Sendable {
    public let id: UUID
    public let commitId: UUID
    public let branchId: UUID
    public let description: String
    public let timestamp: Date
    public let dataSize: Int
    public let tableCount: Int
    public let storageId: UUID
}

public struct DatabaseSnapshotData: Codable, Sendable {
    public let tables: [DatabaseTableState]
    public let indexes: [DatabaseIndexState]
    public let triggers: [DatabaseTriggerState]
    public let metadata: [String: String]
}

public struct DatabaseTableState: Codable, Sendable {
    public let name: String
    public let schema: String
    public let rowCount: Int
    public let dataSize: Int
}

public struct DatabaseIndexState: Codable, Sendable {
    public let name: String
    public let table: String
    public let columns: [String]
    public let isUnique: Bool
}

public struct DatabaseTriggerState: Codable, Sendable {
    public let name: String
    public let table: String
    public let event: String
    public let timing: String
}

// MARK: - Analytics and Synthetic Data Support

public struct AnalyticsBranch: Sendable {
    public let baseBranch: DatabaseBranch
    public let configuration: AnalyticsConfiguration
    public let isolationLevel: IsolationLevel
    public var temporaryTables: [String]
    public var computedViews: [String]
    public let isEphemeral: Bool
}

// Type-safe analytics filters
public struct AnalyticsFilters: Codable, Sendable {
    public let stringFilters: [String: String]
    public let numericFilters: [String: Double]
    public let booleanFilters: [String: Bool]
    public let dateFilters: [String: Date]

    public init(stringFilters: [String: String] = [:], numericFilters: [String: Double] = [:], booleanFilters: [String: Bool] = [:], dateFilters: [String: Date] = [:]) {
        self.stringFilters = stringFilters
        self.numericFilters = numericFilters
        self.booleanFilters = booleanFilters
        self.dateFilters = dateFilters
    }
}

public struct AnalyticsConfiguration: Codable, Sendable {
    public let analysisType: AnalysisType
    public let targetTables: [String]
    public let timeRange: DateInterval?
    public let filters: AnalyticsFilters
    public let aggregations: [String]
}

public enum AnalysisType: String, Codable, CaseIterable, Sendable {
    case aggregation = "aggregation"
    case timeSeries = "time_series"
    case graph = "graph"
    case ml = "machine_learning"
}

public enum IsolationLevel: String, Codable, CaseIterable, Sendable {
    case snapshot = "snapshot"
    case readCommitted = "read_committed"
    case serializable = "serializable"
}

public struct SyntheticBranch: Sendable {
    public let baseBranch: DatabaseBranch
    public let generator: SyntheticDataGenerator
    public let preserveSchema: Bool
    public let dataScale: DataScale
    public let isEphemeral: Bool
}

public struct SyntheticDataGenerator: Sendable {
    public let description: String
    public let scale: DataScale

    public func generate(in database: IsometryDatabase, scale: DataScale) async throws {
        // Generate synthetic data based on configuration
    }
}

public enum DataScale: String, Codable, CaseIterable, Sendable {
    case small = "small"      // 1K records
    case medium = "medium"    // 10K records
    case large = "large"      // 100K records
    case xlarge = "xlarge"    // 1M records
}

// MARK: - Result Types

public struct DatabaseMergeResult: Sendable {
    public let mergeCommitId: UUID
    public let conflictsResolved: Int
    public let mergedChanges: Int
    public let strategy: MergeStrategy
    public let completedAt: Date
}

public struct DatabaseRollbackResult: Sendable {
    public let targetCommitId: UUID
    public let rollbackCommitId: UUID
    public let preservedChanges: Bool
    public let safetySnapshotId: UUID?
    public let completedAt: Date
}

// MARK: - Error Types

public enum DatabaseVersionError: LocalizedError {
    case branchNotFound(String)
    case branchAlreadyExists(String)
    case commitNotFound(UUID)
    case noChangesToCommit
    case mergeConflicts([DatabaseConflict])
    case manualResolutionRequired([DatabaseConflict])
    case protectedBranch(String)
    case invalidOperation(String)

    public var errorDescription: String? {
        switch self {
        case .branchNotFound(let name):
            return "Branch not found: \(name)"
        case .branchAlreadyExists(let name):
            return "Branch already exists: \(name)"
        case .commitNotFound(let id):
            return "Commit not found: \(id)"
        case .noChangesToCommit:
            return "No changes to commit"
        case .mergeConflicts(let conflicts):
            return "Merge conflicts detected: \(conflicts.count) conflicts"
        case .manualResolutionRequired(let conflicts):
            return "Manual conflict resolution required for \(conflicts.count) conflicts"
        case .protectedBranch(let name):
            return "Cannot modify protected branch: \(name)"
        case .invalidOperation(let description):
            return "Invalid operation: \(description)"
        }
    }
}

// MARK: - SwiftUI Integration

import SwiftUI
import Combine

/// ObservableObject wrapper for DatabaseVersionControl actor to enable SwiftUI integration
@MainActor
public class DatabaseVersionControlStore: ObservableObject {
    private let versionControl: DatabaseVersionControl

    @Published public var branches: [DatabaseBranch] = []
    @Published public var commits: [DatabaseCommit] = []
    @Published public var currentBranch: String = "main"
    @Published public var pendingChanges: [DatabaseChange] = []
    @Published public var isLoading: Bool = false
    @Published public var errorMessage: String?

    public init(versionControl: DatabaseVersionControl) {
        self.versionControl = versionControl
    }

    // MARK: - Branch Operations

    public func createBranch(name: String, description: String) async {
        isLoading = true
        errorMessage = nil

        do {
            try await versionControl.createBranch(name: name, description: description)
            await refreshBranches()
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    public func switchBranch(to name: String) async {
        isLoading = true
        errorMessage = nil

        do {
            try await versionControl.switchBranch(name)
            currentBranch = name
            await refreshAll()
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    public func deleteBranch(_ name: String) async {
        isLoading = true
        errorMessage = nil

        do {
            // TODO: Implement deleteBranch in DatabaseVersionControl actor
            // For now, just refresh the branches list
            await refreshBranches()
            // Placeholder: Remove from local state
            // try await versionControl.deleteBranch(name)
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Commit Operations

    public func commit(message: String) async {
        isLoading = true
        errorMessage = nil

        do {
            try await versionControl.commit(message: message, author: "User")
            await refreshAll()
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Merge Operations

    public func merge(branch: String) async {
        isLoading = true
        errorMessage = nil

        do {
            let _ = try await versionControl.mergeBranch(from: branch, into: currentBranch, strategy: .autoResolve)
            await refreshAll()
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Data Refresh

    public func refreshAll() async {
        await refreshBranches()
        await refreshCommits()
        await refreshPendingChanges()
    }

    private func refreshBranches() async {
        do {
            // TODO: Implement getAllBranches in DatabaseVersionControl actor
            branches = [] // Placeholder: Return empty array
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func refreshCommits() async {
        do {
            // TODO: Implement getBranchHistory in DatabaseVersionControl actor
            commits = [] // Placeholder: Return empty array
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func refreshPendingChanges() async {
        do {
            // TODO: Implement getPendingChanges in DatabaseVersionControl actor
            pendingChanges = [] // Placeholder: Return empty array
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}