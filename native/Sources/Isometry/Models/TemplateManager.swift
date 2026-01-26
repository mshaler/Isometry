import Foundation
import SwiftUI
import Combine

/// Template management system with built-in templates and custom template storage
@MainActor
public class TemplateManager: ObservableObject {

    // MARK: - Published Properties

    /// All available templates (built-in + custom)
    @Published public var templates: [NotebookTemplate] = []

    /// Built-in templates (read-only)
    @Published public private(set) var builtInTemplates: [NotebookTemplate] = []

    /// User-created custom templates
    @Published public private(set) var customTemplates: [NotebookTemplate] = []

    /// User's favorite template IDs
    @Published public var favoriteTemplateIds: Set<String> = []

    /// Recently used template IDs
    @Published public private(set) var recentTemplateIds: [String] = []

    // MARK: - Private Properties

    private let documentsDirectory: URL
    private let customTemplatesFileName = "custom_templates.json"
    private let favoritesFileName = "favorite_templates.json"
    private let recentsFileName = "recent_templates.json"

    // MARK: - Built-in Template Library

    public static let builtInTemplateLibrary: [NotebookTemplate] = [
        // Meeting Notes Template
        NotebookTemplate(
            id: "meeting-notes",
            title: "Meeting Notes",
            description: "Structured template for meeting documentation",
            category: .meeting,
            markdownContent: """
# Meeting: [Title]

**Date:** {{date}}
**Attendees:**
**Duration:**

## Agenda
- [ ]
- [ ]
- [ ]

## Discussion Notes


## Action Items
- [ ] **[Name]** -
- [ ] **[Name]** -

## Next Steps

""",
            properties: [
                "status": "draft",
                "priority": "medium"
            ],
            isBuiltIn: true,
            tags: ["meeting", "structured"]
        ),

        // Code Snippet Template
        NotebookTemplate(
            id: "code-snippet",
            title: "Code Snippet",
            description: "Template for documenting code examples and solutions",
            category: .code,
            markdownContent: """
# Code: [Title]

## Problem
Describe what this code solves...

## Solution
```swift
// Your code here
func example() -> String {
    return "Hello World"
}
```

## Usage
```swift
// How to use it
let result = example()
print(result)
```

## Notes
- Additional considerations
- Performance implications
- Related patterns

## References
- [Link to docs](https://example.com)
""",
            properties: [
                "status": "complete",
                "priority": "medium",
                "tags": "code,solution"
            ],
            isBuiltIn: true,
            tags: ["code", "programming", "snippet"]
        ),

        // Project Plan Template
        NotebookTemplate(
            id: "project-plan",
            title: "Project Plan",
            description: "Template for project planning and tracking",
            category: .project,
            markdownContent: """
# Project: [Name]

## Overview
Brief description of the project and its goals...

## Objectives
- [ ] Primary objective 1
- [ ] Primary objective 2
- [ ] Primary objective 3

## Timeline
| Phase | Description | Start Date | End Date | Status |
|-------|-------------|------------|----------|--------|
| 1     | Planning    | {{date}}   | TBD      | Not Started |
| 2     | Development | TBD        | TBD      | Not Started |
| 3     | Testing     | TBD        | TBD      | Not Started |
| 4     | Launch      | TBD        | TBD      | Not Started |

## Resources
### Team
- **Project Lead:** [Name]
- **Developer:** [Name]
- **Designer:** [Name]

### Tools & Technologies
- Technology 1
- Technology 2
- Technology 3

## Risks & Mitigation
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Risk 1 | High | Medium | Mitigation strategy |

## Success Metrics
- Metric 1: Target value
- Metric 2: Target value
- Metric 3: Target value

## Notes
Additional project notes...
""",
            properties: [
                "status": "in-progress",
                "priority": "high",
                "assignee": "{{username}}"
            ],
            isBuiltIn: true,
            tags: ["project", "planning", "management"]
        ),

        // Daily Standup Template
        NotebookTemplate(
            id: "daily-standup",
            title: "Daily Standup",
            description: "Quick template for daily standup notes",
            category: .meeting,
            markdownContent: """
# Daily Standup - {{date}}

## Yesterday's Accomplishments
- [ ] Task completed 1
- [ ] Task completed 2

## Today's Goals
- [ ] Task to complete 1
- [ ] Task to complete 2

## Blockers
- None / [Describe blocker]

## Notes
- Additional context
- Team updates
- Upcoming deadlines
""",
            properties: [
                "status": "complete",
                "priority": "low",
                "tags": "standup,daily"
            ],
            isBuiltIn: true,
            tags: ["standup", "meeting", "daily"]
        ),

        // Retrospective Template
        NotebookTemplate(
            id: "retrospective",
            title: "Retrospective",
            description: "Template for team retrospectives and reflection",
            category: .meeting,
            markdownContent: """
# Retrospective - [Period/Sprint Name]

**Date:** {{date}}
**Participants:**
**Facilitator:**

## What Went Well? 💚
- Success 1
- Success 2
- Success 3

## What Could Be Improved? 🔶
- Challenge 1
- Challenge 2
- Challenge 3

## Action Items 🎯
- [ ] **[Owner]** - Action item 1 (Due: TBD)
- [ ] **[Owner]** - Action item 2 (Due: TBD)
- [ ] **[Owner]** - Action item 3 (Due: TBD)

## Insights & Learnings 💡
- Key insight 1
- Key insight 2
- Key insight 3

## Next Sprint Focus
- Priority 1
- Priority 2
- Priority 3
""",
            properties: [
                "status": "complete",
                "priority": "medium",
                "tags": "retrospective,team"
            ],
            isBuiltIn: true,
            tags: ["retrospective", "meeting", "team", "agile"]
        ),

        // Research Notes Template
        NotebookTemplate(
            id: "research-notes",
            title: "Research Notes",
            description: "Template for research documentation and findings",
            category: .research,
            markdownContent: """
# Research: [Topic]

## Research Question
What are you trying to understand or discover?

## Hypothesis
Initial assumptions or predictions...

## Methodology
- Research method 1
- Research method 2
- Research method 3

## Findings
### Key Insights
1. **Finding 1:** Description and implications
2. **Finding 2:** Description and implications
3. **Finding 3:** Description and implications

### Supporting Evidence
- Evidence point 1
- Evidence point 2
- Evidence point 3

## Conclusion
Summary of what was learned...

## Next Steps
- [ ] Follow-up research needed
- [ ] Action items based on findings
- [ ] Areas for deeper investigation

## Sources
- [Source 1](https://example.com)
- [Source 2](https://example.com)
- [Source 3](https://example.com)
""",
            properties: [
                "status": "in-progress",
                "priority": "medium",
                "tags": "research,documentation"
            ],
            isBuiltIn: true,
            tags: ["research", "documentation", "analysis"]
        )
    ]

    // MARK: - Initialization

    public init() {
        self.documentsDirectory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        self.builtInTemplates = Self.builtInTemplateLibrary
        loadPersistedData()
        updateTemplatesList()
    }

    // MARK: - Public Methods

    /// Create a new card from a template
    public func createCard(fromTemplate templateId: String) async throws -> NotebookCard {
        guard let template = templates.first(where: { $0.id == templateId }) else {
            throw TemplateError.templateNotFound
        }

        // Increment usage count for custom templates
        if !template.isBuiltIn {
            await incrementUsage(for: templateId)
        }

        // Add to recent templates
        addToRecents(templateId)

        // Apply template to create card
        return template.applyToCard()
    }

    /// Save a custom template
    public func saveCustomTemplate(_ template: NotebookTemplate) async throws {
        var newTemplate = template
        newTemplate = NotebookTemplate(
            id: newTemplate.id,
            title: newTemplate.title,
            description: newTemplate.description,
            category: newTemplate.category,
            markdownContent: newTemplate.markdownContent,
            properties: newTemplate.properties,
            isBuiltIn: false,
            modifiedAt: Date(),
            usageCount: newTemplate.usageCount,
            tags: newTemplate.tags
        )

        let validationErrors = newTemplate.validateTemplate()
        guard validationErrors.isEmpty else {
            throw TemplateError.validationFailed(errors: validationErrors)
        }

        // Remove existing template with same ID
        customTemplates.removeAll { $0.id == newTemplate.id }

        // Add new template
        customTemplates.append(newTemplate)

        try saveCustomTemplatesToDisk()
        updateTemplatesList()
    }

    /// Delete a custom template
    public func deleteCustomTemplate(id: String) async throws {
        guard let index = customTemplates.firstIndex(where: { $0.id == id }) else {
            throw TemplateError.templateNotFound
        }

        let template = customTemplates[index]
        guard !template.isBuiltIn else {
            throw TemplateError.cannotDeleteBuiltIn
        }

        customTemplates.remove(at: index)
        favoriteTemplateIds.remove(id)
        recentTemplateIds.removeAll { $0 == id }

        try saveCustomTemplatesToDisk()
        savePersistedData()
        updateTemplatesList()
    }

    /// Duplicate a template
    public func duplicateTemplate(id: String, newTitle: String) async throws -> NotebookTemplate {
        guard let original = templates.first(where: { $0.id == id }) else {
            throw TemplateError.templateNotFound
        }

        let duplicated = NotebookTemplate(
            title: newTitle,
            description: "\(original.description) (Copy)",
            category: original.category,
            markdownContent: original.markdownContent,
            properties: original.properties,
            isBuiltIn: false,
            tags: original.tags
        )

        try await saveCustomTemplate(duplicated)
        return duplicated
    }

    /// Export template as JSON
    public func exportTemplate(id: String) throws -> Data {
        guard let template = templates.first(where: { $0.id == id }) else {
            throw TemplateError.templateNotFound
        }

        return try JSONEncoder().encode(template)
    }

    /// Import template from JSON
    public func importTemplate(data: Data) async throws -> NotebookTemplate {
        let decoder = JSONDecoder()
        var template = try decoder.decode(NotebookTemplate.self, from: data)

        // Ensure it's not built-in and has a unique ID
        template = NotebookTemplate(
            id: UUID().uuidString,
            title: template.title,
            description: template.description,
            category: template.category,
            markdownContent: template.markdownContent,
            properties: template.properties,
            isBuiltIn: false,
            tags: template.tags
        )

        try await saveCustomTemplate(template)
        return template
    }

    /// Toggle favorite status for a template
    public func toggleFavorite(_ templateId: String) {
        if favoriteTemplateIds.contains(templateId) {
            favoriteTemplateIds.remove(templateId)
        } else {
            favoriteTemplateIds.insert(templateId)
        }
        savePersistedData()
    }

    /// Check if template is favorited
    public func isFavorite(_ templateId: String) -> Bool {
        return favoriteTemplateIds.contains(templateId)
    }

    /// Get templates by category
    public func templates(for category: TemplateCategory) -> [NotebookTemplate] {
        return templates.filter { $0.category == category }
    }

    /// Get favorite templates
    public var favoriteTemplates: [NotebookTemplate] {
        return templates.filter { favoriteTemplateIds.contains($0.id) }
    }

    /// Get recent templates
    public var recentTemplates: [NotebookTemplate] {
        return recentTemplateIds.compactMap { id in
            templates.first { $0.id == id }
        }
    }

    // MARK: - Private Methods

    private func updateTemplatesList() {
        templates = builtInTemplates + customTemplates
    }

    private func incrementUsage(for templateId: String) async {
        guard let index = customTemplates.firstIndex(where: { $0.id == templateId }) else { return }

        let template = customTemplates[index]
        customTemplates[index] = NotebookTemplate(
            id: template.id,
            title: template.title,
            description: template.description,
            category: template.category,
            markdownContent: template.markdownContent,
            properties: template.properties,
            isBuiltIn: template.isBuiltIn,
            createdAt: template.createdAt,
            modifiedAt: template.modifiedAt,
            usageCount: template.usageCount + 1,
            tags: template.tags
        )

        try? saveCustomTemplatesToDisk()
        updateTemplatesList()
    }

    private func addToRecents(_ templateId: String) {
        recentTemplateIds.removeAll { $0 == templateId }
        recentTemplateIds.insert(templateId, at: 0)

        // Keep only last 10 recent templates
        if recentTemplateIds.count > 10 {
            recentTemplateIds = Array(recentTemplateIds.prefix(10))
        }

        savePersistedData()
    }

    // MARK: - Persistence

    private var customTemplatesURL: URL {
        documentsDirectory.appendingPathComponent(customTemplatesFileName)
    }

    private var favoritesURL: URL {
        documentsDirectory.appendingPathComponent(favoritesFileName)
    }

    private var recentsURL: URL {
        documentsDirectory.appendingPathComponent(recentsFileName)
    }

    private func loadPersistedData() {
        loadCustomTemplates()
        loadFavorites()
        loadRecents()
    }

    private func savePersistedData() {
        saveFavorites()
        saveRecents()
    }

    private func loadCustomTemplates() {
        guard FileManager.default.fileExists(atPath: customTemplatesURL.path) else { return }

        do {
            let data = try Data(contentsOf: customTemplatesURL)
            customTemplates = try JSONDecoder().decode([NotebookTemplate].self, from: data)
        } catch {
            print("Failed to load custom templates: \(error)")
            customTemplates = []
        }
    }

    private func saveCustomTemplatesToDisk() throws {
        let data = try JSONEncoder().encode(customTemplates)
        try data.write(to: customTemplatesURL)
    }

    private func loadFavorites() {
        guard FileManager.default.fileExists(atPath: favoritesURL.path) else { return }

        do {
            let data = try Data(contentsOf: favoritesURL)
            favoriteTemplateIds = try JSONDecoder().decode(Set<String>.self, from: data)
        } catch {
            print("Failed to load favorites: \(error)")
            favoriteTemplateIds = []
        }
    }

    private func saveFavorites() {
        do {
            let data = try JSONEncoder().encode(favoriteTemplateIds)
            try data.write(to: favoritesURL)
        } catch {
            print("Failed to save favorites: \(error)")
        }
    }

    private func loadRecents() {
        guard FileManager.default.fileExists(atPath: recentsURL.path) else { return }

        do {
            let data = try Data(contentsOf: recentsURL)
            recentTemplateIds = try JSONDecoder().decode([String].self, from: data)
        } catch {
            print("Failed to load recents: \(error)")
            recentTemplateIds = []
        }
    }

    private func saveRecents() {
        do {
            let data = try JSONEncoder().encode(recentTemplateIds)
            try data.write(to: recentsURL)
        } catch {
            print("Failed to save recents: \(error)")
        }
    }
}

// MARK: - Template Errors

public enum TemplateError: LocalizedError {
    case templateNotFound
    case validationFailed(errors: [String])
    case cannotDeleteBuiltIn
    case storageError(Error)

    public var errorDescription: String? {
        switch self {
        case .templateNotFound:
            return "Template not found"
        case .validationFailed(let errors):
            return "Validation failed: \(errors.joined(separator: ", "))"
        case .cannotDeleteBuiltIn:
            return "Cannot delete built-in templates"
        case .storageError(let error):
            return "Storage error: \(error.localizedDescription)"
        }
    }
}