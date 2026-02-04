import Foundation

// MARK: - RandomNumberGenerator Extensions

extension RandomNumberGenerator {
    mutating func nextInt(in range: ClosedRange<Int>) -> Int {
        return Int.random(in: range, using: &self)
    }

    mutating func nextInt(in range: Range<Int>) -> Int {
        return Int.random(in: range, using: &self)
    }

    mutating func nextDouble() -> Double {
        return Double.random(in: 0...1, using: &self)
    }

    mutating func nextBool() -> Bool {
        return Bool.random(using: &self)
    }
}

// MARK: - Test Data Generator Framework

/// Comprehensive test data generators for all supported import formats
/// Provides seed-based generation, configurable complexity, and validation
public actor TestDataGenerator {

    // MARK: - Configuration

    public enum ComplexityLevel {
        case simple     // Basic structures, minimal nesting
        case moderate   // Some nesting, realistic content
        case complex    // Deep nesting, edge cases, large structures
        case stress     // Maximum complexity for performance testing

        var maxDepth: Int {
            switch self {
            case .simple: return 2
            case .moderate: return 4
            case .complex: return 8
            case .stress: return 16
            }
        }

        var maxItems: Int {
            switch self {
            case .simple: return 10
            case .moderate: return 50
            case .complex: return 200
            case .stress: return 1000
            }
        }

        var includeEdgeCases: Bool {
            switch self {
            case .simple: return false
            case .moderate: return false
            case .complex: return true
            case .stress: return true
            }
        }
    }

    // MARK: - Generator Context

    public struct GenerationContext {
        public let seed: UInt64
        public let complexity: ComplexityLevel
        public let includeUnicode: Bool
        public let includeErrorCases: Bool
        public let maxFileSize: Int // in bytes

        public init(
            seed: UInt64 = 42,
            complexity: ComplexityLevel = .moderate,
            includeUnicode: Bool = true,
            includeErrorCases: Bool = false,
            maxFileSize: Int = 1024 * 1024 // 1MB default
        ) {
            self.seed = seed
            self.complexity = complexity
            self.includeUnicode = includeUnicode
            self.includeErrorCases = includeErrorCases
            self.maxFileSize = maxFileSize
        }
    }

    // MARK: - Test Data Structure

    public struct GeneratedTestData {
        public let content: Data
        public let metadata: TestDataMetadata
        public let expectedNodes: [ExpectedNode]?
        public let isValid: Bool
        public let description: String

        public init(
            content: Data,
            metadata: TestDataMetadata,
            expectedNodes: [ExpectedNode]? = nil,
            isValid: Bool = true,
            description: String = ""
        ) {
            self.content = content
            self.metadata = metadata
            self.expectedNodes = expectedNodes
            self.isValid = isValid
            self.description = description
        }
    }

    public struct TestDataMetadata {
        public let format: String
        public let complexity: ComplexityLevel
        public let size: Int
        public let charactersUsed: Set<String>
        public let hasUnicode: Bool
        public let hasEdgeCases: Bool
        public let generatedAt: Date

        public init(
            format: String,
            complexity: ComplexityLevel,
            size: Int,
            charactersUsed: Set<String> = [],
            hasUnicode: Bool = false,
            hasEdgeCases: Bool = false
        ) {
            self.format = format
            self.complexity = complexity
            self.size = size
            self.charactersUsed = charactersUsed
            self.hasUnicode = hasUnicode
            self.hasEdgeCases = hasEdgeCases
            self.generatedAt = Date()
        }
    }

    public struct ExpectedNode {
        public let name: String
        public let content: String?
        public let nodeType: String
        public let tags: [String]
        public let metadata: [String: String]

        public init(
            name: String,
            content: String? = nil,
            nodeType: String = "note",
            tags: [String] = [],
            metadata: [String: String] = [:]
        ) {
            self.name = name
            self.content = content
            self.nodeType = nodeType
            self.tags = tags
            self.metadata = metadata
        }
    }

    // MARK: - Random Generator

    private var generator: RandomNumberGenerator

    public init(seed: UInt64 = 42) {
        var seedGenerator = SystemRandomNumberGenerator()
        seedGenerator = SystemRandomNumberGenerator() // Reset with system entropy
        self.generator = SeededRandomGenerator(seed: seed)
    }

    // MARK: - JSON Data Generator

    public func generateJSON(context: GenerationContext = GenerationContext()) async -> GeneratedTestData {
        var json: [String: Any] = [:]
        var expectedNodes: [ExpectedNode] = []
        var charactersUsed: Set<String> = []

        if context.includeErrorCases && Double.random(in: 0...1, using: &generator) < 0.3 {
            // Generate invalid JSON
            let invalidContent = generateInvalidJSON(context: context)
            return GeneratedTestData(
                content: invalidContent,
                metadata: TestDataMetadata(
                    format: "json",
                    complexity: context.complexity,
                    size: invalidContent.count,
                    charactersUsed: charactersUsed,
                    hasEdgeCases: true
                ),
                isValid: false,
                description: "Invalid JSON for error path testing"
            )
        }

        // Generate valid JSON structure
        let itemCount = generator.nextInt(in: 1...context.complexity.maxItems)

        if generator.nextDouble() < 0.5 {
            // Generate array of objects
            var items: [[String: Any]] = []
            for i in 0..<itemCount {
                let item = generateJSONObject(
                    depth: 0,
                    maxDepth: context.complexity.maxDepth,
                    context: context,
                    charactersUsed: &charactersUsed
                )
                items.append(item)

                // Create expected node
                expectedNodes.append(ExpectedNode(
                    name: item["name"] as? String ?? "Item \(i)",
                    content: item["content"] as? String,
                    nodeType: item["type"] as? String ?? "note",
                    tags: item["tags"] as? [String] ?? []
                ))
            }
            json["items"] = items
        } else {
            // Generate single object
            json = generateJSONObject(
                depth: 0,
                maxDepth: context.complexity.maxDepth,
                context: context,
                charactersUsed: &charactersUsed
            )

            expectedNodes.append(ExpectedNode(
                name: json["name"] as? String ?? "Generated Item",
                content: json["content"] as? String,
                nodeType: json["type"] as? String ?? "note",
                tags: json["tags"] as? [String] ?? []
            ))
        }

        // Convert to JSON data
        let jsonData = try! JSONSerialization.data(withJSONObject: json, options: .prettyPrinted)

        return GeneratedTestData(
            content: jsonData,
            metadata: TestDataMetadata(
                format: "json",
                complexity: context.complexity,
                size: jsonData.count,
                charactersUsed: charactersUsed,
                hasUnicode: context.includeUnicode,
                hasEdgeCases: context.complexity.includeEdgeCases
            ),
            expectedNodes: expectedNodes,
            description: "Generated JSON with \(expectedNodes.count) nodes"
        )
    }

    private func generateJSONObject(
        depth: Int,
        maxDepth: Int,
        context: GenerationContext,
        charactersUsed: inout Set<String>
    ) -> [String: Any] {
        var obj: [String: Any] = [:]

        // Required fields
        obj["id"] = UUID().uuidString
        obj["name"] = generateText(length: generator.nextInt(in: 5...50), includeUnicode: context.includeUnicode, charactersUsed: &charactersUsed)
        obj["type"] = generator.nextBool() ? "note" : (generator.nextBool() ? "task" : "idea")

        // Optional content
        if generator.nextDouble() < 0.8 {
            obj["content"] = generateText(
                length: generator.nextInt(in: 10...500),
                includeUnicode: context.includeUnicode,
                charactersUsed: &charactersUsed
            )
        }

        // Tags array
        if generator.nextDouble() < 0.6 {
            let tagCount = generator.nextInt(in: 1...5)
            var tags: [String] = []
            for _ in 0..<tagCount {
                tags.append(generateText(length: generator.nextInt(in: 3...15), includeUnicode: false, charactersUsed: &charactersUsed))
            }
            obj["tags"] = tags
        }

        // Timestamps
        let now = Date()
        let createdAt = now.addingTimeInterval(-Double(generator.nextInt(in: 0...86400))) // Last day
        obj["createdAt"] = ISO8601DateFormatter().string(from: createdAt)
        obj["modifiedAt"] = ISO8601DateFormatter().string(from: now)

        // Edge cases for complex generation
        if context.complexity.includeEdgeCases {
            if generator.nextDouble() < 0.2 {
                obj["nullValue"] = NSNull()
            }
            if generator.nextDouble() < 0.1 {
                obj["emptyString"] = ""
            }
            if generator.nextDouble() < 0.1 {
                obj["largeNumber"] = Double.greatestFiniteMagnitude
            }
        }

        // Nested objects
        if depth < maxDepth && generator.nextDouble() < 0.3 {
            obj["metadata"] = generateJSONObject(
                depth: depth + 1,
                maxDepth: maxDepth,
                context: context,
                charactersUsed: &charactersUsed
            )
        }

        return obj
    }

    private func generateInvalidJSON(context: GenerationContext) -> Data {
        let invalidPatterns = [
            "{\"name\": \"test\", \"missing\": }",  // Missing value
            "{\"name\": \"test\" \"no_comma\": true}", // Missing comma
            "{\"name\": \"test\", \"trailing\": true,}", // Trailing comma
            "{'single': 'quotes'}", // Single quotes
            "{\"unescaped\": \"line\nbreak\"}", // Unescaped newline
            "[1, 2, 3", // Unclosed array
            "undefined", // Invalid literal
            "{\"duplicate\": 1, \"duplicate\": 2}" // Duplicate keys
        ]

        let pattern = invalidPatterns[generator.nextInt(in: 0..<invalidPatterns.count)]
        return pattern.data(using: .utf8) ?? Data()
    }

    // MARK: - Markdown Data Generator

    public func generateMarkdown(context: GenerationContext = GenerationContext()) async -> GeneratedTestData {
        var markdown = ""
        var expectedNodes: [ExpectedNode] = []
        var charactersUsed: Set<String> = []

        if context.includeErrorCases && generator.nextDouble() < 0.2 {
            // Generate malformed markdown
            markdown = generateMalformedMarkdown(context: context)
            return GeneratedTestData(
                content: markdown.data(using: .utf8) ?? Data(),
                metadata: TestDataMetadata(
                    format: "markdown",
                    complexity: context.complexity,
                    size: markdown.count,
                    hasEdgeCases: true
                ),
                isValid: false,
                description: "Malformed markdown for error testing"
            )
        }

        // Generate frontmatter
        if generator.nextDouble() < 0.7 {
            markdown += generateYAMLFrontmatter(context: context, charactersUsed: &charactersUsed)
        }

        // Generate content sections
        let sectionCount = generator.nextInt(in: 1...context.complexity.maxItems / 5)

        for i in 0..<sectionCount {
            let sectionTitle = generateText(
                length: generator.nextInt(in: 10...60),
                includeUnicode: context.includeUnicode,
                charactersUsed: &charactersUsed
            )

            markdown += "\n# \(sectionTitle)\n\n"

            let contentLength = generator.nextInt(in: 50...1000)
            let content = generateMarkdownContent(
                length: contentLength,
                context: context,
                charactersUsed: &charactersUsed
            )
            markdown += content + "\n\n"

            expectedNodes.append(ExpectedNode(
                name: sectionTitle,
                content: content,
                nodeType: "note",
                tags: ["markdown", "section"]
            ))
        }

        let markdownData = markdown.data(using: .utf8) ?? Data()

        return GeneratedTestData(
            content: markdownData,
            metadata: TestDataMetadata(
                format: "markdown",
                complexity: context.complexity,
                size: markdownData.count,
                charactersUsed: charactersUsed,
                hasUnicode: context.includeUnicode,
                hasEdgeCases: context.complexity.includeEdgeCases
            ),
            expectedNodes: expectedNodes,
            description: "Generated markdown with \(sectionCount) sections"
        )
    }

    private func generateYAMLFrontmatter(context: GenerationContext, charactersUsed: inout Set<String>) -> String {
        var yaml = "---\n"
        yaml += "title: \"\(generateText(length: generator.nextInt(in: 10...50), includeUnicode: context.includeUnicode, charactersUsed: &charactersUsed))\"\n"
        yaml += "author: \"\(generateText(length: generator.nextInt(in: 5...20), includeUnicode: false, charactersUsed: &charactersUsed))\"\n"
        yaml += "date: \(ISO8601DateFormatter().string(from: Date()))\n"

        if generator.nextDouble() < 0.5 {
            let tagCount = generator.nextInt(in: 1...5)
            yaml += "tags:\n"
            for _ in 0..<tagCount {
                yaml += "  - \(generateText(length: generator.nextInt(in: 5...15), includeUnicode: false, charactersUsed: &charactersUsed))\n"
            }
        }

        yaml += "---\n\n"
        return yaml
    }

    private func generateMarkdownContent(length: Int, context: GenerationContext, charactersUsed: inout Set<String>) -> String {
        var content = ""
        let targetLength = length

        while content.count < targetLength {
            let chunkType = generator.nextInt(in: 0...6)

            switch chunkType {
            case 0: // Plain text paragraph
                content += generateText(
                    length: generator.nextInt(in: 50...200),
                    includeUnicode: context.includeUnicode,
                    charactersUsed: &charactersUsed
                ) + "\n\n"

            case 1: // Bulleted list
                let itemCount = generator.nextInt(in: 2...8)
                for _ in 0..<itemCount {
                    content += "- \(generateText(length: generator.nextInt(in: 10...60), includeUnicode: context.includeUnicode, charactersUsed: &charactersUsed))\n"
                }
                content += "\n"

            case 2: // Code block
                content += "```swift\n"
                content += "func example() {\n"
                content += "    return \"\(generateText(length: 20, includeUnicode: false, charactersUsed: &charactersUsed))\"\n"
                content += "}\n```\n\n"

            case 3: // Blockquote
                content += "> \(generateText(length: generator.nextInt(in: 30...100), includeUnicode: context.includeUnicode, charactersUsed: &charactersUsed))\n\n"

            case 4: // Table
                content += "| Column A | Column B |\n"
                content += "|----------|----------|\n"
                let rowCount = generator.nextInt(in: 2...5)
                for _ in 0..<rowCount {
                    content += "| \(generateText(length: 10, includeUnicode: false, charactersUsed: &charactersUsed)) | \(generateText(length: 10, includeUnicode: false, charactersUsed: &charactersUsed)) |\n"
                }
                content += "\n"

            case 5: // Link
                let linkText = generateText(length: generator.nextInt(in: 5...20), includeUnicode: false, charactersUsed: &charactersUsed)
                content += "[\(linkText)](https://example.com/\(linkText.lowercased().replacingOccurrences(of: " ", with: "-")))\n\n"

            case 6: // Header
                let level = generator.nextInt(in: 2...4)
                let headerText = generateText(length: generator.nextInt(in: 10...40), includeUnicode: context.includeUnicode, charactersUsed: &charactersUsed)
                content += "\(String(repeating: "#", count: level)) \(headerText)\n\n"

            default:
                break
            }
        }

        return String(content.prefix(targetLength))
    }

    private func generateMalformedMarkdown(context: GenerationContext) -> String {
        let malformedPatterns = [
            "# Unclosed [link",
            "```unclosed\ncode block",
            "| Broken table\n| Missing header |",
            "![Missing image]()",
            "## Header\n### Wrong nesting\n# Back to h1",
            "<unclosed html tag>",
            "[Broken reference link][nonexistent]"
        ]

        return malformedPatterns[generator.nextInt(in: 0..<malformedPatterns.count)]
    }

    // MARK: - SQLite Data Generator

    public func generateSQLiteDatabase(context: GenerationContext = GenerationContext()) async -> GeneratedTestData {
        // Generate SQLite database content as SQL commands
        var sql = ""
        var expectedNodes: [ExpectedNode] = []
        var charactersUsed: Set<String> = []

        if context.includeErrorCases && generator.nextDouble() < 0.2 {
            sql = generateCorruptedSQLite(context: context)
            return GeneratedTestData(
                content: sql.data(using: .utf8) ?? Data(),
                metadata: TestDataMetadata(
                    format: "sqlite",
                    complexity: context.complexity,
                    size: sql.count,
                    hasEdgeCases: true
                ),
                isValid: false,
                description: "Corrupted SQLite for error testing"
            )
        }

        // Create tables based on Apple app formats
        let tableType = generator.nextInt(in: 0...2)

        switch tableType {
        case 0: // Apple Notes format
            sql += generateAppleNotesSchema()
            sql += generateAppleNotesData(context: context, expectedNodes: &expectedNodes, charactersUsed: &charactersUsed)

        case 1: // Generic note app format
            sql += generateGenericNotesSchema()
            sql += generateGenericNotesData(context: context, expectedNodes: &expectedNodes, charactersUsed: &charactersUsed)

        case 2: // Todo app format
            sql += generateTodoSchema()
            sql += generateTodoData(context: context, expectedNodes: &expectedNodes, charactersUsed: &charactersUsed)

        default:
            break
        }

        let sqlData = sql.data(using: .utf8) ?? Data()

        return GeneratedTestData(
            content: sqlData,
            metadata: TestDataMetadata(
                format: "sqlite",
                complexity: context.complexity,
                size: sqlData.count,
                charactersUsed: charactersUsed,
                hasUnicode: context.includeUnicode,
                hasEdgeCases: context.complexity.includeEdgeCases
            ),
            expectedNodes: expectedNodes,
            description: "Generated SQLite database with \(expectedNodes.count) records"
        )
    }

    private func generateAppleNotesSchema() -> String {
        return """
        CREATE TABLE ZNOTE (
            Z_PK INTEGER PRIMARY KEY,
            ZTITLE TEXT,
            ZBODY TEXT,
            ZCREATIONDATE REAL,
            ZMODIFICATIONDATE REAL,
            ZFOLDER INTEGER
        );

        CREATE TABLE ZFOLDER (
            Z_PK INTEGER PRIMARY KEY,
            ZNAME TEXT
        );

        """
    }

    private func generateAppleNotesData(
        context: GenerationContext,
        expectedNodes: inout [ExpectedNode],
        charactersUsed: inout Set<String>
    ) -> String {
        var sql = ""
        let noteCount = generator.nextInt(in: 1...context.complexity.maxItems)

        // Insert folders
        sql += "INSERT INTO ZFOLDER (Z_PK, ZNAME) VALUES (1, 'Test Folder');\n"

        // Insert notes
        for i in 1...noteCount {
            let title = generateText(
                length: generator.nextInt(in: 5...50),
                includeUnicode: context.includeUnicode,
                charactersUsed: &charactersUsed
            )
            let body = generateText(
                length: generator.nextInt(in: 20...500),
                includeUnicode: context.includeUnicode,
                charactersUsed: &charactersUsed
            )

            let creationDate = Date().addingTimeInterval(-Double(generator.nextInt(in: 0...86400))).timeIntervalSince1970
            let modificationDate = Date().timeIntervalSince1970

            sql += "INSERT INTO ZNOTE (Z_PK, ZTITLE, ZBODY, ZCREATIONDATE, ZMODIFICATIONDATE, ZFOLDER) VALUES "
            sql += "(\(i), '\(title.replacingOccurrences(of: "'", with: "''"))', '\(body.replacingOccurrences(of: "'", with: "''"))', \(creationDate), \(modificationDate), 1);\n"

            expectedNodes.append(ExpectedNode(
                name: title,
                content: body,
                nodeType: "note",
                tags: ["apple-notes"]
            ))
        }

        return sql
    }

    private func generateGenericNotesSchema() -> String {
        return """
        CREATE TABLE notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            tags TEXT
        );

        """
    }

    private func generateGenericNotesData(
        context: GenerationContext,
        expectedNodes: inout [ExpectedNode],
        charactersUsed: inout Set<String>
    ) -> String {
        var sql = ""
        let noteCount = generator.nextInt(in: 1...context.complexity.maxItems)

        for i in 1...noteCount {
            let title = generateText(
                length: generator.nextInt(in: 5...50),
                includeUnicode: context.includeUnicode,
                charactersUsed: &charactersUsed
            )
            let content = generateText(
                length: generator.nextInt(in: 20...500),
                includeUnicode: context.includeUnicode,
                charactersUsed: &charactersUsed
            )

            let tagCount = generator.nextInt(in: 0...5)
            var tags: [String] = []
            for _ in 0..<tagCount {
                tags.append(generateText(length: generator.nextInt(in: 3...15), includeUnicode: false, charactersUsed: &charactersUsed))
            }
            let tagsJson = tags.isEmpty ? "NULL" : "'\(tags.joined(separator: ","))'"

            sql += "INSERT INTO notes (title, content, tags) VALUES "
            sql += "('\(title.replacingOccurrences(of: "'", with: "''"))', '\(content.replacingOccurrences(of: "'", with: "''"))', \(tagsJson));\n"

            expectedNodes.append(ExpectedNode(
                name: title,
                content: content,
                nodeType: "note",
                tags: tags
            ))
        }

        return sql
    }

    private func generateTodoSchema() -> String {
        return """
        CREATE TABLE tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            completed BOOLEAN DEFAULT FALSE,
            due_date TIMESTAMP,
            priority INTEGER DEFAULT 1
        );

        """
    }

    private func generateTodoData(
        context: GenerationContext,
        expectedNodes: inout [ExpectedNode],
        charactersUsed: inout Set<String>
    ) -> String {
        var sql = ""
        let taskCount = generator.nextInt(in: 1...context.complexity.maxItems)

        for _ in 1...taskCount {
            let title = generateText(
                length: generator.nextInt(in: 5...50),
                includeUnicode: context.includeUnicode,
                charactersUsed: &charactersUsed
            )
            let description = generator.nextBool() ? generateText(
                length: generator.nextInt(in: 20...200),
                includeUnicode: context.includeUnicode,
                charactersUsed: &charactersUsed
            ) : nil
            let completed = generator.nextBool()
            let priority = generator.nextInt(in: 1...5)

            let descriptionValue = description?.replacingOccurrences(of: "'", with: "''") ?? "NULL"
            sql += "INSERT INTO tasks (title, description, completed, priority) VALUES "
            sql += "('\(title.replacingOccurrences(of: "'", with: "''"))', '\(descriptionValue)', \(completed ? 1 : 0), \(priority));\n"

            expectedNodes.append(ExpectedNode(
                name: title,
                content: description,
                nodeType: "task",
                tags: ["todo", "priority-\(priority)"],
                metadata: ["completed": String(completed)]
            ))
        }

        return sql
    }

    private func generateCorruptedSQLite(context: GenerationContext) -> String {
        let corruptedPatterns = [
            "CRATE TABLE broken;", // Syntax error
            "INSERT INTO nonexistent VALUES (1);", // Missing table
            "CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO test VALUES (1, 'test', 'extra');", // Wrong column count
            "SQLite format 3\0\0\0corrupted", // Binary corruption simulation
            "CREATE TABLE test (id INTEGER, name TEXT); CREATE TABLE test (id INTEGER);", // Duplicate table
        ]

        return corruptedPatterns[generator.nextInt(in: 0..<corruptedPatterns.count)]
    }

    // MARK: - HTML Data Generator

    public func generateHTML(context: GenerationContext = GenerationContext()) async -> GeneratedTestData {
        var html = ""
        var expectedNodes: [ExpectedNode] = []
        var charactersUsed: Set<String> = []

        if context.includeErrorCases && generator.nextDouble() < 0.2 {
            html = generateMalformedHTML(context: context)
            return GeneratedTestData(
                content: html.data(using: .utf8) ?? Data(),
                metadata: TestDataMetadata(
                    format: "html",
                    complexity: context.complexity,
                    size: html.count,
                    hasEdgeCases: true
                ),
                isValid: false,
                description: "Malformed HTML for error testing"
            )
        }

        // Generate well-formed HTML
        html = generateValidHTML(context: context, expectedNodes: &expectedNodes, charactersUsed: &charactersUsed)

        let htmlData = html.data(using: .utf8) ?? Data()

        return GeneratedTestData(
            content: htmlData,
            metadata: TestDataMetadata(
                format: "html",
                complexity: context.complexity,
                size: htmlData.count,
                charactersUsed: charactersUsed,
                hasUnicode: context.includeUnicode,
                hasEdgeCases: context.complexity.includeEdgeCases
            ),
            expectedNodes: expectedNodes,
            description: "Generated HTML with \(expectedNodes.count) content blocks"
        )
    }

    private func generateValidHTML(
        context: GenerationContext,
        expectedNodes: inout [ExpectedNode],
        charactersUsed: inout Set<String>
    ) -> String {
        let title = generateText(length: generator.nextInt(in: 10...50), includeUnicode: context.includeUnicode, charactersUsed: &charactersUsed)

        var html = """
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>\(title)</title>
        </head>
        <body>
            <h1>\(title)</h1>

        """

        let sectionCount = generator.nextInt(in: 1...context.complexity.maxItems / 3)

        for _ in 0..<sectionCount {
            let sectionTitle = generateText(
                length: generator.nextInt(in: 10...40),
                includeUnicode: context.includeUnicode,
                charactersUsed: &charactersUsed
            )
            let content = generateText(
                length: generator.nextInt(in: 50...300),
                includeUnicode: context.includeUnicode,
                charactersUsed: &charactersUsed
            )

            html += """
                <section>
                    <h2>\(sectionTitle)</h2>
                    <p>\(content)</p>
                </section>

            """

            expectedNodes.append(ExpectedNode(
                name: sectionTitle,
                content: content,
                nodeType: "article",
                tags: ["html", "web"]
            ))
        }

        html += """
        </body>
        </html>
        """

        return html
    }

    private func generateMalformedHTML(context: GenerationContext) -> String {
        let malformedPatterns = [
            "<html><head><title>Test</title><body><h1>Unclosed header",
            "<html><body><div><p>Nested <span>unclosed span</p></div></body></html>",
            "<html><body>Invalid &entity; character</body></html>",
            "<html><body><img src=\"broken.jpg\" invalid-attribute></body></html>",
            "<!DOCTYPE html><html><head></head><body><script>alert('test')</script></body>", // Missing closing html
            "<html><body><!-- Unclosed comment",
            "<html><body><table><tr><td>Missing closing table tags</body></html>"
        ]

        return malformedPatterns[generator.nextInt(in: 0..<malformedPatterns.count)]
    }

    // MARK: - Text Generation Utilities

    private func generateText(length: Int, includeUnicode: Bool, charactersUsed: inout Set<String>) -> String {
        let basicChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?-"
        let unicodeChars = "áéíóúñç中文🎉📝💡🔥⭐️👍🏼🌟"

        var characterPool = Array(basicChars)
        if includeUnicode && generator.nextDouble() < 0.3 {
            characterPool.append(contentsOf: Array(unicodeChars))
        }

        var result = ""
        for _ in 0..<length {
            let char = characterPool[generator.nextInt(in: 0..<characterPool.count)]
            result.append(char)
            charactersUsed.insert(String(char))
        }

        return result
    }

    // MARK: - Validation

    public func validateGeneratedData(_ data: GeneratedTestData) -> Bool {
        // Basic validation
        guard !data.content.isEmpty else { return false }
        guard data.metadata.size == data.content.count else { return false }

        // Format-specific validation
        switch data.metadata.format {
        case "json":
            if data.isValid {
                do {
                    _ = try JSONSerialization.jsonObject(with: data.content, options: [])
                    return true
                } catch {
                    return false
                }
            }
            return true // Invalid JSON is expected for error cases

        case "markdown":
            if data.isValid {
                // Basic markdown structure validation
                let content = String(data: data.content, encoding: .utf8) ?? ""
                return !content.isEmpty
            }
            return true

        case "sqlite", "office", "html":
            return !data.content.isEmpty

        default:
            return false
        }
    }
}

// MARK: - Seeded Random Generator

private struct SeededRandomGenerator: RandomNumberGenerator {
    private var seed: UInt64

    init(seed: UInt64) {
        self.seed = seed
    }

    mutating func next() -> UInt64 {
        seed = seed &* 0x5851_F42D_4C95_7F2D &+ 0x14057B7E_F767_814F
        return seed
    }

    mutating func nextBool() -> Bool {
        return next() % 2 == 0
    }

    mutating func nextDouble() -> Double {
        return Double(next() % 1000) / 1000.0
    }

    mutating func nextInt(in range: ClosedRange<Int>) -> Int {
        let rangeSize = UInt64(range.upperBound - range.lowerBound + 1)
        return range.lowerBound + Int(next() % rangeSize)
    }
}