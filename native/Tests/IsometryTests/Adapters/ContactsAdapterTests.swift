import XCTest
@testable import Isometry

/// Tests for ContactsAdapter conversion logic and error handling.
/// Note: Actual CNContactStore access requires device/simulator with contacts entitlements.
/// These tests focus on testable conversion logic using mock data.
@available(iOS 17.0, macOS 14.0, *)
final class ContactsAdapterTests: XCTestCase {

    // MARK: - Display Name Tests

    func testContactWithFullName() {
        let mock = MockContactData(
            givenName: "John",
            familyName: "Doe",
            organizationName: "Acme Corp"
        )

        let node = CanonicalNode.fromMockContact(mock)

        XCTAssertEqual(node.name, "John Doe")
        XCTAssertEqual(node.summary, "Acme Corp")  // Org as summary when different from name
    }

    func testContactWithOnlyGivenName() {
        let mock = MockContactData(
            givenName: "Madonna",
            familyName: ""
        )

        let node = CanonicalNode.fromMockContact(mock)

        XCTAssertEqual(node.name, "Madonna")
    }

    func testContactWithOnlyFamilyName() {
        let mock = MockContactData(
            givenName: "",
            familyName: "Prince"
        )

        let node = CanonicalNode.fromMockContact(mock)

        XCTAssertEqual(node.name, "Prince")
    }

    func testContactWithOnlyOrganization() {
        let mock = MockContactData(
            givenName: "",
            familyName: "",
            organizationName: "Apple Inc."
        )

        let node = CanonicalNode.fromMockContact(mock)

        XCTAssertEqual(node.name, "Apple Inc.")
        XCTAssertNil(node.summary)  // Org is name, so no summary
    }

    func testContactWithEmptyNames() {
        let mock = MockContactData(
            givenName: "",
            familyName: "",
            organizationName: ""
        )

        let node = CanonicalNode.fromMockContact(mock)

        XCTAssertEqual(node.name, "Unknown Contact")
        XCTAssertNil(node.summary)
    }

    func testContactWithWhitespaceNames() {
        let mock = MockContactData(
            givenName: "   ",
            familyName: "   ",
            organizationName: "   "
        )

        let node = CanonicalNode.fromMockContact(mock)

        XCTAssertEqual(node.name, "Unknown Contact")
    }

    // MARK: - Field Mapping Tests

    func testContactIdentifierAsSourceId() {
        let identifier = "ABCD-1234-5678-EFGH"
        let mock = MockContactData(identifier: identifier)

        let node = CanonicalNode.fromMockContact(mock)

        XCTAssertEqual(node.sourceId, identifier)
        XCTAssertEqual(node.source, "contacts")
    }

    func testContactNodeType() {
        let mock = MockContactData(givenName: "Test")

        let node = CanonicalNode.fromMockContact(mock)

        XCTAssertEqual(node.nodeType, "person")
    }

    func testContactFolder() {
        let mock = MockContactData(givenName: "Test")

        let node = CanonicalNode.fromMockContact(mock)

        XCTAssertEqual(node.folder, "Contacts")
    }

    func testContactTags() {
        let mock = MockContactData(givenName: "Test")

        let node = CanonicalNode.fromMockContact(mock)

        XCTAssertEqual(node.tags, ["contacts"])
    }

    func testContactNote() {
        let mock = MockContactData(
            givenName: "John",
            familyName: "Doe",
            note: "Met at WWDC 2024"
        )

        let node = CanonicalNode.fromMockContact(mock)

        XCTAssertEqual(node.content, "Met at WWDC 2024")
    }

    func testContactWithEmptyNote() {
        let mock = MockContactData(
            givenName: "John",
            familyName: "Doe",
            note: ""
        )

        let node = CanonicalNode.fromMockContact(mock)

        XCTAssertNil(node.content)
    }

    // MARK: - Properties Tests

    func testContactEmailAddresses() {
        let mock = MockContactData(
            givenName: "John",
            familyName: "Doe",
            emailAddresses: ["john@example.com", "johndoe@work.com"]
        )

        let node = CanonicalNode.fromMockContact(mock)

        XCTAssertNotNil(node.properties)
        // Properties contain emails array
        XCTAssertNotNil(node.properties?["emails"])
    }

    func testContactPhoneNumbers() {
        let mock = MockContactData(
            givenName: "John",
            familyName: "Doe",
            phoneNumbers: ["+1-555-123-4567", "+1-555-987-6543"]
        )

        let node = CanonicalNode.fromMockContact(mock)

        XCTAssertNotNil(node.properties)
        XCTAssertNotNil(node.properties?["phones"])
    }

    func testContactWithNoProperties() {
        let mock = MockContactData(
            givenName: "John",
            familyName: "Doe"
        )

        let node = CanonicalNode.fromMockContact(mock)

        XCTAssertNil(node.properties)
    }

    // MARK: - Error Description Tests

    func testContactsErrorDescriptions() {
        let accessDenied = ContactsError.accessDenied
        XCTAssertTrue(accessDenied.errorDescription?.contains("denied") ?? false)
        XCTAssertEqual(accessDenied.code, "CONTACTS_ACCESS_DENIED")

        let fetchFailed = ContactsError.fetchFailed("Network error")
        XCTAssertTrue(fetchFailed.errorDescription?.contains("Network error") ?? false)
        XCTAssertEqual(fetchFailed.code, "CONTACTS_FETCH_FAILED")
    }

    // MARK: - Codable Tests

    func testContactNodeEncodeDecode() throws {
        let mock = MockContactData(
            givenName: "Alice",
            familyName: "Smith",
            organizationName: "Tech Corp",
            identifier: "contact-123",
            emailAddresses: ["alice@example.com"]
        )

        let original = CanonicalNode.fromMockContact(mock)

        // Encode
        let encoder = JSONEncoder()
        let data = try encoder.encode(original)

        // Decode
        let decoder = JSONDecoder()
        let decoded = try decoder.decode(CanonicalNode.self, from: data)

        // Compare
        XCTAssertEqual(original.name, decoded.name)
        XCTAssertEqual(original.nodeType, decoded.nodeType)
        XCTAssertEqual(original.summary, decoded.summary)
        XCTAssertEqual(original.folder, decoded.folder)
        XCTAssertEqual(original.source, decoded.source)
        XCTAssertEqual(original.sourceId, decoded.sourceId)
        XCTAssertEqual(original.tags, decoded.tags)
    }

    // MARK: - Timestamp Tests

    func testContactTimestamps() {
        let mock = MockContactData(givenName: "Test")

        let node = CanonicalNode.fromMockContact(mock)

        // Should have valid ISO8601 timestamps
        XCTAssertNotNil(node.createdAt)
        XCTAssertNotNil(node.modifiedAt)

        // Timestamps should be parseable
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        XCTAssertNotNil(formatter.date(from: node.createdAt))
        XCTAssertNotNil(formatter.date(from: node.modifiedAt))
    }
}

// MARK: - Integration Test Markers

/// These tests require actual CNContactStore access and should run on device/simulator
/// with proper entitlements. Mark as skipped in normal test runs.
@available(iOS 17.0, macOS 14.0, *)
final class ContactsAdapterIntegrationTests: XCTestCase {

    func testRequestAccessRequiresEntitlements() async throws {
        // This test documents expected behavior but cannot run without entitlements
        // Uncomment to run manually on device:
        // let adapter = ContactsAdapter()
        // let granted = try await adapter.requestAccess()
        // XCTAssertTrue(granted || !granted)
    }

    func testFetchContactsWithoutAccessThrowsDenied() async throws {
        // Expected behavior: If access not granted, fetchContacts should throw ContactsError.accessDenied
    }
}
