import SwiftUI

// ---------------------------------------------------------------------------
// SyncErrorBanner -- Persistent sync error banner with retry countdown (SUXR-01, SUXR-02)
// ---------------------------------------------------------------------------
// Displayed at the top of the content area when SyncStatusPublisher.status == .error.
// Provides:
//   - Human-readable error message from SyncError
//   - Retry Sync button (resets countdown to 5s)
//   - Dismiss [x] button (hides for current error; reappears on new error)
//   - Details disclosure (CKError domain/code) collapsed by default
//   - Auto-retry countdown with exponential backoff: 5s, 15s, 60s, 300s
//
// Accessibility:
//   - Banner container has .accessibilityLabel with error message
//   - Countdown label is .accessibilityHidden(true) to avoid interrupting VoiceOver
//   - DisclosureGroup is natively accessible (expand/collapse state announced)

struct SyncErrorBanner: View {
    @ObservedObject var statusPublisher: SyncStatusPublisher
    let onRetry: () -> Void
    let onDismiss: () -> Void

    @State private var isDetailsExpanded = false
    @State private var countdown: Int = 5
    @State private var retryAttempt: Int = 0
    @State private var countdownTimer: Timer?
    @State private var isDismissed = false

    // Exponential backoff: 5s, 15s, 60s, 300s
    private var backoffInterval: Int {
        [5, 15, 60, 300][min(retryAttempt, 3)]
    }

    var body: some View {
        if case .error(let syncError) = statusPublisher.status, !isDismissed {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.orange)
                    Text("iCloud Sync Error")
                        .font(.headline)
                    Spacer()
                    Button("Retry Sync") {
                        countdown = 5
                        retryAttempt = 0
                        onRetry()
                    }
                    .buttonStyle(.bordered)
                    Button {
                        isDismissed = true
                        countdownTimer?.invalidate()
                        countdownTimer = nil
                        onDismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
                Text(syncError.humanMessage)
                    .font(.body)
                DisclosureGroup("Details", isExpanded: $isDetailsExpanded) {
                    Text(syncError.detail)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if syncError.isRetryable {
                    Text("Retrying in \(countdown)s\u{2026}")
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .accessibilityHidden(true)
                }
            }
            .padding()
            .background(.regularMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal)
            .padding(.top, 8)
            .accessibilityLabel("iCloud sync error. \(syncError.humanMessage)")
            .onChange(of: statusPublisher.status) { _, newStatus in
                if case .idle = newStatus {
                    // Sync succeeded -- reset state so banner reappears if a new error occurs
                    isDismissed = false
                    retryAttempt = 0
                    countdownTimer?.invalidate()
                    countdownTimer = nil
                } else if case .error = newStatus {
                    // New error -- reappear and restart countdown
                    isDismissed = false
                    startCountdown()
                }
            }
            .onAppear { startCountdown() }
            .onDisappear {
                countdownTimer?.invalidate()
                countdownTimer = nil
            }
        }
    }

    // MARK: - Countdown Timer

    private func startCountdown() {
        guard case .error(let syncError) = statusPublisher.status, syncError.isRetryable else { return }
        countdown = backoffInterval
        countdownTimer?.invalidate()
        countdownTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            if countdown > 1 {
                countdown -= 1
            } else {
                countdownTimer?.invalidate()
                countdownTimer = nil
                retryAttempt += 1
                onRetry()
            }
        }
    }
}
