import Foundation
import SwiftUI

/// View model for SuperGrid - manages state and data loading
/// Equivalent to React state management (PAFVContext + FilterContext)
@MainActor
public class SuperGridViewModel: ObservableObject {
    // MARK: - Published State
    @Published public var nodes: [GridCellData] = []
    @Published public var currentConfig: ViewConfig
    @Published public var currentViewType: ViewType = .grid
    @Published public var isLoading = false
    @Published public var error: String?

    // MARK: - Filter State
    @Published public var hasActiveFilters = false
    @Published public var filterPresets: [FilterPreset] = []

    // MARK: - Private Properties
    private var database: IsometryDatabase?
    private var allNodes: [Node] = []

    // MARK: - Initialization
    public init() {
        // Default configuration - equivalent to React initial state
        self.currentConfig = ViewConfig(
            name: "Default View",
            isDefault: true,
            originPattern: "anchor",
            xAxisMapping: "time",
            yAxisMapping: "category",
            zoomLevel: 1.0,
            panOffsetX: 0.0,
            panOffsetY: 0.0
        )
    }

    // MARK: - Initialization
    public func initialize(database: IsometryDatabase?) async {
        guard let database else { return }
        self.database = database

        isLoading = true
        error = nil

        do {
            // Load all nodes (equivalent to SQLite query in React)
            allNodes = try await database.getAllNodes()

            // Load saved view configurations
            await loadViewConfigs()

            // Load filter presets
            await loadFilterPresets()

            // Generate grid data
            await updateGridData()

        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - View Configuration Management
    public func updateOriginPattern(_ pattern: String) {
        currentConfig.originPattern = pattern
        currentConfig.modifiedAt = Date()
        Task {
            await updateGridData()
            await saveViewConfig()
        }
    }

    public func updateAxisMapping(x: String, y: String) {
        currentConfig.xAxisMapping = x
        currentConfig.yAxisMapping = y
        currentConfig.modifiedAt = Date()
        Task {
            await updateGridData()
            await saveViewConfig()
        }
    }

    public func zoomIn() {
        currentConfig.zoomLevel = min(currentConfig.zoomLevel * 1.2, 5.0)
        currentConfig.modifiedAt = Date()
        Task {
            await saveViewConfig()
        }
    }

    public func zoomOut() {
        currentConfig.zoomLevel = max(currentConfig.zoomLevel / 1.2, 0.1)
        currentConfig.modifiedAt = Date()
        Task {
            await saveViewConfig()
        }
    }

    // MARK: - Filter Management
    public func applyFilter(_ preset: FilterPreset) {
        currentConfig.filterConfig = preset.filterConfig
        hasActiveFilters = preset.filterConfig != "{}"

        Task {
            await updateGridData()
            await incrementPresetUsage(preset)
        }
    }

    public func clearFilters() {
        currentConfig.filterConfig = nil
        hasActiveFilters = false

        Task {
            await updateGridData()
        }
    }

    // MARK: - Data Loading
    private func updateGridData() async {
        guard !allNodes.isEmpty else {
            nodes = []
            return
        }

        // Filter nodes based on current filter config
        let filteredNodes = await applyCurrentFilters(to: allNodes)

        // Convert to grid coordinates based on axis mapping
        let gridData = await convertToGridData(filteredNodes)

        nodes = gridData
    }

    private func applyCurrentFilters(to nodes: [Node]) async -> [Node] {
        guard let filterConfig = currentConfig.filterConfig,
              !filterConfig.isEmpty,
              filterConfig != "{}" else {
            return nodes
        }

        // Parse filter configuration (equivalent to React FilterContext)
        guard let data = filterConfig.data(using: .utf8),
              let config = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nodes
        }

        var filtered = nodes

        // Apply category filter
        if let categoryFilter = config["category"] as? [String], !categoryFilter.isEmpty {
            filtered = filtered.filter { node in
                categoryFilter.contains(node.folder ?? "")
            }
        }

        // Apply time filter
        if let timeRange = config["timeRange"] as? [String: Any],
           let startString = timeRange["start"] as? String,
           let endString = timeRange["end"] as? String,
           let startDate = ISO8601DateFormatter().date(from: startString),
           let endDate = ISO8601DateFormatter().date(from: endString) {
            filtered = filtered.filter { node in
                node.modifiedAt >= startDate && node.modifiedAt <= endDate
            }
        }

        // Apply priority filter
        if let priorityFilter = config["priority"] as? [Int], !priorityFilter.isEmpty {
            filtered = filtered.filter { node in
                priorityFilter.contains(node.priority)
            }
        }

        // Apply full-text search
        if let searchText = config["search"] as? String, !searchText.isEmpty {
            // Use database FTS5 for search (equivalent to React FTS5 implementation)
            if let database = database {
                do {
                    filtered = try await database.searchNodes(query: searchText)
                } catch {
                    // Fallback to local text search
                    filtered = filtered.filter { node in
                        node.name.localizedCaseInsensitiveContains(searchText) ||
                        (node.content?.localizedCaseInsensitiveContains(searchText) ?? false)
                    }
                }
            }
        }

        return filtered
    }

    private func convertToGridData(_ nodes: [Node]) async -> [GridCellData] {
        var gridData: [GridCellData] = []

        for (index, node) in nodes.enumerated() {
            let coordinates = calculateGridCoordinates(for: node, index: index)
            gridData.append(GridCellData(
                node: node,
                x: coordinates.x,
                y: coordinates.y
            ))
        }

        return gridData
    }

    private func calculateGridCoordinates(for node: Node, index: Int) -> (x: Int, y: Int) {
        // Calculate grid position based on axis mapping
        // Equivalent to React coordinate calculation logic

        let x: Int
        let y: Int

        // X-axis calculation
        switch currentConfig.xAxisMapping {
        case "time":
            // Group by month/week/day depending on data density
            let calendar = Calendar.current
            let month = calendar.component(.month, from: node.modifiedAt)
            x = month - 1 // 0-11

        case "category":
            // Hash folder name to consistent X position
            x = abs((node.folder ?? "").hash) % 10

        case "hierarchy":
            // Use priority directly
            x = max(0, node.priority)

        case "alphabet":
            // Use first letter of name
            let firstLetter = node.name.first ?? "A"
            x = Int(firstLetter.asciiValue ?? 65) - 65 // A=0, B=1, etc

        default:
            x = index % 10 // Fallback grid layout
        }

        // Y-axis calculation
        switch currentConfig.yAxisMapping {
        case "category":
            // Hash folder name to consistent Y position
            y = abs((node.folder ?? "").hash) % 8

        case "hierarchy":
            // Use importance/priority
            y = max(0, node.importance > 0 ? node.importance : node.priority)

        case "time":
            // Group by relative time (recent vs old)
            let daysSinceModified = Calendar.current.dateComponents([.day], from: node.modifiedAt, to: Date()).day ?? 0
            if daysSinceModified < 7 {
                y = 0 // This week
            } else if daysSinceModified < 30 {
                y = 1 // This month
            } else {
                y = 2 // Older
            }

        default:
            y = index % 8 // Fallback grid layout
        }

        // Adjust for origin pattern
        if currentConfig.originPattern == "bipolar" {
            // Bipolar: center origin, allow negative coordinates
            return (x: x - 5, y: y - 4)
        } else {
            // Anchor: top-left origin, positive coordinates only
            return (x: max(0, x), y: max(0, y))
        }
    }

    // MARK: - Persistence
    private func loadViewConfigs() async {
        // In full implementation, load from SQLite
        // For now, use the default config
    }

    private func saveViewConfig() async {
        // In full implementation, save to SQLite and sync to CloudKit
        // For now, just update the modification time
        currentConfig.lastUsedAt = Date()
    }

    private func loadFilterPresets() async {
        // In full implementation, load from SQLite
        // For now, create some default presets
        filterPresets = [
            FilterPreset(
                name: "High Priority",
                filterConfig: """
                {
                  "priority": [1, 2]
                }
                """,
                description: "Show only high priority items",
                iconName: "exclamationmark.triangle"
            ),
            FilterPreset(
                name: "This Week",
                filterConfig: """
                {
                  "timeRange": {
                    "start": "\(ISO8601DateFormatter().string(from: Calendar.current.dateInterval(of: .weekOfYear, for: Date())?.start ?? Date()))",
                    "end": "\(ISO8601DateFormatter().string(from: Date()))"
                  }
                }
                """,
                description: "Show items from this week",
                iconName: "calendar"
            ),
            FilterPreset(
                name: "Work Items",
                filterConfig: """
                {
                  "category": ["Work", "Projects"]
                }
                """,
                description: "Show work-related items only",
                iconName: "briefcase"
            )
        ]
    }

    private func incrementPresetUsage(_ preset: FilterPreset) async {
        // In full implementation, update usage count in database
        if let index = filterPresets.firstIndex(where: { $0.id == preset.id }) {
            filterPresets[index].usageCount += 1
            filterPresets[index].lastUsedAt = Date()
        }
    }
}