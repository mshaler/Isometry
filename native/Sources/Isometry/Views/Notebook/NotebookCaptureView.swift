import SwiftUI

/// Capture component for the notebook workflow with integrated markdown editor
/// Hosts the native markdown editing interface with live preview capabilities
public struct NotebookCaptureView: View {
    @EnvironmentObject private var appState: AppState

    // State management
    @StateObject private var editorModel: NotebookEditorModel
    @State private var showingProperties = false
    @State private var isMinimized = false

    public init() {
        // Initialize with placeholder database that will be updated via environment
        self._editorModel = StateObject(wrappedValue: NotebookEditorModel(database: IsometryDatabase.placeholder))
    }

    public var body: some View {
        Group {
            if isMinimized {
                minimizedView
            } else {
                fullEditorView
            }
        }
        .onAppear {
            // Update editor model with actual database when available
            if let database = appState.database {
                updateEditorDatabase(database)

                // Create a default card if none is active
                if editorModel.activeCard == nil {
                    Task {
                        try? await editorModel.createNewCard(title: "New Note")
                    }
                }
            }
        }
        .onChange(of: appState.database) { oldValue, newValue in
            if let database = newValue {
                updateEditorDatabase(database)
            }
        }
    }

    // MARK: - Minimized View

    private var minimizedView: some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: "doc.text")
                    .foregroundStyle(.secondary)
                Text("Capture")
                    .font(.headline)
                    .foregroundStyle(.primary)

                if editorModel.isDirty {
                    Circle()
                        .fill(.orange)
                        .frame(width: 8, height: 8)
                }

                Spacer()

                Button {
                    isMinimized = false
                } label: {
                    Image(systemName: "arrow.up.left.and.arrow.down.right")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background {
            RoundedRectangle(cornerRadius: 8)
                .fill(.background)
                .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
        }
        .overlay {
            RoundedRectangle(cornerRadius: 8)
                .stroke(.separator, lineWidth: 0.5)
        }
    }

    // MARK: - Full Editor View

    private var fullEditorView: some View {
        VStack(spacing: 0) {
            // Header
            headerView

            Divider()

            // Main content area
            VStack(spacing: 0) {
                // Editor/Preview area
                editorContentView
                    .frame(minHeight: 300)

                // Properties panel
                if showingProperties {
                    Divider()
                    propertiesPanel
                }
            }
        }
        .background {
            RoundedRectangle(cornerRadius: 8)
                .fill(.background)
                .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
        }
        .overlay {
            RoundedRectangle(cornerRadius: 8)
                .stroke(.separator, lineWidth: 0.5)
        }
    }

    // MARK: - Header

    private var headerView: some View {
        HStack {
            // Title and status
            HStack(spacing: 8) {
                Image(systemName: "doc.text")
                    .foregroundStyle(.secondary)

                if let card = editorModel.activeCard {
                    Text(card.title)
                        .font(.headline)
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                } else {
                    Text("No Active Card")
                        .font(.headline)
                        .foregroundStyle(.secondary)
                }

                // Status indicators
                if editorModel.isDirty {
                    Circle()
                        .fill(.orange)
                        .frame(width: 6, height: 6)
                }

                if editorModel.isSaving {
                    ProgressView()
                        .scaleEffect(0.6)
                }
            }

            Spacer()

            // Controls
            HStack(spacing: 8) {
                // Mode picker
                Picker("Mode", selection: $editorModel.mode) {
                    ForEach(MarkdownEditorMode.allCases, id: \.self) { mode in
                        Text(mode.displayName)
                            .tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .frame(maxWidth: 200)

                // Save button
                Button {
                    Task {
                        await editorModel.saveNow()
                    }
                } label: {
                    Image(systemName: "square.and.arrow.down")
                        .font(.caption)
                }
                .disabled(!editorModel.isDirty || editorModel.isSaving)
                .buttonStyle(.plain)

                // Properties toggle
                Button {
                    showingProperties.toggle()
                } label: {
                    Image(systemName: "slider.horizontal.3")
                        .font(.caption)
                        .foregroundStyle(showingProperties ? .accent : .secondary)
                }
                .buttonStyle(.plain)

                // Minimize button
                Button {
                    isMinimized = true
                } label: {
                    Image(systemName: "arrow.down.right.and.arrow.up.left")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.background.secondary)
    }

    // MARK: - Editor Content

    private var editorContentView: some View {
        Group {
            switch editorModel.mode {
            case .edit:
                editOnlyView
            case .split:
                splitView
            case .preview:
                previewOnlyView
            }
        }
        .padding(16)
    }

    private var editOnlyView: some View {
        MarkdownEditor(text: $editorModel.content, isEditing: $editorModel.isEditing)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var splitView: some View {
        HStack(spacing: 16) {
            MarkdownEditor(text: $editorModel.content, isEditing: $editorModel.isEditing)
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            Divider()

            MarkdownPreview(markdownText: editorModel.content)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private var previewOnlyView: some View {
        MarkdownPreview(markdownText: editorModel.content)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Properties Panel

    private var propertiesPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Properties")
                    .font(.headline)
                    .foregroundStyle(.primary)
                Spacer()
                Text("\(editorModel.wordCount) words • \(editorModel.characterCount) characters")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if let card = editorModel.activeCard {
                VStack(alignment: .leading, spacing: 8) {
                    // Basic info
                    Group {
                        PropertyRow(label: "Card ID", value: String(card.id.prefix(8)) + "...")
                        PropertyRow(label: "Created", value: DateFormatter.localizedString(from: card.createdAt, dateStyle: .short, timeStyle: .short))
                        PropertyRow(label: "Modified", value: DateFormatter.localizedString(from: card.modifiedAt, dateStyle: .short, timeStyle: .short))
                    }

                    Divider()

                    // Editable properties
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Custom Properties")
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundStyle(.secondary)

                        if card.properties.isEmpty {
                            Text("No custom properties")
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                                .italic()
                        } else {
                            ForEach(Array(card.properties.keys.sorted()), id: \.self) { key in
                                PropertyRow(label: key, value: card.properties[key] ?? "")
                            }
                        }
                    }
                }
            }
        }
        .padding(16)
        .background(.background.secondary)
    }

    // MARK: - Helper Methods

    private func updateEditorDatabase(_ database: IsometryDatabase) {
        editorModel.updateDatabase(database)
    }
}

// MARK: - Property Row

private struct PropertyRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(width: 80, alignment: .leading)

            Text(value)
                .font(.caption)
                .foregroundStyle(.primary)
                .lineLimit(1)
                .truncationMode(.middle)

            Spacer()
        }
    }
}

// MARK: - Placeholder Database Extension

extension IsometryDatabase {
    static var placeholder: IsometryDatabase {
        // Create an in-memory placeholder database
        // This will be replaced when the real database is available
        let db = try! IsometryDatabase(path: ":memory:")
        Task {
            try? await db.initialize()
        }
        return db
    }
}

// MARK: - Preview

#Preview {
    NotebookCaptureView()
        .environmentObject(AppState())
        .padding()
        .background(.background.secondary)
}