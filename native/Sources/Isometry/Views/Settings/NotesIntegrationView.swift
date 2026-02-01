import SwiftUI
import EventKit

/// SwiftUI interface for Apple Notes integration configuration
/// Provides comprehensive control over live sync, permissions, and conflict resolution
public struct NotesIntegrationView: View {

    // MARK: - State Management

    @StateObject private var accessManager = NotesAccessManager()
    @StateObject private var liveImporter: AppleNotesLiveImporter
    @State private var permissionStatus: NotesAccessManager.PermissionStatus = .notDetermined
    @State private var isRequestingPermission = false
    @State private var showingConflicts = false
    @State private var showingPermissionHelp = false
    @State private var liveSyncConfig = AppleNotesLiveImporter.LiveSyncConfiguration.default

    // Performance settings
    @AppStorage("notes.sync.enabled") private var liveSyncEnabled = false
    @AppStorage("notes.sync.frequency") private var syncFrequency = 30.0
    @AppStorage("notes.sync.autoResolve") private var autoResolveConflicts = true
    @AppStorage("notes.sync.performanceMode") private var performanceMode = "balanced"

    // Statistics tracking
    @State private var lastSyncTime: Date?
    @State private var conflictCount: Int = 0
    @State private var totalNotesCount: Int = 0

    private let database: IsometryDatabase

    public init(database: IsometryDatabase) {
        self.database = database
        self._liveImporter = StateObject(wrappedValue: AppleNotesLiveImporter(database: database))
    }

    // MARK: - Main View

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                headerSection
                permissionSection

                if permissionStatus == .authorized {
                    liveSyncSection
                    conflictResolutionSection
                    performanceSection
                    statisticsSection
                } else {
                    fallbackSection
                }
            }
            .padding()
        }
        .navigationTitle("Notes Integration")
        .task {
            await updatePermissionStatus()
            await updateStatistics()
        }
        .sheet(isPresented: $showingConflicts) {
            ConflictHistoryView(conflictResolver: liveImporter.conflictResolver)
        }
        .sheet(isPresented: $showingPermissionHelp) {
            PermissionHelpView(accessManager: accessManager)
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "doc.text")
                    .foregroundColor(.blue)
                    .font(.title2)

                VStack(alignment: .leading) {
                    Text("Apple Notes Integration")
                        .font(.headline)

                    Text("Sync your Apple Notes with real-time monitoring and conflict resolution")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                syncStatusIndicator
            }
        }
    }

    // MARK: - Permission Section

    private var permissionSection: some View {
        GroupBox("Permissions") {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    permissionStatusBadge
                    Spacer()

                    Button(action: { showingPermissionHelp = true }) {
                        Image(systemName: "questionmark.circle")
                    }
                    .buttonStyle(PlainButtonStyle())
                }

                Text(permissionStatusMessage)
                    .font(.caption)
                    .foregroundColor(.secondary)

                if permissionStatus == .notDetermined || permissionStatus == .denied {
                    Button(action: requestPermission) {
                        HStack {
                            if isRequestingPermission {
                                ProgressView()
                                    .scaleEffect(0.8)
                            } else {
                                Image(systemName: "key")
                            }

                            Text(permissionStatus == .notDetermined ? "Request Notes Access" : "Open Settings")
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isRequestingPermission)
                }
            }
        }
    }

    // MARK: - Live Sync Section

    private var liveSyncSection: some View {
        GroupBox("Live Synchronization") {
            VStack(alignment: .leading, spacing: 16) {
                Toggle("Enable Live Sync", isOn: $liveSyncEnabled)
                    .onChange(of: liveSyncEnabled) { enabled in
                        Task {
                            if enabled {
                                try? await startLiveSync()
                            } else {
                                await stopLiveSync()
                            }
                        }
                    }

                if liveSyncEnabled {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Sync Frequency")
                            .font(.subheadline)
                            .fontWeight(.medium)

                        HStack {
                            Text("Real-time")
                                .font(.caption)

                            Slider(value: $syncFrequency, in: 1...300, step: 1) {
                                Text("Sync Frequency")
                            }
                            .onChange(of: syncFrequency) { frequency in
                                updateSyncConfiguration()
                            }

                            Text("5min")
                                .font(.caption)
                        }

                        Text(syncFrequencyDescription)
                            .font(.caption)
                            .foregroundColor(.secondary)

                        Divider()

                        HStack {
                            VStack(alignment: .leading) {
                                Text("Sync Scope")
                                    .font(.subheadline)
                                    .fontWeight(.medium)

                                Picker("Sync Scope", selection: .constant("all")) {
                                    Text("All Notes").tag("all")
                                    Text("Recent Notes Only").tag("recent")
                                    Text("Specific Folders").tag("folders")
                                }
                                .pickerStyle(SegmentedPickerStyle())
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Conflict Resolution Section

    private var conflictResolutionSection: some View {
        GroupBox("Conflict Resolution") {
            VStack(alignment: .leading, spacing: 12) {
                Toggle("Auto-resolve Simple Conflicts", isOn: $autoResolveConflicts)

                Text("When enabled, simple conflicts like metadata changes will be resolved automatically using smart merge strategies.")
                    .font(.caption)
                    .foregroundColor(.secondary)

                HStack {
                    Text("Active Conflicts")
                    Spacer()

                    if conflictCount > 0 {
                        Button("\(conflictCount) conflicts") {
                            showingConflicts = true
                        }
                        .foregroundColor(.orange)
                    } else {
                        Text("None")
                            .foregroundColor(.secondary)
                    }
                }

                Button("View Conflict History") {
                    showingConflicts = true
                }
                .buttonStyle(.bordered)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    // MARK: - Performance Section

    private var performanceSection: some View {
        GroupBox("Performance") {
            VStack(alignment: .leading, spacing: 12) {
                Text("Processing Mode")
                    .font(.subheadline)
                    .fontWeight(.medium)

                Picker("Performance Mode", selection: $performanceMode) {
                    Text("Battery Saver").tag("battery")
                    Text("Balanced").tag("balanced")
                    Text("Performance").tag("performance")
                }
                .pickerStyle(SegmentedPickerStyle())
                .onChange(of: performanceMode) { mode in
                    updatePerformanceConfiguration(mode)
                }

                Text(performanceModeDescription)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }

    // MARK: - Statistics Section

    private var statisticsSection: some View {
        GroupBox("Statistics") {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Total Notes Synced")
                    Spacer()
                    Text("\(totalNotesCount)")
                        .foregroundColor(.secondary)
                }

                HStack {
                    Text("Last Sync")
                    Spacer()
                    Text(lastSyncTime?.formatted() ?? "Never")
                        .foregroundColor(.secondary)
                }

                HStack {
                    Text("Sync Status")
                    Spacer()
                    syncStatusIndicator
                }

                if let metrics = liveImporter.currentPerformanceMetrics {
                    Divider()

                    HStack {
                        Text("Total Syncs")
                        Spacer()
                        Text("\(metrics.totalSyncCount)")
                            .foregroundColor(.secondary)
                    }

                    HStack {
                        Text("Avg Duration")
                        Spacer()
                        Text(String(format: "%.1fs", metrics.averageSyncDuration))
                            .foregroundColor(.secondary)
                    }

                    if metrics.errorCount > 0 {
                        HStack {
                            Text("Errors")
                            Spacer()
                            Text("\(metrics.errorCount)")
                                .foregroundColor(.red)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Fallback Section

    private var fallbackSection: some View {
        GroupBox("Alternative Sync Methods") {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Image(systemName: "doc.badge.arrow.up")
                        .foregroundColor(.blue)

                    VStack(alignment: .leading) {
                        Text("Alto-Index Export")
                            .font(.subheadline)
                            .fontWeight(.medium)

                        Text("Export your Notes using the alto-index tool for periodic synchronization")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                Button("View Setup Instructions") {
                    // Open documentation or show instructions
                }
                .buttonStyle(.bordered)
            }
        }
    }

    // MARK: - Helper Views

    private var permissionStatusBadge: some View {
        HStack {
            Circle()
                .fill(permissionStatusColor)
                .frame(width: 8, height: 8)

            Text(permissionStatus.rawValue.capitalized)
                .font(.caption)
                .fontWeight(.medium)
        }
    }

    private var syncStatusIndicator: some View {
        HStack {
            Circle()
                .fill(syncStatusColor)
                .frame(width: 8, height: 8)

            Text(syncStatusText)
                .font(.caption)
                .fontWeight(.medium)
        }
    }

    // MARK: - Computed Properties

    private var permissionStatusColor: Color {
        switch permissionStatus {
        case .authorized:
            return .green
        case .denied, .restricted:
            return .red
        case .notDetermined:
            return .orange
        }
    }

    private var syncStatusColor: Color {
        switch liveImporter.currentSyncState {
        case .idle:
            return .gray
        case .monitoring:
            return .green
        case .syncing, .conflictResolution:
            return .blue
        case .error:
            return .red
        }
    }

    private var syncStatusText: String {
        switch liveImporter.currentSyncState {
        case .idle:
            return "Idle"
        case .monitoring:
            return "Monitoring"
        case .syncing:
            return "Syncing"
        case .conflictResolution:
            return "Resolving Conflicts"
        case .error:
            return "Error"
        }
    }

    private var permissionStatusMessage: String {
        switch permissionStatus {
        case .authorized:
            return "Full access granted. Live synchronization is available."
        case .denied:
            return "Access denied. Use alto-index export for periodic synchronization."
        case .restricted:
            return "Access restricted by administrator. Contact IT support."
        case .notDetermined:
            return "Permission required for live synchronization. Click to request access."
        }
    }

    private var syncFrequencyDescription: String {
        if syncFrequency <= 5 {
            return "Real-time monitoring (high performance impact)"
        } else if syncFrequency <= 30 {
            return "Frequent updates (balanced performance)"
        } else if syncFrequency <= 120 {
            return "Regular updates (battery friendly)"
        } else {
            return "Periodic updates (minimal battery impact)"
        }
    }

    private var performanceModeDescription: String {
        switch performanceMode {
        case "battery":
            return "Minimal background processing, longer sync intervals"
        case "performance":
            return "Maximum responsiveness, real-time updates"
        default:
            return "Balanced performance and battery usage"
        }
    }

    // MARK: - Actions

    private func requestPermission() {
        Task {
            isRequestingPermission = true

            do {
                let newStatus = try await accessManager.requestNotesAccess()
                await updatePermissionStatus()

                if newStatus == .authorized && liveSyncEnabled {
                    try await startLiveSync()
                }
            } catch {
                print("Permission request failed: \(error)")
            }

            isRequestingPermission = false
        }
    }

    private func startLiveSync() async throws {
        let config = createLiveSyncConfiguration()
        try await liveImporter.startLiveSync(configuration: config)
        await updateStatistics()
    }

    private func stopLiveSync() async {
        await liveImporter.stopLiveSync()
        await updateStatistics()
    }

    private func updatePermissionStatus() async {
        permissionStatus = await accessManager.checkCurrentPermissionStatus()
    }

    private func updateStatistics() async {
        // Update statistics from the live importer
        let metrics = await liveImporter.currentPerformanceMetrics
        conflictCount = await liveImporter.conflictResolver.activeConflictIds.count

        // Get total notes count from database
        // TODO: Add method to get total Notes count from database
    }

    private func updateSyncConfiguration() {
        liveSyncConfig = createLiveSyncConfiguration()

        // Update the live importer if it's running
        if liveSyncEnabled {
            Task {
                await stopLiveSync()
                try await startLiveSync()
            }
        }
    }

    private func createLiveSyncConfiguration() -> AppleNotesLiveImporter.LiveSyncConfiguration {
        let syncInterval = max(syncFrequency, 1.0) // Minimum 1 second
        let batchSize = performanceMode == "performance" ? 200 : (performanceMode == "battery" ? 50 : 100)

        return AppleNotesLiveImporter.LiveSyncConfiguration(
            isEnabled: liveSyncEnabled,
            syncInterval: syncInterval,
            batchSize: batchSize,
            maxRetryAttempts: 3,
            incrementalSyncThreshold: syncInterval * 2
        )
    }

    private func updatePerformanceConfiguration(_ mode: String) {
        updateSyncConfiguration()
    }
}

// MARK: - Supporting Views

/// Conflict history and resolution interface
struct ConflictHistoryView: View {
    let conflictResolver: AppleNotesConflictResolver
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            Text("Conflict Resolution")
                .navigationTitle("Conflicts")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button("Done") {
                            dismiss()
                        }
                    }
                }
        }
    }
}

/// Permission help and setup instructions
struct PermissionHelpView: View {
    let accessManager: NotesAccessManager
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Notes Access Permission")
                        .font(.title2)
                        .fontWeight(.bold)

                    Text("Isometry needs permission to access your Apple Notes for live synchronization. This allows real-time updates when you make changes in the Notes app.")
                        .font(.body)

                    // Add permission instructions here
                }
                .padding()
            }
            .navigationTitle("Permission Help")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Preview

#Preview {
    NavigationView {
        NotesIntegrationView(database: try! IsometryDatabase(url: URL(fileURLWithPath: ":memory:")))
    }
}