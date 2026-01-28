import SwiftUI
import os.log

#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

#if canImport(UniformTypeIdentifiers)
import UniformTypeIdentifiers
#endif

/// Export and share interface for notebook content
/// Provides native platform sharing with format selection and export options
public struct ExportShareView: View {
    @StateObject private var exportState = ExportState()
    @Environment(\.dismiss) private var dismiss

    // Dependencies
    private let exportManager: ExportManager
    private let cards: [NotebookCard]

    // Configuration
    private let showCloseButton: Bool
    private let defaultFormat: ExportFormat

    private let logger = Logger(subsystem: "com.isometry.app", category: "ExportShareView")

    public init(
        exportManager: ExportManager,
        cards: [NotebookCard],
        showCloseButton: Bool = true,
        defaultFormat: ExportFormat = .pdf
    ) {
        self.exportManager = exportManager
        self.cards = cards
        self.showCloseButton = showCloseButton
        self.defaultFormat = defaultFormat

        self._exportState = StateObject(wrappedValue: ExportState(selectedFormat: defaultFormat))
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Header
                headerView

                // Content
                if exportState.isExporting {
                    exportProgressView
                } else if exportState.exportResult != nil {
                    exportCompleteView
                } else {
                    exportConfigurationView
                }
            }
            .navigationTitle("Export & Share")
            #if canImport(UIKit)
.navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                if showCloseButton {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { dismiss() }
                    }
                }
            }
        }
        .alert("Export Error", isPresented: .constant(exportState.error != nil)) {
            Button("OK") { exportState.error = nil }
        } message: {
            if let error = exportState.error {
                Text(error.localizedDescription)
            }
        }
    }

    // MARK: - Header View

    @ViewBuilder
    private var headerView: some View {
        HStack(spacing: 16) {
            // Export icon
            Image(systemName: exportState.selectedFormat.iconName)
                .font(.system(size: 24))
                .foregroundStyle(exportState.selectedFormat.accentColor)
                .frame(width: 32, height: 32)

            VStack(alignment: .leading, spacing: 2) {
                Text("Export Notebook")
                    .font(.headline)
                    .foregroundStyle(.primary)

                Text(cards.count == 1 ? cards[0].title : "\(cards.count) cards")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            // Format indicator
            if !exportState.isExporting {
                Text(exportState.selectedFormat.rawValue)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(.secondary.opacity(0.1))
                    .clipShape(Capsule())
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .overlay(
            Divider(),
            alignment: .bottom
        )
    }

    // MARK: - Configuration View

    @ViewBuilder
    private var exportConfigurationView: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Format selection
                formatSelectionSection

                // Export options
                exportOptionsSection

                // Preview section
                if cards.count <= 3 {
                    previewSection
                }

                Spacer(minLength: 20)
            }
            .padding()
        }

        // Export button
        VStack(spacing: 0) {
            Divider()

            HStack(spacing: 16) {
                // Preview button
                Button(action: previewExport) {
                    HStack(spacing: 8) {
                        Image(systemName: "eye")
                        Text("Preview")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .disabled(cards.isEmpty)

                // Export & Share button
                Button(action: startExport) {
                    HStack(spacing: 8) {
                        Image(systemName: "square.and.arrow.up")
                        Text("Export & Share")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(cards.isEmpty)
            }
            .padding()
        }
        .background(.regularMaterial)
    }

    // MARK: - Format Selection

    @ViewBuilder
    private var formatSelectionSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Export Format")
                .font(.headline)
                .foregroundStyle(.primary)

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 12) {
                ForEach(ExportFormat.allCases, id: \.self) { format in
                    formatOptionCard(format)
                }
            }
        }
    }

    @ViewBuilder
    private func formatOptionCard(_ format: ExportFormat) -> some View {
        VStack(spacing: 8) {
            Image(systemName: format.iconName)
                .font(.system(size: 24))
                .foregroundStyle(format.accentColor)

            Text(format.rawValue)
                .font(.subheadline)
                .fontWeight(.medium)

            Text(format.description)
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(exportState.selectedFormat == format ? format.accentColor.opacity(0.1) : Color.clear)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(exportState.selectedFormat == format ? format.accentColor : .secondary.opacity(0.3), lineWidth: 1.5)
        )
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .onTapGesture {
            exportState.selectedFormat = format
            updateOptionsForFormat(format)
        }
    }

    // MARK: - Export Options

    @ViewBuilder
    private var exportOptionsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Export Options")
                .font(.headline)
                .foregroundStyle(.primary)

            VStack(spacing: 12) {
                // Content options
                optionToggle("Include Titles", isOn: $exportState.options.includeTitle)
                optionToggle("Include Content", isOn: $exportState.options.includeContent)
                optionToggle("Include Metadata", isOn: $exportState.options.includeMetadata)
                optionToggle("Include Properties", isOn: $exportState.options.includeProperties)

                if cards.count > 1 {
                    optionToggle("Table of Contents", isOn: $exportState.options.includeTableOfContents)
                    optionToggle("Page Breaks", isOn: $exportState.options.includePageBreaks)
                }
            }
        }
        .padding(.vertical)
        .padding(.horizontal, 4)
    }

    @ViewBuilder
    private func optionToggle(_ title: String, isOn: Binding<Bool>) -> some View {
        HStack {
            Text(title)
                .font(.body)

            Spacer()

            Toggle("", isOn: isOn)
                .labelsHidden()
        }
    }

    // MARK: - Preview Section

    @ViewBuilder
    private var previewSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Content Preview")
                .font(.headline)
                .foregroundStyle(.primary)

            VStack(spacing: 8) {
                ForEach(cards.prefix(3), id: \.id) { card in
                    cardPreviewRow(card)
                }

                if cards.count > 3 {
                    HStack {
                        Image(systemName: "ellipsis")
                            .foregroundStyle(.secondary)
                        Text("and \(cards.count - 3) more cards")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Spacer()
                    }
                    .padding(.horizontal)
                }
            }
            .padding(.vertical, 8)
            .background(.secondary.opacity(0.05))
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }

    @ViewBuilder
    private func cardPreviewRow(_ card: NotebookCard) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "doc.text")
                .font(.system(size: 16))
                .foregroundStyle(.blue)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                Text(card.title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .lineLimit(1)

                if !card.tags.isEmpty {
                    HStack(spacing: 4) {
                        ForEach(card.tags.prefix(3), id: \.self) { tag in
                            Text(tag)
                                .font(.caption2)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(.secondary.opacity(0.2))
                                .clipShape(Capsule())
                        }

                        if card.tags.count > 3 {
                            Text("+\(card.tags.count - 3)")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }

            Spacer()

            Text(formatFileSize(card.markdownContent.count))
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
    }

    // MARK: - Export Progress

    @ViewBuilder
    private var exportProgressView: some View {
        VStack(spacing: 24) {
            Spacer()

            VStack(spacing: 16) {
                ProgressView()
                    .scaleEffect(1.5)

                VStack(spacing: 8) {
                    Text("Exporting...")
                        .font(.headline)

                    Text("Preparing \(cards.count) card\(cards.count == 1 ? "" : "s") for \(exportState.selectedFormat.rawValue) export")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
            }

            Spacer()

            Button("Cancel") {
                cancelExport()
            }
            .buttonStyle(.bordered)
        }
        .padding()
    }

    // MARK: - Export Complete

    @ViewBuilder
    private var exportCompleteView: some View {
        if let result = exportState.exportResult {
            VStack(spacing: 24) {
                Spacer()

                // Success icon
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 64))
                    .foregroundStyle(.green)

                VStack(spacing: 12) {
                    Text("Export Complete!")
                        .font(.title2)
                        .fontWeight(.semibold)

                    VStack(spacing: 4) {
                        Text("Created \(result.format.rawValue) file")
                            .font(.body)

                        Text("\(result.fileSizeFormatted) • \(result.cardCount) card\(result.cardCount == 1 ? "" : "s")")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer()

                // Action buttons
                VStack(spacing: 12) {
                    Button(action: { shareExportedFile(result) }) {
                        HStack(spacing: 8) {
                            Image(systemName: "square.and.arrow.up")
                            Text("Share File")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)

                    HStack(spacing: 12) {
                        Button("Save to Files") {
                            saveToFiles(result)
                        }
                        .buttonStyle(.bordered)
                        .frame(maxWidth: .infinity)

                        Button("New Export") {
                            resetExport()
                        }
                        .buttonStyle(.bordered)
                        .frame(maxWidth: .infinity)
                    }
                }
            }
            .padding()
        }
    }

    // MARK: - Actions

    private func updateOptionsForFormat(_ format: ExportFormat) {
        // Adjust default options based on format
        switch format {
        case .pdf:
            exportState.options.includePageBreaks = true
            exportState.options.includeTableOfContents = cards.count > 1
        case .html:
            exportState.options.includePageBreaks = false
            exportState.options.includeTableOfContents = cards.count > 3
        case .markdown:
            exportState.options.includePageBreaks = false
            exportState.options.includeTableOfContents = cards.count > 5
        case .json:
            // JSON exports include everything by default
            exportState.options = ExportOptions.default
        }
    }

    private func previewExport() {
        logger.debug("Preview export requested for format: \(exportState.selectedFormat.rawValue)")
        // TODO: Implement preview functionality
    }

    private func startExport() {
        logger.debug("Starting export for \(cards.count) cards in format: \(exportState.selectedFormat.rawValue)")

        exportState.isExporting = true
        exportState.error = nil

        Task {
            do {
                let result: ExportResult

                if cards.count == 1 {
                    result = try await exportManager.exportCard(
                        cardId: cards[0].id,
                        format: exportState.selectedFormat,
                        options: exportState.options
                    )
                } else {
                    let cardIds = cards.map { $0.id }
                    result = try await exportManager.exportCards(
                        cardIds: cardIds,
                        format: exportState.selectedFormat,
                        options: exportState.options
                    )
                }

                await MainActor.run {
                    exportState.isExporting = false
                    exportState.exportResult = result
                    logger.debug("Export completed successfully: \(result.fileURL.lastPathComponent)")
                }

            } catch {
                await MainActor.run {
                    exportState.isExporting = false
                    exportState.error = error
                    logger.error("Export failed: \(error.localizedDescription)")
                }
            }
        }
    }

    private func cancelExport() {
        exportState.isExporting = false
        logger.debug("Export cancelled by user")
    }

    private func shareExportedFile(_ result: ExportResult) {
        logger.debug("Sharing exported file: \(result.fileURL.lastPathComponent)")

        #if canImport(UIKit)
        let activityViewController = UIActivityViewController(
            activityItems: [result.fileURL],
            applicationActivities: nil
        )

        // Configure for iPad
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let window = windowScene.windows.first {
            if let popover = activityViewController.popoverPresentationController {
                popover.sourceView = window.rootViewController?.view
                popover.sourceRect = CGRect(x: window.bounds.midX, y: window.bounds.midY, width: 0, height: 0)
                popover.permittedArrowDirections = []
            }
            window.rootViewController?.present(activityViewController, animated: true)
        }

        #elseif canImport(AppKit)
        let sharingServicePicker = NSSharingServicePicker(items: [result.fileURL])

        if let window = NSApplication.shared.keyWindow,
           let contentView = window.contentView {
            let bounds = contentView.bounds
            let rect = NSRect(x: bounds.midX - 50, y: bounds.midY, width: 100, height: 1)
            sharingServicePicker.show(relativeTo: rect, of: contentView, preferredEdge: .minY)
        }
        #endif
    }

    private func saveToFiles(_ result: ExportResult) {
        logger.debug("Saving to files: \(result.fileURL.lastPathComponent)")

        #if canImport(UIKit)
        let documentPicker = UIDocumentPickerViewController(forExporting: [result.fileURL])
        documentPicker.shouldShowFileExtensions = true

        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let window = windowScene.windows.first {
            window.rootViewController?.present(documentPicker, animated: true)
        }

        #elseif canImport(AppKit)
        let savePanel = NSSavePanel()
        savePanel.nameFieldStringValue = result.fileURL.lastPathComponent
        savePanel.allowedContentTypes = [result.format.utType]

        savePanel.begin { response in
            if response == .OK, let url = savePanel.url {
                do {
                    try FileManager.default.copyItem(at: result.fileURL, to: url)
                    self.logger.debug("File saved to: \(url.path)")
                } catch {
                    self.exportState.error = error
                    self.logger.error("Failed to save file: \(error.localizedDescription)")
                }
            }
        }
        #endif
    }

    private func resetExport() {
        exportState.exportResult = nil
        exportState.error = nil
        exportState.isExporting = false
        logger.debug("Export state reset for new export")
    }

    // MARK: - Helper Methods

    private func formatFileSize(_ byteCount: Int) -> String {
        return ByteCountFormatter().string(fromByteCount: Int64(byteCount))
    }
}

// MARK: - Export State

@MainActor
private class ExportState: ObservableObject {
    @Published var selectedFormat: ExportFormat
    @Published var options: ExportOptions
    @Published var isExporting = false
    @Published var exportResult: ExportResult?
    @Published var error: Error?

    init(selectedFormat: ExportFormat = .pdf) {
        self.selectedFormat = selectedFormat
        self.options = ExportOptions.default
    }
}

// MARK: - ExportFormat Extensions

extension ExportFormat {
    var iconName: String {
        switch self {
        case .pdf:
            return "doc.richtext"
        case .html:
            return "safari"
        case .markdown:
            return "textformat"
        case .json:
            return "curlybraces"
        }
    }

    var accentColor: Color {
        switch self {
        case .pdf:
            return .red
        case .html:
            return .blue
        case .markdown:
            return .green
        case .json:
            return .orange
        }
    }

    var description: String {
        switch self {
        case .pdf:
            return "Formatted document"
        case .html:
            return "Web page"
        case .markdown:
            return "Plain text"
        case .json:
            return "Structured data"
        }
    }

    #if canImport(UniformTypeIdentifiers)
    var utType: UTType {
        switch self {
        case .pdf:
            return .pdf
        case .html:
            return .html
        case .markdown:
            return UTType(filenameExtension: "md") ?? .plainText
        case .json:
            return .json
        }
    }
    #endif
}

// MARK: - Preview Support

#Preview("Single Card") {
    ExportShareView(
        exportManager: ExportManager(database: IsometryDatabase.preview),
        cards: [
            NotebookCard(
                title: "Sample Note",
                markdownContent: "This is a sample note for preview.",
                properties: ["priority": "high"],
                tags: ["sample", "preview"]
            )
        ]
    )
}

#Preview("Multiple Cards") {
    ExportShareView(
        exportManager: ExportManager(database: IsometryDatabase.preview),
        cards: [
            NotebookCard(
                title: "First Note",
                markdownContent: "Content of the first note.",
                tags: ["first"]
            ),
            NotebookCard(
                title: "Second Note",
                markdownContent: "Content of the second note.",
                tags: ["second"]
            ),
            NotebookCard(
                title: "Third Note",
                markdownContent: "Content of the third note.",
                tags: ["third"]
            )
        ]
    )
}