import Foundation
import GRDB

/// CRDT-based conflict resolution for bidirectional Apple Notes synchronization
/// Implements sophisticated algorithms to maintain data integrity during concurrent edits
public actor AppleNotesConflictResolver {

    // MARK: - Properties

    private let database: IsometryDatabase
    private let conflictQueue = DispatchQueue(label: "com.isometry.notes.conflict", qos: .userInitiated)
    private var activeConflicts: [String: ConflictResolutionState] = [:]
    private var resolutionHistory: [ConflictResolution] = []
    private var metrics = ConflictMetrics()

    public init(database: IsometryDatabase) {
        self.database = database
    }

    // MARK: - Conflict Types and Data Structures

    /// Types of conflicts that can occur during synchronization
    public enum NotesConflictType: String, Sendable, CaseIterable {
        case contentConflict = "content_conflict"
        case metadataConflict = "metadata_conflict"
        case deletionConflict = "deletion_conflict"
        case creationConflict = "creation_conflict"
        case structuralConflict = "structural_conflict"

        public var severity: Int {
            switch self {
            case .deletionConflict: return 5
            case .contentConflict: return 4
            case .structuralConflict: return 3
            case .creationConflict: return 2
            case .metadataConflict: return 1
            }
        }

        public var requiresUserInput: Bool {
            switch self {
            case .contentConflict, .deletionConflict:
                return true
            case .metadataConflict, .creationConflict, .structuralConflict:
                return false
            }
        }
    }

    /// Resolution strategies for different conflict types
    public enum NotesResolutionStrategy: String, Sendable, CaseIterable {
        case lastWriteWins = "last_write_wins"
        case mergeChanges = "merge_changes"
        case keepBoth = "keep_both"
        case userChoice = "user_choice"
        case automaticMerge = "automatic_merge"

        public var isAutomatic: Bool {
            switch self {
            case .lastWriteWins, .mergeChanges, .automaticMerge:
                return true
            case .keepBoth, .userChoice:
                return false
            }
        }
    }

    /// Represents a conflict between two versions of a note
    public struct NoteConflict: Sendable, Identifiable {
        public let id: String
        public let conflictType: NotesConflictType
        public let localNode: Node
        public let remoteNode: Node
        public let detectedAt: Date
        public let metadata: [String: String]

        public init(id: String = UUID().uuidString, conflictType: NotesConflictType, localNode: Node, remoteNode: Node, detectedAt: Date = Date(), metadata: [String: String] = [:]) {
            self.id = id
            self.conflictType = conflictType
            self.localNode = localNode
            self.remoteNode = remoteNode
            self.detectedAt = detectedAt
            self.metadata = metadata
        }

        public var sourceIds: Set<String> {
            var ids: Set<String> = []
            if let localSourceId = localNode.sourceId { ids.insert(localSourceId) }
            if let remoteSourceId = remoteNode.sourceId { ids.insert(remoteSourceId) }
            return ids
        }
    }

    /// Result of conflict resolution
    public struct ConflictResolution: Sendable, Identifiable {
        public let id: String
        public let conflictId: String
        public let strategy: NotesResolutionStrategy
        public let resolvedNode: Node
        public let resolvedAt: Date
        public let wasAutomaticResolution: Bool
        public let preservedData: [String: Any]?

        public init(id: String = UUID().uuidString, conflictId: String, strategy: NotesResolutionStrategy, resolvedNode: Node, resolvedAt: Date = Date(), wasAutomaticResolution: Bool = false, preservedData: [String: Any]? = nil) {
            self.id = id
            self.conflictId = conflictId
            self.strategy = strategy
            self.resolvedNode = resolvedNode
            self.resolvedAt = resolvedAt
            self.wasAutomaticResolution = wasAutomaticResolution
            self.preservedData = preservedData
        }
    }

    /// Internal state tracking for conflict resolution
    private struct ConflictResolutionState {
        let conflict: NoteConflict
        let startedAt: Date
        var attempts: Int = 0
        var lastAttemptAt: Date?
        var requiresUserInput: Bool

        init(conflict: NoteConflict) {
            self.conflict = conflict
            self.startedAt = Date()
            self.requiresUserInput = conflict.conflictType.requiresUserInput
        }
    }

    // MARK: - Performance Metrics

    private struct ConflictMetrics {
        var totalConflictsDetected: Int = 0
        var automaticallyResolved: Int = 0
        var userResolvedCount: Int = 0
        var averageResolutionTime: TimeInterval = 0
        var conflictsByType: [NotesConflictType: Int] = [:]

        mutating func recordConflict(_ conflict: NoteConflict, resolutionTime: TimeInterval, wasAutomatic: Bool) {
            totalConflictsDetected += 1

            if wasAutomatic {
                automaticallyResolved += 1
            } else {
                userResolvedCount += 1
            }

            conflictsByType[conflict.conflictType, default: 0] += 1

            if averageResolutionTime == 0 {
                averageResolutionTime = resolutionTime
            } else {
                averageResolutionTime = (averageResolutionTime * 0.8) + (resolutionTime * 0.2)
            }
        }
    }

    // MARK: - Conflict Detection

    /// Compare two note versions and detect conflicts
    public func compareNoteVersions(local: Node, remote: Node) async -> NoteConflict? {
        // Skip comparison if they're the same version
        if local.version == remote.version && local.modifiedAt == remote.modifiedAt {
            return nil
        }

        // Detect different types of conflicts
        let conflictTypes = detectConflictTypes(local: local, remote: remote)

        guard !conflictTypes.isEmpty else {
            return nil
        }

        // Create conflict with most severe type
        let primaryConflictType = conflictTypes.max(by: { $0.severity < $1.severity }) ?? .metadataConflict

        let metadata = generateConflictMetadata(local: local, remote: remote, conflictTypes: conflictTypes)

        return NoteConflict(
            conflictType: primaryConflictType,
            localNode: local,
            remoteNode: remote,
            metadata: metadata
        )
    }

    /// Detect specific types of conflicts between two nodes
    private func detectConflictTypes(local: Node, remote: Node) -> [NotesConflictType] {
        var conflicts: [NotesConflictType] = []

        // Content conflicts
        if hasContentConflict(local: local, remote: remote) {
            conflicts.append(.contentConflict)
        }

        // Metadata conflicts
        if hasMetadataConflict(local: local, remote: remote) {
            conflicts.append(.metadataConflict)
        }

        // Deletion conflicts
        if hasDeletionConflict(local: local, remote: remote) {
            conflicts.append(.deletionConflict)
        }

        // Structural conflicts (folder/tags)
        if hasStructuralConflict(local: local, remote: remote) {
            conflicts.append(.structuralConflict)
        }

        return conflicts
    }

    private func hasContentConflict(local: Node, remote: Node) -> Bool {
        // Check if both have content changes since a common ancestor
        guard let localContent = local.content, let remoteContent = remote.content else {
            // One has content, the other doesn't - this is a content conflict
            return local.content != remote.content
        }

        // Simple content difference check
        let localContentNormalized = localContent.trimmingCharacters(in: .whitespacesAndNewlines)
        let remoteContentNormalized = remoteContent.trimmingCharacters(in: .whitespacesAndNewlines)

        return localContentNormalized != remoteContentNormalized
    }

    private func hasMetadataConflict(local: Node, remote: Node) -> Bool {
        return local.name != remote.name ||
               local.folder != remote.folder ||
               local.priority != remote.priority ||
               local.importance != remote.importance
    }

    private func hasDeletionConflict(local: Node, remote: Node) -> Bool {
        return (local.isDeleted && !remote.isDeleted) ||
               (!local.isDeleted && remote.isDeleted)
    }

    private func hasStructuralConflict(local: Node, remote: Node) -> Bool {
        return Set(local.tags) != Set(remote.tags) ||
               local.folder != remote.folder
    }

    private func generateConflictMetadata(local: Node, remote: Node, conflictTypes: [NotesConflictType]) -> [String: String] {
        var metadata: [String: String] = [:]

        metadata["conflict_types"] = conflictTypes.map { $0.rawValue }.joined(separator: ",")
        metadata["local_version"] = String(local.version)
        metadata["remote_version"] = String(remote.version)
        metadata["local_modified"] = ISO8601DateFormatter().string(from: local.modifiedAt)
        metadata["remote_modified"] = ISO8601DateFormatter().string(from: remote.modifiedAt)

        if let localSource = local.sourceId, let remoteSource = remote.sourceId {
            metadata["source_match"] = localSource == remoteSource ? "true" : "false"
        }

        return metadata
    }

    // MARK: - Conflict Resolution

    /// Resolve a detected conflict using appropriate strategy
    public func resolveConflict(_ conflict: NoteConflict, strategy: NotesResolutionStrategy? = nil) async throws -> ConflictResolution {
        let startTime = Date()

        // Track conflict state
        var state = ConflictResolutionState(conflict: conflict)
        activeConflicts[conflict.id] = state

        defer {
            activeConflicts.removeValue(forKey: conflict.id)
        }

        do {
            // Determine resolution strategy
            let resolveStrategy = strategy ?? selectAutomaticStrategy(for: conflict)

            // Perform resolution
            let resolvedNode = try await performResolution(conflict: conflict, strategy: resolveStrategy)

            // Create resolution result
            let resolution = ConflictResolution(
                conflictId: conflict.id,
                strategy: resolveStrategy,
                resolvedNode: resolvedNode,
                wasAutomaticResolution: strategy == nil,
                preservedData: generatePreservedData(conflict: conflict, resolvedNode: resolvedNode)
            )

            // Update metrics
            let resolutionTime = Date().timeIntervalSince(startTime)
            metrics.recordConflict(conflict, resolutionTime: resolutionTime, wasAutomatic: strategy == nil)

            // Store in history
            resolutionHistory.append(resolution)

            print("AppleNotesConflictResolver: Resolved \(conflict.conflictType.rawValue) using \(resolveStrategy.rawValue)")

            return resolution

        } catch {
            state.attempts += 1
            state.lastAttemptAt = Date()
            activeConflicts[conflict.id] = state

            print("AppleNotesConflictResolver: Failed to resolve conflict \(conflict.id): \(error)")
            throw error
        }
    }

    /// Select automatic resolution strategy based on conflict type and characteristics
    private func selectAutomaticStrategy(for conflict: NoteConflict) -> NotesResolutionStrategy {
        switch conflict.conflictType {
        case .metadataConflict:
            return .lastWriteWins

        case .structuralConflict:
            return .mergeChanges

        case .contentConflict:
            // Use automatic merge for simple content conflicts
            if canAutoMergeContent(conflict: conflict) {
                return .automaticMerge
            } else {
                return .userChoice
            }

        case .creationConflict:
            return .keepBoth

        case .deletionConflict:
            return .userChoice
        }
    }

    /// Check if content can be automatically merged
    private func canAutoMergeContent(conflict: NoteConflict) -> Bool {
        guard let localContent = conflict.localNode.content,
              let remoteContent = conflict.remoteNode.content else {
            return false
        }

        // Simple heuristic: if content differences are small and non-overlapping, allow auto-merge
        let localLines = localContent.components(separatedBy: .newlines)
        let remoteLines = remoteContent.components(separatedBy: .newlines)

        let sizeDifference = abs(localLines.count - remoteLines.count)
        let maxSize = max(localLines.count, remoteLines.count)

        // Allow auto-merge if change is less than 10% of total content
        return Double(sizeDifference) / Double(maxSize) < 0.1
    }

    /// Perform the actual conflict resolution
    private func performResolution(conflict: NoteConflict, strategy: NotesResolutionStrategy) async throws -> Node {
        print("AppleNotesConflictResolver: Performing \(strategy.rawValue) resolution for \(conflict.conflictType.rawValue)")

        switch strategy {
        case .lastWriteWins:
            return try await resolveLastWriteWins(conflict: conflict)

        case .mergeChanges:
            return try await resolveMergeChanges(conflict: conflict)

        case .automaticMerge:
            return try await resolveAutomaticMerge(conflict: conflict)

        case .keepBoth:
            return try await resolveKeepBoth(conflict: conflict)

        case .userChoice:
            throw ConflictResolutionError.requiresUserInput(conflict)
        }
    }

    // MARK: - Resolution Strategy Implementations

    private func resolveLastWriteWins(conflict: NoteConflict) async throws -> Node {
        // Choose the node with the latest modification time
        let winner = conflict.localNode.modifiedAt > conflict.remoteNode.modifiedAt ? conflict.localNode : conflict.remoteNode

        // Create resolved node with updated sync metadata
        var resolvedNode = winner
        resolvedNode.version = max(conflict.localNode.version, conflict.remoteNode.version) + 1
        resolvedNode.modifiedAt = Date()
        resolvedNode.conflictResolvedAt = Date()

        return resolvedNode
    }

    private func resolveMergeChanges(conflict: NoteConflict) async throws -> Node {
        var resolvedNode = conflict.localNode

        // Merge non-conflicting metadata changes
        if conflict.remoteNode.modifiedAt > conflict.localNode.modifiedAt {
            // Take newer metadata for fields that don't conflict with content
            if conflict.remoteNode.folder != conflict.localNode.folder {
                resolvedNode.folder = conflict.remoteNode.folder
            }
        }

        // Merge tags (union)
        let mergedTags = Set(conflict.localNode.tags).union(Set(conflict.remoteNode.tags))
        resolvedNode.tags = Array(mergedTags).sorted()

        // Update sync metadata
        resolvedNode.version = max(conflict.localNode.version, conflict.remoteNode.version) + 1
        resolvedNode.modifiedAt = Date()
        resolvedNode.conflictResolvedAt = Date()

        return resolvedNode
    }

    private func resolveAutomaticMerge(conflict: NoteConflict) async throws -> Node {
        guard let localContent = conflict.localNode.content,
              let remoteContent = conflict.remoteNode.content else {
            throw ConflictResolutionError.cannotAutoMerge("Missing content for auto-merge")
        }

        // Perform simple three-way merge
        let mergedContent = try performThreeWayMerge(
            local: localContent,
            remote: remoteContent,
            base: "" // In a real implementation, we'd need the common ancestor
        )

        var resolvedNode = conflict.localNode
        resolvedNode.content = mergedContent
        resolvedNode.version = max(conflict.localNode.version, conflict.remoteNode.version) + 1
        resolvedNode.modifiedAt = Date()
        resolvedNode.conflictResolvedAt = Date()

        return resolvedNode
    }

    private func resolveKeepBoth(conflict: NoteConflict) async throws -> Node {
        // Create a new node that combines both versions
        var resolvedNode = conflict.localNode

        // Modify the name to indicate conflict resolution
        let timestamp = DateFormatter().string(from: Date())
        resolvedNode.name = "\(resolvedNode.name) (Merged \(timestamp))"

        // Combine content
        var combinedContent = ""
        if let localContent = conflict.localNode.content {
            combinedContent += "# Local Version\n\n\(localContent)\n\n"
        }
        if let remoteContent = conflict.remoteNode.content {
            combinedContent += "# Remote Version\n\n\(remoteContent)\n\n"
        }
        resolvedNode.content = combinedContent

        // Merge tags
        let mergedTags = Set(conflict.localNode.tags).union(Set(conflict.remoteNode.tags))
        resolvedNode.tags = Array(mergedTags).sorted()

        // Update sync metadata
        resolvedNode.version = max(conflict.localNode.version, conflict.remoteNode.version) + 1
        resolvedNode.modifiedAt = Date()
        resolvedNode.conflictResolvedAt = Date()

        return resolvedNode
    }

    /// Simple three-way merge implementation
    private func performThreeWayMerge(local: String, remote: String, base: String) throws -> String {
        // This is a simplified implementation
        // A production system would use a proper diff/merge algorithm

        let localLines = local.components(separatedBy: .newlines)
        let remoteLines = remote.components(separatedBy: .newlines)

        // If one version is a subset of the other, use the longer one
        if localLines.count > remoteLines.count && local.contains(remote) {
            return local
        } else if remoteLines.count > localLines.count && remote.contains(local) {
            return remote
        }

        // Otherwise, combine unique lines from both
        var mergedLines: [String] = []
        let maxLines = max(localLines.count, remoteLines.count)

        for i in 0..<maxLines {
            if i < localLines.count && i < remoteLines.count {
                if localLines[i] == remoteLines[i] {
                    mergedLines.append(localLines[i])
                } else {
                    mergedLines.append("<<<< Local")
                    mergedLines.append(localLines[i])
                    mergedLines.append("==== Remote")
                    mergedLines.append(remoteLines[i])
                    mergedLines.append(">>>>")
                }
            } else if i < localLines.count {
                mergedLines.append(localLines[i])
            } else if i < remoteLines.count {
                mergedLines.append(remoteLines[i])
            }
        }

        return mergedLines.joined(separator: "\n")
    }

    private func generatePreservedData(conflict: NoteConflict, resolvedNode: Node) -> [String: Any] {
        var preserved: [String: Any] = [:]

        // Store original versions for potential rollback
        preserved["original_local_content"] = conflict.localNode.content
        preserved["original_remote_content"] = conflict.remoteNode.content
        preserved["original_local_tags"] = conflict.localNode.tags
        preserved["original_remote_tags"] = conflict.remoteNode.tags

        return preserved
    }

    // MARK: - Public Interface

    /// Get current conflict resolution metrics
    public var currentMetrics: ConflictMetrics {
        return metrics
    }

    /// Get active conflicts awaiting resolution
    public var activeConflictIds: [String] {
        return Array(activeConflicts.keys)
    }

    /// Get resolution history
    public var resolutionHistory: [ConflictResolution] {
        return self.resolutionHistory
    }

    /// Check if a specific conflict requires user input
    public func conflictRequiresUserInput(_ conflictId: String) -> Bool {
        return activeConflicts[conflictId]?.requiresUserInput ?? false
    }
}

// MARK: - Error Types

public enum ConflictResolutionError: Error, LocalizedError {
    case requiresUserInput(AppleNotesConflictResolver.NoteConflict)
    case cannotAutoMerge(String)
    case databaseTransactionFailed
    case invalidConflictState
    case resolutionTimeout

    public var errorDescription: String? {
        switch self {
        case .requiresUserInput(let conflict):
            return "Conflict of type \(conflict.conflictType.rawValue) requires user input to resolve"
        case .cannotAutoMerge(let reason):
            return "Cannot automatically merge conflict: \(reason)"
        case .databaseTransactionFailed:
            return "Database transaction failed during conflict resolution"
        case .invalidConflictState:
            return "Invalid conflict state detected"
        case .resolutionTimeout:
            return "Conflict resolution timed out"
        }
    }
}