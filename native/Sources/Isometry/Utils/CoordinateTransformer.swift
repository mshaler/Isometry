import Foundation
import os.signpost

/// High-performance coordinate transformation system for React D3 to native Canvas mapping
/// Handles LATCH axis transformations with LRU caching and precision management
public actor CoordinateTransformer {
    // MARK: - Singleton

    public static let shared = CoordinateTransformer()

    // MARK: - Cache Management

    private var coordinateCache = LRUCache<String, GridCoordinate>(capacity: 1000)
    private var transformationCache = LRUCache<String, TransformationMatrix>(capacity: 100)

    // MARK: - Performance Monitoring

    private var transformationCount: Int64 = 0
    private var cacheHitCount: Int64 = 0
    private var cacheMissCount: Int64 = 0
    private let perfLogger = CoordinateLogger()

    // MARK: - Precision Management

    private let precisionThreshold: Double = 0.001
    private var accumulatedRoundingError: Double = 0.0

    // MARK: - Initialization

    private init() {
        perfLogger.info("CoordinateTransformer initialized with LRU cache capacity: 1000 nodes")
    }

    // MARK: - Batch Coordinate Transformations

    /// Apply batch coordinate transformations from React D3 calculations
    /// Used by PAFVMessageHandler for syncCoordinates bridge messages
    public func applyBatchTransformations(_ transformations: [CoordinateTransformation]) async {
        let startTime = CFAbsoluteTimeGetCurrent()
        perfLogger.debug("Starting batch transformation of \(transformations.count) coordinates")

        for transformation in transformations {
            await applySingleTransformation(transformation)
        }

        let duration = CFAbsoluteTimeGetCurrent() - startTime
        perfLogger.info("Batch transformation completed: \(transformations.count) coordinates in \(String(format: "%.3f", duration))s")
    }

    // MARK: - Single Coordinate Transformation

    /// Transform single React D3 coordinate to native grid position
    private func applySingleTransformation(_ transformation: CoordinateTransformation) async {
        transformationCount += 1

        // Check cache first
        let cacheKey = "\(transformation.nodeId)_\(transformation.d3X)_\(transformation.d3Y)"

        if let cached = coordinateCache.get(cacheKey) {
            cacheHitCount += 1
            perfLogger.debug("Cache hit for node \(transformation.nodeId)")
            return
        }

        // Cache miss - perform transformation
        cacheMissCount += 1
        let gridCoord = await performD3ToGridTransformation(
            d3X: transformation.d3X,
            d3Y: transformation.d3Y,
            nodeId: transformation.nodeId
        )

        // Store in cache
        coordinateCache.set(cacheKey, gridCoord)

        perfLogger.debug("Transformed node \(transformation.nodeId): D3(\(transformation.d3X), \(transformation.d3Y)) -> Grid(\(gridCoord.x), \(gridCoord.y))")
    }

    // MARK: - Core D3 to Grid Transformation

    /// Core transformation logic from React D3 continuous coordinates to discrete grid positions
    private func performD3ToGridTransformation(d3X: Double, d3Y: Double, nodeId: String) async -> GridCoordinate {
        // Handle precision accumulation
        accumulatedRoundingError += (d3X - floor(d3X)) + (d3Y - floor(d3Y))
        if accumulatedRoundingError > precisionThreshold {
            perfLogger.warning("Accumulated rounding error exceeded threshold: \(accumulatedRoundingError)")
            accumulatedRoundingError = 0.0
        }

        // Convert continuous D3 coordinates to discrete grid positions
        // D3 typically uses floating-point pixel coordinates, we need integer grid cells
        let gridX = Int(round(d3X / 120.0)) // 120px = standard cell width
        let gridY = Int(round(d3Y / 80.0))  // 80px = standard cell height

        return GridCoordinate(x: gridX, y: gridY, nodeId: nodeId)
    }

    // MARK: - LATCH Axis Transformations

    /// Transform based on LATCH axis type with specific coordinate calculation rules
    public func transformForLATCHAxis(
        axis: LATCHAxis,
        values: [String],
        index: Int,
        totalCount: Int
    ) async -> GridCoordinate {

        let transformKey = "\(axis.rawValue)_\(values.hashValue)_\(index)_\(totalCount)"

        // Check transformation cache
        if let cachedMatrix = transformationCache.get(transformKey) {
            cacheHitCount += 1
            return GridCoordinate(
                x: Int(cachedMatrix.translateX) + index,
                y: Int(cachedMatrix.translateY),
                nodeId: "latch_\(index)"
            )
        }

        // Perform LATCH-specific transformation
        let coordinate = await calculateLATCHCoordinate(axis: axis, values: values, index: index, totalCount: totalCount)

        // Cache transformation matrix
        let matrix = TransformationMatrix(
            translateX: Double(coordinate.x),
            translateY: Double(coordinate.y),
            scaleX: 1.0,
            scaleY: 1.0
        )
        transformationCache.set(transformKey, matrix)

        cacheMissCount += 1
        return coordinate
    }

    /// Calculate coordinate based on LATCH axis type
    private func calculateLATCHCoordinate(
        axis: LATCHAxis,
        values: [String],
        index: Int,
        totalCount: Int
    ) async -> GridCoordinate {

        switch axis {
        case .time:
            return await calculateTimeCoordinate(values: values, index: index, totalCount: totalCount)

        case .category:
            return await calculateCategoryCoordinate(values: values, index: index, totalCount: totalCount)

        case .hierarchy:
            return await calculateHierarchyCoordinate(values: values, index: index, totalCount: totalCount)

        case .location:
            return await calculateLocationCoordinate(values: values, index: index, totalCount: totalCount)

        case .alphabet:
            return await calculateAlphabetCoordinate(values: values, index: index, totalCount: totalCount)
        }
    }

    // MARK: - LATCH-Specific Coordinate Calculations

    private func calculateTimeCoordinate(values: [String], index: Int, totalCount: Int) async -> GridCoordinate {
        // Time: chronological ordering with date-based spacing
        let dateFormatter = ISO8601DateFormatter()

        // Try to parse as date, fallback to chronological index
        if let firstValue = values.first,
           let date = dateFormatter.date(from: firstValue) {
            let calendar = Calendar.current
            let year = calendar.component(.year, from: date)
            let month = calendar.component(.month, from: date)

            // Use year as major X coordinate, month as minor offset
            let x = (year - 2020) * 12 + month
            return GridCoordinate(x: x, y: index / 10, nodeId: "time_\(index)")
        }

        // Fallback: chronological spacing
        return GridCoordinate(x: index, y: 0, nodeId: "time_\(index)")
    }

    private func calculateCategoryCoordinate(values: [String], index: Int, totalCount: Int) async -> GridCoordinate {
        // Category: categorical clusters with alphabetical sub-ordering
        let categoryHash = values.joined().hash
        let clusterX = abs(categoryHash) % 20  // 20 category columns max

        // Sub-ordering within cluster
        let sortedValues = values.sorted()
        let alphabeticalIndex = sortedValues.firstIndex(of: values.first ?? "") ?? 0

        return GridCoordinate(x: clusterX, y: alphabeticalIndex, nodeId: "category_\(index)")
    }

    private func calculateHierarchyCoordinate(values: [String], index: Int, totalCount: Int) async -> GridCoordinate {
        // Hierarchy: priority-based vertical positioning
        let priorityValue = extractPriorityFromValues(values)

        // High priority items go toward top-left (lower Y values)
        let hierarchyY = max(0, 10 - priorityValue)
        let hierarchyX = index / 10  // Horizontal distribution

        return GridCoordinate(x: hierarchyX, y: hierarchyY, nodeId: "hierarchy_\(index)")
    }

    private func calculateLocationCoordinate(values: [String], index: Int, totalCount: Int) async -> GridCoordinate {
        // Location: standard lexicographic sorting with geographic clustering
        let locationHash = values.joined().hash

        // Use hash to create geographic-like clustering
        let geoX = abs(locationHash) % 15
        let geoY = abs(locationHash / 15) % 10

        return GridCoordinate(x: geoX, y: geoY, nodeId: "location_\(index)")
    }

    private func calculateAlphabetCoordinate(values: [String], index: Int, totalCount: Int) async -> GridCoordinate {
        // Alphabet: lexicographic ordering
        guard let firstValue = values.first, let firstChar = firstValue.first else {
            return GridCoordinate(x: index % 26, y: index / 26, nodeId: "alphabet_\(index)")
        }

        let alphabetIndex = Int(firstChar.lowercased().unicodeScalars.first?.value ?? 97) - 97
        let row = alphabetIndex / 26
        let col = alphabetIndex % 26

        return GridCoordinate(x: col, y: row, nodeId: "alphabet_\(index)")
    }

    // MARK: - Helper Methods

    private func extractPriorityFromValues(_ values: [String]) -> Int {
        // Look for priority indicators in values
        for value in values {
            if value.lowercased().contains("high") || value.lowercased().contains("urgent") {
                return 10
            } else if value.lowercased().contains("medium") || value.lowercased().contains("normal") {
                return 5
            } else if value.lowercased().contains("low") {
                return 1
            }

            // Try to extract numeric priority (P1, P2, etc.)
            let numericPattern = try? NSRegularExpression(pattern: "p?(\\d+)", options: .caseInsensitive)
            if let match = numericPattern?.firstMatch(in: value, range: NSRange(location: 0, length: value.count)),
               let range = Range(match.range(at: 1), in: value) {
                if let priority = Int(String(value[range])) {
                    return max(1, 11 - priority)  // P1 = 10, P2 = 9, etc.
                }
            }
        }

        return 5  // Default medium priority
    }

    // MARK: - Viewport Transform Application

    /// Apply ViewConfig viewport transforms for coordinate consistency
    public func applyViewportTransform(
        coordinate: GridCoordinate,
        zoomLevel: Double,
        panOffsetX: Double,
        panOffsetY: Double
    ) async -> GridCoordinate {

        let transformedX = Int((Double(coordinate.x) * zoomLevel) + panOffsetX)
        let transformedY = Int((Double(coordinate.y) * zoomLevel) + panOffsetY)

        return GridCoordinate(
            x: transformedX,
            y: transformedY,
            nodeId: coordinate.nodeId
        )
    }

    // MARK: - Coordinate Validation and Precision

    /// Validate coordinate precision and log warnings for significant rounding errors
    public func validateCoordinatePrecision(_ coordinate: GridCoordinate, originalD3: (x: Double, y: Double)) async -> Bool {
        let reconstructedX = Double(coordinate.x) * 120.0
        let reconstructedY = Double(coordinate.y) * 80.0

        let errorX = abs(reconstructedX - originalD3.x)
        let errorY = abs(reconstructedY - originalD3.y)

        if errorX > 60.0 || errorY > 40.0 {  // More than half a cell size
            perfLogger.warning("Significant rounding error for node \(coordinate.nodeId): X error=\(errorX), Y error=\(errorY)")
            return false
        }

        return true
    }

    // MARK: - Cache Management

    /// Clear coordinate cache to free memory
    public func clearCache() async {
        coordinateCache.removeAll()
        transformationCache.removeAll()
        perfLogger.info("Coordinate transformation cache cleared")
    }

    /// Get cache statistics for performance monitoring
    public func getCacheStats() async -> CoordinateCacheStats {
        let hitRate = cacheHitCount > 0 ? Double(cacheHitCount) / Double(cacheHitCount + cacheMissCount) : 0.0

        return CoordinateCacheStats(
            coordinateCacheSize: coordinateCache.count,
            transformationCacheSize: transformationCache.count,
            totalTransformations: transformationCount,
            cacheHitRate: hitRate,
            accumulatedRoundingError: accumulatedRoundingError
        )
    }
}

// MARK: - Supporting Types

public struct GridCoordinate: Hashable {
    public let x: Int
    public let y: Int
    public let nodeId: String

    public init(x: Int, y: Int, nodeId: String) {
        self.x = x
        self.y = y
        self.nodeId = nodeId
    }
}

struct TransformationMatrix {
    let translateX: Double
    let translateY: Double
    let scaleX: Double
    let scaleY: Double
}

public struct CoordinateCacheStats {
    public let coordinateCacheSize: Int
    public let transformationCacheSize: Int
    public let totalTransformations: Int64
    public let cacheHitRate: Double
    public let accumulatedRoundingError: Double
}

/// LATCH axis enumeration for transformation logic
public enum LATCHAxis: String, CaseIterable {
    case location = "location"
    case alphabet = "alphabet"
    case time = "time"
    case category = "category"
    case hierarchy = "hierarchy"

    /// Legacy abbreviation support
    public static func from(_ abbreviation: String) -> LATCHAxis? {
        switch abbreviation.uppercased() {
        case "L": return .location
        case "A": return .alphabet
        case "T": return .time
        case "C": return .category
        case "H": return .hierarchy
        default: return LATCHAxis(rawValue: abbreviation.lowercased())
        }
    }
}

// MARK: - LRU Cache Implementation

/// Memory-efficient LRU cache for coordinate calculations
class LRUCache<Key: Hashable, Value> {
    private var cache: [Key: CacheNode<Key, Value>] = [:]
    private var head: CacheNode<Key, Value>?
    private var tail: CacheNode<Key, Value>?
    private let capacity: Int

    var count: Int { cache.count }

    init(capacity: Int) {
        self.capacity = capacity
    }

    func get(_ key: Key) -> Value? {
        guard let node = cache[key] else { return nil }

        // Move to front (most recently used)
        moveToFront(node)
        return node.value
    }

    func set(_ key: Key, _ value: Value) {
        if let existingNode = cache[key] {
            existingNode.value = value
            moveToFront(existingNode)
            return
        }

        let newNode = CacheNode(key: key, value: value)
        cache[key] = newNode

        if head == nil {
            head = newNode
            tail = newNode
        } else {
            newNode.next = head
            head?.prev = newNode
            head = newNode
        }

        if cache.count > capacity {
            removeLRU()
        }
    }

    func removeAll() {
        cache.removeAll()
        head = nil
        tail = nil
    }

    private func moveToFront(_ node: CacheNode<Key, Value>) {
        guard node !== head else { return }

        // Remove from current position
        if node === tail {
            tail = node.prev
            tail?.next = nil
        } else {
            node.prev?.next = node.next
            node.next?.prev = node.prev
        }

        // Move to front
        node.prev = nil
        node.next = head
        head?.prev = node
        head = node
    }

    private func removeLRU() {
        guard let lru = tail else { return }

        cache.removeValue(forKey: lru.key)

        if lru === head {
            head = nil
            tail = nil
        } else {
            tail = lru.prev
            tail?.next = nil
        }
    }
}

class CacheNode<Key: Hashable, Value> {
    let key: Key
    var value: Value
    var prev: CacheNode<Key, Value>?
    var next: CacheNode<Key, Value>?

    init(key: Key, value: Value) {
        self.key = key
        self.value = value
    }
}

// MARK: - Coordinate Logger

struct CoordinateLogger {
    private let subsystem = "IsometryCoordinates"
    private let category = "Transformer"

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