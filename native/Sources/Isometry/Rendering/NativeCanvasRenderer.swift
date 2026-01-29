import Foundation
import CoreGraphics
import SwiftUI
import QuartzCore
import OSLog

/// Native Canvas renderer using Core Graphics for high-performance D3 visualization rendering
/// Provides actor-based thread-safe rendering with GPU acceleration hints and memory optimization
public actor NativeCanvasRenderer {
    // MARK: - Properties

    private let logger = CanvasLogger()
    private var currentViewport: D3Viewport?
    private var renderCache: RenderCache = RenderCache()
    private let perfMonitor = CanvasPerformanceMonitor()

    // MARK: - Rendering Context

    private var contextSize: CGSize = CGSize(width: 800, height: 600)
    private var transform: CGAffineTransform = .identity

    // MARK: - Memory Management

    private let maxCachedRenderCommands = 1000
    private let maxMemoryUsage: Int = 100 * 1024 * 1024 // 100MB

    // MARK: - Initialization

    public init() {
        logger.info("NativeCanvasRenderer initialized with Core Graphics backend")
    }

    // MARK: - Public Interface

    /// Main render method - executes array of D3 render commands
    public func render(commands: [D3RenderCommand], viewport: D3Viewport?) async throws -> RenderResult {
        let renderStartTime = CFAbsoluteTimeGetCurrent()
        let renderId = perfMonitor.startRender()

        defer {
            perfMonitor.endRender(renderId, startTime: renderStartTime)
        }

        // Update viewport if provided
        if let viewport = viewport {
            await updateViewport(viewport)
        }

        guard !commands.isEmpty else {
            return RenderResult(
                primitiveCount: 0,
                renderTime: 0,
                memoryUsage: getCurrentMemoryUsage()
            )
        }

        // Check memory usage and clean cache if needed
        await cleanCacheIfNeeded()

        // Execute rendering pipeline
        let renderResult = try await executeRenderPipeline(commands)

        logger.debug("Rendered \(commands.count) commands, \(renderResult.primitiveCount) primitives in \(renderResult.renderTime * 1000)ms")

        return renderResult
    }

    /// Update viewport transformation matrix
    public func updateViewport(_ viewport: D3Viewport) async {
        currentViewport = viewport
        contextSize = CGSize(width: viewport.width, height: viewport.height)

        // Create transformation matrix for viewport
        transform = CGAffineTransform.identity
        transform = transform.translatedBy(x: -viewport.x, y: -viewport.y)
        transform = transform.scaledBy(x: viewport.scale, y: viewport.scale)

        logger.debug("Viewport updated: \(viewport)")
    }

    /// Query native rendering capabilities
    public func getCapabilities() async -> CanvasCapabilities {
        return CanvasCapabilities(
            nativeRenderingAvailable: true,
            supportedShapes: [
                "circle", "rectangle", "path", "text", "group"
            ],
            maxRenderCommands: maxCachedRenderCommands,
            supportsGradients: true,
            supportsTextMetrics: true,
            platform: platformString
        )
    }

    // MARK: - Render Pipeline

    private func executeRenderPipeline(_ commands: [D3RenderCommand]) async throws -> RenderResult {
        let startTime = CFAbsoluteTimeGetCurrent()
        var primitiveCount = 0

        // Create render context
        let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
        let bitmapInfo = CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedFirst.rawValue)

        guard let context = CGContext(
            data: nil,
            width: Int(contextSize.width),
            height: Int(contextSize.height),
            bitsPerComponent: 8,
            bytesPerRow: 4 * Int(contextSize.width),
            space: colorSpace,
            bitmapInfo: bitmapInfo
        ) else {
            throw CanvasRenderError.contextCreationFailed
        }

        // Configure rendering context
        configureContext(context)

        // Batch render commands for optimal performance
        let batches = batchCommands(commands)

        for batch in batches {
            primitiveCount += try await renderBatch(batch, in: context)
        }

        // Cache result if beneficial
        if shouldCacheResult(commands) {
            await cacheRenderResult(commands, context: context)
        }

        let renderTime = CFAbsoluteTimeGetCurrent() - startTime

        return RenderResult(
            primitiveCount: primitiveCount,
            renderTime: renderTime,
            memoryUsage: getCurrentMemoryUsage()
        )
    }

    private func configureContext(_ context: CGContext) {
        // Set high-quality rendering options
        context.setAllowsAntialiasing(true)
        context.setShouldAntialias(true)
        context.setAllowsFontSmoothing(true)
        context.setShouldSmoothFonts(true)
        context.interpolationQuality = .high

        // Apply viewport transformation
        context.concatenate(transform)

        // Clear background
        context.setFillColor(CGColor.white)
        context.fill(CGRect(origin: .zero, size: contextSize))
    }

    private func batchCommands(_ commands: [D3RenderCommand]) -> [[D3RenderCommand]] {
        // Group commands by type for optimal rendering
        var batches: [[D3RenderCommand]] = []
        var currentBatch: [D3RenderCommand] = []
        var lastCommandType: String?

        for command in commands {
            let commandType = command.type

            if lastCommandType != nil && lastCommandType != commandType {
                // Start new batch when command type changes
                if !currentBatch.isEmpty {
                    batches.append(currentBatch)
                    currentBatch = []
                }
            }

            currentBatch.append(command)
            lastCommandType = commandType
        }

        if !currentBatch.isEmpty {
            batches.append(currentBatch)
        }

        return batches
    }

    private func renderBatch(_ batch: [D3RenderCommand], in context: CGContext) async throws -> Int {
        var primitiveCount = 0

        for command in batch {
            primitiveCount += try await renderCommand(command, in: context)
        }

        return primitiveCount
    }

    private func renderCommand(_ command: D3RenderCommand, in context: CGContext) async throws -> Int {
        context.saveGState()
        defer { context.restoreGState() }

        // Set opacity for the command
        context.setAlpha(command.opacity)

        switch command {
        case .circle(let center, let radius, let fill, let stroke, let strokeWidth, _):
            try renderCircle(center: center, radius: radius, fill: fill, stroke: stroke, strokeWidth: strokeWidth, in: context)
            return 1

        case .rectangle(let bounds, let fill, let stroke, let strokeWidth, let cornerRadius, _):
            try renderRectangle(bounds: bounds, fill: fill, stroke: stroke, strokeWidth: strokeWidth, cornerRadius: cornerRadius, in: context)
            return 1

        case .path(let pathData, let fill, let stroke, let strokeWidth, _):
            try renderPath(pathData: pathData, fill: fill, stroke: stroke, strokeWidth: strokeWidth, in: context)
            return 1

        case .text(let content, let position, let color, let fontSize, let fontFamily, let alignment, _):
            try renderText(content: content, position: position, color: color, fontSize: fontSize, fontFamily: fontFamily, alignment: alignment, in: context)
            return 1

        case .group(let groupTransform, let children, _):
            context.saveGState()
            context.concatenate(groupTransform)

            var groupPrimitives = 0
            for child in children {
                groupPrimitives += try await renderCommand(child, in: context)
            }

            context.restoreGState()
            return groupPrimitives
        }
    }

    // MARK: - Shape Rendering

    private func renderCircle(center: CGPoint, radius: Double, fill: CGColor?, stroke: CGColor?, strokeWidth: Double, in context: CGContext) throws {
        let rect = CGRect(
            x: center.x - radius,
            y: center.y - radius,
            width: radius * 2,
            height: radius * 2
        )

        if let fill = fill {
            context.setFillColor(fill)
            context.fillEllipse(in: rect)
        }

        if let stroke = stroke, strokeWidth > 0 {
            context.setStrokeColor(stroke)
            context.setLineWidth(strokeWidth)
            context.strokeEllipse(in: rect)
        }
    }

    private func renderRectangle(bounds: CGRect, fill: CGColor?, stroke: CGColor?, strokeWidth: Double, cornerRadius: Double, in context: CGContext) throws {
        let path: CGPath

        if cornerRadius > 0 {
            path = CGPath(roundedRect: bounds, cornerWidth: cornerRadius, cornerHeight: cornerRadius, transform: nil)
        } else {
            path = CGPath(rect: bounds, transform: nil)
        }

        if let fill = fill {
            context.setFillColor(fill)
            context.addPath(path)
            context.fillPath()
        }

        if let stroke = stroke, strokeWidth > 0 {
            context.setStrokeColor(stroke)
            context.setLineWidth(strokeWidth)
            context.addPath(path)
            context.strokePath()
        }
    }

    private func renderPath(pathData: String, fill: CGColor?, stroke: CGColor?, strokeWidth: Double, in context: CGContext) throws {
        let path = try SVGPathParser.parse(pathData)

        if let fill = fill {
            context.setFillColor(fill)
            context.addPath(path)
            context.fillPath()
        }

        if let stroke = stroke, strokeWidth > 0 {
            context.setStrokeColor(stroke)
            context.setLineWidth(strokeWidth)
            context.addPath(path)
            context.strokePath()
        }
    }

    private func renderText(content: String, position: CGPoint, color: CGColor, fontSize: Double, fontFamily: String, alignment: TextAlignment, in context: CGContext) throws {
        // Create attributed string
        let attributes: [NSAttributedString.Key: Any] = [
            .foregroundColor: color,
            .font: createFont(family: fontFamily, size: fontSize)
        ]

        let attributedString = NSAttributedString(string: content, attributes: attributes)

        // Calculate text metrics
        let textSize = attributedString.boundingRect(
            with: CGSize(width: CGFloat.greatestFiniteMagnitude, height: fontSize * 2),
            options: [.usesLineFragmentOrigin, .usesFontLeading],
            context: nil
        ).size

        // Adjust position based on alignment
        var drawPosition = position
        switch alignment {
        case .center:
            drawPosition.x -= textSize.width / 2
        case .right:
            drawPosition.x -= textSize.width
        case .left:
            break
        }

        // Draw text
        let textRect = CGRect(origin: drawPosition, size: textSize)

        #if os(iOS)
        UIGraphicsPushContext(context)
        attributedString.draw(in: textRect)
        UIGraphicsPopContext()
        #else
        let graphicsContext = NSGraphicsContext(cgContext: context, flipped: true)
        let previousContext = NSGraphicsContext.current
        NSGraphicsContext.current = graphicsContext

        attributedString.draw(in: textRect)

        NSGraphicsContext.current = previousContext
        #endif
    }

    private func createFont(family: String, size: Double) -> Any {
        #if os(iOS)
        return UIFont(name: family, size: size) ?? UIFont.systemFont(ofSize: size)
        #else
        return NSFont(name: family, size: size) ?? NSFont.systemFont(ofSize: size)
        #endif
    }

    // MARK: - Caching

    private func shouldCacheResult(_ commands: [D3RenderCommand]) -> Bool {
        return commands.count > 10 && getCurrentMemoryUsage() < maxMemoryUsage
    }

    private func cacheRenderResult(_ commands: [D3RenderCommand], context: CGContext) async {
        guard let image = context.makeImage() else { return }

        let cacheKey = generateCacheKey(commands)
        await renderCache.store(key: cacheKey, image: image)

        logger.debug("Cached render result for \(commands.count) commands")
    }

    private func generateCacheKey(_ commands: [D3RenderCommand]) -> String {
        let commandDescriptions = commands.map { $0.type }
        let viewportKey = currentViewport.map { "v\($0.x)\($0.y)\($0.width)\($0.height)\($0.scale)" } ?? "noviewport"
        return "\(commandDescriptions.joined(separator:"-"))-\(viewportKey)"
    }

    private func cleanCacheIfNeeded() async {
        let currentMemory = getCurrentMemoryUsage()
        if currentMemory > maxMemoryUsage {
            await renderCache.evictOldest()
            logger.debug("Cache cleaned due to memory pressure: \(currentMemory) bytes")
        }
    }

    private func getCurrentMemoryUsage() -> Int {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4

        let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }

        if kerr == KERN_SUCCESS {
            return Int(info.resident_size)
        } else {
            return 0
        }
    }

    private var platformString: String {
        #if os(iOS)
        return "iOS"
        #else
        return "macOS"
        #endif
    }
}

// MARK: - D3 Render Command Protocol

public enum D3RenderCommand {
    case circle(center: CGPoint, radius: Double, fill: CGColor?, stroke: CGColor?, strokeWidth: Double, opacity: Double)
    case rectangle(bounds: CGRect, fill: CGColor?, stroke: CGColor?, strokeWidth: Double, cornerRadius: Double, opacity: Double)
    case path(pathData: String, fill: CGColor?, stroke: CGColor?, strokeWidth: Double, opacity: Double)
    case text(content: String, position: CGPoint, color: CGColor, fontSize: Double, fontFamily: String, alignment: TextAlignment, opacity: Double)
    case group(transform: CGAffineTransform, children: [D3RenderCommand], opacity: Double)

    public var type: String {
        switch self {
        case .circle: return "circle"
        case .rectangle: return "rectangle"
        case .path: return "path"
        case .text: return "text"
        case .group: return "group"
        }
    }

    public var opacity: Double {
        switch self {
        case .circle(_, _, _, _, _, let opacity): return opacity
        case .rectangle(_, _, _, _, _, let opacity): return opacity
        case .path(_, _, _, _, let opacity): return opacity
        case .text(_, _, _, _, _, _, let opacity): return opacity
        case .group(_, _, let opacity): return opacity
        }
    }
}

// MARK: - Supporting Types

public struct CanvasCapabilities {
    let nativeRenderingAvailable: Bool
    let supportedShapes: [String]
    let maxRenderCommands: Int
    let supportsGradients: Bool
    let supportsTextMetrics: Bool
    let platform: String
}

public struct RenderResult {
    let primitiveCount: Int
    let renderTime: TimeInterval
    let memoryUsage: Int
}

// MARK: - SVG Path Parser

enum SVGPathParser {
    static func parse(_ pathData: String) throws -> CGPath {
        // Simplified SVG path parser for basic shapes
        // In production, would use a full SVG parser library
        let mutablePath = CGMutablePath()

        let commands = pathData.split(separator: " ")
        var currentPoint = CGPoint.zero

        var i = 0
        while i < commands.count {
            let command = String(commands[i])

            switch command.uppercased() {
            case "M": // Move to
                if i + 2 < commands.count {
                    let x = Double(commands[i + 1]) ?? 0
                    let y = Double(commands[i + 2]) ?? 0
                    currentPoint = CGPoint(x: x, y: y)
                    mutablePath.move(to: currentPoint)
                    i += 3
                } else {
                    i += 1
                }

            case "L": // Line to
                if i + 2 < commands.count {
                    let x = Double(commands[i + 1]) ?? 0
                    let y = Double(commands[i + 2]) ?? 0
                    currentPoint = CGPoint(x: x, y: y)
                    mutablePath.addLine(to: currentPoint)
                    i += 3
                } else {
                    i += 1
                }

            case "C": // Cubic curve
                if i + 6 < commands.count {
                    let cp1x = Double(commands[i + 1]) ?? 0
                    let cp1y = Double(commands[i + 2]) ?? 0
                    let cp2x = Double(commands[i + 3]) ?? 0
                    let cp2y = Double(commands[i + 4]) ?? 0
                    let x = Double(commands[i + 5]) ?? 0
                    let y = Double(commands[i + 6]) ?? 0

                    currentPoint = CGPoint(x: x, y: y)
                    mutablePath.addCurve(
                        to: currentPoint,
                        control1: CGPoint(x: cp1x, y: cp1y),
                        control2: CGPoint(x: cp2x, y: cp2y)
                    )
                    i += 7
                } else {
                    i += 1
                }

            case "Z": // Close path
                mutablePath.closeSubpath()
                i += 1

            default:
                i += 1
            }
        }

        return mutablePath
    }
}

// MARK: - Render Cache

actor RenderCache {
    private var cache: [String: CGImage] = [:]
    private var accessOrder: [String] = []
    private let maxCacheSize = 50

    func store(key: String, image: CGImage) {
        cache[key] = image

        // Update access order
        if let existingIndex = accessOrder.firstIndex(of: key) {
            accessOrder.remove(at: existingIndex)
        }
        accessOrder.append(key)

        // Evict if over capacity
        while accessOrder.count > maxCacheSize {
            let evictKey = accessOrder.removeFirst()
            cache.removeValue(forKey: evictKey)
        }
    }

    func retrieve(key: String) -> CGImage? {
        guard let image = cache[key] else { return nil }

        // Update access order
        if let existingIndex = accessOrder.firstIndex(of: key) {
            accessOrder.remove(at: existingIndex)
            accessOrder.append(key)
        }

        return image
    }

    func evictOldest() {
        guard !accessOrder.isEmpty else { return }

        let evictKey = accessOrder.removeFirst()
        cache.removeValue(forKey: evictKey)
    }
}

// MARK: - Performance Monitoring

class CanvasPerformanceMonitor {
    private var renderCount: Int64 = 0
    private var totalRenderTime: TimeInterval = 0
    private var primitiveCount: Int64 = 0

    private let lock = NSLock()

    func startRender() -> UUID {
        return UUID()
    }

    func endRender(_ id: UUID, startTime: CFAbsoluteTime) {
        let duration = CFAbsoluteTimeGetCurrent() - startTime

        lock.lock()
        renderCount += 1
        totalRenderTime += duration
        lock.unlock()
    }

    func recordPrimitives(_ count: Int) {
        lock.lock()
        primitiveCount += Int64(count)
        lock.unlock()
    }

    func getStats() -> CanvasPerformanceStats {
        lock.lock()
        defer { lock.unlock() }

        let avgRenderTime = renderCount > 0 ? totalRenderTime / TimeInterval(renderCount) : 0

        return CanvasPerformanceStats(
            renderCount: renderCount,
            averageRenderTime: avgRenderTime,
            totalPrimitives: primitiveCount
        )
    }
}

public struct CanvasPerformanceStats {
    let renderCount: Int64
    let averageRenderTime: TimeInterval
    let totalPrimitives: Int64
}

// MARK: - Errors

enum CanvasRenderError: Error, LocalizedError {
    case contextCreationFailed
    case pathParsingFailed(String)
    case memoryLimitExceeded
    case renderingInterrupted

    var errorDescription: String? {
        switch self {
        case .contextCreationFailed:
            return "Failed to create graphics context"
        case .pathParsingFailed(let path):
            return "Failed to parse SVG path: \(path)"
        case .memoryLimitExceeded:
            return "Memory limit exceeded during rendering"
        case .renderingInterrupted:
            return "Rendering was interrupted"
        }
    }
}

// MARK: - Logging

struct CanvasLogger {
    private let subsystem = "IsometryCanvas"
    private let category = "Renderer"

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

// MARK: - Extensions