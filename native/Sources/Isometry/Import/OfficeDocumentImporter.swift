import Foundation
import ZipArchive
#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

/// Office document importer for XLSX and DOCX files
/// Provides native Swift implementation for high-fidelity document import
public actor OfficeDocumentImporter {
    private let database: IsometryDatabase

    public init(database: IsometryDatabase) {
        self.database = database
    }

    // MARK: - Import Results

    public struct ImportResult {
        public let nodes: [Node]
        public let errors: [ImportError]
        public let metadata: ImportMetadata

        public var successful: Int { nodes.count }
        public var failed: Int { errors.count }
        public var total: Int { successful + failed }
    }

    public struct ImportMetadata {
        public let totalSheets: Int?
        public let processedSheets: [String]?
        public let wordCount: Int?
        public let tableCount: Int
        public let importDuration: TimeInterval

        public init(totalSheets: Int? = nil, processedSheets: [String]? = nil,
                   wordCount: Int? = nil, tableCount: Int = 0, importDuration: TimeInterval = 0) {
            self.totalSheets = totalSheets
            self.processedSheets = processedSheets
            self.wordCount = wordCount
            self.tableCount = tableCount
            self.importDuration = importDuration
        }
    }

    public enum ImportError: Error, LocalizedError {
        case unsupportedFormat(String)
        case corruptedFile(String)
        case xmlParsingFailed(String, Error)
        case sheetProcessingFailed(String, Error)
        case databaseInsertFailed(Error)

        public var errorDescription: String? {
            switch self {
            case .unsupportedFormat(let format):
                return "Unsupported file format: \(format)"
            case .corruptedFile(let filename):
                return "Corrupted or invalid file: \(filename)"
            case .xmlParsingFailed(let context, let error):
                return "XML parsing failed for \(context): \(error.localizedDescription)"
            case .sheetProcessingFailed(let sheet, let error):
                return "Failed to process sheet '\(sheet)': \(error.localizedDescription)"
            case .databaseInsertFailed(let error):
                return "Database insert failed: \(error.localizedDescription)"
            }
        }
    }

    // MARK: - XLSX Import

    /// Import Excel file from URL
    public func importExcel(from url: URL, folder: String? = nil) async throws -> ImportResult {
        let startTime = Date()

        guard url.pathExtension.lowercased() == "xlsx" else {
            throw ImportError.unsupportedFormat(url.pathExtension)
        }

        do {
            let workbookData = try await processExcelFile(url)
            let nodes = try await createNodesFromWorkbook(workbookData, sourceURL: url, folder: folder)

            let duration = Date().timeIntervalSince(startTime)
            let metadata = ImportMetadata(
                totalSheets: workbookData.sheets.count,
                processedSheets: workbookData.sheets.map(\.name),
                tableCount: nodes.reduce(0) { $0 + countTablesInContent($1.content) },
                importDuration: duration
            )

            return ImportResult(nodes: nodes, errors: [], metadata: metadata)
        } catch {
            return ImportResult(
                nodes: [],
                errors: [error as? ImportError ?? ImportError.corruptedFile(url.lastPathComponent)],
                metadata: ImportMetadata(importDuration: Date().timeIntervalSince(startTime))
            )
        }
    }

    /// Import Word document from URL
    public func importWord(from url: URL, folder: String? = nil) async throws -> ImportResult {
        let startTime = Date()

        guard url.pathExtension.lowercased() == "docx" else {
            throw ImportError.unsupportedFormat(url.pathExtension)
        }

        do {
            let documentData = try await processWordFile(url)
            let node = try await createNodeFromDocument(documentData, sourceURL: url, folder: folder)

            let duration = Date().timeIntervalSince(startTime)
            let metadata = ImportMetadata(
                wordCount: countWords(in: documentData.content),
                tableCount: countTablesInContent(documentData.content),
                importDuration: duration
            )

            return ImportResult(nodes: [node], errors: [], metadata: metadata)
        } catch {
            return ImportResult(
                nodes: [],
                errors: [error as? ImportError ?? ImportError.corruptedFile(url.lastPathComponent)],
                metadata: ImportMetadata(importDuration: Date().timeIntervalSince(startTime))
            )
        }
    }

    // MARK: - Data Processing

    private struct WorkbookData {
        let sheets: [SheetData]
        let sharedStrings: [String]
        let filename: String
    }

    private struct SheetData {
        let name: String
        let content: [[String]]
        let range: String
        let relationships: [String: String]
    }

    private struct DocumentData {
        let content: String
        let styles: [String: Any]
        let relationships: [String: String]
        let filename: String
    }

    private func processExcelFile(_ url: URL) async throws -> WorkbookData {
        // Extract XLSX (ZIP) file
        let tempDirectory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: tempDirectory, withIntermediateDirectories: true)

        defer {
            try? FileManager.default.removeItem(at: tempDirectory)
        }

        // Unzip XLSX file
        guard SSZipArchive.unzipFile(atPath: url.path, toDestination: tempDirectory.path) else {
            throw ImportError.corruptedFile(url.lastPathComponent)
        }

        // Parse shared strings
        let sharedStrings = try parseSharedStrings(at: tempDirectory)

        // Parse workbook structure
        let workbook = try parseWorkbook(at: tempDirectory)

        // Process each sheet
        var sheets: [SheetData] = []
        for sheetInfo in workbook {
            do {
                let sheetData = try parseWorksheet(
                    name: sheetInfo.name,
                    path: sheetInfo.path,
                    baseDirectory: tempDirectory,
                    sharedStrings: sharedStrings
                )
                sheets.append(sheetData)
            } catch {
                throw ImportError.sheetProcessingFailed(sheetInfo.name, error)
            }
        }

        return WorkbookData(
            sheets: sheets,
            sharedStrings: sharedStrings,
            filename: url.lastPathComponent
        )
    }

    private func processWordFile(_ url: URL) async throws -> DocumentData {
        // Extract DOCX (ZIP) file
        let tempDirectory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: tempDirectory, withIntermediateDirectories: true)

        defer {
            try? FileManager.default.removeItem(at: tempDirectory)
        }

        // Unzip DOCX file
        guard SSZipArchive.unzipFile(atPath: url.path, toDestination: tempDirectory.path) else {
            throw ImportError.corruptedFile(url.lastPathComponent)
        }

        // Parse document content
        let content = try parseWordDocument(at: tempDirectory)

        // Parse styles and relationships if needed
        let styles = try parseWordStyles(at: tempDirectory)
        let relationships = try parseWordRelationships(at: tempDirectory)

        return DocumentData(
            content: content,
            styles: styles,
            relationships: relationships,
            filename: url.lastPathComponent
        )
    }

    // MARK: - XML Parsing

    #if os(macOS)
    private func parseSharedStrings(at directory: URL) throws -> [String] {
        let sharedStringsPath = directory.appendingPathComponent("xl/sharedStrings.xml")

        guard FileManager.default.fileExists(atPath: sharedStringsPath.path) else {
            return [] // No shared strings
        }

        let data = try Data(contentsOf: sharedStringsPath)
        let xml = try XMLDocument(data: data)

        var strings: [String] = []
        let stringNodes = try xml.nodes(forXPath: "//si/t")

        for node in stringNodes {
            if let string = node.stringValue {
                strings.append(string)
            }
        }

        return strings
    }

    private func parseWorkbook(at directory: URL) throws -> [(name: String, path: String)] {
        let workbookPath = directory.appendingPathComponent("xl/workbook.xml")
        let data = try Data(contentsOf: workbookPath)
        let xml = try XMLDocument(data: data)

        var sheets: [(name: String, path: String)] = []
        let sheetNodes = try xml.nodes(forXPath: "//sheet")

        for (index, node) in sheetNodes.enumerated() {
            if let element = node as? XMLElement,
               let name = element.attribute(forName: "name")?.stringValue {
                let sheetPath = "xl/worksheets/sheet\(index + 1).xml"
                sheets.append((name: name, path: sheetPath))
            }
        }

        return sheets
    }

    private func parseWorksheet(
        name: String,
        path: String,
        baseDirectory: URL,
        sharedStrings: [String]
    ) throws -> SheetData {
        let worksheetPath = baseDirectory.appendingPathComponent(path)
        let data = try Data(contentsOf: worksheetPath)
        let xml = try XMLDocument(data: data)

        var content: [[String]] = []
        var maxRow = 0
        var maxCol = 0

        // Parse all cells
        let cellNodes = try xml.nodes(forXPath: "//c")
        var cellData: [String: String] = [:] // cellRef -> value

        for node in cellNodes {
            if let element = node as? XMLElement,
               let cellRef = element.attribute(forName: "r")?.stringValue {

                let cellType = element.attribute(forName: "t")?.stringValue ?? "str"
                var value = ""

                if let valueNode = element.elements(forName: "v").first {
                    let rawValue = valueNode.stringValue ?? ""

                    switch cellType {
                    case "s": // Shared string
                        if let index = Int(rawValue), index < sharedStrings.count {
                            value = sharedStrings[index]
                        }
                    case "n": // Number
                        value = rawValue
                    case "b": // Boolean
                        value = rawValue == "1" ? "TRUE" : "FALSE"
                    default:
                        value = rawValue
                    }
                }

                cellData[cellRef] = value

                // Track max row/col for range determination
                let (row, col) = parseCellReference(cellRef)
                maxRow = max(maxRow, row)
                maxCol = max(maxCol, col)
            }
        }

        // Convert to 2D array
        for row in 0...maxRow {
            var rowData: [String] = []
            for col in 0...maxCol {
                let cellRef = createCellReference(row: row, col: col)
                rowData.append(cellData[cellRef] ?? "")
            }
            content.append(rowData)
        }

        let range = "A1:\(createCellReference(row: maxRow, col: maxCol))"

        return SheetData(
            name: name,
            content: content,
            range: range,
            relationships: [:]
        )
    }

    private func parseWordDocument(at directory: URL) throws -> String {
        let documentPath = directory.appendingPathComponent("word/document.xml")
        let data = try Data(contentsOf: documentPath)
        let xml = try XMLDocument(data: data)

        var content: [String] = []

        // Extract text from paragraphs
        let textNodes = try xml.nodes(forXPath: "//w:t")
        for node in textNodes {
            if let text = node.stringValue, !text.isEmpty {
                content.append(text)
            }
        }

        // Extract tables
        let tableNodes = try xml.nodes(forXPath: "//w:tbl")
        for (index, _) in tableNodes.enumerated() {
            let tableRows = try xml.nodes(forXPath: "//w:tbl[\(index + 1)]//w:tr")

            if !tableRows.isEmpty {
                content.append("\n\n| Table \(index + 1) |")
                content.append("| --- |")

                for (rowIndex, _) in tableRows.enumerated() {
                    let cells = try xml.nodes(forXPath: "//w:tbl[\(index + 1)]//w:tr[\(rowIndex + 1)]//w:t")
                    let cellTexts = cells.compactMap { $0.stringValue }.joined(separator: " | ")
                    content.append("| \(cellTexts) |")
                }
                content.append("")
            }
        }

        return content.joined(separator: "\n")
    }

    private func parseWordStyles(at directory: URL) throws -> [String: Any] {
        // Simplified styles parsing - return empty for now
        return [:]
    }

    private func parseWordRelationships(at directory: URL) throws -> [String: String] {
        // Simplified relationships parsing - return empty for now
        return [:]
    }
    #else
    // iOS: Simplified parsing without XMLDocument
    private func parseSharedStrings(at directory: URL) throws -> [String] {
        return [] // Not supported on iOS
    }

    private func parseWorkbook(at directory: URL) throws -> [(name: String, path: String)] {
        return [] // Not supported on iOS
    }

    private func parseWorksheet(name: String, path: String, baseDirectory: URL, sharedStrings: [String]) throws -> SheetData {
        return SheetData(name: name, content: [[""]], range: "A1:A1", relationships: [:])
    }

    private func parseWordDocument(at directory: URL) throws -> String {
        return "" // Not supported on iOS
    }

    private func parseWordStyles(at directory: URL) throws -> [String: Any] {
        return [:]
    }

    private func parseWordRelationships(at directory: URL) throws -> [String: String] {
        return [:]
    }
    #endif

    // MARK: - Node Creation

    private func createNodesFromWorkbook(_ workbook: WorkbookData, sourceURL: URL, folder: String?) async throws -> [Node] {
        var nodes: [Node] = []

        for sheet in workbook.sheets {
            let content = convertSheetToMarkdown(sheet)
            let summary = generateSheetSummary(sheet)

            let node = Node(
                id: UUID().uuidString,
                nodeType: "spreadsheet",
                name: "\(workbook.filename) - \(sheet.name)",
                content: content,
                summary: summary,
                createdAt: Date(),
                modifiedAt: Date(),
                folder: folder,
                tags: ["excel-import", "sheet-\(sheet.name.lowercased())"],
                source: "excel-import",
                sourceId: "\(workbook.filename)-\(sheet.name)",
                sourceUrl: sourceURL.absoluteString
            )

            try await database.createNode(node)
            nodes.append(node)
        }

        return nodes
    }

    private func createNodeFromDocument(_ document: DocumentData, sourceURL: URL, folder: String?) async throws -> Node {
        let summary = generateDocumentSummary(document.content)

        let node = Node(
            id: UUID().uuidString,
            nodeType: "document",
            name: document.filename.replacingOccurrences(of: ".docx", with: ""),
            content: document.content,
            summary: summary,
            createdAt: Date(),
            modifiedAt: Date(),
            folder: folder,
            tags: ["word-import"],
            source: "word-import",
            sourceId: document.filename,
            sourceUrl: sourceURL.absoluteString
        )

        try await database.createNode(node)
        return node
    }

    // MARK: - Utility Functions

    private func convertSheetToMarkdown(_ sheet: SheetData) -> String {
        var lines = ["# \(sheet.name)\n"]

        lines.append("*Range: \(sheet.range) (\(sheet.content.count) rows)*\n")

        guard !sheet.content.isEmpty else {
            lines.append("*Empty sheet*")
            return lines.joined(separator: "\n")
        }

        // Filter out empty rows
        let nonEmptyRows = sheet.content.filter { row in
            row.contains { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        }

        guard !nonEmptyRows.isEmpty else {
            lines.append("*No data*")
            return lines.joined(separator: "\n")
        }

        // Create markdown table
        let headers = nonEmptyRows[0].map { cell in
            cell.replacingOccurrences(of: "|", with: "\\|")
        }

        lines.append("| " + headers.joined(separator: " | ") + " |")
        lines.append("| " + headers.map { _ in "---" }.joined(separator: " | ") + " |")

        for row in nonEmptyRows.dropFirst() {
            let cells = row.map { cell in
                cell.replacingOccurrences(of: "|", with: "\\|")
            }
            lines.append("| " + cells.joined(separator: " | ") + " |")
        }

        return lines.joined(separator: "\n")
    }

    private func generateSheetSummary(_ sheet: SheetData) -> String {
        let nonEmptyRows = sheet.content.filter { row in
            row.contains { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        }

        return "Excel sheet \"\(sheet.name)\" with \(nonEmptyRows.count) rows and \(sheet.content.first?.count ?? 0) columns"
    }

    private func generateDocumentSummary(_ content: String) -> String {
        let wordCount = countWords(in: content)
        let lineCount = content.components(separatedBy: .newlines).count
        let firstLine = content.components(separatedBy: .newlines).first?.prefix(100) ?? ""

        return "Word document with \(wordCount) words, \(lineCount) lines. \(firstLine)\(firstLine.count == 100 ? "..." : "")"
    }

    private func countWords(in text: String) -> Int {
        let words = text.components(separatedBy: .whitespacesAndNewlines)
        return words.filter { !$0.isEmpty }.count
    }

    private func countTablesInContent(_ content: String?) -> Int {
        guard let content = content else { return 0 }
        return content.components(separatedBy: "|").count / 3 // Rough table detection
    }

    // MARK: - Excel Utilities

    private func parseCellReference(_ cellRef: String) -> (row: Int, col: Int) {
        let letters = cellRef.prefix(while: { $0.isLetter })
        let numbers = cellRef.dropFirst(letters.count)

        let col = letters.reduce(0) { result, char in
            result * 26 + Int(char.asciiValue! - 65) + 1
        } - 1

        let row = Int(numbers) ?? 1
        return (row - 1, col)
    }

    private func createCellReference(row: Int, col: Int) -> String {
        var colString = ""
        var colNum = col

        repeat {
            colString = String(Character(UnicodeScalar(colNum % 26 + 65)!)) + colString
            colNum = colNum / 26 - 1
        } while colNum >= 0

        return "\(colString)\(row + 1)"
    }
}

// MARK: - Package Dependencies Note
/*
 This implementation requires adding ZipArchive dependency to Package.swift:

 .package(url: "https://github.com/ZipArchive/ZipArchive.git", from: "2.5.5")

 And adding to target dependencies:
 .product(name: "ZipArchive", package: "ZipArchive")
 */