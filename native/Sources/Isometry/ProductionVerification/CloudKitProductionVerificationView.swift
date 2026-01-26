import SwiftUI
import CloudKit

/// Production CloudKit verification interface for Wave 3 deployment
public struct CloudKitProductionVerificationView: View {
    @StateObject private var verifier = CloudKitProductionVerifier()
    @State private var showingReport = false
    @State private var isRunningVerification = false

    public init() {}

    public var body: some View {
        NavigationView {
            VStack(alignment: .leading, spacing: 20) {
                headerSection
                statusSection
                resultsSection
                actionSection
            }
            .padding()
            .navigationTitle("Production CloudKit Verification")
            .sheet(isPresented: $showingReport) {
                ProductionVerificationReportView(report: verifier.generateVerificationReport())
            }
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "icloud.and.arrow.up")
                    .foregroundColor(.blue)
                    .font(.title2)

                Text("CloudKit Production Setup")
                    .font(.title2)
                    .fontWeight(.semibold)
            }

            Text("Verify production CloudKit container and prepare for App Store submission")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            if verifier.verificationStatus != .notStarted {
                statusBadge
            }
        }
    }

    private var statusBadge: some View {
        HStack {
            statusIcon
            Text(statusText)
                .font(.caption)
                .fontWeight(.medium)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(statusColor.opacity(0.1))
        .foregroundColor(statusColor)
        .cornerRadius(8)
    }

    private var statusIcon: some View {
        switch verifier.verificationStatus {
        case .notStarted:
            return Image(systemName: "clock")
        case .inProgress:
            return Image(systemName: "progress.indicator")
        case .completed:
            return Image(systemName: "checkmark.circle.fill")
        case .failed:
            return Image(systemName: "exclamationmark.triangle.fill")
        }
    }

    private var statusText: String {
        switch verifier.verificationStatus {
        case .notStarted:
            return "Ready to verify"
        case .inProgress:
            return "Verification in progress..."
        case .completed:
            return "Verification completed"
        case .failed:
            return "Verification failed"
        }
    }

    private var statusColor: Color {
        switch verifier.verificationStatus {
        case .notStarted:
            return .gray
        case .inProgress:
            return .blue
        case .completed:
            return .green
        case .failed:
            return .red
        }
    }

    // MARK: - Status Section

    private var statusSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Verification Steps")
                .font(.headline)
                .accessibilityAddTraits(.isHeader)

            LazyVGrid(columns: [
                GridItem(.adaptive(minimum: 140), spacing: 12),
                GridItem(.adaptive(minimum: 140), spacing: 12)
            ], spacing: 12) {
                VerificationStepCard(
                    title: "Container Access",
                    icon: "icloud",
                    status: verifier.containerStatus.displayStatus
                )

                VerificationStepCard(
                    title: "Schema Deployment",
                    icon: "doc.text",
                    status: verifier.schemaDeploymentStatus.displayStatus
                )

                VerificationStepCard(
                    title: "Permissions",
                    icon: "lock.open",
                    status: verifier.permissionsStatus.displayStatus
                )

                VerificationStepCard(
                    title: "Quota & Limits",
                    icon: "chart.bar",
                    status: verifier.quotaStatus.displayStatus
                )
            }
        }
    }

    // MARK: - Results Section

    private var resultsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            if !verifier.verificationResults.isEmpty {
                Text("Verification Results")
                    .font(.headline)

                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 8) {
                        ForEach(verifier.verificationResults) { result in
                            VerificationResultRow(result: result)
                        }
                    }
                }
                .frame(maxHeight: 200)
                .background(Color.gray.opacity(0.05))
                .cornerRadius(8)
            }
        }
    }

    // MARK: - Action Section

    private var actionSection: some View {
        VStack(spacing: 12) {
            HStack {
                Button(action: startVerification) {
                    HStack {
                        if isRunningVerification {
                            ProgressView()
                                .scaleEffect(0.8)
                        } else {
                            Image(systemName: "play.circle.fill")
                        }
                        Text(isRunningVerification ? "Verifying..." : "Run Production Verification")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(isRunningVerification)
                .accessibilityLabel(isRunningVerification ? "CloudKit verification in progress" : "Run CloudKit production verification")
                .accessibilityHint(isRunningVerification ? "Please wait while CloudKit production setup is verified" : "Tap to start CloudKit production verification checks")

                if verifier.verificationStatus == .completed || verifier.verificationStatus == .failed {
                    Button("View Report") {
                        showingReport = true
                    }
                    .buttonStyle(.bordered)
                }
            }

            if !verifier.errorMessages.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.orange)
                        Text("Issues Found")
                            .font(.subheadline)
                            .fontWeight(.medium)
                    }

                    ForEach(Array(verifier.errorMessages.enumerated()), id: \.offset) { _, error in
                        Text("• \(error)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding()
                .background(Color.orange.opacity(0.1))
                .cornerRadius(8)
            }

            // Human Verification Checkpoint
            humanVerificationCheckpoint
        }
    }

    // MARK: - Human Verification Checkpoint

    private var humanVerificationCheckpoint: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "person.circle")
                    .foregroundColor(.purple)
                Text("Human Verification Required")
                    .font(.subheadline)
                    .fontWeight(.medium)
            }

            Text("Before proceeding to App Store submission, please manually verify:")
                .font(.caption)
                .foregroundStyle(.secondary)

            VStack(alignment: .leading, spacing: 4) {
                CheckpointItem(text: "CloudKit container accessible from multiple devices")
                CheckpointItem(text: "Sync operations work correctly between iPhone ↔ iPad ↔ Mac")
                CheckpointItem(text: "Conflict resolution handles edge cases properly")
                CheckpointItem(text: "Production data matches development expectations")
            }

            Button("Mark as Human Verified ✓") {
                // This would mark the checkpoint as complete
                // In production, this might require additional authentication
            }
            .buttonStyle(.bordered)
            .foregroundColor(.purple)
        }
        .padding()
        .background(Color.purple.opacity(0.05))
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.purple.opacity(0.3), lineWidth: 1)
        )
    }

    // MARK: - Actions

    private func startVerification() {
        isRunningVerification = true

        Task {
            await verifier.verifyProductionSetup()
            await MainActor.run {
                isRunningVerification = false
            }
        }
    }
}

// MARK: - Supporting Views

struct VerificationStepCard: View {
    let title: String
    let icon: String
    let status: (color: Color, icon: String, text: String)

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(.blue)

            Text(title)
                .font(.caption)
                .fontWeight(.medium)
                .multilineTextAlignment(.center)

            HStack(spacing: 4) {
                Image(systemName: status.icon)
                    .foregroundColor(status.color)
                    .font(.caption)
                Text(status.text)
                    .font(.caption)
                    .foregroundColor(status.color)
            }
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.gray.opacity(0.05))
        .cornerRadius(8)
    }
}

struct VerificationResultRow: View {
    let result: VerificationResult

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: result.type.icon)
                .foregroundColor(result.type.color)
                .frame(width: 16)

            VStack(alignment: .leading, spacing: 2) {
                Text(result.message)
                    .font(.caption)

                Text(result.timestamp, style: .time)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }

            Spacer()
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
    }
}

struct CheckpointItem: View {
    let text: String
    @State private var isChecked = false

    var body: some View {
        HStack {
            Button(action: { isChecked.toggle() }) {
                Image(systemName: isChecked ? "checkmark.square.fill" : "square")
                    .foregroundColor(isChecked ? .purple : .gray)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(isChecked ? "Verified: \(text)" : "Not verified: \(text)")
            .accessibilityHint("Tap to toggle verification status")
            .accessibilityRole(.checkbox)
            .accessibilityValue(isChecked ? "checked" : "unchecked")

            Text(text)
                .font(.caption)
                .strikethrough(isChecked)
                .foregroundStyle(isChecked ? .secondary : .primary)
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Extensions

extension ContainerStatus {
    var displayStatus: (color: Color, icon: String, text: String) {
        switch self {
        case .unknown:
            return (.gray, "questionmark.circle", "Unknown")
        case .available:
            return (.green, "checkmark.circle.fill", "Available")
        case .noAccount:
            return (.red, "xmark.circle.fill", "No Account")
        case .restricted:
            return (.orange, "exclamationmark.triangle.fill", "Restricted")
        case .error:
            return (.red, "exclamationmark.circle.fill", "Error")
        }
    }
}

extension SchemaStatus {
    var displayStatus: (color: Color, icon: String, text: String) {
        switch self {
        case .unknown:
            return (.gray, "questionmark.circle", "Unknown")
        case .deployed:
            return (.green, "checkmark.circle.fill", "Deployed")
        case .incomplete:
            return (.orange, "exclamationmark.triangle.fill", "Incomplete")
        case .missing:
            return (.red, "xmark.circle.fill", "Missing")
        }
    }
}

extension PermissionsStatus {
    var displayStatus: (color: Color, icon: String, text: String) {
        switch self {
        case .unknown:
            return (.gray, "questionmark.circle", "Unknown")
        case .verified:
            return (.green, "checkmark.circle.fill", "Verified")
        case .denied:
            return (.red, "xmark.circle.fill", "Denied")
        case .insufficient:
            return (.orange, "exclamationmark.triangle.fill", "Insufficient")
        }
    }
}

extension QuotaStatus {
    var displayStatus: (color: Color, icon: String, text: String) {
        switch self {
        case .unknown:
            return (.gray, "questionmark.circle", "Unknown")
        case .withinLimits:
            return (.green, "checkmark.circle.fill", "Within Limits")
        case .approaching:
            return (.orange, "exclamationmark.triangle.fill", "Approaching")
        case .exceeded:
            return (.red, "xmark.circle.fill", "Exceeded")
        }
    }
}

extension VerificationResultType {
    var color: Color {
        switch self {
        case .info:
            return .blue
        case .success:
            return .green
        case .warning:
            return .orange
        case .error:
            return .red
        }
    }

    var icon: String {
        switch self {
        case .info:
            return "info.circle"
        case .success:
            return "checkmark.circle.fill"
        case .warning:
            return "exclamationmark.triangle.fill"
        case .error:
            return "xmark.circle.fill"
        }
    }
}