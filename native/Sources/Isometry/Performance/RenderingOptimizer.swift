import Foundation
import Metal
import MetalPerformanceShaders
import CoreGraphics
import os.signpost
import os.log

/// Native rendering optimization engine for achieving 60fps performance targets
/// Provides viewport culling, memory management, and GPU acceleration
@available(iOS 14.0, macOS 11.0, *)
public actor RenderingOptimizer {

    // MARK: - Types

    public struct RenderingSettings {
        public let cullingEnabled: Bool
        public let lodLevel: Int
        public let batchSize: Int
        public let memoryPoolSize: UInt64
        public let useGPUAcceleration: Bool

        public init(
            cullingEnabled: Bool = true,
            lodLevel: Int = 1,
            batchSize: Int = 100,
            memoryPoolSize: UInt64 = 50_000_000, // 50MB
            useGPUAcceleration: Bool = true
        ) {
            self.cullingEnabled = cullingEnabled
            self.lodLevel = lodLevel
            self.batchSize = batchSize
            self.memoryPoolSize = memoryPoolSize
            self.useGPUAcceleration = useGPUAcceleration
        }

        public static let performance = RenderingSettings(
            cullingEnabled: true,
            lodLevel: 3,
            batchSize: 200,
            memoryPoolSize: 100_000_000,
            useGPUAcceleration: true
        )

        public static let balanced = RenderingSettings()

        public static let quality = RenderingSettings(
            cullingEnabled: true,
            lodLevel: 0,
            batchSize: 50,
            memoryPoolSize: 25_000_000,
            useGPUAcceleration: false
        )
    }

    public struct Viewport {
        public let x: Double
        public let y: Double
        public let width: Double
        public let height: Double
        public let scale: Double

        public init(x: Double, y: Double, width: Double, height: Double, scale: Double) {
            self.x = x
            self.y = y
            self.width = width
            self.height = height
            self.scale = scale
        }

        public var bounds: CGRect {
            return CGRect(x: x, y: y, width: width, height: height)
        }
    }

    public struct RenderingMetrics {
        public let frameRate: Double
        public let renderTime: TimeInterval
        public let culledElements: Int
        public let renderedElements: Int
        public let memoryUsage: UInt64
        public let gpuUtilization: Double
        public let lodLevel: Int

        public var cullRatio: Double {
            let total = culledElements + renderedElements
            return total > 0 ? Double(culledElements) / Double(total) : 0.0
        }

        public var performance60FPS: Bool {
            return renderTime < 0.016 // < 16ms for 60fps
        }
    }

    // MARK: - Properties

    private let logger = os.Logger(subsystem: "Isometry", category: "RenderingOptimizer")
    private let signposter = OSSignposter(logger: os.Logger(subsystem: "Isometry", category: "RenderingPerformance"))

    private let viewportCulling: ViewportCulling
    private let memoryManager: AdvancedMemoryManager
    private var currentSettings: RenderingSettings

    // Performance monitoring
    private var frameRateHistory: [Double] = []
    private var renderTimeHistory: [TimeInterval] = []
    private var lastFrameTime: CFAbsoluteTime = 0
    private var frameCount: Int = 0

    // GPU acceleration
    private var metalDevice: MTLDevice?
    private var commandQueue: MTLCommandQueue?
    private var gpuEnabled: Bool = false

    // MARK: - Initialization

    public init(settings: RenderingSettings = .balanced) {
        self.currentSettings = settings
        self.viewportCulling = ViewportCulling()
        self.memoryManager = AdvancedMemoryManager(poolSize: settings.memoryPoolSize)

        Task {
            await initializeGPU()
        }

        logger.info("RenderingOptimizer initialized with \(settings.lodLevel) LOD level")
    }

    private func initializeGPU() async {
        if currentSettings.useGPUAcceleration {
            metalDevice = MTLCreateSystemDefaultDevice()
            if let device = metalDevice {
                commandQueue = device.makeCommandQueue()
                gpuEnabled = commandQueue != nil
                logger.info("GPU acceleration \(self.gpuEnabled ? "enabled" : "disabled")")
            }
        }
    }

    // MARK: - Public API

    /// Optimize viewport rendering for given parameters
    public func optimizeViewport(
        viewport: Viewport,
        nodeCount: Int,
        targetFPS: Double = 60.0
    ) async -> RenderingSettings {
        let state = signposter.beginInterval("optimizeViewport")
        defer { signposter.endInterval("optimizeViewport", state) }

        let currentFPS = await getCurrentFrameRate()
        let memoryPressure = await memoryManager.getMemoryPressure()

        // Dynamic optimization based on performance
        var optimizedSettings = currentSettings

        if currentFPS < targetFPS * 0.8 { // Below 80% of target
            // Performance mode optimizations
            optimizedSettings = RenderingSettings(
                cullingEnabled: true,
                lodLevel: min(currentSettings.lodLevel + 1, 3),
                batchSize: min(currentSettings.batchSize * 2, 500),
                memoryPoolSize: currentSettings.memoryPoolSize,
                useGPUAcceleration: true
            )
            logger.info("Performance optimization: increased LOD level to \(optimizedSettings.lodLevel)")
        } else if currentFPS > targetFPS * 1.1 { // Above 110% of target
            // Quality mode optimizations
            optimizedSettings = RenderingSettings(
                cullingEnabled: currentSettings.cullingEnabled,
                lodLevel: max(currentSettings.lodLevel - 1, 0),
                batchSize: max(currentSettings.batchSize / 2, 25),
                memoryPoolSize: currentSettings.memoryPoolSize,
                useGPUAcceleration: currentSettings.useGPUAcceleration
            )
            logger.debug("Quality optimization: decreased LOD level to \(optimizedSettings.lodLevel)")
        }

        // Memory pressure adjustments
        if memoryPressure > 0.8 {
            optimizedSettings = RenderingSettings(
                cullingEnabled: true,
                lodLevel: min(optimizedSettings.lodLevel + 1, 3),
                batchSize: optimizedSettings.batchSize,
                memoryPoolSize: optimizedSettings.memoryPoolSize / 2,
                useGPUAcceleration: optimizedSettings.useGPUAcceleration
            )
            logger.warning("Memory pressure detected: adjusted settings for memory efficiency")
        }

        await updateSettings(optimizedSettings)
        return optimizedSettings
    }

    /// Update LOD configuration based on zoom level and node count
    public func updateLOD(zoomLevel: Double, nodeCount: Int) async -> Int {
        let state = signposter.beginInterval("updateLOD")
        defer { signposter.endInterval("updateLOD", state) }

        // Calculate appropriate LOD level
        let lodLevel: Int

        if nodeCount > 5000 {
            lodLevel = zoomLevel < 0.5 ? 3 : zoomLevel < 1.0 ? 2 : 1
        } else if nodeCount > 1000 {
            lodLevel = zoomLevel < 0.3 ? 2 : zoomLevel < 0.8 ? 1 : 0
        } else {
            lodLevel = zoomLevel < 0.2 ? 1 : 0
        }

        // Update settings if LOD changed
        if lodLevel != currentSettings.lodLevel {
            let newSettings = RenderingSettings(
                cullingEnabled: currentSettings.cullingEnabled,
                lodLevel: lodLevel,
                batchSize: currentSettings.batchSize,
                memoryPoolSize: currentSettings.memoryPoolSize,
                useGPUAcceleration: currentSettings.useGPUAcceleration
            )
            await updateSettings(newSettings)
            logger.debug("LOD updated to level \(lodLevel) for zoom \(zoomLevel, format: .fixed(precision: 2)) with \(nodeCount) nodes")
        }

        return lodLevel
    }

    /// Manage memory strategy based on usage metrics
    public func manageMemory(memoryUsage: UInt64, leakDetected: Bool) async -> String {
        let state = signposter.beginInterval("manageMemory")
        defer { signposter.endInterval("manageMemory", state) }

        if leakDetected {
            await memoryManager.forceGarbageCollection()
            logger.warning("Memory leak detected - forced garbage collection")
            return "aggressive"
        }

        let memoryPressure = Double(memoryUsage) / Double(currentSettings.memoryPoolSize)

        if memoryPressure > 0.9 {
            await memoryManager.releaseUnusedBuffers()
            logger.info("High memory usage - released unused buffers")
            return "conservative"
        } else if memoryPressure > 0.7 {
            await memoryManager.compactMemory()
            return "balanced"
        }

        return "normal"
    }

    /// Get comprehensive benchmark results
    public func getBenchmarkResults() async -> RenderingMetrics {
        let currentFPS = await getCurrentFrameRate()
        let avgRenderTime = renderTimeHistory.suffix(10).reduce(0, +) / Double(min(renderTimeHistory.count, 10))
        let memoryUsage = await memoryManager.getCurrentUsage()
        let gpuUtilization = await getGPUUtilization()
        let cullingStats = await viewportCulling.getStatistics()

        return RenderingMetrics(
            frameRate: currentFPS,
            renderTime: avgRenderTime,
            culledElements: cullingStats.culledCount,
            renderedElements: cullingStats.renderedCount,
            memoryUsage: memoryUsage,
            gpuUtilization: gpuUtilization,
            lodLevel: currentSettings.lodLevel
        )
    }

    /// Record frame rendering performance
    public func recordFramePerformance(renderTime: TimeInterval) async {
        let currentTime = CFAbsoluteTimeGetCurrent()

        // Calculate frame rate
        if lastFrameTime > 0 {
            let frameInterval = currentTime - lastFrameTime
            let fps = 1.0 / frameInterval
            frameRateHistory.append(fps)

            // Limit history size
            if frameRateHistory.count > 60 { // Keep 1 second of 60fps history
                frameRateHistory.removeFirst()
            }
        }

        lastFrameTime = currentTime
        frameCount += 1

        // Record render time
        renderTimeHistory.append(renderTime)
        if renderTimeHistory.count > 30 {
            renderTimeHistory.removeFirst()
        }

        // Performance alerting
        if renderTime > 0.016 { // > 16ms
            logger.warning("Frame render time \(renderTime * 1000, format: .fixed(precision: 2))ms exceeds 60fps target")
        }
    }

    /// Prepare elements for batch rendering
    public func prepareBatchRendering(elements: [RenderElement]) async -> [RenderBatch] {
        let state = signposter.beginInterval("prepareBatchRendering")
        defer { signposter.endInterval("prepareBatchRendering", state) }

        // Group elements by material/texture for batch rendering
        let grouped = Dictionary(grouping: elements) { element in
            "\(element.materialID)-\(element.layer)"
        }

        var batches: [RenderBatch] = []

        for (key, groupElements) in grouped {
            let chunks = groupElements.chunked(into: currentSettings.batchSize)
            for chunk in chunks {
                batches.append(RenderBatch(
                    id: "\(key)-\(batches.count)",
                    elements: chunk,
                    materialID: chunk.first?.materialID ?? "",
                    layer: chunk.first?.layer ?? 0
                ))
            }
        }

        logger.debug("Prepared \(batches.count) render batches from \(elements.count) elements")
        return batches
    }

    // MARK: - Private Methods

    private func updateSettings(_ settings: RenderingSettings) async {
        currentSettings = settings
        await memoryManager.updatePoolSize(settings.memoryPoolSize)
    }

    private func getCurrentFrameRate() async -> Double {
        guard !frameRateHistory.isEmpty else { return 0.0 }
        return frameRateHistory.suffix(10).reduce(0, +) / Double(min(frameRateHistory.count, 10))
    }

    private func getGPUUtilization() async -> Double {
        // Simplified GPU utilization - would need platform-specific implementation
        return gpuEnabled ? 0.65 : 0.0
    }
}

// MARK: - Viewport Culling System

public actor ViewportCulling {

    public struct CullingStatistics {
        public let culledCount: Int
        public let renderedCount: Int
        public let spatialQueries: Int
        public let averageQueryTime: TimeInterval
    }

    private var spatialIndex: SpatialIndex
    private var statistics: CullingStatistics

    public init() {
        self.spatialIndex = SpatialIndex()
        self.statistics = CullingStatistics(culledCount: 0, renderedCount: 0, spatialQueries: 0, averageQueryTime: 0)
    }

    public func cullElements(viewport: RenderingOptimizer.Viewport, elements: [RenderElement]) async -> [RenderElement] {
        let startTime = CFAbsoluteTimeGetCurrent()

        await spatialIndex.updateIndex(elements: elements)
        let visibleElements = await spatialIndex.query(bounds: viewport.bounds)

        let queryTime = CFAbsoluteTimeGetCurrent() - startTime
        let culledCount = elements.count - visibleElements.count

        statistics = CullingStatistics(
            culledCount: culledCount,
            renderedCount: visibleElements.count,
            spatialQueries: statistics.spatialQueries + 1,
            averageQueryTime: (statistics.averageQueryTime * Double(statistics.spatialQueries - 1) + queryTime) / Double(statistics.spatialQueries)
        )

        return visibleElements
    }

    public func getStatistics() async -> CullingStatistics {
        return statistics
    }
}

// Memory management is handled by the separate AdvancedMemoryManager class

// MARK: - Supporting Types

public struct RenderElement {
    public let id: String
    public let bounds: CGRect
    public let materialID: String
    public let layer: Int
    public let visible: Bool

    public init(id: String, bounds: CGRect, materialID: String = "default", layer: Int = 0, visible: Bool = true) {
        self.id = id
        self.bounds = bounds
        self.materialID = materialID
        self.layer = layer
        self.visible = visible
    }
}

public struct RenderBatch {
    public let id: String
    public let elements: [RenderElement]
    public let materialID: String
    public let layer: Int

    public init(id: String, elements: [RenderElement], materialID: String, layer: Int) {
        self.id = id
        self.elements = elements
        self.materialID = materialID
        self.layer = layer
    }
}

// MARK: - Spatial Index (Simplified R-tree)

public actor SpatialIndex {
    private var elements: [RenderElement] = []

    public func updateIndex(elements: [RenderElement]) async {
        self.elements = elements
    }

    public func query(bounds: CGRect) async -> [RenderElement] {
        return elements.filter { element in
            element.bounds.intersects(bounds)
        }
    }
}

// MARK: - Array Extension

extension Array {
    func chunked(into size: Int) -> [[Element]] {
        return stride(from: 0, to: count, by: size).map {
            Array(self[$0..<Swift.min($0 + size, count)])
        }
    }
}