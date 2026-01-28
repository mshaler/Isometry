import SwiftUI
import Foundation

/// Shell component for the notebook workflow with native terminal interface
/// App Sandbox-compliant terminal with secure process execution
public struct NotebookShellView: View {
    @EnvironmentObject private var appState: AppState
    @State private var sandboxExecutor = SandboxExecutor()
    @StateObject private var shellSession = ShellSession()
    @State private var commandInput: String = ""
    @State private var commandHistory: [HistoryEntry] = []
    @State private var isExecuting: Bool = false
    @State private var currentWorkingDirectory: String = FileManager.default.currentDirectoryPath
    @State private var historyIndex: Int = -1
    @State private var errorMessage: String?

    // Process management
    @State private var activeProcesses: [String: ManagedProcessState] = [:]
    @State private var currentlyExecutingCommand: String = ""
    @State private var processStartTime: Date = Date()
    @State private var showCancelConfirmation: Bool = false
    @State private var backgroundProcessCount: Int = 0
    @State private var showProcessDetails: Bool = false

    // Claude API integration
    @State private var claudeAPIClient: ClaudeAPIClient?
    @State private var isClaudeConfigured: Bool = false

    // Command history
    @State private var commandHistoryManager: CommandHistoryManager?
    @State private var showingHistoryView: Bool = false

    public init() {}

    public var body: some View {
        VStack(spacing: 0) {
            // Header with status
            terminalHeader

            Divider()

            // Terminal output area
            terminalOutputArea

            Divider()

            // Command input area
            commandInputArea
        }
        .background(Color.black)
        .cornerRadius(8)
        .overlay {
            RoundedRectangle(cornerRadius: 8)
                .stroke(.separator, lineWidth: 0.5)
        }
        .onAppear {
            initializeShell()
        }
        .sheet(isPresented: $showProcessDetails) {
            processDetailsView
        }
        .sheet(isPresented: $showingHistoryView) {
            if let database = appState.database {
                CommandHistoryView(database: database)
            }
        }
    }

    // MARK: - Header

    private var terminalHeader: some View {
        HStack {
            HStack(spacing: 8) {
                Image(systemName: "terminal.fill")
                    .foregroundStyle(.green)
                    .font(.headline)

                Text("Shell")
                    .font(.headline)
                    .foregroundStyle(.primary)

                // Process status indicator
                processStatusIndicator
            }

            Spacer()

            // Process statistics
            if !activeProcesses.isEmpty {
                processStatistics
            }

            // Working directory display
            Text(currentWorkingDirectory.replacingOccurrences(of: NSHomeDirectory(), with: "~"))
                .font(.caption)
                .foregroundStyle(.secondary)
                .fontDesign(.monospaced)
                .lineLimit(1)
                .truncationMode(.head)

            // Process details button
            if !activeProcesses.isEmpty {
                Button(action: { showProcessDetails = true }) {
                    Image(systemName: "list.bullet.circle")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(PlainButtonStyle())
            }

            // History button
            Button(action: { showingHistoryView = true }) {
                Image(systemName: "clock.arrow.circlepath")
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(PlainButtonStyle())

            // Clear button
            Button(action: clearHistory) {
                Image(systemName: "trash")
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(PlainButtonStyle())
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.primary.opacity(0.05))
    }

    // MARK: - Terminal Output

    private var terminalOutputArea: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 4) {
                    // Welcome message
                    if commandHistory.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Isometry Shell")
                                .font(.title3)
                                .foregroundStyle(.green)
                                .fontDesign(.monospaced)

                            Text("App Sandbox-compliant terminal. Type 'help' for available commands.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .fontDesign(.monospaced)

                            Text("Allowed commands: \(Array(sandboxExecutor.supportedCommands).sorted().prefix(5).joined(separator: ", "))...")
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                                .fontDesign(.monospaced)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                    }

                    // Command history display
                    ForEach(Array(commandHistory.enumerated()), id: \.element.id) { index, entry in
                        terminalEntry(entry, index: index)
                    }

                    // Current executing command
                    if isExecuting {
                        executingCommandView
                    }

                    // Error display
                    if let error = errorMessage {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.red)
                            .fontDesign(.monospaced)
                            .padding(.horizontal, 12)
                    }
                }
                .padding(.vertical, 8)
            }
            .background(Color.black)
            .onChange(of: commandHistory.count) { _, _ in
                withAnimation(.easeOut(duration: 0.3)) {
                    proxy.scrollTo("bottom", anchor: .bottom)
                }
            }
            .overlay(alignment: .bottom) {
                Color.clear
                    .frame(height: 1)
                    .id("bottom")
            }
        }
        .frame(minHeight: 200, maxHeight: .infinity)
    }

    private func terminalEntry(_ entry: HistoryEntry, index: Int) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            // Command prompt
            HStack(spacing: 4) {
                // Show different prompt for Claude vs system commands
                if entry.type == .claude {
                    Text("🤖")
                        .foregroundStyle(.blue)
                        .fontDesign(.monospaced)
                } else {
                    Text(promptString)
                        .foregroundStyle(.green)
                        .fontDesign(.monospaced)
                }

                Text(entry.command)
                    .foregroundStyle(.primary)
                    .fontDesign(.monospaced)

                Spacer()

                // Show command type indicator
                Text(entry.type == .claude ? "AI" : "SYS")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .fontDesign(.monospaced)
                    .padding(.horizontal, 4)
                    .background(entry.type == .claude ? Color.blue.opacity(0.2) : Color.green.opacity(0.2))
                    .cornerRadius(4)

                if let duration = entry.duration {
                    Text(String(format: "%.0fms", duration * 1000))
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .fontDesign(.monospaced)
                }
            }
            .font(.caption)

            // Command output
            if let response = entry.response {
                if !response.output.isEmpty {
                    Text(response.output)
                        .font(.caption)
                        .foregroundStyle(response.success ? .primary : .secondary)
                        .fontDesign(.monospaced)
                }

                if let error = response.error, !error.isEmpty {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                        .fontDesign(.monospaced)
                }
            }
        }
        .padding(.horizontal, 12)
        .textSelection(.enabled)
    }

    private var executingCommandView: some View {
        HStack(spacing: 4) {
            Text(promptString)
                .foregroundStyle(.green)
                .fontDesign(.monospaced)

            Text(commandInput)
                .foregroundStyle(.primary)
                .fontDesign(.monospaced)

            Spacer()

            HStack(spacing: 4) {
                ProgressView()
                    .scaleEffect(0.6)
                Text("executing...")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .font(.caption)
        .padding(.horizontal, 12)
    }

    // MARK: - Command Input

    private var commandInputArea: some View {
        HStack(spacing: 8) {
            Text(promptString)
                .font(.caption)
                .foregroundStyle(.green)
                .fontDesign(.monospaced)

            TextField("Enter command...", text: $commandInput)
                .textFieldStyle(PlainTextFieldStyle())
                .font(.caption)
                .fontDesign(.monospaced)
                .foregroundStyle(.primary)
                .disabled(isExecuting)
                .onSubmit {
                    executeCommand()
                }
                .onKeyPress(.upArrow) {
                    navigateHistory(direction: .up)
                    return .handled
                }
                .onKeyPress(.downArrow) {
                    navigateHistory(direction: .down)
                    return .handled
                }
                .onKeyPress(.escape) {
                    cancelExecution()
                    return .handled
                }

            if isExecuting {
                Button("Cancel") {
                    if currentlyExecutingCommand.isEmpty {
                        cancelExecution()
                    } else {
                        showCancelConfirmation = true
                    }
                }
                .font(.caption)
                .foregroundStyle(.red)
                .confirmationDialog(
                    "Cancel Command?",
                    isPresented: $showCancelConfirmation,
                    titleVisibility: .visible
                ) {
                    Button("Cancel Command", role: .destructive) {
                        cancelCurrentCommand()
                    }
                    Button("Continue", role: .cancel) { }
                } message: {
                    Text("This will terminate the running process: '\(currentlyExecutingCommand)'")
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.primary.opacity(0.03))
    }

    // MARK: - Process Management Views

    private var processStatusIndicator: some View {
        HStack(spacing: 4) {
            if isExecuting {
                ProgressView()
                    .scaleEffect(0.7)
                    .foregroundStyle(.orange)
                Text("Running")
                    .font(.caption2)
                    .foregroundStyle(.orange)
            } else if !activeProcesses.isEmpty {
                let runningCount = activeProcesses.values.filter { $0.isActive }.count
                if runningCount > 0 {
                    Circle()
                        .fill(.blue)
                        .frame(width: 8, height: 8)
                    Text("\(runningCount) bg")
                        .font(.caption2)
                        .foregroundStyle(.blue)
                } else {
                    Circle()
                        .fill(.green)
                        .frame(width: 8, height: 8)
                }
            } else {
                Circle()
                    .fill(.green)
                    .frame(width: 8, height: 8)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: isExecuting)
        .animation(.easeInOut(duration: 0.3), value: activeProcesses.count)
    }

    private var processStatistics: some View {
        HStack(spacing: 4) {
            let runningProcesses = activeProcesses.values.filter { $0.isActive }.count
            let backgroundProcesses = activeProcesses.values.filter { $0 == .backgrounded }.count

            if runningProcesses > 0 {
                Image(systemName: "play.circle.fill")
                    .foregroundStyle(.blue)
                    .font(.caption)
                Text("\(runningProcesses)")
                    .font(.caption)
                    .foregroundStyle(.blue)
            }

            if backgroundProcesses > 0 {
                Image(systemName: "moon.circle.fill")
                    .foregroundStyle(.purple)
                    .font(.caption)
                Text("\(backgroundProcesses)")
                    .font(.caption)
                    .foregroundStyle(.purple)
            }
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 4))
    }

    private var sortedActiveProcesses: [(String, ManagedProcessState)] {
        Array(activeProcesses).sorted(by: { $0.0 < $1.0 })
    }

    private var processDetailsView: some View {
        NavigationView {
            List {
                if activeProcesses.isEmpty {
                    ContentUnavailableView(
                        "No Active Processes",
                        systemImage: "terminal",
                        description: Text("All commands have completed")
                    )
                } else {
                    ForEach(sortedActiveProcesses, id: \.0) { item in
                        let (command, state) = item
                        HStack {
                            Image(systemName: state.icon)
                                .foregroundStyle(colorForState(state))
                                .font(.title2)

                            VStack(alignment: .leading, spacing: 4) {
                                Text(command)
                                    .font(.body)
                                    .fontDesign(.monospaced)

                                Text(state.description)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            Spacer()

                            if state.isActive {
                                Button("Cancel") {
                                    Task {
                                        await sandboxExecutor.cancelCommand(command)
                                        await updateProcessStatus()
                                    }
                                }
                                .font(.caption)
                                .foregroundStyle(.red)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            .navigationTitle("Process Manager")
            #if canImport(UIKit)
.navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button("Done") {
                        showProcessDetails = false
                    }
                }
            }
        }
    }

    private func colorForState(_ state: ManagedProcessState) -> Color {
        switch state {
        case .idle:
            return .gray
        case .running:
            return .blue
        case .suspended:
            return .yellow
        case .terminated:
            return .red
        case .backgrounded:
            return .orange
        case .completed:
            return .green
        case .failed:
            return .red
        }
    }

    // MARK: - Helper Properties

    private var promptString: String {
        let user = ProcessInfo.processInfo.environment["USER"] ?? "user"
        let host = "isometry"
        let dir = currentWorkingDirectory.replacingOccurrences(of: NSHomeDirectory(), with: "~")
        let shortDir = String(dir.split(separator: "/").last ?? "~")
        return "\(user)@\(host):\(shortDir)$"
    }

    // MARK: - Actions

    private func initializeShell() {
        currentWorkingDirectory = FileManager.default.currentDirectoryPath
        shellSession.updateCurrentDirectory(currentWorkingDirectory)

        // Initialize Claude API client
        claudeAPIClient = ClaudeAPIClient.create()
        isClaudeConfigured = ClaudeAPIClient.isConfigured()

        // Initialize command history manager
        if let database = appState.database {
            commandHistoryManager = CommandHistoryManager(database: database)
        }

        // Start process monitoring
        startProcessMonitoring()
    }

    private func executeCommand() {
        guard !commandInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return
        }

        let command = commandInput.trimmingCharacters(in: .whitespacesAndNewlines)
        commandInput = ""
        historyIndex = -1
        errorMessage = nil

        // Handle built-in commands
        if handleBuiltinCommand(command) {
            return
        }

        // Handle Claude commands
        if command.hasPrefix("/claude") {
            executeClaudeCommand(command)
            return
        }

        // Execute through SandboxExecutor
        let shellCommand = ShellCommand(
            type: .system,
            command: command,
            cwd: currentWorkingDirectory,
            context: nil
        )

        isExecuting = true
        currentlyExecutingCommand = command
        processStartTime = Date()

        Task {
            // Use enhanced execution with background support
            let result = await sandboxExecutor.executeWithBackgroundSupport(
                command,
                workingDirectory: currentWorkingDirectory
            )

            // Update process status
            await updateProcessStatus()

            let response = CommandResponse(
                commandId: shellCommand.id,
                success: result.success,
                output: result.output,
                error: result.error,
                duration: result.duration,
                type: .system
            )

            let historyEntry = HistoryEntry(
                command: command,
                type: .system,
                timestamp: shellCommand.timestamp,
                response: response,
                duration: result.duration,
                cwd: currentWorkingDirectory
            )

            await MainActor.run {
                commandHistory.append(historyEntry)
                shellSession.addCommand(shellCommand)
                isExecuting = false
                currentlyExecutingCommand = ""

                // Save to persistent history
                Task {
                    await saveCommandToHistory(shellCommand, response: response)
                }

                // Update working directory if pwd command was successful
                if command == "pwd" && result.success {
                    let newDir = result.output.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !newDir.isEmpty {
                        currentWorkingDirectory = newDir
                        shellSession.updateCurrentDirectory(newDir)
                    }
                }
            }
        }
    }

    private func executeClaudeCommand(_ command: String) {
        // Extract prompt from "/claude prompt text"
        let prompt = command.replacingOccurrences(of: "/claude", with: "").trimmingCharacters(in: .whitespacesAndNewlines)

        if prompt.isEmpty {
            addBuiltinResponse(command: command, output: "Usage: /claude <your question or prompt>")
            return
        }

        // Check if Claude is configured
        guard isClaudeConfigured, let client = claudeAPIClient else {
            let instructions = ClaudeAPIClient.configurationInstructions().joined(separator: "\n")
            addBuiltinResponse(
                command: command,
                output: "❌ Claude API not configured.\n\n\(instructions)"
            )
            return
        }

        isExecuting = true

        Task {
            let startTime = CFAbsoluteTimeGetCurrent()

            do {
                // Create shell context for enrichment
                let recentCommands = commandHistory.suffix(3).map { $0.command }
                let _ = ShellContext(
                    workingDirectory: currentWorkingDirectory,
                    recentCommands: Array(recentCommands),
                    environment: ProcessInfo.processInfo.environment
                )

                // Send to Claude with context
                let (response, duration) = try await client.sendMessageWithTracking(
                    ClaudeRequest.text(prompt: prompt, maxTokens: 1000),
                    context: "shell_command"
                )

                // Format response for terminal display
                let formattedOutput = ClaudeAPIClient.formatForShell(response)

                // Create command response
                let commandResponse = CommandResponse(
                    commandId: UUID(),
                    success: true,
                    output: formattedOutput,
                    duration: duration,
                    type: .claude
                )

                let historyEntry = HistoryEntry(
                    command: command,
                    type: .claude,
                    timestamp: Date(),
                    response: commandResponse,
                    duration: duration,
                    cwd: currentWorkingDirectory
                )

                await MainActor.run {
                    commandHistory.append(historyEntry)

                    let shellCommand = ShellCommand(
                        type: .claude,
                        command: command,
                        cwd: currentWorkingDirectory
                    )
                    shellSession.addCommand(shellCommand)

                    isExecuting = false

                    // Save to persistent history
                    Task {
                        await saveCommandToHistory(shellCommand, response: commandResponse)
                    }
                }

            } catch {
                let duration = CFAbsoluteTimeGetCurrent() - startTime
                let errorOutput: String

                if let claudeError = error as? ClaudeError {
                    errorOutput = "❌ Claude Error: \(claudeError.localizedDescription)"
                } else {
                    errorOutput = "❌ Network Error: \(error.localizedDescription)"
                }

                let commandResponse = CommandResponse(
                    commandId: UUID(),
                    success: false,
                    output: "",
                    error: errorOutput,
                    duration: duration,
                    type: .claude
                )

                let historyEntry = HistoryEntry(
                    command: command,
                    type: .claude,
                    timestamp: Date(),
                    response: commandResponse,
                    duration: duration,
                    cwd: currentWorkingDirectory
                )

                await MainActor.run {
                    commandHistory.append(historyEntry)

                    let shellCommand = ShellCommand(
                        type: .claude,
                        command: command,
                        cwd: currentWorkingDirectory
                    )
                    shellSession.addCommand(shellCommand)

                    isExecuting = false

                    // Save to persistent history
                    Task {
                        await saveCommandToHistory(shellCommand, response: commandResponse)
                    }
                }
            }
        }
    }

    private func handleBuiltinCommand(_ command: String) -> Bool {
        let parts = command.split(separator: " ", maxSplits: 1).map(String.init)
        let cmd = parts[0]

        switch cmd {
        case "help":
            let claudeStatus = isClaudeConfigured ? "✅ Available" : "❌ Not configured"
            let helpText = """
                Available commands:
                • File operations: ls, pwd, cat, head, tail, find
                • Text processing: grep, sort, uniq, wc
                • System info: date, whoami, uname, which, echo
                • Built-in: help, clear, history
                • AI Assistant: /claude <prompt> (\(claudeStatus))

                Examples:
                  /claude what is the current working directory?
                  /claude explain this error message
                  /claude help me debug this issue

                Security: App Sandbox restrictions apply.
                """
            addBuiltinResponse(command: command, output: helpText)
            return true

        case "clear":
            commandHistory.removeAll()
            return true

        case "history":
            let historyText = commandHistory.enumerated().map { index, entry in
                "\(index + 1): \(entry.command)"
            }.joined(separator: "\n")
            addBuiltinResponse(command: command, output: historyText.isEmpty ? "No command history" : historyText)
            return true

        default:
            return false
        }
    }

    private func addBuiltinResponse(command: String, output: String) {
        let response = CommandResponse(
            commandId: UUID(),
            success: true,
            output: output,
            duration: 0.001,
            type: .system
        )

        let entry = HistoryEntry(
            command: command,
            type: .system,
            timestamp: Date(),
            response: response,
            duration: 0.001,
            cwd: currentWorkingDirectory
        )

        commandHistory.append(entry)
    }

    private func navigateHistory(direction: NavigationDirection) {
        guard !commandHistory.isEmpty else { return }

        switch direction {
        case .up:
            if historyIndex < commandHistory.count - 1 {
                historyIndex += 1
                commandInput = commandHistory[commandHistory.count - 1 - historyIndex].command
            }
        case .down:
            if historyIndex > 0 {
                historyIndex -= 1
                commandInput = commandHistory[commandHistory.count - 1 - historyIndex].command
            } else if historyIndex == 0 {
                historyIndex = -1
                commandInput = ""
            }
        }
    }

    private func clearHistory() {
        commandHistory.removeAll()
        historyIndex = -1
        errorMessage = nil
    }

    private func cancelCurrentCommand() {
        guard !currentlyExecutingCommand.isEmpty else { return }

        Task {
            await sandboxExecutor.cancelCommand(currentlyExecutingCommand)
            await updateProcessStatus()

            await MainActor.run {
                isExecuting = false
                currentlyExecutingCommand = ""
                errorMessage = "Command cancelled by user"
            }
        }
    }

    private func cancelExecution() {
        if !currentlyExecutingCommand.isEmpty {
            cancelCurrentCommand()
        } else {
            isExecuting = false
            currentlyExecutingCommand = ""
        }
    }

    /// Update process status from SandboxExecutor
    private func updateProcessStatus() async {
        let status = await sandboxExecutor.activeProcessStatus
        await MainActor.run {
            activeProcesses = status
        }
    }

    /// Start monitoring process status
    private func startProcessMonitoring() {
        Task {
            while true {
                await updateProcessStatus()
                try? await Task.sleep(for: .seconds(2))
            }
        }
    }

    /// Save command to persistent history
    private func saveCommandToHistory(_ command: ShellCommand, response: CommandResponse) async {
        guard let historyManager = commandHistoryManager else { return }

        do {
            try await historyManager.saveCommand(
                command,
                response: response,
                context: command.context,
                sessionId: shellSession.sessionId.uuidString
            )
        } catch {
            // Log error but don't interrupt shell operation
            print("Failed to save command history: \(error)")
        }
    }

    // MARK: - Supporting Types

    private enum NavigationDirection {
        case up, down
    }
}

// MARK: - Preview

#Preview {
    NotebookShellView()
        .padding()
        .background(.background.secondary)
}