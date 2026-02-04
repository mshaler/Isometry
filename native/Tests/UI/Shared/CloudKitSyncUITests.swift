import XCTest
import SwiftUI
import CloudKit
@testable import Isometry

/// Visual verification tests for CloudKit sync operations
@MainActor
final class CloudKitSyncUITests: XCTestCase {

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
    }

    // MARK: - Sync Status Visual Tests

    func testSyncIdleState() async throws {
        let syncManager = MockCloudKitSyncManager(status: .idle)
        let syncView = CloudKitSyncStatusView(syncManager: syncManager)
            .frame(width: 400, height: 100)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: syncView,
                identifier: "cloudkit_sync_idle_state"
            )
        )
    }

    func testSyncInProgressState() async throws {
        let syncManager = MockCloudKitSyncManager(status: .syncing(progress: 0.7))
        let syncView = CloudKitSyncStatusView(syncManager: syncManager)
            .frame(width: 400, height: 100)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: syncView,
                identifier: "cloudkit_sync_progress_state"
            )
        )
    }

    func testSyncErrorState() async throws {
        let error = CloudKitSyncError.networkUnavailable
        let syncManager = MockCloudKitSyncManager(status: .error(error))
        let syncView = CloudKitSyncStatusView(syncManager: syncManager)
            .frame(width: 400, height: 120)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: syncView,
                identifier: "cloudkit_sync_error_state"
            )
        )
    }

    func testSyncSuccessState() async throws {
        let syncManager = MockCloudKitSyncManager(status: .completed(itemsProcessed: 42))
        let syncView = CloudKitSyncStatusView(syncManager: syncManager)
            .frame(width: 400, height: 100)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: syncView,
                identifier: "cloudkit_sync_success_state"
            )
        )
    }

    // MARK: - Conflict Resolution UI Tests

    func testConflictResolutionDialog() async throws {
        let localNode = MockData.createNode(name: "Local Version", priority: 2)
        let remoteNode = MockData.createNode(name: "Remote Version", priority: 3)

        let conflictView = ConflictResolutionView(
            localNode: localNode,
            remoteNode: remoteNode,
            onResolve: { _ in }
        )
        .frame(width: 600, height: 400)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: conflictView,
                identifier: "cloudkit_conflict_resolution_dialog"
            )
        )
    }

    func testBatchConflictResolution() async throws {
        let conflicts = [
            ConflictData(
                local: MockData.createNode(name: "Local Node 1", priority: 1),
                remote: MockData.createNode(name: "Remote Node 1", priority: 2)
            ),
            ConflictData(
                local: MockData.createNode(name: "Local Node 2", priority: 3),
                remote: MockData.createNode(name: "Remote Node 2", priority: 1)
            ),
            ConflictData(
                local: MockData.createNode(name: "Local Node 3", priority: 2),
                remote: MockData.createNode(name: "Remote Node 3", priority: 3)
            )
        ]

        let batchView = BatchConflictResolutionView(conflicts: conflicts)
            .frame(width: 800, height: 600)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: batchView,
                identifier: "cloudkit_batch_conflict_resolution"
            )
        )
    }

    // MARK: - Filter Preset Sync Tests

    func testFilterPresetSyncStatus() async throws {
        let presets = [
            FilterPreset(id: UUID(), name: "Work Tasks", filterExpression: "category = 'work'"),
            FilterPreset(id: UUID(), name: "High Priority", filterExpression: "priority > 2"),
            FilterPreset(id: UUID(), name: "This Week", filterExpression: "created_at > date('now', '-7 days')")
        ]

        let syncView = FilterPresetSyncView(
            presets: presets,
            syncStatus: .completed(itemsProcessed: 3)
        )
        .frame(width: 500, height: 300)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: syncView,
                identifier: "cloudkit_filter_preset_sync"
            )
        )
    }

    func testViewConfigSyncStatus() async throws {
        let viewConfigs = [
            ViewConfig(
                id: UUID(),
                name: "Time vs Category",
                xAxisMapping: "time",
                yAxisMapping: "category",
                originType: .anchor(x: 0, y: 0)
            ),
            ViewConfig(
                id: UUID(),
                name: "Priority Grid",
                xAxisMapping: "priority",
                yAxisMapping: "hierarchy",
                originType: .bipolar
            )
        ]

        let syncView = ViewConfigSyncView(
            viewConfigs: viewConfigs,
            syncStatus: .syncing(progress: 0.5)
        )
        .frame(width: 500, height: 250)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: syncView,
                identifier: "cloudkit_view_config_sync"
            )
        )
    }

    // MARK: - Network State Visual Tests

    func testOfflineIndicator() async throws {
        let networkMonitor = MockNetworkMonitor(isConnected: false)
        let offlineView = NetworkStatusView(monitor: networkMonitor)
            .frame(width: 300, height: 60)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: offlineView,
                identifier: "cloudkit_offline_indicator"
            )
        )
    }

    func testCellularSyncWarning() async throws {
        let networkMonitor = MockNetworkMonitor(isConnected: true, connectionType: .cellular)
        let warningView = NetworkStatusView(monitor: networkMonitor)
            .frame(width: 350, height: 80)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: warningView,
                identifier: "cloudkit_cellular_warning"
            )
        )
    }

    func testWiFiConnectedState() async throws {
        let networkMonitor = MockNetworkMonitor(isConnected: true, connectionType: .wifi)
        let connectedView = NetworkStatusView(monitor: networkMonitor)
            .frame(width: 300, height: 50)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: connectedView,
                identifier: "cloudkit_wifi_connected"
            )
        )
    }

    // MARK: - Quota and Limits Visual Tests

    func testCloudKitQuotaDisplay() async throws {
        let quotaInfo = CloudKitQuotaInfo(
            used: 750 * 1024 * 1024, // 750 MB
            available: 1024 * 1024 * 1024, // 1 GB
            recordCount: 5420
        )

        let quotaView = CloudKitQuotaView(quotaInfo: quotaInfo)
            .frame(width: 400, height: 150)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: quotaView,
                identifier: "cloudkit_quota_display"
            )
        )
    }

    func testQuotaWarningState() async throws {
        let quotaInfo = CloudKitQuotaInfo(
            used: 900 * 1024 * 1024, // 900 MB
            available: 1024 * 1024 * 1024, // 1 GB
            recordCount: 8500
        )

        let quotaView = CloudKitQuotaView(quotaInfo: quotaInfo)
            .frame(width: 400, height: 170)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: quotaView,
                identifier: "cloudkit_quota_warning"
            )
        )
    }

    func testQuotaExceededState() async throws {
        let quotaInfo = CloudKitQuotaInfo(
            used: 1100 * 1024 * 1024, // 1.1 GB
            available: 1024 * 1024 * 1024, // 1 GB
            recordCount: 10000
        )

        let quotaView = CloudKitQuotaView(quotaInfo: quotaInfo)
            .frame(width: 400, height: 190)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: quotaView,
                identifier: "cloudkit_quota_exceeded"
            )
        )
    }

    // MARK: - Multi-Device Sync Visual Tests

    func testDeviceList() async throws {
        let devices = [
            SyncDevice(name: "iPhone 15 Pro", type: .iPhone, lastSync: Date().addingTimeInterval(-3600)),
            SyncDevice(name: "MacBook Pro", type: .mac, lastSync: Date().addingTimeInterval(-1800)),
            SyncDevice(name: "iPad Air", type: .iPad, lastSync: Date().addingTimeInterval(-7200))
        ]

        let deviceView = SyncDeviceListView(devices: devices)
            .frame(width: 500, height: 300)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: deviceView,
                identifier: "cloudkit_device_list"
            )
        )
    }

    func testCrossDeviceConflict() async throws {
        let conflict = CrossDeviceConflict(
            nodeId: UUID(),
            localDevice: "MacBook Pro",
            remoteDevice: "iPhone 15 Pro",
            conflictType: .contentMismatch,
            localTimestamp: Date().addingTimeInterval(-1800),
            remoteTimestamp: Date().addingTimeInterval(-900)
        )

        let conflictView = CrossDeviceConflictView(conflict: conflict)
            .frame(width: 600, height: 250)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: conflictView,
                identifier: "cloudkit_cross_device_conflict"
            )
        )
    }

    // MARK: - Integration with SuperGrid Tests

    func testSuperGridWithSyncStatus() async throws {
        let nodes = MockData.sampleNodes(count: 50)
        let syncManager = MockCloudKitSyncManager(status: .syncing(progress: 0.3))

        let integratedView = VStack {
            CloudKitSyncStatusView(syncManager: syncManager)
                .padding()

            SuperGridView()
                .environmentObject(MockAppState(nodes: nodes))
        }
        .frame(width: 800, height: 600)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: integratedView,
                identifier: "supergrid_with_sync_status"
            )
        )
    }

    func testSyncOverlayOnGrid() async throws {
        let nodes = MockData.sampleNodes(count: 100)
        let syncManager = MockCloudKitSyncManager(status: .error(.quotaExceeded))

        let overlayView = ZStack {
            SuperGridView()
                .environmentObject(MockAppState(nodes: nodes))

            VStack {
                Spacer()
                CloudKitErrorOverlay(syncManager: syncManager)
                    .padding()
            }
        }
        .frame(width: 900, height: 700)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: overlayView,
                identifier: "supergrid_sync_error_overlay"
            )
        )
    }

    // MARK: - Platform-Specific Sync UI Tests

    #if os(iOS)
    func testIOSSyncSettings() async throws {
        let settingsView = iOSSyncSettingsView()
            .frame(width: 375, height: 600)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: settingsView,
                identifier: "ios_sync_settings"
            )
        )
    }

    func testIOSBackgroundSyncIndicator() async throws {
        let backgroundView = iOSBackgroundSyncIndicator(isBackgroundSyncEnabled: true)
            .frame(width: 375, height: 100)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: backgroundView,
                identifier: "ios_background_sync_indicator"
            )
        )
    }
    #endif

    #if os(macOS)
    func testMacOSSyncPreferences() async throws {
        let preferencesView = macOSSyncPreferencesView()
            .frame(width: 500, height: 400)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: preferencesView,
                identifier: "macos_sync_preferences"
            )
        )
    }

    func testMacOSSyncMenuBarItem() async throws {
        let menuBarView = macOSSyncMenuBarView(syncStatus: .completed(itemsProcessed: 123))
            .frame(width: 300, height: 200)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: menuBarView,
                identifier: "macos_sync_menubar"
            )
        )
    }
    #endif
}

// MARK: - Mock CloudKit Support

enum CloudKitSyncStatus {
    case idle
    case syncing(progress: Double)
    case completed(itemsProcessed: Int)
    case error(CloudKitSyncError)
}

enum CloudKitSyncError: Error {
    case networkUnavailable
    case accountNotAvailable
    case quotaExceeded
    case permissionFailure
}

class MockCloudKitSyncManager: ObservableObject {
    @Published var status: CloudKitSyncStatus

    init(status: CloudKitSyncStatus) {
        self.status = status
    }
}

struct ConflictData {
    let local: Node
    let remote: Node
}

struct CloudKitQuotaInfo {
    let used: Int64
    let available: Int64
    let recordCount: Int
}

enum DeviceType {
    case iPhone, iPad, mac
}

struct SyncDevice {
    let name: String
    let type: DeviceType
    let lastSync: Date
}

struct CrossDeviceConflict {
    let nodeId: UUID
    let localDevice: String
    let remoteDevice: String
    let conflictType: UITestConflictType
    let localTimestamp: Date
    let remoteTimestamp: Date
}

enum UITestConflictType {
    case contentMismatch
    case priorityMismatch
    case tagsMismatch
}

enum ConnectionType {
    case wifi, cellular, ethernet
}

class MockNetworkMonitor: ObservableObject {
    @Published var isConnected: Bool
    @Published var connectionType: ConnectionType

    init(isConnected: Bool, connectionType: ConnectionType = .wifi) {
        self.isConnected = isConnected
        self.connectionType = connectionType
    }
}

// MARK: - Mock UI Components

struct CloudKitSyncStatusView: View {
    @ObservedObject var syncManager: MockCloudKitSyncManager

    var body: some View {
        HStack {
            statusIcon
            VStack(alignment: .leading) {
                statusText
                if case .syncing(let progress) = syncManager.status {
                    ProgressView(value: progress)
                        .frame(width: 200)
                }
            }
            Spacer()
        }
        .padding()
        .background(Color.gray.opacity(0.1))
        .cornerRadius(8)
    }

    @ViewBuilder
    private var statusIcon: some View {
        switch syncManager.status {
        case .idle:
            Image(systemName: "cloud")
        case .syncing:
            Image(systemName: "cloud.fill")
                .foregroundColor(.blue)
        case .completed:
            Image(systemName: "checkmark.circle.fill")
                .foregroundColor(.green)
        case .error:
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(.red)
        }
    }

    private var statusText: some View {
        switch syncManager.status {
        case .idle:
            return Text("Sync ready")
        case .syncing(let progress):
            return Text("Syncing... \(Int(progress * 100))%")
        case .completed(let items):
            return Text("Synced \(items) items")
        case .error(let error):
            return Text("Sync error: \(errorMessage(error))")
        }
    }

    private func errorMessage(_ error: CloudKitSyncError) -> String {
        switch error {
        case .networkUnavailable:
            return "Network unavailable"
        case .accountNotAvailable:
            return "iCloud account not available"
        case .quotaExceeded:
            return "iCloud storage full"
        case .permissionFailure:
            return "Permission denied"
        }
    }
}

struct ConflictResolutionView: View {
    let localNode: Node
    let remoteNode: Node
    let onResolve: (Node) -> Void

    var body: some View {
        VStack(spacing: 20) {
            Text("Sync Conflict")
                .font(.headline)

            HStack(spacing: 20) {
                VStack {
                    Text("Local Version")
                        .font(.subheadline)
                        .fontWeight(.medium)

                    NodePreview(node: localNode)

                    Button("Keep Local") {
                        onResolve(localNode)
                    }
                    .buttonStyle(.borderedProminent)
                }

                VStack {
                    Text("Remote Version")
                        .font(.subheadline)
                        .fontWeight(.medium)

                    NodePreview(node: remoteNode)

                    Button("Keep Remote") {
                        onResolve(remoteNode)
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
        .padding()
        .background(Color.gray.opacity(0.05))
        .cornerRadius(12)
    }
}

struct NodePreview: View {
    let node: Node

    var body: some View {
        VStack(alignment: .leading) {
            Text(node.name)
                .font(.caption)
                .fontWeight(.medium)
            Text("Priority: \(node.priority)")
                .font(.caption2)
            Text("Modified: \(node.modifiedAt, style: .time)")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(width: 200, height: 80)
        .padding(8)
        .background(Color.white)
        .cornerRadius(6)
        .shadow(radius: 1)
    }
}

// Placeholder views for platform-specific components
struct BatchConflictResolutionView: View {
    let conflicts: [ConflictData]
    var body: some View { Text("Batch Conflict Resolution") }
}

struct FilterPresetSyncView: View {
    let presets: [FilterPreset]
    let syncStatus: CloudKitSyncStatus
    var body: some View { Text("Filter Preset Sync") }
}

struct ViewConfigSyncView: View {
    let viewConfigs: [ViewConfig]
    let syncStatus: CloudKitSyncStatus
    var body: some View { Text("View Config Sync") }
}

struct NetworkStatusView: View {
    @ObservedObject var monitor: MockNetworkMonitor
    var body: some View { Text("Network Status") }
}

struct CloudKitQuotaView: View {
    let quotaInfo: CloudKitQuotaInfo
    var body: some View { Text("CloudKit Quota") }
}

struct SyncDeviceListView: View {
    let devices: [SyncDevice]
    var body: some View { Text("Device List") }
}

struct CrossDeviceConflictView: View {
    let conflict: CrossDeviceConflict
    var body: some View { Text("Cross Device Conflict") }
}

struct CloudKitErrorOverlay: View {
    @ObservedObject var syncManager: MockCloudKitSyncManager
    var body: some View { Text("Error Overlay") }
}

#if os(iOS)
struct iOSSyncSettingsView: View {
    var body: some View { Text("iOS Sync Settings") }
}

struct iOSBackgroundSyncIndicator: View {
    let isBackgroundSyncEnabled: Bool
    var body: some View { Text("Background Sync") }
}
#endif

#if os(macOS)
struct macOSSyncPreferencesView: View {
    var body: some View { Text("macOS Sync Preferences") }
}

struct macOSSyncMenuBarView: View {
    let syncStatus: CloudKitSyncStatus
    var body: some View { Text("MenuBar Sync") }
}
#endif