/**
 * ContactsAdapter - Native Contacts framework integration
 *
 * Actor-based adapter for fetching contacts from CNContactStore
 * and converting them to CanonicalNode format for SuperGrid visualization.
 *
 * Usage:
 * ```swift
 * let adapter = ContactsAdapter()
 * let granted = try await adapter.requestAccess()
 * if granted {
 *     let contacts = try await adapter.fetchContacts()
 * }
 * ```
 *
 * Thread Safety:
 * - Actor isolation ensures all state access is serialized
 * - CNContactStore is thread-safe for queries
 * - Safe to call from any async context
 *
 * Note: Uses CanonicalNode from Bridge/CanonicalNode.swift
 * Note: Uses AdapterError pattern from EventKitAdapter.swift
 */

import Contacts
import Foundation

// MARK: - ContactsError

/// Errors specific to contacts adapter operations
public enum ContactsError: Error, LocalizedError, Sendable {
    /// User denied contacts permission
    case accessDenied

    /// Contacts fetch failed with details
    case fetchFailed(String)

    public var errorDescription: String? {
        switch self {
        case .accessDenied:
            return "Access to contacts was denied. Please enable access in Settings."
        case .fetchFailed(let reason):
            return "Failed to fetch contacts: \(reason)"
        }
    }

    /// Identifier for programmatic error handling
    public var code: String {
        switch self {
        case .accessDenied:
            return "CONTACTS_ACCESS_DENIED"
        case .fetchFailed:
            return "CONTACTS_FETCH_FAILED"
        }
    }
}

// MARK: - ContactsAdapter

/// Actor-based adapter for fetching contacts from CNContactStore
/// and converting them to CanonicalNode format for SuperGrid visualization.
@available(iOS 17.0, macOS 14.0, *)
public actor ContactsAdapter {
    private let contactStore = CNContactStore()
    private let dateFormatter: ISO8601DateFormatter

    public init() {
        dateFormatter = ISO8601DateFormatter()
        dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    }

    // MARK: - Access Control

    /// Request contacts access (iOS 17+)
    /// - Returns: Boolean indicating whether access was granted
    /// - Throws: Error if the request fails
    public func requestAccess() async throws -> Bool {
        try await contactStore.requestAccess(for: .contacts)
    }

    // MARK: - Fetch Contacts

    /// Fetch all contacts and convert to CanonicalNode format.
    /// - Returns: Array of CanonicalNode representing contacts
    /// - Throws: ContactsError.accessDenied if not authorized, ContactsError.fetchFailed on error
    public func fetchContacts() async throws -> [CanonicalNode] {
        // Check authorization status
        let status = CNContactStore.authorizationStatus(for: .contacts)
        guard status == .authorized else {
            throw ContactsError.accessDenied
        }

        // Define keys to fetch
        let keysToFetch: [CNKeyDescriptor] = [
            CNContactGivenNameKey as CNKeyDescriptor,
            CNContactFamilyNameKey as CNKeyDescriptor,
            CNContactOrganizationNameKey as CNKeyDescriptor,
            CNContactEmailAddressesKey as CNKeyDescriptor,
            CNContactPhoneNumbersKey as CNKeyDescriptor,
            CNContactNoteKey as CNKeyDescriptor,
            CNContactIdentifierKey as CNKeyDescriptor,
            CNContactBirthdayKey as CNKeyDescriptor
        ]

        // Create fetch request
        let request = CNContactFetchRequest(keysToFetch: keysToFetch)

        // Fetch contacts using continuation wrapper (enumerateContacts uses callback)
        return try await withCheckedThrowingContinuation { continuation in
            var contacts: [CanonicalNode] = []

            do {
                try contactStore.enumerateContacts(with: request) { contact, _ in
                    let node = self.convertContactToNode(contact)
                    contacts.append(node)
                }
                continuation.resume(returning: contacts)
            } catch {
                continuation.resume(throwing: ContactsError.fetchFailed(error.localizedDescription))
            }
        }
    }

    // MARK: - Conversion Helpers

    /// Convert CNContact to CanonicalNode
    private func convertContactToNode(_ contact: CNContact) -> CanonicalNode {
        let now = Date()
        let nowString = dateFormatter.string(from: now)

        // Build display name with fallbacks
        let displayName = buildDisplayName(contact)

        // Build email addresses array for properties
        let emails = contact.emailAddresses.map { $0.value as String }

        // Build phone numbers array for properties
        let phones = contact.phoneNumbers.map { $0.value.stringValue }

        // Build properties dictionary
        var properties: [String: AnyCodable]?
        if !emails.isEmpty || !phones.isEmpty {
            var props: [String: AnyCodable] = [:]
            if !emails.isEmpty {
                props["emails"] = AnyCodable(emails)
            }
            if !phones.isEmpty {
                props["phones"] = AnyCodable(phones)
            }
            properties = props
        }

        // Organization as summary if different from name
        let summary = contact.organizationName.isEmpty ||
            contact.organizationName == displayName ? nil : contact.organizationName

        return CanonicalNode(
            id: UUID().uuidString,
            nodeType: "person",
            name: displayName,
            content: contact.note.isEmpty ? nil : contact.note,
            summary: summary,
            createdAt: nowString,  // CNContact doesn't track creation date
            modifiedAt: nowString,  // CNContact doesn't track modification date
            folder: "Contacts",
            tags: ["contacts"],
            source: "contacts",
            sourceId: contact.identifier,
            properties: properties
        )
    }

    /// Build display name from contact with appropriate fallbacks
    private func buildDisplayName(_ contact: CNContact) -> String {
        let givenName = contact.givenName.trimmingCharacters(in: .whitespaces)
        let familyName = contact.familyName.trimmingCharacters(in: .whitespaces)
        let orgName = contact.organizationName.trimmingCharacters(in: .whitespaces)

        // Try given + family name first
        if !givenName.isEmpty || !familyName.isEmpty {
            let fullName = [givenName, familyName]
                .filter { !$0.isEmpty }
                .joined(separator: " ")
            if !fullName.isEmpty {
                return fullName
            }
        }

        // Fall back to organization name
        if !orgName.isEmpty {
            return orgName
        }

        // Ultimate fallback
        return "Unknown Contact"
    }
}

// MARK: - Testing Support

/// Helper struct for testing contact-to-node conversion without actual CNContactStore
/// This allows unit tests to validate field mapping logic.
public struct MockContactData: Sendable {
    public let givenName: String
    public let familyName: String
    public let organizationName: String
    public let identifier: String
    public let note: String
    public let emailAddresses: [String]
    public let phoneNumbers: [String]

    public init(
        givenName: String = "",
        familyName: String = "",
        organizationName: String = "",
        identifier: String = UUID().uuidString,
        note: String = "",
        emailAddresses: [String] = [],
        phoneNumbers: [String] = []
    ) {
        self.givenName = givenName
        self.familyName = familyName
        self.organizationName = organizationName
        self.identifier = identifier
        self.note = note
        self.emailAddresses = emailAddresses
        self.phoneNumbers = phoneNumbers
    }
}

// MARK: - Contact Conversion Testing

/// Extension for converting mock data to CanonicalNode for testing
public extension CanonicalNode {
    /// Create a CanonicalNode from MockContactData for testing
    static func fromMockContact(_ mock: MockContactData) -> CanonicalNode {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let now = Date()
        let nowString = formatter.string(from: now)

        // Build display name with fallbacks (same logic as adapter)
        let givenName = mock.givenName.trimmingCharacters(in: .whitespaces)
        let familyName = mock.familyName.trimmingCharacters(in: .whitespaces)
        let orgName = mock.organizationName.trimmingCharacters(in: .whitespaces)

        var displayName: String
        if !givenName.isEmpty || !familyName.isEmpty {
            let fullName = [givenName, familyName]
                .filter { !$0.isEmpty }
                .joined(separator: " ")
            displayName = fullName.isEmpty ? "Unknown Contact" : fullName
        } else if !orgName.isEmpty {
            displayName = orgName
        } else {
            displayName = "Unknown Contact"
        }

        // Build properties dictionary
        var properties: [String: AnyCodable]?
        if !mock.emailAddresses.isEmpty || !mock.phoneNumbers.isEmpty {
            var props: [String: AnyCodable] = [:]
            if !mock.emailAddresses.isEmpty {
                props["emails"] = AnyCodable(mock.emailAddresses)
            }
            if !mock.phoneNumbers.isEmpty {
                props["phones"] = AnyCodable(mock.phoneNumbers)
            }
            properties = props
        }

        // Organization as summary if different from name
        let summary = orgName.isEmpty || orgName == displayName ? nil : orgName

        return CanonicalNode(
            id: UUID().uuidString,
            nodeType: "person",
            name: displayName,
            content: mock.note.isEmpty ? nil : mock.note,
            summary: summary,
            createdAt: nowString,
            modifiedAt: nowString,
            folder: "Contacts",
            tags: ["contacts"],
            source: "contacts",
            sourceId: mock.identifier,
            properties: properties
        )
    }
}
