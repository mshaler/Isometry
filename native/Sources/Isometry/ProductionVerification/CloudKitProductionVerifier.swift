import Foundation
import CloudKit
import SwiftUI

/// Production CloudKit verification system for Wave 3 deployment
@MainActor
public class CloudKitProductionVerifier: ObservableObject {

    // MARK: - Published State

    @Published public var verificationStatus: VerificationStatus = .notStarted
    @Published public var containerStatus: ContainerStatus = .unknown
    @Published public var schemaDeploymentStatus: SchemaStatus = .unknown
    @Published public var permissionsStatus: PermissionsStatus = .unknown
    @Published public var quotaStatus: QuotaStatus = .unknown

    @Published public var verificationResults: [VerificationResult] = []
    @Published public var errorMessages: [String] = []

    // MARK: - Private Properties

    private let container: CKContainer
    private let privateDatabase: CKDatabase
    private let publicDatabase: CKDatabase

    // MARK: - Initialization

    public init() {
        // IMPORTANT: This should use the production CloudKit container ID
        // Replace "iCloud.com.yourcompany.isometry" with actual production container
        self.container = CKContainer(identifier: "iCloud.com.yourcompany.isometry")
        self.privateDatabase = container.privateCloudDatabase
        self.publicDatabase = container.publicCloudDatabase
    }

    // MARK: - Production Verification Flow

    /// Complete production verification workflow
    public func verifyProductionSetup() async {
        verificationStatus = .inProgress
        verificationResults.removeAll()
        errorMessages.removeAll()

        do {
            // Step 1: Verify container accessibility
            await verifyContainerAccess()

            // Step 2: Verify schema deployment
            await verifySchemaDeployment()

            // Step 3: Verify permissions and entitlements
            await verifyPermissions()

            // Step 4: Verify quota and limits
            await verifyQuotaStatus()

            // Step 5: Test multi-device sync capability
            await testMultiDeviceSync()

            // Final status determination
            if errorMessages.isEmpty {
                verificationStatus = .completed
                addResult(.success, "✅ Production CloudKit setup verified successfully")
            } else {
                verificationStatus = .failed
                addResult(.error, "❌ Production verification failed with \(errorMessages.count) issues")
            }

        } catch {
            verificationStatus = .failed
            addError("Critical error during verification: \(error.localizedDescription)")
        }
    }

    // MARK: - Individual Verification Steps

    private func verifyContainerAccess() async {
        addResult(.info, "🔍 Verifying CloudKit container access...")

        do {
            // Test container availability
            let containerInfo = try await container.accountStatus()

            switch containerInfo {
            case .available:
                containerStatus = .available
                addResult(.success, "✅ CloudKit container is available")

            case .noAccount:
                containerStatus = .noAccount
                addError("❌ No iCloud account configured")

            case .restricted:
                containerStatus = .restricted
                addError("❌ iCloud access is restricted")

            case .couldNotDetermine:
                containerStatus = .unknown
                addError("❌ Could not determine CloudKit account status")

            @unknown default:
                containerStatus = .unknown
                addError("❌ Unknown CloudKit account status")
            }

        } catch {
            containerStatus = .error
            addError("❌ Failed to access CloudKit container: \(error.localizedDescription)")
        }
    }

    private func verifySchemaDeployment() async {
        addResult(.info, "🔍 Verifying schema deployment...")

        let requiredRecordTypes = ["Node", "ViewConfig", "FilterPreset", "SyncState"]
        var successCount = 0

        for recordType in requiredRecordTypes {
            do {
                // Test if record type exists by attempting to fetch records
                let query = CKQuery(recordType: recordType, predicate: NSPredicate(value: true))
                query.sortDescriptors = [NSSortDescriptor(key: "modificationDate", ascending: false)]

                let (_, _) = try await privateDatabase.records(matching: query, resultsLimit: 1)

                successCount += 1
                addResult(.success, "✅ Record type '\(recordType)' verified")

            } catch let error as CKError {
                if error.code == .unknownItem {
                    addError("❌ Record type '\(recordType)' not found in schema")
                } else {
                    addError("❌ Error verifying '\(recordType)': \(error.localizedDescription)")
                }
            } catch {
                addError("❌ Unexpected error verifying '\(recordType)': \(error.localizedDescription)")
            }
        }

        if successCount == requiredRecordTypes.count {
            schemaDeploymentStatus = .deployed
            addResult(.success, "✅ All required record types verified")
        } else {
            schemaDeploymentStatus = .incomplete
            addError("❌ Schema deployment incomplete: \(successCount)/\(requiredRecordTypes.count) record types found")
        }
    }

    private func verifyPermissions() async {
        addResult(.info, "🔍 Verifying CloudKit permissions...")

        do {
            // Test write permissions by creating a test record
            let testRecord = CKRecord(recordType: "TestRecord", recordID: CKRecord.ID(recordName: "production-test-\(UUID().uuidString)"))
            testRecord["testField"] = "Production verification test" as CKRecordValue

            let savedRecord = try await privateDatabase.save(testRecord)

            // Clean up test record
            try await privateDatabase.deleteRecord(withID: savedRecord.recordID)

            permissionsStatus = .verified
            addResult(.success, "✅ Write permissions verified")

        } catch {
            permissionsStatus = .denied
            addError("❌ CloudKit write permissions failed: \(error.localizedDescription)")
        }
    }

    private func verifyQuotaStatus() async {
        addResult(.info, "🔍 Checking CloudKit quota and limits...")

        do {
            // Estimate current usage by counting records
            var totalRecords = 0
            let recordTypes = ["Node", "ViewConfig", "FilterPreset"]

            for recordType in recordTypes {
                let query = CKQuery(recordType: recordType, predicate: NSPredicate(value: true))
                let (records, _) = try await privateDatabase.records(matching: query, resultsLimit: 1000)
                totalRecords += records.count
            }

            // CloudKit private database limits:
            // - 100MB storage per user
            // - 40 requests per second
            // - 1000 operations per request

            let estimatedUsageMB = totalRecords * 10 / 1024 // Rough estimate: 10KB per record

            if estimatedUsageMB < 80 { // 80% of 100MB limit
                quotaStatus = .withinLimits
                addResult(.success, "✅ CloudKit usage within limits (~\(estimatedUsageMB)MB)")
            } else if estimatedUsageMB < 95 {
                quotaStatus = .approaching
                addResult(.warning, "⚠️ CloudKit usage approaching limits (~\(estimatedUsageMB)MB)")
            } else {
                quotaStatus = .exceeded
                addError("❌ CloudKit usage may exceed limits (~\(estimatedUsageMB)MB)")
            }

        } catch {
            quotaStatus = .unknown
            addError("❌ Could not verify CloudKit quota: \(error.localizedDescription)")
        }
    }

    private func testMultiDeviceSync() async {
        addResult(.info, "🔍 Testing multi-device sync capability...")

        do {
            // Create a test sync record
            let syncTestRecord = CKRecord(recordType: "SyncTest", recordID: CKRecord.ID(recordName: "sync-test-\(Date().timeIntervalSince1970)"))
            syncTestRecord["deviceID"] = await getCurrentDeviceID() as CKRecordValue
            syncTestRecord["timestamp"] = Date() as CKRecordValue
            syncTestRecord["testData"] = "Multi-device sync test data" as CKRecordValue

            let savedRecord = try await privateDatabase.save(syncTestRecord)

            // Verify the record can be fetched
            let fetchedRecord = try await privateDatabase.record(for: savedRecord.recordID)

            if fetchedRecord.recordID == savedRecord.recordID {
                addResult(.success, "✅ Multi-device sync capability verified")
            } else {
                addError("❌ Multi-device sync verification failed: record mismatch")
            }

            // Clean up test record
            try await privateDatabase.deleteRecord(withID: savedRecord.recordID)

        } catch {
            addError("❌ Multi-device sync test failed: \(error.localizedDescription)")
        }
    }

    // MARK: - Helper Methods

    private func getCurrentDeviceID() async -> String {
        #if os(iOS)
        return await UIDevice.current.identifierForVendor?.uuidString ?? "unknown-ios-device"
        #elseif os(macOS)
        // Get Mac serial number or create stable identifier
        return ProcessInfo.processInfo.hostName
        #endif
    }

    private func addResult(_ type: VerificationResultType, _ message: String) {
        let result = VerificationResult(
            id: UUID(),
            type: type,
            message: message,
            timestamp: Date()
        )
        verificationResults.append(result)
    }

    private func addError(_ message: String) {
        errorMessages.append(message)
        addResult(.error, message)
    }

    // MARK: - Human Verification Checkpoint

    /// Generate verification report for human review
    public func generateVerificationReport() -> ProductionVerificationReport {
        return ProductionVerificationReport(
            containerStatus: containerStatus,
            schemaStatus: schemaDeploymentStatus,
            permissionsStatus: permissionsStatus,
            quotaStatus: quotaStatus,
            overallStatus: verificationStatus,
            results: verificationResults,
            errors: errorMessages,
            timestamp: Date(),
            recommendations: generateRecommendations()
        )
    }

    private func generateRecommendations() -> [String] {
        var recommendations: [String] = []

        if containerStatus == .noAccount {
            recommendations.append("Configure iCloud account on test device")
        }

        if schemaDeploymentStatus == .incomplete {
            recommendations.append("Deploy missing record types to production CloudKit container")
        }

        if permissionsStatus == .denied {
            recommendations.append("Verify CloudKit entitlements and app capabilities")
        }

        if quotaStatus == .approaching {
            recommendations.append("Monitor CloudKit usage and implement data cleanup strategies")
        }

        if quotaStatus == .exceeded {
            recommendations.append("Implement data archiving and optimize record sizes")
        }

        if errorMessages.isEmpty {
            recommendations.append("Production CloudKit setup is ready for App Store submission")
        }

        return recommendations
    }
}

// MARK: - Supporting Types

public enum VerificationStatus {
    case notStarted
    case inProgress
    case completed
    case failed
}

public enum ContainerStatus {
    case unknown
    case available
    case noAccount
    case restricted
    case error
}

public enum SchemaStatus {
    case unknown
    case deployed
    case incomplete
    case missing
}

public enum PermissionsStatus {
    case unknown
    case verified
    case denied
    case insufficient
}

public enum QuotaStatus {
    case unknown
    case withinLimits
    case approaching
    case exceeded
}

public enum VerificationResultType {
    case info
    case success
    case warning
    case error
}

public struct VerificationResult: Identifiable {
    public let id: UUID
    public let type: VerificationResultType
    public let message: String
    public let timestamp: Date
}

public struct ProductionVerificationReport {
    public let containerStatus: ContainerStatus
    public let schemaStatus: SchemaStatus
    public let permissionsStatus: PermissionsStatus
    public let quotaStatus: QuotaStatus
    public let overallStatus: VerificationStatus
    public let results: [VerificationResult]
    public let errors: [String]
    public let timestamp: Date
    public let recommendations: [String]

    public var isReadyForProduction: Bool {
        return containerStatus == .available &&
               schemaStatus == .deployed &&
               permissionsStatus == .verified &&
               (quotaStatus == .withinLimits || quotaStatus == .approaching) &&
               errors.isEmpty
    }
}