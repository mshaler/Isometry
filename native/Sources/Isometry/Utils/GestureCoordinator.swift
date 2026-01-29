import Foundation
import CoreGraphics

#if canImport(UIKit)
import UIKit
public typealias PlatformView = UIView
public typealias PlatformGestureRecognizer = UIGestureRecognizer
public typealias PlatformPanGestureRecognizer = UIPanGestureRecognizer
public typealias PlatformPinchGestureRecognizer = UIPinchGestureRecognizer
public typealias PlatformTapGestureRecognizer = UITapGestureRecognizer
#elseif canImport(AppKit)
import AppKit
public typealias PlatformView = NSView
public typealias PlatformGestureRecognizer = NSGestureRecognizer
public typealias PlatformPanGestureRecognizer = NSPanGestureRecognizer
public typealias PlatformPinchGestureRecognizer = NSMagnificationGestureRecognizer
public typealias PlatformTapGestureRecognizer = NSClickGestureRecognizer
#endif

/// Actor-based gesture coordinator for bidirectional pan/zoom synchronization between native and React D3
/// Manages gesture state, coordinate transformations, and bridge communication with debouncing
@MainActor
public class GestureCoordinator: NSObject, ObservableObject {

    // MARK: - Gesture State

    public struct GestureState: Codable, Sendable {
        public let scale: CGFloat
        public let translation: CGPoint
        public let velocity: CGPoint
        public let timestamp: TimeInterval
        public let isActive: Bool

        public init(scale: CGFloat = 1.0, translation: CGPoint = .zero, velocity: CGPoint = .zero, isActive: Bool = false) {
            self.scale = scale
            self.translation = translation
            self.velocity = velocity
            self.timestamp = CACurrentMediaTime()
            self.isActive = isActive
        }
    }

    // MARK: - Configuration

    public struct Configuration {
        public let scaleRange: ClosedRange<CGFloat>
        public let boundsConstraint: CGRect?
        public let debounceInterval: TimeInterval
        public let velocityThreshold: CGFloat
        public let momentumDecay: CGFloat

        public init(
            scaleRange: ClosedRange<CGFloat> = 0.1...5.0,
            boundsConstraint: CGRect? = nil,
            debounceInterval: TimeInterval = 0.016, // ~60fps
            velocityThreshold: CGFloat = 100.0,
            momentumDecay: CGFloat = 0.95
        ) {
            self.scaleRange = scaleRange
            self.boundsConstraint = boundsConstraint
            self.debounceInterval = debounceInterval
            self.velocityThreshold = velocityThreshold
            self.momentumDecay = momentumDecay
        }
    }

    // MARK: - Properties

    @Published public private(set) var currentState: GestureState
    private let configuration: Configuration

    // Bridge communication
    public var bridgeUpdateHandler: ((GestureState) -> Void)?

    // Gesture recognizers
    private var panGestureRecognizer: PlatformPanGestureRecognizer?
    private var pinchGestureRecognizer: PlatformPinchGestureRecognizer?
    private var doubleTapGestureRecognizer: PlatformTapGestureRecognizer?

    // Debouncing and momentum
    private var debounceTimer: Timer?
    private var momentumTimer: Timer?
    private var lastUpdateTime: TimeInterval = 0

    // Coordinate transformation consistency with PAFV system
    private var coordinateTransform: CGAffineTransform = .identity
    private var lastBridgeUpdate: TimeInterval = 0

    // Gesture conflict resolution
    private var activeGestureType: GestureType?
    private enum GestureType {
        case pan
        case pinch
        case doubleTap
        case bridge // From React
    }

    // MARK: - Initialization

    public init(configuration: Configuration = Configuration()) {
        self.configuration = configuration
        self.currentState = GestureState()
        print("[GestureCoordinator] Initialized with configuration: scale=\(configuration.scaleRange), debounce=\(configuration.debounceInterval)ms")
    }

    // MARK: - View Setup

    /// Set up gesture recognizers on a target view
    public func setupGestures(on view: PlatformView) {
        // Remove existing gestures
        removeGesturesFromView(view)

#if canImport(UIKit)
        // Create pan gesture recognizer (iOS)
        let panGesture = UIPanGestureRecognizer(target: self, action: #selector(handlePanGesture(_:)))
        panGesture.delegate = self
        panGesture.minimumNumberOfTouches = 1
        panGesture.maximumNumberOfTouches = 1
        view.addGestureRecognizer(panGesture)
        self.panGestureRecognizer = panGesture

        // Create pinch gesture recognizer (iOS)
        let pinchGesture = UIPinchGestureRecognizer(target: self, action: #selector(handlePinchGesture(_:)))
        pinchGesture.delegate = self
        view.addGestureRecognizer(pinchGesture)
        self.pinchGestureRecognizer = pinchGesture

        // Create double-tap gesture recognizer (iOS)
        let doubleTapGesture = UITapGestureRecognizer(target: self, action: #selector(handleDoubleTapGesture(_:)))
        doubleTapGesture.numberOfTapsRequired = 2
        doubleTapGesture.delegate = self
        view.addGestureRecognizer(doubleTapGesture)
        self.doubleTapGestureRecognizer = doubleTapGesture

        // Allow simultaneous gestures
        panGesture.require(toFail: doubleTapGesture)
#elseif canImport(AppKit)
        // Create pan gesture recognizer (macOS)
        let panGesture = NSPanGestureRecognizer(target: self, action: #selector(handlePanGesture(_:)))
        panGesture.delegate = self
        view.addGestureRecognizer(panGesture)
        self.panGestureRecognizer = panGesture

        // Create magnification gesture recognizer (macOS)
        let pinchGesture = NSMagnificationGestureRecognizer(target: self, action: #selector(handlePinchGesture(_:)))
        pinchGesture.delegate = self
        view.addGestureRecognizer(pinchGesture)
        self.pinchGestureRecognizer = pinchGesture

        // Create double-click gesture recognizer (macOS)
        let doubleTapGesture = NSClickGestureRecognizer(target: self, action: #selector(handleDoubleTapGesture(_:)))
        doubleTapGesture.numberOfClicksRequired = 2
        doubleTapGesture.delegate = self
        view.addGestureRecognizer(doubleTapGesture)
        self.doubleTapGestureRecognizer = doubleTapGesture
#endif

        print("[GestureCoordinator] Gestures set up on view: \(view)")
    }

    private func removeGesturesFromView(_ view: PlatformView) {
        if let panGesture = panGestureRecognizer {
            view.removeGestureRecognizer(panGesture)
        }
        if let pinchGesture = pinchGestureRecognizer {
            view.removeGestureRecognizer(pinchGesture)
        }
        if let doubleTapGesture = doubleTapGestureRecognizer {
            view.removeGestureRecognizer(doubleTapGesture)
        }
    }

    // MARK: - Native Gesture Handling

    @objc private func handlePanGesture(_ gesture: PlatformPanGestureRecognizer) {
        guard !isGestureBlocked(for: .pan) else { return }

        let translation = gesture.translation(in: gesture.view)
        let velocity = gesture.velocity(in: gesture.view)

        switch gesture.state {
        case .began:
            activeGestureType = .pan
            updateGestureState(
                scale: currentState.scale,
                translation: CGPoint(
                    x: currentState.translation.x + translation.x,
                    y: currentState.translation.y + translation.y
                ),
                velocity: velocity,
                isActive: true
            )

        case .changed:
            let newTranslation = CGPoint(
                x: currentState.translation.x + translation.x,
                y: currentState.translation.y + translation.y
            )
            let constrainedTranslation = applyBoundsConstraints(translation: newTranslation, scale: currentState.scale)

            updateGestureState(
                scale: currentState.scale,
                translation: constrainedTranslation,
                velocity: velocity,
                isActive: true
            )

            gesture.setTranslation(.zero, in: gesture.view)

        case .ended, .cancelled:
            activeGestureType = nil

            // Apply momentum if velocity is significant
            if abs(velocity.x) > configuration.velocityThreshold || abs(velocity.y) > configuration.velocityThreshold {
                startMomentumAnimation(with: velocity)
            } else {
                updateGestureState(
                    scale: currentState.scale,
                    translation: currentState.translation,
                    velocity: .zero,
                    isActive: false
                )
            }

        default:
            break
        }
    }

    @objc private func handlePinchGesture(_ gesture: PlatformPinchGestureRecognizer) {
        guard !isGestureBlocked(for: .pinch) else { return }

        switch gesture.state {
        case .began:
            activeGestureType = .pinch

        case .changed:
#if canImport(UIKit)
            let scaleMultiplier = gesture.scale
            gesture.scale = 1.0
#elseif canImport(AppKit)
            let scaleMultiplier = 1.0 + gesture.magnification
            gesture.magnification = 0.0
#endif

            let newScale = currentState.scale * scaleMultiplier
            let constrainedScale = max(configuration.scaleRange.lowerBound, min(configuration.scaleRange.upperBound, newScale))

            // Calculate center point for zoom
            let center = gesture.location(in: gesture.view)
            let scaledTranslation = calculateScaledTranslation(
                currentTranslation: currentState.translation,
                scaleChange: constrainedScale / currentState.scale,
                center: center
            )

            updateGestureState(
                scale: constrainedScale,
                translation: scaledTranslation,
                velocity: .zero,
                isActive: true
            )

        case .ended, .cancelled:
            activeGestureType = nil
            updateGestureState(
                scale: currentState.scale,
                translation: currentState.translation,
                velocity: .zero,
                isActive: false
            )

        default:
            break
        }
    }

    @objc private func handleDoubleTapGesture(_ gesture: PlatformTapGestureRecognizer) {
        guard !isGestureBlocked(for: .doubleTap) else { return }

        activeGestureType = .doubleTap

        // Reset zoom with smooth animation
        let targetScale: CGFloat = 1.0
        let targetTranslation: CGPoint = .zero

        animateToState(
            scale: targetScale,
            translation: targetTranslation,
            duration: 0.3
        ) { [weak self] in
            self?.activeGestureType = nil
        }
    }

    // MARK: - Bridge Integration

    /// Update gesture state from React D3
    public func updateFromBridge(scale: CGFloat, translation: CGPoint, isActive: Bool = false) {
        // Avoid bridge update loops
        let currentTime = CACurrentMediaTime()
        if currentTime - lastBridgeUpdate < configuration.debounceInterval {
            return
        }

        // Don't override native gestures
        if activeGestureType != nil && activeGestureType != .bridge {
            return
        }

        activeGestureType = isActive ? .bridge : nil

        updateGestureState(
            scale: scale,
            translation: translation,
            velocity: .zero,
            isActive: isActive,
            fromBridge: true
        )

        lastBridgeUpdate = currentTime
    }

    /// Export current gesture state for bridge
    public func exportStateForBridge() -> [String: Any] {
        return [
            "scale": currentState.scale,
            "translation": [
                "x": currentState.translation.x,
                "y": currentState.translation.y
            ],
            "velocity": [
                "x": currentState.velocity.x,
                "y": currentState.velocity.y
            ],
            "isActive": currentState.isActive,
            "timestamp": currentState.timestamp
        ]
    }

    // MARK: - State Management

    private func updateGestureState(scale: CGFloat, translation: CGPoint, velocity: CGPoint, isActive: Bool, fromBridge: Bool = false) {
        let newState = GestureState(
            scale: scale,
            translation: translation,
            velocity: velocity,
            isActive: isActive
        )

        currentState = newState

        // Debounced bridge update (only if not from bridge to avoid loops)
        if !fromBridge {
            scheduleDebounce()
        }
    }

    private func scheduleDebounce() {
        debounceTimer?.invalidate()

        debounceTimer = Timer.scheduledTimer(withTimeInterval: configuration.debounceInterval, repeats: false) { [weak self] _ in
            guard let self = self else { return }
            Task { @MainActor in
                self.sendBridgeUpdate()
            }
        }
    }

    private func sendBridgeUpdate() {
        bridgeUpdateHandler?(currentState)
    }

    // MARK: - Constraint Application

    private func applyBoundsConstraints(translation: CGPoint, scale: CGFloat) -> CGPoint {
        guard let bounds = configuration.boundsConstraint else { return translation }

        // Calculate effective bounds based on scale
        let scaledBounds = CGRect(
            x: bounds.minX * scale,
            y: bounds.minY * scale,
            width: bounds.width * scale,
            height: bounds.height * scale
        )

        return CGPoint(
            x: max(scaledBounds.minX, min(scaledBounds.maxX, translation.x)),
            y: max(scaledBounds.minY, min(scaledBounds.maxY, translation.y))
        )
    }

    private func calculateScaledTranslation(currentTranslation: CGPoint, scaleChange: CGFloat, center: CGPoint) -> CGPoint {
        // Adjust translation to maintain center point during scaling
        let deltaScale = scaleChange - 1.0

        return CGPoint(
            x: currentTranslation.x - (center.x * deltaScale),
            y: currentTranslation.y - (center.y * deltaScale)
        )
    }

    // MARK: - Animation and Momentum

    private func startMomentumAnimation(with velocity: CGPoint) {
        var currentVelocity = velocity

        momentumTimer?.invalidate()
        momentumTimer = Timer.scheduledTimer(withTimeInterval: 0.016, repeats: true) { [weak self] timer in
            guard let self = self else {
                timer.invalidate()
                return
            }

            // Apply momentum decay
            currentVelocity.x *= self.configuration.momentumDecay
            currentVelocity.y *= self.configuration.momentumDecay

            // Update translation
            let deltaTime: CGFloat = 0.016
            let newTranslation = CGPoint(
                x: self.currentState.translation.x + (currentVelocity.x * deltaTime),
                y: self.currentState.translation.y + (currentVelocity.y * deltaTime)
            )

            let constrainedTranslation = self.applyBoundsConstraints(
                translation: newTranslation,
                scale: self.currentState.scale
            )

            self.updateGestureState(
                scale: self.currentState.scale,
                translation: constrainedTranslation,
                velocity: currentVelocity,
                isActive: false
            )

            // Stop when velocity becomes negligible
            let velocityMagnitude = sqrt(currentVelocity.x * currentVelocity.x + currentVelocity.y * currentVelocity.y)
            if velocityMagnitude < 10.0 {
                timer.invalidate()
                self.momentumTimer = nil

                self.updateGestureState(
                    scale: self.currentState.scale,
                    translation: self.currentState.translation,
                    velocity: .zero,
                    isActive: false
                )
            }
        }
    }

    private func animateToState(scale: CGFloat, translation: CGPoint, duration: TimeInterval, completion: (() -> Void)? = nil) {
        let startState = currentState
        let startTime = CACurrentMediaTime()

        let animationTimer = Timer.scheduledTimer(withTimeInterval: 0.016, repeats: true) { timer in
            let elapsed = CACurrentMediaTime() - startTime
            let progress = min(elapsed / duration, 1.0)

            // Ease-out animation
            let easedProgress = 1.0 - pow(1.0 - progress, 3.0)

            let interpolatedScale = startState.scale + (scale - startState.scale) * easedProgress
            let interpolatedTranslation = CGPoint(
                x: startState.translation.x + (translation.x - startState.translation.x) * easedProgress,
                y: startState.translation.y + (translation.y - startState.translation.y) * easedProgress
            )

            self.updateGestureState(
                scale: interpolatedScale,
                translation: interpolatedTranslation,
                velocity: .zero,
                isActive: progress < 1.0
            )

            if progress >= 1.0 {
                timer.invalidate()
                completion?()
            }
        }
    }

    // MARK: - Gesture Conflict Resolution

    private func isGestureBlocked(for gestureType: GestureType) -> Bool {
        guard let activeType = activeGestureType else { return false }

        // Allow same type or bridge updates
        return activeType != gestureType && activeType != .bridge
    }

    // MARK: - Cleanup

    deinit {
        debounceTimer?.invalidate()
        momentumTimer?.invalidate()
    }
}

// MARK: - Platform Gesture Recognizer Delegate

#if canImport(UIKit)
extension GestureCoordinator: UIGestureRecognizerDelegate {
    public func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
        // Allow pan and pinch to work together
        let isPanAndPinch = (gestureRecognizer == panGestureRecognizer && otherGestureRecognizer == pinchGestureRecognizer) ||
                           (gestureRecognizer == pinchGestureRecognizer && otherGestureRecognizer == panGestureRecognizer)

        return isPanAndPinch
    }

    public func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        // Don't start gestures if another conflicting gesture is active
        if gestureRecognizer == panGestureRecognizer {
            return !isGestureBlocked(for: .pan)
        } else if gestureRecognizer == pinchGestureRecognizer {
            return !isGestureBlocked(for: .pinch)
        } else if gestureRecognizer == doubleTapGestureRecognizer {
            return !isGestureBlocked(for: .doubleTap)
        }

        return true
    }
}
#elseif canImport(AppKit)
extension GestureCoordinator: NSGestureRecognizerDelegate {
    public func gestureRecognizer(_ gestureRecognizer: NSGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: NSGestureRecognizer) -> Bool {
        // Allow pan and pinch to work together
        let isPanAndPinch = (gestureRecognizer == panGestureRecognizer && otherGestureRecognizer == pinchGestureRecognizer) ||
                           (gestureRecognizer == pinchGestureRecognizer && otherGestureRecognizer == panGestureRecognizer)

        return isPanAndPinch
    }

    public func gestureRecognizerShouldBegin(_ gestureRecognizer: NSGestureRecognizer) -> Bool {
        // Don't start gestures if another conflicting gesture is active
        if gestureRecognizer == panGestureRecognizer {
            return !isGestureBlocked(for: .pan)
        } else if gestureRecognizer == pinchGestureRecognizer {
            return !isGestureBlocked(for: .pinch)
        } else if gestureRecognizer == doubleTapGestureRecognizer {
            return !isGestureBlocked(for: .doubleTap)
        }

        return true
    }
}
#endif