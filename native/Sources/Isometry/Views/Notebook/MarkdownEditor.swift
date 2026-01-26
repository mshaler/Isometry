import SwiftUI
#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

/// Native markdown editor using NSTextView (macOS) or UITextView (iOS)
/// Provides platform-native text editing with basic markdown syntax highlighting
public struct MarkdownEditor: View {
    @Binding var text: String
    @Binding var isEditing: Bool

    @State private var coordinator: EditorCoordinator?

    public init(text: Binding<String>, isEditing: Binding<Bool> = .constant(true)) {
        self._text = text
        self._isEditing = isEditing
    }

    public var body: some View {
        #if canImport(UIKit)
        iOSTextEditor(text: $text, isEditing: $isEditing)
        #elseif canImport(AppKit)
        macOSTextEditor(text: $text, isEditing: $isEditing)
        #endif
    }
}

// MARK: - iOS Implementation

#if canImport(UIKit)
private struct iOSTextEditor: UIViewRepresentable {
    @Binding var text: String
    @Binding var isEditing: Bool

    func makeUIView(context: Context) -> UITextView {
        let textView = UITextView()

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

    func updateUIView(_ uiView: UITextView, context: Context) {
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

private class EditorCoordinator: NSObject {
    private var textBinding: Binding<String>?
    private var isEditingBinding: Binding<Bool>?

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

    #if canImport(UIKit)
    func applyMarkdownHighlighting(to textView: UITextView) {
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
extension EditorCoordinator: UITextViewDelegate {
    func textViewDidChange(_ textView: UITextView) {
        textBinding?.wrappedValue = textView.text

        // Apply highlighting with a small delay to improve performance
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            self.applyMarkdownHighlighting(to: textView)
        }
    }

    func textViewDidBeginEditing(_ textView: UITextView) {
        isEditingBinding?.wrappedValue = true
    }

    func textViewDidEndEditing(_ textView: UITextView) {
        isEditingBinding?.wrappedValue = false
    }
}
#endif

#if canImport(AppKit)
extension EditorCoordinator: NSTextViewDelegate {
    func textDidChange(_ notification: Notification) {
        guard let textView = notification.object as? NSTextView else { return }
        textBinding?.wrappedValue = textView.string

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