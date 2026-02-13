/**
 * BridgeCoordinator - Unified interface for all import sources
 *
 * Main entry point for importing data from various sources:
 * - File imports via JavaScript ETL pipeline
 * - Calendar/Reminders via EventKit
 * - Contacts via CNContactStore
 * - Apple Notes via alto-index exports
 *
 * Usage:
 * ```swift
 * let coordinator = BridgeCoordinator(webView: webView)
 *
 * // Import a file via JS ETL
 * let result = try await coordinator.importFile(markdownURL)
 *
 * // Import from EventKit
 * let events = try await coordinator.importFromEventKit(from: startDate, to: endDate)
 *
 * // Import from Contacts
 * let contacts = try await coordinator.importFromContacts()
 *
 * // Import alto-index notes export
 * let summary = try await coordinator.importNotesExport(from: exportDirectory)
 * ```
 *
 * Thread Safety:
 * - @MainActor because it holds a WKWebView reference
 * - All adapters are actors, so calls are automatically isolated
 * - Safe to call from any async context
 *
 * BRIDGE-01: Swift->JS delegation via callAsyncJavaScript
 * BRIDGE-02: Round-trip Swift -> JS -> sql.js -> Swift verified
 */

import WebKit
import Foundation

// MARK: - BatchImportResult

/// Result from importing multiple files
public struct BatchImportResult: Sendable {
    /// Individual results keyed by filename
    public let results: [String: ETLImportResult]

    /// Total number of successful imports
    public let totalSuccess: Int

    /// Total number of failed imports
    public let totalFailed: Int

    public init(results: [String: ETLImportResult], totalSuccess: Int, totalFailed: Int) {
        self.results = results
        self.totalSuccess = totalSuccess
        self.totalFailed = totalFailed
    }
}

// MARK: - BridgePermissionStatus

/// Status of all required import permissions
/// Named BridgePermissionStatus to avoid conflict with NotesAccessManager.PermissionStatus
public struct BridgePermissionStatus: Sendable {
    /// Calendar access granted
    public let calendar: Bool

    /// Reminders access granted
    public let reminders: Bool

    /// Contacts access granted
    public let contacts: Bool

    public init(calendar: Bool, reminders: Bool, contacts: Bool) {
        self.calendar = calendar
        self.reminders = reminders
        self.contacts = contacts
    }

    /// Whether all permissions are granted
    public var allGranted: Bool {
        calendar && reminders && contacts
    }
}

// MARK: - BridgeCoordinator

/// Main coordinator for all import operations.
/// Provides a unified interface for file imports (via JS ETL) and
/// native framework imports (EventKit, Contacts, Notes).
@available(iOS 17.0, macOS 14.0, *)
@MainActor
public class BridgeCoordinator {
    private let etlBridge: ETLBridge
    private let eventKitAdapter: EventKitAdapter
    private let contactsAdapter: ContactsAdapter
    private let notesAdapter: NotesAdapter

    /// Create a BridgeCoordinator with a WKWebView for JS communication.
    /// - Parameter webView: The WKWebView hosting the Isometry web app
    public init(webView: WKWebView) {
        self.etlBridge = ETLBridge(webView: webView)
        self.eventKitAdapter = EventKitAdapter()
        self.contactsAdapter = ContactsAdapter()
        self.notesAdapter = NotesAdapter(etlBridge: etlBridge)
    }

    // MARK: - File Imports (via JS ETL)

    /// Import a file via the JavaScript ETL pipeline.
    ///
    /// The file is read, base64-encoded, and sent to window.isometryETL.importFile()
    /// which handles parsing (markdown, JSON, CSV, etc.) and database insertion.
    ///
    /// - Parameter url: URL to the file to import
    /// - Returns: ETLImportResult with success status and node count
    /// - Throws: ETLBridgeError for various failure modes
    public func importFile(_ url: URL) async throws -> ETLImportResult {
        try await etlBridge.importFile(url)
    }

    /// Import multiple files via the JavaScript ETL pipeline.
    ///
    /// Imports each file sequentially and aggregates results.
    /// Continues on individual failures to maximize successful imports.
    ///
    /// - Parameter urls: Array of file URLs to import
    /// - Returns: BatchImportResult with individual results and totals
    public func importFiles(_ urls: [URL]) async throws -> BatchImportResult {
        var results: [String: ETLImportResult] = [:]
        var totalSuccess = 0
        var totalFailed = 0

        for url in urls {
            let filename = url.lastPathComponent
            do {
                let result = try await etlBridge.importFile(url)
                results[filename] = result
                if result.success {
                    totalSuccess += 1
                } else {
                    totalFailed += 1
                }
            } catch {
                // Create failure result for this file
                let failureResult = ETLImportResult(
                    success: false,
                    nodeCount: 0,
                    errors: [error.localizedDescription]
                )
                results[filename] = failureResult
                totalFailed += 1
            }
        }

        return BatchImportResult(
            results: results,
            totalSuccess: totalSuccess,
            totalFailed: totalFailed
        )
    }

    // MARK: - Native Framework Imports

    /// Import calendar events from EventKit.
    ///
    /// Fetches events within the date range and converts to CanonicalNode format.
    /// Requires calendar permission to be granted first.
    ///
    /// - Parameters:
    ///   - from: Start date of the range
    ///   - to: End date of the range
    /// - Returns: Array of CanonicalNode representing calendar events
    /// - Throws: AdapterError.accessDenied if not authorized
    public func importFromEventKit(from startDate: Date, to endDate: Date) async throws -> [CanonicalNode] {
        try await eventKitAdapter.fetchEvents(from: startDate, to: endDate)
    }

    /// Import reminders from EventKit.
    ///
    /// Fetches incomplete reminders and converts to CanonicalNode format.
    /// Requires reminders permission to be granted first.
    ///
    /// - Returns: Array of CanonicalNode representing reminders
    /// - Throws: AdapterError.accessDenied if not authorized
    public func importReminders() async throws -> [CanonicalNode] {
        try await eventKitAdapter.fetchReminders()
    }

    /// Import contacts from CNContactStore.
    ///
    /// Fetches all contacts and converts to CanonicalNode format with
    /// email addresses and phone numbers stored in properties.
    /// Requires contacts permission to be granted first.
    ///
    /// - Returns: Array of CanonicalNode representing contacts
    /// - Throws: ContactsError.accessDenied if not authorized
    public func importFromContacts() async throws -> [CanonicalNode] {
        try await contactsAdapter.fetchContacts()
    }

    /// Import notes from an alto-index export directory.
    ///
    /// Recursively finds all .md files in the directory and imports
    /// them via the JavaScript ETL pipeline (gray-matter + marked).
    ///
    /// - Parameter directory: URL to the alto-index export directory
    /// - Returns: ImportSummary with counts and any errors
    /// - Throws: NotesError for directory/file issues
    public func importNotesExport(from directory: URL) async throws -> ImportSummary {
        try await notesAdapter.importNotesExport(from: directory)
    }

    // MARK: - Access Requests

    /// Request all permissions upfront.
    ///
    /// Requests calendar, reminders, and contacts permissions.
    /// Returns the status of each permission after the requests.
    ///
    /// - Returns: BridgePermissionStatus indicating which permissions were granted
    public func requestAllPermissions() async -> BridgePermissionStatus {
        // Request calendar access
        let calendarGranted: Bool
        do {
            calendarGranted = try await eventKitAdapter.requestAccess()
        } catch {
            calendarGranted = false
        }

        // Request reminders access
        let remindersGranted: Bool
        do {
            remindersGranted = try await eventKitAdapter.requestRemindersAccess()
        } catch {
            remindersGranted = false
        }

        // Request contacts access
        let contactsGranted: Bool
        do {
            contactsGranted = try await contactsAdapter.requestAccess()
        } catch {
            contactsGranted = false
        }

        return BridgePermissionStatus(
            calendar: calendarGranted,
            reminders: remindersGranted,
            contacts: contactsGranted
        )
    }

    // MARK: - Status Queries

    /// Check if the ETL bridge is initialized in JavaScript.
    /// - Returns: true if window.isometryETL is defined
    public func isETLInitialized() async throws -> Bool {
        try await etlBridge.isInitialized()
    }

    /// Get supported file extensions from the ETL coordinator.
    /// - Returns: Array of supported extensions (e.g., [".md", ".json", ".csv"])
    public func getSupportedExtensions() async throws -> [String] {
        try await etlBridge.getSupportedExtensions()
    }
}
