import SwiftUI
import Foundation

/// Native markdown preview using AttributedString and SwiftUI Text
/// Provides formatted markdown rendering with theme integration
public struct MarkdownPreview: View {
    let markdownText: String

    @State private var attributedString: AttributedString = AttributedString()
    @State private var renderTask: Task<Void, Never>?

    public init(markdownText: String) {
        self.markdownText = markdownText
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if attributedString.characters.isEmpty && !markdownText.isEmpty {
                    // Loading state
                    HStack {
                        ProgressView()
                            .scaleEffect(0.8)
                        Text("Rendering...")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding()
                } else {
                    Text(attributedString)
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                }
            }
        }
        .onChange(of: markdownText) { oldValue, newValue in
            renderMarkdown(newValue)
        }
        .onAppear {
            renderMarkdown(markdownText)
        }
        .onDisappear {
            renderTask?.cancel()
        }
    }

    private func renderMarkdown(_ text: String) {
        // Cancel any existing render task
        renderTask?.cancel()

        // Empty text case
        guard !text.isEmpty else {
            attributedString = AttributedString()
            return
        }

        // Debounced rendering for performance
        renderTask = Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(250))

            guard !Task.isCancelled else { return }

            let rendered = await renderMarkdownToAttributedString(text)
            if !Task.isCancelled {
                attributedString = rendered
            }
        }
    }
}

// MARK: - Markdown Rendering

private actor MarkdownRenderer {
    func renderToAttributedString(_ markdownText: String) -> AttributedString {
        // Use AttributedString's native markdown parsing if available (iOS 15+/macOS 12+)
        if #available(iOS 15.0, macOS 12.0, *) {
            do {
                var attributedString = try AttributedString(markdown: markdownText, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))

                // Apply custom styling
                return applyCustomStyling(to: attributedString)
            } catch {
                // Fall back to manual parsing
                return manualMarkdownParsing(markdownText)
            }
        } else {
            // Fall back to manual parsing for older systems
            return manualMarkdownParsing(markdownText)
        }
    }

    private func applyCustomStyling(to attributedString: AttributedString) -> AttributedString {
        var styled = attributedString

        // Apply theme-appropriate colors and fonts
        styled.font = .system(.body, design: .default)
        styled.foregroundColor = Color.primary

        // Style headers
        for run in styled.runs {
            if let level = run.presentationIntent?.components.first?.kind,
               case .header(let headerLevel) = level {
                let size: CGFloat = max(16, 24 - CGFloat(headerLevel * 2))
                styled[run.range].font = .system(size: size, weight: .semibold, design: .default)
                styled[run.range].foregroundColor = Color.accentColor
            }

            // TODO: Fix InlinePresentationIntent.components API changes
            // Temporary simplified styling to resolve compilation issues

            // Basic code styling (simplified)
            if run.inlinePresentationIntent == .code {
                styled[run.range].font = .system(.body, design: .monospaced)
                styled[run.range].backgroundColor = Color.secondary.opacity(0.1)
            }

            // Note: Emphasis and strong emphasis styling disabled pending API fix
            // if run.inlinePresentationIntent?.components.contains(.emphasized) == true {
            //     styled[run.range].font = .system(.body, weight: .semibold)
            // }
            //
            // if run.inlinePresentationIntent?.components.contains(.stronglyEmphasized) == true {
            //     styled[run.range].font = .system(.body).italic()
            // }
        }

        return styled
    }

    private func manualMarkdownParsing(_ text: String) -> AttributedString {
        var attributedString = AttributedString(text)

        // Basic font
        attributedString.font = .system(.body, design: .default)
        attributedString.foregroundColor = Color.primary

        let range = text.startIndex..<text.endIndex

        // Headers
        applyHeaderStyling(&attributedString, text: text, range: range)

        // Bold and italic
        applyEmphasisStyling(&attributedString, text: text, range: range)

        // Code
        applyCodeStyling(&attributedString, text: text, range: range)

        // Links
        applyLinkStyling(&attributedString, text: text, range: range)

        return attributedString
    }

    private func applyHeaderStyling(_ attributedString: inout AttributedString, text: String, range: Range<String.Index>) {
        // Header pattern: ^#{1,6}\s+.+$
        let lines = text.components(separatedBy: .newlines)
        var currentIndex = text.startIndex

        for line in lines {
            let endIndex = text.index(currentIndex, offsetBy: line.count, limitedBy: text.endIndex) ?? text.endIndex
            let lineRange = currentIndex..<endIndex

            if line.hasPrefix("#") {
                let headerLevel = line.prefix(while: { $0 == "#" }).count
                if headerLevel <= 6, line.count > headerLevel + 1, line[line.index(line.startIndex, offsetBy: headerLevel)] == " " {
                    let size: CGFloat = max(16, 24 - CGFloat(headerLevel * 2))
                    let attributedRange = Range(lineRange, in: attributedString)!
                    attributedString[attributedRange].font = .system(size: size, weight: .semibold)
                    attributedString[attributedRange].foregroundColor = Color.accentColor
                }
            }

            currentIndex = text.index(after: text.index(currentIndex, offsetBy: line.count, limitedBy: text.endIndex) ?? text.endIndex)
        }
    }

    private func applyEmphasisStyling(_ attributedString: inout AttributedString, text: String, range: Range<String.Index>) {
        // Bold: **text** or __text__
        applyPattern(&attributedString, text: text, pattern: "\\*\\*(.+?)\\*\\*|__(.+?)__") { match, attributedRange in
            attributedString[attributedRange].font = .system(.body, weight: .semibold)
        }

        // Italic: *text* or _text_ (but not **text** or __text__)
        applyPattern(&attributedString, text: text, pattern: "(?<!\\*)\\*([^*]+?)\\*(?!\\*)|(?<!_)_([^_]+?)_(?!_)") { match, attributedRange in
            attributedString[attributedRange].font = .system(.body).italic()
        }
    }

    private func applyCodeStyling(_ attributedString: inout AttributedString, text: String, range: Range<String.Index>) {
        // Inline code: `code`
        applyPattern(&attributedString, text: text, pattern: "`([^`]+)`") { match, attributedRange in
            attributedString[attributedRange].font = .system(.body, design: .monospaced)
            attributedString[attributedRange].backgroundColor = Color.secondary.opacity(0.1)
        }

        // Code blocks: ```...```
        applyPattern(&attributedString, text: text, pattern: "```[\\s\\S]*?```") { match, attributedRange in
            attributedString[attributedRange].font = .system(.body, design: .monospaced)
            attributedString[attributedRange].backgroundColor = Color.secondary.opacity(0.1)
        }
    }

    private func applyLinkStyling(_ attributedString: inout AttributedString, text: String, range: Range<String.Index>) {
        // Links: [text](url)
        applyPattern(&attributedString, text: text, pattern: "\\[([^\\]]+)\\]\\(([^\\)]+)\\)") { match, attributedRange in
            attributedString[attributedRange].foregroundColor = Color.accentColor
            attributedString[attributedRange].underlineStyle = .single
        }
    }

    private func applyPattern(_ attributedString: inout AttributedString, text: String, pattern: String, style: (NSTextCheckingResult, Range<AttributedString.Index>) -> Void) {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else { return }

        let nsRange = NSRange(location: 0, length: text.utf16.count)
        let matches = regex.matches(in: text, options: [], range: nsRange)

        for match in matches.reversed() { // Reverse to avoid index shifting issues
            guard let range = Range(match.range, in: text),
                  let attributedRange = Range(range, in: attributedString) else { continue }
            style(match, attributedRange)
        }
    }
}

// Global renderer instance
private let markdownRenderer = MarkdownRenderer()

private func renderMarkdownToAttributedString(_ text: String) async -> AttributedString {
    return await markdownRenderer.renderToAttributedString(text)
}

// MARK: - Preview

#Preview {
    MarkdownPreview(markdownText: """
    # Markdown Preview

    This is a **bold** text and *italic* text.

    ## Code Example

    Here's some inline `code` and a code block:

    ```swift
    let markdown = "Hello, world!"
    print(markdown)
    ```

    ## Links

    Check out [Swift](https://swift.org) for more information.

    ### Lists

    - Item 1
    - Item 2
    - Item 3

    1. First
    2. Second
    3. Third
    """)
    .padding()
    .background(.background.secondary)
}