import SwiftUI
import UniformTypeIdentifiers

/// SwiftUI view for web clipping functionality
public struct WebClipperView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState

    @State private var url: String = ""
    @State private var extractionState: ExtractionState = .input
    @State private var extractedContent: WebClipContent?
    @State private var isExtracting = false
    @State private var isSaving = false
    @State private var error: WebClipError?
    @State private var progress: ExtractionProgress?

    public init() {}

    public var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Progress indicators
                progressHeader

                ScrollView {
                    VStack(spacing: 20) {
                        switch extractionState {
                        case .input:
                            urlInputSection
                        case .extracting:
                            ExtractionProgressView(
                                url: url,
                                progress: progress,
                                error: error,
                                onCancel: {
                                    resetState()
                                }
                            )
                        case .preview:
                            if let content = extractedContent {
                                WebClipContentPreview(
                                    content: content,
                                    isSaving: isSaving,
                                    onSave: saveContent,
                                    onBack: {
                                        extractionState = .input
                                        error = nil
                                    }
                                )
                            }
                        case .complete:
                            completionView
                        }
                    }
                    .padding()
                }
            }
            .navigationTitle("Web Clipper")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
            // Auto-paste from clipboard when app becomes active
            Task {
                await checkClipboardForURL()
            }
        }
    }

    // MARK: - View Components

    @ViewBuilder
    private var progressHeader: some View {
        HStack(spacing: 16) {
            progressStep(
                number: 1,
                title: "Enter URL",
                isActive: extractionState == .input,
                isCompleted: [.extracting, .preview, .complete].contains(extractionState)
            )

            progressConnector(isActive: extractionState != .input)

            progressStep(
                number: 2,
                title: "Extract",
                isActive: extractionState == .extracting,
                isCompleted: [.preview, .complete].contains(extractionState)
            )

            progressConnector(isActive: [.preview, .complete].contains(extractionState))

            progressStep(
                number: 3,
                title: "Save",
                isActive: extractionState == .preview,
                isCompleted: extractionState == .complete
            )
        }
        .padding()
        .background(Color(UIColor.systemBackground))
        .overlay(
            Rectangle()
                .frame(height: 1)
                .foregroundColor(Color(UIColor.separator)),
            alignment: .bottom
        )
    }

    private func progressStep(number: Int, title: String, isActive: Bool, isCompleted: Bool) -> some View {
        HStack(spacing: 8) {
            ZStack {
                Circle()
                    .frame(width: 32, height: 32)
                    .foregroundColor(
                        isCompleted ? .green :
                        isActive ? .blue : Color(UIColor.systemGray4)
                    )

                if isCompleted {
                    Image(systemName: "checkmark")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.white)
                } else if isActive && isExtracting {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        .scaleEffect(0.7)
                } else {
                    Text("\(number)")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(isActive ? .white : .gray)
                }
            }

            Text(title)
                .font(.caption)
                .fontWeight(isActive || isCompleted ? .medium : .regular)
                .foregroundColor(isActive || isCompleted ? .primary : .secondary)
        }
    }

    private func progressConnector(isActive: Bool) -> some View {
        Rectangle()
            .frame(height: 2)
            .foregroundColor(isActive ? .green : Color(UIColor.systemGray4))
            .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private var urlInputSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Enter URL to Clip")
                    .font(.headline)

                Text("Extract and save the main content from any web page")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            VStack(spacing: 12) {
                HStack {
                    TextField("https://example.com/article", text: $url)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .keyboardType(.URL)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                        .onSubmit {
                            extractContent()
                        }

                    Button("Paste") {
                        pasteFromClipboard()
                    }
                    .buttonStyle(.bordered)
                    .disabled(isExtracting)
                }

                if let error = error {
                    HStack(alignment: .top, spacing: 8) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.red)

                        VStack(alignment: .leading, spacing: 4) {
                            Text("Extraction Failed")
                                .font(.headline)
                                .foregroundColor(.red)

                            Text(error.localizedDescription)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }

                        Spacer()
                    }
                    .padding()
                    .background(Color.red.opacity(0.1))
                    .cornerRadius(8)
                }

                Button(action: extractContent) {
                    HStack {
                        if isExtracting {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                .scaleEffect(0.8)
                            Text("Extracting...")
                        } else {
                            Image(systemName: "arrow.down.circle")
                            Text("Extract Content")
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(url.isEmpty || isExtracting)
            }

            // Quick access suggestions
            quickAccessSection

            // Tips section
            tipsSection
        }
    }

    @ViewBuilder
    private var quickAccessSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Quick Access")
                .font(.subheadline)
                .fontWeight(.medium)

            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 8) {
                ForEach(commonDomains, id: \.self) { domain in
                    Button(domain) {
                        url = "https://\(domain)/"
                    }
                    .buttonStyle(.bordered)
                    .font(.caption)
                }
            }
        }
    }

    @ViewBuilder
    private var tipsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Tips for Best Results", systemImage: "lightbulb")
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(.blue)

            VStack(alignment: .leading, spacing: 4) {
                tipItem("Works best with articles, blog posts, and documentation")
                tipItem("Automatically removes ads, navigation, and clutter")
                tipItem("Preserves images and formatting from the original page")
                tipItem("Respects robots.txt and rate limits for ethical crawling")
            }
            .font(.caption)
            .foregroundColor(.secondary)
        }
        .padding()
        .background(Color.blue.opacity(0.1))
        .cornerRadius(8)
    }

    private func tipItem(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 4) {
            Text("•")
            Text(text)
            Spacer()
        }
    }

    @ViewBuilder
    private var completionView: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 60))
                .foregroundColor(.green)

            Text("Content Saved Successfully!")
                .font(.title2)
                .fontWeight(.semibold)

            Text("The web page has been clipped and added to your knowledge base.")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            Button("Done") {
                dismiss()
            }
            .buttonStyle(.borderedProminent)
            .padding(.top)
        }
        .padding()
    }

    // MARK: - Data and Actions

    private let commonDomains = [
        "github.com",
        "stackoverflow.com",
        "medium.com",
        "dev.to",
        "news.ycombinator.com",
        "reddit.com"
    ]

    private func extractContent() {
        guard !url.isEmpty else { return }

        extractionState = .extracting
        isExtracting = true
        error = nil
        progress = nil

        Task {
            do {
                // Create WebClipperActor and extract content
                let webClipper = try WebClipperActor(database: appState.database)
                let urlObject = URL(string: url.trimmingCharacters(in: .whitespacesAndNewlines))!

                let result = try await webClipper.clipWebContent(from: urlObject)

                if let node = result.nodes.first {
                    await MainActor.run {
                        extractedContent = WebClipContent(
                            title: node.name,
                            content: node.content ?? "",
                            summary: node.summary,
                            url: urlObject.absoluteString,
                            siteName: nil, // Could extract from metadata
                            author: nil,
                            publishedDate: nil,
                            tags: node.tags
                        )
                        extractionState = .preview
                        isExtracting = false
                    }
                } else {
                    throw WebClipError.extractionFailed("No content extracted")
                }

            } catch {
                await MainActor.run {
                    self.error = WebClipError.extractionFailed(error.localizedDescription)
                    extractionState = .input
                    isExtracting = false
                }
            }
        }
    }

    private func saveContent() {
        guard let content = extractedContent else { return }

        isSaving = true

        Task {
            do {
                // Content is already saved by the WebClipperActor
                // Just show success state
                await MainActor.run {
                    extractionState = .complete
                    isSaving = false
                }
            } catch {
                await MainActor.run {
                    self.error = WebClipError.saveFailed(error.localizedDescription)
                    isSaving = false
                }
            }
        }
    }

    private func resetState() {
        extractionState = .input
        extractedContent = nil
        error = nil
        progress = nil
        isExtracting = false
        isSaving = false
    }

    @MainActor
    private func pasteFromClipboard() {
        if let clipboardString = UIPasteboard.general.string {
            url = clipboardString.trimmingCharacters(in: .whitespacesAndNewlines)
        }
    }

    @MainActor
    private func checkClipboardForURL() async {
        guard url.isEmpty else { return }

        if let clipboardString = UIPasteboard.general.string?.trimmingCharacters(in: .whitespacesAndNewlines),
           let _ = URL(string: clipboardString),
           (clipboardString.hasPrefix("http://") || clipboardString.hasPrefix("https://")) {
            url = clipboardString
        }
    }
}

// MARK: - Supporting Types

enum ExtractionState {
    case input
    case extracting
    case preview
    case complete
}

struct WebClipContent {
    let title: String
    let content: String
    let summary: String?
    let url: String
    let siteName: String?
    let author: String?
    let publishedDate: Date?
    let tags: [String]
}

enum WebClipError: LocalizedError {
    case invalidURL
    case extractionFailed(String)
    case saveFailed(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL format"
        case .extractionFailed(let message):
            return "Extraction failed: \(message)"
        case .saveFailed(let message):
            return "Save failed: \(message)"
        }
    }
}

struct ExtractionProgress {
    let step: String
    let percentage: Double
    let details: String?
}