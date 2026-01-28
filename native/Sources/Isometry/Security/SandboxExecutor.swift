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
    private let processManager: ProcessManager
    private let executionLimits: ExecutionLimits

    // Security constraints
    private let allowedCommands: Set<String>
    private let allowedDirectories: Set<String>
    private let restrictedPaths: Set<String>

    // Process tracking
    private var activeProcesses: [String: UUID] = [:]

    public init(
        executionLimits: ExecutionLimits = .default,
        allowedCommands: Set<String> = .defaultAllowed,
        restrictedPaths: Set<String> = .defaultRestricted,
        processManager: ProcessManager = ProcessManager()
    ) {
        self.performanceMonitor = PerformanceMonitor.shared
        self.executionLimits = executionLimits
        self.allowedCommands = allowedCommands
        self.restrictedPaths = restrictedPaths
        self.processManager = processManager

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

    /// Execute a command with enhanced security and background support
    /// - Parameters:
    ///   - command: The full command string to execute
    ///   - workingDirectory: Working directory (must be within sandbox)
    ///   - environment: Additional environment variables
    ///   - allowBackground: Whether to enable background execution for long-running commands
    /// - Returns: ExecutionResult with output, timing, and success status
    public func execute(
        _ command: String,
        workingDirectory: String? = nil,
        environment: [String: String] = [:],
        allowBackground: Bool = true
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
    #if os(macOS)
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
            logger.debug("Executing command: \(command)")
            try process.run()

            // Wait for completion with timeout
            let timeoutDate = Date().addingTimeInterval(self.executionLimits.maxExecutionTime)
            while process.isRunning && Date() < timeoutDate {
                try await Task.sleep(for: .milliseconds(100))
            }

            // Force terminate if timeout exceeded
            if process.isRunning {
                logger.warning("Command '\(command)' timed out after \(self.executionLimits.maxExecutionTime)s")
                process.terminate()
                process.waitUntilExit()

                return ExecutionResult(
                    success: false,
                    output: "",
                    error: "Command timed out after \(self.executionLimits.maxExecutionTime)s",
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

            if outputData.count > self.executionLimits.maxOutputSize {
                output = "Output truncated: exceeded maximum size limit of \(self.executionLimits.maxOutputSize) bytes"
            } else {
                output = String(data: outputData, encoding: .utf8) ?? ""
            }

            if errorData.count > self.executionLimits.maxOutputSize {
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
    #else
    // iOS: Process execution not supported - provide stub implementation
    private func executeProcess(
        executable: String,
        arguments: [String],
        workingDirectory: String,
        environment: [String: String],
        command: String,
        startTime: CFAbsoluteTime
    ) async -> ExecutionResult {
        let duration = CFAbsoluteTimeGetCurrent() - startTime
        logger.warning("Process execution not supported on iOS: \(executable)")
        return ExecutionResult(
            success: false,
            output: "",
            error: "Process execution not supported on iOS platform",
            duration: duration,
            exitCode: -1,
            workingDirectory: workingDirectory,
            command: command
        )
    }
    #endif

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

    /// Execute command with background support using ProcessManager
    /// - Parameters:
    ///   - command: Command to execute
    ///   - workingDirectory: Working directory
    ///   - environment: Environment variables
    /// - Returns: ExecutionResult with process management
    public func executeWithBackgroundSupport(
        _ command: String,
        workingDirectory: String? = nil,
        environment: [String: String] = [:]
    ) async -> ExecutionResult {
        let startTime = CFAbsoluteTimeGetCurrent()
        let cwd = workingDirectory ?? FileManager.default.currentDirectoryPath

        // Enhanced security validation
        if let securityResult = await validateEnhancedSecurity(command: command, workingDirectory: cwd, environment: environment) {
            // Security check failed
            return securityResult
        }

        // Check if we can start a new process
        guard await processManager.canStartNewProcess else {
            return ExecutionResult(
                success: false,
                output: "",
                error: "Process limit exceeded. Maximum \(await processManager.activeProcessCount) concurrent processes allowed.",
                duration: CFAbsoluteTimeGetCurrent() - startTime,
                exitCode: nil,
                workingDirectory: cwd,
                command: command
            )
        }

        // Parse and validate command
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

        // Enhanced command validation
        if let validationError = validateCommandEnhanced(executableName, arguments: Array(components.dropFirst()), workingDirectory: cwd) {
            logger.warning("Enhanced validation failed: \(validationError)")
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

        do {
            // Start process through ProcessManager
            let sanitizedEnvironment = sanitizeEnvironment(environment)

            guard let processId = try await processManager.startProcess(
                executable: executableName,
                arguments: Array(components.dropFirst()),
                workingDirectory: cwd,
                environment: sanitizedEnvironment,
                command: command
            ) else {
                return ExecutionResult(
                    success: false,
                    output: "",
                    error: "Failed to start process",
                    duration: CFAbsoluteTimeGetCurrent() - startTime,
                    exitCode: nil,
                    workingDirectory: cwd,
                    command: command
                )
            }

            // Track the process
            activeProcesses[command] = processId

            // Wait for completion with timeout
            return await waitForProcessCompletion(
                processId: processId,
                command: command,
                workingDirectory: cwd,
                startTime: startTime
            )

        } catch {
            logger.error("Process execution failed: \(error.localizedDescription)")
            return ExecutionResult(
                success: false,
                output: "",
                error: "Execution failed: \(error.localizedDescription)",
                duration: CFAbsoluteTimeGetCurrent() - startTime,
                exitCode: nil,
                workingDirectory: cwd,
                command: command
            )
        }
    }

    /// Cancel a running command
    /// - Parameter command: Command to cancel
    public func cancelCommand(_ command: String) async {
        guard let processId = activeProcesses[command] else {
            logger.warning("Attempted to cancel unknown command: \(command)")
            return
        }

        logger.debug("Cancelling command: \(command)")
        await processManager.terminate(processId: processId)
        activeProcesses.removeValue(forKey: command)
    }

    /// Get status of active processes
    public var activeProcessStatus: [String: ManagedProcessState] {
        get async {
            var status: [String: ManagedProcessState] = [:]
            for (command, processId) in activeProcesses {
                if let processInfo = await processManager.getProcessInfo(processId: processId) {
                    status[command] = processInfo.state
                }
            }
            return status
        }
    }

    /// Enhanced security validation
    private func validateEnhancedSecurity(
        command: String,
        workingDirectory: String,
        environment: [String: String]
    ) async -> ExecutionResult? {
        // Check for command injection patterns
        let dangerousPatterns = [";", "&&", "||", "|", ">", "<", "`", "$(", "$[", "eval", "exec"]
        for pattern in dangerousPatterns {
            if command.contains(pattern) {
                logger.error("Command injection attempt detected: \(pattern)")
                return ExecutionResult(
                    success: false,
                    output: "",
                    error: SecurityViolation.commandInjection.userDescription,
                    duration: 0.001,
                    exitCode: nil,
                    workingDirectory: workingDirectory,
                    command: command
                )
            }
        }

        // Check for path traversal attempts
        if command.contains("../") || command.contains("..\\") {
            logger.error("Path traversal attempt detected")
            return ExecutionResult(
                success: false,
                output: "",
                error: SecurityViolation.pathTraversal.userDescription,
                duration: 0.001,
                exitCode: nil,
                workingDirectory: workingDirectory,
                command: command
            )
        }

        // Check environment variables for sensitive data
        for (key, value) in environment {
            if key.lowercased().contains("password") ||
               key.lowercased().contains("secret") ||
               key.lowercased().contains("token") ||
               value.contains("sk-") { // API keys
                logger.error("Attempted to set sensitive environment variable: \(key)")
                return ExecutionResult(
                    success: false,
                    output: "",
                    error: SecurityViolation.environmentVariableAccess.userDescription,
                    duration: 0.001,
                    exitCode: nil,
                    workingDirectory: workingDirectory,
                    command: command
                )
            }
        }

        return nil // Security check passed
    }

    /// Enhanced command validation with additional security checks
    private func validateCommandEnhanced(_ executable: String, arguments: [String], workingDirectory: String) -> String? {
        // Use existing validation first
        if let basicError = validateCommand(executable, arguments: arguments, workingDirectory: workingDirectory) {
            return basicError
        }

        // Additional enhanced validations

        // Check for network-related commands
        let networkCommands = ["curl", "wget", "ssh", "scp", "rsync", "ping", "telnet", "ftp", "nc", "netcat"]
        if networkCommands.contains(executable) {
            return SecurityViolation.networkAccess.userDescription
        }

        // Check for privilege escalation attempts
        let privilegeCommands = ["sudo", "su", "doas", "chroot", "setuid"]
        if privilegeCommands.contains(executable) {
            return SecurityViolation.privilegeEscalation.userDescription
        }

        // Check arguments for dangerous patterns
        for argument in arguments {
            // Check for absolute paths to system directories
            if argument.hasPrefix("/System/") ||
               argument.hasPrefix("/usr/bin/") ||
               argument.hasPrefix("/bin/") {
                return SecurityViolation.systemDirectoryAccess.userDescription
            }

            // Check for shell metacharacters in arguments
            let metacharacters = CharacterSet(charactersIn: ";|&$`()<>\"'\\")
            if argument.rangeOfCharacter(from: metacharacters) != nil {
                return SecurityViolation.commandInjection.userDescription
            }
        }

        return nil
    }

    /// Sanitize environment variables for security
    private func sanitizeEnvironment(_ environment: [String: String]) -> [String: String] {
        var sanitized: [String: String] = [:]

        // Start with safe base environment
        let safeBaseVars = ["PATH", "HOME", "USER", "LANG", "LC_ALL", "TMPDIR"]
        for key in safeBaseVars {
            if let value = ProcessInfo.processInfo.environment[key] {
                sanitized[key] = value
            }
        }

        // Add allowed custom variables
        for (key, value) in environment {
            // Only allow ISOMETRY_ prefixed variables and known safe variables
            if key.hasPrefix("ISOMETRY_") || safeBaseVars.contains(key) {
                // Sanitize value - remove dangerous characters
                let sanitizedValue = value.replacingOccurrences(of: ";", with: "")
                                         .replacingOccurrences(of: "|", with: "")
                                         .replacingOccurrences(of: "&", with: "")
                                         .replacingOccurrences(of: "$", with: "")
                                         .replacingOccurrences(of: "`", with: "")

                sanitized[key] = sanitizedValue
            }
        }

        return sanitized
    }

    /// Wait for process completion with proper monitoring
    private func waitForProcessCompletion(
        processId: UUID,
        command: String,
        workingDirectory: String,
        startTime: CFAbsoluteTime
    ) async -> ExecutionResult {
        // Monitor process state
        var lastState: ManagedProcessState = .idle

        while true {
            guard let processInfo = await processManager.getProcessInfo(processId: processId) else {
                // Process no longer exists
                activeProcesses.removeValue(forKey: command)
                break
            }

            let currentState = processInfo.state
            if currentState != lastState {
                logger.debug("Process \(processId) state changed: \(lastState.rawValue) -> \(currentState.rawValue)")
                lastState = currentState
            }

            // Check if process completed
            if !currentState.isActive {
                activeProcesses.removeValue(forKey: command)

                let duration = CFAbsoluteTimeGetCurrent() - startTime
                let success = currentState == .terminated

                return ExecutionResult(
                    success: success,
                    output: success ? "Command completed successfully" : "Command failed",
                    error: success ? nil : "Process \(currentState.description.lowercased())",
                    duration: duration,
                    exitCode: success ? 0 : 1,
                    workingDirectory: workingDirectory,
                    command: command
                )
            }

            // Check for timeout
            let currentDuration = CFAbsoluteTimeGetCurrent() - startTime
            if currentDuration > executionLimits.maxExecutionTime {
                logger.warning("Process \(processId) timed out after \(executionLimits.maxExecutionTime)s")
                await processManager.terminate(processId: processId)
                activeProcesses.removeValue(forKey: command)

                return ExecutionResult(
                    success: false,
                    output: "",
                    error: "Command timed out after \(executionLimits.maxExecutionTime)s",
                    duration: currentDuration,
                    exitCode: nil,
                    workingDirectory: workingDirectory,
                    command: command
                )
            }

            // Check if long-running and should be backgrounded
            if currentDuration > 30.0 && currentState == .running {
                logger.debug("Enabling background execution for long-running process: \(command)")
                await processManager.enableBackgroundExecution(processId: processId)
            }

            // Wait before next check
            try? await Task.sleep(for: .milliseconds(500))
        }

        // Process disappeared unexpectedly
        let duration = CFAbsoluteTimeGetCurrent() - startTime
        return ExecutionResult(
            success: false,
            output: "",
            error: "Process terminated unexpectedly",
            duration: duration,
            exitCode: nil,
            workingDirectory: workingDirectory,
            command: command
        )
    }

    /// Execute Claude command through API client
    /// - Parameters:
    ///   - prompt: User prompt for Claude
    ///   - context: Shell context for enrichment
    ///   - client: Claude API client
    /// - Returns: ExecutionResult with Claude response
    public func executeClaudeCommand(
        prompt: String,
        context: ShellContext,
        client: ClaudeAPIClient
    ) async -> ExecutionResult {
        let startTime = CFAbsoluteTimeGetCurrent()
        let command = "/claude \(prompt)"

        logger.debug("Executing Claude command: \(prompt.prefix(50))...")

        do {
            // Performance monitoring
            let signpostID = performanceMonitor.startNotebookRender()
            defer { performanceMonitor.endNotebookRender(signpostID, layoutType: "claude-api") }

            // Send to Claude with shell context
            let response = try await client.sendShellCommand(
                prompt: prompt,
                context: context,
                maxTokens: 1000
            )

            let duration = CFAbsoluteTimeGetCurrent() - startTime
            let formattedOutput = ClaudeAPIClient.formatForShell(response)

            logger.debug("Claude command completed successfully in \(Int(duration * 1000))ms")

            return ExecutionResult(
                success: true,
                output: formattedOutput,
                error: nil,
                duration: duration,
                exitCode: nil,
                workingDirectory: context.workingDirectory,
                command: command
            )

        } catch {
            let duration = CFAbsoluteTimeGetCurrent() - startTime
            let errorMessage: String

            if let claudeError = error as? ClaudeError {
                errorMessage = "Claude API Error: \(claudeError.localizedDescription)"
                logger.error("Claude API error: \(claudeError.debugDescription)")
            } else {
                errorMessage = "Network Error: \(error.localizedDescription)"
                logger.error("Claude network error: \(error.localizedDescription)")
            }

            return ExecutionResult(
                success: false,
                output: "",
                error: errorMessage,
                duration: duration,
                exitCode: nil,
                workingDirectory: context.workingDirectory,
                command: command
            )
        }
    }
}

// MARK: - Extensions

// MARK: - Set Extensions defined in ShellModels.swift
// Using extensions from ShellModels.swift for defaultAllowed and defaultRestricted

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