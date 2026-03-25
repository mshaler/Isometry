import Testing
import Foundation
import CloudKit
@testable import Isometry

// ---------------------------------------------------------------------------
// SyncError Mapping Tests (SYNC-T03..SYNC-T08 mapping coverage)
// ---------------------------------------------------------------------------
// Tests for CKError → SyncError.from(ckError:) human message mapping.
// Covers all 8 CKError categories defined in the UI-SPEC copywriting table.
//
// The copywriting contract requires exact message text — these tests verify it.

struct SyncErrorMappingTests {

    // MARK: - Network Errors

    @Test func networkUnavailableMapToHumanMessage() {
        let ckError = CKError(.networkUnavailable)
        let syncError = SyncError.from(ckError: ckError)

        #expect(syncError.humanMessage == "iCloud sync paused \u{2014} check your internet connection.")
        #expect(syncError.isRetryable == true)
        #expect(syncError.detail.contains("CKErrorDomain"))
    }

    @Test func networkFailureMapToHumanMessage() {
        let ckError = CKError(.networkFailure)
        let syncError = SyncError.from(ckError: ckError)

        #expect(syncError.humanMessage == "iCloud sync paused \u{2014} check your internet connection.")
        #expect(syncError.isRetryable == true)
    }

    // MARK: - Authentication

    @Test func notAuthenticatedMapToHumanMessage() {
        let ckError = CKError(.notAuthenticated)
        let syncError = SyncError.from(ckError: ckError)

        #expect(syncError.humanMessage == "Sign in to iCloud to sync your data.")
        #expect(syncError.isRetryable == false)
    }

    // MARK: - Storage Quota

    @Test func quotaExceededMapToHumanMessage() {
        let ckError = CKError(.quotaExceeded)
        let syncError = SyncError.from(ckError: ckError)

        #expect(syncError.humanMessage == "Your iCloud storage is full. Free up space to continue syncing.")
        #expect(syncError.isRetryable == false)
    }

    // MARK: - Server Availability

    @Test func serverResponseLostMapToHumanMessage() {
        let ckError = CKError(.serverResponseLost)
        let syncError = SyncError.from(ckError: ckError)

        #expect(syncError.humanMessage == "iCloud is temporarily unavailable. Retrying automatically.")
        #expect(syncError.isRetryable == true)
    }

    @Test func serviceUnavailableMapToHumanMessage() {
        let ckError = CKError(.serviceUnavailable)
        let syncError = SyncError.from(ckError: ckError)

        #expect(syncError.humanMessage == "iCloud is temporarily unavailable. Retrying automatically.")
        #expect(syncError.isRetryable == true)
    }

    // MARK: - Zone Busy

    @Test func zoneBusyMapToHumanMessage() {
        let ckError = CKError(.zoneBusy)
        let syncError = SyncError.from(ckError: ckError)

        #expect(syncError.humanMessage == "iCloud is busy. Retrying automatically.")
        #expect(syncError.isRetryable == true)
    }

    // MARK: - Token Expiry

    @Test func changeTokenExpiredMapToHumanMessage() {
        let ckError = CKError(.changeTokenExpired)
        let syncError = SyncError.from(ckError: ckError)

        #expect(syncError.humanMessage == "Sync state expired. Tap Re-sync All Data in Settings to restore.")
        #expect(syncError.isRetryable == false)
    }

    // MARK: - Zone Reset

    @Test func userDeletedZoneMapToHumanMessage() {
        let ckError = CKError(.userDeletedZone)
        let syncError = SyncError.from(ckError: ckError)

        #expect(syncError.humanMessage == "iCloud sync zone was reset. Tap Re-sync All Data in Settings.")
        #expect(syncError.isRetryable == false)
    }

    @Test func zoneNotFoundMapToHumanMessage() {
        let ckError = CKError(.zoneNotFound)
        let syncError = SyncError.from(ckError: ckError)

        #expect(syncError.humanMessage == "iCloud sync zone was reset. Tap Re-sync All Data in Settings.")
        #expect(syncError.isRetryable == false)
    }

    // MARK: - Unknown / Default

    @Test func unknownErrorCodeMapsToDefaultMessage() {
        // Use an error code that has no specific mapping
        let ckError = CKError(.internalError)
        let syncError = SyncError.from(ckError: ckError)

        // Default mapping: includes error code, retryable
        #expect(syncError.humanMessage.contains("Sync error"))
        #expect(syncError.humanMessage.contains("CKErrorDomain"))
        #expect(syncError.isRetryable == true)
    }

    @Test func defaultMessageContainsErrorCode() {
        let ckError = CKError(.serverRejectedRequest)
        let syncError = SyncError.from(ckError: ckError)

        #expect(syncError.humanMessage.contains("CKErrorDomain"))
        #expect(syncError.detail.contains("CKErrorDomain"))
    }

    // MARK: - Struct Equality

    @Test func syncErrorEqualityMatchesSameValues() {
        let a = SyncError(
            humanMessage: "iCloud is busy. Retrying automatically.",
            detail: "CKErrorDomain 23",
            isRetryable: true
        )
        let b = SyncError(
            humanMessage: "iCloud is busy. Retrying automatically.",
            detail: "CKErrorDomain 23",
            isRetryable: true
        )
        #expect(a == b)
    }

    @Test func syncErrorInequalityOnDifferentRetryable() {
        let retryable = SyncError(humanMessage: "msg", detail: "det", isRetryable: true)
        let nonRetryable = SyncError(humanMessage: "msg", detail: "det", isRetryable: false)
        #expect(retryable != nonRetryable)
    }
}
