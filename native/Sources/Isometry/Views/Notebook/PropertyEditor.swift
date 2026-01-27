import SwiftUI
import Foundation

/// Main property editing interface with form layout and operations
public struct PropertyEditor: View {
    @ObservedObject var propertyModel: NotebookPropertyModel

    @State private var searchText = ""
    @State private var showingAddProperty = false
    @State private var newPropertyName = ""
    @State private var newPropertyType: PropertyType = .text
    @State private var showingDeleteConfirmation: String? = nil

    public init(propertyModel: NotebookPropertyModel) {
        self.propertyModel = propertyModel
    }

    public var body: some View {
        VStack(spacing: 0) {
            // Header
            propertyHeaderView

            // Search and filter
            if !propertyModel.properties.isEmpty {
                searchBarView
                    .padding(.horizontal, 16)
                    .padding(.bottom, 8)
            }

            // Property list
            ScrollView {
                LazyVStack(spacing: 12) {
                    if filteredProperties.isEmpty {
                        emptyStateView
                    } else {
                        ForEach(Array(filteredProperties), id: \.key) { key, value in
                            propertyRow(key: key, value: value)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
            }
            .animation(.default, value: filteredProperties.count)
        }
        .background(.background.secondary)
        .sheet(isPresented: $showingAddProperty) {
            addPropertySheet
        }
        .alert("Delete Property", isPresented: Binding(
            get: { showingDeleteConfirmation != nil },
            set: { _ in showingDeleteConfirmation = nil }
        )) {
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                if let key = showingDeleteConfirmation {
                    propertyModel.removeProperty(key: key)
                }
            }
        } message: {
            if let key = showingDeleteConfirmation {
                Text("Are you sure you want to delete the '\(propertyModel.definitions[key]?.name ?? key)' property?")
            }
        }
    }

    // MARK: - Header

    private var propertyHeaderView: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Properties")
                    .font(.headline)
                    .fontWeight(.semibold)

                HStack(spacing: 4) {
                    Text("\(propertyModel.propertyCount)")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundStyle(.primary)

                    Text("properties")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    if !propertyModel.validationErrors.isEmpty {
                        Divider()
                            .frame(height: 12)

                        Text("\(propertyModel.validationErrors.count)")
                            .font(.caption)
                            .fontWeight(.medium)
                            .foregroundStyle(.red)

                        Text("errors")
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                }
            }

            Spacer()

            HStack(spacing: 8) {
                // Save status
                if propertyModel.isSaving {
                    HStack(spacing: 4) {
                        ProgressView()
                            .scaleEffect(0.7)
                        Text("Saving...")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                } else if propertyModel.isDirty {
                    HStack(spacing: 4) {
                        Circle()
                            .fill(.orange)
                            .frame(width: 6, height: 6)
                        Text("Unsaved")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }
                } else {
                    HStack(spacing: 4) {
                        Circle()
                            .fill(.green)
                            .frame(width: 6, height: 6)
                        Text("Saved")
                            .font(.caption)
                            .foregroundStyle(.green)
                    }
                }

                // Add property button
                Button {
                    showingAddProperty = true
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.title3)
                        .foregroundStyle(.accent)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 8)
    }

    // MARK: - Search Bar

    private var searchBarView: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .font(.caption)
                .foregroundStyle(.secondary)

            TextField("Search properties...", text: $searchText)
                .textFieldStyle(.plain)

            if !searchText.isEmpty {
                Button {
                    searchText = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    // MARK: - Property Row

    private func propertyRow(key: String, value: PropertyValue) -> some View {
        PropertyField(
            key: key,
            definition: propertyModel.definitions[key] ?? PropertyDefinition(name: key, type: value.type),
            value: Binding(
                get: { value },
                set: { propertyModel.updateProperty(key: key, value: $0) }
            ),
            onRemove: isCustomProperty(key: key) ? {
                showingDeleteConfirmation = key
            } : nil,
            error: propertyModel.validationErrors[key],
            isCustomProperty: isCustomProperty(key: key)
        )
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "slider.horizontal.3")
                .font(.system(size: 48))
                .foregroundStyle(.tertiary)

            VStack(spacing: 8) {
                Text("No Properties")
                    .font(.headline)
                    .foregroundStyle(.secondary)

                Text("Add properties to organize and track information about this card.")
                    .font(.body)
                    .foregroundStyle(.tertiary)
                    .multilineTextAlignment(.center)
            }

            Button {
                showingAddProperty = true
            } label: {
                Label("Add Property", systemImage: "plus")
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(.vertical, 32)
        .frame(maxWidth: .infinity)
    }

    // MARK: - Add Property Sheet

    private var addPropertySheet: some View {
        NavigationView {
            Form {
                Section {
                    TextField("Property Name", text: $newPropertyName)
                        .autocapitalization(.words)

                    Picker("Type", selection: $newPropertyType) {
                        ForEach(PropertyType.allCases, id: \.self) { type in
                            Label(type.displayName, systemImage: type.icon)
                                .tag(type)
                        }
                    }
                } header: {
                    Text("Property Details")
                } footer: {
                    Text("Choose a descriptive name and select the appropriate data type for your property.")
                }

                Section {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Built-in Templates")
                            .font(.headline)

                        LazyVGrid(columns: [
                            GridItem(.flexible()),
                            GridItem(.flexible())
                        ], spacing: 12) {
                            ForEach(Array(NotebookPropertyModel.builtInDefinitions), id: \.key) { key, definition in
                                if !propertyModel.definitions.keys.contains(key) {
                                    builtInPropertyButton(key: key, definition: definition)
                                }
                            }
                        }
                    }
                } header: {
                    Text("Quick Add")
                } footer: {
                    Text("Add common properties with predefined settings.")
                }
            }
            .navigationTitle("Add Property")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        showingAddProperty = false
                        resetAddPropertyForm()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Add") {
                        addCustomProperty()
                    }
                    .disabled(newPropertyName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func builtInPropertyButton(key: String, definition: PropertyDefinition) -> some View {
        Button {
            propertyModel.addProperty(key: key, definition: definition)
            showingAddProperty = false
        } label: {
            VStack(spacing: 8) {
                Image(systemName: definition.type.icon)
                    .font(.title2)
                    .foregroundStyle(.accent)

                VStack(spacing: 2) {
                    Text(definition.name)
                        .font(.caption)
                        .fontWeight(.medium)
                        .multilineTextAlignment(.center)

                    Text(definition.type.displayName)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(.background.secondary)
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Helper Methods

    private var filteredProperties: [(key: String, value: PropertyValue)] {
        let allProperties = Array(propertyModel.properties)

        if searchText.isEmpty {
            return allProperties.sorted { first, second in
                let firstName = propertyModel.definitions[first.key]?.name ?? first.key
                let secondName = propertyModel.definitions[second.key]?.name ?? second.key
                return firstName.localizedCaseInsensitiveCompare(secondName) == .orderedAscending
            }
        } else {
            return allProperties.filter { key, _ in
                let propertyName = propertyModel.definitions[key]?.name ?? key
                return propertyName.localizedCaseInsensitiveContains(searchText)
            }.sorted { first, second in
                let firstName = propertyModel.definitions[first.key]?.name ?? first.key
                let secondName = propertyModel.definitions[second.key]?.name ?? second.key
                return firstName.localizedCaseInsensitiveCompare(secondName) == .orderedAscending
            }
        }
    }

    private func isCustomProperty(key: String) -> Bool {
        return !NotebookPropertyModel.builtInDefinitions.keys.contains(key)
    }

    private func addCustomProperty() {
        let trimmedName = newPropertyName.trimmingCharacters(in: .whitespaces)
        guard !trimmedName.isEmpty else { return }

        let key = trimmedName.lowercased().replacingOccurrences(of: " ", with: "_")

        // Avoid duplicate keys
        var finalKey = key
        var counter = 1
        while propertyModel.definitions.keys.contains(finalKey) {
            finalKey = "\(key)_\(counter)"
            counter += 1
        }

        let definition = PropertyDefinition(
            name: trimmedName,
            type: newPropertyType
        )

        propertyModel.addProperty(key: finalKey, definition: definition)
        showingAddProperty = false
        resetAddPropertyForm()
    }

    private func resetAddPropertyForm() {
        newPropertyName = ""
        newPropertyType = .text
    }
}

// MARK: - Preview

#Preview {
    let propertyModel = NotebookPropertyModel(database: IsometryDatabase.placeholder)

    // Add some sample properties
    propertyModel.definitions["title"] = PropertyDefinition(name: "Title", type: .text)
    propertyModel.definitions["priority"] = PropertyDefinition(name: "Priority", type: .select, options: ["Low", "Medium", "High"])
    propertyModel.definitions["tags"] = PropertyDefinition(name: "Tags", type: .tags)

    propertyModel.properties["title"] = .text("Sample Card")
    propertyModel.properties["priority"] = .select("High")
    propertyModel.properties["tags"] = .tags(["swift", "ui"])

    return PropertyEditor(propertyModel: propertyModel)
        .frame(height: 500)
        .background(.background)
}