#if os(macOS)
import SwiftUI
import UniformTypeIdentifiers

/// Comprehensive macOS window management for notebook workflow
@MainActor
public final class WindowManager: ObservableObject {
    // MARK: - Published Properties
    @Published public var windows: [WindowInfo] = []
    @Published public var activeWindowId: UUID?
    @Published public var windowRestoration: WindowRestorationState = .idle

    // MARK: - Private Properties
    private var windowContexts: [UUID: NotebookWindowContext] = [:]
    private var restorationManager: WindowRestorationManager
    private var documentManager: DocumentManager

    // MARK: - Types

    /// Information about a managed window
    public struct WindowInfo: Identifiable, Hashable {
        public let id: UUID
        public let title: String
        public let notebookId: String?
        public let cardId: String?
        public let windowLevel: WindowLevel
        public let state: WindowState
        public let frame: CGRect?
        public let lastModified: Date

        public enum WindowLevel: String, CaseIterable {
            case primary = "primary"
            case secondary = "secondary"
            case utility = "utility"
            case floating = "floating"
        }

        public enum WindowState: String, CaseIterable {
            case active = "active"
            case minimized = "minimized"
            case hidden = "hidden"
            case fullscreen = "fullscreen"
        }

        public init(
            id: UUID = UUID(),
            title: String,
            notebookId: String? = nil,
            cardId: String? = nil,
            windowLevel: WindowLevel = .primary,
            state: WindowState = .active,
            frame: CGRect? = nil,
            lastModified: Date = Date()
        ) {
            self.id = id
            self.title = title
            self.notebookId = notebookId
            self.cardId = cardId
            self.windowLevel = windowLevel
            self.state = state
            self.frame = frame
            self.lastModified = lastModified
        }
    }

    /// Individual notebook window context
    public struct NotebookWindowContext {
        public let windowId: UUID
        public var notebookId: String?
        public var activeCardId: String?
        public var layoutState: LayoutState
        public var undoManager: UndoManager
        public var isDocumentDirty: Bool = false

        public struct LayoutState {
            public var sidebarWidth: CGFloat = 220
            public var contentWidth: CGFloat = 350
            public var detailWidth: CGFloat = 400
            public var sidebarCollapsed: Bool = false
            public var contentCollapsed: Bool = false
            public var viewMode: ViewMode = .threeColumn

            public enum ViewMode: String, CaseIterable {
                case singleColumn = "single"
                case twoColumn = "two"
                case threeColumn = "three"
            }
        }

        public init(windowId: UUID, notebookId: String? = nil) {
            self.windowId = windowId
            self.notebookId = notebookId
            self.layoutState = LayoutState()
            self.undoManager = UndoManager()
        }
    }

    /// Window restoration state
    public enum WindowRestorationState {
        case idle
        case restoring(progress: Double)
        case completed
        case failed(Error)
    }

    // MARK: - Initialization

    public init() {
        self.restorationManager = WindowRestorationManager()
        self.documentManager = DocumentManager()

        // Set up restoration
        Task {
            await restoreWindowState()
        }
    }

    // MARK: - Public API

    /// Create new notebook window
    public func createNotebookWindow(
        title: String = "New Notebook",
        notebookId: String? = nil,
        cardId: String? = nil,
        frame: CGRect? = nil
    ) -> UUID {
        let windowId = UUID()

        // Calculate cascaded frame if none provided
        let windowFrame = frame ?? calculateCascadedFrame()

        // Create window info
        let windowInfo = WindowInfo(
            id: windowId,
            title: title,
            notebookId: notebookId,
            cardId: cardId,
            frame: windowFrame
        )

        // Create window context
        let context = NotebookWindowContext(
            windowId: windowId,
            notebookId: notebookId
        )

        // Add to tracking
        windows.append(windowInfo)
        windowContexts[windowId] = context
        activeWindowId = windowId

        // Register with document manager
        documentManager.registerWindow(windowId, title: title, notebookId: notebookId)

        return windowId
    }

    /// Close window with proper cleanup
    public func closeWindow(_ windowId: UUID) {
        guard let windowInfo = windows.first(where: { $0.id == windowId }),
              let context = windowContexts[windowId] else {
            return
        }

        // Check for unsaved changes
        if context.isDocumentDirty {
            // Handle dirty document - this would trigger a save dialog in production
            Task {
                await saveWindowState(windowId)
            }
        }

        // Remove from tracking
        windows.removeAll { $0.id == windowId }
        windowContexts.removeValue(forKey: windowId)

        // Update active window
        if activeWindowId == windowId {
            activeWindowId = windows.first?.id
        }

        // Unregister from document manager
        documentManager.unregisterWindow(windowId)

        // Save window state
        Task {
            await saveWindowConfiguration()
        }
    }

    /// Update window title
    public func updateWindowTitle(_ windowId: UUID, title: String) {
        if let index = windows.firstIndex(where: { $0.id == windowId }) {
            let oldInfo = windows[index]
            windows[index] = WindowInfo(
                id: oldInfo.id,
                title: title,
                notebookId: oldInfo.notebookId,
                cardId: oldInfo.cardId,
                windowLevel: oldInfo.windowLevel,
                state: oldInfo.state,
                frame: oldInfo.frame,
                lastModified: Date()
            )

            // Update document manager
            documentManager.updateWindowTitle(windowId, title: title)
        }
    }

    /// Update window frame
    public func updateWindowFrame(_ windowId: UUID, frame: CGRect) {
        if let index = windows.firstIndex(where: { $0.id == windowId }) {
            let oldInfo = windows[index]
            windows[index] = WindowInfo(
                id: oldInfo.id,
                title: oldInfo.title,
                notebookId: oldInfo.notebookId,
                cardId: oldInfo.cardId,
                windowLevel: oldInfo.windowLevel,
                state: oldInfo.state,
                frame: frame,
                lastModified: oldInfo.lastModified
            )
        }
    }

    /// Set active window
    public func setActiveWindow(_ windowId: UUID) {
        guard windows.contains(where: { $0.id == windowId }) else { return }
        activeWindowId = windowId
    }

    /// Get window context
    public func getWindowContext(_ windowId: UUID) -> NotebookWindowContext? {
        return windowContexts[windowId]
    }

    /// Update window context
    public func updateWindowContext(_ windowId: UUID, context: NotebookWindowContext) {
        windowContexts[windowId] = context
    }

    /// Mark window as dirty
    public func markWindowDirty(_ windowId: UUID, dirty: Bool = true) {
        windowContexts[windowId]?.isDocumentDirty = dirty
    }

    // MARK: - Window State Management

    /// Save window state for restoration
    private func saveWindowState(_ windowId: UUID) async {
        guard let windowInfo = windows.first(where: { $0.id == windowId }),
              let context = windowContexts[windowId] else {
            return
        }

        await restorationManager.saveWindowState(
            windowId: windowId,
            windowInfo: windowInfo,
            context: context
        )
    }

    /// Save all window configurations
    public func saveWindowConfiguration() async {
        await restorationManager.saveWindowConfiguration(
            windows: windows,
            contexts: windowContexts,
            activeWindowId: activeWindowId
        )
    }

    /// Restore window state from previous session
    private func restoreWindowState() async {
        windowRestoration = .restoring(progress: 0.0)

        do {
            let (restoredWindows, restoredContexts, restoredActiveId) = try await restorationManager.restoreWindowConfiguration()

            await MainActor.run {
                self.windows = restoredWindows
                self.windowContexts = restoredContexts
                self.activeWindowId = restoredActiveId
                self.windowRestoration = .completed
            }

            // Register restored windows with document manager
            for window in restoredWindows {
                documentManager.registerWindow(
                    window.id,
                    title: window.title,
                    notebookId: window.notebookId
                )
            }

        } catch {
            await MainActor.run {
                self.windowRestoration = .failed(error)
            }
        }
    }

    // MARK: - Private Helpers

    /// Calculate cascaded frame for new windows
    private func calculateCascadedFrame() -> CGRect {
        let defaultFrame = CGRect(x: 100, y: 100, width: 1000, height: 700)

        guard !windows.isEmpty else {
            return defaultFrame
        }

        // Find the most recent window frame
        let recentWindow = windows.max(by: { $0.lastModified < $1.lastModified })
        guard let recentFrame = recentWindow?.frame else {
            return defaultFrame
        }

        // Cascade by offsetting position
        let cascadeOffset: CGFloat = 30
        return CGRect(
            x: recentFrame.minX + cascadeOffset,
            y: recentFrame.minY - cascadeOffset, // Move up for macOS
            width: recentFrame.width,
            height: recentFrame.height
        )
    }
}

// MARK: - Window Restoration Manager

/// Manages window state persistence and restoration
@MainActor
private final class WindowRestorationManager {
    private let userDefaults = UserDefaults.standard
    private let windowConfigKey = "IsometryWindowConfiguration"

    /// Save window configuration to persistent storage
    func saveWindowConfiguration(
        windows: [WindowManager.WindowInfo],
        contexts: [UUID: WindowManager.NotebookWindowContext],
        activeWindowId: UUID?
    ) async {
        do {
            // Convert to serializable format
            let config = WindowConfiguration(
                windows: windows.map(WindowConfigEntry.init),
                contexts: contexts.mapValues(ContextConfigEntry.init),
                activeWindowId: activeWindowId
            )

            let data = try JSONEncoder().encode(config)
            userDefaults.set(data, forKey: windowConfigKey)

        } catch {
            print("Failed to save window configuration: \(error)")
        }
    }

    /// Restore window configuration from persistent storage
    func restoreWindowConfiguration() async throws -> (
        windows: [WindowManager.WindowInfo],
        contexts: [UUID: WindowManager.NotebookWindowContext],
        activeWindowId: UUID?
    ) {
        guard let data = userDefaults.data(forKey: windowConfigKey) else {
            // No saved configuration - return empty state
            return (windows: [], contexts: [:], activeWindowId: nil)
        }

        let config = try JSONDecoder().decode(WindowConfiguration.self, from: data)

        // Convert back from serializable format
        let windows = config.windows.map { $0.toWindowInfo() }
        let contexts = config.contexts.mapValues { $0.toNotebookWindowContext() }

        return (windows: windows, contexts: contexts, activeWindowId: config.activeWindowId)
    }

    /// Save individual window state
    func saveWindowState(
        windowId: UUID,
        windowInfo: WindowManager.WindowInfo,
        context: WindowManager.NotebookWindowContext
    ) async {
        // Individual window state saving for more granular control
        // This could be used for more frequent saves without affecting the entire configuration
        print("Saving window state for \(windowId)")
    }

    // MARK: - Serializable Types

    private struct WindowConfiguration: Codable {
        let windows: [WindowConfigEntry]
        let contexts: [String: ContextConfigEntry] // UUID as String for JSON
        let activeWindowId: UUID?

        enum CodingKeys: String, CodingKey {
            case windows, contexts, activeWindowId
        }

        func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(windows, forKey: .windows)

            // Convert UUID keys to strings
            let stringContexts = contexts.reduce(into: [String: ContextConfigEntry]()) { result, pair in
                result[pair.key.uuidString] = pair.value
            }
            try container.encode(stringContexts, forKey: .contexts)
            try container.encodeIfPresent(activeWindowId, forKey: .activeWindowId)
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            windows = try container.decode([WindowConfigEntry].self, forKey: .windows)

            // Convert string keys back to UUIDs
            let stringContexts = try container.decode([String: ContextConfigEntry].self, forKey: .contexts)
            contexts = stringContexts.reduce(into: [String: ContextConfigEntry]()) { result, pair in
                result[pair.key] = pair.value
            }
            activeWindowId = try container.decodeIfPresent(UUID.self, forKey: .activeWindowId)
        }

        init(windows: [WindowConfigEntry], contexts: [UUID: ContextConfigEntry], activeWindowId: UUID?) {
            self.windows = windows
            self.contexts = contexts.reduce(into: [String: ContextConfigEntry]()) { result, pair in
                result[pair.key.uuidString] = pair.value
            }
            self.activeWindowId = activeWindowId
        }
    }

    private struct WindowConfigEntry: Codable {
        let id: UUID
        let title: String
        let notebookId: String?
        let cardId: String?
        let windowLevel: String
        let state: String
        let frame: FrameConfig?
        let lastModified: Date

        struct FrameConfig: Codable {
            let x: CGFloat
            let y: CGFloat
            let width: CGFloat
            let height: CGFloat
        }

        init(_ windowInfo: WindowManager.WindowInfo) {
            self.id = windowInfo.id
            self.title = windowInfo.title
            self.notebookId = windowInfo.notebookId
            self.cardId = windowInfo.cardId
            self.windowLevel = windowInfo.windowLevel.rawValue
            self.state = windowInfo.state.rawValue
            self.frame = windowInfo.frame.map { FrameConfig(x: $0.minX, y: $0.minY, width: $0.width, height: $0.height) }
            self.lastModified = windowInfo.lastModified
        }

        func toWindowInfo() -> WindowManager.WindowInfo {
            return WindowManager.WindowInfo(
                id: id,
                title: title,
                notebookId: notebookId,
                cardId: cardId,
                windowLevel: WindowManager.WindowInfo.WindowLevel(rawValue: windowLevel) ?? .primary,
                state: WindowManager.WindowInfo.WindowState(rawValue: state) ?? .active,
                frame: frame.map { CGRect(x: $0.x, y: $0.y, width: $0.width, height: $0.height) },
                lastModified: lastModified
            )
        }
    }

    private struct ContextConfigEntry: Codable {
        let windowId: UUID
        let notebookId: String?
        let activeCardId: String?
        let layoutState: LayoutStateConfig
        let isDocumentDirty: Bool

        struct LayoutStateConfig: Codable {
            let sidebarWidth: CGFloat
            let contentWidth: CGFloat
            let detailWidth: CGFloat
            let sidebarCollapsed: Bool
            let contentCollapsed: Bool
            let viewMode: String
        }

        init(_ context: WindowManager.NotebookWindowContext) {
            self.windowId = context.windowId
            self.notebookId = context.notebookId
            self.activeCardId = context.activeCardId
            self.layoutState = LayoutStateConfig(
                sidebarWidth: context.layoutState.sidebarWidth,
                contentWidth: context.layoutState.contentWidth,
                detailWidth: context.layoutState.detailWidth,
                sidebarCollapsed: context.layoutState.sidebarCollapsed,
                contentCollapsed: context.layoutState.contentCollapsed,
                viewMode: context.layoutState.viewMode.rawValue
            )
            self.isDocumentDirty = context.isDocumentDirty
        }

        func toNotebookWindowContext() -> WindowManager.NotebookWindowContext {
            var context = WindowManager.NotebookWindowContext(
                windowId: windowId,
                notebookId: notebookId
            )
            context.activeCardId = activeCardId
            context.layoutState.sidebarWidth = layoutState.sidebarWidth
            context.layoutState.contentWidth = layoutState.contentWidth
            context.layoutState.detailWidth = layoutState.detailWidth
            context.layoutState.sidebarCollapsed = layoutState.sidebarCollapsed
            context.layoutState.contentCollapsed = layoutState.contentCollapsed
            context.layoutState.viewMode = WindowManager.NotebookWindowContext.LayoutState.ViewMode(rawValue: layoutState.viewMode) ?? .threeColumn
            context.isDocumentDirty = isDocumentDirty
            return context
        }
    }
}

// MARK: - Document Manager

/// Manages document-based app architecture integration
@MainActor
private final class DocumentManager {
    private var windowDocuments: [UUID: NotebookDocument] = [:]

    /// Register a window with the document system
    func registerWindow(_ windowId: UUID, title: String, notebookId: String?) {
        let document = NotebookDocument(
            windowId: windowId,
            title: title,
            notebookId: notebookId
        )
        windowDocuments[windowId] = document
    }

    /// Unregister a window from the document system
    func unregisterWindow(_ windowId: UUID) {
        windowDocuments.removeValue(forKey: windowId)
    }

    /// Update window title in document system
    func updateWindowTitle(_ windowId: UUID, title: String) {
        windowDocuments[windowId]?.title = title
    }

    /// Get document for window
    func getDocument(_ windowId: UUID) -> NotebookDocument? {
        return windowDocuments[windowId]
    }

    // MARK: - Notebook Document

    /// Document representation for document-based app integration
    final class NotebookDocument: ObservableObject {
        @Published var title: String
        @Published var isEdited: Bool = false

        let windowId: UUID
        var notebookId: String?

        init(windowId: UUID, title: String, notebookId: String?) {
            self.windowId = windowId
            self.title = title
            self.notebookId = notebookId
        }

        /// Save document
        func save() async {
            // Implementation would save notebook state to database
            print("Saving document: \(title)")
            isEdited = false
        }

        /// Revert document to saved state
        func revert() async {
            // Implementation would reload from database
            print("Reverting document: \(title)")
            isEdited = false
        }
    }
}

#endif