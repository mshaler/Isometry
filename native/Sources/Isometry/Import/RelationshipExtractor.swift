import Foundation
import IsometryCore

/// Extracts relationships from markdown content and creates graph edges
public actor RelationshipExtractor {
    private let database: IsometryDatabase

    public init(database: IsometryDatabase) {
        self.database = database
    }

    // MARK: - Public API

    /// Extract all relationships from markdown content and create edges with optimization
    public func extractRelationships(
        from content: String,
        sourceNode: Node,
        dialect: MarkdownDialect
    ) async throws -> [ExtractedRelationship] {
        var relationships: [ExtractedRelationship] = []

        // Extract different types of relationships based on dialect
        switch dialect {
        case .obsidian:
            relationships.append(contentsOf: try await extractObsidianWikiLinks(content, sourceNode: sourceNode))
            relationships.append(contentsOf: try await extractObsidianTags(content, sourceNode: sourceNode))
        case .githubFlavored, .commonMark:
            relationships.append(contentsOf: try await extractMarkdownLinks(content, sourceNode: sourceNode))
        }

        // Extract common relationship types for all dialects
        relationships.append(contentsOf: try await extractImageReferences(content, sourceNode: sourceNode))
        relationships.append(contentsOf: try await extractAttachmentLinks(content, sourceNode: sourceNode))

        // Batch create edges for better performance
        try await createEdgesForRelationships(relationships, sourceNode: sourceNode)

        return relationships
    }

    /// Create edges for multiple relationships with batching for performance
    private func createEdgesForRelationships(_ relationships: [ExtractedRelationship], sourceNode: Node) async throws {
        // Pre-fetch existing edges to reduce database calls
        let existingEdges = try await database.getEdges(fromNode: sourceNode.id)

        // Process relationships in batches
        for relationship in relationships {
            // Check if edge already exists
            let targetNodeId = try await resolveTargetNodeId(relationship)
            let expectedEdgeType = edgeTypeForRelationship(relationship.type)

            let edgeExists = existingEdges.contains { edge in
                edge.targetId == targetNodeId && edge.edgeType == expectedEdgeType
            }

            if !edgeExists {
                let edge = Edge(
                    edgeType: expectedEdgeType,
                    sourceId: relationship.sourceId,
                    targetId: targetNodeId,
                    label: relationship.displayText,
                    weight: relationship.weight,
                    directed: true
                )

                try await database.createEdge(edge)

                // Create bidirectional relationship for certain types
                if shouldCreateBidirectionalEdge(relationship.type) {
                    let reverseEdge = Edge(
                        edgeType: .link,
                        sourceId: targetNodeId,
                        targetId: relationship.sourceId,
                        label: "Referenced by",
                        weight: relationship.weight * 0.5, // Lower weight for reverse direction
                        directed: true
                    )

                    try await database.createEdge(reverseEdge)
                }
            }
        }
    }

    /// Determine if a relationship type should have bidirectional edges
    private func shouldCreateBidirectionalEdge(_ type: RelationshipType) -> Bool {
        switch type {
        case .wikiLink:
            return true  // Wiki-links should be bidirectional for graph navigation
        case .markdownLink:
            return false // External links are typically one-way
        case .tag:
            return false // Tags are one-way relationships
        case .imageReference, .attachment:
            return false // File attachments are one-way
        }
    }

    // MARK: - Relationship Extraction

    /// Extract Obsidian-style wiki-links: [[target]] and [[display text|target]]
    private func extractObsidianWikiLinks(_ content: String, sourceNode: Node) async throws -> [ExtractedRelationship] {
        var relationships: [ExtractedRelationship] = []

        // Pattern for wiki-links: [[link]] or [[display text|target]]
        let wikiLinkPattern = "\\[\\[([^\\]|]+)(\\|([^\\]]+))?\\]\\]"
        let regex = try NSRegularExpression(pattern: wikiLinkPattern, options: [])
        let range = NSRange(content.startIndex..<content.endIndex, in: content)

        let matches = regex.matches(in: content, options: [], range: range)

        for match in matches {
            guard let matchRange = Range(match.range, in: content) else { continue }
            let fullMatch = String(content[matchRange])

            // Extract target and display text
            let components = extractWikiLinkComponents(fullMatch)

            let relationship = ExtractedRelationship(
                type: .wikiLink,
                sourceId: sourceNode.id,
                targetIdentifier: components.target,
                displayText: components.displayText,
                fullMatch: fullMatch,
                weight: 1.0
            )

            relationships.append(relationship)
        }

        return relationships
    }

    /// Extract Obsidian-style tags: #tag
    private func extractObsidianTags(_ content: String, sourceNode: Node) async throws -> [ExtractedRelationship] {
        var relationships: [ExtractedRelationship] = []

        // Pattern for hashtags: #tag (but not #hashtag in middle of word)
        let tagPattern = "(?:^|\\s)#([a-zA-Z][a-zA-Z0-9-_]*)(?:\\s|$)"
        let regex = try NSRegularExpression(pattern: tagPattern, options: [])
        let range = NSRange(content.startIndex..<content.endIndex, in: content)

        let matches = regex.matches(in: content, options: [], range: range)

        for match in matches {
            // Extract tag name (group 1)
            if let tagRange = Range(match.range(at: 1), in: content) {
                let tagName = String(content[tagRange])

                let relationship = ExtractedRelationship(
                    type: .tag,
                    sourceId: sourceNode.id,
                    targetIdentifier: tagName,
                    displayText: "#\(tagName)",
                    fullMatch: "#\(tagName)",
                    weight: 0.5
                )

                relationships.append(relationship)
            }
        }

        return relationships
    }

    /// Extract standard markdown links: [text](url)
    private func extractMarkdownLinks(_ content: String, sourceNode: Node) async throws -> [ExtractedRelationship] {
        var relationships: [ExtractedRelationship] = []

        // Pattern for markdown links: [text](url)
        let linkPattern = "\\[([^\\]]+)\\]\\(([^)]+)\\)"
        let regex = try NSRegularExpression(pattern: linkPattern, options: [])
        let range = NSRange(content.startIndex..<content.endIndex, in: content)

        let matches = regex.matches(in: content, options: [], range: range)

        for match in matches {
            if let textRange = Range(match.range(at: 1), in: content),
               let urlRange = Range(match.range(at: 2), in: content) {

                let linkText = String(content[textRange])
                let url = String(content[urlRange])

                // Skip if it's an image reference (handled separately)
                if url.lowercased().hasSuffix(".png") ||
                   url.lowercased().hasSuffix(".jpg") ||
                   url.lowercased().hasSuffix(".jpeg") ||
                   url.lowercased().hasSuffix(".gif") {
                    continue
                }

                let relationship = ExtractedRelationship(
                    type: .markdownLink,
                    sourceId: sourceNode.id,
                    targetIdentifier: url,
                    displayText: linkText,
                    fullMatch: "[\(linkText)](\(url))",
                    weight: 0.8
                )

                relationships.append(relationship)
            }
        }

        return relationships
    }

    /// Extract image references: ![alt](path)
    private func extractImageReferences(_ content: String, sourceNode: Node) async throws -> [ExtractedRelationship] {
        var relationships: [ExtractedRelationship] = []

        // Pattern for image references: ![alt](path)
        let imagePattern = "!\\[([^\\]]*)\\]\\(([^)]+)\\)"
        let regex = try NSRegularExpression(pattern: imagePattern, options: [])
        let range = NSRange(content.startIndex..<content.endIndex, in: content)

        let matches = regex.matches(in: content, options: [], range: range)

        for match in matches {
            if let altRange = Range(match.range(at: 1), in: content),
               let pathRange = Range(match.range(at: 2), in: content) {

                let altText = String(content[altRange])
                let imagePath = String(content[pathRange])

                let relationship = ExtractedRelationship(
                    type: .imageReference,
                    sourceId: sourceNode.id,
                    targetIdentifier: imagePath,
                    displayText: altText,
                    fullMatch: "![\(altText)](\(imagePath))",
                    weight: 0.3
                )

                relationships.append(relationship)
            }
        }

        return relationships
    }

    /// Extract attachment links (files that aren't images)
    private func extractAttachmentLinks(_ content: String, sourceNode: Node) async throws -> [ExtractedRelationship] {
        var relationships: [ExtractedRelationship] = []

        // Pattern for file attachments: [text](file.ext)
        let attachmentPattern = "\\[([^\\]]+)\\]\\(([^)]+\\.[a-zA-Z0-9]+)\\)"
        let regex = try NSRegularExpression(pattern: attachmentPattern, options: [])
        let range = NSRange(content.startIndex..<content.endIndex, in: content)

        let matches = regex.matches(in: content, options: [], range: range)

        for match in matches {
            if let textRange = Range(match.range(at: 1), in: content),
               let pathRange = Range(match.range(at: 2), in: content) {

                let linkText = String(content[textRange])
                let filePath = String(content[pathRange])

                // Check if it's a file attachment (has extension but not image)
                let fileExtension = URL(fileURLWithPath: filePath).pathExtension.lowercased()
                let imageExtensions = ["png", "jpg", "jpeg", "gif", "bmp", "svg", "webp"]

                if !imageExtensions.contains(fileExtension) && !fileExtension.isEmpty {
                    let relationship = ExtractedRelationship(
                        type: .attachment,
                        sourceId: sourceNode.id,
                        targetIdentifier: filePath,
                        displayText: linkText,
                        fullMatch: "[\(linkText)](\(filePath))",
                        weight: 0.4
                    )

                    relationships.append(relationship)
                }
            }
        }

        return relationships
    }

    // MARK: - Helper Functions

    /// Extract components from wiki-link syntax
    private func extractWikiLinkComponents(_ wikiLink: String) -> (target: String, displayText: String?) {
        // Remove [[ and ]]
        let cleanLink = wikiLink.replacingOccurrences(of: "[[", with: "").replacingOccurrences(of: "]]", with: "")

        // Check for display text|target format
        if let separatorIndex = cleanLink.firstIndex(of: "|") {
            let displayText = String(cleanLink[..<separatorIndex]).trimmingCharacters(in: .whitespaces)
            let target = String(cleanLink[cleanLink.index(after: separatorIndex)...]).trimmingCharacters(in: .whitespaces)
            return (target, displayText)
        } else {
            // Simple [[target]] format
            return (cleanLink.trimmingCharacters(in: .whitespaces), nil)
        }
    }


    /// Resolve target node ID from relationship identifier
    private func resolveTargetNodeId(_ relationship: ExtractedRelationship) async throws -> String {
        switch relationship.type {
        case .wikiLink:
            // Try to find existing node by name or create placeholder
            return try await findOrCreateWikiLinkTarget(relationship.targetIdentifier)
        case .tag:
            // Create or find tag node
            return try await findOrCreateTagNode(relationship.targetIdentifier)
        case .markdownLink:
            // For external URLs, create URL node
            return try await findOrCreateUrlNode(relationship.targetIdentifier)
        case .imageReference, .attachment:
            // Create file node
            return try await findOrCreateFileNode(relationship.targetIdentifier)
        }
    }

    /// Find existing node by wiki-link target name or create placeholder
    private func findOrCreateWikiLinkTarget(_ targetName: String) async throws -> String {
        // Try to find existing node by name or sourceId
        // This is a simplified search - could be enhanced with more sophisticated matching
        let sourceId = "wiki-link-\(targetName)"

        // Check if we already have a node with this sourceId
        if let existingNode = try await database.getNode(bySourceId: sourceId, source: "wiki-link") {
            return existingNode.id
        }

        // Create placeholder node
        let placeholderNode = Node(
            nodeType: "wiki-link-target",
            name: targetName,
            content: "Placeholder for wiki-link target: \(targetName)",
            source: "wiki-link",
            sourceId: sourceId
        )

        try await database.createNode(placeholderNode)
        return placeholderNode.id
    }

    /// Find or create tag node
    private func findOrCreateTagNode(_ tagName: String) async throws -> String {
        let sourceId = "tag-\(tagName)"

        // Check if tag node already exists
        if let existingNode = try await database.getNode(bySourceId: sourceId, source: "tag") {
            return existingNode.id
        }

        let tagNode = Node(
            nodeType: "tag",
            name: tagName,
            content: "Tag: #\(tagName)",
            source: "tag",
            sourceId: sourceId
        )

        try await database.createNode(tagNode)
        return tagNode.id
    }

    /// Find or create URL node
    private func findOrCreateUrlNode(_ url: String) async throws -> String {
        let sourceId = "url-\(url.hash)"

        // Check if URL node already exists
        if let existingNode = try await database.getNode(bySourceId: sourceId, source: "url") {
            return existingNode.id
        }

        let urlNode = Node(
            nodeType: "url",
            name: URL(string: url)?.host ?? url,
            content: "External URL: \(url)",
            source: "url",
            sourceId: sourceId,
            sourceUrl: url
        )

        try await database.createNode(urlNode)
        return urlNode.id
    }

    /// Find or create file node
    private func findOrCreateFileNode(_ filePath: String) async throws -> String {
        let sourceId = "file-\(filePath.hash)"

        // Check if file node already exists
        if let existingNode = try await database.getNode(bySourceId: sourceId, source: "file") {
            return existingNode.id
        }

        let fileName = URL(fileURLWithPath: filePath).lastPathComponent
        let fileNode = Node(
            nodeType: "file",
            name: fileName,
            content: "File attachment: \(filePath)",
            source: "file",
            sourceId: sourceId,
            sourceUrl: filePath
        )

        try await database.createNode(fileNode)
        return fileNode.id
    }

    /// Map relationship type to edge type
    private func edgeTypeForRelationship(_ relationshipType: RelationshipType) -> EdgeType {
        switch relationshipType {
        case .wikiLink, .markdownLink:
            return .link
        case .tag:
            return .affinity
        case .imageReference, .attachment:
            return .link
        }
    }
}

// MARK: - Supporting Types

public enum RelationshipType: String, Sendable {
    case wikiLink = "wiki-link"
    case tag = "tag"
    case markdownLink = "markdown-link"
    case imageReference = "image-reference"
    case attachment = "attachment"
}

public struct ExtractedRelationship: Sendable {
    public let type: RelationshipType
    public let sourceId: String
    public let targetIdentifier: String
    public let displayText: String?
    public let fullMatch: String
    public let weight: Double

    public init(
        type: RelationshipType,
        sourceId: String,
        targetIdentifier: String,
        displayText: String?,
        fullMatch: String,
        weight: Double
    ) {
        self.type = type
        self.sourceId = sourceId
        self.targetIdentifier = targetIdentifier
        self.displayText = displayText
        self.fullMatch = fullMatch
        self.weight = weight
    }
}