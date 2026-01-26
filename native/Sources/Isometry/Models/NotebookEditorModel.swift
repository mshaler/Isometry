import Foundation
import SwiftUI
import Combine

/// Editor mode for the markdown editor interface
public enum MarkdownEditorMode: String, CaseIterable {
    case edit = "edit"
    case split = "split"
    case preview = "preview"

    public var displayName: String {
        switch self {
        case .edit: return "Edit"
        case .split: return "Split"
        case .preview: return "Preview"
        }
    }
}

/// ObservableObject for managing notebook editor state and auto-save functionality
/// Integrates with IsometryDatabase for persistence and CloudKit sync
@MainActor
public class NotebookEditorModel: ObservableObject {

    // MARK: - Published Properties

    /// Current markdown content
    @Published public var content: String = ""

    /// Whether there are unsaved changes
    @Published public var isDirty: Bool = false

    /// Whether a save operation is in progress
    @Published public var isSaving: Bool = false

    /// Current editor mode (edit/split/preview)
    @Published public var mode: MarkdownEditorMode = .split

    /// Currently active notebook card
    @Published public var activeCard: NotebookCard? = nil

    /// Whether the editor is currently focused/editing
    @Published public var isEditing: Bool = false

    // MARK: - Private Properties

    private var database: IsometryDatabase
    private var autoSaveTimer: Timer?
    private var autoSaveDelay: TimeInterval = 2.0
    private var cancellables = Set<AnyCancellable>()
    private var lastSavedContent: String = ""

    // MARK: - Initialization

    public init(database: IsometryDatabase) {
        self.database = database
        setupAutoSave()
    }

    deinit {
        autoSaveTimer?.invalidate()
    }

    // MARK: - Public Methods

    /// Load a notebook card for editing
    public func loadCard(_ card: NotebookCard) {
        // Cancel any pending save for the current card
        saveCurrentChanges()

        // Load new card
        activeCard = card
        content = card.markdownContent ?? ""
        lastSavedContent = content
        isDirty = false

        // Reset editor state
        isEditing = false
    }

    /// Create a new notebook card
    public func createNewCard(title: String = "Untitled", folder: String? = nil) async throws {
        // Save current changes before creating new card
        await saveCurrentChanges()

        // Create new card
        let newCard = NotebookCard(
            title: title,
            markdownContent: "",
            folder: folder
        )

        try await database.createNotebookCard(newCard)

        // Load the new card
        loadCard(newCard)
    }

    /// Update content and mark as dirty
    public func updateContent(_ newContent: String) {
        guard content != newContent else { return }

        content = newContent
        isDirty = (content != lastSavedContent)

        // Reset auto-save timer
        scheduleAutoSave()
    }

    /// Manually save now, bypassing the timer
    @discardableResult
    public func saveNow() async -> Bool {
        return await performSave()
    }

    /// Set editor mode
    public func setMode(_ newMode: MarkdownEditorMode) {
        mode = newMode
    }

    /// Update the database reference
    public func updateDatabase(_ newDatabase: IsometryDatabase) {
        database = newDatabase
    }

    // MARK: - Private Methods

    private func setupAutoSave() {
        // Monitor content changes for auto-save
        $content
            .debounce(for: .milliseconds(500), scheduler: RunLoop.main)
            .sink { [weak self] _ in
                self?.scheduleAutoSave()
            }
            .store(in: &cancellables)
    }

    private func scheduleAutoSave() {
        // Cancel existing timer
        autoSaveTimer?.invalidate()

        // Only schedule if there are changes to save
        guard isDirty, let activeCard = activeCard else { return }

        // Schedule new auto-save
        autoSaveTimer = Timer.scheduledTimer(withTimeInterval: autoSaveDelay, repeats: false) { [weak self] _ in
            Task { @MainActor in
                await self?.performSave()
            }
        }
    }

    @discardableResult
    private func performSave() async -> Bool {
        guard isDirty, let activeCard = activeCard else {
            return false
        }

        // Prevent concurrent saves
        guard !isSaving else {
            return false
        }

        isSaving = true

        do {
            // Update card with new content
            let updatedCard = NotebookCard(
                id: activeCard.id,
                title: activeCard.title,
                markdownContent: content,
                properties: activeCard.properties,
                templateId: activeCard.templateId,
                createdAt: activeCard.createdAt,
                modifiedAt: Date(), // This will be updated in the database
                folder: activeCard.folder,
                tags: activeCard.tags,
                linkedNodeId: activeCard.linkedNodeId,
                syncVersion: activeCard.syncVersion + 1,
                lastSyncedAt: activeCard.lastSyncedAt,
                conflictResolvedAt: activeCard.conflictResolvedAt,
                deletedAt: activeCard.deletedAt
            )

            // Save to database
            try await database.updateNotebookCard(updatedCard)

            // Update local state
            self.activeCard = updatedCard
            lastSavedContent = content
            isDirty = false

            isSaving = false
            return true

        } catch {
            print("Failed to save notebook card: \(error)")
            isSaving = false
            return false
        }
    }

    private func saveCurrentChanges() {
        autoSaveTimer?.invalidate()

        if isDirty {
            Task {
                await performSave()
            }
        }
    }

    // MARK: - Computed Properties

    /// Character count for the current content
    public var characterCount: Int {
        content.count
    }

    /// Word count for the current content
    public var wordCount: Int {
        content.components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
            .count
    }

    /// Line count for the current content
    public var lineCount: Int {
        content.components(separatedBy: .newlines).count
    }

    /// Whether auto-save is enabled and scheduled
    public var isAutoSaveScheduled: Bool {
        autoSaveTimer?.isValid == true
    }

    /// Time until next auto-save (if scheduled)
    public var timeUntilAutoSave: TimeInterval? {
        guard let timer = autoSaveTimer, timer.isValid else { return nil }
        return timer.fireDate.timeIntervalSinceNow
    }

    // MARK: - Card Management

    /// Delete the current card
    public func deleteCurrentCard() async throws {
        guard let activeCard = activeCard else { return }

        try await database.deleteNotebookCard(id: activeCard.id)

        // Clear editor state
        self.activeCard = nil
        content = ""
        lastSavedContent = ""
        isDirty = false
        isEditing = false
    }

    /// Duplicate the current card
    public func duplicateCurrentCard() async throws -> NotebookCard? {
        guard let activeCard = activeCard else { return nil }

        let duplicatedCard = NotebookCard(
            title: "\(activeCard.title) (Copy)",
            markdownContent: activeCard.markdownContent,
            properties: activeCard.properties,
            templateId: activeCard.templateId,
            folder: activeCard.folder,
            tags: activeCard.tags,
            linkedNodeId: activeCard.linkedNodeId
        )

        try await database.createNotebookCard(duplicatedCard)
        return duplicatedCard
    }

    /// Update card title
    public func updateTitle(_ newTitle: String) async throws {
        guard let activeCard = activeCard else { return }

        let updatedCard = NotebookCard(
            id: activeCard.id,
            title: newTitle,
            markdownContent: activeCard.markdownContent,
            properties: activeCard.properties,
            templateId: activeCard.templateId,
            createdAt: activeCard.createdAt,
            modifiedAt: Date(),
            folder: activeCard.folder,
            tags: activeCard.tags,
            linkedNodeId: activeCard.linkedNodeId,
            syncVersion: activeCard.syncVersion + 1,
            lastSyncedAt: activeCard.lastSyncedAt,
            conflictResolvedAt: activeCard.conflictResolvedAt,
            deletedAt: activeCard.deletedAt
        )

        try await database.updateNotebookCard(updatedCard)
        self.activeCard = updatedCard
    }

    /// Update card properties
    public func updateProperties(_ newProperties: [String: String]) async throws {
        guard let activeCard = activeCard else { return }

        let updatedCard = NotebookCard(
            id: activeCard.id,
            title: activeCard.title,
            markdownContent: activeCard.markdownContent,
            properties: newProperties,
            templateId: activeCard.templateId,
            createdAt: activeCard.createdAt,
            modifiedAt: Date(),
            folder: activeCard.folder,
            tags: activeCard.tags,
            linkedNodeId: activeCard.linkedNodeId,
            syncVersion: activeCard.syncVersion + 1,
            lastSyncedAt: activeCard.lastSyncedAt,
            conflictResolvedAt: activeCard.conflictResolvedAt,
            deletedAt: activeCard.deletedAt
        )

        try await database.updateNotebookCard(updatedCard)
        self.activeCard = updatedCard
    }
}

// MARK: - Configuration

extension NotebookEditorModel {
    /// Configure auto-save delay
    public func setAutoSaveDelay(_ delay: TimeInterval) {
        autoSaveDelay = max(0.5, delay) // Minimum 0.5 seconds
    }
}