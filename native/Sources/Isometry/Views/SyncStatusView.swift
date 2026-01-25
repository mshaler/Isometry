import SwiftUI

/// Displays detailed sync status information with progress tracking and conflict resolution
public struct SyncStatusView: View {
    @EnvironmentObject private var appState: AppState
    @State private var syncState: SyncState?
    @State private var isLoading = true
    @State private var syncProgress: Double = 0.0
    @State private var showConflictList = false
    @State private var conflicts: [SyncConflict] = []

    public init() {}

    public var body: some View {
        List {
            // Progress section for active sync
            if case .syncing = appState.syncStatus {
                Section {
                    syncProgressView
                }
            } else if let state = syncState, state.isInitialSyncInProgress {
                Section("Initial Sync") {
                    initialSyncProgressView(state)
                }
            }

            Section("Status") {
                statusRow
            }

            if let state = syncState {
                Section("Details") {
                    detailRow("Last Sync", value: formatDate(state.lastSyncAt))
                        .accessibilityIdentifier(AccessibilityID.lastSyncTime)
                    detailRow("Pending Changes", value: "\(state.pendingChanges)")
                        .accessibilityIdentifier(AccessibilityID.pendingChanges)

                    // Conflict row with navigation
                    if state.conflictCount > 0 {
                        Button {
                            loadConflicts()
                            showConflictList = true
                        } label: {
                            HStack {
                                Text("Conflicts")
                                    .foregroundStyle(.primary)
                                Spacer()
                                Text("\(state.conflictCount)")
                                    .foregroundStyle(.orange)
                                    .fontWeight(.semibold)
                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .accessibilityIdentifier(AccessibilityID.conflictCount)
                    } else {
                        detailRow("Conflicts", value: "0")
                            .accessibilityIdentifier(AccessibilityID.conflictCount)
                    }

                    // Resolution history
                    if state.totalConflictsResolved > 0 {
                        detailRow("Resolved", value: "\(state.totalConflictsResolved)")
                    }
                }

                if state.consecutiveFailures > 0 {
                    Section("Errors") {
                        detailRow("Failed Attempts", value: "\(state.consecutiveFailures)")
                        if let errorMessage = state.lastError {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(SyncStatusView.userFriendlyMessage(forErrorString: errorMessage))
                                    .font(.caption)
                                    .foregroundStyle(.red)

                                if let suggestion = recoverySuggestion(for: errorMessage) {
                                    Text(suggestion)
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }

                // Sync strategy section
                Section("Settings") {
                    HStack {
                        Text("Conflict Strategy")
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text(strategyDisplayName(state.conflictStrategy))
                            .font(.caption)
                    }
                }
            }

            Section {
                syncButton
            }
        }
        .navigationTitle("Sync Status")
        .task {
            await loadSyncState()
            setupProgressTracking()
        }
        .refreshable {
            await loadSyncState()
        }
        .sheet(isPresented: $showConflictList) {
            ConflictListView(
                conflicts: conflicts,
                onResolve: { resolution in
                    Task {
                        await resolveConflict(resolution)
                    }
                },
                onResolveAll: { strategy in
                    Task {
                        await resolveAllConflicts(strategy: strategy)
                    }
                },
                onDismiss: {
                    showConflictList = false
                    Task { await loadSyncState() }
                }
            )
        }
    }

    // MARK: - Progress Views

    private var syncProgressView: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                ProgressView()
                    .scaleEffect(0.8)
                Text("Syncing...")
                    .font(.subheadline)
                Spacer()
                Text("\(Int(syncProgress * 100))%")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            ProgressView(value: syncProgress)
                .progressViewStyle(.linear)
                .tint(.blue)

            Text(syncPhaseDescription)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    private func initialSyncProgressView(_ state: SyncState) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Downloading notes...")
                    .font(.subheadline)
                Spacer()
                Text("\(state.initialSyncCompleted)/\(state.initialSyncTotal)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            ProgressView(value: state.initialSyncProgress)
                .progressViewStyle(.linear)
                .tint(.blue)
        }
    }

    private var syncPhaseDescription: String {
        if syncProgress < 0.5 {
            return "Uploading local changes..."
        } else if syncProgress < 0.95 {
            return "Downloading remote changes..."
        } else {
            return "Finishing up..."
        }
    }

    // MARK: - Sync Button

    private var syncButton: some View {
        Button {
            Task {
                await performSync()
            }
        } label: {
            HStack {
                Spacer()
                if case .syncing = appState.syncStatus {
                    ProgressView()
                        .padding(.trailing, 8)
                    Text("Syncing...")
                } else {
                    Image(systemName: "arrow.triangle.2.circlepath")
                    Text("Sync Now")
                }
                Spacer()
            }
        }
        .disabled(appState.syncStatus == .syncing)
        .accessibilityIdentifier(AccessibilityID.syncButton)
    }

    private var statusRow: some View {
        HStack {
            statusIcon
            Text(statusText)
            Spacer()
            statusBadge
        }
        .accessibilityIdentifier(AccessibilityID.syncStatus)
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
            return SyncStatusView.userFriendlyMessage(for: error)
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

    private func strategyDisplayName(_ strategy: SyncConflictStrategy) -> String {
        switch strategy {
        case .serverWins: return "Server Wins"
        case .localWins: return "Local Wins"
        case .latestWins: return "Latest Wins"
        case .fieldLevelMerge: return "Merge"
        case .manualResolution: return "Manual"
        }
    }

    private func recoverySuggestion(for errorMessage: String) -> String? {
        if errorMessage.contains("network") || errorMessage.contains("internet") {
            return "Check your internet connection and try again."
        }
        if errorMessage.contains("iCloud") || errorMessage.contains("sign in") {
            return "Open Settings > [Your Name] > iCloud to sign in."
        }
        if errorMessage.contains("storage") || errorMessage.contains("quota") {
            return "Go to Settings > [Your Name] > iCloud > Manage Storage."
        }
        return nil
    }

    // MARK: - Actions

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

    private func setupProgressTracking() {
        // Set up progress callback from sync manager
        Task {
            if let syncManager = appState.syncManager {
                await syncManager.onProgressUpdate = { progress in
                    Task { @MainActor in
                        self.syncProgress = progress
                    }
                }
            }
        }
    }

    private func performSync() async {
        syncProgress = 0.0
        await appState.sync()
        await loadSyncState()
    }

    private func loadConflicts() {
        Task {
            if let syncManager = appState.syncManager {
                conflicts = await syncManager.getPendingConflicts()
            }
        }
    }

    private func resolveConflict(_ resolution: ConflictResolution) async {
        guard let syncManager = appState.syncManager else { return }

        do {
            try await syncManager.resolveConflict(nodeId: resolution.nodeId, with: resolution.resolvedNode)
            await loadSyncState()

            // Remove from local list
            conflicts.removeAll { $0.nodeId == resolution.nodeId }

            if conflicts.isEmpty {
                showConflictList = false
            }
        } catch {
            print("Failed to resolve conflict: \(error)")
        }
    }

    private func resolveAllConflicts(strategy: ConflictResolutionStrategy) async {
        guard let syncManager = appState.syncManager else { return }

        await syncManager.setConflictResolutionStrategy(strategy)

        // Trigger sync to apply strategy to all conflicts
        await performSync()
        showConflictList = false
    }
}

// MARK: - User-Friendly Error Messages

extension SyncStatusView {
    /// Converts technical sync errors to user-friendly messages
    static func userFriendlyMessage(for error: Error) -> String {
        // First try CloudKitErrorHandler
        if let userError = CloudKitErrorHandler.handle(error) {
            return userError.errorDescription ?? "Unable to sync. Please try again later."
        }

        let nsError = error as NSError

        // CloudKit specific errors
        if nsError.domain == "CKErrorDomain" {
            switch nsError.code {
            case 1: // CKError.internalError
                return "iCloud is temporarily unavailable. Please try again later."
            case 2: // CKError.networkUnavailable
                return "No internet connection. Your changes will sync when you're back online."
            case 3: // CKError.networkFailure
                return "Connection interrupted. Please check your internet and try again."
            case 6: // CKError.notAuthenticated
                return "Please sign in to iCloud in Settings to sync your data."
            case 9: // CKError.quotaExceeded
                return "Your iCloud storage is full. Free up space to continue syncing."
            case 11: // CKError.serverRejectedRequest
                return "Sync was rejected. Please try again or contact support."
            case 25: // CKError.accountTemporarilyUnavailable
                return "iCloud is temporarily unavailable. Your data is safe locally."
            default:
                return "Unable to sync. Please try again later."
            }
        }

        // Generic errors
        if (error as NSError).code == -1009 { // No internet
            return "No internet connection. Your changes will sync automatically when connected."
        }

        return "Unable to sync. Please try again later."
    }

    /// Converts error string to user-friendly message
    static func userFriendlyMessage(forErrorString errorString: String) -> String {
        let lowercased = errorString.lowercased()

        if lowercased.contains("network") || lowercased.contains("offline") {
            return "No internet connection. Changes will sync when online."
        }
        if lowercased.contains("not authenticated") || lowercased.contains("sign in") {
            return "Please sign in to iCloud to sync."
        }
        if lowercased.contains("quota") || lowercased.contains("storage") {
            return "iCloud storage full."
        }
        if lowercased.contains("conflict") {
            return "Sync conflict detected. Please resolve manually."
        }

        return errorString
    }
}

// MARK: - Accessibility Identifiers

extension SyncStatusView {
    enum AccessibilityID {
        static let syncStatus = "sync.status.indicator"
        static let syncButton = "sync.status.syncNow"
        static let lastSyncTime = "sync.status.lastSync"
        static let pendingChanges = "sync.status.pending"
        static let conflictCount = "sync.status.conflicts"
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        SyncStatusView()
            .environmentObject(AppState())
    }
}
