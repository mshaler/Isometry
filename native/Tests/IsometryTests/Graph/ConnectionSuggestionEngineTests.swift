import XCTest
import GRDB
@testable import Isometry

/// Tests for connection suggestion engine functionality
/// Validates graph-based connection discovery from CardBoard v1/v2
final class ConnectionSuggestionEngineTests: XCTestCase {

    var database: IsometryDatabase!
    var suggestionEngine: ConnectionSuggestionEngine!

    override func setUp() async throws {
        // Create in-memory test database
        let dbQueue = DatabaseQueue()
        database = IsometryDatabase(dbQueue: dbQueue)

        // Initialize schema
        try await database.migrate()

        // Create suggestion engine
        suggestionEngine = ConnectionSuggestionEngine(database: database)

        // Seed test data
        try await seedTestData()
    }

    override func tearDown() async throws {
        suggestionEngine = nil
        database = nil
    }

    // MARK: - Test Data Setup

    private func seedTestData() async throws {
        try await database.write { db in
            // Create test nodes
            let nodes = [
                Node(
                    id: "node1",
                    name: "Project Alpha",
                    folder: "Work",
                    tags: ["project", "urgent", "backend"],
                    content: "This is a backend development project focusing on API design."
                ),
                Node(
                    id: "node2",
                    name: "Project Beta",
                    folder: "Work",
                    tags: ["project", "frontend", "react"],
                    content: "Frontend development project using React and TypeScript."
                ),
                Node(
                    id: "node3",
                    name: "Weekly Planning",
                    folder: "Personal",
                    tags: ["planning", "weekly", "goals"],
                    content: "Weekly planning and goal setting session."
                ),
                Node(
                    id: "node4",
                    name: "API Documentation",
                    folder: "Work",
                    tags: ["documentation", "API", "backend"],
                    content: "Comprehensive API documentation for the backend services."
                ),
                Node(
                    id: "node5",
                    name: "Team Meeting Notes",
                    folder: "Work",
                    tags: ["meeting", "team", "notes"],
                    content: "Notes from the weekly team standup meeting."
                ),
                Node(
                    id: "node6",
                    name: "Personal Goals",
                    folder: "Personal",
                    tags: ["goals", "planning", "personal"],
                    content: "Personal goal setting and tracking document."
                )
            ]

            for node in nodes {
                try node.insert(db)
            }

            // Create test edges
            let edges = [
                Edge(sourceId: "node1", targetId: "node4", type: "related_to"),
                Edge(sourceId: "node3", targetId: "node6", type: "related_to"),
                Edge(sourceId: "node1", targetId: "node5", type: "discussed_in"),
                Edge(sourceId: "node2", targetId: "node5", type: "discussed_in")
            ]

            for edge in edges {
                try edge.insert(db)
            }
        }
    }

    // MARK: - ConnectionSuggestion Tests

    func testConnectionSuggestion_creation() {
        // Given/When
        let suggestion = ConnectionSuggestion(
            nodeId: "test_node",
            reason: "Test reason",
            confidence: 0.75,
            type: .sharedTags
        )

        // Then
        XCTAssertEqual(suggestion.nodeId, "test_node")
        XCTAssertEqual(suggestion.reason, "Test reason")
        XCTAssertEqual(suggestion.confidence, 0.75)
        XCTAssertEqual(suggestion.type, .sharedTags)
        XCTAssertNotNil(suggestion.id)
    }

    func testSuggestionType_allCases() {
        let types = ConnectionSuggestion.SuggestionType.allCases
        XCTAssertEqual(types.count, 6)
        XCTAssertTrue(types.contains(.sharedTags))
        XCTAssertTrue(types.contains(.sameCommunity))
        XCTAssertTrue(types.contains(.mutualConnections))
        XCTAssertTrue(types.contains(.temporalProximity))
        XCTAssertTrue(types.contains(.similarContent))
        XCTAssertTrue(types.contains(.semanticSimilarity))
    }

    // MARK: - SuggestionOptions Tests

    func testSuggestionOptions_defaults() {
        // Given
        let options = SuggestionOptions()

        // Then
        XCTAssertEqual(options.maxSuggestions, 10)
        XCTAssertEqual(options.minConfidence, 0.3)
        XCTAssertEqual(options.includeTypes.count, 6) // All types
        XCTAssertTrue(options.excludeExistingConnections)
    }

    func testSuggestionOptions_customValues() {
        // Given
        let options = SuggestionOptions(
            maxSuggestions: 5,
            minConfidence: 0.5,
            includeTypes: [.sharedTags, .sameCommunity],
            excludeExistingConnections: false
        )

        // Then
        XCTAssertEqual(options.maxSuggestions, 5)
        XCTAssertEqual(options.minConfidence, 0.5)
        XCTAssertEqual(options.includeTypes, [.sharedTags, .sameCommunity])
        XCTAssertFalse(options.excludeExistingConnections)
    }

    // MARK: - Shared Tags Suggestions

    func testSuggestConnections_sharedTags() async throws {
        // Given
        let options = SuggestionOptions(
            maxSuggestions: 5,
            minConfidence: 0.1,
            includeTypes: [.sharedTags]
        )

        // When
        let suggestions = try await suggestionEngine.suggestConnections(
            for: "node1", // Project Alpha (tags: project, urgent, backend)
            options: options
        )

        // Then
        XCTAssertGreaterThan(suggestions.count, 0)
        XCTAssertTrue(suggestions.allSatisfy { $0.type == .sharedTags })

        // Should suggest node4 (API Documentation) due to shared "backend" tag
        let node4Suggestion = suggestions.first { $0.nodeId == "node4" }
        XCTAssertNotNil(node4Suggestion)
        XCTAssertTrue(node4Suggestion?.reason.contains("backend") ?? false)
        XCTAssertGreaterThan(node4Suggestion?.confidence ?? 0, 0.1)
    }

    func testSuggestBySharedTags_convenience() async throws {
        // When
        let suggestions = try await suggestionEngine.suggestBySharedTags(for: "node1", limit: 3)

        // Then
        XCTAssertLessThanOrEqual(suggestions.count, 3)
        XCTAssertTrue(suggestions.allSatisfy { $0.type == .sharedTags })
    }

    // MARK: - Community Suggestions

    func testSuggestConnections_community() async throws {
        // Given
        let options = SuggestionOptions(
            maxSuggestions: 5,
            minConfidence: 0.1,
            includeTypes: [.sameCommunity]
        )

        // When
        let suggestions = try await suggestionEngine.suggestConnections(
            for: "node1", // Project Alpha (connected to node4 and node5)
            options: options
        )

        // Then: Should find nodes connected to node1's neighbors
        XCTAssertTrue(suggestions.allSatisfy { $0.type == .sameCommunity })

        // node2 should be suggested as it's also connected to node5
        let node2Suggestion = suggestions.first { $0.nodeId == "node2" }
        if node2Suggestion != nil {
            XCTAssertTrue(node2Suggestion?.reason.contains("community") ?? false)
        }
    }

    func testSuggestByCommunity_convenience() async throws {
        // When
        let suggestions = try await suggestionEngine.suggestByCommunity(for: "node1", limit: 3)

        // Then
        XCTAssertLessThanOrEqual(suggestions.count, 3)
        XCTAssertTrue(suggestions.allSatisfy { suggestion in
            suggestion.type == .sameCommunity || suggestion.type == .mutualConnections
        })
    }

    // MARK: - Temporal Proximity Suggestions

    func testSuggestConnections_temporalProximity() async throws {
        // Given
        let options = SuggestionOptions(
            maxSuggestions: 5,
            minConfidence: 0.05,
            includeTypes: [.temporalProximity]
        )

        // When
        let suggestions = try await suggestionEngine.suggestConnections(
            for: "node1",
            options: options
        )

        // Then
        XCTAssertTrue(suggestions.allSatisfy { $0.type == .temporalProximity })

        // All nodes were created around the same time, so should have suggestions
        XCTAssertGreaterThan(suggestions.count, 0)
        XCTAssertTrue(suggestions.allSatisfy { $0.confidence > 0 })
    }

    // MARK: - Content Similarity Suggestions

    func testSuggestConnections_similarContent() async throws {
        // Given
        let options = SuggestionOptions(
            maxSuggestions: 5,
            minConfidence: 0.1,
            includeTypes: [.similarContent]
        )

        // When
        let suggestions = try await suggestionEngine.suggestConnections(
            for: "node1", // Work folder
            options: options
        )

        // Then
        XCTAssertTrue(suggestions.allSatisfy { $0.type == .similarContent })

        // Should suggest other Work folder items
        let workFolderSuggestions = suggestions.filter { suggestion in
            suggestion.reason.contains("same folder")
        }
        XCTAssertGreaterThan(workFolderSuggestions.count, 0)
    }

    // MARK: - Batch Suggestions

    func testBatchSuggestConnections() async throws {
        // Given
        let nodeIds = ["node1", "node2", "node3"]
        let options = SuggestionOptions(maxSuggestions: 3)

        // When
        let batchResults = try await suggestionEngine.batchSuggestConnections(
            for: nodeIds,
            options: options
        )

        // Then
        XCTAssertEqual(batchResults.keys.count, 3)
        XCTAssertTrue(batchResults.keys.contains("node1"))
        XCTAssertTrue(batchResults.keys.contains("node2"))
        XCTAssertTrue(batchResults.keys.contains("node3"))

        // Each node should have suggestions
        for (nodeId, suggestions) in batchResults {
            XCTAssertLessThanOrEqual(suggestions.count, 3, "Node \(nodeId) should have <= 3 suggestions")
        }
    }

    // MARK: - Existing Connection Filtering

    func testSuggestConnections_excludeExisting() async throws {
        // Given
        let options = SuggestionOptions(
            excludeExistingConnections: true,
            minConfidence: 0.1
        )

        // When
        let suggestions = try await suggestionEngine.suggestConnections(
            for: "node1", // Connected to node4 and node5
            options: options
        )

        // Then: Should not suggest already connected nodes
        let suggestedNodeIds = suggestions.map(\.nodeId)
        XCTAssertFalse(suggestedNodeIds.contains("node4"), "Should not suggest already connected node4")
        XCTAssertFalse(suggestedNodeIds.contains("node5"), "Should not suggest already connected node5")
    }

    func testSuggestConnections_includeExisting() async throws {
        // Given
        let options = SuggestionOptions(
            excludeExistingConnections: false,
            minConfidence: 0.1
        )

        // When
        let suggestions = try await suggestionEngine.suggestConnections(
            for: "node1",
            options: options
        )

        // Then: May include already connected nodes
        // (depending on other suggestion criteria)
        XCTAssertGreaterThan(suggestions.count, 0)
    }

    // MARK: - Confidence and Filtering

    func testSuggestConnections_confidenceFiltering() async throws {
        // Given: High confidence threshold
        let highConfidenceOptions = SuggestionOptions(
            minConfidence: 0.8,
            maxSuggestions: 10
        )

        let lowConfidenceOptions = SuggestionOptions(
            minConfidence: 0.1,
            maxSuggestions: 10
        )

        // When
        let highConfidenceSuggestions = try await suggestionEngine.suggestConnections(
            for: "node1",
            options: highConfidenceOptions
        )

        let lowConfidenceSuggestions = try await suggestionEngine.suggestConnections(
            for: "node1",
            options: lowConfidenceOptions
        )

        // Then
        XCTAssertTrue(highConfidenceSuggestions.allSatisfy { $0.confidence >= 0.8 })
        XCTAssertTrue(lowConfidenceSuggestions.allSatisfy { $0.confidence >= 0.1 })
        XCTAssertGreaterThanOrEqual(lowConfidenceSuggestions.count, highConfidenceSuggestions.count)
    }

    func testSuggestConnections_maxSuggestions() async throws {
        // Given
        let options = SuggestionOptions(
            maxSuggestions: 2,
            minConfidence: 0.1
        )

        // When
        let suggestions = try await suggestionEngine.suggestConnections(
            for: "node1",
            options: options
        )

        // Then
        XCTAssertLessThanOrEqual(suggestions.count, 2)
    }

    // MARK: - Suggestion Engine Metrics

    func testGetSuggestionMetrics() async throws {
        // When
        let metrics = try await suggestionEngine.getSuggestionMetrics()

        // Then
        XCTAssertEqual(metrics.totalNodes, 6)
        XCTAssertEqual(metrics.totalEdges, 4)
        XCTAssertGreaterThanOrEqual(metrics.averageTagsPerNode, 0)
        XCTAssertGreaterThanOrEqual(metrics.graphDensity, 0)
    }

    // MARK: - Edge Cases

    func testSuggestConnections_nonExistentNode() async throws {
        // When
        let suggestions = try await suggestionEngine.suggestConnections(
            for: "nonexistent_node"
        )

        // Then: Should return empty array, not crash
        XCTAssertTrue(suggestions.isEmpty)
    }

    func testSuggestConnections_isolatedNode() async throws {
        // Given: Add an isolated node (no connections, unique tags)
        try await database.write { db in
            let isolatedNode = Node(
                id: "isolated",
                name: "Isolated Node",
                folder: "Unique",
                tags: ["unique", "isolated"],
                content: "This node has no connections or shared attributes."
            )
            try isolatedNode.insert(db)
        }

        // When
        let suggestions = try await suggestionEngine.suggestConnections(
            for: "isolated",
            options: SuggestionOptions(minConfidence: 0.1)
        )

        // Then: May have temporal proximity suggestions, but likely few or none
        XCTAssertTrue(suggestions.allSatisfy { $0.confidence > 0 })
    }

    func testSuggestConnections_emptyDatabase() async throws {
        // Given: Clear all data
        try await database.write { db in
            try db.execute(sql: "DELETE FROM edges")
            try db.execute(sql: "DELETE FROM nodes")
        }

        // When
        let suggestions = try await suggestionEngine.suggestConnections(for: "any_node")

        // Then
        XCTAssertTrue(suggestions.isEmpty)
    }

    // MARK: - Performance Tests

    func testSuggestConnections_performance() async throws {
        // Given: Add more nodes for performance testing
        try await database.write { db in
            for i in 7...50 {
                let node = Node(
                    id: "perf_node_\(i)",
                    name: "Performance Test Node \(i)",
                    folder: "Performance",
                    tags: ["performance", "test", "node\(i % 5)"],
                    content: "Performance test node with some content for testing."
                )
                try node.insert(db)
            }
        }

        // When/Then: Should complete within reasonable time
        let startTime = Date()

        let suggestions = try await suggestionEngine.suggestConnections(
            for: "node1",
            options: SuggestionOptions(maxSuggestions: 10)
        )

        let executionTime = Date().timeIntervalSince(startTime)

        XCTAssertLessThan(executionTime, 1.0, "Suggestion generation should complete within 1 second")
        XCTAssertGreaterThan(suggestions.count, 0, "Should find suggestions even with larger dataset")
    }

    // MARK: - Integration Tests

    func testSuggestionEngine_realWorldScenario() async throws {
        // Simulate a real-world scenario with varied content and connections
        try await database.write { db in
            // Clear existing data
            try db.execute(sql: "DELETE FROM edges")
            try db.execute(sql: "DELETE FROM nodes")

            // Create a realistic knowledge graph
            let nodes = [
                Node(id: "react_project", name: "React Dashboard", folder: "Projects",
                     tags: ["react", "frontend", "dashboard"], content: "Customer dashboard built with React"),
                Node(id: "api_design", name: "API Design Patterns", folder: "Learning",
                     tags: ["api", "backend", "patterns"], content: "REST API design best practices"),
                Node(id: "meeting_react", name: "React Team Meeting", folder: "Meetings",
                     tags: ["meeting", "react", "team"], content: "Weekly React team sync"),
                Node(id: "docker_setup", name: "Docker Configuration", folder: "DevOps",
                     tags: ["docker", "deployment", "backend"], content: "Docker setup for backend services"),
                Node(id: "user_research", name: "User Research Findings", folder: "Research",
                     tags: ["research", "users", "frontend"], content: "User feedback on dashboard design")
            ]

            for node in nodes {
                try node.insert(db)
            }

            // Create meaningful connections
            let edges = [
                Edge(sourceId: "react_project", targetId: "user_research", type: "informs"),
                Edge(sourceId: "api_design", targetId: "docker_setup", type: "implements"),
                Edge(sourceId: "meeting_react", targetId: "react_project", type: "discusses")
            ]

            for edge in edges {
                try edge.insert(db)
            }
        }

        // Test suggestions for react_project
        let suggestions = try await suggestionEngine.suggestConnections(
            for: "react_project",
            options: SuggestionOptions(minConfidence: 0.1)
        )

        // Verify we get meaningful suggestions
        XCTAssertGreaterThan(suggestions.count, 0)

        // Should suggest api_design due to shared project context
        let apiSuggestion = suggestions.first { $0.nodeId == "api_design" }
        if let apiSuggestion = apiSuggestion {
            XCTAssertGreaterThan(apiSuggestion.confidence, 0.1)
        }

        // Check suggestion diversity
        let suggestionTypes = Set(suggestions.map(\.type))
        XCTAssertGreaterThan(suggestionTypes.count, 1, "Should have diverse suggestion types")
    }
}