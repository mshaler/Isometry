import Foundation
import SwiftUI
import Combine

/// ObservableObject that manages the state and persistence of the three-component notebook layout
/// Provides responsive layout calculations for capture, shell, and preview components
@MainActor
public final class NotebookLayoutModel: ObservableObject {

    // MARK: - Layout Configuration

    /// Component layout information with width/height percentages
    public struct ComponentLayout: Codable, Equatable {
        public var width: Double // Percentage (0-100)
        public var height: Double // Percentage (0-100)

        public init(width: Double, height: Double) {
            self.width = width
            self.height = height
        }
    }

    /// Screen size categories matching React prototype breakpoints
    public enum ScreenSize: String, CaseIterable, Codable {
        case mobile // < 768pts
        case tablet // 768-1023pts
        case desktop // >= 1024pts

        public static func from(width: CGFloat) -> ScreenSize {
            switch width {
            case ..<768:
                return .mobile
            case 768..<1024:
                return .tablet
            default:
                return .desktop
            }
        }
    }

    // MARK: - Published Properties

    @Published public var captureLayout: ComponentLayout
    @Published public var shellLayout: ComponentLayout
    @Published public var previewLayout: ComponentLayout
    @Published public var currentScreenSize: ScreenSize = .desktop

    // MARK: - Private Properties

    private let userDefaults = UserDefaults.standard
    private static let layoutKey = "NotebookLayout"
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Default Layouts

    /// Default desktop layout: capture 40%, shell 30%, preview 30%
    private static let defaultDesktopLayouts = (
        capture: ComponentLayout(width: 40, height: 100),
        shell: ComponentLayout(width: 30, height: 100),
        preview: ComponentLayout(width: 30, height: 100)
    )

    /// Tablet layout: capture on top, shell and preview split below
    private static let defaultTabletLayouts = (
        capture: ComponentLayout(width: 100, height: 50),
        shell: ComponentLayout(width: 50, height: 50),
        preview: ComponentLayout(width: 50, height: 50)
    )

    /// Mobile layout: all components stacked vertically with equal heights
    private static let defaultMobileLayouts = (
        capture: ComponentLayout(width: 100, height: 33.33),
        shell: ComponentLayout(width: 100, height: 33.33),
        preview: ComponentLayout(width: 100, height: 33.34)
    )

    // MARK: - Initialization

    public init() {
        // Load persisted layouts or use defaults
        self.captureLayout = Self.defaultDesktopLayouts.capture
        self.shellLayout = Self.defaultDesktopLayouts.shell
        self.previewLayout = Self.defaultDesktopLayouts.preview

        loadPersistedLayout()
        setupAutosave()
    }

    // MARK: - Public Methods

    /// Update the width of a specific component, redistributing remaining space proportionally
    /// - Parameters:
    ///   - component: Which component to update (.capture, .shell, or .preview)
    ///   - newWidth: New width percentage (0-100)
    public func updateComponentWidth(_ component: Component, to newWidth: Double) {
        let constrainedWidth = max(15, min(70, newWidth)) // Minimum 15%, maximum 70%

        switch component {
        case .capture:
            let remainingWidth = 100 - constrainedWidth
            let shellRatio = shellLayout.width / (shellLayout.width + previewLayout.width)

            captureLayout.width = constrainedWidth
            shellLayout.width = remainingWidth * shellRatio
            previewLayout.width = remainingWidth * (1 - shellRatio)

        case .shell:
            let availableWidth = 100 - captureLayout.width
            let constrainedShellWidth = max(15, min(availableWidth - 15, constrainedWidth))
            let newPreviewWidth = availableWidth - constrainedShellWidth

            shellLayout.width = constrainedShellWidth
            previewLayout.width = newPreviewWidth

        case .preview:
            let availableWidth = 100 - captureLayout.width
            let constrainedPreviewWidth = max(15, min(availableWidth - 15, constrainedWidth))
            let newShellWidth = availableWidth - constrainedPreviewWidth

            previewLayout.width = newShellWidth
            shellLayout.width = constrainedPreviewWidth
        }
    }

    /// Reset to default layout for current screen size
    public func resetToDefaults() {
        calculateLayout(for: currentScreenSize)
    }

    /// Calculate and apply layout for specific screen size
    /// - Parameter screenSize: Target screen size
    public func calculateLayout(for screenSize: ScreenSize) {
        currentScreenSize = screenSize

        switch screenSize {
        case .mobile:
            captureLayout = Self.defaultMobileLayouts.capture
            shellLayout = Self.defaultMobileLayouts.shell
            previewLayout = Self.defaultMobileLayouts.preview

        case .tablet:
            captureLayout = Self.defaultTabletLayouts.capture
            shellLayout = Self.defaultTabletLayouts.shell
            previewLayout = Self.defaultTabletLayouts.preview

        case .desktop:
            captureLayout = Self.defaultDesktopLayouts.capture
            shellLayout = Self.defaultDesktopLayouts.shell
            previewLayout = Self.defaultDesktopLayouts.preview
        }
    }

    /// Get minimum width constraints for desktop layout
    /// - Returns: Minimum widths in points for capture/shell/preview
    public func getMinimumWidths() -> (capture: CGFloat, shell: CGFloat, preview: CGFloat) {
        return (capture: 300, shell: 250, preview: 250)
    }

    // MARK: - Component Enum

    public enum Component {
        case capture
        case shell
        case preview
    }

    // MARK: - Persistence

    /// Save current layout to UserDefaults
    private func saveLayout() {
        let layoutData = LayoutData(
            capture: captureLayout,
            shell: shellLayout,
            preview: previewLayout,
            screenSize: currentScreenSize
        )

        do {
            let data = try JSONEncoder().encode(layoutData)
            userDefaults.set(data, forKey: Self.layoutKey)
        } catch {
            print("Failed to save layout: \(error)")
        }
    }

    /// Load persisted layout from UserDefaults
    private func loadPersistedLayout() {
        guard let data = userDefaults.data(forKey: Self.layoutKey),
              let layoutData = try? JSONDecoder().decode(LayoutData.self, from: data) else {
            return
        }

        captureLayout = layoutData.capture
        shellLayout = layoutData.shell
        previewLayout = layoutData.preview
        currentScreenSize = layoutData.screenSize
    }

    /// Setup automatic saving when layout changes
    private func setupAutosave() {
        // Combine all layout changes into a single publisher
        Publishers.CombineLatest3(
            $captureLayout,
            $shellLayout,
            $previewLayout
        )
        .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
        .sink { [weak self] _, _, _ in
            self?.saveLayout()
        }
        .store(in: &cancellables)

        // Also save when screen size changes
        $currentScreenSize
            .dropFirst() // Skip initial value
            .sink { [weak self] _ in
                self?.saveLayout()
            }
            .store(in: &cancellables)
    }
}

// MARK: - Private Types

/// Internal data structure for JSON persistence
private struct LayoutData: Codable {
    let capture: NotebookLayoutModel.ComponentLayout
    let shell: NotebookLayoutModel.ComponentLayout
    let preview: NotebookLayoutModel.ComponentLayout
    let screenSize: NotebookLayoutModel.ScreenSize
}

// MARK: - Layout Helpers

extension NotebookLayoutModel {
    /// Calculate absolute dimensions for a given container size
    /// - Parameter containerSize: Available container size
    /// - Returns: Absolute dimensions for each component
    public func absoluteDimensions(for containerSize: CGSize) -> (capture: CGSize, shell: CGSize, preview: CGSize) {
        switch currentScreenSize {
        case .mobile:
            // Vertical stack - equal heights
            let componentHeight = containerSize.height / 3
            return (
                capture: CGSize(width: containerSize.width, height: componentHeight),
                shell: CGSize(width: containerSize.width, height: componentHeight),
                preview: CGSize(width: containerSize.width, height: componentHeight)
            )

        case .tablet:
            // Capture on top, shell/preview split below
            let captureHeight = containerSize.height * 0.5
            let bottomHeight = containerSize.height * 0.5
            let halfWidth = containerSize.width * 0.5

            return (
                capture: CGSize(width: containerSize.width, height: captureHeight),
                shell: CGSize(width: halfWidth, height: bottomHeight),
                preview: CGSize(width: halfWidth, height: bottomHeight)
            )

        case .desktop:
            // Side by side with calculated widths
            let captureWidth = containerSize.width * (captureLayout.width / 100)
            let shellWidth = containerSize.width * (shellLayout.width / 100)
            let previewWidth = containerSize.width * (previewLayout.width / 100)

            return (
                capture: CGSize(width: captureWidth, height: containerSize.height),
                shell: CGSize(width: shellWidth, height: containerSize.height),
                preview: CGSize(width: previewWidth, height: containerSize.height)
            )
        }
    }
}