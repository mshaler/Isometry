import SwiftUI
import Combine

#if os(iOS)
import UIKit

/// Touch interface optimizations for Canvas, WebView, and text editing components
/// Provides enhanced gesture recognition, haptic feedback, and accessibility support
@MainActor
public class TouchOptimizations: ObservableObject {

    // MARK: - Published Properties

    @Published var isHapticEnabled: Bool = true
    @Published var gestureVelocityThreshold: Double = 500.0
    @Published var touchPressureSupported: Bool = false

    // MARK: - Private Properties

    private let hapticEngine = UIImpactFeedbackGenerator(style: .light)
    private let selectionHaptic = UISelectionFeedbackGenerator()
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    public init() {
        setupHapticEngine()
        detectTouchPressureSupport()
    }

    // MARK: - Enhanced Gesture Recognition

    /// Custom gesture recognizer for Canvas pan/zoom/rotate operations
    public func canvasGestureRecognizer(
        onPan: @escaping (UIPanGestureRecognizer) -> Void,
        onPinch: @escaping (UIPinchGestureRecognizer) -> Void,
        onRotate: @escaping (UIRotationGestureRecognizer) -> Void
    ) -> UIView {

        let containerView = UIView()

        // Pan gesture for Canvas navigation
        let panGesture = EnhancedPanGestureRecognizer(target: containerView, action: nil)
        panGesture.onGestureRecognized = onPan
        panGesture.velocityThreshold = gestureVelocityThreshold
        containerView.addGestureRecognizer(panGesture)

        // Pinch gesture for zoom operations
        let pinchGesture = EnhancedPinchGestureRecognizer(target: containerView, action: nil)
        pinchGesture.onGestureRecognized = onPinch
        containerView.addGestureRecognizer(pinchGesture)

        // Rotation gesture for Canvas orientation
        let rotationGesture = EnhancedRotationGestureRecognizer(target: containerView, action: nil)
        rotationGesture.onGestureRecognized = onRotate
        containerView.addGestureRecognizer(rotationGesture)

        // Allow simultaneous gestures
        [panGesture, pinchGesture, rotationGesture].forEach { gesture in
            gesture.delegate = SimultaneousGestureDelegate()
        }

        return containerView
    }

    /// Touch disambiguation between text selection and Canvas interaction
    public func createTextCanvasDisambiguator() -> TextCanvasDisambiguator {
        return TextCanvasDisambiguator(touchOptimizations: self)
    }

    // MARK: - Text Editing Enhancements

    /// Create enhanced text view with touch optimizations
    public func createEnhancedTextView(
        text: Binding<String>,
        onFormatting: @escaping (TextFormattingAction) -> Void
    ) -> UIView {

        let containerView = UIView()
        let textView = EnhancedUITextView()

        // Configure text view
        textView.font = UIFont.systemFont(ofSize: 16)
        textView.backgroundColor = .systemBackground
        textView.textContainerInset = UIEdgeInsets(top: 12, left: 16, bottom: 12, right: 16)

        // Add gesture recognizers for formatting
        addTextFormattingGestures(to: textView, onFormatting: onFormatting)

        containerView.addSubview(textView)
        textView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            textView.topAnchor.constraint(equalTo: containerView.topAnchor),
            textView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            textView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
            textView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor)
        ])

        return containerView
    }

    /// Add swipe gestures for quick formatting
    private func addTextFormattingGestures(
        to textView: UITextView,
        onFormatting: @escaping (TextFormattingAction) -> Void
    ) {

        // Two-finger swipe right for bold
        let boldGesture = UISwipeGestureRecognizer(target: self, action: #selector(handleBoldSwipe))
        boldGesture.direction = .right
        boldGesture.numberOfTouchesRequired = 2
        textView.addGestureRecognizer(boldGesture)

        // Two-finger swipe left for italic
        let italicGesture = UISwipeGestureRecognizer(target: self, action: #selector(handleItalicSwipe))
        italicGesture.direction = .left
        italicGesture.numberOfTouchesRequired = 2
        textView.addGestureRecognizer(italicGesture)

        // Two-finger swipe up for header
        let headerGesture = UISwipeGestureRecognizer(target: self, action: #selector(handleHeaderSwipe))
        headerGesture.direction = .up
        headerGesture.numberOfTouchesRequired = 2
        textView.addGestureRecognizer(headerGesture)
    }

    // MARK: - Canvas Touch Integration

    /// Direct manipulation of visualization nodes with touch
    public func createNodeManipulationGestures(
        for nodeView: UIView,
        onNodeSelected: @escaping (String) -> Void,
        onNodeMoved: @escaping (String, CGPoint) -> Void
    ) {

        // Tap to select
        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(handleNodeTap))
        nodeView.addGestureRecognizer(tapGesture)

        // Long press and drag to move
        let longPressGesture = UILongPressGestureRecognizer(target: self, action: #selector(handleLongPressGesture(_:)))
        longPressGesture.minimumPressDuration = 0.3
        nodeView.addGestureRecognizer(longPressGesture)

        // Enable user interaction
        nodeView.isUserInteractionEnabled = true
    }

    /// Multi-finger gestures for Canvas mode switching
    public func createCanvasModeGestures(
        onModeSwitch: @escaping (CanvasMode) -> Void
    ) -> UIView {

        let gestureView = UIView()

        // Three-finger tap to switch to grid view
        let gridModeGesture = UITapGestureRecognizer(target: self, action: #selector(handleGridModeGesture))
        gridModeGesture.numberOfTouchesRequired = 3
        gestureView.addGestureRecognizer(gridModeGesture)

        // Four-finger tap to switch to graph view
        let graphModeGesture = UITapGestureRecognizer(target: self, action: #selector(handleGraphModeGesture))
        graphModeGesture.numberOfTouchesRequired = 4
        gestureView.addGestureRecognizer(graphModeGesture)

        // Two-finger double tap for timeline view
        let timelineModeGesture = UITapGestureRecognizer(target: self, action: #selector(handleTimelineModeGesture))
        timelineModeGesture.numberOfTouchesRequired = 2
        timelineModeGesture.numberOfTapsRequired = 2
        gestureView.addGestureRecognizer(timelineModeGesture)

        return gestureView
    }

    // MARK: - Touch Pressure Support

    /// Handle touch pressure for drawing operations
    public func handleTouchPressure(
        _ touches: Set<UITouch>,
        in view: UIView,
        onPressureChange: (CGFloat) -> Void
    ) {
        guard touchPressureSupported else { return }

        for touch in touches {
            let pressure = touch.force / touch.maximumPossibleForce
            onPressureChange(pressure)
        }
    }

    private func detectTouchPressureSupport() {
        // Check if device supports 3D Touch or similar pressure sensitivity
        touchPressureSupported = UIScreen.main.traitCollection.forceTouchCapability == .available
    }

    // MARK: - Accessibility Touch Support

    /// Configure accessibility for Canvas navigation
    public func configureCanvasAccessibility(for view: UIView) {
        view.isAccessibilityElement = false
        view.accessibilityContainerType = .semanticGroup

        // Add custom VoiceOver actions
        let zoomInAction = UIAccessibilityCustomAction(
            name: "Zoom In",
            target: self,
            selector: #selector(accessibilityZoomIn)
        )

        let zoomOutAction = UIAccessibilityCustomAction(
            name: "Zoom Out",
            target: self,
            selector: #selector(accessibilityZoomOut)
        )

        let panAction = UIAccessibilityCustomAction(
            name: "Pan Canvas",
            target: self,
            selector: #selector(accessibilityPan)
        )

        view.accessibilityCustomActions = [zoomInAction, zoomOutAction, panAction]
    }

    @objc private func handleTimelineModeGesture() {
        triggerHaptic(.selection)
        // TODO: Implement timeline mode switch
    }

    @objc private func handleGraphModeGesture() {
        triggerHaptic(.selection)
        // TODO: Implement graph mode switch
    }

    @objc private func handleGridModeGesture() {
        triggerHaptic(.selection)
        // TODO: Implement grid mode switch
    }

    @objc private func handleLongPressGesture(_ gesture: UILongPressGestureRecognizer) {
        switch gesture.state {
        case .began:
            triggerHaptic(.medium)
            // Begin node movement
        case .changed:
            // Update node position
            break
        case .ended:
            triggerHaptic(.light)
            // Complete node movement
        default:
            break
        }
    }

    @objc private func handleItalicSwipe() {
        triggerHaptic(.selection)
        // TODO: Implement italic formatting
    }

    @objc private func handleHeaderSwipe() {
        triggerHaptic(.selection)
        // TODO: Implement header formatting
    }

    @objc private func handleNodeTap() {
        triggerHaptic(.light)
        // TODO: Implement node selection
    }

    @objc private func handleBoldSwipe() {
        triggerHaptic(.selection)
        // TODO: Implement bold formatting
    }

    @objc private func accessibilityZoomIn() -> Bool {
        // Trigger zoom in via accessibility
        NotificationCenter.default.post(name: .accessibilityZoomIn, object: nil)
        triggerHaptic(.light)
        return true
    }

    @objc private func accessibilityZoomOut() -> Bool {
        // Trigger zoom out via accessibility
        NotificationCenter.default.post(name: .accessibilityZoomOut, object: nil)
        triggerHaptic(.light)
        return true
    }

    @objc private func accessibilityPan() -> Bool {
        // Trigger pan mode via accessibility
        NotificationCenter.default.post(name: .accessibilityPanMode, object: nil)
        triggerHaptic(.selection)
        return true
    }

    /// Configure large touch targets for accessibility
    public func configureLargeTouchTargets(for buttons: [UIButton]) {
        let minimumTouchTarget: CGFloat = 44.0 // Apple's minimum recommendation

        buttons.forEach { button in
            // Expand touch target if needed
            let currentSize = button.bounds.size
            if currentSize.width < minimumTouchTarget || currentSize.height < minimumTouchTarget {
                let widthInset = max(0, (minimumTouchTarget - currentSize.width) / 2)
                let heightInset = max(0, (minimumTouchTarget - currentSize.height) / 2)
                if #available(iOS 15.0, *) {
                    if var configuration = button.configuration {
                        configuration.contentInsets = NSDirectionalEdgeInsets(
                            top: heightInset,
                            leading: widthInset,
                            bottom: heightInset,
                            trailing: widthInset
                        )
                        button.configuration = configuration
                    } else {
                        button.contentEdgeInsets = UIEdgeInsets(
                            top: heightInset,
                            left: widthInset,
                            bottom: heightInset,
                            right: widthInset
                        )
                    }
                } else {
                    button.contentEdgeInsets = UIEdgeInsets(
                        top: heightInset,
                        left: widthInset,
                        bottom: heightInset,
                        right: widthInset
                    )
                }
            }

            // Configure for Dynamic Type
            if let titleLabel = button.titleLabel {
                titleLabel.adjustsFontForContentSizeCategory = true
                titleLabel.font = UIFont.preferredFont(forTextStyle: .body)
            }
        }
    }

    // MARK: - Haptic Feedback

    private func setupHapticEngine() {
        hapticEngine.prepare()
        selectionHaptic.prepare()
    }

    /// Trigger haptic feedback
    public func triggerHaptic(_ type: HapticType) {
        guard isHapticEnabled else { return }

        switch type {
        case .light:
            hapticEngine.impactOccurred(intensity: 0.5)
        case .medium:
            hapticEngine.impactOccurred(intensity: 0.7)
        case .heavy:
            hapticEngine.impactOccurred(intensity: 1.0)
        case .selection:
            selectionHaptic.selectionChanged()
        case .success:
            let notification = UINotificationFeedbackGenerator()
            notification.notificationOccurred(.success)
        case .error:
            let notification = UINotificationFeedbackGenerator()
            notification.notificationOccurred(.error)
        }
    }

    public enum HapticType {
        case light, medium, heavy, selection, success, error
    }

    // MARK: - Types

    public enum TextFormattingAction {
        case bold, italic, header, code, link
    }

    public enum CanvasMode {
        case grid, graph, timeline
    }
}

// MARK: - Enhanced Gesture Recognizers

class EnhancedPanGestureRecognizer: UIPanGestureRecognizer {
    var onGestureRecognized: ((UIPanGestureRecognizer) -> Void)?
    var velocityThreshold: Double = 500.0

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        super.touchesBegan(touches, with: event)
        onGestureRecognized?(self)
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
        super.touchesMoved(touches, with: event)

        let velocity = velocity(in: view)
        let speed = sqrt(velocity.x * velocity.x + velocity.y * velocity.y)

        if speed > velocityThreshold && state == .changed {
            // High velocity detected - optimize for smooth tracking
            onGestureRecognized?(self)
        }
    }
}

class EnhancedPinchGestureRecognizer: UIPinchGestureRecognizer {
    var onGestureRecognized: ((UIPinchGestureRecognizer) -> Void)?

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        super.touchesBegan(touches, with: event)
        onGestureRecognized?(self)
    }
}

class EnhancedRotationGestureRecognizer: UIRotationGestureRecognizer {
    var onGestureRecognized: ((UIRotationGestureRecognizer) -> Void)?

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        super.touchesBegan(touches, with: event)
        onGestureRecognized?(self)
    }
}

// MARK: - Gesture Delegate

class SimultaneousGestureDelegate: NSObject, UIGestureRecognizerDelegate {
    func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool {
        // Allow pan, pinch, and rotation to work simultaneously
        return true
    }
}

// MARK: - Text Canvas Disambiguator

public class TextCanvasDisambiguator: NSObject, UIGestureRecognizerDelegate {
    private weak var touchOptimizations: TouchOptimizations?
    private var isTextEditingMode: Bool = false

    init(touchOptimizations: TouchOptimizations) {
        self.touchOptimizations = touchOptimizations
        super.init()
    }

    public func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldReceive touch: UITouch
    ) -> Bool {

        // Check if touch is over text view
        if touch.view is UITextView {
            isTextEditingMode = true
            return false // Let text view handle the touch
        }

        // Check if this is a text selection gesture
        if gestureRecognizer is UITapGestureRecognizer {
            _ = touch.location(in: gestureRecognizer.view)
            // Determine if this should be text selection or Canvas interaction
            // This could be enhanced with more sophisticated logic
        }

        isTextEditingMode = false
        return true // Allow Canvas gestures
    }
}

// MARK: - Enhanced UITextView

class EnhancedUITextView: UITextView {
    override var canBecomeFirstResponder: Bool {
        return true
    }

    override func canPerformAction(_ action: Selector, withSender sender: Any?) -> Bool {
        // Enable additional formatting actions in context menu
        if action == #selector(formatBold) ||
           action == #selector(formatItalic) ||
           action == #selector(formatCode) {
            return true
        }

        return super.canPerformAction(action, withSender: sender)
    }

    @objc private func formatBold() {
        // Implement bold formatting
        NotificationCenter.default.post(name: .textFormattingRequested, object: TouchOptimizations.TextFormattingAction.bold)
    }

    @objc private func formatItalic() {
        // Implement italic formatting
        NotificationCenter.default.post(name: .textFormattingRequested, object: TouchOptimizations.TextFormattingAction.italic)
    }

    @objc private func formatCode() {
        // Implement code formatting
        NotificationCenter.default.post(name: .textFormattingRequested, object: TouchOptimizations.TextFormattingAction.code)
    }
}

// MARK: - SwiftUI Integration

extension TouchOptimizations {

    /// SwiftUI view modifier for touch optimizations
    public func touchOptimizations() -> some ViewModifier {
        TouchOptimizationsModifier(touchOptimizations: self)
    }
}

private struct TouchOptimizationsModifier: ViewModifier {
    @ObservedObject var touchOptimizations: TouchOptimizations

    func body(content: Content) -> some View {
        content
            .onReceive(NotificationCenter.default.publisher(for: .textFormattingRequested)) { notification in
                if notification.object is TouchOptimizations.TextFormattingAction {
                    touchOptimizations.triggerHaptic(.selection)
                }
            }
    }
}

// MARK: - Notification Extensions

extension Notification.Name {
    static let accessibilityZoomIn = Notification.Name("accessibilityZoomIn")
    static let accessibilityZoomOut = Notification.Name("accessibilityZoomOut")
    static let accessibilityPanMode = Notification.Name("accessibilityPanMode")
    static let textFormattingRequested = Notification.Name("textFormattingRequested")
    static let canvasNodeSelected = Notification.Name("canvasNodeSelected")
    static let canvasModeChanged = Notification.Name("canvasModeChanged")
}

#endif
