import SwiftUI
import Foundation

/// Generic property field component with type-specific rendering
public struct PropertyField: View {
    let key: String
    let definition: PropertyDefinition
    @Binding var value: PropertyValue
    let onRemove: (() -> Void)?
    let error: String?
    let isCustomProperty: Bool

    @FocusState private var isFocused: Bool

    public init(
        key: String,
        definition: PropertyDefinition,
        value: Binding<PropertyValue>,
        onRemove: (() -> Void)? = nil,
        error: String? = nil,
        isCustomProperty: Bool = false
    ) {
        self.key = key
        self.definition = definition
        self._value = value
        self.onRemove = onRemove
        self.error = error
        self.isCustomProperty = isCustomProperty
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Field header
            HStack {
                Label {
                    Text(definition.name)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundStyle(.primary)
                } icon: {
                    Image(systemName: definition.type.icon)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if definition.required {
                    Text("*")
                        .font(.caption)
                        .foregroundStyle(.red)
                }

                Spacer()

                if isCustomProperty, let onRemove = onRemove {
                    Button {
                        onRemove()
                    } label: {
                        Image(systemName: "minus.circle.fill")
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                    .buttonStyle(.plain)
                }
            }

            // Field content
            fieldContent

            // Error message
            if let error = error {
                Label {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                } icon: {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }

            // Description
            if let description = definition.description {
                Text(description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background {
            RoundedRectangle(cornerRadius: 6)
                .fill(isFocused ? Color.gray.opacity(0.2) : Color.gray.opacity(0.1))
                .stroke(borderColor, lineWidth: 1)
        }
    }

    private var borderColor: Color {
        if error != nil {
            return .red
        } else if isFocused {
            return Color.blue
        } else {
            return Color.gray
        }
    }

    @ViewBuilder
    private var fieldContent: some View {
        switch definition.type {
        case .text:
            TextPropertyField(value: $value, definition: definition)
                .focused($isFocused)
        case .number:
            NumberPropertyField(value: $value, definition: definition)
                .focused($isFocused)
        case .date:
            DatePropertyField(value: $value, definition: definition)
                .focused($isFocused)
        case .boolean:
            BooleanPropertyField(value: $value, definition: definition)
        case .select:
            SelectPropertyField(value: $value, definition: definition)
                .focused($isFocused)
        case .tags:
            TagsPropertyField(value: $value, definition: definition)
                .focused($isFocused)
        case .reference:
            ReferencePropertyField(value: $value, definition: definition)
                .focused($isFocused)
        }
    }
}

// MARK: - Text Property Field

private struct TextPropertyField: View {
    @Binding var value: PropertyValue
    let definition: PropertyDefinition

    private var textValue: String {
        if case .text(let text) = value {
            return text
        }
        return ""
    }

    var body: some View {
        TextField(definition.placeholder ?? "Enter text...", text: Binding(
            get: { textValue },
            set: { value = .text($0) }
        ))
        .textFieldStyle(.roundedBorder)
    }
}

// MARK: - Number Property Field

private struct NumberPropertyField: View {
    @Binding var value: PropertyValue
    let definition: PropertyDefinition

    @State private var textInput: String = ""

    private var numberValue: Double {
        if case .number(let number) = value {
            return number
        }
        return 0
    }

    var body: some View {
        TextField(definition.placeholder ?? "Enter number...", text: $textInput)
            .textFieldStyle(.roundedBorder)
            #if os(iOS)
            .keyboardType(.decimalPad)
            #endif
            .onAppear {
                textInput = String(numberValue)
            }
            .onChange(of: textInput) { oldValue, newValue in
                if let number = Double(newValue) {
                    value = .number(number)
                }
            }
            .onChange(of: numberValue) { oldValue, newValue in
                textInput = String(newValue)
            }
    }
}

// MARK: - Date Property Field

private struct DatePropertyField: View {
    @Binding var value: PropertyValue
    let definition: PropertyDefinition

    private var dateValue: Date {
        if case .date(let date) = value {
            return date
        }
        return Date()
    }

    var body: some View {
        DatePicker("", selection: Binding(
            get: { dateValue },
            set: { value = .date($0) }
        ), displayedComponents: [.date])
        .datePickerStyle(.compact)
        .labelsHidden()
    }
}

// MARK: - Boolean Property Field

private struct BooleanPropertyField: View {
    @Binding var value: PropertyValue
    let definition: PropertyDefinition

    private var boolValue: Bool {
        if case .boolean(let bool) = value {
            return bool
        }
        return false
    }

    var body: some View {
        Toggle(isOn: Binding(
            get: { boolValue },
            set: { value = .boolean($0) }
        )) {
            EmptyView()
        }
        .labelsHidden()
    }
}

// MARK: - Select Property Field

private struct SelectPropertyField: View {
    @Binding var value: PropertyValue
    let definition: PropertyDefinition

    private var selectedValue: String {
        if case .select(let selected) = value {
            return selected
        }
        return definition.options?.first ?? ""
    }

    var body: some View {
        if let options = definition.options {
            Picker("", selection: Binding(
                get: { selectedValue },
                set: { value = .select($0) }
            )) {
                ForEach(options, id: \.self) { option in
                    Text(option).tag(option)
                }
            }
            .pickerStyle(.menu)
            .labelsHidden()
        } else {
            Text("No options available")
                .foregroundStyle(.secondary)
                .font(.caption)
        }
    }
}

// MARK: - Tags Property Field

private struct TagsPropertyField: View {
    @Binding var value: PropertyValue
    let definition: PropertyDefinition

    @State private var newTag = ""

    private var tags: [String] {
        if case .tags(let tagList) = value {
            return tagList
        }
        return []
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Display existing tags
            if !tags.isEmpty {
                FlowLayout(spacing: 6) {
                    ForEach(tags, id: \.self) { tag in
                        TagChip(text: tag) {
                            removeTag(tag)
                        }
                    }
                }
            }

            // Add new tag field
            HStack {
                TextField("Add tag...", text: $newTag)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit {
                        addTag()
                    }

                Button("Add") {
                    addTag()
                }
                .disabled(newTag.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
    }

    private func addTag() {
        let trimmedTag = newTag.trimmingCharacters(in: .whitespaces)
        guard !trimmedTag.isEmpty, !tags.contains(trimmedTag) else { return }

        var newTags = tags
        newTags.append(trimmedTag)
        value = .tags(newTags)
        newTag = ""
    }

    private func removeTag(_ tag: String) {
        var newTags = tags
        newTags.removeAll { $0 == tag }
        value = .tags(newTags)
    }
}

// MARK: - Reference Property Field

private struct ReferencePropertyField: View {
    @Binding var value: PropertyValue
    let definition: PropertyDefinition

    @State private var newReference = ""

    private var references: [String] {
        if case .reference(let refs) = value {
            return refs
        }
        return []
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Display existing references
            if !references.isEmpty {
                FlowLayout(spacing: 6) {
                    ForEach(references, id: \.self) { ref in
                        ReferenceChip(nodeId: ref) {
                            removeReference(ref)
                        }
                    }
                }
            }

            // Add new reference field
            HStack {
                TextField("Node ID...", text: $newReference)
                    .textFieldStyle(.roundedBorder)
                    .font(.system(.body, design: .monospaced))
                    .onSubmit {
                        addReference()
                    }

                Button {
                    // TODO: Open node picker/browser
                } label: {
                    Image(systemName: "magnifyingglass")
                        .font(.caption)
                }
                .disabled(true) // TODO: Implement node picker

                Button("Add") {
                    addReference()
                }
                .disabled(newReference.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
    }

    private func addReference() {
        let trimmed = newReference.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, !references.contains(trimmed) else { return }

        // Validate UUID format
        guard UUID(uuidString: trimmed) != nil else { return }

        var newReferences = references
        newReferences.append(trimmed)
        value = .reference(newReferences)
        newReference = ""
    }

    private func removeReference(_ ref: String) {
        var newReferences = references
        newReferences.removeAll { $0 == ref }
        value = .reference(newReferences)
    }
}

// MARK: - Supporting Views

private struct TagChip: View {
    let text: String
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 4) {
            Text(text)
                .font(.caption)
                .lineLimit(1)

            Button {
                onRemove()
            } label: {
                Image(systemName: "xmark")
                    .font(.caption2)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color.blue.opacity(0.1))
        .foregroundStyle(Color.blue)
        .clipShape(Capsule())
    }
}

private struct ReferenceChip: View {
    let nodeId: String
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "link")
                .font(.caption2)

            Text(nodeId.prefix(8) + "...")
                .font(.caption)
                .fontDesign(.monospaced)
                .lineLimit(1)

            Button {
                onRemove()
            } label: {
                Image(systemName: "xmark")
                    .font(.caption2)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(.secondary.opacity(0.1))
        .foregroundStyle(.secondary)
        .clipShape(Capsule())
    }
}

private struct FlowLayout: Layout {
    let spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = FlowResult(
            in: proposal.replacingUnspecifiedDimensions().width,
            subviews: subviews,
            spacing: spacing
        )
        return CGSize(width: proposal.width ?? result.bounds.width, height: result.bounds.height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = FlowResult(
            in: bounds.width,
            subviews: subviews,
            spacing: spacing
        )

        for (index, subview) in subviews.enumerated() {
            let position = result.positions[index]
            subview.place(
                at: CGPoint(x: bounds.minX + position.x, y: bounds.minY + position.y),
                proposal: ProposedViewSize(result.sizes[index])
            )
        }
    }
}

private struct FlowResult {
    let bounds: CGSize
    let positions: [CGPoint]
    let sizes: [CGSize]

    init(in maxWidth: CGFloat, subviews: LayoutSubviews, spacing: CGFloat) {
        var positions: [CGPoint] = []
        var sizes: [CGSize] = []
        var currentPosition = CGPoint.zero
        var lineHeight: CGFloat = 0
        var maxX: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            sizes.append(size)

            if currentPosition.x + size.width > maxWidth && currentPosition.x > 0 {
                // Move to next line
                currentPosition.x = 0
                currentPosition.y += lineHeight + spacing
                lineHeight = 0
            }

            positions.append(currentPosition)
            currentPosition.x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
            maxX = max(maxX, currentPosition.x - spacing)
        }

        self.positions = positions
        self.sizes = sizes
        self.bounds = CGSize(width: maxX, height: currentPosition.y + lineHeight)
    }
}

// MARK: - Preview

#Preview {
    ScrollView {
        VStack(spacing: 16) {
            PropertyField(
                key: "title",
                definition: PropertyDefinition(name: "Title", type: .text, placeholder: "Enter title"),
                value: .constant(.text("Sample Title"))
            )

            PropertyField(
                key: "priority",
                definition: PropertyDefinition(
                    name: "Priority",
                    type: .select,
                    options: ["Low", "Medium", "High"],
                    description: "Task priority level"
                ),
                value: .constant(.select("Medium"))
            )

            PropertyField(
                key: "tags",
                definition: PropertyDefinition(name: "Tags", type: .tags),
                value: .constant(.tags(["swift", "ui", "demo"]))
            )

            PropertyField(
                key: "completed",
                definition: PropertyDefinition(name: "Completed", type: .boolean),
                value: .constant(.boolean(false))
            )

            PropertyField(
                key: "due_date",
                definition: PropertyDefinition(name: "Due Date", type: .date),
                value: .constant(.date(Date())),
                error: "Date is required"
            )

            PropertyField(
                key: "references",
                definition: PropertyDefinition(
                    name: "Related Nodes",
                    type: .reference,
                    placeholder: "Link to other nodes...",
                    description: "References to related Isometry nodes"
                ),
                value: .constant(.reference(["12345678-1234-1234-1234-123456789012"]))
            )
        }
        .padding()
    }
}