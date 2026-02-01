import SwiftUI

/// SwiftUI view for showing web content extraction progress
public struct ExtractionProgressView: View {
    let url: String
    let progress: ExtractionProgress?
    let error: WebClipError?
    let onCancel: () -> Void

    public init(url: String, progress: ExtractionProgress?, error: WebClipError?, onCancel: @escaping () -> Void) {
        self.url = url
        self.progress = progress
        self.error = error
        self.onCancel = onCancel
    }

    public var body: some View {
        VStack(spacing: 20) {
            // Header
            VStack(alignment: .leading, spacing: 8) {
                Text("Extracting Content")
                    .font(.headline)

                Label {
                    Text(url)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                } icon: {
                    Image(systemName: "link")
                        .font(.caption)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if let error = error {
                errorView(error)
            } else {
                progressView
            }

            // Cancel button
            Button("Cancel", action: onCancel)
                .buttonStyle(.bordered)
        }
        .padding()
    }

    @ViewBuilder
    private var progressView: some View {
        VStack(spacing: 16) {
            // Overall progress
            if let progress = progress {
                VStack(spacing: 8) {
                    HStack {
                        Text(getStepDescription(progress.step))
                            .font(.subheadline)
                            .fontWeight(.medium)
                        Spacer()
                        Text("\(Int(progress.percentage))%")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    ProgressView(value: progress.percentage, total: 100)
                        .progressViewStyle(LinearProgressViewStyle())

                    if let details = progress.details {
                        Text(details)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }

            // Step breakdown
            VStack(spacing: 12) {
                ForEach(Array(extractionSteps.enumerated()), id: \.offset) { index, step in
                    stepRow(step: step, index: index)
                }
            }
        }
        .padding()
        .background(Color(UIColor.systemGray6))
        .cornerRadius(12)

        // Info section
        infoSection
    }

    private func errorView(_ error: WebClipError) -> some View {
        VStack(spacing: 16) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.title2)
                    .foregroundColor(.red)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Extraction Failed")
                        .font(.headline)
                        .foregroundColor(.red)

                    Text(error.localizedDescription)
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    troubleshootingTips
                }

                Spacer()
            }
            .padding()
            .background(Color.red.opacity(0.1))
            .cornerRadius(12)

            Button("Try Again") {
                // Would trigger retry logic
                onCancel()
            }
            .buttonStyle(.borderedProminent)
        }
    }

    @ViewBuilder
    private var troubleshootingTips: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Troubleshooting:")
                .font(.caption)
                .fontWeight(.medium)
                .padding(.top, 4)

            VStack(alignment: .leading, spacing: 2) {
                tipText("• Check if the URL is accessible")
                tipText("• Some sites block automated access")
                tipText("• Try a different page on the same site")
                tipText("• Wait a moment and try again")
            }
            .font(.caption)
            .foregroundColor(.secondary)
        }
    }

    private func tipText(_ text: String) -> some View {
        Text(text)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private var infoSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("What's Happening", systemImage: "info.circle")
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(.blue)

            VStack(alignment: .leading, spacing: 4) {
                Text("• Checking site permissions and rate limits")
                Text("• Downloading page content with privacy protection")
                Text("• Extracting main article text using readability algorithms")
                Text("• Caching images locally with deduplication")
                Text("• Removing tracking elements and ads")
            }
            .font(.caption)
            .foregroundColor(.secondary)
        }
        .padding()
        .background(Color.blue.opacity(0.1))
        .cornerRadius(12)
    }

    private func stepRow(step: ExtractionStep, index: Int) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .frame(width: 24, height: 24)
                    .foregroundColor(getStepColor(step: step.id, index: index))

                if isStepCompleted(step.id) {
                    Image(systemName: "checkmark")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.white)
                } else if isStepCurrent(step.id) {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        .scaleEffect(0.5)
                } else {
                    Text("\(index + 1)")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(.white)
                }
            }

            Text(step.label)
                .font(.caption)
                .fontWeight(isStepCurrent(step.id) || isStepCompleted(step.id) ? .medium : .regular)
                .foregroundColor(isStepCurrent(step.id) || isStepCompleted(step.id) ? .primary : .secondary)

            Spacer()
        }
    }

    // MARK: - Helper Methods

    private let extractionSteps = [
        ExtractionStep(id: "checking-robots", label: "Permission Check"),
        ExtractionStep(id: "downloading", label: "Download Page"),
        ExtractionStep(id: "extracting-content", label: "Extract Content"),
        ExtractionStep(id: "processing-images", label: "Process Images"),
        ExtractionStep(id: "extracting-metadata", label: "Extract Metadata"),
        ExtractionStep(id: "cleaning-content", label: "Clean Content"),
        ExtractionStep(id: "finalizing", label: "Finalize"),
    ]

    private func getStepDescription(_ stepId: String) -> String {
        switch stepId {
        case "checking-robots":
            return "Checking robots.txt permissions"
        case "downloading":
            return "Downloading page content"
        case "extracting-content":
            return "Extracting main content"
        case "processing-images":
            return "Processing and caching images"
        case "extracting-metadata":
            return "Extracting metadata"
        case "cleaning-content":
            return "Cleaning and formatting content"
        case "finalizing":
            return "Finalizing extraction"
        default:
            return "Processing..."
        }
    }

    private func getCurrentStepIndex() -> Int {
        guard let stepId = progress?.step else { return -1 }
        return extractionSteps.firstIndex { $0.id == stepId } ?? -1
    }

    private func isStepCompleted(_ stepId: String) -> Bool {
        let currentIndex = getCurrentStepIndex()
        let stepIndex = extractionSteps.firstIndex { $0.id == stepId } ?? -1
        return stepIndex < currentIndex
    }

    private func isStepCurrent(_ stepId: String) -> Bool {
        return progress?.step == stepId
    }

    private func getStepColor(step: String, index: Int) -> Color {
        if isStepCompleted(step) {
            return .green
        } else if isStepCurrent(step) {
            return .blue
        } else {
            return Color(UIColor.systemGray4)
        }
    }
}

// MARK: - Supporting Types

struct ExtractionStep {
    let id: String
    let label: String
}