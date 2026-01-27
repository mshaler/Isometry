import Foundation
import CloudKit
import GRDB

// Import IsometryDatabase
#if canImport(Isometry)
// For standalone compilation, define minimal database interface
#else
public actor IsometryDatabase {
    public static let shared = IsometryDatabase()
    private init() {}

    public func searchCommandHistory(query: String) async throws -> [HistoryEntry] { return [] }
    public func getRecentCommands(limit: Int, type: CommandType?) async throws -> [HistoryEntry] { return [] }
    public func getCommandsBySession(sessionId: String) async throws -> [HistoryEntry] { return [] }
    public func getCommandsForCard(cardId: String) async throws -> [HistoryEntry] { return [] }
    public func saveCommandHistory(_ entry: HistoryEntry) async throws {}
    public func cleanupOldHistory(olderThan: Date) async throws {}
}
#endif

// MARK: - Command History Manager

/// Comprehensive command history management with CloudKit sync and search
public actor CommandHistoryManager {
    private let database: IsometryDatabase
    private let maxHistorySize: Int
    private let retentionDays: Int
    private let cloudKitSync: Bool

    // In-memory cache for recent entries
    private var recentCache: [HistoryEntry] = []
    private let cacheSize: Int = 100

    public init(
        database: IsometryDatabase,
        maxHistorySize: Int = 1000,
        retentionDays: Int = 30,
        cloudKitSync: Bool = true
    ) {
        self.database = database
        self.maxHistorySize = maxHistorySize
        self.retentionDays = retentionDays
        self.cloudKitSync = cloudKitSync

        // Start cleanup timer
        Task {
            await startCleanupTimer()
        }
    }

    // MARK: - Command History Persistence

    /// Save executed command to history with metadata
    /// - Parameters:
    ///   - command: The shell command that was executed
    ///   - response: The command response with output and timing
    ///   - context: Optional notebook card context
    ///   - sessionId: Session identifier for grouping
    public func saveCommand(
        _ command: ShellCommand,
        response: CommandResponse? = nil,
        context: CommandContext? = nil,
        sessionId: String
    ) async throws {
        let entry = HistoryEntry(
            command: command.command,
            type: command.type,
            timestamp: command.timestamp,
            response: response,
            duration: response?.duration,
            cwd: command.cwd,
            context: context ?? command.context,
            sessionId: sessionId,
            success: response?.success
        )

        // Save to database
        try await database.saveCommandHistory(entry)

        // Update cache
        await updateCache(with: entry)

        // Trigger CloudKit sync if enabled
        if cloudKitSync {
            await syncToCloudKit(entry: entry)
        }
    }

    /// Search command history with filters and pagination
    /// - Parameters:
    ///   - filter: Search filter with query, type, date range, etc.
    ///   - limit: Maximum number of results (default 50)
    ///   - offset: Pagination offset (default 0)
    /// - Returns: Array of matching history entries
    public func searchHistory(
        filter: HistoryFilter,
        limit: Int = 50,
        offset: Int = 0
    ) async throws -> [HistoryEntry] {
        // Use FTS5 search for text queries
        if let searchQuery = filter.searchQuery, !searchQuery.isEmpty {
            return try await database.searchCommandHistory(query: searchQuery)
                .applyFilter(filter)
                .dropFirst(offset)
                .prefix(limit)
                .map { $0 }
        }

        // Use filtered recent commands for non-text searches
        let entries = try await database.getRecentCommands(limit: maxHistorySize, type: filter.type)
        return entries
            .applyFilter(filter)
            .dropFirst(offset)
            .prefix(limit)
            .map { $0 }
    }

    /// Get recent commands for shell navigation (up/down arrows)
    /// - Parameters:
    ///   - limit: Number of recent commands to retrieve
    ///   - type: Optional filter by command type
    /// - Returns: Recent commands in reverse chronological order
    public func getRecentCommands(limit: Int = 20, type: CommandType? = nil) async throws -> [HistoryEntry] {
        // Check cache first
        let cacheResults = recentCache
            .filter { entry in
                if let type = type {
                    return entry.type == type
                }
                return true
            }
            .prefix(limit)

        if cacheResults.count >= limit {
            return Array(cacheResults)
        }

        // Fallback to database
        return try await database.getRecentCommands(limit: limit, type: type)
    }

    /// Get commands for current session
    /// - Parameter sessionId: Session identifier
    /// - Returns: Commands from the current session
    public func getSessionHistory(sessionId: String) async throws -> [HistoryEntry] {
        return try await database.getCommandsBySession(sessionId: sessionId)
    }

    /// Get commands related to a specific notebook card
    /// - Parameter cardId: Notebook card identifier
    /// - Returns: Commands executed in context of the card
    public func getCommandsForCard(cardId: String) async throws -> [HistoryEntry] {
        return try await database.getCommandsForCard(cardId: cardId)
    }

    // MARK: - Command Suggestions

    /// Get command suggestions based on prefix and history frequency
    /// - Parameters:
    ///   - prefix: Command prefix to match
    ///   - limit: Maximum number of suggestions
    ///   - context: Optional context for relevance scoring
    /// - Returns: Suggested commands ranked by frequency and recency
    public func getCommandSuggestions(
        prefix: String,
        limit: Int = 10,
        context: CommandContext? = nil
    ) async throws -> [CommandSuggestion] {
        let lowercasePrefix = prefix.lowercased()

        // Get recent commands matching prefix
        let recentCommands = try await getRecentCommands(limit: 100)
        let matchingCommands = recentCommands.filter { entry in
            entry.command.lowercased().hasPrefix(lowercasePrefix)
        }

        // Calculate frequency and recency scores
        var suggestions: [CommandSuggestion] = []
        var commandFrequency: [String: Int] = [:]
        var lastUsed: [String: Date] = [:]

        for entry in matchingCommands {
            let command = entry.command
            commandFrequency[command] = (commandFrequency[command] ?? 0) + 1

            if let existing = lastUsed[command] {
                lastUsed[command] = max(existing, entry.timestamp)
            } else {
                lastUsed[command] = entry.timestamp
            }
        }

        // Create suggestions with scoring
        for (command, frequency) in commandFrequency {
            let lastUse = lastUsed[command] ?? Date.distantPast
            let recencyScore = calculateRecencyScore(date: lastUse)
            let contextScore = calculateContextScore(command: command, context: context)

            let suggestion = CommandSuggestion(
                command: command,
                frequency: frequency,
                lastUsed: lastUse,
                score: Double(frequency) * recencyScore * contextScore
            )
            suggestions.append(suggestion)
        }

        // Sort by score and return top suggestions
        return suggestions
            .sorted { $0.score > $1.score }
            .prefix(limit)
            .map { $0 }
    }

    /// Get favorite commands based on frequency and success rate
    /// - Parameter limit: Maximum number of favorites
    /// - Returns: Most frequently used successful commands
    public func getFavoriteCommands(limit: Int = 10) async throws -> [FavoriteCommand] {
        let recentCommands = try await getRecentCommands(limit: 500)
        var commandStats: [String: CommandStats] = [:]

        // Calculate statistics for each command
        for entry in recentCommands {
            let command = entry.command
            if var stats = commandStats[command] {
                stats.totalUses += 1
                if entry.success == true {
                    stats.successfulUses += 1
                }
                stats.lastUsed = max(stats.lastUsed, entry.timestamp)
                commandStats[command] = stats
            } else {
                commandStats[command] = CommandStats(
                    command: command,
                    totalUses: 1,
                    successfulUses: entry.success == true ? 1 : 0,
                    lastUsed: entry.timestamp
                )
            }
        }

        // Convert to favorites with scoring
        let favorites = commandStats.values.compactMap { stats -> FavoriteCommand? in
            guard stats.totalUses >= 2 else { return nil } // Must be used at least twice

            let successRate = Double(stats.successfulUses) / Double(stats.totalUses)
            let recencyScore = calculateRecencyScore(date: stats.lastUsed)
            let score = Double(stats.totalUses) * successRate * recencyScore

            return FavoriteCommand(
                command: stats.command,
                useCount: stats.totalUses,
                successRate: successRate,
                lastUsed: stats.lastUsed,
                score: score
            )
        }

        return favorites
            .sorted { $0.score > $1.score }
            .prefix(limit)
            .map { $0 }
    }

    // MARK: - Cache Management

    /// Update in-memory cache with new entry
    private func updateCache(with entry: HistoryEntry) async {
        recentCache.insert(entry, at: 0)

        // Maintain cache size
        if recentCache.count > cacheSize {
            recentCache = Array(recentCache.prefix(cacheSize))
        }
    }

    /// Invalidate cache to force refresh from database
    public func invalidateCache() async {
        recentCache.removeAll()
    }

    // MARK: - CloudKit Synchronization

    /// Sync command history entry to CloudKit
    private func syncToCloudKit(entry: HistoryEntry) async {
        guard cloudKitSync else { return }

        // Convert to CKRecord and save
        let record = entry.cloudKitRecord

        // TODO: Implement CloudKit save operation
        // This would integrate with existing CloudKitSyncManager
    }

    // MARK: - Cleanup and Maintenance

    /// Start automatic cleanup timer
    private func startCleanupTimer() async {
        let cleanupInterval: TimeInterval = 24 * 60 * 60 // 24 hours

        while true {
            try? await Task.sleep(for: .seconds(cleanupInterval))
            await performCleanup()
        }
    }

    /// Perform cleanup of old history entries
    private func performCleanup() async {
        let cutoffDate = Calendar.current.date(byAdding: .day, value: -retentionDays, to: Date()) ?? Date()

        do {
            try await database.cleanupOldHistory(olderThan: cutoffDate)
            await invalidateCache() // Refresh cache after cleanup
        } catch {
            // Log cleanup error but continue operation
            print("Command history cleanup failed: \(error)")
        }
    }

    /// Manually trigger cleanup
    public func cleanup() async throws {
        await performCleanup()
    }

    // MARK: - Statistics and Analytics

    /// Get command usage statistics for the current session
    /// - Parameter sessionId: Session identifier
    /// - Returns: Session statistics
    public func getSessionStatistics(sessionId: String) async throws -> SessionStatistics {
        let sessionCommands = try await getSessionHistory(sessionId: sessionId)

        let totalCommands = sessionCommands.count
        let successfulCommands = sessionCommands.filter { $0.success == true }.count
        let systemCommands = sessionCommands.filter { $0.type == .system }.count
        let claudeCommands = sessionCommands.filter { $0.type == .claude }.count

        let totalDuration = sessionCommands.compactMap { $0.duration }.reduce(0, +)
        let averageDuration = totalCommands > 0 ? totalDuration / Double(totalCommands) : 0

        return SessionStatistics(
            sessionId: sessionId,
            totalCommands: totalCommands,
            successfulCommands: successfulCommands,
            systemCommands: systemCommands,
            claudeCommands: claudeCommands,
            successRate: totalCommands > 0 ? Double(successfulCommands) / Double(totalCommands) : 0,
            averageDuration: averageDuration,
            totalDuration: totalDuration
        )
    }

    // MARK: - Helper Methods

    /// Calculate recency score based on how recently command was used
    private func calculateRecencyScore(date: Date) -> Double {
        let daysSinceUse = Date().timeIntervalSince(date) / (24 * 60 * 60)
        return max(0.1, 1.0 / (1.0 + daysSinceUse * 0.1))
    }

    /// Calculate context relevance score
    private func calculateContextScore(command: String, context: CommandContext?) -> Double {
        guard let context = context else { return 1.0 }

        // Boost score for commands historically used with this card
        // This would require additional context analysis
        return 1.0
    }
}

// MARK: - Supporting Models

/// Command suggestion with ranking
public struct CommandSuggestion: Identifiable {
    public let id = UUID()
    public let command: String
    public let frequency: Int
    public let lastUsed: Date
    public let score: Double

    public init(command: String, frequency: Int, lastUsed: Date, score: Double) {
        self.command = command
        self.frequency = frequency
        self.lastUsed = lastUsed
        self.score = score
    }
}

/// Favorite command with usage statistics
public struct FavoriteCommand: Identifiable {
    public let id = UUID()
    public let command: String
    public let useCount: Int
    public let successRate: Double
    public let lastUsed: Date
    public let score: Double

    public init(command: String, useCount: Int, successRate: Double, lastUsed: Date, score: Double) {
        self.command = command
        self.useCount = useCount
        self.successRate = successRate
        self.lastUsed = lastUsed
        self.score = score
    }
}

/// Command statistics for analysis
private struct CommandStats {
    var command: String
    var totalUses: Int
    var successfulUses: Int
    var lastUsed: Date
}

/// Session statistics summary
public struct SessionStatistics {
    public let sessionId: String
    public let totalCommands: Int
    public let successfulCommands: Int
    public let systemCommands: Int
    public let claudeCommands: Int
    public let successRate: Double
    public let averageDuration: TimeInterval
    public let totalDuration: TimeInterval

    public init(
        sessionId: String,
        totalCommands: Int,
        successfulCommands: Int,
        systemCommands: Int,
        claudeCommands: Int,
        successRate: Double,
        averageDuration: TimeInterval,
        totalDuration: TimeInterval
    ) {
        self.sessionId = sessionId
        self.totalCommands = totalCommands
        self.successfulCommands = successfulCommands
        self.systemCommands = systemCommands
        self.claudeCommands = claudeCommands
        self.successRate = successRate
        self.averageDuration = averageDuration
        self.totalDuration = totalDuration
    }
}

// MARK: - Enhanced HistoryEntry

extension HistoryEntry {
    /// Enhanced initializer with session and success tracking
    public init(
        command: String,
        type: CommandType,
        timestamp: Date = Date(),
        response: CommandResponse? = nil,
        duration: TimeInterval? = nil,
        cwd: String? = nil,
        context: CommandContext? = nil,
        sessionId: String,
        success: Bool? = nil
    ) {
        self.id = UUID()
        self.command = command
        self.type = type
        self.timestamp = timestamp
        self.response = response
        self.duration = duration
        self.cwd = cwd
        self.context = context
        self.sessionId = sessionId
        self.success = success ?? response?.success ?? false
    }


    /// Success status derived from response
    public var derivedSuccess: Bool? {
        return response?.success
    }

    /// Convert to CloudKit record for synchronization
    public var cloudKitRecord: CKRecord {
        let record = CKRecord(recordType: "CommandHistory", recordID: CKRecord.ID(recordName: id.uuidString))
        record["command"] = command
        record["type"] = type.rawValue
        record["timestamp"] = timestamp
        record["duration"] = duration
        record["cwd"] = cwd
        record["sessionId"] = sessionId
        record["success"] = success

        if let context = context {
            record["contextCardId"] = context.cardId?.uuidString
            record["contextCardTitle"] = context.cardTitle
        }

        if let response = response {
            record["output"] = response.output
            record["error"] = response.error
        }

        return record
    }
}

// MARK: - Filter Extensions

extension Array where Element == HistoryEntry {
    /// Apply history filter to array of entries
    public func applyFilter(_ filter: HistoryFilter) -> [HistoryEntry] {
        return self.filter { entry in
            // Type filter
            if let typeFilter = filter.type, entry.type != typeFilter {
                return false
            }

            // Date range filter
            if let dateRange = filter.dateRange {
                if entry.timestamp < dateRange.start || entry.timestamp > dateRange.end {
                    return false
                }
            }

            // Success filter
            if let successFilter = filter.success {
                if entry.success != successFilter {
                    return false
                }
            }

            // Session filter
            if let sessionFilter = filter.sessionId {
                if entry.sessionId != sessionFilter {
                    return false
                }
            }

            // Context filter (card-based)
            if let cardFilter = filter.cardId {
                if entry.context?.cardId?.uuidString != cardFilter {
                    return false
                }
            }

            return true
        }.sorted { $0.timestamp > $1.timestamp } // Most recent first
    }
}

// MARK: - Enhanced HistoryFilter

extension HistoryFilter {
    /// Session identifier filter
    public var sessionId: String? { nil }

    /// Card identifier filter
    public var cardId: String? { nil }

    /// Enhanced initializer with additional filters
    public init(
        type: CommandType? = nil,
        dateRange: DateRange? = nil,
        searchQuery: String? = nil,
        success: Bool? = nil,
        sessionId: String? = nil,
        cardId: String? = nil
    ) {
        self.type = type
        self.dateRange = dateRange
        self.searchQuery = searchQuery
        self.success = success
        // Note: sessionId and cardId would need to be added to the struct definition
    }

    /// Quick filter presets
    public static func today() -> HistoryFilter {
        let startOfDay = Calendar.current.startOfDay(for: Date())
        let endOfDay = Calendar.current.date(byAdding: .day, value: 1, to: startOfDay) ?? Date()
        return HistoryFilter(dateRange: DateRange(start: startOfDay, end: endOfDay))
    }

    public static func successful() -> HistoryFilter {
        return HistoryFilter(success: true)
    }

    public static func failed() -> HistoryFilter {
        return HistoryFilter(success: false)
    }

    public static func claudeCommands() -> HistoryFilter {
        return HistoryFilter(type: .claude)
    }

    public static func systemCommands() -> HistoryFilter {
        return HistoryFilter(type: .system)
    }
}