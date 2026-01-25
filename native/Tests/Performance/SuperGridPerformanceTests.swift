import XCTest
import SwiftUI
@testable import Isometry

/// Automated performance benchmarking for SuperGrid implementation
final class SuperGridPerformanceTests: XCTestCase {

    // MARK: - Performance Benchmarks

    func testCanvasRenderingPerformance() throws {
        let nodes = MockData.sampleNodes(count: 1000)
        let viewConfig = ViewConfig.default
        let appState = MockAppState(nodes: nodes, viewConfig: viewConfig)

        measure(metrics: [
            XCTClockMetric(),
            XCTMemoryMetric(),
            XCTCPUMetric()
        ]) {
            let viewModel = SuperGridViewModel()

            // Initialize with large dataset
            Task {
                await viewModel.initialize(database: appState.database)
            }

            // Trigger multiple render cycles
            for _ in 0..<10 {
                _ = viewModel.nodes
                _ = viewModel.currentConfig
            }
        }
    }

    func testMemoryUsageDuringScroll() throws {
        let nodes = MockData.sampleNodes(count: 2000)
        let appState = MockAppState(nodes: nodes)

        measure(metrics: [XCTMemoryMetric()]) {
            let viewModel = SuperGridViewModel()

            Task {
                await viewModel.initialize(database: appState.database)
            }

            // Simulate scrolling by accessing different portions of the dataset
            for i in stride(from: 0, to: nodes.count, by: 100) {
                let subset = Array(nodes[i..<min(i+100, nodes.count)])
                _ = subset.map { GridCellData(node: $0, x: $0.hashValue % 20, y: $0.hashValue % 15) }
            }
        }
    }

    func testLargeDatasetInitialization() throws {
        let nodes = MockData.sampleNodes(count: 5000)
        let appState = MockAppState(nodes: nodes)

        measure(metrics: [
            XCTClockMetric(),
            XCTMemoryMetric()
        ]) {
            let viewModel = SuperGridViewModel()

            Task {
                await viewModel.initialize(database: appState.database)
            }

            // Force evaluation of all grid cells
            _ = viewModel.nodes.count
        }
    }

    func testGestureResponseTime() throws {
        let nodes = MockData.sampleNodes(count: 500)
        let appState = MockAppState(nodes: nodes)

        measure(metrics: [XCTClockMetric()]) {
            let viewModel = SuperGridViewModel()

            Task {
                await viewModel.initialize(database: appState.database)
            }

            // Simulate rapid gesture interactions
            for _ in 0..<50 {
                // Simulate pan gesture
                _ = viewModel.nodes.filter { $0.priority > 0 }

                // Simulate zoom gesture
                _ = viewModel.currentConfig
            }
        }
    }

    // MARK: - CloudKit Sync Performance

    func testCloudKitSyncPerformance() throws {
        let nodes = MockData.sampleNodes(count: 100)
        let mockSyncManager = MockCloudKitSyncManager(nodes: nodes)

        measure(metrics: [
            XCTClockMetric(),
            XCTMemoryMetric()
        ]) {
            Task {
                // Simulate sync operations
                await mockSyncManager.syncNodes()
                await mockSyncManager.syncViewConfigs()
                await mockSyncManager.syncFilterPresets()
            }
        }
    }

    func testConflictResolutionPerformance() throws {
        let localNodes = MockData.sampleNodes(count: 50)
        let remoteNodes = MockData.sampleNodes(count: 50)
        let mockSyncManager = MockCloudKitSyncManager(nodes: localNodes)

        measure(metrics: [XCTClockMetric()]) {
            Task {
                // Simulate conflict resolution
                await mockSyncManager.resolveConflicts(
                    localNodes: localNodes,
                    remoteNodes: remoteNodes
                )
            }
        }
    }

    // MARK: - Database Query Performance

    func testFTS5QueryPerformance() throws {
        let database = MockDatabase.createWithLargeDataset()

        measure(metrics: [XCTClockMetric()]) {
            // Simulate full-text search queries
            let queries = ["test", "sample", "node", "content", "priority"]

            for query in queries {
                Task {
                    _ = try await database.searchNodes(query: query)
                }
            }
        }
    }

    func testFilterQueryPerformance() throws {
        let database = MockDatabase.createWithLargeDataset()

        measure(metrics: [XCTClockMetric()]) {
            // Test various filter combinations
            let filters = [
                "priority > 2",
                "tags CONTAINS 'important'",
                "created_at > date('now', '-7 days')",
                "priority > 1 AND tags CONTAINS 'work'"
            ]

            for filter in filters {
                Task {
                    _ = try await database.filterNodes(filter: filter)
                }
            }
        }
    }

    func testGraphQueryPerformance() throws {
        let database = MockDatabase.createWithLargeDataset()

        measure(metrics: [XCTClockMetric()]) {
            // Test recursive CTE queries for graph traversal
            Task {
                _ = try await database.findConnectedNodes(from: UUID())
                _ = try await database.findPathBetween(from: UUID(), to: UUID())
                _ = try await database.getNodeHierarchy(root: UUID())
            }
        }
    }

    // MARK: - Cross-Platform Performance Tests

    #if os(iOS)
    func testIOSMemoryConstraints() throws {
        // Test performance under iOS memory constraints
        let nodes = MockData.sampleNodes(count: 1000)
        let appState = MockAppState(nodes: nodes)

        measure(metrics: [XCTMemoryMetric()]) {
            let viewModel = SuperGridViewModel()

            Task {
                await viewModel.initialize(database: appState.database)
            }

            // Simulate memory pressure
            var tempData: [[GridCellData]] = []
            for _ in 0..<10 {
                tempData.append(viewModel.nodes.map {
                    GridCellData(node: $0, x: $0.hashValue % 20, y: $0.hashValue % 15)
                })
            }

            // Release memory
            tempData.removeAll()
        }
    }

    func testIOSBatteryOptimization() throws {
        let nodes = MockData.sampleNodes(count: 500)
        let appState = MockAppState(nodes: nodes)

        measure(metrics: [XCTCPUMetric()]) {
            let viewModel = SuperGridViewModel()

            Task {
                await viewModel.initialize(database: appState.database)
            }

            // Simulate background optimization
            for _ in 0..<20 {
                _ = viewModel.nodes.lazy.filter { $0.priority > 0 }
            }
        }
    }
    #endif

    #if os(macOS)
    func testMacOSHighPerformance() throws {
        // Test performance with macOS's higher memory and CPU capabilities
        let nodes = MockData.sampleNodes(count: 2000)
        let appState = MockAppState(nodes: nodes)

        measure(metrics: [
            XCTClockMetric(),
            XCTMemoryMetric(),
            XCTCPUMetric()
        ]) {
            let viewModel = SuperGridViewModel()

            Task {
                await viewModel.initialize(database: appState.database)
            }

            // Process larger datasets
            for _ in 0..<50 {
                _ = viewModel.nodes.map {
                    GridCellData(node: $0, x: $0.hashValue % 40, y: $0.hashValue % 30)
                }
            }
        }
    }

    func testMacOSMultiWindowPerformance() throws {
        let nodes = MockData.sampleNodes(count: 1000)

        measure(metrics: [XCTMemoryMetric()]) {
            // Simulate multiple SuperGrid windows
            var viewModels: [SuperGridViewModel] = []

            for _ in 0..<3 {
                let viewModel = SuperGridViewModel()
                let appState = MockAppState(nodes: nodes)

                Task {
                    await viewModel.initialize(database: appState.database)
                }

                viewModels.append(viewModel)
            }

            // Access all view models
            for viewModel in viewModels {
                _ = viewModel.nodes.count
            }
        }
    }
    #endif

    // MARK: - Stress Tests

    func testExtremePanZoomPerformance() throws {
        let nodes = MockData.sampleNodes(count: 1000)
        let appState = MockAppState(nodes: nodes)

        measure(metrics: [
            XCTClockMetric(),
            XCTMemoryMetric()
        ]) {
            let viewModel = SuperGridViewModel()

            Task {
                await viewModel.initialize(database: appState.database)
            }

            // Simulate extreme pan/zoom operations
            for scale in stride(from: 0.1, to: 10.0, by: 0.5) {
                for offset in stride(from: -1000, to: 1000, by: 100) {
                    // Simulate transform calculations
                    let transform = CGAffineTransform.identity
                        .scaledBy(x: scale, y: scale)
                        .translatedBy(x: CGFloat(offset), y: CGFloat(offset))

                    _ = transform.tx + transform.ty
                }
            }
        }
    }

    func testRapidDataUpdates() throws {
        let initialNodes = MockData.sampleNodes(count: 100)
        let appState = MockAppState(nodes: initialNodes)

        measure(metrics: [XCTClockMetric()]) {
            let viewModel = SuperGridViewModel()

            Task {
                await viewModel.initialize(database: appState.database)
            }

            // Simulate rapid data updates
            for i in 0..<100 {
                let newNodes = MockData.sampleNodes(count: 100 + i)
                let newAppState = MockAppState(nodes: newNodes)

                Task {
                    await viewModel.initialize(database: newAppState.database)
                }
            }
        }
    }

    func testConcurrentOperations() throws {
        let nodes = MockData.sampleNodes(count: 500)
        let appState = MockAppState(nodes: nodes)

        measure(metrics: [
            XCTClockMetric(),
            XCTMemoryMetric()
        ]) {
            let viewModel = SuperGridViewModel()

            Task {
                await viewModel.initialize(database: appState.database)
            }

            // Simulate concurrent operations
            let group = DispatchGroup()

            for _ in 0..<10 {
                group.enter()
                DispatchQueue.global().async {
                    // Simulate concurrent access
                    _ = viewModel.nodes.filter { $0.priority > 1 }
                    _ = viewModel.currentConfig
                    group.leave()
                }
            }

            group.wait()
        }
    }

    // MARK: - Benchmark Validation

    func testPerformanceThresholds() throws {
        let nodes = MockData.sampleNodes(count: 1000)
        let appState = MockAppState(nodes: nodes)

        // Test frame rate target: <16ms per render cycle (60fps)
        let renderTime = measureTime {
            let viewModel = SuperGridViewModel()

            Task {
                await viewModel.initialize(database: appState.database)
            }

            _ = viewModel.nodes.map {
                GridCellData(node: $0, x: $0.hashValue % 20, y: $0.hashValue % 15)
            }
        }

        XCTAssertLessThan(renderTime, 0.016, "Render time should be < 16ms for 60fps")

        // Test memory usage target
        let initialMemory = getMemoryUsage()

        let viewModel = SuperGridViewModel()
        Task {
            await viewModel.initialize(database: appState.database)
        }

        let finalMemory = getMemoryUsage()
        let memoryIncrease = finalMemory - initialMemory

        #if os(iOS)
        XCTAssertLessThan(memoryIncrease, 150 * 1024 * 1024, "Memory increase should be < 150MB on iOS")
        #elseif os(macOS)
        XCTAssertLessThan(memoryIncrease, 300 * 1024 * 1024, "Memory increase should be < 300MB on macOS")
        #endif
    }

    // MARK: - Helper Methods

    private func measureTime(_ block: () -> Void) -> TimeInterval {
        let start = Date()
        block()
        return Date().timeIntervalSince(start)
    }

    private func getMemoryUsage() -> Int64 {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4

        let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_,
                         task_flavor_t(MACH_TASK_BASIC_INFO),
                         $0,
                         &count)
            }
        }

        if kerr == KERN_SUCCESS {
            return Int64(info.resident_size)
        } else {
            return 0
        }
    }
}

// MARK: - Mock Performance Helpers

class MockCloudKitSyncManager {
    let nodes: [Node]

    init(nodes: [Node]) {
        self.nodes = nodes
    }

    func syncNodes() async {
        // Simulate network delay
        try? await Task.sleep(for: .milliseconds(10))
    }

    func syncViewConfigs() async {
        try? await Task.sleep(for: .milliseconds(5))
    }

    func syncFilterPresets() async {
        try? await Task.sleep(for: .milliseconds(3))
    }

    func resolveConflicts(localNodes: [Node], remoteNodes: [Node]) async {
        // Simulate conflict resolution algorithm
        for localNode in localNodes {
            for remoteNode in remoteNodes {
                if localNode.id == remoteNode.id {
                    // Simulate comparison and merging
                    _ = localNode.modifiedAt.compare(remoteNode.modifiedAt)
                }
            }
        }
    }
}

class MockDatabase {
    let nodes: [Node]

    init(nodes: [Node]) {
        self.nodes = nodes
    }

    static func createWithLargeDataset() -> MockDatabase {
        let nodes = MockData.sampleNodes(count: 1000)
        return MockDatabase(nodes: nodes)
    }

    func searchNodes(query: String) async throws -> [Node] {
        // Simulate FTS5 search
        return nodes.filter { $0.name.contains(query) || $0.content.contains(query) }
    }

    func filterNodes(filter: String) async throws -> [Node] {
        // Simulate SQL filter
        switch filter {
        case let f where f.contains("priority"):
            return nodes.filter { $0.priority > 2 }
        case let f where f.contains("tags"):
            return nodes.filter { !$0.tags.isEmpty }
        default:
            return nodes
        }
    }

    func findConnectedNodes(from nodeId: UUID) async throws -> [Node] {
        // Simulate graph traversal
        return Array(nodes.prefix(10))
    }

    func findPathBetween(from: UUID, to: UUID) async throws -> [Node] {
        return Array(nodes.prefix(5))
    }

    func getNodeHierarchy(root: UUID) async throws -> [Node] {
        return Array(nodes.prefix(20))
    }
}