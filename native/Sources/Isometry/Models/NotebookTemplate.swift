import Foundation

/// Template category for organization and filtering
public enum TemplateCategory: String, CaseIterable, Codable {
    case meeting = "meeting"
    case code = "code"
    case project = "project"
    case research = "research"
    case general = "general"

    public var displayName: String {
        switch self {
        case .meeting: return "Meeting"
        case .code: return "Code"
        case .project: return "Project"
        case .research: return "Research"
        case .general: return "General"
        }
    }

    public var icon: String {
        switch self {
        case .meeting: return "person.3"
        case .code: return "curlybraces"
        case .project: return "folder"
        case .research: return "magnifyingglass"
        case .general: return "doc.text"
        }
    }

    public var color: String {
        switch self {
        case .meeting: return "blue"
        case .code: return "green"
        case .project: return "purple"
        case .research: return "orange"
        case .general: return "gray"
        }
    }
}

/// Template data model with content and metadata
public struct NotebookTemplate: Codable, Identifiable, Hashable {
    public let id: String
    public let title: String
    public let description: String
    public let category: TemplateCategory
    public let markdownContent: String
    public let properties: [String: String]
    public let isBuiltIn: Bool
    public let createdAt: Date
    public let modifiedAt: Date
    public let usageCount: Int
    public let tags: [String]

    public init(
        id: String = UUID().uuidString,
        title: String,
        description: String,
        category: TemplateCategory,
        markdownContent: String,
        properties: [String: String] = [:],
        isBuiltIn: Bool = false,
        createdAt: Date = Date(),
        modifiedAt: Date = Date(),
        usageCount: Int = 0,
        tags: [String] = []
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.category = category
        self.markdownContent = markdownContent
        self.properties = properties
        self.isBuiltIn = isBuiltIn
        self.createdAt = createdAt
        self.modifiedAt = modifiedAt
        self.usageCount = usageCount
        self.tags = tags
    }

    // MARK: - Template Operations

    /// Apply template to create a new notebook card
    public func applyToCard() -> NotebookCard {
        let processedContent = processPlaceholders(in: markdownContent)

        return NotebookCard(
            title: extractTitleFromContent(processedContent),
            markdownContent: processedContent,
            properties: properties,
            templateId: id,
            tags: tags
        )
    }

    /// Create template from existing card
    public static func createFromCard(_ card: NotebookCard, title: String, description: String, category: TemplateCategory) -> NotebookTemplate {
        return NotebookTemplate(
            title: title,
            description: description,
            category: category,
            markdownContent: card.markdownContent ?? "",
            properties: card.properties,
            isBuiltIn: false,
            tags: card.tags
        )
    }

    /// Validate template content and structure
    public func validateTemplate() -> [String] {
        var errors: [String] = []

        if title.trimmingCharacters(in: .whitespaces).isEmpty {
            errors.append("Title is required")
        }

        if description.trimmingCharacters(in: .whitespaces).isEmpty {
            errors.append("Description is required")
        }

        if markdownContent.trimmingCharacters(in: .whitespaces).isEmpty {
            errors.append("Content is required")
        }

        // Validate placeholder syntax
        let placeholderErrors = validatePlaceholders()
        errors.append(contentsOf: placeholderErrors)

        return errors
    }

    /// Extract placeholder tokens from content
    public func extractPlaceholders() -> [String] {
        let pattern = "\\{\\{([^}]+)\\}\\}"
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }

        let range = NSRange(markdownContent.startIndex..., in: markdownContent)
        let matches = regex.matches(in: markdownContent, range: range)

        return matches.compactMap { match in
            guard match.numberOfRanges > 1,
                  let range = Range(match.range(at: 1), in: markdownContent) else { return nil }
            return String(markdownContent[range])
        }.removingDuplicates()
    }

    // MARK: - Private Methods

    private func processPlaceholders(in content: String) -> String {
        var processed = content

        // Auto-replace built-in placeholders
        let now = Date()
        let dateFormatter = DateFormatter()
        dateFormatter.dateStyle = .medium

        let timeFormatter = DateFormatter()
        timeFormatter.timeStyle = .short

        let replacements: [String: String] = [
            "date": dateFormatter.string(from: now),
            "time": timeFormatter.string(from: now),
            "username": NSUserName(),
            "today": dateFormatter.string(from: now)
        ]

        for (placeholder, replacement) in replacements {
            processed = processed.replacingOccurrences(of: "{{\(placeholder)}}", with: replacement)
        }

        return processed
    }

    private func extractTitleFromContent(_ content: String) -> String {
        let lines = content.components(separatedBy: .newlines)

        // Look for first header
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.hasPrefix("#") {
                // Remove leading # and whitespace, handle placeholders
                let title = trimmed.replacingOccurrences(of: "^#+\\s*", with: "", options: .regularExpression)
                if !title.isEmpty && title != "[Title]" && title != "[Name]" {
                    return title
                }
            }
        }

        return "Untitled"
    }

    private func validatePlaceholders() -> [String] {
        var errors: [String] = []

        // Check for malformed placeholders
        let malformedPattern = "\\{[^}]*\\}|\\{\\{[^}]*\\}[^}]|\\{[^}]*\\}\\}"
        if let regex = try? NSRegularExpression(pattern: malformedPattern),
           regex.firstMatch(in: markdownContent, range: NSRange(markdownContent.startIndex..., in: markdownContent)) != nil {
            errors.append("Malformed placeholder syntax detected. Use {{placeholder}} format.")
        }

        // Check for nested placeholders
        let nestedPattern = "\\{\\{[^}]*\\{\\{[^}]*\\}\\}[^}]*\\}\\}"
        if let regex = try? NSRegularExpression(pattern: nestedPattern),
           regex.firstMatch(in: markdownContent, range: NSRange(markdownContent.startIndex..., in: markdownContent)) != nil {
            errors.append("Nested placeholders are not supported.")
        }

        return errors
    }

    // MARK: - Codable

    private enum CodingKeys: String, CodingKey {
        case id, title, description, category, markdownContent, properties
        case isBuiltIn, createdAt, modifiedAt, usageCount, tags
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        id = try container.decode(String.self, forKey: .id)
        title = try container.decode(String.self, forKey: .title)
        description = try container.decode(String.self, forKey: .description)
        category = try container.decode(TemplateCategory.self, forKey: .category)
        markdownContent = try container.decode(String.self, forKey: .markdownContent)
        properties = try container.decodeIfPresent([String: String].self, forKey: .properties) ?? [:]
        isBuiltIn = try container.decodeIfPresent(Bool.self, forKey: .isBuiltIn) ?? false
        usageCount = try container.decodeIfPresent(Int.self, forKey: .usageCount) ?? 0
        tags = try container.decodeIfPresent([String].self, forKey: .tags) ?? []

        // Handle date decoding
        if let createdAtString = try? container.decode(String.self, forKey: .createdAt),
           let date = ISO8601DateFormatter().date(from: createdAtString) {
            createdAt = date
        } else {
            createdAt = Date()
        }

        if let modifiedAtString = try? container.decode(String.self, forKey: .modifiedAt),
           let date = ISO8601DateFormatter().date(from: modifiedAtString) {
            modifiedAt = date
        } else {
            modifiedAt = Date()
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)

        try container.encode(id, forKey: .id)
        try container.encode(title, forKey: .title)
        try container.encode(description, forKey: .description)
        try container.encode(category, forKey: .category)
        try container.encode(markdownContent, forKey: .markdownContent)
        try container.encode(properties, forKey: .properties)
        try container.encode(isBuiltIn, forKey: .isBuiltIn)
        try container.encode(usageCount, forKey: .usageCount)
        try container.encode(tags, forKey: .tags)

        // Encode dates as ISO8601 strings
        try container.encode(ISO8601DateFormatter().string(from: createdAt), forKey: .createdAt)
        try container.encode(ISO8601DateFormatter().string(from: modifiedAt), forKey: .modifiedAt)
    }
}

// MARK: - Helper Extensions

extension Array where Element: Hashable {
    func removingDuplicates() -> [Element] {
        var seen: Set<Element> = []
        return filter { seen.insert($0).inserted }
    }
}