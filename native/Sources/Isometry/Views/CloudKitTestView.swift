import SwiftUI

/// Test view for CloudKit sync functionality
/// Use this to verify SuperGrid data syncs properly
struct CloudKitTestView: View {
    @EnvironmentObject private var appState: AppState
    @State private var testStatus = "Ready to test"
    @State private var isTesting = false
    @State private var testResults: [String] = []

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("CloudKit Sync Test")
                .font(.title)
                .fontWeight(.bold)

            Text("Test SuperGrid data synchronization with CloudKit")
                .foregroundStyle(.secondary)

            Divider()

            // Current Status
            VStack(alignment: .leading, spacing: 8) {
                Text("Status")
                    .font(.headline)

                HStack {
                    Circle()
                        .fill(statusColor)
                        .frame(width: 8, height: 8)

                    Text(testStatus)
                        .font(.subheadline)

                    if isTesting {
                        ProgressView()
                            .scaleEffect(0.7)
                    }
                }
            }

            // Test Results
            if !testResults.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Test Results")
                        .font(.headline)

                    ScrollView {
                        VStack(alignment: .leading, spacing: 4) {
                            ForEach(Array(testResults.enumerated()), id: \.offset) { index, result in
                                Text("\(index + 1). \(result)")
                                    .font(.caption)
                                    .padding(.vertical, 2)
                            }
                        }
                    }
                    .frame(maxHeight: 200)
                    .padding(8)
                    .background(Color.gray.opacity(0.1))
                    .cornerRadius(8)
                }
            }

            // Test Buttons
            VStack(spacing: 12) {
                Button("Test ViewConfig Sync") {
                    Task {
                        await testViewConfigSync()
                    }
                }
                .disabled(isTesting)
                .buttonStyle(.borderedProminent)

                Button("Test FilterPreset Sync") {
                    Task {
                        await testFilterPresetSync()
                    }
                }
                .disabled(isTesting)
                .buttonStyle(.borderedProminent)

                Button("Test Full Sync Cycle") {
                    Task {
                        await testFullSyncCycle()
                    }
                }
                .disabled(isTesting)
                .buttonStyle(.borderedProminent)

                Button("Clear Results") {
                    testResults.removeAll()
                    testStatus = "Results cleared"
                }
                .disabled(testResults.isEmpty)
            }

            Spacer()

            // CloudKit Status
            VStack(alignment: .leading, spacing: 4) {
                Text("CloudKit Status")
                    .font(.headline)

                Text("Sync Manager: \(appState.syncManager != nil ? "Available" : "Not Available")")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Text("Account Status: \(appState.syncStatus.description)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .navigationTitle("CloudKit Test")
    }

    private var statusColor: Color {
        if isTesting {
            return .yellow
        } else if testStatus.contains("✅") {
            return .green
        } else if testStatus.contains("❌") {
            return .red
        } else {
            return .blue
        }
    }

    // MARK: - Test Methods

    private func testViewConfigSync() async {
        guard let syncManager = appState.syncManager else {
            addResult("❌ CloudKit sync manager not available")
            testStatus = "CloudKit not available"
            return
        }

        isTesting = true
        testStatus = "Testing ViewConfig sync..."
        addResult("🧪 Starting ViewConfig sync test")

        do {
            // Create test view config
            let testConfig = ViewConfig(
                name: "Test Grid Config",
                originPattern: "bipolar",
                xAxisMapping: "hierarchy",
                yAxisMapping: "time",
                zoomLevel: 1.5,
                filterConfig: """
                {
                  "priority": [1, 2],
                  "category": ["Test"]
                }
                """
            )

            addResult("📤 Pushing test ViewConfig to CloudKit...")

            // Push to CloudKit
            try await syncManager.syncViewConfigs([testConfig])
            addResult("✅ ViewConfig successfully pushed to CloudKit")

            // Pull from CloudKit
            addResult("📥 Pulling ViewConfigs from CloudKit...")
            let pulledConfigs = try await syncManager.pullViewConfigs()
            addResult("✅ Found \(pulledConfigs.count) ViewConfigs in CloudKit")

            // Verify our test config was synced
            if let syncedConfig = pulledConfigs.first(where: { $0.id == testConfig.id }) {
                addResult("✅ Test ViewConfig found in CloudKit")
                addResult("   - Name: \(syncedConfig.name)")
                addResult("   - Origin: \(syncedConfig.originPattern)")
                addResult("   - X-Axis: \(syncedConfig.xAxisMapping)")
                addResult("   - Y-Axis: \(syncedConfig.yAxisMapping)")
                addResult("   - Zoom: \(syncedConfig.zoomLevel)x")

                if syncedConfig.filterConfig == testConfig.filterConfig {
                    addResult("✅ Filter configuration preserved correctly")
                } else {
                    addResult("❌ Filter configuration mismatch")
                }
            } else {
                addResult("❌ Test ViewConfig not found in synced data")
            }

            testStatus = "✅ ViewConfig sync test completed"

        } catch {
            addResult("❌ ViewConfig sync failed: \(error.localizedDescription)")
            testStatus = "❌ ViewConfig sync failed"
        }

        isTesting = false
    }

    private func testFilterPresetSync() async {
        guard let syncManager = appState.syncManager else {
            addResult("❌ CloudKit sync manager not available")
            testStatus = "CloudKit not available"
            return
        }

        isTesting = true
        testStatus = "Testing FilterPreset sync..."
        addResult("🧪 Starting FilterPreset sync test")

        do {
            // Create test filter presets
            let testPresets = [
                FilterPreset(
                    name: "Test High Priority",
                    filterConfig: """
                    {
                      "priority": [1],
                      "search": "important"
                    }
                    """,
                    description: "Test preset for high priority items",
                    iconName: "exclamationmark.triangle.fill",
                    usageCount: 5
                ),
                FilterPreset(
                    name: "Test This Month",
                    filterConfig: """
                    {
                      "timeRange": {
                        "start": "2026-01-01T00:00:00Z",
                        "end": "2026-01-31T23:59:59Z"
                      }
                    }
                    """,
                    description: "Test preset for current month",
                    iconName: "calendar.badge.clock",
                    usageCount: 12
                )
            ]

            addResult("📤 Pushing \(testPresets.count) test FilterPresets to CloudKit...")

            // Push to CloudKit
            try await syncManager.syncFilterPresets(testPresets)
            addResult("✅ FilterPresets successfully pushed to CloudKit")

            // Pull from CloudKit
            addResult("📥 Pulling FilterPresets from CloudKit...")
            let pulledPresets = try await syncManager.pullFilterPresets()
            addResult("✅ Found \(pulledPresets.count) FilterPresets in CloudKit")

            // Verify our test presets were synced
            for testPreset in testPresets {
                if let syncedPreset = pulledPresets.first(where: { $0.id == testPreset.id }) {
                    addResult("✅ Test preset '\(syncedPreset.name)' found")
                    addResult("   - Usage count: \(syncedPreset.usageCount)")
                    addResult("   - Icon: \(syncedPreset.iconName ?? "none")")

                    if syncedPreset.filterConfig == testPreset.filterConfig {
                        addResult("   ✅ Filter configuration preserved")
                    } else {
                        addResult("   ❌ Filter configuration mismatch")
                    }
                } else {
                    addResult("❌ Test preset '\(testPreset.name)' not found in synced data")
                }
            }

            testStatus = "✅ FilterPreset sync test completed"

        } catch {
            addResult("❌ FilterPreset sync failed: \(error.localizedDescription)")
            testStatus = "❌ FilterPreset sync failed"
        }

        isTesting = false
    }

    private func testFullSyncCycle() async {
        guard let syncManager = appState.syncManager else {
            addResult("❌ CloudKit sync manager not available")
            testStatus = "CloudKit not available"
            return
        }

        isTesting = true
        testStatus = "Testing full sync cycle..."
        addResult("🧪 Starting full sync cycle test")

        do {
            // Test 1: Sync existing nodes
            addResult("📤 Testing Node sync...")
            try await syncManager.sync()
            addResult("✅ Node sync completed")

            // Test 2: Sync ViewConfigs
            let testConfig = ViewConfig(
                name: "Full Sync Test Config",
                originPattern: "anchor",
                xAxisMapping: "category",
                yAxisMapping: "hierarchy"
            )

            try await syncManager.syncViewConfigs([testConfig])
            addResult("✅ ViewConfig sync in full cycle")

            // Test 3: Sync FilterPresets
            let testPreset = FilterPreset(
                name: "Full Sync Test Preset",
                filterConfig: """
                {
                  "category": ["Work", "Personal"],
                  "priority": [1, 2, 3]
                }
                """,
                description: "Test preset for full sync cycle"
            )

            try await syncManager.syncFilterPresets([testPreset])
            addResult("✅ FilterPreset sync in full cycle")

            // Test 4: Verify data integrity
            let configs = try await syncManager.pullViewConfigs()
            let presets = try await syncManager.pullFilterPresets()

            addResult("📊 Data integrity check:")
            addResult("   - ViewConfigs: \(configs.count)")
            addResult("   - FilterPresets: \(presets.count)")

            // Check for our test data
            if configs.contains(where: { $0.id == testConfig.id }) {
                addResult("   ✅ Test ViewConfig preserved")
            } else {
                addResult("   ❌ Test ViewConfig missing")
            }

            if presets.contains(where: { $0.id == testPreset.id }) {
                addResult("   ✅ Test FilterPreset preserved")
            } else {
                addResult("   ❌ Test FilterPreset missing")
            }

            testStatus = "✅ Full sync cycle completed successfully"

        } catch {
            addResult("❌ Full sync cycle failed: \(error.localizedDescription)")
            testStatus = "❌ Full sync cycle failed"
        }

        isTesting = false
    }

    private func addResult(_ message: String) {
        testResults.append(message)
        print("[CloudKit Test] \(message)")
    }
}

// MARK: - SyncStatus Extension
extension SyncStatus {
    var description: String {
        switch self {
        case .idle:
            return "Idle"
        case .syncing:
            return "Syncing..."
        case .synced:
            return "Synced"
        case .error(let error):
            return "Error: \(error.localizedDescription)"
        }
    }
}

// MARK: - Preview
#Preview {
    NavigationStack {
        CloudKitTestView()
            .environmentObject(AppState())
    }
}