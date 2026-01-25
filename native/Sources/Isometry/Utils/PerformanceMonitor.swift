import Foundation
import os.signpost

/// Performance monitoring for SuperGrid rendering and database queries
/// Uses os_signpost for integration with Instruments profiling
public final class PerformanceMonitor: @unchecked Sendable {
    public static let shared = PerformanceMonitor()

    private let log: OSLog
    private let metricsLog: OSLog
    private let lock = NSLock()

    // MARK: - Metrics Storage

    private var gridRenderTimes: [TimeInterval] = []
    private var queryTimes: [String: [TimeInterval]] = [:]
    private var notebookRenderTimes: [TimeInterval] = []
    private var notebookCardQueryTimes: [TimeInterval] = []
    private var componentResizeTimes: [TimeInterval] = []
    private var signpostTimes: [OSSignpostID: TimeInterval] = [:]
    private let maxSamples = 100

    // MARK: - Performance Thresholds

    /// Target frame time for 60fps (16.67ms)
    public static let targetFrameTime: TimeInterval = 1.0 / 60.0

    /// Maximum acceptable query time (100ms)
    public static let maxQueryTime: TimeInterval = 0.100

    private init() {
        log = OSLog(subsystem: "com.isometry.app", category: "Performance")
        metricsLog = OSLog(subsystem: "com.isometry.app", category: .pointsOfInterest)
    }

    // MARK: - Grid Rendering

    /// Start measuring grid render time
    /// - Returns: Signpost ID for ending the measurement
    public func startGridRender() -> OSSignpostID {
        let id = OSSignpostID(log: log)
        os_signpost(.begin, log: log, name: "Grid Render", signpostID: id)
        return id
    }

    /// End grid render measurement
    /// - Parameter id: Signpost ID from startGridRender
    public func endGridRender(_ id: OSSignpostID) {
        os_signpost(.end, log: log, name: "Grid Render", signpostID: id)
    }

    /// Measure grid render time with a closure
    /// - Parameter block: Rendering code to measure
    /// - Returns: Result of the block
    @discardableResult
    public func measureGridRender<T>(_ block: () -> T) -> T {
        let start = CFAbsoluteTimeGetCurrent()
        let id = startGridRender()

        let result = block()

        endGridRender(id)
        let elapsed = CFAbsoluteTimeGetCurrent() - start

        recordGridRenderTime(elapsed)

        // Log warning if frame time exceeded
        if elapsed > Self.targetFrameTime {
            os_signpost(.event, log: metricsLog, name: "Slow Render",
                       "Grid render took %.2fms (target: %.2fms)",
                       elapsed * 1000, Self.targetFrameTime * 1000)
        }

        return result
    }

    // MARK: - Notebook Performance Tracking

    /// Start measuring notebook layout render time
    public func startNotebookRender() -> OSSignpostID {
        let id = OSSignpostID(log: log)
        let startTime = CACurrentMediaTime()

        lock.lock()
        signpostTimes[id] = startTime
        lock.unlock()

        os_signpost(.begin, log: log, name: "Notebook Render", signpostID: id)
        return id
    }

    /// End measuring notebook layout render time
    public func endNotebookRender(_ id: OSSignpostID, layoutType: String = "") {
        os_signpost(.end, log: log, name: "Notebook Render", signpostID: id,
                   "Layout: %{public}@", layoutType)

        lock.lock()
        defer { lock.unlock() }

        let endTime = CACurrentMediaTime()
        if let startTime = signpostTimes.removeValue(forKey: id) {
            let renderTime = endTime - startTime
            notebookRenderTimes.append(renderTime)
            limitArray(&notebookRenderTimes, to: maxSamples)

            if renderTime > Self.targetFrameTime {
                os_log(.error, log: metricsLog,
                       "Notebook render exceeded target: %.2fms (target: %.2fms)",
                       renderTime * 1000, Self.targetFrameTime * 1000)
            }
        }
    }

    /// Track notebook card database queries
    public func recordNotebookCardQuery(_ duration: TimeInterval, operation: String) {
        lock.lock()
        defer { lock.unlock() }

        notebookCardQueryTimes.append(duration)
        limitArray(&notebookCardQueryTimes, to: maxSamples)

        if duration > Self.maxQueryTime {
            os_log(.error, log: metricsLog,
                   "Notebook card query exceeded limit: %{public}@ took %.2fms",
                   operation, duration * 1000)
        }
    }

    /// Track component resize performance
    public func recordComponentResize(_ duration: TimeInterval) {
        lock.lock()
        defer { lock.unlock() }

        componentResizeTimes.append(duration)
        limitArray(&componentResizeTimes, to: maxSamples)
    }

    /// Measure notebook render time with a closure
    @discardableResult
    public func measureNotebookRender<T>(layoutType: String = "", _ block: () -> T) -> T {
        let id = startNotebookRender()
        let result = block()
        endNotebookRender(id, layoutType: layoutType)
        return result
    }

    // MARK: - Notebook Metrics

    public var notebookMetrics: NotebookPerformanceMetrics {
        lock.lock()
        defer { lock.unlock() }

        return NotebookPerformanceMetrics(
            averageRenderTime: notebookRenderTimes.isEmpty ? 0 : notebookRenderTimes.reduce(0, +) / Double(notebookRenderTimes.count),
            maxRenderTime: notebookRenderTimes.max() ?? 0,
            averageQueryTime: notebookCardQueryTimes.isEmpty ? 0 : notebookCardQueryTimes.reduce(0, +) / Double(notebookCardQueryTimes.count),
            maxQueryTime: notebookCardQueryTimes.max() ?? 0,
            averageResizeTime: componentResizeTimes.isEmpty ? 0 : componentResizeTimes.reduce(0, +) / Double(componentResizeTimes.count),
            renderSampleCount: notebookRenderTimes.count,
            querySampleCount: notebookCardQueryTimes.count
        )
    }

    // MARK: - Query Measurement

    /// Measure database query execution time
    /// - Parameters:
    ///   - name: Query identifier for grouping metrics
    ///   - block: Query code to measure
    /// - Returns: Result of the query
    @discardableResult
    public func measureQuery<T>(_ name: String, _ block: () throws -> T) rethrows -> T {
        let id = OSSignpostID(log: log)
        os_signpost(.begin, log: log, name: "Query", signpostID: id, "%{public}s", name)

        let start = CFAbsoluteTimeGetCurrent()
        let result = try block()
        let elapsed = CFAbsoluteTimeGetCurrent() - start

        os_signpost(.end, log: log, name: "Query", signpostID: id,
                   "%{public}s completed in %.2fms", name, elapsed * 1000)

        recordQueryTime(name: name, elapsed: elapsed)

        // Log warning if query time exceeded
        if elapsed > Self.maxQueryTime {
            os_signpost(.event, log: metricsLog, name: "Slow Query",
                       "%{public}s took %.2fms (max: %.2fms)",
                       name, elapsed * 1000, Self.maxQueryTime * 1000)
        }

        return result
    }

    /// Async version of query measurement
    @discardableResult
    public func measureQueryAsync<T>(_ name: String, _ block: () async throws -> T) async rethrows -> T {
        let id = OSSignpostID(log: log)
        os_signpost(.begin, log: log, name: "Query", signpostID: id, "%{public}s", name)

        let start = CFAbsoluteTimeGetCurrent()
        let result = try await block()
        let elapsed = CFAbsoluteTimeGetCurrent() - start

        os_signpost(.end, log: log, name: "Query", signpostID: id,
                   "%{public}s completed in %.2fms", name, elapsed * 1000)

        recordQueryTime(name: name, elapsed: elapsed)

        if elapsed > Self.maxQueryTime {
            os_signpost(.event, log: metricsLog, name: "Slow Query",
                       "%{public}s took %.2fms (max: %.2fms)",
                       name, elapsed * 1000, Self.maxQueryTime * 1000)
        }

        return result
    }

    // MARK: - Custom Events

    /// Log a performance event
    public func logEvent(_ name: StaticString, _ message: String) {
        os_signpost(.event, log: log, name: name, "%{public}s", message)
    }

    /// Log a memory usage event
    public func logMemoryUsage() {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4

        let result = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }

        if result == KERN_SUCCESS {
            let memoryMB = Double(info.resident_size) / 1024 / 1024
            os_signpost(.event, log: metricsLog, name: "Memory",
                       "Resident memory: %.2f MB", memoryMB)
        }
    }

    // MARK: - Metrics Recording

    private func recordGridRenderTime(_ elapsed: TimeInterval) {
        lock.lock()
        defer { lock.unlock() }

        gridRenderTimes.append(elapsed)
        if gridRenderTimes.count > maxSamples {
            gridRenderTimes.removeFirst()
        }
    }

    /// Helper method to limit array size while maintaining chronological order
    private func limitArray<T>(_ array: inout [T], to maxCount: Int) {
        while array.count > maxCount {
            array.removeFirst()
        }
    }

    private func recordQueryTime(name: String, elapsed: TimeInterval) {
        lock.lock()
        defer { lock.unlock() }

        var times = queryTimes[name] ?? []
        times.append(elapsed)
        if times.count > maxSamples {
            times.removeFirst()
        }
        queryTimes[name] = times
    }

    // MARK: - Statistics

    /// Get grid render statistics
    public var gridRenderStats: RenderStats {
        lock.lock()
        defer { lock.unlock() }

        guard !gridRenderTimes.isEmpty else {
            return RenderStats(average: 0, min: 0, max: 0, p95: 0, fps: 0)
        }

        let sorted = gridRenderTimes.sorted()
        let average = sorted.reduce(0, +) / Double(sorted.count)
        let p95Index = min(Int(Double(sorted.count) * 0.95), sorted.count - 1)

        return RenderStats(
            average: average,
            min: sorted.first ?? 0,
            max: sorted.last ?? 0,
            p95: sorted[p95Index],
            fps: average > 0 ? 1.0 / average : 0
        )
    }

    /// Get query statistics for a specific query
    public func queryStats(for name: String) -> QueryStats? {
        lock.lock()
        defer { lock.unlock() }

        guard let times = queryTimes[name], !times.isEmpty else {
            return nil
        }

        let sorted = times.sorted()
        let average = sorted.reduce(0, +) / Double(sorted.count)
        let p95Index = min(Int(Double(sorted.count) * 0.95), sorted.count - 1)

        return QueryStats(
            name: name,
            average: average,
            min: sorted.first ?? 0,
            max: sorted.last ?? 0,
            p95: sorted[p95Index],
            sampleCount: sorted.count
        )
    }

    /// Get all query statistics
    public var allQueryStats: [QueryStats] {
        lock.lock()
        defer { lock.unlock() }

        return queryTimes.keys.compactMap { name in
            guard let times = queryTimes[name], !times.isEmpty else { return nil }

            let sorted = times.sorted()
            let average = sorted.reduce(0, +) / Double(sorted.count)
            let p95Index = min(Int(Double(sorted.count) * 0.95), sorted.count - 1)

            return QueryStats(
                name: name,
                average: average,
                min: sorted.first ?? 0,
                max: sorted.last ?? 0,
                p95: sorted[p95Index],
                sampleCount: sorted.count
            )
        }.sorted { $0.average > $1.average }
    }

    /// Reset all collected metrics
    public func resetMetrics() {
        lock.lock()
        defer { lock.unlock() }

        gridRenderTimes.removeAll()
        queryTimes.removeAll()
        notebookRenderTimes.removeAll()
        notebookCardQueryTimes.removeAll()
        componentResizeTimes.removeAll()
        signpostTimes.removeAll()
    }
}

// MARK: - Statistics Structs

public struct RenderStats {
    public let average: TimeInterval
    public let min: TimeInterval
    public let max: TimeInterval
    public let p95: TimeInterval
    public let fps: Double

    public var averageMS: Double { average * 1000 }
    public var minMS: Double { min * 1000 }
    public var maxMS: Double { max * 1000 }
    public var p95MS: Double { p95 * 1000 }

    public var meetsTarget: Bool { average <= PerformanceMonitor.targetFrameTime }
}

public struct QueryStats {
    public let name: String
    public let average: TimeInterval
    public let min: TimeInterval
    public let max: TimeInterval
    public let p95: TimeInterval
    public let sampleCount: Int

    public var averageMS: Double { average * 1000 }
    public var minMS: Double { min * 1000 }
    public var maxMS: Double { max * 1000 }
    public var p95MS: Double { p95 * 1000 }

    public var meetsTarget: Bool { average <= PerformanceMonitor.maxQueryTime }
}

public struct NotebookPerformanceMetrics {
    public let averageRenderTime: TimeInterval
    public let maxRenderTime: TimeInterval
    public let averageQueryTime: TimeInterval
    public let maxQueryTime: TimeInterval
    public let averageResizeTime: TimeInterval
    public let renderSampleCount: Int
    public let querySampleCount: Int

    public var averageRenderMS: Double { averageRenderTime * 1000 }
    public var maxRenderMS: Double { maxRenderTime * 1000 }
    public var averageQueryMS: Double { averageQueryTime * 1000 }
    public var maxQueryMS: Double { maxQueryTime * 1000 }
    public var averageResizeMS: Double { averageResizeTime * 1000 }

    public var meetsRenderTarget: Bool { averageRenderTime <= PerformanceMonitor.targetFrameTime }
    public var meetsQueryTarget: Bool { averageQueryTime <= PerformanceMonitor.maxQueryTime }
    public var estimatedFPS: Double { averageRenderTime > 0 ? 1.0 / averageRenderTime : 0 }
}
