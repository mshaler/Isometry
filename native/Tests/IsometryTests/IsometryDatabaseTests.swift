import Testing
import Foundation
@testable import Isometry

@Suite("IsometryDatabase Tests")
struct IsometryDatabaseTests {

    @Test("Database initialization creates tables")
    func testInitialization() async throws {
        let db = try IsometryDatabase(path: ":memory:")
        try await db.initialize()

        // If we get here without error, tables were created
        let nodes = try await db.getAllNodes()
        #expect(nodes.isEmpty)
    }

    @Test("Node CRUD operations")
    func testNodeCRUD() async throws {
        let db = try IsometryDatabase(path: ":memory:")
        try await db.initialize()

        // Create
        let node = Node(name: "Test Node", content: "Test content", folder: "Tests")
        try await db.createNode(node)

        // Read
        let fetched = try await db.getNode(id: node.id)
        #expect(fetched != nil)
        #expect(fetched?.name == "Test Node")
        #expect(fetched?.content == "Test content")
        #expect(fetched?.folder == "Tests")

        // Update
        var updated = fetched!
        updated.name = "Updated Node"
        try await db.updateNode(updated)

        let reFetched = try await db.getNode(id: node.id)
        #expect(reFetched?.name == "Updated Node")
        #expect(reFetched?.version == 2)

        // Soft delete
        try await db.deleteNode(id: node.id)
        let deleted = try await db.getNode(id: node.id)
        #expect(deleted?.isDeleted == true)

        // Should not appear in getAllNodes
        let allNodes = try await db.getAllNodes()
        #expect(allNodes.isEmpty)
    }

    @Test("Folder filtering")
    func testFolderFiltering() async throws {
        let db = try IsometryDatabase(path: ":memory:")
        try await db.initialize()

        try await db.createNode(Node(name: "Work 1", folder: "Work"))
        try await db.createNode(Node(name: "Work 2", folder: "Work"))
        try await db.createNode(Node(name: "Personal 1", folder: "Personal"))

        let workNodes = try await db.getNodes(inFolder: "Work")
        #expect(workNodes.count == 2)

        let personalNodes = try await db.getNodes(inFolder: "Personal")
        #expect(personalNodes.count == 1)
    }

    @Test("Edge creation and traversal")
    func testEdges() async throws {
        let db = try IsometryDatabase(path: ":memory:")
        try await db.initialize()

        let node1 = Node(name: "Node 1")
        let node2 = Node(name: "Node 2")
        let node3 = Node(name: "Node 3")

        try await db.createNode(node1)
        try await db.createNode(node2)
        try await db.createNode(node3)

        // Create edges: 1 -> 2 -> 3
        let edge1 = Edge(edgeType: .link, sourceId: node1.id, targetId: node2.id)
        let edge2 = Edge(edgeType: .link, sourceId: node2.id, targetId: node3.id)

        try await db.createEdge(edge1)
        try await db.createEdge(edge2)

        // Test neighbors
        let neighbors = try await db.neighbors(of: node2.id)
        #expect(neighbors.count == 2) // node1 and node3

        // Test connected nodes from node1
        let connected = try await db.connectedNodes(from: node1.id, maxDepth: 3)
        #expect(connected.count == 3) // All three nodes
    }

    @Test("Shortest path finding")
    func testShortestPath() async throws {
        let db = try IsometryDatabase(path: ":memory:")
        try await db.initialize()

        let nodeA = Node(name: "A")
        let nodeB = Node(name: "B")
        let nodeC = Node(name: "C")

        try await db.createNode(nodeA)
        try await db.createNode(nodeB)
        try await db.createNode(nodeC)

        // A -> B -> C
        try await db.createEdge(Edge(edgeType: .link, sourceId: nodeA.id, targetId: nodeB.id))
        try await db.createEdge(Edge(edgeType: .link, sourceId: nodeB.id, targetId: nodeC.id))

        let path = try await db.shortestPath(from: nodeA.id, to: nodeC.id)
        #expect(path != nil)
        #expect(path?.count == 3)
        #expect(path?.first?.name == "A")
        #expect(path?.last?.name == "C")
    }

    @Test("Tags JSON encoding/decoding")
    func testTagsJsonHandling() async throws {
        let db = try IsometryDatabase(path: ":memory:")
        try await db.initialize()

        let node = Node(name: "Tagged Node", tags: ["swift", "ios", "testing"])
        try await db.createNode(node)

        let fetched = try await db.getNode(id: node.id)
        #expect(fetched?.tags == ["swift", "ios", "testing"])
    }

    @Test("Sync version increments on update")
    func testSyncVersioning() async throws {
        let db = try IsometryDatabase(path: ":memory:")
        try await db.initialize()

        let node = Node(name: "Versioned Node")
        try await db.createNode(node)

        var fetched = try await db.getNode(id: node.id)!
        #expect(fetched.syncVersion == 0)

        fetched.name = "Updated"
        try await db.updateNode(fetched)

        let updated = try await db.getNode(id: node.id)!
        #expect(updated.syncVersion == 1)
    }
}
