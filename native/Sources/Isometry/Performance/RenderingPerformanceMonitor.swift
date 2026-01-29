import Foundation
import CoreGraphics
import QuartzCore

/// Comprehensive D3 rendering performance monitor for native Canvas rendering pipeline
/// Provides real-time metrics, memory tracking, and optimization recommendations
@MainActor
public class RenderingPerformanceMonitor {
    // MARK: - Performance Metrics

    /// Core D3 rendering metrics collected per frame
    public struct D3RenderingMetrics: Codable, Sendable {
        public let timestamp: TimeInterval
        public let renderTime: TimeInterval
        public let commandCount: Int
        public let memoryUsage: Int64 // bytes
        public let cacheHitRate: Double // 0.0 to 1.0
        public let frameRate: Double
        public let droppedFrames: Int
        public let complexity: RenderComplexity

        public init(
            timestamp: TimeInterval = CACurrentMediaTime(),
            renderTime: TimeInterval,
            commandCount: Int,
            memoryUsage: Int64,
            cacheHitRate: Double,
            frameRate: Double,
            droppedFrames: Int,
            complexity: RenderComplexity
        ) {
            self.timestamp = timestamp
            self.renderTime = renderTime
            self.commandCount = commandCount
            self.memoryUsage = memoryUsage
            self.cacheHitRate = cacheHitRate
            self.frameRate = frameRate
            self.droppedFrames = droppedFrames
            self.complexity = complexity
        }
    }

    /// Render complexity analysis for LOD optimization
    public struct RenderComplexity: Codable, Sendable {
        public let pathCommandCount: Int
        public let simpleShapeCount: Int
        public let textCommandCount: Int
        public let transformCount: Int
        public let complexityScore: Double // 0.0 to 10.0

        public init(pathCommandCount: Int, simpleShapeCount: Int, textCommandCount: Int, transformCount: Int, complexityScore: Double) {
            self.pathCommandCount = pathCommandCount
            self.simpleShapeCount = simpleShapeCount
            self.textCommandCount = textCommandCount
            self.transformCount = transformCount
            self.complexityScore = complexityScore
        }
    }

    /// Performance tracker with sliding window statistics
    public class PerformanceTracker {
        private let maxSamples = 100
        private var metrics: [D3RenderingMetrics] = []
        private let lock = NSRecursiveLock()

        public func recordMetrics(_ newMetrics: D3RenderingMetrics) {
            lock.lock()
            defer { lock.unlock() }

            metrics.append(newMetrics)

            // Keep only recent samples
            if metrics.count > maxSamples {
                metrics.removeFirst(metrics.count - maxSamples)
            }
        }

        public func getAverageRenderTime() -> TimeInterval {
            lock.lock()
            defer { lock.unlock() }

            guard !metrics.isEmpty else { return 0 }
            return metrics.reduce(0) { $0 + $1.renderTime } / TimeInterval(metrics.count)
        }

        public func getAverageFrameRate() -> Double {
            lock.lock()
            defer { lock.unlock() }

            guard !metrics.isEmpty else { return 0 }
            return metrics.reduce(0) { $0 + $1.frameRate } / Double(metrics.count)
        }

        public func getPeakMemoryUsage() -> Int64 {
            lock.lock()
            defer { lock.unlock() }

            return metrics.max { $0.memoryUsage < $1.memoryUsage }?.memoryUsage ?? 0
        }

        public func getCacheEfficiency() -> Double {
            lock.lock()
            defer { lock.unlock() }

            guard !metrics.isEmpty else { return 0 }
            return metrics.reduce(0) { $0 + $1.cacheHitRate } / Double(metrics.count)
        }

        public func getComplexityTrend() -> (average: Double, peak: Double) {
            lock.lock()
            defer { lock.unlock() }

            guard !metrics.isEmpty else { return (0, 0) }
            let complexityScores = metrics.map { $0.complexity.complexityScore }
            let average = complexityScores.reduce(0, +) / Double(complexityScores.count)
            let peak = complexityScores.max() ?? 0
            return (average, peak)
        }

        public func getRecentMetrics(count: Int = 10) -> [D3RenderingMetrics] {
            lock.lock()
            defer { lock.unlock() }

            let recentCount = min(count, metrics.count)
            return Array(metrics.suffix(recentCount))
        }

        public func clearMetrics() {
            lock.lock()
            defer { lock.unlock() }
            metrics.removeAll()
        }
    }

    // MARK: - Memory Pressure Detection

    public enum MemoryPressureLevel {
        case normal
        case warning
        case critical

        var lodAdjustment: Double {
            switch self {
            case .normal: return 1.0
            case .warning: return 0.75
            case .critical: return 0.5
            }
        }

        var description: String {
            switch self {
            case .normal: return "Normal"
            case .warning: return "Warning"
            case .critical: return "Critical"
            }
        }
    }

    // MARK: - Performance Recommendations

    public struct OptimizationRecommendation: Codable, Sendable {
        public let type: RecommendationType
        public let priority: Priority
        public let description: String
        public let expectedImprovement: Double

        public enum RecommendationType: String, Codable, CaseIterable, Sendable {
            case viewportCulling = "viewport_culling"
            case lodOptimization = "lod_optimization"
            case commandBatching = "command_batching"
            case memoryOptimization = "memory_optimization"
            case cacheImprovement = "cache_improvement"
            case renderingStrategy = "rendering_strategy"
        }

        public enum Priority: String, Codable, CaseIterable, Sendable {
            case low = "low"
            case medium = "medium"
            case high = "high"
            case critical = "critical"
        }
    }

    // MARK: - Properties

    // Performance logging for debugging
    public let performanceTracker = PerformanceTracker()

    // Current frame tracking
    private var currentFrameStartTime: TimeInterval = 0
    private var frameCount: Int = 0
    private var lastFrameTime: TimeInterval = 0
    private var droppedFrameCount: Int = 0

    // Memory tracking
    private var peakMemoryUsage: Int64 = 0
    private var lastMemoryCheck: TimeInterval = 0
    private let memoryCheckInterval: TimeInterval = 1.0 // Check every second

    // Cache tracking
    private var cacheHits: Int = 0
    private var cacheMisses: Int = 0
    private var totalCacheRequests: Int = 0

    // Command profiling
    private var commandBreakdown: [String: Int] = [:]
    private var renderingPhaseTimings: [String: TimeInterval] = [:]

    // MARK: - Initialization

    public init() {
        print("[RenderingPerformance] RenderingPerformanceMonitor initialized")
        resetMetrics()
    }

    // MARK: - Frame Lifecycle Tracking

    /// Start tracking a new render frame
    public func startFrame() {
        currentFrameStartTime = CACurrentMediaTime()
        commandBreakdown.removeAll()
        renderingPhaseTimings.removeAll()
    }

    /// Complete frame tracking and record metrics
    public func endFrame(commandCount: Int, complexity: RenderComplexity) {
        let frameEndTime = CACurrentMediaTime()
        let renderTime = frameEndTime - currentFrameStartTime

        // Update frame rate calculation
        frameCount += 1
        let currentTime = frameEndTime

        let frameRate = calculateFrameRate(currentTime: currentTime, renderTime: renderTime)
        let memoryUsage = getCurrentMemoryUsage()
        let cacheHitRate = calculateCacheHitRate()

        // Detect dropped frames (render time > 16ms for 60fps)
        if renderTime > 0.0167 {
            droppedFrameCount += 1
        }

        // Create metrics record
        let metrics = D3RenderingMetrics(
            renderTime: renderTime,
            commandCount: commandCount,
            memoryUsage: memoryUsage,
            cacheHitRate: cacheHitRate,
            frameRate: frameRate,
            droppedFrames: droppedFrameCount,
            complexity: complexity
        )

        // Record metrics
        performanceTracker.recordMetrics(metrics)

        // Update peak memory if needed
        if memoryUsage > peakMemoryUsage {
            peakMemoryUsage = memoryUsage
        }

        // Log performance data
        logPerformanceData(metrics)

        lastFrameTime = currentTime
    }

    // MARK: - Render Phase Profiling

    /// Start timing a specific rendering phase
    public func startPhase(_ phase: String) {
        renderingPhaseTimings["\(phase)_start"] = CACurrentMediaTime()
    }

    /// End timing a specific rendering phase
    public func endPhase(_ phase: String) {
        let endTime = CACurrentMediaTime()
        if let startTime = renderingPhaseTimings["\(phase)_start"] {
            renderingPhaseTimings[phase] = endTime - startTime
            renderingPhaseTimings.removeValue(forKey: "\(phase)_start")
        }
    }

    // MARK: - Command Profiling

    /// Record a render command for profiling
    public func recordCommand(type: String) {
        commandBreakdown[type, default: 0] += 1
    }

    /// Get breakdown of render commands
    public func getCommandBreakdown() -> [String: Int] {
        return commandBreakdown
    }

    /// Get timing breakdown for render phases
    public func getPhaseTimings() -> [String: TimeInterval] {
        return renderingPhaseTimings.filter { !$0.key.hasSuffix("_start") }
    }

    // MARK: - Cache Tracking

    /// Record a cache hit
    public func recordCacheHit() {
        cacheHits += 1
        totalCacheRequests += 1
    }

    /// Record a cache miss
    public func recordCacheMiss() {
        cacheMisses += 1
        totalCacheRequests += 1
    }

    // MARK: - Memory Pressure Detection

    /// Detect current memory pressure level
    public func detectMemoryPressure() -> MemoryPressureLevel {
        let currentMemory = getCurrentMemoryUsage()
        let memoryMB = Double(currentMemory) / (1024 * 1024)

        // Thresholds based on typical iOS/macOS memory constraints
        if memoryMB > 500 {
            return .critical
        } else if memoryMB > 200 {
            return .warning
        } else {
            return .normal
        }
    }

    /// Get automatic LOD adjustment based on memory pressure
    public func getAutomaticLODAdjustment() -> Double {
        return detectMemoryPressure().lodAdjustment
    }

    // MARK: - Optimization Recommendations

    /// Generate performance optimization recommendations
    public func generateOptimizationRecommendations() -> [OptimizationRecommendation] {
        var recommendations: [OptimizationRecommendation] = []

        let avgRenderTime = performanceTracker.getAverageRenderTime()
        let avgFrameRate = performanceTracker.getAverageFrameRate()
        let cacheEfficiency = performanceTracker.getCacheEfficiency()
        let memoryPressure = detectMemoryPressure()
        let complexityTrend = performanceTracker.getComplexityTrend()

        // Viewport culling recommendation
        if avgRenderTime > 0.0167 && complexityTrend.average > 5.0 {
            recommendations.append(OptimizationRecommendation(
                type: .viewportCulling,
                priority: .high,
                description: "Enable viewport culling to reduce off-screen render commands",
                expectedImprovement: 0.3
            ))
        }

        // LOD optimization recommendation
        if avgFrameRate < 30.0 && complexityTrend.peak > 7.0 {
            recommendations.append(OptimizationRecommendation(
                type: .lodOptimization,
                priority: .high,
                description: "Implement Level-of-Detail system to reduce complexity at distance",
                expectedImprovement: 0.4
            ))
        }

        // Cache improvement recommendation
        if cacheEfficiency < 0.7 {
            recommendations.append(OptimizationRecommendation(
                type: .cacheImprovement,
                priority: .medium,
                description: "Improve coordinate transform and render command caching",
                expectedImprovement: 0.2
            ))
        }

        // Memory optimization recommendation
        if memoryPressure != .normal {
            recommendations.append(OptimizationRecommendation(
                type: .memoryOptimization,
                priority: memoryPressure == .critical ? .critical : .high,
                description: "Reduce memory usage through object pooling and cleanup",
                expectedImprovement: 0.3
            ))
        }

        // Command batching recommendation
        if commandBreakdown.values.reduce(0, +) > 100 && avgRenderTime > 0.010 {
            recommendations.append(OptimizationRecommendation(
                type: .commandBatching,
                priority: .medium,
                description: "Batch similar render commands for improved GPU performance",
                expectedImprovement: 0.25
            ))
        }

        return recommendations.sorted { $0.priority.rawValue > $1.priority.rawValue }
    }

    // MARK: - Bridge Integration for React

    /// Export metrics to React via bridge
    public func exportMetricsForBridge() -> [String: Any] {
        let recentMetrics = performanceTracker.getRecentMetrics(count: 1).first
        let recommendations = generateOptimizationRecommendations()

        return [
            "currentMetrics": recentMetrics?.asDictionary() ?? [:],
            "averageRenderTime": performanceTracker.getAverageRenderTime(),
            "averageFrameRate": performanceTracker.getAverageFrameRate(),
            "cacheEfficiency": performanceTracker.getCacheEfficiency(),
            "memoryPressure": detectMemoryPressure().description,
            "peakMemoryUsage": peakMemoryUsage,
            "commandBreakdown": commandBreakdown,
            "phaseTimings": getPhaseTimings(),
            "recommendations": recommendations.map { $0.asDictionary() }
        ]
    }

    // MARK: - Statistics and Reporting

    /// Get comprehensive performance statistics
    public func getPerformanceStatistics() -> [String: Any] {
        return [
            "frameCount": frameCount,
            "droppedFrames": droppedFrameCount,
            "droppedFrameRate": frameCount > 0 ? Double(droppedFrameCount) / Double(frameCount) : 0.0,
            "averageRenderTime": performanceTracker.getAverageRenderTime(),
            "averageFrameRate": performanceTracker.getAverageFrameRate(),
            "peakMemoryUsage": peakMemoryUsage,
            "cacheHitRate": calculateCacheHitRate(),
            "memoryPressure": detectMemoryPressure().description,
            "complexityTrend": performanceTracker.getComplexityTrend()
        ]
    }

    /// Reset all performance metrics
    public func resetMetrics() {
        frameCount = 0
        droppedFrameCount = 0
        peakMemoryUsage = 0
        cacheHits = 0
        cacheMisses = 0
        totalCacheRequests = 0
        commandBreakdown.removeAll()
        renderingPhaseTimings.removeAll()
        performanceTracker.clearMetrics()
        print("[RenderingPerformance] Performance metrics reset")
    }

    // MARK: - Private Helpers

    private func calculateFrameRate(currentTime: TimeInterval, renderTime: TimeInterval) -> Double {
        if lastFrameTime > 0 && currentTime > lastFrameTime {
            let frameDelta = currentTime - lastFrameTime
            return 1.0 / frameDelta
        } else {
            // Fallback calculation based on render time
            return renderTime > 0 ? 1.0 / renderTime : 60.0
        }
    }

    private func getCurrentMemoryUsage() -> Int64 {
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

    private func calculateCacheHitRate() -> Double {
        guard totalCacheRequests > 0 else { return 0.0 }
        return Double(cacheHits) / Double(totalCacheRequests)
    }

    private func logPerformanceData(_ metrics: D3RenderingMetrics) {
        if metrics.renderTime > 0.0167 {
            print("[RenderingPerformance] WARNING: Frame render time exceeded 16ms: \(metrics.renderTime * 1000)ms")
        }

        if frameCount % 60 == 0 { // Log every 60 frames
            print("[RenderingPerformance] Performance: \(metrics.frameRate)fps, \(metrics.renderTime * 1000)ms render, \(metrics.commandCount) commands")
        }
    }
}

// MARK: - Extensions for Bridge Integration

extension RenderingPerformanceMonitor.D3RenderingMetrics {
    func asDictionary() -> [String: Any] {
        return [
            "timestamp": timestamp,
            "renderTime": renderTime,
            "commandCount": commandCount,
            "memoryUsage": memoryUsage,
            "cacheHitRate": cacheHitRate,
            "frameRate": frameRate,
            "droppedFrames": droppedFrames,
            "complexity": complexity.asDictionary()
        ]
    }
}

extension RenderingPerformanceMonitor.RenderComplexity {
    func asDictionary() -> [String: Any] {
        return [
            "pathCommandCount": pathCommandCount,
            "simpleShapeCount": simpleShapeCount,
            "textCommandCount": textCommandCount,
            "transformCount": transformCount,
            "complexityScore": complexityScore
        ]
    }
}

extension RenderingPerformanceMonitor.OptimizationRecommendation {
    func asDictionary() -> [String: Any] {
        return [
            "type": type.rawValue,
            "priority": priority.rawValue,
            "description": description,
            "expectedImprovement": expectedImprovement
        ]
    }
}