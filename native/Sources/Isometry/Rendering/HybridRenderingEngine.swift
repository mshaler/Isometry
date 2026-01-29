import Foundation
import CoreGraphics
import OSLog

/// Hybrid Rendering Engine for intelligent element-level rendering decisions
/// Analyzes render commands to route between native and DOM rendering for optimal performance
@MainActor
public class HybridRenderingEngine {

    // MARK: - Dependencies

    private let nativeRenderer: NativeCanvasRenderer
    private let performanceMonitor: RenderingPerformanceMonitor
    private let logger = HybridRenderingLogger()

    // MARK: - Element Classification

    private let elementClassifier = ElementClassifier()
    private let decisionCache = NSCache<NSString, RenderingStrategyResult>()

    // MARK: - Performance Learning

    private var performanceHistory = PerformanceHistory()
    private let decisionQueue = DispatchQueue(label: "hybrid-rendering-decisions", qos: .userInitiated)

    // MARK: - Memory Management

    private var lastMemoryPressure: MemoryPressure = .normal
    private let memoryPressureSource: DispatchSourceMemoryPressure

    // MARK: - Batch Optimization

    private var pendingCommands: [D3RenderCommand] = []
    private var batchTimer: Timer?
    private let batchInterval: TimeInterval = 0.008 // ~120fps for batching

    // MARK: - Initialization

    public init(nativeRenderer: NativeCanvasRenderer, performanceMonitor: RenderingPerformanceMonitor) {
        self.nativeRenderer = nativeRenderer
        self.performanceMonitor = performanceMonitor

        // Setup memory pressure monitoring
        self.memoryPressureSource = DispatchSource.makeMemoryPressureSource(eventMask: [.warning, .critical], queue: DispatchQueue.global(qos: .utility))

        // Configure cache limits
        decisionCache.countLimit = 1000 // Cache up to 1000 decisions

        setupMemoryPressureHandling()
        logger.info("HybridRenderingEngine initialized with intelligent element routing")
    }

    deinit {
        memoryPressureSource.cancel()
        batchTimer?.invalidate()
    }

    // MARK: - Main Rendering Interface

    /// Route render commands to optimal renderer based on element characteristics
    public func processRenderCommands(_ commands: [D3RenderCommand], viewport: D3Viewport) async throws -> HybridRenderResult {
        let analysisStartTime = CFAbsoluteTimeGetCurrent()

        // Step 1: Classify commands and determine rendering strategy
        let routingDecisions = await analyzeCommands(commands, viewport: viewport)

        // Step 2: Group commands by rendering strategy
        let nativeCommands = routingDecisions.compactMap { decision in
            decision.strategy == .native || decision.strategy == .hybrid ? decision.command : nil
        }

        let domCommands = routingDecisions.compactMap { decision in
            decision.strategy == .dom || decision.strategy == .hybrid ? decision.command : nil
        }

        // Step 3: Execute native rendering for suitable commands
        var nativeResult: RenderResult? = nil
        if !nativeCommands.isEmpty {
            nativeResult = try await executeNativeRendering(nativeCommands, viewport: viewport)
        }

        // Step 4: Prepare DOM command data for React bridge
        let domCommandData = prepareDOMCommands(domCommands)

        // Step 5: Update performance learning
        let analysisDuration = CFAbsoluteTimeGetCurrent() - analysisStartTime
        await updatePerformanceLearning(routingDecisions, analysisDuration: analysisDuration)

        let result = HybridRenderResult(
            nativeResult: nativeResult,
            domCommands: domCommandData,
            routingDecisions: routingDecisions,
            totalCommands: commands.count,
            nativeCommandCount: nativeCommands.count,
            domCommandCount: domCommands.count,
            analysisDuration: analysisDuration
        )

        logger.debug("Hybrid rendering: \(nativeCommands.count) native, \(domCommands.count) DOM commands")
        return result
    }

    // MARK: - Command Analysis

    private func analyzeCommands(_ commands: [D3RenderCommand], viewport: D3Viewport) async -> [RenderingDecision] {
        return await withTaskGroup(of: RenderingDecision?.self) { group in
            var decisions: [RenderingDecision] = []

            for command in commands {
                group.addTask { [weak self] in
                    await self?.analyzeCommand(command, viewport: viewport)
                }
            }

            for await decision in group {
                if let decision = decision {
                    decisions.append(decision)
                }
            }

            return decisions
        }
    }

    private func analyzeCommand(_ command: D3RenderCommand, viewport: D3Viewport) async -> RenderingDecision {
        // Check cache first
        let cacheKey = generateCacheKey(command, viewport: viewport)
        if let cachedResult = decisionCache.object(forKey: cacheKey as NSString) {
            return RenderingDecision(
                command: command,
                strategy: cachedResult.strategy,
                confidence: cachedResult.confidence,
                reasoning: cachedResult.reasoning,
                fromCache: true
            )
        }

        // Analyze command characteristics
        let characteristics = elementClassifier.analyzeCommand(command, viewport: viewport)

        // Apply decision criteria
        let strategy = determineRenderingStrategy(characteristics, memoryPressure: lastMemoryPressure)

        // Cache decision
        let result = RenderingStrategyResult(
            strategy: strategy.strategy,
            confidence: strategy.confidence,
            reasoning: strategy.reasoning
        )
        decisionCache.setObject(result, forKey: cacheKey as NSString)

        return RenderingDecision(
            command: command,
            strategy: strategy.strategy,
            confidence: strategy.confidence,
            reasoning: strategy.reasoning,
            fromCache: false
        )
    }

    private func determineRenderingStrategy(_ characteristics: ElementCharacteristics, memoryPressure: MemoryPressure) -> (strategy: RenderingStrategy, confidence: Double, reasoning: String) {

        // Decision criteria based on element characteristics
        var nativeScore: Double = 0
        var domScore: Double = 0
        var reasoning: [String] = []

        // Complexity analysis
        if characteristics.complexity >= 7 {
            nativeScore += 30
            reasoning.append("high complexity favors native GPU acceleration")
        } else if characteristics.complexity <= 3 {
            domScore += 20
            reasoning.append("low complexity suitable for DOM rendering")
        }

        // Size analysis
        if characteristics.size.width * characteristics.size.height > 10000 {
            nativeScore += 25
            reasoning.append("large elements benefit from native batching")
        } else if characteristics.size.width * characteristics.size.height < 100 {
            domScore += 15
            reasoning.append("small elements efficient in DOM")
        }

        // Type-specific analysis
        switch characteristics.type {
        case .path where characteristics.hasGradients || characteristics.pathComplexity > 5:
            nativeScore += 35
            reasoning.append("complex paths/gradients require GPU acceleration")

        case .text where characteristics.isInteractive:
            domScore += 40
            reasoning.append("interactive text better handled in DOM")

        case .circle where characteristics.count > 100,
             .rectangle where characteristics.count > 100:
            nativeScore += 30
            reasoning.append("many simple shapes benefit from native batching")

        case .group where characteristics.hasTransforms:
            nativeScore += 20
            reasoning.append("grouped transforms efficient in native renderer")

        default:
            // Default slightly favors DOM for simplicity
            domScore += 5
        }

        // Interactive elements analysis
        if characteristics.isInteractive {
            domScore += 25
            reasoning.append("interactive elements need DOM event handling")
        }

        // Performance history influence
        let historyInfluence = performanceHistory.getStrategyPreference(for: characteristics.type)
        nativeScore += historyInfluence.nativePerformance * 10
        domScore += historyInfluence.domPerformance * 10

        // Memory pressure adaptation
        switch memoryPressure {
        case .warning:
            domScore += 15
            reasoning.append("memory pressure favors lighter DOM rendering")
        case .critical:
            domScore += 30
            reasoning.append("critical memory pressure requires DOM fallback")
        case .normal:
            break
        }

        // Make final decision
        let totalScore = nativeScore + domScore

        let strategy: RenderingStrategy
        if nativeScore > domScore + 10 { // Require clear advantage for native
            strategy = .native
        } else if domScore > nativeScore + 5 {
            strategy = .dom
        } else {
            strategy = .hybrid // Mixed strategy for borderline cases
        }

        return (
            strategy: strategy,
            confidence: abs(nativeScore - domScore) / totalScore,
            reasoning: reasoning.joined(separator: "; ")
        )
    }

    // MARK: - Native Rendering Execution

    private func executeNativeRendering(_ commands: [D3RenderCommand], viewport: D3Viewport) async throws -> RenderResult {
        let renderStartTime = CFAbsoluteTimeGetCurrent()

        // Batch commands for efficiency
        let batchedCommands = batchCommandsForNativeRenderer(commands)

        // Execute rendering
        let result = try await nativeRenderer.render(commands: batchedCommands, viewport: viewport)

        let renderDuration = CFAbsoluteTimeGetCurrent() - renderStartTime

        // Track performance for learning
        await performanceMonitor.recordNativeRenderingMetrics(
            commandCount: commands.count,
            renderTime: renderDuration,
            memoryUsage: result.memoryUsage,
            primitiveCount: result.primitiveCount
        )

        return result
    }

    private func batchCommandsForNativeRenderer(_ commands: [D3RenderCommand]) -> [D3RenderCommand] {
        // Group similar commands for GPU batching efficiency
        let grouped = Dictionary(grouping: commands) { command in
            switch command {
            case .circle(_, _, let fill, let stroke, _, _):
                return "circle-\(fill?.hexString ?? "none")-\(stroke?.hexString ?? "none")"
            case .rectangle(_, let fill, let stroke, _, _, _):
                return "rectangle-\(fill?.hexString ?? "none")-\(stroke?.hexString ?? "none")"
            case .path(_, let fill, let stroke, _, _):
                return "path-\(fill?.hexString ?? "none")-\(stroke?.hexString ?? "none")"
            case .text(_, _, let color, let fontSize, let fontFamily, _, _):
                return "text-\(color.hexString ?? "black")-\(fontSize)-\(fontFamily)"
            case .group(_, _, _):
                return "group"
            }
        }

        // Return commands in batch-optimized order
        return grouped.values.flatMap { $0 }
    }

    // MARK: - DOM Command Preparation

    private func prepareDOMCommands(_ commands: [D3RenderCommand]) -> [[String: Any]] {
        return commands.compactMap { command in
            convertCommandToDOMData(command)
        }
    }

    private func convertCommandToDOMData(_ command: D3RenderCommand) -> [String: Any]? {
        // Convert native render command to DOM-compatible data
        // This prepares the command for React D3 DOM rendering
        switch command {
        case .circle(let center, let radius, let fill, let stroke, let strokeWidth, let opacity):
            return [
                "type": "circle",
                "center": ["x": center.x, "y": center.y],
                "radius": radius,
                "fill": fill?.hexString as Any,
                "stroke": stroke?.hexString as Any,
                "strokeWidth": strokeWidth,
                "opacity": opacity
            ]

        case .rectangle(let bounds, let fill, let stroke, let strokeWidth, let cornerRadius, let opacity):
            return [
                "type": "rectangle",
                "bounds": [
                    "x": bounds.origin.x,
                    "y": bounds.origin.y,
                    "width": bounds.size.width,
                    "height": bounds.size.height
                ],
                "fill": fill?.hexString as Any,
                "stroke": stroke?.hexString as Any,
                "strokeWidth": strokeWidth,
                "cornerRadius": cornerRadius,
                "opacity": opacity
            ]

        case .text(let content, let position, let color, let fontSize, let fontFamily, let alignment, let opacity):
            return [
                "type": "text",
                "content": content,
                "position": ["x": position.x, "y": position.y],
                "color": color.hexString as Any,
                "fontSize": fontSize,
                "fontFamily": fontFamily,
                "alignment": alignment.rawValue,
                "opacity": opacity
            ]

        case .path(let pathData, let fill, let stroke, let strokeWidth, let opacity):
            return [
                "type": "path",
                "path": pathData,
                "fill": fill?.hexString as Any,
                "stroke": stroke?.hexString as Any,
                "strokeWidth": strokeWidth,
                "opacity": opacity
            ]

        case .group(let transform, let children, let opacity):
            return [
                "type": "group",
                "transform": transformToDict(transform),
                "children": children.compactMap { convertCommandToDOMData($0) },
                "opacity": opacity
            ]
        }
    }

    private func transformToDict(_ transform: CGAffineTransform) -> [String: Double] {
        return [
            "a": Double(transform.a),
            "b": Double(transform.b),
            "c": Double(transform.c),
            "d": Double(transform.d),
            "tx": Double(transform.tx),
            "ty": Double(transform.ty)
        ]
    }

    // MARK: - Performance Learning

    private func updatePerformanceLearning(_ decisions: [RenderingDecision], analysisDuration: TimeInterval) async {
        for decision in decisions {
            let characteristics = elementClassifier.analyzeCommand(decision.command, viewport: D3Viewport(x: 0, y: 0, width: 800, height: 600, scale: 1.0))

            // Update performance history based on actual execution
            if decision.strategy == .native {
                performanceHistory.updateNativePerformance(for: characteristics.type, success: true)
            } else {
                performanceHistory.updateDOMPerformance(for: characteristics.type, success: true)
            }
        }

        // Record analysis performance
        await performanceMonitor.recordHybridAnalysisMetrics(
            commandCount: decisions.count,
            analysisDuration: analysisDuration,
            cacheHitRate: Double(decisions.filter { $0.fromCache }.count) / Double(decisions.count)
        )
    }

    // MARK: - Memory Pressure Handling

    private func setupMemoryPressureHandling() {
        memoryPressureSource.setEventHandler { [weak self] in
            Task { @MainActor in
                await self?.handleMemoryPressureEvent()
            }
        }
        memoryPressureSource.resume()
    }

    private func handleMemoryPressureEvent() async {
        let flags = memoryPressureSource.data

        if flags.contains(.critical) {
            lastMemoryPressure = .critical
            logger.warning("Critical memory pressure - switching to DOM rendering")

            // Clear caches to free memory
            decisionCache.removeAllObjects()

            // Force DOM rendering for new commands
            await nativeRenderer.pauseNativeRendering()

        } else if flags.contains(.warning) {
            lastMemoryPressure = .warning
            logger.info("Memory pressure warning - favoring DOM rendering")

            // Reduce cache size
            decisionCache.countLimit = 200

        } else {
            lastMemoryPressure = .normal

            // Restore normal operation
            decisionCache.countLimit = 1000
            await nativeRenderer.resumeNativeRendering()
        }
    }

    // MARK: - Utility Methods

    private func generateCacheKey(_ command: D3RenderCommand, viewport: D3Viewport) -> String {
        let commandHash = command.cacheKey
        let viewportHash = "\(viewport.scale)-\(Int(viewport.width))-\(Int(viewport.height))"
        return "\(commandHash)-\(viewportHash)-\(lastMemoryPressure.rawValue)"
    }

    // MARK: - Public Interface

    /// Get current rendering statistics
    public func getRenderingStatistics() -> HybridRenderingStatistics {
        let cacheStats = HybridCacheStatistics(
            totalEntries: decisionCache.countLimit,
            cacheHitRate: 0.0, // TODO: Track cache hits
            memoryPressure: lastMemoryPressure
        )

        let strategyStats = performanceHistory.getOverallStatistics()

        return HybridRenderingStatistics(
            cacheStatistics: cacheStats,
            strategyStatistics: strategyStats,
            lastAnalysisDuration: 0.0 // TODO: Track last analysis time
        )
    }

    /// Update rendering strategy preferences
    public func updateStrategyPreferences(_ preferences: [ElementType: RenderingStrategy]) {
        for (elementType, strategy) in preferences {
            performanceHistory.setStrategyPreference(for: elementType, strategy: strategy)
        }

        // Clear cache to apply new preferences
        decisionCache.removeAllObjects()
        logger.info("Updated strategy preferences for \(preferences.count) element types")
    }

    /// Reset performance learning and cache
    public func resetPerformanceLearning() {
        performanceHistory.reset()
        decisionCache.removeAllObjects()
        logger.info("Reset performance learning and decision cache")
    }
}

// MARK: - Element Classifier

private class ElementClassifier {

    func analyzeCommand(_ command: D3RenderCommand, viewport: D3Viewport) -> ElementCharacteristics {
        switch command {
        case .circle(_, let radius, let fill, let stroke, _, _):
            return ElementCharacteristics(
                type: .circle,
                size: CGSize(width: radius * 2, height: radius * 2),
                complexity: calculateCircleComplexity(fill: fill, stroke: stroke),
                isInteractive: false,
                hasGradients: fill?.isGradient ?? false || stroke?.isGradient ?? false,
                hasTransforms: false,
                pathComplexity: 1,
                count: 1
            )

        case .rectangle(let bounds, let fill, let stroke, _, let cornerRadius, _):
            return ElementCharacteristics(
                type: .rectangle,
                size: bounds.size,
                complexity: calculateRectangleComplexity(fill: fill, stroke: stroke, cornerRadius: cornerRadius),
                isInteractive: false,
                hasGradients: fill?.isGradient ?? false || stroke?.isGradient ?? false,
                hasTransforms: false,
                pathComplexity: cornerRadius > 0 ? 2 : 1,
                count: 1
            )

        case .text(let content, _, _, let fontSize, _, _, _):
            return ElementCharacteristics(
                type: .text,
                size: estimateTextSize(content: content, fontSize: fontSize),
                complexity: calculateTextComplexity(content: content, fontSize: fontSize),
                isInteractive: true, // Text often interactive for selection
                hasGradients: false,
                hasTransforms: false,
                pathComplexity: content.count > 50 ? 3 : 1,
                count: 1
            )

        case .path(let pathData, let fill, let stroke, _, _):
            let pathComplexity = calculatePathComplexity(pathData: pathData)
            return ElementCharacteristics(
                type: .path,
                size: estimatePathSize(pathData: pathData),
                complexity: pathComplexity,
                isInteractive: false,
                hasGradients: fill?.isGradient ?? false || stroke?.isGradient ?? false,
                hasTransforms: false,
                pathComplexity: pathComplexity,
                count: 1
            )

        case .group(let transform, let children, _):
            let childCharacteristics = children.map { analyzeCommand($0, viewport: viewport) }
            return ElementCharacteristics(
                type: .group,
                size: calculateGroupSize(childCharacteristics),
                complexity: childCharacteristics.map { $0.complexity }.reduce(0, +) / max(1, children.count),
                isInteractive: childCharacteristics.contains { $0.isInteractive },
                hasGradients: childCharacteristics.contains { $0.hasGradients },
                hasTransforms: !transform.isIdentity,
                pathComplexity: childCharacteristics.map { $0.pathComplexity }.max() ?? 1,
                count: children.count
            )
        }
    }

    private func calculateCircleComplexity(fill: CGColor?, stroke: CGColor?) -> Int {
        var complexity = 1
        if fill != nil { complexity += 1 }
        if stroke != nil { complexity += 1 }
        return complexity
    }

    private func calculateRectangleComplexity(fill: CGColor?, stroke: CGColor?, cornerRadius: Double) -> Int {
        var complexity = 1
        if fill != nil { complexity += 1 }
        if stroke != nil { complexity += 1 }
        if cornerRadius > 0 { complexity += 1 }
        return complexity
    }

    private func calculateTextComplexity(content: String, fontSize: Double) -> Int {
        let baseComplexity = min(content.count / 10, 5)
        let sizeComplexity = fontSize > 24 ? 2 : 1
        return baseComplexity + sizeComplexity
    }

    private func calculatePathComplexity(pathData: String) -> Int {
        // Estimate complexity based on path data length and commands
        let commands = ["M", "L", "C", "Q", "A", "Z"]
        var complexity = 1

        for command in commands {
            complexity += pathData.components(separatedBy: command).count - 1
        }

        return min(complexity, 10)
    }

    private func estimateTextSize(content: String, fontSize: Double) -> CGSize {
        // Rough estimation - actual implementation would use CoreText
        let avgCharWidth = fontSize * 0.6
        let width = Double(content.count) * avgCharWidth
        return CGSize(width: width, height: fontSize * 1.2)
    }

    private func estimatePathSize(pathData: String) -> CGSize {
        // Simplified path size estimation
        // Real implementation would parse path data
        return CGSize(width: 100, height: 100)
    }

    private func calculateGroupSize(_ childCharacteristics: [ElementCharacteristics]) -> CGSize {
        guard !childCharacteristics.isEmpty else { return CGSize.zero }

        let totalWidth = childCharacteristics.map { $0.size.width }.reduce(0, +)
        let totalHeight = childCharacteristics.map { $0.size.height }.reduce(0, +)

        return CGSize(width: totalWidth, height: totalHeight)
    }
}

// MARK: - Performance History

private class PerformanceHistory {
    private var nativePerformance: [ElementType: Double] = [:]
    private var domPerformance: [ElementType: Double] = [:]
    private let lock = NSLock()

    func getStrategyPreference(for elementType: ElementType) -> (nativePerformance: Double, domPerformance: Double) {
        lock.lock()
        defer { lock.unlock() }

        return (
            nativePerformance: nativePerformance[elementType] ?? 0.5,
            domPerformance: domPerformance[elementType] ?? 0.5
        )
    }

    func updateNativePerformance(for elementType: ElementType, success: Bool) {
        lock.lock()
        defer { lock.unlock() }

        let currentValue = nativePerformance[elementType] ?? 0.5
        let delta = success ? 0.1 : -0.1
        nativePerformance[elementType] = max(0.0, min(1.0, currentValue + delta))
    }

    func updateDOMPerformance(for elementType: ElementType, success: Bool) {
        lock.lock()
        defer { lock.unlock() }

        let currentValue = domPerformance[elementType] ?? 0.5
        let delta = success ? 0.1 : -0.1
        domPerformance[elementType] = max(0.0, min(1.0, currentValue + delta))
    }

    func setStrategyPreference(for elementType: ElementType, strategy: RenderingStrategy) {
        lock.lock()
        defer { lock.unlock() }

        switch strategy {
        case .native:
            nativePerformance[elementType] = 1.0
            domPerformance[elementType] = 0.0
        case .dom:
            nativePerformance[elementType] = 0.0
            domPerformance[elementType] = 1.0
        case .hybrid:
            nativePerformance[elementType] = 0.5
            domPerformance[elementType] = 0.5
        }
    }

    func getOverallStatistics() -> HybridStrategyStatistics {
        lock.lock()
        defer { lock.unlock() }

        let nativeAvg = nativePerformance.values.reduce(0, +) / Double(max(1, nativePerformance.count))
        let domAvg = domPerformance.values.reduce(0, +) / Double(max(1, domPerformance.count))

        return HybridStrategyStatistics(
            nativeSuccessRate: nativeAvg,
            domSuccessRate: domAvg,
            hybridDecisionAccuracy: (nativeAvg + domAvg) / 2.0
        )
    }

    func reset() {
        lock.lock()
        defer { lock.unlock() }

        nativePerformance.removeAll()
        domPerformance.removeAll()
    }
}

// MARK: - Supporting Types

public enum RenderingStrategy: String, CaseIterable {
    case native = "native"     // Use native Canvas/Core Graphics
    case dom = "dom"          // Use DOM/Canvas rendering
    case hybrid = "hybrid"    // Mixed approach based on element
}

public enum ElementType: String, CaseIterable, Hashable {
    case circle = "circle"
    case rectangle = "rectangle"
    case path = "path"
    case text = "text"
    case group = "group"
}

public enum MemoryPressure: String {
    case normal = "normal"
    case warning = "warning"
    case critical = "critical"
}

private struct ElementCharacteristics {
    let type: ElementType
    let size: CGSize
    let complexity: Int          // 1-10 scale
    let isInteractive: Bool
    let hasGradients: Bool
    let hasTransforms: Bool
    let pathComplexity: Int
    let count: Int
}

public struct RenderingDecision {
    let command: D3RenderCommand
    let strategy: RenderingStrategy
    let confidence: Double       // 0.0-1.0
    let reasoning: String
    let fromCache: Bool
}

private class RenderingStrategyResult: NSObject {
    let strategy: RenderingStrategy
    let confidence: Double
    let reasoning: String

    init(strategy: RenderingStrategy, confidence: Double, reasoning: String) {
        self.strategy = strategy
        self.confidence = confidence
        self.reasoning = reasoning
        super.init()
    }
}

public struct HybridRenderResult {
    let nativeResult: RenderResult?
    let domCommands: [[String: Any]]
    let routingDecisions: [RenderingDecision]
    let totalCommands: Int
    let nativeCommandCount: Int
    let domCommandCount: Int
    let analysisDuration: TimeInterval
}

public struct HybridRenderingStatistics {
    let cacheStatistics: HybridCacheStatistics
    let strategyStatistics: HybridStrategyStatistics
    let lastAnalysisDuration: TimeInterval
}

public struct HybridCacheStatistics {
    let totalEntries: Int
    let cacheHitRate: Double
    let memoryPressure: MemoryPressure
}

public struct HybridStrategyStatistics {
    let nativeSuccessRate: Double
    let domSuccessRate: Double
    let hybridDecisionAccuracy: Double
}

// MARK: - Extensions

private extension CGColor {
    var hexString: String? {
        guard let components = components, components.count >= 3 else { return nil }

        let r = Int(components[0] * 255.0)
        let g = Int(components[1] * 255.0)
        let b = Int(components[2] * 255.0)

        return String(format: "#%02X%02X%02X", r, g, b)
    }

    var isGradient: Bool {
        // Simplified - real implementation would check color type
        return false
    }
}

private extension D3RenderCommand {
    var cacheKey: String {
        switch self {
        case .circle(let center, let radius, _, _, _, _):
            return "circle-\(center.x)-\(center.y)-\(radius)"
        case .rectangle(let bounds, _, _, _, _, _):
            return "rectangle-\(bounds.origin.x)-\(bounds.origin.y)-\(bounds.size.width)-\(bounds.size.height)"
        case .text(let content, let position, _, let fontSize, let fontFamily, _, _):
            return "text-\(content.hashValue)-\(position.x)-\(position.y)-\(fontSize)-\(fontFamily)"
        case .path(let pathData, _, _, _, _):
            return "path-\(pathData.hashValue)"
        case .group(let transform, let children, _):
            return "group-\(transform.hashValue)-\(children.count)"
        }
    }
}

// MARK: - Logging

private struct HybridRenderingLogger {
    private let subsystem = "IsometryHybridRendering"
    private let category = "Engine"

    func debug(_ message: String) {
        #if DEBUG
        print("[\(subsystem):\(category)] DEBUG: \(message)")
        #endif
    }

    func info(_ message: String) {
        print("[\(subsystem):\(category)] INFO: \(message)")
    }

    func warning(_ message: String) {
        print("[\(subsystem):\(category)] WARNING: \(message)")
    }

    func error(_ message: String) {
        print("[\(subsystem):\(category)] ERROR: \(message)")
    }
}