import Foundation
import SwiftUI

/// Slash command categories for organization and filtering
public enum CommandCategory: String, CaseIterable, Codable {
    case isometry = "isometry"
    case template = "template"
    case format = "format"

    public var displayName: String {
        switch self {
        case .isometry: return "Isometry"
        case .template: return "Template"
        case .format: return "Format"
        }
    }

    public var icon: String {
        switch self {
        case .isometry: return "cube.box"
        case .template: return "doc.text.below.ecg"
        case .format: return "textformat"
        }
    }

    public var color: String {
        switch self {
        case .isometry: return "blue"
        case .template: return "purple"
        case .format: return "green"
        }
    }
}

/// Slash command definition
public struct SlashCommand: Identifiable, Hashable, Codable {
    public let id: String
    public let label: String
    public let description: String
    public let category: CommandCategory
    public let shortcut: String?
    public let content: String
    public let cursorOffset: Int

    public init(
        id: String,
        label: String,
        description: String,
        category: CommandCategory,
        shortcut: String? = nil,
        content: String,
        cursorOffset: Int = 0
    ) {
        self.id = id
        self.label = label
        self.description = description
        self.category = category
        self.shortcut = shortcut
        self.content = content
        self.cursorOffset = cursorOffset
    }

    /// Processed content with dynamic replacements
    public var processedContent: String {
        var processed = content

        // Replace dynamic placeholders
        let now = Date()
        let dateFormatter = DateFormatter()
        dateFormatter.dateStyle = .short

        processed = processed.replacingOccurrences(of: "{{date}}", with: dateFormatter.string(from: now))
        processed = processed.replacingOccurrences(of: "{{time}}", with: DateFormatter.localizedString(from: now, dateStyle: .none, timeStyle: .short))

        return processed
    }

    /// Match score for fuzzy search (0.0 to 1.0)
    public func matchScore(for query: String) -> Double {
        guard !query.isEmpty else { return 1.0 }

        let queryLower = query.lowercased()

        // Exact shortcut match gets highest priority
        if let shortcut = shortcut, shortcut.lowercased() == queryLower {
            return 1.0
        }

        // Label starts with query gets high priority
        if label.lowercased().hasPrefix(queryLower) {
            return 0.9
        }

        // Shortcut starts with query
        if let shortcut = shortcut, shortcut.lowercased().hasPrefix(queryLower) {
            return 0.8
        }

        // Label contains query
        if label.lowercased().contains(queryLower) {
            return 0.7
        }

        // Description contains query
        if description.lowercased().contains(queryLower) {
            return 0.6
        }

        // Category matches
        if category.rawValue.lowercased().contains(queryLower) {
            return 0.5
        }

        // Fuzzy match in label
        if fuzzyMatch(label.lowercased(), query: queryLower) {
            return 0.4
        }

        return 0.0
    }

    private func fuzzyMatch(_ text: String, query: String) -> Bool {
        var queryIndex = query.startIndex

        for char in text {
            if queryIndex < query.endIndex && char == query[queryIndex] {
                queryIndex = query.index(after: queryIndex)
            }
        }

        return queryIndex >= query.endIndex
    }
}

/// Slash command detection, filtering, and execution system
@MainActor
public class SlashCommandManager: ObservableObject {

    // MARK: - Published Properties

    /// Whether the command menu is visible
    @Published public var isMenuVisible: Bool = false

    /// Filtered commands based on current query
    @Published public var filteredCommands: [SlashCommand] = []

    /// Currently selected command index
    @Published public var selectedIndex: Int = 0

    /// Menu position in view coordinates
    @Published public var menuPosition: CGPoint = .zero

    /// Current search query
    @Published public var currentQuery: String = "" {
        didSet {
            updateFilteredCommands()
        }
    }

    // MARK: - Private Properties

    private var allCommands: [SlashCommand] = []
    private var commandUsageCount: [String: Int] = [:]
    private var lastUsedCommands: [String] = []

    // MARK: - Built-in Command Library

    private static let builtInCommands: [SlashCommand] = [
        // Isometry Commands
        SlashCommand(
            id: "pafv-query",
            label: "PAFV Query",
            description: "Insert PAFV projection pattern",
            category: .isometry,
            shortcut: "pafv",
            content: """
```sql
-- PAFV Query
SELECT * FROM nodes
WHERE plane = "?" AND axis = "?"
ORDER BY facet;
```
""",
            cursorOffset: 45
        ),

        SlashCommand(
            id: "latch-filter",
            label: "LATCH Filter",
            description: "Insert LATCH filter template",
            category: .isometry,
            shortcut: "latch",
            content: """
## Filter Criteria
- **Location:** ?
- **Alphabet:** ?
- **Time:** ?
- **Category:** ?
- **Hierarchy:** ?
""",
            cursorOffset: 35
        ),

        SlashCommand(
            id: "graph-query",
            label: "Graph Query",
            description: "Insert graph traversal query",
            category: .isometry,
            shortcut: "graph",
            content: """
```sql
-- Graph Traversal
WITH RECURSIVE graph_walk(node_id, depth) AS (
  SELECT ?, 0
  UNION ALL
  SELECT e.to_node, gw.depth + 1
  FROM edges e
  JOIN graph_walk gw ON e.from_node = gw.node_id
  WHERE gw.depth < 5
)
SELECT n.* FROM nodes n
JOIN graph_walk gw ON n.id = gw.node_id;
```
""",
            cursorOffset: 82
        ),

        // Template Commands
        SlashCommand(
            id: "meeting-template",
            label: "Meeting Notes",
            description: "Insert meeting notes template",
            category: .template,
            shortcut: "meeting",
            content: """
# Meeting: [Title]

**Date:** {{date}}
**Attendees:**
**Duration:**

## Agenda
- [ ]

## Discussion Notes


## Action Items
- [ ] **[Name]** -

## Next Steps

""",
            cursorOffset: 19
        ),

        SlashCommand(
            id: "retrospective-template",
            label: "Retrospective",
            description: "Insert retrospective template",
            category: .template,
            shortcut: "retro",
            content: """
# Retrospective - {{date}}

## What Went Well? 💚
-

## What Could Be Improved? 🔶
-

## Action Items 🎯
- [ ] **[Owner]** -

## Insights & Learnings 💡
-
""",
            cursorOffset: 39
        ),

        // Format Commands
        SlashCommand(
            id: "code-snippet",
            label: "Code Snippet",
            description: "Insert code block template",
            category: .format,
            shortcut: "code",
            content: """
```swift
//
```
""",
            cursorOffset: 11
        ),

        SlashCommand(
            id: "task-list",
            label: "Task List",
            description: "Insert checkbox task list",
            category: .format,
            shortcut: "tasks",
            content: """
## Tasks
- [ ]
- [ ]
- [ ]
""",
            cursorOffset: 14
        ),

        SlashCommand(
            id: "table",
            label: "Table",
            description: "Insert markdown table",
            category: .format,
            shortcut: "table",
            content: """
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
|          |          |          |
|          |          |          |
""",
            cursorOffset: 11
        ),

        SlashCommand(
            id: "math",
            label: "Math Expression",
            description: "Insert LaTeX math block",
            category: .format,
            shortcut: "math",
            content: """
$$

$$
""",
            cursorOffset: 3
        ),

        SlashCommand(
            id: "quote",
            label: "Quote",
            description: "Insert blockquote",
            category: .format,
            shortcut: "quote",
            content: """
>
""",
            cursorOffset: 2
        ),

        SlashCommand(
            id: "divider",
            label: "Divider",
            description: "Insert horizontal rule",
            category: .format,
            shortcut: "hr",
            content: """
---

""",
            cursorOffset: 5
        )
    ]

    // MARK: - Initialization

    public init() {
        allCommands = Self.builtInCommands
        loadUsageData()
    }

    // MARK: - Public Methods

    /// Detect slash command in text at cursor position
    public func detectSlashCommand(text: String, cursorPosition: Int) -> Bool {
        guard cursorPosition > 0, cursorPosition <= text.count else { return false }

        let index = text.index(text.startIndex, offsetBy: cursorPosition - 1)

        // Look for '/' at current position or find the most recent '/'
        var slashPosition: String.Index?
        var searchIndex = index

        while searchIndex >= text.startIndex {
            if text[searchIndex] == "/" {
                slashPosition = searchIndex
                break
            }
            if text[searchIndex].isNewline {
                break // Stop at line boundaries
            }
            if searchIndex == text.startIndex {
                break
            }
            searchIndex = text.index(before: searchIndex)
        }

        guard let slashIndex = slashPosition else { return false }

        // Extract query after '/'
        let afterSlash = text.index(after: slashIndex)
        let query = String(text[afterSlash..<index])

        // Only show menu if query is reasonable (no spaces, reasonable length)
        guard !query.contains(" ") && query.count <= 20 else { return false }

        // Update current query and show menu
        currentQuery = query
        return true
    }

    /// Filter commands based on query
    private func updateFilteredCommands() {
        if currentQuery.isEmpty {
            // Show all commands, sorted by usage frequency
            filteredCommands = allCommands.sorted { lhs, rhs in
                let lhsUsage = commandUsageCount[lhs.id] ?? 0
                let rhsUsage = commandUsageCount[rhs.id] ?? 0

                if lhsUsage != rhsUsage {
                    return lhsUsage > rhsUsage
                }

                return lhs.label < rhs.label
            }
        } else {
            // Fuzzy search with ranking
            let scored = allCommands.compactMap { command in
                let score = command.matchScore(for: currentQuery)
                return score > 0 ? (command, score) : nil
            }

            filteredCommands = scored
                .sorted { $0.1 > $1.1 } // Sort by score descending
                .map { $0.0 }
        }

        // Reset selection
        selectedIndex = 0
    }

    /// Get command at specified index
    public func getCommand(at index: Int) -> SlashCommand? {
        guard index >= 0 && index < filteredCommands.count else { return nil }
        return filteredCommands[index]
    }

    /// Get currently selected command
    public var selectedCommand: SlashCommand? {
        return getCommand(at: selectedIndex)
    }

    /// Move selection up
    public func selectPrevious() {
        selectedIndex = max(0, selectedIndex - 1)
    }

    /// Move selection down
    public func selectNext() {
        selectedIndex = min(filteredCommands.count - 1, selectedIndex + 1)
    }

    /// Execute command at current selection
    public func executeSelectedCommand() -> SlashCommand? {
        guard let command = selectedCommand else { return nil }

        // Track usage
        commandUsageCount[command.id] = (commandUsageCount[command.id] ?? 0) + 1

        // Add to recent commands
        lastUsedCommands.removeAll { $0 == command.id }
        lastUsedCommands.insert(command.id, at: 0)
        if lastUsedCommands.count > 10 {
            lastUsedCommands = Array(lastUsedCommands.prefix(10))
        }

        saveUsageData()
        hideMenu()

        return command
    }

    /// Show command menu at position
    public func showMenu(at position: CGPoint) {
        menuPosition = position
        isMenuVisible = true
        selectedIndex = 0
        updateFilteredCommands()
    }

    /// Hide command menu
    public func hideMenu() {
        isMenuVisible = false
        currentQuery = ""
        selectedIndex = 0
        filteredCommands = []
    }

    /// Analyze context for relevant command suggestions
    public func analyzeContext(text: String, cursorPosition: Int) -> [SlashCommand] {
        // Simple context analysis - can be enhanced later
        let lowercased = text.lowercased()
        var suggestions: [SlashCommand] = []

        // If text contains meeting-related words, suggest meeting template
        if lowercased.contains("meeting") || lowercased.contains("agenda") {
            if let meetingCommand = allCommands.first(where: { $0.id == "meeting-template" }) {
                suggestions.append(meetingCommand)
            }
        }

        // If text contains code-related words, suggest code snippet
        if lowercased.contains("code") || lowercased.contains("function") || lowercased.contains("class") {
            if let codeCommand = allCommands.first(where: { $0.id == "code-snippet" }) {
                suggestions.append(codeCommand)
            }
        }

        // If text contains task-related words, suggest task list
        if lowercased.contains("todo") || lowercased.contains("task") || lowercased.contains("checklist") {
            if let taskCommand = allCommands.first(where: { $0.id == "task-list" }) {
                suggestions.append(taskCommand)
            }
        }

        return suggestions
    }

    // MARK: - Persistence

    private var usageDataURL: URL {
        let documentsDirectory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        return documentsDirectory.appendingPathComponent("slash_command_usage.json")
    }

    private struct UsageData: Codable {
        let commandUsageCount: [String: Int]
        let lastUsedCommands: [String]
    }

    private func loadUsageData() {
        guard FileManager.default.fileExists(atPath: usageDataURL.path) else { return }

        do {
            let data = try Data(contentsOf: usageDataURL)
            let usageData = try JSONDecoder().decode(UsageData.self, from: data)
            commandUsageCount = usageData.commandUsageCount
            lastUsedCommands = usageData.lastUsedCommands
        } catch {
            print("Failed to load command usage data: \(error)")
        }
    }

    private func saveUsageData() {
        do {
            let usageData = UsageData(
                commandUsageCount: commandUsageCount,
                lastUsedCommands: lastUsedCommands
            )
            let data = try JSONEncoder().encode(usageData)
            try data.write(to: usageDataURL)
        } catch {
            print("Failed to save command usage data: \(error)")
        }
    }

    // MARK: - Computed Properties

    /// Commands grouped by category
    public var commandsByCategory: [CommandCategory: [SlashCommand]] {
        Dictionary(grouping: filteredCommands) { $0.category }
    }

    /// Recently used commands
    public var recentCommands: [SlashCommand] {
        lastUsedCommands.compactMap { commandId in
            allCommands.first { $0.id == commandId }
        }
    }

    /// Most used commands
    public var popularCommands: [SlashCommand] {
        allCommands
            .sorted { lhs, rhs in
                let lhsUsage = commandUsageCount[lhs.id] ?? 0
                let rhsUsage = commandUsageCount[rhs.id] ?? 0
                return lhsUsage > rhsUsage
            }
            .prefix(5)
            .map { $0 }
    }
}