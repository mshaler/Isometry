import Foundation
import CloudKit

// MARK: - Command Types

/// Type of shell command
public enum CommandType: String, CaseIterable, Codable, Sendable {
    case system = "system"
    case claude = "claude"
}

// MARK: - Shell Command Models

/// Represents a shell command with context
@MainActor
public struct ShellCommand: Identifiable, Codable, Sendable, Hashable {
    public let id: UUID
    public let type: CommandType
    public let command: String
    public let timestamp: Date
    public let cwd: String?
    public let context: CommandContext?

    public init(
        id: UUID = UUID(),
        type: CommandType,
        command: String,
        timestamp: Date = Date(),
        cwd: String? = nil,
        context: CommandContext? = nil
    ) {
        self.id = id
        self.type = type
        self.command = command
        self.timestamp = timestamp
        self.cwd = cwd
        self.context = context
    }
}

/// Command context linking to Isometry cards
@MainActor
public struct CommandContext: Codable, Sendable, Hashable {
    public let cardId: UUID?
    public let cardTitle: String?

    public init(cardId: UUID? = nil, cardTitle: String? = nil) {
        self.cardId = cardId
        self.cardTitle = cardTitle
    }
}

/// Response from command execution
@MainActor
public struct CommandResponse: Identifiable, Codable, Sendable {
    public let id: UUID
    public let commandId: UUID
    public let success: Bool
    public let output: String
    public let error: String?
    public let duration: TimeInterval
    public let type: CommandType
    public let metadata: ResponseMetadata?
    public let timestamp: Date

    public init(
        id: UUID = UUID(),
        commandId: UUID,
        success: Bool,
        output: String,
        error: String? = nil,
        duration: TimeInterval,
        type: CommandType,
        metadata: ResponseMetadata? = nil,
        timestamp: Date = Date()
    ) {
        self.id = id
        self.commandId = commandId
        self.success = success
        self.output = output
        self.error = error
        self.duration = duration
        self.type = type
        self.metadata = metadata
        self.timestamp = timestamp
    }
}

/// Additional metadata for command responses
@MainActor
public struct ResponseMetadata: Codable, Sendable {
    public let exitCode: Int32?
    public let workingDirectory: String?
    public let environment: [String: String]?

    public init(
        exitCode: Int32? = nil,
        workingDirectory: String? = nil,
        environment: [String: String]? = nil
    ) {
        self.exitCode = exitCode
        self.workingDirectory = workingDirectory
        self.environment = environment
    }
}

// MARK: - Session Management

/// Shell session containing command history and state
@MainActor
public final class ShellSession: ObservableObject, Sendable {
    @Published public private(set) var sessionId: UUID
    @Published public private(set) var commands: [ShellCommand] = []
    @Published public private(set) var currentDirectory: String
    @Published public private(set) var environmentVariables: [String: String] = [:]

    public init(
        sessionId: UUID = UUID(),
        currentDirectory: String = FileManager.default.currentDirectoryPath,
        environmentVariables: [String: String] = ProcessInfo.processInfo.environment
    ) {
        self.sessionId = sessionId
        self.currentDirectory = currentDirectory
        // Only include safe environment variables for App Sandbox
        self.environmentVariables = Self.filterSafeEnvironmentVariables(environmentVariables)
    }

    /// Add command to session history
    public func addCommand(_ command: ShellCommand) {
        commands.append(command)
        // Limit history to prevent memory growth
        if commands.count > 1000 {
            commands.removeFirst(commands.count - 1000)
        }
    }

    /// Update current working directory (within sandbox constraints)
    public func updateCurrentDirectory(_ path: String) {
        // Only allow directories within app container for App Sandbox compliance
        if isAllowedDirectory(path) {
            currentDirectory = path
        }
    }

    /// Filter environment variables for App Sandbox security
    private static func filterSafeEnvironmentVariables(_ env: [String: String]) -> [String: String] {
        let allowedKeys = [
            "PATH", "HOME", "USER", "LANG", "LC_ALL", "LC_CTYPE",
            "TMPDIR", "XPC_SERVICE_NAME"
        ]

        return env.filter { key, _ in
            allowedKeys.contains(key) || key.hasPrefix("ISOMETRY_")
        }
    }

    /// Check if directory path is allowed within App Sandbox
    private func isAllowedDirectory(_ path: String) -> Bool {
        let allowedPrefixes = [
            NSHomeDirectory(),
            NSTemporaryDirectory(),
            FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first?.path ?? "",
            FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first?.path ?? ""
        ]

        return allowedPrefixes.contains { prefix in
            path.hasPrefix(prefix)
        }
    }
}

// MARK: - History Management

/// Command history with persistence and search capabilities
public actor CommandHistory {
    private var entries: [HistoryEntry] = []
    private let maxSize: Int
    private let persistenceKey = "isometry_shell_history"

    public init(maxSize: Int = 1000) {
        self.maxSize = maxSize
        Task {
            await loadFromPersistence()
        }
    }

    /// Add command and response to history
    public func addEntry(_ command: ShellCommand, response: CommandResponse? = nil) {
        let entry = HistoryEntry(
            id: UUID(),
            command: command.command,
            type: command.type,
            timestamp: command.timestamp,
            response: response,
            duration: response?.duration,
            cwd: command.cwd,
            context: command.context
        )

        entries.append(entry)

        // Limit history size
        if entries.count > maxSize {
            entries.removeFirst(entries.count - maxSize)
        }

        // Persist asynchronously
        Task {
            persistToDisk()
        }
    }

    /// Get all history entries
    public func getAllEntries() -> [HistoryEntry] {
        return entries
    }

    /// Search history with filters
    public func search(filter: HistoryFilter) -> [HistoryEntry] {
        return entries.filter { entry in
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

            // Text search
            if let searchQuery = filter.searchQuery, !searchQuery.isEmpty {
                let lowercaseQuery = searchQuery.lowercased()
                if !entry.command.lowercased().contains(lowercaseQuery) &&
                   !(entry.response?.output.lowercased().contains(lowercaseQuery) ?? false) {
                    return false
                }
            }

            // Success filter
            if let successFilter = filter.success {
                if entry.response?.success != successFilter {
                    return false
                }
            }

            return true
        }
    }

    /// Get command suggestions based on history
    public func getCommandSuggestions(prefix: String, limit: Int = 10) -> [String] {
        let lowercasePrefix = prefix.lowercased()
        let suggestions = entries
            .compactMap { entry in
                entry.command.lowercased().hasPrefix(lowercasePrefix) ? entry.command : nil
            }
            .removingDuplicates()
            .suffix(limit)

        return Array(suggestions)
    }

    /// Load history from UserDefaults
    private func loadFromPersistence() {
        guard let data = UserDefaults.standard.data(forKey: persistenceKey),
              let decoded = try? JSONDecoder().decode([HistoryEntry].self, from: data) else {
            return
        }

        entries = decoded
    }

    /// Persist history to UserDefaults
    private func persistToDisk() {
        guard let data = try? JSONEncoder().encode(entries) else {
            return
        }

        UserDefaults.standard.set(data, forKey: persistenceKey)
    }

    /// Clear all history
    public func clearHistory() {
        entries.removeAll()
        UserDefaults.standard.removeObject(forKey: persistenceKey)
    }
}

/// History entry combining command and response
public struct HistoryEntry: Identifiable, Codable, Sendable {
    public let id: UUID
    public let command: String
    public let type: CommandType
    public let timestamp: Date
    public let response: CommandResponse?
    public let duration: TimeInterval?
    public let cwd: String?
    public let context: CommandContext?

    public init(
        id: UUID = UUID(),
        command: String,
        type: CommandType,
        timestamp: Date = Date(),
        response: CommandResponse? = nil,
        duration: TimeInterval? = nil,
        cwd: String? = nil,
        context: CommandContext? = nil
    ) {
        self.id = id
        self.command = command
        self.type = type
        self.timestamp = timestamp
        self.response = response
        self.duration = duration
        self.cwd = cwd
        self.context = context
    }
}

/// History search filters
public struct HistoryFilter {
    public let type: CommandType?
    public let dateRange: DateRange?
    public let searchQuery: String?
    public let success: Bool?

    public init(
        type: CommandType? = nil,
        dateRange: DateRange? = nil,
        searchQuery: String? = nil,
        success: Bool? = nil
    ) {
        self.type = type
        self.dateRange = dateRange
        self.searchQuery = searchQuery
        self.success = success
    }
}

/// Date range for filtering
public struct DateRange {
    public let start: Date
    public let end: Date

    public init(start: Date, end: Date) {
        self.start = start
        self.end = end
    }
}

// MARK: - Execution Context

/// Context for command execution with App Sandbox constraints
public struct ExecutionContext: Sendable {
    public let workingDirectory: String
    public let environmentRestrictions: EnvironmentRestrictions
    public let timeoutLimits: TimeoutLimits
    public let allowedCommands: Set<String>
    public let restrictedPaths: Set<String>

    public init(
        workingDirectory: String = NSHomeDirectory(),
        environmentRestrictions: EnvironmentRestrictions = .default,
        timeoutLimits: TimeoutLimits = .default,
        allowedCommands: Set<String> = .defaultAllowed,
        restrictedPaths: Set<String> = .defaultRestricted
    ) {
        self.workingDirectory = workingDirectory
        self.environmentRestrictions = environmentRestrictions
        self.timeoutLimits = timeoutLimits
        self.allowedCommands = allowedCommands
        self.restrictedPaths = restrictedPaths
    }

    /// Default execution context for App Sandbox
    public static let `default` = ExecutionContext()
}

/// Environment variable restrictions for App Sandbox
public struct EnvironmentRestrictions: Sendable {
    public let allowedKeys: Set<String>
    public let maxValueLength: Int

    public init(allowedKeys: Set<String>, maxValueLength: Int = 1024) {
        self.allowedKeys = allowedKeys
        self.maxValueLength = maxValueLength
    }

    public static let `default` = EnvironmentRestrictions(
        allowedKeys: [
            "PATH", "HOME", "USER", "LANG", "LC_ALL", "LC_CTYPE",
            "TMPDIR", "XPC_SERVICE_NAME"
        ]
    )
}

/// Timeout limits for command execution
public struct TimeoutLimits: Sendable {
    public let execution: TimeInterval
    public let output: TimeInterval

    public init(execution: TimeInterval = 30.0, output: TimeInterval = 5.0) {
        self.execution = execution
        self.output = output
    }

    public static let `default` = TimeoutLimits()
}

// MARK: - Security Extensions

extension Set where Element == String {
    /// Default allowed commands for App Sandbox
    public static let defaultAllowed: Set<String> = [
        "ls", "pwd", "echo", "cat", "head", "tail",
        "find", "grep", "wc", "sort", "uniq",
        "date", "whoami", "uname", "which"
    ]

    /// Default restricted paths for App Sandbox
    public static let defaultRestricted: Set<String> = [
        "/System", "/usr", "/bin", "/sbin", "/private",
        "/etc", "/var/root", "/Applications"
    ]
}

// MARK: - Array Extensions

extension Array where Element: Hashable {
    /// Remove duplicate elements while preserving order
    func removingDuplicates() -> [Element] {
        var seen = Set<Element>()
        return filter { seen.insert($0).inserted }
    }
}

// MARK: - CloudKit Support

extension ShellCommand {
    /// Convert to CKRecord for CloudKit sync
    public var cloudKitRecord: CKRecord {
        let record = CKRecord(recordType: "ShellCommand", recordID: CKRecord.ID(recordName: id.uuidString))
        record["type"] = type.rawValue
        record["command"] = command
        record["timestamp"] = timestamp
        record["cwd"] = cwd
        if let context = context {
            record["contextCardId"] = context.cardId?.uuidString
            record["contextCardTitle"] = context.cardTitle
        }
        return record
    }

    /// Initialize from CKRecord
    public init?(from record: CKRecord) {
        guard let typeString = record["type"] as? String,
              let type = CommandType(rawValue: typeString),
              let command = record["command"] as? String,
              let timestamp = record["timestamp"] as? Date,
              let id = UUID(uuidString: record.recordID.recordName) else {
            return nil
        }

        let cwd = record["cwd"] as? String
        let context: CommandContext?

        if let cardIdString = record["contextCardId"] as? String,
           let cardId = UUID(uuidString: cardIdString) {
            let cardTitle = record["contextCardTitle"] as? String
            context = CommandContext(cardId: cardId, cardTitle: cardTitle)
        } else {
            context = nil
        }

        self.init(
            id: id,
            type: type,
            command: command,
            timestamp: timestamp,
            cwd: cwd,
            context: context
        )
    }
}

extension CommandResponse {
    /// Convert to CKRecord for CloudKit sync
    public var cloudKitRecord: CKRecord {
        let record = CKRecord(recordType: "CommandResponse", recordID: CKRecord.ID(recordName: id.uuidString))
        record["commandId"] = commandId.uuidString
        record["success"] = success
        record["output"] = output
        record["error"] = error
        record["duration"] = duration
        record["type"] = type.rawValue
        record["timestamp"] = timestamp
        if let metadata = metadata {
            record["exitCode"] = metadata.exitCode
            record["workingDirectory"] = metadata.workingDirectory
        }
        return record
    }

    /// Initialize from CKRecord
    public init?(from record: CKRecord) {
        guard let commandIdString = record["commandId"] as? String,
              let commandId = UUID(uuidString: commandIdString),
              let success = record["success"] as? Bool,
              let output = record["output"] as? String,
              let duration = record["duration"] as? TimeInterval,
              let typeString = record["type"] as? String,
              let type = CommandType(rawValue: typeString),
              let timestamp = record["timestamp"] as? Date,
              let id = UUID(uuidString: record.recordID.recordName) else {
            return nil
        }

        let error = record["error"] as? String
        let metadata: ResponseMetadata?

        if let exitCode = record["exitCode"] as? Int32 {
            let workingDirectory = record["workingDirectory"] as? String
            metadata = ResponseMetadata(
                exitCode: exitCode,
                workingDirectory: workingDirectory,
                environment: nil
            )
        } else {
            metadata = nil
        }

        self.init(
            id: id,
            commandId: commandId,
            success: success,
            output: output,
            error: error,
            duration: duration,
            type: type,
            metadata: metadata,
            timestamp: timestamp
        )
    }
}

// MARK: - Constants

public enum ShellConstants {
    public static let maxHistoryEntries = 1000
    public static let historyStorageKey = "isometry_shell_history"
    public static let historySearchDebounce: TimeInterval = 0.3
    public static let defaultExecutionTimeout: TimeInterval = 30.0
    public static let defaultOutputTimeout: TimeInterval = 5.0
    public static let maxOutputSize = 1024 * 1024 // 1MB
}