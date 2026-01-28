import SwiftUI
import AppKit

/// Native markdown editor using NSTextView (macOS)
/// Provides platform-native text editing with basic markdown syntax highlighting
public struct MarkdownEditor: View {
    @Binding var text: String
    @Binding var isEditing: Bool

    @StateObject private var coordinator = EditorCoordinator()

    public init(text: Binding<String>, isEditing: Binding<Bool> = .constant(true)) {
        self._text = text
        self._isEditing = isEditing
    }

    public var body: some View {
        ZStack {
            macOSTextEditor(text: $text, isEditing: $isEditing)

            // TODO: Fix SlashCommandMenu integration
            // SlashCommandMenu(commandManager: coordinator.commandManager) { command in
            //     coordinator.executeSelectedCommand()
            // }
        }
        .onAppear {
            coordinator.setup(textBinding: $text, isEditingBinding: $isEditing)
        }
    }
}

// MARK: - iOS Implementation

#if canImport(UIKit)
private struct iOSTextEditor: UIViewRepresentable {
    @Binding var text: String
    @Binding var isEditing: Bool
    let coordinator: EditorCoordinator

    func makeUIView(context: Context) -> NSTextView {
        let textView = NSTextView()

        // Configure text view appearance
        textView.font = UIFont.monospacedSystemFont(ofSize: 14, weight: .regular)
        textView.backgroundColor = UIColor.systemBackground
        textView.textColor = UIColor.label
        textView.autocorrectionType = .no
        textView.autocapitalizationType = .none
        textView.smartQuotesType = .no
        textView.smartDashesType = .no
        textView.smartInsertDeleteType = .no

        // Enable scroll and editing
        textView.isScrollEnabled = true
        textView.isEditable = true
        textView.isSelectable = true
        textView.alwaysBounceVertical = true

        // Set delegate and connect bindings
        let coordinator = context.coordinator
        coordinator.setup(textBinding: $text, isEditingBinding: $isEditing)
        textView.delegate = coordinator

        // Configure margins and insets
        textView.textContainerInset = UIEdgeInsets(top: 16, left: 16, bottom: 16, right: 16)
        textView.textContainer.lineFragmentPadding = 0

        return textView
    }

    func updateUIView(_ uiView: NSTextView, context: Context) {
        // Update text if it differs from the view's text
        if uiView.text != text {
            uiView.text = text
            context.coordinator.applyMarkdownHighlighting(to: uiView)
        }

        // Update editing state
        uiView.isEditable = isEditing
    }

    func makeCoordinator() -> EditorCoordinator {
        EditorCoordinator()
    }
}
#endif

// MARK: - macOS Implementation

#if canImport(AppKit)
private struct macOSTextEditor: NSViewRepresentable {
    @Binding var text: String
    @Binding var isEditing: Bool

    func makeNSView(context: Context) -> NSScrollView {
        let scrollView = NSScrollView()
        let textView = NSTextView()

        // Configure scroll view
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = false
        scrollView.borderType = .noBorder
        scrollView.documentView = textView

        // Configure text view
        textView.font = NSFont.monospacedSystemFont(ofSize: 14, weight: .regular)
        textView.backgroundColor = NSColor.textBackgroundColor
        textView.textColor = NSColor.labelColor
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.isAutomaticSpellingCorrectionEnabled = false
        textView.isContinuousSpellCheckingEnabled = false
        textView.isGrammarCheckingEnabled = false

        // Enable features
        textView.isEditable = true
        textView.isSelectable = true
        textView.allowsUndo = true
        textView.usesFindPanel = true
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.textContainer?.widthTracksTextView = true
        textView.textContainer?.containerSize = NSSize(width: scrollView.contentSize.width, height: CGFloat.greatestFiniteMagnitude)

        // Set delegate and connect bindings
        let coordinator = context.coordinator
        coordinator.setup(textBinding: $text, isEditingBinding: $isEditing)
        textView.delegate = coordinator

        // Configure margins
        textView.textContainerInset = NSSize(width: 16, height: 16)

        return scrollView
    }

    func updateNSView(_ nsView: NSScrollView, context: Context) {
        guard let textView = nsView.documentView as? NSTextView else { return }

        // Update text if it differs from the view's text
        if textView.string != text {
            textView.string = text
            context.coordinator.applyMarkdownHighlighting(to: textView)
        }

        // Update editing state
        textView.isEditable = isEditing
    }

    func makeCoordinator() -> EditorCoordinator {
        EditorCoordinator()
    }
}
#endif


// MARK: - Editor Coordinator

@MainActor
private class EditorCoordinator: NSObject, ObservableObject {
    private var textBinding: Binding<String>?
    private var isEditingBinding: Binding<Bool>?

    // Slash command support
    private let commandManager = SlashCommandManager()
    private weak var currentTextView: NSTextView?

    private let markdownPatterns: [(pattern: NSRegularExpression, attributes: [NSAttributedString.Key: Any])] = {
        let baseFont = {
            #if canImport(UIKit)
            return UIFont.monospacedSystemFont(ofSize: 14, weight: .regular)
            #elseif canImport(AppKit)
            return NSFont.monospacedSystemFont(ofSize: 14, weight: .regular)
            #endif
        }()

        let headerFont = {
            #if canImport(UIKit)
            return UIFont.monospacedSystemFont(ofSize: 18, weight: .semibold)
            #elseif canImport(AppKit)
            return NSFont.monospacedSystemFont(ofSize: 18, weight: .semibold)
            #endif
        }()

        let codeBackgroundColor = {
            #if canImport(UIKit)
            return UIColor.systemGray6
            #elseif canImport(AppKit)
            return NSColor.controlBackgroundColor
            #endif
        }()

        let linkColor = {
            #if canImport(UIKit)
            return UIColor.systemBlue
            #elseif canImport(AppKit)
            return NSColor.systemBlue
            #endif
        }()

        let commentColor = {
            #if canImport(UIKit)
            return UIColor.systemGray
            #elseif canImport(AppKit)
            return NSColor.systemGray
            #endif
        }()

        var patterns: [(NSRegularExpression, [NSAttributedString.Key: Any])] = []

        do {
            // Headers (# ## ###)
            let headerPattern = try NSRegularExpression(pattern: "^#{1,6}\\s+.+$", options: [.anchorsMatchLines])
            patterns.append((headerPattern, [
                .font: headerFont,
                .foregroundColor: linkColor
            ]))

            // Bold (**text** or __text__)
            let boldPattern = try NSRegularExpression(pattern: "(\\*\\*|__).+?(\\*\\*|__)", options: [])
            patterns.append((boldPattern, [
                .font: {
                    #if canImport(UIKit)
                    return UIFont.monospacedSystemFont(ofSize: 14, weight: .bold)
                    #elseif canImport(AppKit)
                    return NSFont.monospacedSystemFont(ofSize: 14, weight: .bold)
                    #endif
                }()
            ]))

            // Italic (*text* or _text_)
            let italicPattern = try NSRegularExpression(pattern: "(?<!\\*)\\*(?!\\*).+?(?<!\\*)\\*(?!\\*)|(?<!_)_(?!_).+?(?<!_)_(?!_)", options: [])
            patterns.append((italicPattern, [
                .font: {
                    #if canImport(UIKit)
                    return UIFont.monospacedSystemFont(ofSize: 14, weight: .regular).withTraits(.traitItalic)
                    #elseif canImport(AppKit)
                    return NSFont.monospacedSystemFont(ofSize: 14, weight: .regular).withTraits(.italic)
                    #endif
                }()
            ]))

            // Inline code (`code`)
            let inlineCodePattern = try NSRegularExpression(pattern: "`[^`]+`", options: [])
            patterns.append((inlineCodePattern, [
                .backgroundColor: codeBackgroundColor,
                .foregroundColor: commentColor
            ]))

            // Code blocks (```...```)
            let codeBlockPattern = try NSRegularExpression(pattern: "```[\\s\\S]*?```", options: [])
            patterns.append((codeBlockPattern, [
                .backgroundColor: codeBackgroundColor,
                .foregroundColor: commentColor
            ]))

            // Links ([text](url))
            let linkPattern = try NSRegularExpression(pattern: "\\[.+?\\]\\(.+?\\)", options: [])
            patterns.append((linkPattern, [
                .foregroundColor: linkColor
            ]))

        } catch {
            print("Error creating markdown regex patterns: \(error)")
        }

        return patterns
    }()

    func setup(textBinding: Binding<String>, isEditingBinding: Binding<Bool>) {
        self.textBinding = textBinding
        self.isEditingBinding = isEditingBinding
    }

    // MARK: - Slash Command Support

    private func detectSlashCommand(in textView: NSTextView) {
        let text = textView.string
        let cursorPosition = textView.selectedRange().location

        if commandManager.detectSlashCommand(text: text, cursorPosition: cursorPosition) {
            let cursorRect = textView.firstRect(forCharacterRange: textView.selectedRange(), actualRange: nil)
            let menuPosition = CGPoint(x: cursorRect.minX, y: cursorRect.maxY + 5)
            commandManager.showMenu(at: menuPosition)
        } else {
            commandManager.hideMenu()
        }
    }


    private func executeCommand(_ command: SlashCommand, in textView: NSTextView) {
        let text = textView.string
        let cursorPosition = textView.selectedRange().location

        // Find the slash command position
        guard let slashRange = findSlashCommandRange(text: text, cursorPosition: cursorPosition) else {
            return
        }

        // Replace the slash command with the command content
        let processedContent = command.processedContent
        let newText = (text as NSString).replacingCharacters(in: slashRange, with: processedContent)

        // Update the text
        textView.string = newText
        textBinding?.wrappedValue = newText

        // Position cursor
        let newCursorPosition = slashRange.location + command.cursorOffset
        textView.setSelectedRange(NSRange(location: min(newCursorPosition, newText.count), length: 0))

        // Apply highlighting
        applyMarkdownHighlighting(to: textView)
    }


    private func findSlashCommandRange(text: String, cursorPosition: Int) -> NSRange? {
        guard cursorPosition > 0 else { return nil }

        let nsString = text as NSString
        var slashLocation: Int = -1

        // Look backwards from cursor to find the slash
        for i in (0..<cursorPosition).reversed() {
            let char = nsString.character(at: i)
            if char == UnicodeScalar("/").value {
                slashLocation = i
                break
            }
            if char == UnicodeScalar("\n").value || char == UnicodeScalar(" ").value {
                break // Stop at line or word boundaries
            }
        }

        guard slashLocation >= 0 else { return nil }

        return NSRange(location: slashLocation, length: cursorPosition - slashLocation)
    }

    #if canImport(AppKit)
    private func handleKeyDown(_ event: NSEvent, in textView: NSTextView) -> Bool {
        guard commandManager.isMenuVisible else { return false }

        switch event.keyCode {
        case 125: // Down arrow
            commandManager.selectNext()
            return true
        case 126: // Up arrow
            commandManager.selectPrevious()
            return true
        case 36: // Enter
            if let command = commandManager.executeSelectedCommand() {
                executeCommand(command, in: textView)
            }
            return true
        case 53: // Escape
            commandManager.hideMenu()
            return true
        default:
            return false
        }
    }
    #endif

    #if canImport(UIKit)
    func applyMarkdownHighlighting(to textView: NSTextView) {
        let text = textView.text ?? ""
        let attributedString = NSMutableAttributedString(string: text)
        let range = NSRange(location: 0, length: text.count)

        // Reset to base formatting
        attributedString.addAttributes([
            .font: UIFont.monospacedSystemFont(ofSize: 14, weight: .regular),
            .foregroundColor: UIColor.label
        ], range: range)

        // Apply markdown patterns
        for (pattern, attributes) in markdownPatterns {
            let matches = pattern.matches(in: text, options: [], range: range)
            for match in matches {
                attributedString.addAttributes(attributes, range: match.range)
            }
        }

        // Preserve cursor position
        let selectedRange = textView.selectedRange
        textView.attributedText = attributedString
        textView.selectedRange = selectedRange
    }
    #endif

    #if canImport(AppKit)
    func applyMarkdownHighlighting(to textView: NSTextView) {
        let text = textView.string
        let attributedString = NSMutableAttributedString(string: text)
        let range = NSRange(location: 0, length: text.count)

        // Reset to base formatting
        attributedString.addAttributes([
            .font: NSFont.monospacedSystemFont(ofSize: 14, weight: .regular),
            .foregroundColor: NSColor.labelColor
        ], range: range)

        // Apply markdown patterns
        for (pattern, attributes) in markdownPatterns {
            let matches = pattern.matches(in: text, options: [], range: range)
            for match in matches {
                attributedString.addAttributes(attributes, range: match.range)
            }
        }

        // Preserve cursor position
        let selectedRanges = textView.selectedRanges
        textView.textStorage?.setAttributedString(attributedString)
        textView.selectedRanges = selectedRanges
    }
    #endif
}

// MARK: - Text View Delegate

#if canImport(UIKit)
extension EditorCoordinator: NSTextViewDelegate {
    func textViewDidChange(_ textView: NSTextView) {
        currentNSTextView = textView
        textBinding?.wrappedValue = textView.text

        // Check for slash commands
        detectSlashCommand(in: textView)

        // Apply highlighting with a small delay to improve performance
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            self.applyMarkdownHighlighting(to: textView)
        }
    }

    func textViewDidBeginEditing(_ textView: NSTextView) {
        isEditingBinding?.wrappedValue = true
    }

    func textViewDidEndEditing(_ textView: NSTextView) {
        isEditingBinding?.wrappedValue = false
    }
}
#endif

#if canImport(AppKit)
extension EditorCoordinator: NSTextViewDelegate {
    func textDidChange(_ notification: Notification) {
        guard let textView = notification.object as? NSTextView else { return }
        currentTextView = textView
        textBinding?.wrappedValue = textView.string

        // Check for slash commands
        detectSlashCommand(in: textView)

        // Apply highlighting with a small delay to improve performance
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            self.applyMarkdownHighlighting(to: textView)
        }
    }

    func textDidBeginEditing(_ notification: Notification) {
        isEditingBinding?.wrappedValue = true
    }

    func textDidEndEditing(_ notification: Notification) {
        isEditingBinding?.wrappedValue = false
    }
}
#endif

// MARK: - Font Extensions

#if canImport(UIKit)
extension UIFont {
    func withTraits(_ traits: UIFontDescriptor.SymbolicTraits) -> UIFont {
        let descriptor = fontDescriptor.withSymbolicTraits(traits)
        return descriptor != nil ? UIFont(descriptor: descriptor!, size: pointSize) : self
    }
}
#endif

#if canImport(AppKit)
extension NSFont {
    func withTraits(_ traits: NSFontDescriptor.SymbolicTraits) -> NSFont {
        let descriptor = fontDescriptor.withSymbolicTraits(traits)
        return NSFont(descriptor: descriptor, size: pointSize) ?? self
    }
}
#endif

// MARK: - Preview

#Preview {
    MarkdownEditor(
        text: .constant("# Markdown Editor\n\nThis is a **bold** text and *italic* text.\n\n```swift\nlet code = \"syntax highlighting\"\n```\n\n[Link](https://example.com)")
    )
    .padding()
}