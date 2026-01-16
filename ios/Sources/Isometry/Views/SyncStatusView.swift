import SwiftUI

/// Displays detailed sync status information
public struct SyncStatusView: View {
    @EnvironmentObject private var appState: AppState
    @State private var syncState: SyncState?
    @State private var isLoading = true

    public init() {}

    public var body: some View {
        List {
            Section("Status") {
                statusRow
            }

            if let state = syncState {
                Section("Details") {
                    detailRow("Last Sync", value: formatDate(state.lastSyncAt))
                    detailRow("Pending Changes", value: "\(state.pendingChanges)")
                    detailRow("Conflicts", value: "\(state.conflictCount)")
                }

                if state.consecutiveFailures > 0 {
                    Section("Errors") {
                        detailRow("Failed Attempts", value: "\(state.consecutiveFailures)")
                        if let error = state.lastError {
                            Text(error)
                                .font(.caption)
                                .foregroundStyle(.red)
                        }
                    }
                }
            }

            Section {
                Button {
                    Task {
                        await appState.sync()
                        await loadSyncState()
                    }
                } label: {
                    HStack {
                        Spacer()
                        if case .syncing = appState.syncStatus {
                            ProgressView()
                                .padding(.trailing, 8)
                            Text("Syncing...")
                        } else {
                            Text("Sync Now")
                        }
                        Spacer()
                    }
                }
                .disabled(appState.syncStatus == .syncing)
            }
        }
        .navigationTitle("Sync Status")
        .task {
            await loadSyncState()
        }
        .refreshable {
            await loadSyncState()
        }
    }

    private var statusRow: some View {
        HStack {
            statusIcon
            Text(statusText)
            Spacer()
            statusBadge
        }
    }

    @ViewBuilder
    private var statusIcon: some View {
        switch appState.syncStatus {
        case .idle:
            Image(systemName: "arrow.triangle.2.circlepath")
                .foregroundStyle(.secondary)
        case .syncing:
            ProgressView()
                .scaleEffect(0.8)
        case .synced:
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(.green)
        case .error:
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundStyle(.red)
        }
    }

    private var statusText: String {
        switch appState.syncStatus {
        case .idle:
            return "Ready to sync"
        case .syncing:
            return "Syncing..."
        case .synced:
            return "Up to date"
        case .error(let error):
            return error.localizedDescription
        }
    }

    @ViewBuilder
    private var statusBadge: some View {
        if let state = syncState {
            Text(state.statusSummary)
                .font(.caption)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(badgeColor.opacity(0.2))
                .foregroundStyle(badgeColor)
                .clipShape(Capsule())
        }
    }

    private var badgeColor: Color {
        guard let state = syncState else { return .gray }
        if state.hasConflicts { return .orange }
        if state.consecutiveFailures > 0 { return .red }
        if state.hasPendingChanges { return .blue }
        return .green
    }

    private func detailRow(_ label: String, value: String) -> some View {
        HStack {
            Text(label)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
        }
    }

    private func formatDate(_ date: Date?) -> String {
        guard let date else { return "Never" }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    private func loadSyncState() async {
        guard let db = appState.database else { return }
        isLoading = true

        do {
            syncState = try await db.getSyncState()
        } catch {
            print("Failed to load sync state: \(error)")
        }

        isLoading = false
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        SyncStatusView()
            .environmentObject(AppState())
    }
}
