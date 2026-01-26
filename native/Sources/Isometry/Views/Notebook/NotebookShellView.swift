import SwiftUI
import Foundation

/// Shell component for the notebook workflow with native terminal interface
/// App Sandbox-compliant terminal with secure process execution
public struct NotebookShellView: View {
    @State private var sandboxExecutor = SandboxExecutor()
    @StateObject private var shellSession = ShellSession()
    @State private var commandInput: String = ""
    @State private var commandHistory: [HistoryEntry] = []
    @State private var isExecuting: Bool = false
    @State private var currentWorkingDirectory: String = FileManager.default.currentDirectoryPath
    @State private var historyIndex: Int = -1
    @State private var errorMessage: String?

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

                // Connection status indicator
                Circle()
                    .fill(isExecuting ? .yellow : .green)
                    .frame(width: 8, height: 8)
                    .animation(.easeInOut(duration: 0.5).repeatForever(autoreverses: true), value: isExecuting)
            }

            Spacer()

            // Working directory display
            Text(currentWorkingDirectory.replacingOccurrences(of: NSHomeDirectory(), with: "~"))
                .font(.caption)
                .foregroundStyle(.secondary)
                .fontDesign(.monospaced)
                .lineLimit(1)
                .truncationMode(.head)

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
                Text(promptString)
                    .foregroundStyle(.green)
                    .fontDesign(.monospaced)

                Text(entry.command)
                    .foregroundStyle(.primary)
                    .fontDesign(.monospaced)

                Spacer()

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
                    cancelExecution()
                }
                .font(.caption)
                .foregroundStyle(.red)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.primary.opacity(0.03))
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

        // Execute through SandboxExecutor
        let shellCommand = ShellCommand(
            type: .system,
            command: command,
            cwd: currentWorkingDirectory,
            context: nil
        )

        isExecuting = true

        Task {
            let result = await sandboxExecutor.execute(
                command,
                workingDirectory: currentWorkingDirectory
            )

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

    private func handleBuiltinCommand(_ command: String) -> Bool {
        let parts = command.split(separator: " ", maxSplits: 1).map(String.init)
        let cmd = parts[0]

        switch cmd {
        case "help":
            let helpText = """
                Available commands:
                • File operations: ls, pwd, cat, head, tail, find
                • Text processing: grep, sort, uniq, wc
                • System info: date, whoami, uname, which, echo
                • Built-in: help, clear, history

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

    private func cancelExecution() {
        isExecuting = false
        // Note: Process termination would be handled by SandboxExecutor timeout
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