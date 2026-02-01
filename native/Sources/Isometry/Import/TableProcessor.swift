import Foundation
import IsometryCore

/// Processes markdown tables and maps columns to LATCH properties
public actor TableProcessor {
    private let database: IsometryDatabase

    public init(database: IsometryDatabase) {
        self.database = database
    }

    // MARK: - Public API

    /// Extract and process all tables from markdown content
    public func processTables(in content: String, sourceNode: Node) async throws -> [ProcessedTable] {
        let tables = extractTablesFromMarkdown(content)
        var processedTables: [ProcessedTable] = []

        for table in tables {
            let processed = try await processTable(table, sourceNode: sourceNode)
            processedTables.append(processed)
        }

        return processedTables
    }

    // MARK: - Table Extraction

    /// Extract tables from markdown content
    private func extractTablesFromMarkdown(_ content: String) -> [MarkdownTable] {
        var tables: [MarkdownTable] = []
        let lines = content.components(separatedBy: .newlines)

        var i = 0
        while i < lines.count {
            let line = lines[i].trimmingCharacters(in: .whitespaces)

            // Check if this line starts a table (has | and content)
            if line.hasPrefix("|") && line.hasSuffix("|") && line.filter({ $0 == "|" }).count >= 2 {
                // Check if next line is a separator
                if i + 1 < lines.count {
                    let nextLine = lines[i + 1].trimmingCharacters(in: .whitespaces)
                    if isTableSeparator(nextLine) {
                        // Extract the full table starting from this position
                        let table = extractTableFromPosition(lines, startIndex: i)
                        tables.append(table)
                        i += table.allRows.count + 1 // Skip past this table
                        continue
                    }
                }
            }
            i += 1
        }

        return tables
    }

    /// Check if a line is a table separator (|---|---|)
    private func isTableSeparator(_ line: String) -> Bool {
        if !line.hasPrefix("|") || !line.hasSuffix("|") {
            return false
        }

        let content = line.dropFirst().dropLast()
        let cells = content.components(separatedBy: "|")

        // Each cell should contain only dashes, spaces, and colons
        for cell in cells {
            let trimmed = cell.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty { continue }

            // Valid separator cell contains only: -, :, and spaces
            let validChars = CharacterSet(charactersIn: "-: ")
            if trimmed.rangeOfCharacter(from: validChars.inverted) != nil {
                return false
            }

            // Must contain at least one dash
            if !trimmed.contains("-") {
                return false
            }
        }

        return true
    }

    /// Extract a complete table from the given starting position
    private func extractTableFromPosition(_ lines: [String], startIndex: Int) -> MarkdownTable {
        var headerRow: [String] = []
        var dataRows: [[String]] = []

        // Extract header
        if startIndex < lines.count {
            headerRow = parseTableRow(lines[startIndex])
        }

        // Skip separator row and extract data rows
        var i = startIndex + 2
        while i < lines.count {
            let line = lines[i].trimmingCharacters(in: .whitespaces)

            // Check if this is still part of the table
            if line.hasPrefix("|") && line.hasSuffix("|") && !isTableSeparator(line) {
                let row = parseTableRow(line)
                // Only add rows with the same number of columns (or close)
                if row.count == headerRow.count || row.count == headerRow.count - 1 {
                    dataRows.append(row)
                    i += 1
                } else {
                    break
                }
            } else {
                break
            }
        }

        return MarkdownTable(headers: headerRow, rows: dataRows)
    }

    /// Parse a single table row into cells
    private func parseTableRow(_ line: String) -> [String] {
        // Remove leading and trailing |
        let content = line.dropFirst().dropLast()
        let cells = content.components(separatedBy: "|")

        return cells.map { cell in
            cell.trimmingCharacters(in: .whitespaces)
        }
    }

    // MARK: - Table Processing

    /// Process a table with LATCH mapping
    private func processTable(_ table: MarkdownTable, sourceNode: Node) async throws -> ProcessedTable {
        // Apply LATCH column mapping
        let columnMapping = mapColumnsToLATCH(table.headers)

        // Process each row
        var processedRows: [ProcessedTableRow] = []
        for (index, row) in table.rows.enumerated() {
            let processedRow = try await processTableRow(
                row,
                columnMapping: columnMapping,
                rowIndex: index,
                sourceNode: sourceNode
            )
            processedRows.append(processedRow)
        }

        return ProcessedTable(
            originalTable: table,
            columnMapping: columnMapping,
            processedRows: processedRows,
            sourceNodeId: sourceNode.id
        )
    }

    /// Map table columns to LATCH properties
    private func mapColumnsToLATCH(_ headers: [String]) -> [Int: LATCHProperty] {
        var mapping: [Int: LATCHProperty] = [:]

        for (index, header) in headers.enumerated() {
            let normalizedHeader = header.lowercased().trimmingCharacters(in: .whitespaces)

            // Map to LATCH properties based on header names
            if let latchProperty = detectLATCHProperty(normalizedHeader) {
                mapping[index] = latchProperty
            }
        }

        return mapping
    }

    /// Detect LATCH property from column header
    private func detectLATCHProperty(_ headerName: String) -> LATCHProperty? {
        // Location patterns
        let locationPatterns = ["location", "place", "address", "where", "room", "building", "city", "country"]
        if locationPatterns.contains(where: { headerName.contains($0) }) {
            return .location
        }

        // Alphabet (Name) patterns
        let alphabetPatterns = ["name", "title", "label", "identifier", "id", "text", "description"]
        if alphabetPatterns.contains(where: { headerName.contains($0) }) {
            return .alphabet
        }

        // Time patterns
        let timePatterns = ["time", "date", "when", "created", "modified", "updated", "timestamp", "due", "start", "end"]
        if timePatterns.contains(where: { headerName.contains($0) }) {
            return .time
        }

        // Category patterns
        let categoryPatterns = ["category", "type", "kind", "class", "group", "section", "topic", "tag", "genre"]
        if categoryPatterns.contains(where: { headerName.contains($0) }) {
            return .category
        }

        // Hierarchy patterns
        let hierarchyPatterns = ["level", "priority", "rank", "order", "position", "hierarchy", "parent", "child", "depth"]
        if hierarchyPatterns.contains(where: { headerName.contains($0) }) {
            return .hierarchy
        }

        return nil
    }

    /// Process a single table row
    private func processTableRow(
        _ row: [String],
        columnMapping: [Int: LATCHProperty],
        rowIndex: Int,
        sourceNode: Node
    ) async throws -> ProcessedTableRow {
        var latchData = LATCHData()
        var unmappedData: [String: String] = [:]

        for (cellIndex, cellValue) in row.enumerated() {
            if let latchProperty = columnMapping[cellIndex] {
                // Map to LATCH property
                mapCellToLATCH(cellValue, property: latchProperty, latchData: &latchData)
            } else if cellIndex < row.count {
                // Store as unmapped data
                unmappedData["column_\(cellIndex)"] = cellValue
            }
        }

        // Create node for this table row if it contains meaningful data
        let rowNode = try await createNodeForTableRow(
            latchData: latchData,
            unmappedData: unmappedData,
            rowIndex: rowIndex,
            sourceNode: sourceNode
        )

        return ProcessedTableRow(
            originalRow: row,
            latchData: latchData,
            unmappedData: unmappedData,
            nodeId: rowNode.id
        )
    }

    /// Map cell value to LATCH property
    private func mapCellToLATCH(_ cellValue: String, property: LATCHProperty, latchData: inout LATCHData) {
        let trimmedValue = cellValue.trimmingCharacters(in: .whitespaces)
        if trimmedValue.isEmpty { return }

        switch property {
        case .location:
            latchData.location = trimmedValue
        case .alphabet:
            latchData.name = trimmedValue
        case .time:
            latchData.timeValue = trimmedValue
            latchData.parsedDate = parseTableDate(trimmedValue)
        case .category:
            latchData.categories.append(trimmedValue)
        case .hierarchy:
            latchData.hierarchy = parseHierarchyValue(trimmedValue)
        }
    }

    /// Parse date from table cell
    private func parseTableDate(_ dateString: String) -> Date? {
        let formatters = [
            DateFormatter(),
            ISO8601DateFormatter()
        ]

        // Common date formats
        let dateFormats = [
            "yyyy-MM-dd",
            "MM/dd/yyyy",
            "dd/MM/yyyy",
            "yyyy-MM-dd HH:mm:ss",
            "MM/dd/yyyy HH:mm"
        ]

        for format in dateFormats {
            let formatter = DateFormatter()
            formatter.dateFormat = format
            if let date = formatter.date(from: dateString) {
                return date
            }
        }

        // Try ISO8601
        let iso8601 = ISO8601DateFormatter()
        return iso8601.date(from: dateString)
    }

    /// Parse hierarchy value (could be numeric priority or textual level)
    private func parseHierarchyValue(_ hierarchyString: String) -> Int {
        // Try to parse as integer
        if let intValue = Int(hierarchyString) {
            return intValue
        }

        // Map text values to hierarchy levels
        let hierarchyMapping: [String: Int] = [
            "high": 3, "medium": 2, "low": 1,
            "urgent": 4, "normal": 2, "optional": 1,
            "critical": 5, "important": 3, "minor": 1,
            "first": 1, "second": 2, "third": 3
        ]

        let normalized = hierarchyString.lowercased().trimmingCharacters(in: .whitespaces)
        return hierarchyMapping[normalized] ?? 0
    }

    /// Create a node for a table row
    private func createNodeForTableRow(
        latchData: LATCHData,
        unmappedData: [String: String],
        rowIndex: Int,
        sourceNode: Node
    ) async throws -> Node {
        // Determine node name
        let nodeName = latchData.name ?? "Table Row \(rowIndex + 1)"

        // Create content from all data
        var contentParts: [String] = []
        if let location = latchData.location {
            contentParts.append("Location: \(location)")
        }
        if let timeValue = latchData.timeValue {
            contentParts.append("Time: \(timeValue)")
        }
        if !latchData.categories.isEmpty {
            contentParts.append("Categories: \(latchData.categories.joined(separator: ", "))")
        }
        if latchData.hierarchy > 0 {
            contentParts.append("Priority: \(latchData.hierarchy)")
        }

        // Add unmapped data
        for (key, value) in unmappedData {
            contentParts.append("\(key): \(value)")
        }

        let content = contentParts.joined(separator: "\n")

        // Create node
        let node = Node(
            nodeType: "table-row",
            name: nodeName,
            content: content,
            summary: latchData.name,
            createdAt: latchData.parsedDate ?? Date(),
            modifiedAt: Date(),
            folder: sourceNode.folder,
            tags: latchData.categories,
            source: "table",
            sourceId: "\(sourceNode.sourceId ?? sourceNode.id)-row-\(rowIndex)"
        )

        try await database.createNode(node)

        // Create edge from source node to table row
        let edge = Edge(
            edgeType: .nest,
            sourceId: sourceNode.id,
            targetId: node.id,
            label: "Contains table row",
            weight: 0.8,
            sequenceOrder: rowIndex
        )

        try await database.createEdge(edge)

        return node
    }
}

// MARK: - Supporting Types

public struct MarkdownTable: Sendable {
    public let headers: [String]
    public let rows: [[String]]

    public var allRows: [[String]] {
        [headers] + rows
    }

    public init(headers: [String], rows: [[String]]) {
        self.headers = headers
        self.rows = rows
    }
}

public struct ProcessedTable: Sendable {
    public let originalTable: MarkdownTable
    public let columnMapping: [Int: LATCHProperty]
    public let processedRows: [ProcessedTableRow]
    public let sourceNodeId: String

    public init(
        originalTable: MarkdownTable,
        columnMapping: [Int: LATCHProperty],
        processedRows: [ProcessedTableRow],
        sourceNodeId: String
    ) {
        self.originalTable = originalTable
        self.columnMapping = columnMapping
        self.processedRows = processedRows
        self.sourceNodeId = sourceNodeId
    }
}

public struct ProcessedTableRow: Sendable {
    public let originalRow: [String]
    public let latchData: LATCHData
    public let unmappedData: [String: String]
    public let nodeId: String

    public init(
        originalRow: [String],
        latchData: LATCHData,
        unmappedData: [String: String],
        nodeId: String
    ) {
        self.originalRow = originalRow
        self.latchData = latchData
        self.unmappedData = unmappedData
        self.nodeId = nodeId
    }
}

public enum LATCHProperty: String, CaseIterable, Sendable {
    case location = "L"     // Location
    case alphabet = "A"     // Alphabet (Name/Text)
    case time = "T"         // Time
    case category = "C"     // Category
    case hierarchy = "H"    // Hierarchy
}

public struct LATCHData: Sendable {
    public var location: String?
    public var name: String?
    public var timeValue: String?
    public var parsedDate: Date?
    public var categories: [String]
    public var hierarchy: Int

    public init(
        location: String? = nil,
        name: String? = nil,
        timeValue: String? = nil,
        parsedDate: Date? = nil,
        categories: [String] = [],
        hierarchy: Int = 0
    ) {
        self.location = location
        self.name = name
        self.timeValue = timeValue
        self.parsedDate = parsedDate
        self.categories = categories
        self.hierarchy = hierarchy
    }
}