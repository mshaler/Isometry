import SwiftUI

/// Template card component for gallery display with preview and actions
public struct TemplateCard: View {
    let template: NotebookTemplate
    let isFavorite: Bool
    let onTap: () -> Void
    let onQuickUse: () -> Void
    let onToggleFavorite: () -> Void

    @State private var isPressed = false

    public init(
        template: NotebookTemplate,
        isFavorite: Bool,
        onTap: @escaping () -> Void,
        onQuickUse: @escaping () -> Void,
        onToggleFavorite: @escaping () -> Void
    ) {
        self.template = template
        self.isFavorite = isFavorite
        self.onTap = onTap
        self.onQuickUse = onQuickUse
        self.onToggleFavorite = onToggleFavorite
    }

    public var body: some View {
        VStack(spacing: 0) {
            // Main card content
            cardContent
                .onTapGesture {
                    onTap()
                }

            // Action bar
            actionBar
        }
        .background(cardBackgroundColor)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(
            color: .black.opacity(0.1),
            radius: isPressed ? 2 : 4,
            x: 0,
            y: isPressed ? 1 : 2
        )
        .scaleEffect(isPressed ? 0.98 : 1.0)
        .animation(.easeInOut(duration: 0.1), value: isPressed)
        .onLongPressGesture(
            minimumDuration: 0,
            maximumDistance: .infinity,
            pressing: { pressing in
                isPressed = pressing
            },
            perform: {
                onTap()
            }
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(template.title) template")
        .accessibilityHint("Double tap to preview, or use quick actions")
        .accessibilityAddTraits(.isButton)
    }

    // MARK: - Card Content

    private var cardContent: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header with category and favorite
            headerSection

            // Title and description
            contentSection

            // Preview snippet
            previewSection

            // Footer with metadata
            footerSection
        }
        .padding(16)
    }

    private var headerSection: some View {
        HStack {
            CategoryBadge(category: template.category)

            Spacer()

            // Status indicators
            HStack(spacing: 6) {
                if template.isBuiltIn {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.caption)
                        .foregroundStyle(Color.accentColor)
                        .accessibilityLabel("Built-in template")
                }

                Button {
                    onToggleFavorite()
                } label: {
                    Image(systemName: isFavorite ? "heart.fill" : "heart")
                        .font(.caption)
                        .foregroundStyle(isFavorite ? .red : .secondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(isFavorite ? "Remove from favorites" : "Add to favorites")
            }
        }
    }

    private var contentSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(template.title)
                .font(.headline)
                .fontWeight(.semibold)
                .lineLimit(2)
                .multilineTextAlignment(.leading)

            Text(template.description)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(3)
                .multilineTextAlignment(.leading)
        }
    }

    private var previewSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Content preview
            Text(contentPreview)
                .font(.caption)
                .foregroundStyle(.tertiary)
                .lineLimit(4)
                .multilineTextAlignment(.leading)
                .padding(8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.background.secondary)
                .clipShape(RoundedRectangle(cornerRadius: 6))

            // Tags
            if !template.tags.isEmpty {
                tagsView
            }
        }
    }

    private var footerSection: some View {
        HStack {
            // Usage count
            if template.usageCount > 0 {
                HStack(spacing: 4) {
                    Image(systemName: "chart.bar")
                        .font(.caption2)

                    Text("\(template.usageCount)")
                        .font(.caption)
                        .fontWeight(.medium)
                }
                .foregroundStyle(.secondary)
            }

            Spacer()

            // Creation date
            Text(formatDate(template.createdAt))
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
    }

    // MARK: - Action Bar

    private var actionBar: some View {
        HStack(spacing: 0) {
            Button {
                onQuickUse()
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "plus.circle.fill")
                        .font(.subheadline)

                    Text("Use")
                        .font(.subheadline)
                        .fontWeight(.medium)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Color.accentColor)
                .foregroundStyle(.white)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Create card from template")

            Button {
                onTap()
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "eye")
                        .font(.subheadline)

                    Text("Preview")
                        .font(.subheadline)
                        .fontWeight(.medium)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(.background.secondary)
                .foregroundStyle(.primary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Preview template")
        }
        .clipShape(
            .rect(
                topLeadingRadius: 0,
                bottomLeadingRadius: 12,
                bottomTrailingRadius: 12,
                topTrailingRadius: 0
            )
        )
    }

    // MARK: - Supporting Views

    private var tagsView: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(Array(template.tags.prefix(3)), id: \.self) { tag in
                    Text(tag)
                        .font(.caption2)
                        .fontWeight(.medium)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(.secondary.opacity(0.1))
                        .foregroundStyle(.secondary)
                        .clipShape(Capsule())
                }

                if template.tags.count > 3 {
                    Text("+\(template.tags.count - 3)")
                        .font(.caption2)
                        .fontWeight(.medium)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(.secondary.opacity(0.1))
                        .foregroundStyle(.secondary)
                        .clipShape(Capsule())
                }
            }
        }
    }

    // MARK: - Computed Properties

    private var cardBackgroundColor: Color {
        #if os(macOS)
        Color(NSColor.controlBackgroundColor)
        #else
        Color(UIColor.systemBackground)
        #endif
    }

    private var contentPreview: String {
        let content = template.markdownContent
            .replacingOccurrences(of: "{{date}}", with: "Today")
            .replacingOccurrences(of: "{{time}}", with: "Now")
            .replacingOccurrences(of: "{{username}}", with: "User")

        // Remove markdown formatting for preview
        let cleaned = content
            .replacingOccurrences(of: "^#{1,6}\\s+", with: "", options: .regularExpression)
            .replacingOccurrences(of: "\\*\\*([^*]+)\\*\\*", with: "$1", options: .regularExpression)
            .replacingOccurrences(of: "\\*([^*]+)\\*", with: "$1", options: .regularExpression)
            .replacingOccurrences(of: "`([^`]+)`", with: "$1", options: .regularExpression)
            .replacingOccurrences(of: "\\[([^\\]]+)\\]\\([^)]+\\)", with: "$1", options: .regularExpression)

        // Get first few lines
        let lines = cleaned.components(separatedBy: .newlines)
            .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
            .prefix(4)

        return lines.joined(separator: "\n")
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }
}

// MARK: - Category Badge Component

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
        .accessibilityLabel("\(category.displayName) category")
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

// MARK: - Compact Template Card

/// Simplified template card for use in limited space
public struct CompactTemplateCard: View {
    let template: NotebookTemplate
    let onTap: () -> Void

    public init(template: NotebookTemplate, onTap: @escaping () -> Void) {
        self.template = template
        self.onTap = onTap
    }

    public var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Icon
                Image(systemName: template.category.icon)
                    .font(.title2)
                    .foregroundStyle(categoryColor)
                    .frame(width: 32, height: 32)
                    .background(categoryColor.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 8))

                // Content
                VStack(alignment: .leading, spacing: 4) {
                    Text(template.title)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .lineLimit(1)
                        .multilineTextAlignment(.leading)

                    Text(template.description)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // Usage indicator
                if template.usageCount > 0 {
                    Text("\(template.usageCount)")
                        .font(.caption2)
                        .fontWeight(.medium)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(.secondary.opacity(0.1))
                        .foregroundStyle(.secondary)
                        .clipShape(Capsule())
                }
            }
            .padding(12)
            .background(.background)
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(template.title) template")
        .accessibilityHint("Tap to use template")
    }

    private var categoryColor: Color {
        switch template.category.color {
        case "blue": return .blue
        case "green": return .green
        case "purple": return .purple
        case "orange": return .orange
        default: return .gray
        }
    }
}

// MARK: - Preview

#Preview("Template Card") {
    let sampleTemplate = NotebookTemplate(
        title: "Meeting Notes",
        description: "Structured template for meeting documentation with agenda and action items",
        category: .meeting,
        markdownContent: """
        # Meeting: [Title]

        **Date:** {{date}}
        **Attendees:**
        **Duration:**

        ## Agenda
        - [ ] Item 1
        - [ ] Item 2

        ## Discussion Notes

        ## Action Items
        - [ ] **[Name]** - Task description
        """,
        properties: ["status": "draft", "priority": "medium"],
        isBuiltIn: true,
        usageCount: 12,
        tags: ["meeting", "structured", "agenda"]
    )

    return VStack(spacing: 20) {
        TemplateCard(
            template: sampleTemplate,
            isFavorite: false,
            onTap: { print("Tapped template") },
            onQuickUse: { print("Quick use template") },
            onToggleFavorite: { print("Toggle favorite") }
        )
        .frame(width: 280)

        CompactTemplateCard(
            template: sampleTemplate,
            onTap: { print("Tapped compact template") }
        )
        .frame(width: 300)
    }
    .padding()
    .background(.background.secondary)
}