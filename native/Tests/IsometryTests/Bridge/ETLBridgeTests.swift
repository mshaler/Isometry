/**
 * ETLBridge Unit Tests
 *
 * Tests for ETLImportResult, CanonicalNode, and ETLBridgeError types.
 * Note: Full integration tests require WKWebView which needs a separate UI test target.
 * These unit tests validate the Codable models and error types without WKWebView.
 */

import XCTest
@testable import Isometry

final class ETLBridgeTests: XCTestCase {

    // MARK: - ETLImportResult Tests

    func testImportResultDecoding_Success() throws {
        // Given: JSON from window.isometryETL.importFile() success response
        let json = """
        {
            "success": true,
            "nodeCount": 5,
            "errors": null
        }
        """
        let data = json.data(using: .utf8)!

        // When: Decode to ETLImportResult
        let result = try JSONDecoder().decode(ETLImportResult.self, from: data)

        // Then: Fields match expected values
        XCTAssertTrue(result.success)
        XCTAssertEqual(result.nodeCount, 5)
        XCTAssertNil(result.errors)
    }

    func testImportResultDecoding_Failure() throws {
        // Given: JSON from failed import response
        let json = """
        {
            "success": false,
            "nodeCount": 0,
            "errors": ["Unsupported file format: .xyz", "Parse error at line 42"]
        }
        """
        let data = json.data(using: .utf8)!

        // When: Decode to ETLImportResult
        let result = try JSONDecoder().decode(ETLImportResult.self, from: data)

        // Then: Fields match expected values
        XCTAssertFalse(result.success)
        XCTAssertEqual(result.nodeCount, 0)
        XCTAssertEqual(result.errors?.count, 2)
        XCTAssertEqual(result.errors?[0], "Unsupported file format: .xyz")
    }

    func testImportResultDecoding_PartialSuccess() throws {
        // Given: JSON from partial success (some nodes imported, some errors)
        let json = """
        {
            "success": false,
            "nodeCount": 3,
            "errors": ["Row 5: missing required field 'name'"]
        }
        """
        let data = json.data(using: .utf8)!

        // When: Decode to ETLImportResult
        let result = try JSONDecoder().decode(ETLImportResult.self, from: data)

        // Then: Fields reflect partial success state
        XCTAssertFalse(result.success)
        XCTAssertEqual(result.nodeCount, 3)
        XCTAssertNotNil(result.errors)
    }

    // MARK: - CanonicalNode Tests

    func testCanonicalNodeDecoding_AllFields() throws {
        // Given: JSON with all CanonicalNode fields populated
        let json = """
        {
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "nodeType": "event",
            "name": "Team Meeting",
            "content": "Weekly sync discussion",
            "summary": "Discuss Q1 goals",
            "latitude": 37.7749,
            "longitude": -122.4194,
            "locationName": "San Francisco",
            "locationAddress": "123 Main St",
            "createdAt": "2026-01-15T10:00:00Z",
            "modifiedAt": "2026-01-15T10:30:00Z",
            "dueAt": null,
            "completedAt": null,
            "eventStart": "2026-01-20T14:00:00Z",
            "eventEnd": "2026-01-20T15:00:00Z",
            "folder": "Work",
            "tags": ["meeting", "q1", "team"],
            "status": "confirmed",
            "priority": 3,
            "importance": 2,
            "sortOrder": 1,
            "gridX": 5,
            "gridY": 10,
            "source": "eventkit",
            "sourceId": "EK-12345",
            "sourceUrl": "https://calendar.example.com/event/12345",
            "deletedAt": null,
            "version": 1,
            "properties": {"attendees": 5, "recurring": true}
        }
        """
        let data = json.data(using: .utf8)!

        // When: Decode to CanonicalNode
        let node = try JSONDecoder().decode(CanonicalNode.self, from: data)

        // Then: All fields match expected values
        XCTAssertEqual(node.id, "123e4567-e89b-12d3-a456-426614174000")
        XCTAssertEqual(node.nodeType, "event")
        XCTAssertEqual(node.name, "Team Meeting")
        XCTAssertEqual(node.content, "Weekly sync discussion")
        XCTAssertEqual(node.summary, "Discuss Q1 goals")
        XCTAssertEqual(node.latitude, 37.7749)
        XCTAssertEqual(node.longitude, -122.4194)
        XCTAssertEqual(node.locationName, "San Francisco")
        XCTAssertEqual(node.locationAddress, "123 Main St")
        XCTAssertEqual(node.createdAt, "2026-01-15T10:00:00Z")
        XCTAssertEqual(node.modifiedAt, "2026-01-15T10:30:00Z")
        XCTAssertNil(node.dueAt)
        XCTAssertEqual(node.eventStart, "2026-01-20T14:00:00Z")
        XCTAssertEqual(node.eventEnd, "2026-01-20T15:00:00Z")
        XCTAssertEqual(node.folder, "Work")
        XCTAssertEqual(node.tags, ["meeting", "q1", "team"])
        XCTAssertEqual(node.status, "confirmed")
        XCTAssertEqual(node.priority, 3)
        XCTAssertEqual(node.importance, 2)
        XCTAssertEqual(node.sortOrder, 1)
        XCTAssertEqual(node.gridX, 5)
        XCTAssertEqual(node.gridY, 10)
        XCTAssertEqual(node.source, "eventkit")
        XCTAssertEqual(node.sourceId, "EK-12345")
        XCTAssertEqual(node.sourceUrl, "https://calendar.example.com/event/12345")
        XCTAssertNil(node.deletedAt)
        XCTAssertEqual(node.version, 1)
        XCTAssertNotNil(node.properties)
    }

    func testCanonicalNodeDecoding_MinimalFields() throws {
        // Given: JSON with only required fields (id, name, createdAt, modifiedAt)
        let json = """
        {
            "id": "abc-123",
            "name": "Simple Note",
            "createdAt": "2026-01-15T10:00:00Z",
            "modifiedAt": "2026-01-15T10:00:00Z"
        }
        """
        let data = json.data(using: .utf8)!

        // When: Decode to CanonicalNode
        let node = try JSONDecoder().decode(CanonicalNode.self, from: data)

        // Then: Required fields present, optionals default correctly
        XCTAssertEqual(node.id, "abc-123")
        XCTAssertEqual(node.name, "Simple Note")
        XCTAssertEqual(node.nodeType, "note") // Default
        XCTAssertNil(node.content)
        XCTAssertNil(node.summary)
        XCTAssertNil(node.latitude)
        XCTAssertNil(node.longitude)
        XCTAssertEqual(node.tags, []) // Default empty array
        XCTAssertEqual(node.priority, 0) // Default
        XCTAssertEqual(node.importance, 0) // Default
        XCTAssertEqual(node.sortOrder, 0) // Default
        XCTAssertEqual(node.gridX, 0) // Default
        XCTAssertEqual(node.gridY, 0) // Default
        XCTAssertEqual(node.version, 1) // Default
    }

    func testCanonicalNodeDefaults() throws {
        // Given: JSON with optional fields explicitly null
        let json = """
        {
            "id": "def-456",
            "name": "Another Note",
            "createdAt": "2026-01-15T10:00:00Z",
            "modifiedAt": "2026-01-15T10:00:00Z",
            "content": null,
            "folder": null,
            "tags": [],
            "priority": 0
        }
        """
        let data = json.data(using: .utf8)!

        // When: Decode to CanonicalNode
        let node = try JSONDecoder().decode(CanonicalNode.self, from: data)

        // Then: Defaults applied correctly
        XCTAssertNil(node.content)
        XCTAssertNil(node.folder)
        XCTAssertEqual(node.tags, [])
        XCTAssertEqual(node.priority, 0)
    }

    func testAnyCodableHandlesNestedObjects() throws {
        // Given: JSON with complex nested properties
        let json = """
        {
            "id": "nested-123",
            "name": "Complex Node",
            "createdAt": "2026-01-15T10:00:00Z",
            "modifiedAt": "2026-01-15T10:00:00Z",
            "properties": {
                "string": "hello",
                "number": 42,
                "double": 3.14,
                "boolean": true,
                "array": [1, 2, 3],
                "nested": {"key": "value"}
            }
        }
        """
        let data = json.data(using: .utf8)!

        // When: Decode to CanonicalNode
        let node = try JSONDecoder().decode(CanonicalNode.self, from: data)

        // Then: Properties dictionary contains AnyCodable values
        XCTAssertNotNil(node.properties)
        XCTAssertEqual(node.properties?.count, 6)

        // Verify specific types decoded correctly
        if let props = node.properties {
            XCTAssertEqual(props["string"]?.value as? String, "hello")
            XCTAssertEqual(props["number"]?.value as? Int, 42)
            XCTAssertEqual(props["boolean"]?.value as? Bool, true)
        }
    }

    // MARK: - Base64 Encoding Tests

    func testBase64EncodingForBinaryContent() throws {
        // Given: Binary content (simulate file data)
        let originalContent = "Hello, World! This is test content with unicode: "
        let data = originalContent.data(using: .utf8)!

        // When: Encode to base64
        let base64 = data.base64EncodedString()

        // Then: Can decode back to original
        let decodedData = Data(base64Encoded: base64)!
        let decodedContent = String(data: decodedData, encoding: .utf8)!
        XCTAssertEqual(decodedContent, originalContent)
    }

    func testBase64EncodingForBinaryData() throws {
        // Given: Arbitrary binary data (not valid UTF-8)
        let binaryData = Data([0x00, 0xFF, 0x7F, 0x80, 0xFE, 0x01])

        // When: Encode to base64
        let base64 = binaryData.base64EncodedString()

        // Then: Can decode back exactly
        let decodedData = Data(base64Encoded: base64)!
        XCTAssertEqual(decodedData, binaryData)
    }

    // MARK: - ETLBridgeError Tests

    func testETLBridgeErrorDescriptions() {
        // Given: All error cases
        let errors: [ETLBridgeError] = [
            .webViewNotAvailable,
            .notInitialized,
            .invalidResponse,
            .importFailed("Test error message"),
            .fileAccessDenied,
            .encodingError("UTF-8 conversion failed")
        ]

        // Then: All errors have non-empty descriptions
        for error in errors {
            XCTAssertNotNil(error.errorDescription)
            XCTAssertFalse(error.errorDescription!.isEmpty)
            XCTAssertFalse(error.code.isEmpty)
        }
    }

    func testETLBridgeErrorCodes() {
        // Given/When/Then: Each error has a unique, non-empty code
        XCTAssertEqual(ETLBridgeError.webViewNotAvailable.code, "WEBVIEW_NOT_AVAILABLE")
        XCTAssertEqual(ETLBridgeError.notInitialized.code, "NOT_INITIALIZED")
        XCTAssertEqual(ETLBridgeError.invalidResponse.code, "INVALID_RESPONSE")
        XCTAssertEqual(ETLBridgeError.importFailed("msg").code, "IMPORT_FAILED")
        XCTAssertEqual(ETLBridgeError.fileAccessDenied.code, "FILE_ACCESS_DENIED")
        XCTAssertEqual(ETLBridgeError.encodingError("msg").code, "ENCODING_ERROR")
    }

    func testImportFailedErrorIncludesMessage() {
        // Given: An import failure with a specific message
        let error = ETLBridgeError.importFailed("Unsupported format: .xyz")

        // Then: Error description includes the message
        XCTAssertTrue(error.errorDescription!.contains("Unsupported format: .xyz"))
    }

    // MARK: - Convenience Initializer Tests

    func testCanonicalNodeEventConvenience() {
        // When: Create an event node using convenience initializer
        let node = CanonicalNode.event(
            name: "Team Standup",
            eventStart: "2026-01-20T09:00:00Z",
            eventEnd: "2026-01-20T09:15:00Z",
            folder: "Work"
        )

        // Then: Fields are set correctly
        XCTAssertEqual(node.nodeType, "event")
        XCTAssertEqual(node.name, "Team Standup")
        XCTAssertEqual(node.eventStart, "2026-01-20T09:00:00Z")
        XCTAssertEqual(node.eventEnd, "2026-01-20T09:15:00Z")
        XCTAssertEqual(node.folder, "Work")
        XCTAssertEqual(node.source, "eventkit")
        XCTAssertFalse(node.id.isEmpty)
        XCTAssertFalse(node.createdAt.isEmpty)
    }

    func testCanonicalNodePersonConvenience() {
        // When: Create a person node using convenience initializer
        let node = CanonicalNode.person(
            name: "John Doe",
            summary: "Acme Corp"
        )

        // Then: Fields are set correctly
        XCTAssertEqual(node.nodeType, "person")
        XCTAssertEqual(node.name, "John Doe")
        XCTAssertEqual(node.summary, "Acme Corp")
        XCTAssertEqual(node.folder, "Contacts")
        XCTAssertEqual(node.source, "contacts")
    }

    func testCanonicalNodeNoteConvenience() {
        // When: Create a note node using convenience initializer
        let node = CanonicalNode.note(
            name: "Meeting Notes",
            content: "Discussed project timeline...",
            folder: "Work",
            tags: ["meeting", "project"]
        )

        // Then: Fields are set correctly
        XCTAssertEqual(node.nodeType, "note")
        XCTAssertEqual(node.name, "Meeting Notes")
        XCTAssertEqual(node.content, "Discussed project timeline...")
        XCTAssertEqual(node.folder, "Work")
        XCTAssertEqual(node.tags, ["meeting", "project"])
        XCTAssertEqual(node.source, "manual")
    }
}
