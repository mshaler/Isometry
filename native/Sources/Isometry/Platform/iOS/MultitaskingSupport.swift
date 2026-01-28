import SwiftUI
import Combine

#if os(iOS)
import UIKit
import CloudKit

/// Comprehensive iOS multitasking functionality for notebook workflow
/// Provides scene management, split view support, slide-over integration, and background processing
@MainActor
public class MultitaskingSupport: ObservableObject {

    // MARK: - Published Properties

    @Published var currentWindowMode: WindowMode = .fullScreen
    @Published var isInBackground: Bool = false
    @Published var backgroundSyncInProgress: Bool = false
    @Published var sceneActivationState: UIScene.ActivationState = .unattached

    // MARK: - Types

    public enum WindowMode {
        case fullScreen
        case splitView(width: CGFloat)
        case slideOver
        case compact

        var layoutPriority: ComponentPriority {
            switch self {
            case .fullScreen:
                return .balanced
            case .splitView(let width):
                return width < 600 ? .captureFirst : .balanced
            case .slideOver, .compact:
                return .captureOnly
            }
        }
    }

    public enum ComponentPriority {
        case balanced           // All three components visible
        case captureFirst      // Capture prioritized, shell/preview smaller
        case captureOnly       // Only capture visible
        case shellPreview      // Only shell and preview (rare)
    }

    // MARK: - Private Properties

    private var cancellables = Set<AnyCancellable>()
    private var backgroundTask: UIBackgroundTaskIdentifier = .invalid
    private let notificationCenter = NotificationCenter.default
    private weak var currentScene: UIScene?

    // Minimum width requirements for components in different modes
    private let minimumWidths: (capture: CGFloat, shell: CGFloat, preview: CGFloat) = (280, 200, 200)

    // MARK: - Initialization

    public init() {
        setupNotificationObservers()
    }

    deinit {
        Task { @MainActor in
            endBackgroundTask()
        }
    }

    // MARK: - Scene Management

    /// Configure scene for notebook functionality
    public func configureScene(_ scene: UIScene) {
        currentScene = scene

        guard let windowScene = scene as? UIWindowScene else { return }

        // Configure scene for multitasking
        windowScene.sizeRestrictions?.minimumSize = CGSize(width: 320, height: 480)
        windowScene.sizeRestrictions?.maximumSize = CGSize(width: CGFloat.infinity, height: CGFloat.infinity)

        // Monitor scene state changes
        NotificationCenter.default
            .publisher(for: UIScene.didActivateNotification)
            .sink { [weak self] (notification: Notification) in
                guard let scene = notification.object as? UIScene else { return }
                self?.handleSceneStateChange(scene)
            }
            .store(in: &cancellables)

        // Initial state setup
        handleSceneStateChange(scene)
    }

    func handleSceneStateChange(_ scene: UIScene) {
        sceneActivationState = scene.activationState

        switch scene.activationState {
        case .foregroundActive:
            isInBackground = false
            endBackgroundTask()

        case .foregroundInactive:
            isInBackground = false

        case .background:
            isInBackground = true
            beginBackgroundTask()

        case .unattached:
            break

        @unknown default:
            break
        }
    }

    // MARK: - Split View Support

    /// Calculate optimal layout for split view constraints
    public func calculateSplitViewLayout(containerWidth: CGFloat) -> (capture: CGFloat, shell: CGFloat, preview: CGFloat) {
        let mode = determineWindowMode(for: containerWidth)
        currentWindowMode = mode

        switch mode.layoutPriority {
        case .balanced:
            // Standard three-column layout
            let captureWidth = containerWidth * 0.4
            let shellWidth = containerWidth * 0.3
            let previewWidth = containerWidth * 0.3
            return (captureWidth, shellWidth, previewWidth)

        case .captureFirst:
            // Capture gets priority, shell and preview split remaining space
            let captureWidth = max(minimumWidths.capture, containerWidth * 0.5)
            let remainingWidth = containerWidth - captureWidth
            let shellWidth = remainingWidth * 0.5
            let previewWidth = remainingWidth * 0.5
            return (captureWidth, shellWidth, previewWidth)

        case .captureOnly:
            // Only capture visible
            return (containerWidth, 0, 0)

        case .shellPreview:
            // Capture hidden, shell and preview split space
            let shellWidth = containerWidth * 0.5
            let previewWidth = containerWidth * 0.5
            return (0, shellWidth, previewWidth)
        }
    }

    /// Determine window mode based on container width
    private func determineWindowMode(for width: CGFloat) -> WindowMode {
        if width < 400 {
            return .slideOver
        } else if width < 600 {
            return .compact
        } else if width < UIScreen.main.bounds.width * 0.8 {
            return .splitView(width: width)
        } else {
            return .fullScreen
        }
    }

    // MARK: - Slide-Over Integration

    /// Check if app is running in slide-over mode
    public var isSlideOverMode: Bool {
        guard let windowScene = currentScene as? UIWindowScene,
              let window = windowScene.windows.first else {
            return false
        }

        // Slide-over windows are typically narrow and overlay other apps
        let screenWidth = UIScreen.main.bounds.width
        let windowWidth = window.bounds.width

        return windowWidth < screenWidth * 0.5
    }

    /// Configure compact layout for slide-over usage
    public func getSlideOverConfiguration() -> SlideOverConfig {
        return SlideOverConfig(
            showCaptureOnly: true,
            enableQuickCapture: true,
            minimizeChrome: true,
            autoHideKeyboard: false
        )
    }

    public struct SlideOverConfig {
        let showCaptureOnly: Bool
        let enableQuickCapture: Bool
        let minimizeChrome: Bool
        let autoHideKeyboard: Bool
    }

    // MARK: - Background Processing

    /// Begin background task for data preservation
    private func beginBackgroundTask() {
        endBackgroundTask() // End any existing task

        backgroundTask = UIApplication.shared.beginBackgroundTask(withName: "NotebookSync") { [weak self] in
            self?.endBackgroundTask()
        }

        // Start background sync
        backgroundSyncInProgress = true
        performBackgroundSync()
    }

    /// End background task
    private func endBackgroundTask() {
        if backgroundTask != .invalid {
            UIApplication.shared.endBackgroundTask(backgroundTask)
            backgroundTask = .invalid
            backgroundSyncInProgress = false
        }
    }

    /// Perform background synchronization
    private func performBackgroundSync() {
        Task {
            do {
                // Sync with CloudKit
                await syncNotebookData()

                // Persist current state
                await saveNotebookState()

                // Clean up memory
                performMemoryCleanup()

            } catch {
                print("Background sync failed: \(error)")
            }

            await MainActor.run {
                backgroundSyncInProgress = false
            }
        }
    }

    /// Sync notebook data with CloudKit during background execution
    private func syncNotebookData() async {
        // This would integrate with the CloudKit sync manager
        // For now, we'll simulate the sync operation
        try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 second
    }

    /// Save current notebook state before backgrounding
    private func saveNotebookState() async {
        // This would save current notebook state including:
        // - Current capture content
        // - Shell command history
        // - Preview state
        // - Layout configuration
        UserDefaults.standard.set(Date(), forKey: "lastBackgroundSave")
    }

    /// Perform memory cleanup for background mode
    private func performMemoryCleanup() {
        // Clear caches and release non-essential memory
        URLCache.shared.removeAllCachedResponses()

        // Notify components to release memory
        notificationCenter.post(name: .memoryCleanupRequested, object: nil)
    }

    // MARK: - Gesture Handling for Slide-Over

    /// Handle slide-over dismissal gesture
    public func handleSlideOverDismissal() -> some Gesture {
        DragGesture()
            .onEnded { value in
                // Detect swipe to dismiss gesture
                if value.translation.width > 100 && abs(value.translation.height) < 50 {
                    // User is trying to dismiss slide-over
                    // We don't control this, but we can prepare for it
                    self.prepareForDismissal()
                }
            }
    }

    private func prepareForDismissal() {
        // Save current state before potential dismissal
        Task {
            await saveNotebookState()
        }
    }

    // MARK: - Notification Setup

    private func setupNotificationObservers() {
        // App lifecycle notifications
        notificationCenter.publisher(for: UIApplication.didEnterBackgroundNotification)
            .sink { [weak self] _ in
                self?.handleDidEnterBackground()
            }
            .store(in: &cancellables)

        notificationCenter.publisher(for: UIApplication.willEnterForegroundNotification)
            .sink { [weak self] _ in
                self?.handleWillEnterForeground()
            }
            .store(in: &cancellables)

        notificationCenter.publisher(for: UIApplication.didReceiveMemoryWarningNotification)
            .sink { [weak self] _ in
                self?.handleMemoryWarning()
            }
            .store(in: &cancellables)
    }

    private func handleDidEnterBackground() {
        beginBackgroundTask()
    }

    private func handleWillEnterForeground() {
        endBackgroundTask()

        // Refresh data if needed
        Task {
            await refreshNotebookData()
        }
    }

    private func handleMemoryWarning() {
        performMemoryCleanup()
    }

    private func refreshNotebookData() async {
        // Refresh notebook data when returning to foreground
        // This could trigger a CloudKit fetch if data has changed
    }
}

// MARK: - UISceneDelegate Extensions

extension MultitaskingSupport {

    /// Scene configuration for notebook scenes
    public static func configurationForConnectingScene(
        _ connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {

        let configuration = UISceneConfiguration(
            name: "NotebookScene",
            sessionRole: connectingSceneSession.role
        )

        configuration.delegateClass = NotebookSceneDelegate.self

        return configuration
    }
}

/// Custom scene delegate for notebook scenes
public class NotebookSceneDelegate: UIResponder, UIWindowSceneDelegate {

    public var window: UIWindow?
    private var multitaskingSupport: MultitaskingSupport?

    public func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = scene as? UIWindowScene else { return }

        // Initialize multitasking support
        multitaskingSupport = MultitaskingSupport()
        multitaskingSupport?.configureScene(scene)

        // Configure window
        window = UIWindow(windowScene: windowScene)

        // This would integrate with your main SwiftUI view
        // window?.rootViewController = UIHostingController(rootView: ContentView())
        // window?.makeKeyAndVisible()
    }

    public func sceneDidBecomeActive(_ scene: UIScene) {
        multitaskingSupport?.handleSceneStateChange(scene)
    }

    public func sceneWillResignActive(_ scene: UIScene) {
        multitaskingSupport?.handleSceneStateChange(scene)
    }

    public func sceneDidEnterBackground(_ scene: UIScene) {
        multitaskingSupport?.handleSceneStateChange(scene)
    }

    public func sceneWillEnterForeground(_ scene: UIScene) {
        multitaskingSupport?.handleSceneStateChange(scene)
    }
}

// MARK: - Notification Extensions

extension Notification.Name {
    static let memoryCleanupRequested = Notification.Name("memoryCleanupRequested")
    static let windowModeChanged = Notification.Name("windowModeChanged")
    static let backgroundSyncCompleted = Notification.Name("backgroundSyncCompleted")
}

// MARK: - SwiftUI Integration

extension MultitaskingSupport {

    /// SwiftUI view modifier for multitasking support
    public func multitaskingSupport() -> some ViewModifier {
        MultitaskingSupportModifier(multitaskingSupport: self)
    }
}

private struct MultitaskingSupportModifier: ViewModifier {
    @ObservedObject var multitaskingSupport: MultitaskingSupport

    func body(content: Content) -> some View {
        content
            .onReceive(NotificationCenter.default.publisher(for: UIDevice.orientationDidChangeNotification)) { _ in
                // Handle orientation changes that might affect layout
            }
            .onReceive(multitaskingSupport.$currentWindowMode) { windowMode in
                // React to window mode changes
                NotificationCenter.default.post(
                    name: .windowModeChanged,
                    object: windowMode
                )
            }
    }
}

#endif