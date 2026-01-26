import Foundation
import SwiftUI
import Combine

/// Actor-based data adapter for transforming notebook cards into Canvas-ready visualization data
/// Provides thread-safe data processing with real-time updates and performance optimization
@MainActor
public class CanvasDataAdapter: ObservableObject {
    // MARK: - Published State
    @Published public var networkData: NetworkVisualizationData?
    @Published public var timelineData: TimelineVisualizationData?
    @Published public var hierarchyData: HierarchyVisualizationData?
    @Published public var gridData: GridVisualizationData?
    @Published public var isLoading = false
    @Published public var error: String?

    // MARK: - Data Management
    private let database: IsometryDatabase
    private var notebookCards: [VisualizationNotebookCard] = []
    private var cachedLayouts: [String: Any] = [:]
    private var updateTask: Task<Void, Never>?

    // MARK: - Performance Tracking
    private let dataTransformQueue = DispatchQueue(label: "canvas-data-transform", qos: .userInteractive)
    public var cardCount: Int { notebookCards.count }

    // MARK: - Configuration
    private let maxCards = 1000 // Performance limit for complex visualizations
    private let cacheExpiration: TimeInterval = 300 // 5 minutes

    public init(database: IsometryDatabase) {
        self.database = database
    }

    // MARK: - Initialization

    public func initialize() async {
        isLoading = true
        error = nil

        do {
            notebookCards = try await loadNotebookCards()
            await generateAllVisualizations()
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    public func refreshData() async {
        do {
            let newCards = try await loadNotebookCards()
            if newCards != notebookCards {
                notebookCards = newCards
                clearCaches()
                await generateAllVisualizations()
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Data Loading

    private func loadNotebookCards() async throws -> [VisualizationNotebookCard] {
        let startTime = CACurrentMediaTime()
        defer {
            let duration = CACurrentMediaTime() - startTime
            PerformanceMonitor.shared.recordNotebookCardQuery(duration, operation: "loadNotebookCards")
        }

        // Query the database for actual notebook cards
        let actualCards = try await database.getAllNotebookCards()

        // Convert to visualization format
        let visualizationCards = actualCards.map { card in
            card.visualizationData
        }

        // Limit to performance threshold
        return Array(visualizationCards.prefix(maxCards))
    }

    // MARK: - Visualization Generation

    private func generateAllVisualizations() async {
        updateTask?.cancel()
        updateTask = Task {
            await generateNetworkVisualization()
            await generateTimelineVisualization()
            await generateHierarchyVisualization()
            await generateGridVisualization()
        }
    }

    private func generateNetworkVisualization() async {
        guard !Task.isCancelled else { return }

        let startTime = CACurrentMediaTime()
        defer {
            let duration = CACurrentMediaTime() - startTime
            PerformanceMonitor.shared.recordNotebookCardQuery(duration, operation: "generateNetworkVisualization")
        }

        // Check cache
        let cacheKey = "network_\(notebookCards.count)_\(notebookCards.map(\.modifiedAt).max() ?? Date())"
        if let cached = cachedLayouts[cacheKey] as? NetworkVisualizationData,
           !isCacheExpired(for: cacheKey) {
            networkData = cached
            return
        }

        await dataTransformQueue.run {
            let nodes = self.createNetworkNodes()
            let edges = self.createNetworkEdges(for: nodes)

            // Apply force-directed layout
            let layoutEngine = ForceDirectedLayout()
            let positionedNodes = layoutEngine.calculateLayout(nodes: nodes, edges: edges)

            let visualizationData = NetworkVisualizationData(
                nodes: positionedNodes,
                edges: edges
            )

            DispatchQueue.main.async {
                self.networkData = visualizationData
                self.cachedLayouts[cacheKey] = visualizationData
            }
        }
    }

    private func generateTimelineVisualization() async {
        guard !Task.isCancelled else { return }

        let startTime = CACurrentMediaTime()
        defer {
            let duration = CACurrentMediaTime() - startTime
            PerformanceMonitor.shared.recordNotebookCardQuery(duration, operation: "generateTimelineVisualization")
        }

        await dataTransformQueue.run {
            let events = self.createTimelineEvents()
            let timeRange = self.calculateTimeRange(for: events)

            // Assign tracks to avoid overlaps
            let trackedEvents = self.assignEventTracks(events)

            let visualizationData = TimelineVisualizationData(
                events: trackedEvents,
                timeRange: timeRange
            )

            DispatchQueue.main.async {
                self.timelineData = visualizationData
            }
        }
    }

    private func generateHierarchyVisualization() async {
        guard !Task.isCancelled else { return }

        await dataTransformQueue.run {
            let hierarchyNodes = self.createHierarchyNodes()
            let connections = self.createHierarchyConnections(for: hierarchyNodes)

            // Apply tree layout
            let layoutEngine = TreeLayoutEngine()
            let positionedNodes = layoutEngine.calculateLayout(nodes: hierarchyNodes)

            let visualizationData = HierarchyVisualizationData(
                nodes: positionedNodes,
                connections: connections
            )

            DispatchQueue.main.async {
                self.hierarchyData = visualizationData
            }
        }
    }

    private func generateGridVisualization() async {
        guard !Task.isCancelled else { return }

        await dataTransformQueue.run {
            let gridCells = self.createGridCells()

            let visualizationData = GridVisualizationData(
                cells: gridCells,
                columns: self.calculateGridColumns(),
                rows: self.calculateGridRows()
            )

            DispatchQueue.main.async {
                self.gridData = visualizationData
            }
        }
    }

    // MARK: - Network Visualization Data Creation

    private func createNetworkNodes() -> [NetworkNode] {
        return notebookCards.map { card in
            NetworkNode(
                id: card.id,
                card: card,
                title: card.title,
                cardType: card.cardType,
                position: card.position,
                radius: calculateNodeRadius(for: card),
                priority: card.priority,
                isCompleted: card.isCompleted,
                isSelected: false,
                shouldShowLabel: card.priority > 1 || card.title.count < 20
            )
        }
    }

    private func createNetworkEdges(for nodes: [NetworkNode]) -> [NetworkEdge] {
        var edges: [NetworkEdge] = []

        // Create edges based on card relationships
        for node in nodes {
            // Find related cards based on tags, folder, or content references
            let relatedNodes = findRelatedNodes(for: node, in: nodes)

            for relatedNode in relatedNodes {
                let relationship = determineRelationship(from: node, to: relatedNode)
                let strength = calculateRelationshipStrength(from: node, to: relatedNode)

                let edge = NetworkEdge(
                    id: "\(node.id)-\(relatedNode.id)",
                    startPoint: node.position,
                    endPoint: relatedNode.position,
                    relationship: relationship,
                    strength: strength,
                    isAnimated: relationship == .temporal
                )

                edges.append(edge)
            }
        }

        return edges
    }

    private func findRelatedNodes(for node: NetworkNode, in allNodes: [NetworkNode]) -> [NetworkNode] {
        return allNodes.filter { otherNode in
            guard otherNode.id != node.id else { return false }

            // Check for shared tags
            let sharedTags = Set(node.card.tags).intersection(Set(otherNode.card.tags))
            if !sharedTags.isEmpty { return true }

            // Check for same folder
            if node.card.folder == otherNode.card.folder && node.card.folder != nil { return true }

            // Check for content references (simple text matching)
            if let content = node.card.content,
               content.localizedCaseInsensitiveContains(otherNode.card.title) {
                return true
            }

            // Check for temporal proximity (within 24 hours)
            let timeDifference = abs(node.card.createdAt.timeIntervalSince(otherNode.card.createdAt))
            if timeDifference < 86400 { return true }

            return false
        }
    }

    private func determineRelationship(from nodeA: NetworkNode, to nodeB: NetworkNode) -> EdgeRelationship {
        // Check for shared tags
        let sharedTags = Set(nodeA.card.tags).intersection(Set(nodeB.card.tags))
        if !sharedTags.isEmpty { return .reference }

        // Check for folder hierarchy
        if nodeA.card.folder == nodeB.card.folder { return .hierarchy }

        // Check for temporal relationship
        let timeDifference = abs(nodeA.card.createdAt.timeIntervalSince(nodeB.card.createdAt))
        if timeDifference < 3600 { return .temporal } // Within 1 hour

        // Check for content reference
        if let contentA = nodeA.card.content,
           contentA.localizedCaseInsensitiveContains(nodeB.card.title) {
            return .reference
        }

        return .sequence
    }

    private func calculateRelationshipStrength(from nodeA: NetworkNode, to nodeB: NetworkNode) -> Double {
        var strength: Double = 0.0

        // Shared tags contribute to strength
        let sharedTags = Set(nodeA.card.tags).intersection(Set(nodeB.card.tags))
        strength += Double(sharedTags.count) * 0.2

        // Same folder contributes
        if nodeA.card.folder == nodeB.card.folder { strength += 0.3 }

        // Temporal proximity contributes
        let timeDifference = abs(nodeA.card.createdAt.timeIntervalSince(nodeB.card.createdAt))
        if timeDifference < 86400 { // 24 hours
            strength += max(0, 0.5 - (timeDifference / 86400) * 0.5)
        }

        // Priority similarity contributes
        let priorityDifference = abs(nodeA.priority - nodeB.priority)
        strength += max(0, 0.2 - Double(priorityDifference) * 0.1)

        return min(1.0, strength)
    }

    private func calculateNodeRadius(for card: NotebookCard) -> CGFloat {
        let baseRadius: CGFloat = 15
        let priorityBonus = CGFloat(card.priority) * 2
        let tagBonus = CGFloat(card.tags.count) * 1.5
        let contentBonus = (card.content?.count ?? 0) > 100 ? 3 : 0

        return baseRadius + priorityBonus + tagBonus + CGFloat(contentBonus)
    }

    // MARK: - Timeline Visualization Data Creation

    private func createTimelineEvents() -> [TimelineEvent] {
        return notebookCards.enumerated().map { (index, card) in
            TimelineEvent(
                id: card.id,
                card: card,
                title: card.title,
                timestamp: card.createdAt,
                eventType: determineEventType(for: card),
                trackIndex: index % 5, // Initial track assignment (will be optimized)
                position: CGPoint(x: 0, y: 0) // Will be calculated in layout
            )
        }
    }

    private func determineEventType(for card: NotebookCard) -> TimelineEventType {
        if card.isCompleted { return .completion }
        if card.priority > 2 { return .deadline }
        if card.modifiedAt != card.createdAt { return .modification }
        return .creation
    }

    private func calculateTimeRange(for events: [TimelineEvent]) -> ClosedRange<Date> {
        guard !events.isEmpty else {
            return Date()...Date()
        }

        let timestamps = events.map { $0.timestamp }
        let earliest = timestamps.min()!
        let latest = timestamps.max()!

        // Add padding
        let range = latest.timeIntervalSince(earliest)
        let padding = max(86400, range * 0.1) // At least 1 day or 10% of range

        return earliest.addingTimeInterval(-padding)...latest.addingTimeInterval(padding)
    }

    private func assignEventTracks(_ events: [TimelineEvent]) -> [TimelineEvent] {
        var trackedEvents = events.sorted { $0.timestamp < $1.timestamp }
        var trackEndTimes: [Date] = []

        for i in 0..<trackedEvents.count {
            var assignedTrack = 0

            // Find first available track
            for (trackIndex, endTime) in trackEndTimes.enumerated() {
                if trackedEvents[i].timestamp > endTime.addingTimeInterval(3600) { // 1 hour spacing
                    assignedTrack = trackIndex
                    break
                }
            }

            // If no existing track available, create new one
            if assignedTrack >= trackEndTimes.count {
                trackEndTimes.append(trackedEvents[i].timestamp)
            } else {
                trackEndTimes[assignedTrack] = trackedEvents[i].timestamp
            }

            trackedEvents[i].trackIndex = assignedTrack
        }

        return trackedEvents
    }

    // MARK: - Hierarchy Visualization Data Creation

    private func createHierarchyNodes() -> [HierarchyNode] {
        return notebookCards.map { card in
            HierarchyNode(
                id: card.id,
                card: card,
                title: card.title,
                level: calculateHierarchyLevel(for: card),
                position: CGPoint(x: 0, y: 0), // Will be calculated in layout
                children: [],
                parent: nil
            )
        }
    }

    private func calculateHierarchyLevel(for card: NotebookCard) -> Int {
        // Use priority as hierarchy level
        return max(0, 5 - card.priority)
    }

    private func createHierarchyConnections(for nodes: [HierarchyNode]) -> [HierarchyConnection] {
        var connections: [HierarchyConnection] = []

        // Group nodes by folder to create hierarchical relationships
        let nodesByFolder = Dictionary(grouping: nodes) { $0.card.folder ?? "root" }

        for (_, folderNodes) in nodesByFolder {
            // Create connections within folder based on priority
            let sortedNodes = folderNodes.sorted { $0.level < $1.level }

            for i in 0..<(sortedNodes.count - 1) {
                let parentNode = sortedNodes[i]
                let childNode = sortedNodes[i + 1]

                let connection = HierarchyConnection(
                    id: "\(parentNode.id)-\(childNode.id)",
                    parentPosition: parentNode.position,
                    childPosition: childNode.position
                )

                connections.append(connection)
            }
        }

        return connections
    }

    // MARK: - Grid Visualization Data Creation

    private func createGridCells() -> [VisualizationGridCellData] {
        return notebookCards.enumerated().map { (index, card) in
            let coordinates = calculateGridCoordinates(for: card, index: index)
            return VisualizationGridCellData(
                id: card.id,
                card: card,
                gridX: coordinates.x,
                gridY: coordinates.y
            )
        }
    }

    private func calculateGridCoordinates(for card: VisualizationNotebookCard, index: Int) -> (x: Int, y: Int) {
        // Use priority and creation time to determine grid position
        let priorityX = max(0, card.priority)
        let timeY = Calendar.current.component(.hour, from: card.createdAt) / 4 // 4-hour buckets

        return (x: priorityX, y: timeY)
    }

    private func calculateGridColumns() -> Int {
        let maxPriority = notebookCards.map { $0.priority }.max() ?? 3
        return max(5, maxPriority + 1)
    }

    private func calculateGridRows() -> Int {
        return 6 // 4-hour time buckets = 6 rows per day
    }

    // MARK: - Cache Management

    public func clearCaches() {
        cachedLayouts.removeAll()
    }

    private func isCacheExpired(for key: String) -> Bool {
        // For now, implement simple time-based expiration
        // In production, would track cache timestamps
        return false
    }
}

// MARK: - Supporting Data Structures

public struct NetworkVisualizationData {
    public let nodes: [NetworkNode]
    public let edges: [NetworkEdge]

    public init(nodes: [NetworkNode], edges: [NetworkEdge]) {
        self.nodes = nodes
        self.edges = edges
    }
}

public struct NetworkNode: Identifiable, Equatable {
    public let id: String
    public let card: VisualizationNotebookCard
    public let title: String
    public let cardType: NotebookCardType
    public var position: CGPoint
    public let radius: CGFloat
    public let priority: Int
    public let isCompleted: Bool
    public var isSelected: Bool
    public let shouldShowLabel: Bool

    public static func == (lhs: NetworkNode, rhs: NetworkNode) -> Bool {
        lhs.id == rhs.id
    }
}

public struct NetworkEdge: Identifiable {
    public let id: String
    public let startPoint: CGPoint
    public let endPoint: CGPoint
    public let relationship: EdgeRelationship
    public let strength: Double
    public let isAnimated: Bool
}

public enum EdgeRelationship {
    case reference
    case sequence
    case hierarchy
    case temporal
}

public struct TimelineVisualizationData {
    public let events: [TimelineEvent]
    public let timeRange: ClosedRange<Date>
}

public struct TimelineEvent: Identifiable {
    public let id: String
    public let card: VisualizationNotebookCard
    public let title: String
    public let timestamp: Date
    public let eventType: TimelineEventType
    public var trackIndex: Int
    public var position: CGPoint
}

public enum TimelineEventType {
    case creation
    case modification
    case completion
    case deadline
}

public struct HierarchyVisualizationData {
    public let nodes: [HierarchyNode]
    public let connections: [HierarchyConnection]
}

public struct HierarchyNode: Identifiable {
    public let id: String
    public let card: VisualizationNotebookCard
    public let title: String
    public let level: Int
    public var position: CGPoint
    public var children: [String]
    public var parent: String?
}

public struct HierarchyConnection: Identifiable {
    public let id: String
    public let parentPosition: CGPoint
    public let childPosition: CGPoint
}

public struct GridVisualizationData {
    public let cells: [VisualizationGridCellData]
    public let columns: Int
    public let rows: Int
}

public struct VisualizationGridCellData: Identifiable {
    public let id: String
    public let card: VisualizationNotebookCard
    public let gridX: Int
    public let gridY: Int
}

// MARK: - Extensions for Visualization

extension NotebookCard {
    /// Convert existing NotebookCard to visualization format
    public var visualizationData: VisualizationNotebookCard {
        return VisualizationNotebookCard(
            id: id,
            title: title,
            content: markdownContent,
            cardType: NotebookCardType.from(properties["type"] ?? "note"),
            priority: Int(properties["priority"] ?? "0") ?? 0,
            tags: tags,
            createdAt: createdAt,
            modifiedAt: modifiedAt,
            folder: folder,
            position: extractPosition(),
            isCompleted: properties["status"] == "completed"
        )
    }

    private func extractPosition() -> CGPoint {
        if let xStr = properties["position_x"], let yStr = properties["position_y"],
           let x = Double(xStr), let y = Double(yStr) {
            return CGPoint(x: x, y: y)
        }

        // Fallback to calculated position based on creation time and hash
        let timeOffset = createdAt.timeIntervalSince(Date(timeIntervalSince1970: 0))
        let hashOffset = Double(id.hash)

        return CGPoint(
            x: (timeOffset.remainder(dividingBy: 1000)) * 50,
            y: (hashOffset.remainder(dividingBy: 1000)) * 50
        )
    }
}

// MARK: - Visualization-specific Models

public struct VisualizationNotebookCard: Identifiable, Equatable {
    public let id: String
    public let title: String
    public let content: String?
    public let cardType: NotebookCardType
    public let priority: Int
    public let tags: [String]
    public let createdAt: Date
    public let modifiedAt: Date
    public let folder: String?
    public let position: CGPoint
    public let isCompleted: Bool

    public static func == (lhs: VisualizationNotebookCard, rhs: VisualizationNotebookCard) -> Bool {
        lhs.id == rhs.id && lhs.modifiedAt == rhs.modifiedAt
    }
}

public enum NotebookCardType {
    case note
    case task
    case event
    case location
    case unknown

    static func from(_ typeString: String) -> NotebookCardType {
        switch typeString.lowercased() {
        case "note":
            return .note
        case "task":
            return .task
        case "event":
            return .event
        case "location":
            return .location
        default:
            return .unknown
        }
    }
}

// MARK: - Layout Engines

class ForceDirectedLayout {
    func calculateLayout(nodes: [NetworkNode], edges: [NetworkEdge]) -> [NetworkNode] {
        var layoutNodes = nodes

        // Simple force-directed layout simulation
        let iterations = 50
        let repulsionStrength: CGFloat = 1000
        let attractionStrength: CGFloat = 0.1
        let damping: CGFloat = 0.9

        for _ in 0..<iterations {
            var forces: [CGVector] = Array(repeating: .zero, count: layoutNodes.count)

            // Calculate repulsion forces between all nodes
            for i in 0..<layoutNodes.count {
                for j in (i + 1)..<layoutNodes.count {
                    let delta = CGVector(
                        dx: layoutNodes[j].position.x - layoutNodes[i].position.x,
                        dy: layoutNodes[j].position.y - layoutNodes[i].position.y
                    )

                    let distance = max(1.0, sqrt(delta.dx * delta.dx + delta.dy * delta.dy))
                    let force = repulsionStrength / (distance * distance)

                    let unitVector = CGVector(dx: delta.dx / distance, dy: delta.dy / distance)

                    forces[i].dx -= unitVector.dx * force
                    forces[i].dy -= unitVector.dy * force
                    forces[j].dx += unitVector.dx * force
                    forces[j].dy += unitVector.dy * force
                }
            }

            // Calculate attraction forces along edges
            for edge in edges {
                if let startIndex = layoutNodes.firstIndex(where: { $0.id == edge.id.components(separatedBy: "-").first }),
                   let endIndex = layoutNodes.firstIndex(where: { $0.id == edge.id.components(separatedBy: "-").last }) {

                    let delta = CGVector(
                        dx: layoutNodes[endIndex].position.x - layoutNodes[startIndex].position.x,
                        dy: layoutNodes[endIndex].position.y - layoutNodes[startIndex].position.y
                    )

                    let distance = sqrt(delta.dx * delta.dx + delta.dy * delta.dy)
                    let force = distance * attractionStrength * CGFloat(edge.strength)

                    let unitVector = CGVector(dx: delta.dx / distance, dy: delta.dy / distance)

                    forces[startIndex].dx += unitVector.dx * force
                    forces[startIndex].dy += unitVector.dy * force
                    forces[endIndex].dx -= unitVector.dx * force
                    forces[endIndex].dy -= unitVector.dy * force
                }
            }

            // Apply forces with damping
            for i in 0..<layoutNodes.count {
                layoutNodes[i].position.x += forces[i].dx * damping
                layoutNodes[i].position.y += forces[i].dy * damping
            }
        }

        return layoutNodes
    }
}

class TreeLayoutEngine {
    func calculateLayout(nodes: [HierarchyNode]) -> [HierarchyNode] {
        var layoutNodes = nodes

        // Simple tree layout - arrange by levels
        let nodesByLevel = Dictionary(grouping: layoutNodes, by: { $0.level })
        let maxLevel = nodesByLevel.keys.max() ?? 0

        for level in 0...maxLevel {
            let levelNodes = nodesByLevel[level] ?? []
            let spacing: CGFloat = 150
            let startX: CGFloat = -CGFloat(levelNodes.count - 1) * spacing / 2

            for (index, _) in levelNodes.enumerated() {
                if let nodeIndex = layoutNodes.firstIndex(where: { $0.id == levelNodes[index].id }) {
                    layoutNodes[nodeIndex].position = CGPoint(
                        x: startX + CGFloat(index) * spacing,
                        y: CGFloat(level) * 80
                    )
                }
            }
        }

        return layoutNodes
    }
}

// MARK: - Queue Extension

extension DispatchQueue {
    func run<T>(_ block: @escaping () -> T) async -> T {
        return await withCheckedContinuation { continuation in
            self.async {
                let result = block()
                continuation.resume(returning: result)
            }
        }
    }
}