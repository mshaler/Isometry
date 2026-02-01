import Foundation
import Testing

/// Realistic test data generators for comprehensive Apple Notes data lifecycle validation
/// Generates edge cases, stress test data, and boundary conditions for property-based testing
public actor DataGenerators {

    private var generator: SeededRandomGenerator
    private let testDataGenerator: TestDataGenerator

    public init(seed: UInt64 = 42) {
        self.generator = SeededRandomGenerator(seed: seed)
        self.testDataGenerator = TestDataGenerator(seed: seed)
    }

    // MARK: - Apple Notes Data Generation

    /// Generate realistic Apple Notes data with varying complexity
    public func generateAppleNotesData() async -> AppleNotesTestData {
        let complexity = chooseComplexity()
        let context = TestDataGenerator.GenerationContext(
            seed: generator.next(),
            complexity: complexity,
            includeUnicode: generator.nextBool(),
            includeErrorCases: false,
            maxFileSize: complexity.maxItems * 1024
        )

        let generatedData = await testDataGenerator.generateMarkdown(context: context)

        // Extract expected Unicode characters
        var unicodeChars: Set<Unicode.Scalar> = []
        if let content = String(data: generatedData.content, encoding: .utf8) {
            for scalar in content.unicodeScalars {
                if !scalar.isASCII {
                    unicodeChars.insert(scalar)
                }
            }
        }

        return AppleNotesTestData(
            data: generatedData.content,
            filename: "test-note-\(UUID().uuidString.prefix(8)).md",
            expectedNodeCount: generatedData.expectedNodes?.count ?? 1,
            expectedUnicodeChars: unicodeChars
        )
    }

    /// Generate complete database state for testing
    public func generateDatabaseState() async -> DatabaseTestState {
        let nodeCount = generator.nextInt(in: 5...50)
        var nodes: [Node] = []

        for i in 0..<nodeCount {
            let node = generateRandomNode(index: i)
            nodes.append(node)
        }

        let metadata = [
            "generator": "DataGenerators",
            "seed": String(generator.seed),
            "node_count": String(nodeCount),
            "generated_at": ISO8601DateFormatter().string(from: Date())
        ]

        return DatabaseTestState(
            nodes: nodes,
            metadata: metadata
        )
    }

    /// Generate purge scenario with specific criteria
    public func generatePurgeScenario() async -> PurgeTestScenario {
        let totalNodes = generator.nextInt(in: 10...100)
        var nodes: [Node] = []

        let baseDate = Date().addingTimeInterval(-TimeInterval(generator.nextInt(in: 86400...864000))) // 1-10 days ago

        for i in 0..<totalNodes {
            let createdAt = baseDate.addingTimeInterval(TimeInterval(i * 3600)) // 1 hour apart
            let node = generateRandomNode(index: i, createdAt: createdAt)
            nodes.append(node)
        }

        // Generate purge criteria that will affect some but not all nodes
        let purgeStartDate = baseDate.addingTimeInterval(TimeInterval(totalNodes * 1800)) // Midpoint
        let purgeEndDate = Date().addingTimeInterval(-TimeInterval(3600)) // 1 hour ago

        let purgeConfig = PurgeConfiguration(
            dateRange: DateRange(start: purgeStartDate, end: purgeEndDate),
            includeAttachments: generator.nextBool(),
            dryRun: false
        )

        return PurgeTestScenario(
            initialNodes: nodes,
            purgeConfig: purgeConfig
        )
    }

    /// Generate semantic test data with rich meaning
    public func generateSemanticTestData() async -> SemanticTestData {
        let elementCount = generator.nextInt(in: 3...15)
        var semanticElements: [SemanticElement] = []

        for i in 0..<elementCount {
            let elementType = chooseSemanticType()
            let content = generateSemanticContent(type: elementType)
            let metadata = generateSemanticMetadata(type: elementType)

            let element = SemanticElement(
                type: elementType,
                content: content,
                metadata: metadata
            )
            semanticElements.append(element)
        }

        // Convert to markdown format
        let markdownContent = generateMarkdownFromSemantic(elements: semanticElements)
        let data = markdownContent.data(using: .utf8) ?? Data()

        return SemanticTestData(
            data: data,
            filename: "semantic-test-\(UUID().uuidString.prefix(8)).md",
            expectedSemanticElements: semanticElements
        )
    }

    /// Generate LATCH-rich test data
    public func generateLATCHTestData() async -> LATCHTestData {
        let latchMapping = generateLATCHMapping()
        let markdownContent = generateMarkdownFromLATCH(mapping: latchMapping)
        let data = markdownContent.data(using: .utf8) ?? Data()

        return LATCHTestData(
            data: data,
            filename: "latch-test-\(UUID().uuidString.prefix(8)).md",
            expectedLATCHMapping: latchMapping
        )
    }

    /// Generate large dataset for performance testing
    public func generateLargeDataset() async -> LargeDatasetTestData {
        let nodeCount = generator.nextInt(in: 500...2000)
        var content = "---\ntitle: \"Large Dataset Test\"\ngenerated_nodes: \(nodeCount)\n---\n\n"

        for i in 0..<nodeCount {
            content += "# Note \(i + 1)\n\n"
            content += generateText(length: generator.nextInt(in: 100...500))
            content += "\n\n"

            // Add some variety
            if generator.nextDouble() < 0.3 {
                content += "## Subsection\n\n"
                content += generateText(length: generator.nextInt(in: 50...200))
                content += "\n\n"
            }

            if generator.nextDouble() < 0.2 {
                content += "- List item 1\n- List item 2\n- List item 3\n\n"
            }
        }

        let data = content.data(using: .utf8) ?? Data()

        return LargeDatasetTestData(
            data: data,
            filename: "large-dataset-\(nodeCount)-nodes.md",
            nodeCount: nodeCount,
            estimatedSizeBytes: data.count
        )
    }

    /// Generate concurrent test scenario
    public func generateConcurrentScenario() async -> ConcurrentTestScenario {
        let threadCount = generator.nextInt(in: 3...8)
        var concurrentData: [AppleNotesTestData] = []

        for i in 0..<threadCount {
            let data = await generateAppleNotesData()
            concurrentData.append(AppleNotesTestData(
                data: data.data,
                filename: "concurrent-\(i)-\(data.filename)",
                expectedNodeCount: data.expectedNodeCount,
                expectedUnicodeChars: data.expectedUnicodeChars
            ))
        }

        let expectedTotalNodes = concurrentData.map { $0.expectedNodeCount }.reduce(0, +)

        return ConcurrentTestScenario(
            concurrentData: concurrentData,
            expectedTotalNodes: expectedTotalNodes
        )
    }

    /// Generate Unicode stress test data
    public func generateUnicodeStressTest() async -> UnicodeTestData {
        let unicodeChars: [Unicode.Scalar] = [
            "\u{1F600}", // 😀
            "\u{1F4DD}", // 📝
            "\u{2603}",  // ☃
            "\u{03B1}",  // α
            "\u{4E2D}",  // 中
            "\u{1F1FA}\u{1F1F8}", // 🇺🇸
            "\u{0301}",  // Combining acute accent
            "\u{200D}",  // Zero-width joiner
        ]

        var content = "---\ntitle: \"Unicode Stress Test 🧪\"\ntags: [\"unicode\", \"test\"]\n---\n\n"
        content += "# Unicode Content Test\n\n"

        var expectedUnicodeChars: Set<Unicode.Scalar> = []

        for char in unicodeChars {
            content += "Unicode character: \(Character(char)) (U+\(String(char.value, radix: 16, uppercase: true)))\n\n"
            expectedUnicodeChars.insert(char)
        }

        // Add mixed Unicode text
        let mixedText = "Mixed text with émojis 🎉 and 中文 characters α β γ"
        content += mixedText + "\n\n"

        for scalar in mixedText.unicodeScalars {
            if !scalar.isASCII {
                expectedUnicodeChars.insert(scalar)
            }
        }

        let data = content.data(using: .utf8) ?? Data()

        return UnicodeTestData(
            data: data,
            filename: "unicode-stress-test.md",
            expectedUnicodeChars: expectedUnicodeChars
        )
    }

    /// Generate boundary condition test cases
    public func generateBoundaryConditions() async -> BoundaryTestData {
        let boundaryType = generator.nextInt(in: 0...6)

        switch boundaryType {
        case 0: // Empty file
            return BoundaryTestData(
                data: Data(),
                filename: "empty.md",
                shouldSucceed: false,
                description: "Empty file"
            )

        case 1: // Single character
            return BoundaryTestData(
                data: "a".data(using: .utf8) ?? Data(),
                filename: "single-char.md",
                shouldSucceed: true,
                description: "Single character file"
            )

        case 2: // Very large file
            let largeContent = String(repeating: "A", count: 10_000_000) // 10MB
            return BoundaryTestData(
                data: largeContent.data(using: .utf8) ?? Data(),
                filename: "very-large.md",
                shouldSucceed: true,
                description: "Very large file (10MB)"
            )

        case 3: // Invalid UTF-8
            let invalidUTF8 = Data([0xFF, 0xFE, 0x00, 0x00]) // Invalid UTF-8 sequence
            return BoundaryTestData(
                data: invalidUTF8,
                filename: "invalid-utf8.md",
                shouldSucceed: false,
                description: "Invalid UTF-8 encoding"
            )

        case 4: // Deeply nested structure
            var nested = "# Level 1\n"
            for level in 2...100 {
                nested += String(repeating: "#", count: level) + " Level \(level)\nContent for level \(level)\n\n"
            }
            return BoundaryTestData(
                data: nested.data(using: .utf8) ?? Data(),
                filename: "deeply-nested.md",
                shouldSucceed: true,
                description: "Deeply nested structure (100 levels)"
            )

        case 5: // Special characters only
            let specialChars = "!@#$%^&*()_+-={}[]|\\:;\"'<>,.?/~`"
            return BoundaryTestData(
                data: specialChars.data(using: .utf8) ?? Data(),
                filename: "special-chars.md",
                shouldSucceed: true,
                description: "Special characters only"
            )

        default: // Long lines
            let longLine = String(repeating: "Very long line content ", count: 10000)
            return BoundaryTestData(
                data: longLine.data(using: .utf8) ?? Data(),
                filename: "long-lines.md",
                shouldSucceed: true,
                description: "Very long lines"
            )
        }
    }

    // MARK: - Helper Methods

    private func chooseComplexity() -> TestDataGenerator.ComplexityLevel {
        let rand = generator.nextDouble()
        if rand < 0.4 { return .simple }
        if rand < 0.7 { return .moderate }
        if rand < 0.9 { return .complex }
        return .stress
    }

    private func generateRandomNode(index: Int, createdAt: Date? = nil) -> Node {
        let baseDate = createdAt ?? Date().addingTimeInterval(-TimeInterval(generator.nextInt(in: 0...86400)))
        let modifiedDate = baseDate.addingTimeInterval(TimeInterval(generator.nextInt(in: 0...3600)))

        let nodeTypes = ["note", "task", "idea", "reference"]
        let folders = ["Work", "Personal", "Research", "Archive", nil]
        let tags = ["important", "todo", "draft", "review", "archive"]

        var selectedTags: [String] = []
        let tagCount = generator.nextInt(in: 0...3)
        for _ in 0..<tagCount {
            selectedTags.append(tags[generator.nextInt(in: 0..<tags.count)])
        }

        return Node(
            id: "node-\(index)-\(UUID().uuidString.prefix(8))",
            nodeType: nodeTypes[generator.nextInt(in: 0..<nodeTypes.count)],
            name: "Test Node \(index + 1): \(generateText(length: generator.nextInt(in: 10...50)))",
            content: generateText(length: generator.nextInt(in: 100...1000)),
            summary: generateText(length: generator.nextInt(in: 20...100)),
            createdAt: baseDate,
            modifiedAt: modifiedDate,
            folder: folders[generator.nextInt(in: 0..<folders.count)],
            tags: selectedTags,
            source: "test-generator",
            sourceId: "test-\(index)",
            priority: generator.nextInt(in: 1...10),
            importance: generator.nextInt(in: 1...10),
            version: generator.nextInt(in: 1...5)
        )
    }

    private func chooseSemanticType() -> String {
        let types = ["heading", "paragraph", "list", "quote", "code", "table", "link"]
        return types[generator.nextInt(in: 0..<types.count)]
    }

    private func generateSemanticContent(type: String) -> String {
        switch type {
        case "heading":
            return generateText(length: generator.nextInt(in: 10...50))
        case "paragraph":
            return generateText(length: generator.nextInt(in: 50...200))
        case "list":
            let itemCount = generator.nextInt(in: 2...5)
            return (0..<itemCount).map { "Item \($0 + 1): \(generateText(length: generator.nextInt(in: 10...30)))" }.joined(separator: "\n")
        case "quote":
            return "Quote: \(generateText(length: generator.nextInt(in: 20...100)))"
        case "code":
            return "function example() { return '\(generateText(length: 20))'; }"
        case "table":
            return "Column A | Column B\nValue 1 | Value 2"
        case "link":
            return "Link to \(generateText(length: 10))"
        default:
            return generateText(length: 50)
        }
    }

    private func generateSemanticMetadata(type: String) -> [String: String] {
        var metadata: [String: String] = ["type": type]

        switch type {
        case "heading":
            metadata["level"] = String(generator.nextInt(in: 1...6))
        case "list":
            metadata["style"] = generator.nextBool() ? "ordered" : "unordered"
        case "code":
            metadata["language"] = "javascript"
        default:
            break
        }

        return metadata
    }

    private func generateMarkdownFromSemantic(elements: [SemanticElement]) -> String {
        var markdown = "---\ntitle: \"Semantic Test Document\"\n---\n\n"

        for element in elements {
            switch element.type {
            case "heading":
                let level = Int(element.metadata["level"] ?? "1") ?? 1
                markdown += String(repeating: "#", count: level) + " \(element.content)\n\n"
            case "paragraph":
                markdown += "\(element.content)\n\n"
            case "list":
                let items = element.content.components(separatedBy: "\n")
                for item in items {
                    markdown += "- \(item)\n"
                }
                markdown += "\n"
            case "quote":
                markdown += "> \(element.content)\n\n"
            case "code":
                markdown += "```javascript\n\(element.content)\n```\n\n"
            case "table":
                markdown += "\(element.content)\n\n"
            case "link":
                markdown += "[\(element.content)](https://example.com)\n\n"
            default:
                markdown += "\(element.content)\n\n"
            }
        }

        return markdown
    }

    private func generateLATCHMapping() -> LATCHMapping {
        let location = generator.nextBool() ? LocationData(
            latitude: Double(generator.nextInt(in: -90...90)),
            longitude: Double(generator.nextInt(in: -180...180)),
            address: "Test Address \(generator.nextInt(in: 1...999))"
        ) : nil

        let alphabet = AlphabetData(
            titles: (1...5).map { "Title \($0): \(generateText(length: 20))" },
            content: (1...3).map { generateText(length: 100) },
            searchTerms: (1...10).map { generateText(length: 10) }
        )

        let time = TimeData(
            created: [Date(), Date().addingTimeInterval(-3600)],
            modified: [Date(), Date().addingTimeInterval(-1800)],
            temporal_relationships: ["before", "after", "during"]
        )

        let category = CategoryData(
            folders: ["Work", "Personal", "Projects"],
            tags: ["important", "urgent", "reference"],
            types: ["note", "task", "idea"]
        )

        let hierarchy = HierarchyData(
            parentChildRelations: [
                (parent: "root", child: "child1"),
                (parent: "child1", child: "grandchild1")
            ],
            sortOrders: [1, 2, 3, 4, 5],
            depths: [0, 1, 2, 1, 0]
        )

        return LATCHMapping(
            location: location,
            alphabet: alphabet,
            time: time,
            category: category,
            hierarchy: hierarchy
        )
    }

    private func generateMarkdownFromLATCH(mapping: LATCHMapping) -> String {
        var markdown = "---\n"
        markdown += "title: \"\(mapping.alphabet.titles.first ?? "LATCH Test")\"\n"

        if let location = mapping.location {
            markdown += "location:\n"
            if let lat = location.latitude, let lng = location.longitude {
                markdown += "  latitude: \(lat)\n"
                markdown += "  longitude: \(lng)\n"
            }
            if let address = location.address {
                markdown += "  address: \"\(address)\"\n"
            }
        }

        markdown += "created: \(ISO8601DateFormatter().string(from: mapping.time.created.first ?? Date()))\n"
        markdown += "modified: \(ISO8601DateFormatter().string(from: mapping.time.modified.first ?? Date()))\n"

        if !mapping.category.folders.isEmpty {
            markdown += "folder: \"\(mapping.category.folders.first!)\"\n"
        }

        if !mapping.category.tags.isEmpty {
            markdown += "tags:\n"
            for tag in mapping.category.tags {
                markdown += "  - \(tag)\n"
            }
        }

        markdown += "---\n\n"

        // Add hierarchical content
        for (index, content) in mapping.alphabet.content.enumerated() {
            let depth = mapping.hierarchy.depths.count > index ? mapping.hierarchy.depths[index] : 0
            let level = depth + 1
            markdown += String(repeating: "#", count: level) + " Section \(index + 1)\n\n"
            markdown += "\(content)\n\n"
        }

        return markdown
    }

    private func generateText(length: Int) -> String {
        let words = [
            "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
            "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et",
            "dolore", "magna", "aliqua", "enim", "ad", "minim", "veniam", "quis",
            "nostrud", "exercitation", "ullamco", "laboris", "nisi", "aliquip", "ex",
            "ea", "commodo", "consequat", "duis", "aute", "irure", "in", "reprehenderit",
            "voluptate", "velit", "esse", "cillum", "fugiat", "nulla", "pariatur"
        ]

        var result = ""
        var currentLength = 0

        while currentLength < length {
            let word = words[generator.nextInt(in: 0..<words.count)]
            if currentLength > 0 {
                result += " "
                currentLength += 1
            }
            result += word
            currentLength += word.count

            // Occasionally add punctuation
            if generator.nextDouble() < 0.1 && currentLength < length - 10 {
                let punctuation = [".", ",", "!", "?"]
                result += punctuation[generator.nextInt(in: 0..<punctuation.count)]
                currentLength += 1
            }
        }

        return String(result.prefix(length))
    }
}

// MARK: - Supporting Extensions

extension DataGenerators {
    /// Seeded random generator for reproducible test data
    private struct SeededRandomGenerator {
        private var seed: UInt64

        var seedValue: UInt64 { return seed }

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
}

// MARK: - Missing Configuration Types

public struct PurgeConfiguration {
    public let dateRange: DateRange?
    public let includeAttachments: Bool
    public let dryRun: Bool

    public init(dateRange: DateRange? = nil, includeAttachments: Bool = false, dryRun: Bool = false) {
        self.dateRange = dateRange
        self.includeAttachments = includeAttachments
        self.dryRun = dryRun
    }
}

public struct DateRange {
    public let start: Date
    public let end: Date

    public init(start: Date, end: Date) {
        self.start = start
        self.end = end
    }
}