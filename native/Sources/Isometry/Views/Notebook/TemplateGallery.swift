import SwiftUI

/// Native collection view interface for template browsing and selection
public struct TemplateGallery: View {
    @ObservedObject var templateManager: TemplateManager
    let onCreateFromTemplate: (String) -> Void

    @State private var selectedCategory: TemplateCategory? = nil
    @State private var searchText = ""
    @State private var showingPreview: NotebookTemplate? = nil
    @State private var showingTemplateForm = false

    public init(templateManager: TemplateManager, onCreateFromTemplate: @escaping (String) -> Void) {
        self.templateManager = templateManager
        self.onCreateFromTemplate = onCreateFromTemplate
    }

    public var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Search and filter controls
                searchAndFilterSection

                // Template grid
                ScrollView {
                    LazyVGrid(columns: gridColumns, spacing: 16) {
                        // Recent templates section
                        if !searchText.isEmpty || selectedCategory == nil {
                            recentTemplatesSection
                        }

                        // Favorite templates section
                        if !searchText.isEmpty || selectedCategory == nil {
                            favoriteTemplatesSection
                        }

                        // All templates
                        templatesSection
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 16)
                }
            }
            .navigationTitle("Templates")
            #if canImport(UIKit)
.navigationBarTitleDisplayMode(.large)
#endif
            .toolbar {
                #if canImport(UIKit)
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        showingTemplateForm = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
                #else
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showingTemplateForm = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
                #endif
            }
            .sheet(isPresented: $showingTemplateForm) {
                templateCreationForm
            }
            .sheet(item: $showingPreview) { template in
                TemplatePreview(
                    template: template,
                    onUse: {
                        onCreateFromTemplate(template.id)
                        showingPreview = nil
                    },
                    onFavorite: {
                        templateManager.toggleFavorite(template.id)
                    },
                    onDuplicate: { newName in
                        Task {
                            try? await templateManager.duplicateTemplate(id: template.id, newTitle: newName)
                        }
                    },
                    onDelete: template.isBuiltIn ? nil : {
                        Task {
                            try? await templateManager.deleteCustomTemplate(id: template.id)
                        }
                        showingPreview = nil
                    },
                    isFavorite: templateManager.isFavorite(template.id)
                )
            }
        }
    }

    // MARK: - Search and Filter

    private var searchAndFilterSection: some View {
        VStack(spacing: 12) {
            // Search bar
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)

                TextField("Search templates...", text: $searchText)

                if !searchText.isEmpty {
                    Button {
                        searchText = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(.background.secondary)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .padding(.horizontal, 16)

            // Category filter
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    CategoryFilterButton(
                        title: "All",
                        icon: "square.grid.2x2",
                        isSelected: selectedCategory == nil
                    ) {
                        selectedCategory = nil
                    }

                    ForEach(TemplateCategory.allCases, id: \.self) { category in
                        CategoryFilterButton(
                            title: category.displayName,
                            icon: category.icon,
                            isSelected: selectedCategory == category
                        ) {
                            selectedCategory = category == selectedCategory ? nil : category
                        }
                    }
                }
                .padding(.horizontal, 16)
            }
        }
        .padding(.top, 8)
        .padding(.bottom, 16)
    }

    // MARK: - Template Sections

    private var recentTemplatesSection: some View {
        Group {
            if !templateManager.recentTemplates.isEmpty {
                VStack(alignment: .leading, spacing: 12) {
                    sectionHeader(title: "Recently Used", icon: "clock")

                    LazyVGrid(columns: gridColumns, spacing: 16) {
                        ForEach(templateManager.recentTemplates.prefix(4), id: \.id) { template in
                            TemplateCard(
                                template: template,
                                isFavorite: templateManager.isFavorite(template.id),
                                onTap: {
                                    showingPreview = template
                                },
                                onQuickUse: {
                                    onCreateFromTemplate(template.id)
                                },
                                onToggleFavorite: {
                                    templateManager.toggleFavorite(template.id)
                                }
                            )
                        }
                    }
                }
            }
        }
    }

    private var favoriteTemplatesSection: some View {
        Group {
            if !templateManager.favoriteTemplates.isEmpty {
                VStack(alignment: .leading, spacing: 12) {
                    sectionHeader(title: "Favorites", icon: "heart.fill")

                    LazyVGrid(columns: gridColumns, spacing: 16) {
                        ForEach(templateManager.favoriteTemplates, id: \.id) { template in
                            TemplateCard(
                                template: template,
                                isFavorite: true,
                                onTap: {
                                    showingPreview = template
                                },
                                onQuickUse: {
                                    onCreateFromTemplate(template.id)
                                },
                                onToggleFavorite: {
                                    templateManager.toggleFavorite(template.id)
                                }
                            )
                        }
                    }
                }
            }
        }
    }

    private var templatesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader(
                title: selectedCategory?.displayName ?? "All Templates",
                icon: selectedCategory?.icon ?? "square.grid.2x2"
            )

            LazyVGrid(columns: gridColumns, spacing: 16) {
                ForEach(filteredTemplates, id: \.id) { template in
                    TemplateCard(
                        template: template,
                        isFavorite: templateManager.isFavorite(template.id),
                        onTap: {
                            showingPreview = template
                        },
                        onQuickUse: {
                            onCreateFromTemplate(template.id)
                        },
                        onToggleFavorite: {
                            templateManager.toggleFavorite(template.id)
                        }
                    )
                }
            }

            if filteredTemplates.isEmpty {
                emptyStateView
            }
        }
    }

    // MARK: - Helper Views

    private func sectionHeader(title: String, icon: String) -> some View {
        HStack {
            Label(title, systemImage: icon)
                .font(.headline)
                .fontWeight(.semibold)

            Spacer()
        }
        .padding(.horizontal, 4)
    }

    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 48))
                .foregroundStyle(.tertiary)

            VStack(spacing: 8) {
                Text("No Templates Found")
                    .font(.headline)
                    .foregroundStyle(.secondary)

                Text("Try adjusting your search or filter criteria.")
                    .font(.body)
                    .foregroundStyle(.tertiary)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(.vertical, 32)
        .frame(maxWidth: .infinity)
    }

    // MARK: - Template Form

    private var templateCreationForm: some View {
        NavigationView {
            TemplateForm { template in
                Task {
                    try? await templateManager.saveCustomTemplate(template)
                }
                showingTemplateForm = false
            }
        }
        .presentationDetents([.large])
    }

    // MARK: - Computed Properties

    private var gridColumns: [GridItem] {
        [
            GridItem(.flexible(minimum: 150, maximum: 300)),
            GridItem(.flexible(minimum: 150, maximum: 300))
        ]
    }

    private var filteredTemplates: [NotebookTemplate] {
        var templates = templateManager.templates

        // Filter by category
        if let category = selectedCategory {
            templates = templates.filter { $0.category == category }
        }

        // Filter by search text
        if !searchText.isEmpty {
            templates = templates.filter { template in
                template.title.localizedCaseInsensitiveContains(searchText) ||
                template.description.localizedCaseInsensitiveContains(searchText) ||
                template.tags.joined(separator: " ").localizedCaseInsensitiveContains(searchText)
            }
        }

        // Sort by usage count and name
        return templates.sorted { lhs, rhs in
            if lhs.usageCount != rhs.usageCount {
                return lhs.usageCount > rhs.usageCount
            }
            return lhs.title < rhs.title
        }
    }
}

// MARK: - Category Filter Button

private struct CategoryFilterButton: View {
    let title: String
    let icon: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.caption)

                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(isSelected ? Color.accentColor : Color.secondary.opacity(0.2))
            .foregroundStyle(isSelected ? .white : .primary)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Template Preview Sheet

private struct TemplatePreview: View {
    let template: NotebookTemplate
    let onUse: () -> Void
    let onFavorite: () -> Void
    let onDuplicate: (String) -> Void
    let onDelete: (() -> Void)?
    let isFavorite: Bool

    @State private var showingDuplicateAlert = false
    @State private var duplicateName = ""
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Template header
                    templateHeader

                    Divider()

                    // Template content preview
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Content Preview")
                            .font(.headline)
                            .fontWeight(.semibold)

                        Text(template.markdownContent)
                            .font(.system(.body, design: .monospaced))
                            .padding()
                            .background(.background.secondary)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }

                    // Template metadata
                    if !template.properties.isEmpty {
                        Divider()

                        VStack(alignment: .leading, spacing: 12) {
                            Text("Default Properties")
                                .font(.headline)
                                .fontWeight(.semibold)

                            ForEach(Array(template.properties.keys.sorted()), id: \.self) { key in
                                HStack {
                                    Text(key)
                                        .fontWeight(.medium)
                                        .foregroundStyle(.secondary)

                                    Spacer()

                                    Text(template.properties[key] ?? "")
                                        .foregroundStyle(.primary)
                                }
                            }
                        }
                    }
                }
                .padding()
            }
            .navigationTitle(template.title)
            #if canImport(UIKit)
.navigationBarTitleDisplayMode(.large)
#endif
            .toolbar {
                #if canImport(UIKit)
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        Button {
                            onFavorite()
                        } label: {
                            Label(isFavorite ? "Remove from Favorites" : "Add to Favorites",
                                  systemImage: isFavorite ? "heart.slash" : "heart")
                        }

                        Button {
                            duplicateName = "\(template.title) Copy"
                            showingDuplicateAlert = true
                        } label: {
                            Label("Duplicate", systemImage: "doc.on.doc")
                        }

                        if let onDelete = onDelete {
                            Divider()

                            Button(role: .destructive) {
                                onDelete()
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
                #else
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button {
                            onFavorite()
                        } label: {
                            Label(isFavorite ? "Remove from Favorites" : "Add to Favorites",
                                  systemImage: isFavorite ? "heart.slash" : "heart")
                        }

                        Button {
                            duplicateName = "\(template.title) Copy"
                            showingDuplicateAlert = true
                        } label: {
                            Label("Duplicate", systemImage: "doc.on.doc")
                        }

                        if let onDelete = onDelete {
                            Divider()

                            Button(role: .destructive) {
                                onDelete()
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
                #endif
            }
            .safeAreaInset(edge: .bottom) {
                Button {
                    onUse()
                } label: {
                    Text("Use Template")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.accentColor)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .padding(.horizontal)
                }
            }
        }
        .alert("Duplicate Template", isPresented: $showingDuplicateAlert) {
            TextField("Name", text: $duplicateName)
            Button("Cancel", role: .cancel) { }
            Button("Duplicate") {
                onDuplicate(duplicateName)
            }
            .disabled(duplicateName.trimmingCharacters(in: .whitespaces).isEmpty)
        } message: {
            Text("Enter a name for the duplicated template.")
        }
    }

    private var templateHeader: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                CategoryBadge(category: template.category)

                if template.isBuiltIn {
                    Text("Built-in")
                        .font(.caption)
                        .fontWeight(.medium)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.accentColor.opacity(0.1))
                        .foregroundStyle(Color.accentColor)
                        .clipShape(Capsule())
                }

                Spacer()

                if template.usageCount > 0 {
                    Text("\(template.usageCount) uses")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Text(template.description)
                .font(.body)
                .foregroundStyle(.secondary)

            if !template.tags.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(template.tags, id: \.self) { tag in
                            Text(tag)
                                .font(.caption)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(.secondary.opacity(0.1))
                                .foregroundStyle(.secondary)
                                .clipShape(Capsule())
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Template Form

private struct TemplateForm: View {
    let onSave: (NotebookTemplate) -> Void

    @State private var title = ""
    @State private var description = ""
    @State private var category: TemplateCategory = .general
    @State private var content = ""
    @State private var tags = ""

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Form {
            Section {
                TextField("Template Title", text: $title)
                TextField("Description", text: $description)
                Picker("Category", selection: $category) {
                    ForEach(TemplateCategory.allCases, id: \.self) { category in
                        Label(category.displayName, systemImage: category.icon)
                            .tag(category)
                    }
                }
                TextField("Tags (comma separated)", text: $tags)
            } header: {
                Text("Template Information")
            }

            Section {
                TextEditor(text: $content)
                    .font(.system(.body, design: .monospaced))
                    .frame(minHeight: 200)
            } header: {
                Text("Template Content")
            } footer: {
                Text("Use {{placeholder}} for dynamic values like {{date}}, {{time}}, {{username}}.")
            }
        }
        .navigationTitle("New Template")
        #if canImport(UIKit)
.navigationBarTitleDisplayMode(.inline)
#endif
        .toolbar {
            #if canImport(UIKit)
            ToolbarItem(placement: .navigationBarLeading) {
                Button("Cancel") {
                    dismiss()
                }
            }

            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Save") {
                    let template = NotebookTemplate(
                        title: title,
                        description: description,
                        category: category,
                        markdownContent: content,
                        tags: tags.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
                    )
                    onSave(template)
                }
                .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty ||
                         content.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            #else
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") {
                    dismiss()
                }
            }

            ToolbarItem(placement: .primaryAction) {
                Button("Save") {
                    let template = NotebookTemplate(
                        title: title,
                        description: description,
                        category: category,
                        markdownContent: content,
                        tags: tags.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
                    )
                    onSave(template)
                }
                .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty ||
                         content.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            #endif
        }
    }
}

// MARK: - Category Badge

private struct CategoryBadge: View {
    let category: TemplateCategory

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: category.icon)
                .font(.caption2)

            Text(category.displayName)
                .font(.caption)
                .fontWeight(.medium)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(categoryColor.opacity(0.1))
        .foregroundStyle(categoryColor)
        .clipShape(Capsule())
    }

    private var categoryColor: Color {
        switch category.color {
        case "blue": return .blue
        case "green": return .green
        case "purple": return .purple
        case "orange": return .orange
        default: return .gray
        }
    }
}

// MARK: - Preview

#Preview {
    let templateManager = TemplateManager()
    return TemplateGallery(templateManager: templateManager) { templateId in
        print("Creating card from template: \(templateId)")
    }
}