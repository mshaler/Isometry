import SwiftUI

/// SwiftUI view for previewing extracted web content before saving
public struct WebClipContentPreview: View {
    let content: WebClipContent
    let isSaving: Bool
    let onSave: () -> Void
    let onBack: () -> Void

    @State private var showingMetadata = false

    public init(content: WebClipContent, isSaving: Bool, onSave: @escaping () -> Void, onBack: @escaping () -> Void) {
        self.content = content
        self.isSaving = isSaving
        self.onSave = onSave
        self.onBack = onBack
    }

    public var body: some View {
        VStack(spacing: 0) {
            // Header
            headerSection

            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Content stats
                    statsSection

                    // Metadata toggle
                    metadataToggle

                    // Metadata section (if shown)
                    if showingMetadata {
                        metadataSection
                    }

                    // Content preview
                    contentSection

                    // Action buttons
                    actionButtons
                        .padding(.vertical)
                }
                .padding()
            }
        }
    }

    // MARK: - View Components

    @ViewBuilder
    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Preview Clipped Content")
                .font(.headline)

            Text("Review the extracted content before saving to your knowledge base")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(UIColor.systemBackground))
        .overlay(
            Rectangle()
                .frame(height: 1)
                .foregroundColor(Color(UIColor.separator)),
            alignment: .bottom
        )
    }

    @ViewBuilder
    private var statsSection: some View {
        HStack(spacing: 20) {
            statItem(
                value: "\(getWordCount())",
                label: "Words"
            )

            statItem(
                value: getReadingTime(),
                label: "Read Time"
            )

            statItem(
                value: "\(content.tags.count)",
                label: "Tags"
            )
        }
        .padding()
        .background(Color(UIColor.systemGray6))
        .cornerRadius(12)
    }

    private func statItem(value: String, label: String) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title3)
                .fontWeight(.semibold)

            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private var metadataToggle: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) {
                showingMetadata.toggle()
            }
        } label: {
            HStack {
                Image(systemName: showingMetadata ? "chevron.down" : "chevron.right")
                    .font(.caption)
                    .foregroundColor(.blue)

                Text(showingMetadata ? "Hide Metadata" : "Show Metadata")
                    .font(.subheadline)
                    .foregroundColor(.blue)

                Spacer()
            }
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var metadataSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Extracted Metadata")
                .font(.headline)

            VStack(alignment: .leading, spacing: 12) {
                metadataRow("Site", value: content.siteName ?? "Unknown")
                metadataRow("Author", value: content.author ?? "Unknown")
                metadataRow("Published", value: formatDate(content.publishedDate))

                if !content.tags.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Tags")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 8) {
                            ForEach(content.tags, id: \.self) { tag in
                                Text(tag)
                                    .font(.caption)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color.blue.opacity(0.1))
                                    .foregroundColor(.blue)
                                    .cornerRadius(4)
                            }
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text("Source URL")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Text(content.url)
                        .font(.caption)
                        .fontFamily(.monospaced)
                        .foregroundColor(.primary)
                        .textSelection(.enabled)
                }
            }
        }
        .padding()
        .background(Color(UIColor.systemGray6))
        .cornerRadius(12)
    }

    private func metadataRow(_ label: String, value: String) -> some View {
        HStack(alignment: .top) {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(width: 60, alignment: .leading)

            Text(value)
                .font(.caption)
                .fontWeight(.medium)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder
    private var contentSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Content Preview")
                .font(.headline)

            // Title
            VStack(alignment: .leading, spacing: 8) {
                Text(content.title)
                    .font(.title2)
                    .fontWeight(.semibold)

                if let summary = content.summary {
                    Text(summary)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .italic()
                }
            }

            Divider()

            // Content preview (truncated)
            ScrollView {
                Text(getPreviewContent())
                    .font(.body)
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(maxHeight: 300)
            .padding()
            .background(Color(UIColor.systemGray6))
            .cornerRadius(8)

            if content.content.count > 2000 {
                Text("Content truncated for preview. Full content will be saved.")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .italic()
            }
        }
    }

    @ViewBuilder
    private var actionButtons: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                Button("Back") {
                    onBack()
                }
                .buttonStyle(.bordered)
                .disabled(isSaving)

                Button {
                    onSave()
                } label: {
                    HStack {
                        if isSaving {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                .scaleEffect(0.8)
                            Text("Saving...")
                        } else {
                            Image(systemName: "square.and.arrow.down")
                            Text("Save to Knowledge Base")
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(isSaving)
            }

            // Save info
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "checkmark.circle")
                    .foregroundColor(.green)
                    .font(.caption)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Ready to save:")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(.green)

                    Text("This content will be added to your knowledge base as a web clip. Images are cached locally and all tracking has been removed.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .padding()
            .background(Color.green.opacity(0.1))
            .cornerRadius(8)
        }
    }

    // MARK: - Helper Methods

    private func getWordCount() -> Int {
        return content.content.components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
            .count
    }

    private func getReadingTime() -> String {
        let wordCount = getWordCount()
        let wordsPerMinute = 200
        let minutes = max(1, Int(ceil(Double(wordCount) / Double(wordsPerMinute))))
        return minutes == 1 ? "1 min" : "\(minutes) mins"
    }

    private func formatDate(_ date: Date?) -> String {
        guard let date = date else { return "Unknown" }

        let formatter = DateFormatter()
        formatter.dateStyle = .long
        return formatter.string(from: date)
    }

    private func getPreviewContent() -> String {
        // Strip HTML tags for preview
        let plainText = content.content.replacingOccurrences(
            of: "<[^>]+>",
            with: "",
            options: .regularExpression
        )

        // Return truncated version for preview
        if plainText.count > 2000 {
            return String(plainText.prefix(2000)) + "..."
        }
        return plainText
    }
}