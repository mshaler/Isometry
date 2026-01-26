import Foundation
import os.log

// Import needed for PerformanceMonitor
#if canImport(Isometry)
// For standalone compilation, define minimal PerformanceMonitor interface
#else
public final class PerformanceMonitor: @unchecked Sendable {
    public static let shared = PerformanceMonitor()
    private init() {}

    public func startNotebookRender() -> OSSignpostID {
        return OSSignpostID(log: OSLog.default)
    }

    public func endNotebookRender(_ id: OSSignpostID, layoutType: String) {}

    public func measureNotebookRender<T>(layoutType: String, _ block: () -> T) -> T {
        return block()
    }

    public func recordNotebookCardQuery(_ duration: TimeInterval, operation: String) {}
    public func logEvent(_ name: StaticString, _ message: String) {}

    public static let targetFrameTime: TimeInterval = 1.0 / 60.0
}
#endif

/// Result of command execution
public struct ExecutionResult: Sendable {
    public let success: Bool
    public let output: String
    public let error: String?
    public let duration: TimeInterval
    public let exitCode: Int32?
    public let workingDirectory: String
    public let command: String

    public init(
        success: Bool,
        output: String,
        error: String? = nil,
        duration: TimeInterval,
        exitCode: Int32? = nil,
        workingDirectory: String,
        command: String
    ) {
        self.success = success
        self.output = output
        self.error = error
        self.duration = duration
        self.exitCode = exitCode
        self.workingDirectory = workingDirectory
        self.command = command
    }
}

/// App Sandbox-compliant command execution with security restrictions
public actor SandboxExecutor {
    private let logger = Logger(subsystem: "com.isometry.app", category: "SandboxExecutor")
    private let performanceMonitor: PerformanceMonitor
    private let maxExecutionTime: TimeInterval
    private let maxOutputSize: Int

    // Security constraints
    private let allowedCommands: Set<String>
    private let allowedDirectories: Set<String>
    private let restrictedPaths: Set<String>

    public init(
        maxExecutionTime: TimeInterval = 30.0,
        maxOutputSize: Int = 1024 * 1024, // 1MB
        allowedCommands: Set<String> = .defaultAllowed,
        restrictedPaths: Set<String> = .defaultRestricted
    ) {
        self.performanceMonitor = PerformanceMonitor.shared
        self.maxExecutionTime = maxExecutionTime
        self.maxOutputSize = maxOutputSize
        self.allowedCommands = allowedCommands
        self.restrictedPaths = restrictedPaths

        // Define allowed directories within App Sandbox
        let fileManager = FileManager.default
        var allowedDirs: Set<String> = []

        // Home directory and subdirectories
        allowedDirs.insert(NSHomeDirectory())

        // Documents directory
        if let docsURL = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first {
            allowedDirs.insert(docsURL.path)
        }

        // Application Support directory
        if let appSupportURL = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first {
            allowedDirs.insert(appSupportURL.path)
        }

        // Temporary directory
        allowedDirs.insert(NSTemporaryDirectory())

        self.allowedDirectories = allowedDirs
    }

    /// Execute a command with App Sandbox security constraints
    /// - Parameters:
    ///   - command: The full command string to execute
    ///   - workingDirectory: Working directory (must be within sandbox)
    ///   - environment: Additional environment variables
    /// - Returns: ExecutionResult with output, timing, and success status
    public func execute(
        _ command: String,
        workingDirectory: String? = nil,
        environment: [String: String] = [:]
    ) async -> ExecutionResult {
        let startTime = CFAbsoluteTimeGetCurrent()
        let cwd = workingDirectory ?? FileManager.default.currentDirectoryPath

        // Parse command into components
        let components = parseCommand(command)
        guard let executableName = components.first else {
            return ExecutionResult(
                success: false,
                output: "",
                error: "Empty command",
                duration: CFAbsoluteTimeGetCurrent() - startTime,
                exitCode: nil,
                workingDirectory: cwd,
                command: command
            )
        }

        // Security validation
        if let validationError = validateCommand(executableName, arguments: Array(components.dropFirst()), workingDirectory: cwd) {
            logger.warning("Command blocked: \(validationError)")
            return ExecutionResult(
                success: false,
                output: "",
                error: validationError,
                duration: CFAbsoluteTimeGetCurrent() - startTime,
                exitCode: nil,
                workingDirectory: cwd,
                command: command
            )
        }

        // Performance monitoring
        let signpostID = performanceMonitor.startNotebookRender()
        defer { performanceMonitor.endNotebookRender(signpostID, layoutType: "shell-\(executableName)") }

        return await executeProcess(
            executable: executableName,
            arguments: Array(components.dropFirst()),
            workingDirectory: cwd,
            environment: environment,
            command: command,
            startTime: startTime
        )
    }

    /// Parse command string into components, handling quotes and escaping
    private func parseCommand(_ command: String) -> [String] {
        var components: [String] = []
        var currentComponent = ""
        var insideQuotes = false
        var escapeNext = false

        for char in command {
            if escapeNext {
                currentComponent.append(char)
                escapeNext = false
                continue
            }

            switch char {
            case "\\":
                escapeNext = true
            case "\"", "'":
                insideQuotes.toggle()
            case " ":
                if insideQuotes {
                    currentComponent.append(char)
                } else if !currentComponent.isEmpty {
                    components.append(currentComponent)
                    currentComponent = ""
                }
            default:
                currentComponent.append(char)
            }
        }

        if !currentComponent.isEmpty {
            components.append(currentComponent)
        }

        return components
    }

    /// Validate command against App Sandbox security constraints
    private func validateCommand(_ executable: String, arguments: [String], workingDirectory: String) -> String? {
        // Check if command is in allowed list
        guard allowedCommands.contains(executable) else {
            return "Command '\(executable)' not allowed. Permitted commands: \(allowedCommands.sorted().joined(separator: ", "))"
        }

        // Check working directory is within sandbox
        let normalizedWorkingDir = (workingDirectory as NSString).standardizingPath
        let isAllowedDir = allowedDirectories.contains { allowedPath in
            normalizedWorkingDir.hasPrefix(allowedPath)
        }

        guard isAllowedDir else {
            return "Working directory '\(workingDirectory)' not accessible. Must be within app sandbox."
        }

        // Check arguments don't reference restricted paths
        for argument in arguments {
            if argument.hasPrefix("/") || argument.hasPrefix("~") {
                let normalizedPath = (argument as NSString).expandingTildeInPath
                let normalizedStandardPath = (normalizedPath as NSString).standardizingPath

                // Check against restricted paths
                for restrictedPath in restrictedPaths {
                    if normalizedStandardPath.hasPrefix(restrictedPath) {
                        return "Access to '\(argument)' denied. Path is restricted for security."
                    }
                }

                // Ensure absolute paths are within allowed directories
                let isPathAllowed = allowedDirectories.contains { allowedPath in
                    normalizedStandardPath.hasPrefix(allowedPath)
                }

                if !isPathAllowed {
                    return "Path '\(argument)' not accessible. Must be within app sandbox."
                }
            }
        }

        // Additional command-specific validations
        switch executable {
        case "rm":
            // Extra protection against rm commands
            if arguments.contains(where: { $0.contains("*") || $0.contains("..") || $0.contains("/") }) {
                return "Dangerous rm operation blocked for security"
            }
        case "chmod", "chown", "sudo", "su":
            return "Permission modification commands not allowed"
        case "curl", "wget", "ssh", "scp":
            return "Network commands not allowed in sandbox"
        default:
            break
        }

        return nil
    }

    /// Execute the validated process with simplified synchronous approach
    private func executeProcess(
        executable: String,
        arguments: [String],
        workingDirectory: String,
        environment: [String: String],
        command: String,
        startTime: CFAbsoluteTime
    ) async -> ExecutionResult {
        let process = Process()

        // Configure process
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = [executable] + arguments
        process.currentDirectoryURL = URL(fileURLWithPath: workingDirectory)

        // Set up environment (filtered for security)
        var processEnvironment = ProcessInfo.processInfo.environment
        for (key, value) in environment {
            // Only allow safe environment variables
            if key.hasPrefix("ISOMETRY_") || ["PATH", "HOME", "USER", "LANG"].contains(key) {
                processEnvironment[key] = value
            }
        }
        process.environment = processEnvironment

        // Set up pipes for output capture
        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe
        process.standardInput = nil // No input allowed for security

        // Start execution
        do {
            logger.info("Executing command: \(command)")
            try process.run()

            // Wait for completion with timeout
            let timeoutDate = Date().addingTimeInterval(self.maxExecutionTime)
            while process.isRunning && Date() < timeoutDate {
                try await Task.sleep(for: .milliseconds(100))
            }

            // Force terminate if timeout exceeded
            if process.isRunning {
                logger.warning("Command '\(command)' timed out after \(self.maxExecutionTime)s")
                process.terminate()
                process.waitUntilExit()

                return ExecutionResult(
                    success: false,
                    output: "",
                    error: "Command timed out after \(self.maxExecutionTime)s",
                    duration: CFAbsoluteTimeGetCurrent() - startTime,
                    exitCode: nil,
                    workingDirectory: workingDirectory,
                    command: command
                )
            }

            process.waitUntilExit()

            // Read output data
            let outputData = outputPipe.fileHandleForReading.readDataToEndOfFile()
            let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()

            // Check size limits
            let output: String
            let error: String?

            if outputData.count > self.maxOutputSize {
                output = "Output truncated: exceeded maximum size limit of \(self.maxOutputSize) bytes"
            } else {
                output = String(data: outputData, encoding: .utf8) ?? ""
            }

            if errorData.count > self.maxOutputSize {
                error = "Error output truncated: exceeded maximum size limit"
            } else {
                error = errorData.isEmpty ? nil : String(data: errorData, encoding: .utf8)
            }

            let duration = CFAbsoluteTimeGetCurrent() - startTime
            return ExecutionResult(
                success: process.terminationStatus == 0,
                output: output,
                error: error,
                duration: duration,
                exitCode: process.terminationStatus,
                workingDirectory: workingDirectory,
                command: command
            )

        } catch {
            let duration = CFAbsoluteTimeGetCurrent() - startTime
            return ExecutionResult(
                success: false,
                output: "",
                error: "Failed to start process: \(error.localizedDescription)",
                duration: duration,
                exitCode: nil,
                workingDirectory: workingDirectory,
                command: command
            )
        }
    }

    /// Test if a command would be allowed without executing it
    public func isCommandAllowed(_ command: String, workingDirectory: String? = nil) -> (allowed: Bool, reason: String?) {
        let components = parseCommand(command)
        guard let executable = components.first else {
            return (false, "Empty command")
        }

        let cwd = workingDirectory ?? FileManager.default.currentDirectoryPath
        let validationError = validateCommand(executable, arguments: Array(components.dropFirst()), workingDirectory: cwd)

        return (validationError == nil, validationError)
    }

    /// Get list of allowed commands
    public var supportedCommands: Set<String> {
        return allowedCommands
    }

    /// Get list of allowed directories
    public var accessibleDirectories: Set<String> {
        return allowedDirectories
    }
}

// MARK: - Extensions

extension Set where Element == String {
    /// Commands safe for App Sandbox execution
    public static let defaultAllowed: Set<String> = [
        // File system
        "ls", "pwd", "find",

        // Text processing
        "cat", "head", "tail", "grep", "sort", "uniq", "wc",

        // System info
        "date", "whoami", "uname", "which", "echo",

        // Development tools (read-only)
        "git", "swift", "node", "python3"
    ]

    /// Paths restricted for App Sandbox security
    public static let defaultRestricted: Set<String> = [
        "/System", "/usr", "/bin", "/sbin", "/private",
        "/etc", "/var/root", "/Applications",
        "/Library/System", "/Library/Security"
    ]
}

// MARK: - Performance Integration

extension PerformanceMonitor {
    /// Track shell operation performance
    public func recordShellOperation(_ duration: TimeInterval, command: String, success: Bool) {
        let operation = "shell_\(command.components(separatedBy: " ").first ?? "unknown")"
        recordNotebookCardQuery(duration, operation: operation)

        if duration > Self.targetFrameTime {
            logEvent("Slow Shell Command", "\(command) took \(Int(duration * 1000))ms")
        }

        if !success {
            logEvent("Shell Command Failed", command)
        }
    }
}

// MARK: - Error Types

public enum SandboxExecutorError: Error, LocalizedError {
    case commandNotAllowed(String)
    case pathNotAccessible(String)
    case executionTimeout
    case outputTooLarge
    case processCreationFailed(Error)

    public var errorDescription: String? {
        switch self {
        case .commandNotAllowed(let command):
            return "Command '\(command)' is not allowed in App Sandbox"
        case .pathNotAccessible(let path):
            return "Path '\(path)' is not accessible within App Sandbox"
        case .executionTimeout:
            return "Command execution timed out"
        case .outputTooLarge:
            return "Command output exceeded maximum size limit"
        case .processCreationFailed(let error):
            return "Failed to create process: \(error.localizedDescription)"
        }
    }
}