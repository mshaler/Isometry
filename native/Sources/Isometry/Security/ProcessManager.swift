import Foundation
import os.log

#if canImport(AppKit)
import AppKit
#endif

#if canImport(UIKit)
import UIKit
#endif

#if os(macOS)

// Import PerformanceMonitor
#if canImport(Isometry)
// For standalone compilation, define minimal PerformanceMonitor interface
#else
public final class PerformanceMonitor: @unchecked Sendable {
    public static let shared = PerformanceMonitor()
    private init() {}

    public func recordNotebookCardQuery(_ duration: TimeInterval, operation: String) {}
    public func logEvent(_ name: StaticString, _ message: String) {}
    public static let targetFrameTime: TimeInterval = 1.0 / 60.0
}
#endif

// MARK: - Process State Models

/// State of a managed process
public enum ManagedProcessState: String, CaseIterable, Sendable {
    case idle = "idle"
    case running = "running"
    case completed = "completed"
    case failed = "failed"
    case suspended = "suspended"
    case terminated = "terminated"
    case backgrounded = "backgrounded"

    public var description: String {
        switch self {
        case .idle:
            return "Ready"
        case .running:
            return "Running"
        case .completed:
            return "Completed"
        case .failed:
            return "Failed"
        case .suspended:
            return "Suspended"
        case .terminated:
            return "Terminated"
        case .backgrounded:
            return "Background"
        }
    }

    public var isActive: Bool {
        return self == .running || self == .backgrounded
    }

    public var icon: String {
        switch self {
        case .idle:
            return "circle"
        case .running:
            return "play.circle.fill"
        case .completed:
            return "checkmark.circle"
        case .failed:
            return "xmark.circle"
        case .suspended:
            return "pause.circle"
        case .terminated:
            return "stop.circle"
        case .backgrounded:
            return "moon.circle"
        }
    }
}

/// Background execution task wrapper
public struct BackgroundExecution: Sendable {
    public let taskId: UUID
    public let processId: Int32
    public let startTime: Date
    public let maxDuration: TimeInterval
    public let command: String

    public init(
        taskId: UUID = UUID(),
        processId: Int32,
        startTime: Date = Date(),
        maxDuration: TimeInterval = 600.0, // 10 minutes max
        command: String
    ) {
        self.taskId = taskId
        self.processId = processId
        self.startTime = startTime
        self.maxDuration = maxDuration
        self.command = command
    }

    public var isExpired: Bool {
        return Date().timeIntervalSince(startTime) > maxDuration
    }
}

/// Managed process container
public struct ManagedProcess: Sendable {
    public let id: UUID
    public let process: Process
    public var state: ManagedProcessState
    public let command: String
    public let startTime: Date
    public let workingDirectory: String
    public var backgroundExecution: BackgroundExecution?
    public var cpuUsage: Double
    public var memoryUsage: Int64 // bytes

    public init(
        id: UUID = UUID(),
        process: Process,
        state: ManagedProcessState = .idle,
        command: String,
        startTime: Date = Date(),
        workingDirectory: String,
        backgroundExecution: BackgroundExecution? = nil,
        cpuUsage: Double = 0.0,
        memoryUsage: Int64 = 0
    ) {
        self.id = id
        self.process = process
        self.state = state
        self.command = command
        self.startTime = startTime
        self.workingDirectory = workingDirectory
        self.backgroundExecution = backgroundExecution
        self.cpuUsage = cpuUsage
        self.memoryUsage = memoryUsage
    }

    public var executionTime: TimeInterval {
        return Date().timeIntervalSince(startTime)
    }

    public var isLongRunning: Bool {
        return executionTime > 30.0 // Commands over 30 seconds are long-running
    }
}

// MARK: - Process Manager

#if os(macOS)
/// Advanced process lifecycle management with background execution support
public actor ProcessManager {
    private let logger = Logger(subsystem: "com.isometry.app", category: "ProcessManager")
    private let performanceMonitor = PerformanceMonitor.shared

    // Process tracking
    private var managedProcesses: [UUID: ManagedProcess] = [:]
    private var backgroundTasks: [UUID: BackgroundExecution] = [:]

    // Resource limits
    private let maxConcurrentProcesses: Int
    private let maxMemoryPerProcess: Int64 // bytes
    private let cleanupInterval: TimeInterval

    // Background execution support
    #if canImport(AppKit)
    private var backgroundScheduler: NSBackgroundActivityScheduler?
    #endif

    #if canImport(UIKit)
    private var backgroundTaskIdentifiers: [UUID: UIBackgroundTaskIdentifier] = [:]
    #endif

    public init(
        maxConcurrentProcesses: Int = 3,
        maxMemoryPerProcess: Int64 = 100 * 1024 * 1024, // 100MB
        cleanupInterval: TimeInterval = 60.0 // 1 minute
    ) {
        self.maxConcurrentProcesses = maxConcurrentProcesses
        self.maxMemoryPerProcess = maxMemoryPerProcess
        self.cleanupInterval = cleanupInterval

        // Initialize background support and cleanup asynchronously
        Task {
            await setupBackgroundSupport()
            await startCleanupTimer()
        }
    }

    // MARK: - Process Management

    /// Create and start a managed process
    /// - Parameters:
    ///   - executable: Path to executable
    ///   - arguments: Command arguments
    ///   - workingDirectory: Working directory
    ///   - environment: Environment variables
    ///   - command: Original command string for logging
    /// - Returns: Process ID or nil if limits exceeded
    public func startProcess(
        executable: String,
        arguments: [String],
        workingDirectory: String,
        environment: [String: String],
        command: String
    ) async throws -> UUID? {
        // Check process limits
        let activeProcesses = managedProcesses.values.filter { $0.state.isActive }
        if activeProcesses.count >= self.maxConcurrentProcesses {
            logger.warning("Process limit reached (\(self.maxConcurrentProcesses)), queuing request")
            throw ProcessManagerError.processLimitExceeded
        }

        // Create process
        let process = Process()
        let processId = UUID()

        // Configure process
        if let executableURL = findExecutableURL(executable) {
            process.executableURL = executableURL
        } else {
            process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
            process.arguments = [executable] + arguments
        }

        if process.arguments == nil {
            process.arguments = arguments
        }

        process.currentDirectoryURL = URL(fileURLWithPath: workingDirectory)
        process.environment = environment

        // Create managed process
        let managedProcess = ManagedProcess(
            id: processId,
            process: process,
            state: .idle,
            command: command,
            workingDirectory: workingDirectory
        )

        managedProcesses[processId] = managedProcess

        // Start process
        try process.run()
        managedProcesses[processId]?.state = .running

        logger.debug("Started process \(processId): \(command)")

        // Set up monitoring
        await setupProcessMonitoring(processId: processId)

        return processId
    }

    /// Terminate a process gracefully
    /// - Parameter processId: Process identifier
    public func terminate(processId: UUID) async {
        guard var managedProcess = managedProcesses[processId] else {
            logger.warning("Attempted to terminate unknown process: \(processId)")
            return
        }

        logger.debug("Terminating process \(processId): \(managedProcess.command)")

        // Update state
        managedProcess.state = .terminated
        managedProcesses[processId] = managedProcess

        // Graceful termination
        if managedProcess.process.isRunning {
            managedProcess.process.terminate()

            // Wait briefly for graceful shutdown
            try? await Task.sleep(for: .milliseconds(500))

            // Force kill if still running
            if managedProcess.process.isRunning {
                logger.warning("Process \(processId) did not terminate gracefully, forcing termination")
                managedProcess.process.interrupt()
            }
        }

        // Clean up background task
        await cleanupBackgroundExecution(processId: processId)

        // Remove from tracking
        managedProcesses.removeValue(forKey: processId)
    }

    /// Kill a process immediately
    /// - Parameter processId: Process identifier
    public func kill(processId: UUID) async {
        guard let managedProcess = managedProcesses[processId] else {
            logger.warning("Attempted to kill unknown process: \(processId)")
            return
        }

        logger.debug("Force killing process \(processId): \(managedProcess.command)")

        // Immediate termination
        if managedProcess.process.isRunning {
            managedProcess.process.interrupt()
        }

        // Clean up
        await cleanupBackgroundExecution(processId: processId)
        managedProcesses.removeValue(forKey: processId)
    }

    /// Suspend a process (macOS only)
    /// - Parameter processId: Process identifier
    public func suspend(processId: UUID) async {
        #if canImport(AppKit)
        guard var managedProcess = managedProcesses[processId] else {
            return
        }

        if managedProcess.process.isRunning {
            _DarwinFoundation3.kill(managedProcess.process.processIdentifier, SIGSTOP)
            managedProcess.state = .suspended
            managedProcesses[processId] = managedProcess

            logger.debug("Suspended process \(processId)")
        }
        #endif
    }

    /// Resume a suspended process (macOS only)
    /// - Parameter processId: Process identifier
    public func resume(processId: UUID) async {
        #if canImport(AppKit)
        guard var managedProcess = managedProcesses[processId] else {
            return
        }

        if managedProcess.state == .suspended {
            _DarwinFoundation3.kill(managedProcess.process.processIdentifier, SIGCONT)
            managedProcess.state = .running
            managedProcesses[processId] = managedProcess

            logger.debug("Resumed process \(processId)")
        }
        #endif
    }

    // MARK: - Background Execution

    /// Enable background execution for a long-running process
    /// - Parameter processId: Process identifier
    public func enableBackgroundExecution(processId: UUID) async {
        guard var managedProcess = managedProcesses[processId] else {
            return
        }

        #if canImport(AppKit)
        // macOS: Use NSBackgroundActivityScheduler
        await enableMacOSBackgroundExecution(processId: processId)
        #endif

        #if canImport(UIKit)
        // iOS: Use UIApplication.beginBackgroundTask
        await enableiOSBackgroundExecution(processId: processId)
        #endif

        // Update state
        managedProcess.state = .backgrounded
        managedProcesses[processId] = managedProcess

        logger.debug("Enabled background execution for process \(processId)")
    }

    #if canImport(AppKit)
    private func enableMacOSBackgroundExecution(processId: UUID) async {
        guard let managedProcess = managedProcesses[processId] else { return }

        let scheduler = NSBackgroundActivityScheduler(identifier: "com.isometry.process-\(processId)")
        scheduler.repeats = false
        scheduler.interval = 1.0
        scheduler.tolerance = 0.5

        let backgroundExecution = BackgroundExecution(
            processId: managedProcess.process.processIdentifier,
            command: managedProcess.command
        )

        backgroundTasks[processId] = backgroundExecution
        backgroundScheduler = scheduler

        scheduler.schedule { [weak self] completion in
            Task {
                await self?.monitorBackgroundProcess(processId: processId)
                completion(.finished)
            }
        }
    }
    #endif

    #if canImport(UIKit)
    private func enableiOSBackgroundExecution(processId: UUID) async {
        guard let managedProcess = managedProcesses[processId] else { return }

        let backgroundTaskId = UIApplication.shared.beginBackgroundTask(
            withName: "Process-\(processId)"
        ) { [weak self] in
            Task {
                await self?.handleBackgroundExpiration(processId: processId)
            }
        }

        backgroundTaskIdentifiers[processId] = backgroundTaskId

        let backgroundExecution = BackgroundExecution(
            processId: managedProcess.process.processIdentifier,
            command: managedProcess.command,
            maxDuration: 30.0 // iOS background time limit
        )

        backgroundTasks[processId] = backgroundExecution
    }
    #endif

    private func handleBackgroundExpiration(processId: UUID) async {
        logger.warning("Background execution expired for process \(processId)")
        await terminate(processId: processId)
    }

    private func cleanupBackgroundExecution(processId: UUID) async {
        backgroundTasks.removeValue(forKey: processId)

        #if canImport(UIKit)
        if let backgroundTaskId = backgroundTaskIdentifiers.removeValue(forKey: processId),
           backgroundTaskId != .invalid {
            UIApplication.shared.endBackgroundTask(backgroundTaskId)
        }
        #endif
    }

    // MARK: - Process Monitoring

    private func setupProcessMonitoring(processId: UUID) async {
        // Start monitoring task
        Task.detached { [weak self] in
            await self?.monitorProcess(processId: processId)
        }
    }

    private func monitorProcess(processId: UUID) async {
        guard var managedProcess = managedProcesses[processId] else { return }

        while managedProcess.process.isRunning && managedProcesses[processId] != nil {
            // Update resource usage
            let (cpu, memory) = getProcessResourceUsage(pid: managedProcess.process.processIdentifier)
            managedProcess.cpuUsage = cpu
            managedProcess.memoryUsage = memory
            managedProcesses[processId] = managedProcess

            // Check memory limits
            if memory > self.maxMemoryPerProcess {
                logger.warning("Process \(processId) exceeded memory limit (\(memory / 1024 / 1024)MB > \(self.maxMemoryPerProcess / 1024 / 1024)MB)")
                await terminate(processId: processId)
                break
            }

            // Check if process should be backgrounded
            if managedProcess.isLongRunning && managedProcess.state == .running {
                await enableBackgroundExecution(processId: processId)
            }

            try? await Task.sleep(for: .seconds(1))
            managedProcess = managedProcesses[processId] ?? managedProcess
        }

        // Process finished, update state
        if let process = managedProcesses[processId] {
            managedProcesses[processId] = ManagedProcess(
                id: process.id,
                process: process.process,
                state: .terminated,
                command: process.command,
                startTime: process.startTime,
                workingDirectory: process.workingDirectory
            )

            logger.debug("Process \(processId) completed")
        }
    }

    private func monitorBackgroundProcess(processId: UUID) async {
        guard let backgroundTask = backgroundTasks[processId] else { return }

        // Check if process is still running
        let isRunning = _DarwinFoundation3.kill(backgroundTask.processId, 0) == 0

        if !isRunning || backgroundTask.isExpired {
            logger.debug("Background process \(processId) completed or expired")
            await cleanupBackgroundExecution(processId: processId)
            managedProcesses.removeValue(forKey: processId)
        }
    }

    // MARK: - Resource Management

    private func getProcessResourceUsage(pid: Int32) -> (cpu: Double, memory: Int64) {
        var info = proc_taskinfo()
        let size = MemoryLayout<proc_taskinfo>.size

        if proc_pidinfo(pid, PROC_PIDTASKINFO, 0, &info, Int32(size)) == size {
            let cpu = Double(info.pti_total_user + info.pti_total_system) / 1000000.0 // Convert to seconds
            let memory = Int64(info.pti_resident_size)
            return (cpu, memory)
        }

        return (0.0, 0)
    }

    // MARK: - Cleanup and Maintenance

    private func setupBackgroundSupport() {
        #if canImport(AppKit)
        // macOS background support is handled per-process
        #endif

        #if canImport(UIKit)
        // Set up app lifecycle notifications
        NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task {
                await self?.handleAppBackgrounding()
            }
        }
        #endif
    }

    private func handleAppBackgrounding() async {
        logger.debug("App backgrounding, managing \(self.managedProcesses.count) processes")

        // Enable background execution for any long-running processes
        for processId in managedProcesses.keys {
            if let process = managedProcesses[processId], process.isLongRunning {
                await enableBackgroundExecution(processId: processId)
            }
        }
    }

    private func startCleanupTimer() {
        Task.detached { [weak self] in
            while true {
                try? await Task.sleep(for: .seconds(self?.cleanupInterval ?? 60.0))
                await self?.performCleanup()
            }
        }
    }

    private func performCleanup() async {
        logger.debug("Performing process cleanup")

        var cleanedProcesses = 0

        // Clean up terminated processes
        for (processId, managedProcess) in managedProcesses {
            if !managedProcess.process.isRunning && managedProcess.state != .terminated {
                managedProcesses[processId] = ManagedProcess(
                    id: managedProcess.id,
                    process: managedProcess.process,
                    state: .terminated,
                    command: managedProcess.command,
                    startTime: managedProcess.startTime,
                    workingDirectory: managedProcess.workingDirectory
                )
            }

            // Remove old terminated processes
            if managedProcess.state == .terminated &&
               Date().timeIntervalSince(managedProcess.startTime) > 300 { // 5 minutes
                managedProcesses.removeValue(forKey: processId)
                await cleanupBackgroundExecution(processId: processId)
                cleanedProcesses += 1
            }
        }

        // Clean up expired background tasks
        for (processId, backgroundTask) in backgroundTasks {
            if backgroundTask.isExpired {
                await cleanupBackgroundExecution(processId: processId)
                cleanedProcesses += 1
            }
        }

        if cleanedProcesses > 0 {
            logger.debug("Cleaned up \(cleanedProcesses) processes")
        }
    }

    // MARK: - Utilities

    private func findExecutableURL(_ executable: String) -> URL? {
        // Check if it's an absolute path
        if executable.hasPrefix("/") {
            let url = URL(fileURLWithPath: executable)
            if FileManager.default.isExecutableFile(atPath: url.path) {
                return url
            }
        }

        // Search in PATH
        guard let path = ProcessInfo.processInfo.environment["PATH"] else {
            return nil
        }

        for directory in path.components(separatedBy: ":") {
            let url = URL(fileURLWithPath: directory).appendingPathComponent(executable)
            if FileManager.default.isExecutableFile(atPath: url.path) {
                return url
            }
        }

        return nil
    }

    // MARK: - Public Interface

    /// Get current process states
    public var processStates: [UUID: ManagedProcessState] {
        return managedProcesses.mapValues { $0.state }
    }

    /// Get active process count
    public var activeProcessCount: Int {
        return managedProcesses.values.filter { $0.state.isActive }.count
    }

    /// Get process information
    /// - Parameter processId: Process identifier
    /// - Returns: Managed process information
    public func getProcessInfo(processId: UUID) -> ManagedProcess? {
        return managedProcesses[processId]
    }

    /// Check if process limit would be exceeded
    public var canStartNewProcess: Bool {
        return activeProcessCount < maxConcurrentProcesses
    }
}
#else
// iOS: Process execution not supported - provide stub implementation
public actor ProcessManager {
    private let logger = Logger(subsystem: "com.isometry.app", category: "ProcessManager")

    public init() {}

    public func startProcess(
        executable: String,
        arguments: [String] = [],
        workingDirectory: String? = nil,
        environment: [String: String]? = nil,
        priority: ProcessPriority = .normal,
        backgroundExecution: Bool = false,
        progressHandler: ProcessProgressHandler? = nil
    ) async throws -> UUID {
        logger.warning("Process execution not supported on iOS")
        throw ProcessManagerError.unsupportedPlatform
    }

    public func getProcessState(for processId: UUID) -> ManagedProcessState {
        return .terminated
    }

    public func terminateProcess(_ processId: UUID) async throws {
        logger.warning("Process termination not supported on iOS")
    }

    public func getAllProcesses() -> [UUID: ManagedProcess] {
        return [:]
    }

    public func getProcessMetrics() -> ProcessManagerMetrics {
        return ProcessManagerMetrics(
            activeProcesses: 0,
            totalProcessesStarted: 0,
            totalProcessesCompleted: 0,
            totalProcessesFailed: 0,
            averageExecutionTime: 0.0,
            memoryUsage: 0
        )
    }
}
#endif

// MARK: - Error Types

public enum ProcessManagerError: Error, LocalizedError {
    case processLimitExceeded
    case processNotFound(UUID)
    case backgroundExecutionFailed
    case resourceLimitExceeded
    case unsupportedPlatform

    public var errorDescription: String? {
        switch self {
        case .processLimitExceeded:
            return "Maximum number of concurrent processes reached"
        case .processNotFound(let id):
            return "Process with ID \(id) not found"
        case .backgroundExecutionFailed:
            return "Failed to enable background execution"
        case .resourceLimitExceeded:
            return "Process exceeded resource limits"
        case .unsupportedPlatform:
            return "Process execution not supported on this platform"
        }
    }
}

// MARK: - Task Extension

extension Task where Success == Never, Failure == Never {
    /// Sleep for duration in seconds
    static func sleep(for duration: Duration) async throws {
        try await Task.sleep(nanoseconds: UInt64(duration.components.seconds * 1_000_000_000))
    }
}

#else
// iOS stub implementation
public final actor ProcessManager {
    public static let shared = ProcessManager()
    public init() {}

    public var canStartNewProcess: Bool { false }
    public var activeProcessCount: Int { 0 }

    public func getProcessMetrics() -> ProcessManagerMetrics {
        ProcessManagerMetrics(
            totalProcesses: 0,
            activeProcesses: 0,
            totalMemoryUsage: 0,
            totalCPUUsage: 0.0,
            averageExecutionTime: 0.0
        )
    }

    public func startProcess(executable: String, arguments: [String] = [], workingDirectory: String? = nil, environment: [String: String]? = nil, command: String) async throws -> UUID? {
        throw SandboxExecutorError.commandNotAllowed("Process execution not supported on iOS")
    }

    public func terminate(processId: UUID) async {
        // No-op on iOS
    }

    public func getProcessInfo(processId: UUID) async -> ManagedProcessInfo? {
        return ManagedProcessInfo(state: .idle)
    }

    public func enableBackgroundExecution(processId: UUID) async {
        // No-op on iOS
    }
}

public struct ProcessManagerMetrics: Sendable {
    public let totalProcesses: Int
    public let activeProcesses: Int
    public let totalMemoryUsage: Int64
    public let totalCPUUsage: Double
    public let averageExecutionTime: TimeInterval

    public init(totalProcesses: Int, activeProcesses: Int, totalMemoryUsage: Int64, totalCPUUsage: Double, averageExecutionTime: TimeInterval) {
        self.totalProcesses = totalProcesses
        self.activeProcesses = activeProcesses
        self.totalMemoryUsage = totalMemoryUsage
        self.totalCPUUsage = totalCPUUsage
        self.averageExecutionTime = averageExecutionTime
    }
}

// iOS stub types
public struct ManagedProcessInfo: Sendable {
    public let state: ManagedProcessState

    public init(state: ManagedProcessState) {
        self.state = state
    }
}

public enum ManagedProcessState: String, CaseIterable, Sendable {
    case idle = "idle"
    case running = "running"
    case completed = "completed"
    case failed = "failed"
    case terminated = "terminated"
    case suspended = "suspended"
    case backgrounded = "backgrounded"

    public var isActive: Bool {
        return self == .running
    }

    public var icon: String {
        switch self {
        case .idle: return "pause.circle"
        case .running: return "play.circle.fill"
        case .completed: return "checkmark.circle.fill"
        case .failed: return "xmark.circle.fill"
        case .terminated: return "stop.circle.fill"
        case .suspended: return "pause.circle.fill"
        case .backgrounded: return "moon.circle"
        }
    }

    public var description: String {
        return self.rawValue.capitalized
    }
}


#endif