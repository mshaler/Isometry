import Foundation

/// Readability Engine for extracting clean, readable content from web pages
/// Implements core Readability algorithm to remove ads, navigation, and other clutter
public actor ReadabilityEngine {

    public init() {}

    // MARK: - Public Interface

    /// Extracts clean, readable content from HTML
    public func extractContent(from html: String, url: URL) async -> String {
        // Parse HTML into elements
        let cleanedHtml = cleanHTML(html)
        let elements = parseHTMLElements(cleanedHtml)

        // Find main content area using Readability algorithm
        let mainContent = findMainContent(elements)

        // Clean and format the content
        let readableContent = formatContent(mainContent)

        return readableContent
    }

    // MARK: - HTML Cleaning

    private func cleanHTML(_ html: String) -> String {
        var cleaned = html

        // Remove script tags and their content
        cleaned = removeTagsAndContent(cleaned, tags: ["script", "style", "noscript"])

        // Remove comment blocks
        cleaned = cleaned.replacingOccurrences(
            of: "<!--[\\s\\S]*?-->",
            with: "",
            options: .regularExpression
        )

        // Remove common ad/tracking patterns
        cleaned = removeAdElements(cleaned)

        return cleaned
    }

    private func removeTagsAndContent(_ html: String, tags: [String]) -> String {
        var result = html

        for tag in tags {
            let pattern = "<\(tag)\\b[^>]*>[\\s\\S]*?</\(tag)>"
            result = result.replacingOccurrences(
                of: pattern,
                with: "",
                options: .regularExpression
            )
        }

        return result
    }

    private func removeAdElements(_ html: String) -> String {
        var cleaned = html

        // Remove elements with ad-related class names and IDs
        let adPatterns = [
            "ad", "ads", "advertisement", "advert", "banner",
            "sponsor", "promo", "promotion", "sidebar", "widget",
            "social", "share", "comment", "footer", "header",
            "nav", "navigation", "menu", "popup", "modal"
        ]

        for pattern in adPatterns {
            // Remove by class
            let classPattern = "<[^>]*class=\"[^\"]*\(pattern)[^\"]*\"[^>]*>[\\s\\S]*?</[^>]+>"
            cleaned = cleaned.replacingOccurrences(
                of: classPattern,
                with: "",
                options: [.regularExpression, .caseInsensitive]
            )

            // Remove by ID
            let idPattern = "<[^>]*id=\"[^\"]*\(pattern)[^\"]*\"[^>]*>[\\s\\S]*?</[^>]+>"
            cleaned = cleaned.replacingOccurrences(
                of: idPattern,
                with: "",
                options: [.regularExpression, .caseInsensitive]
            )
        }

        return cleaned
    }

    // MARK: - Content Structure Analysis

    private struct HTMLElement {
        let tag: String
        let attributes: [String: String]
        let content: String
        let textLength: Int
        let linkDensity: Double
        let score: Double
    }

    private func parseHTMLElements(_ html: String) -> [HTMLElement] {
        var elements: [HTMLElement] = []

        // Simple regex-based parsing for main content elements
        let contentTags = ["article", "div", "section", "main", "p"]

        for tag in contentTags {
            let pattern = "<\(tag)\\b([^>]*)>([\\s\\S]*?)</\(tag)>"
            let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive)
            let matches = regex?.matches(in: html, range: NSRange(html.startIndex..., in: html)) ?? []

            for match in matches {
                guard match.numberOfRanges >= 3 else { continue }

                let attributesRange = match.range(at: 1)
                let contentRange = match.range(at: 2)

                let attributesString = String(html[Range(attributesRange, in: html)!])
                let contentString = String(html[Range(contentRange, in: html)!])

                let attributes = parseAttributes(attributesString)
                let textContent = stripHTMLTags(contentString)
                let textLength = textContent.count
                let linkDensity = calculateLinkDensity(contentString, textLength: textLength)
                let score = calculateContentScore(textLength: textLength, linkDensity: linkDensity, tag: tag, attributes: attributes)

                let element = HTMLElement(
                    tag: tag,
                    attributes: attributes,
                    content: contentString,
                    textLength: textLength,
                    linkDensity: linkDensity,
                    score: score
                )

                elements.append(element)
            }
        }

        return elements
    }

    private func parseAttributes(_ attributeString: String) -> [String: String] {
        var attributes: [String: String] = [:]

        let pattern = "(\\w+)=[\"']([^\"']*)[\"']"
        let regex = try? NSRegularExpression(pattern: pattern)
        let matches = regex?.matches(in: attributeString, range: NSRange(attributeString.startIndex..., in: attributeString)) ?? []

        for match in matches {
            guard match.numberOfRanges >= 3 else { continue }

            let keyRange = match.range(at: 1)
            let valueRange = match.range(at: 2)

            let key = String(attributeString[Range(keyRange, in: attributeString)!])
            let value = String(attributeString[Range(valueRange, in: attributeString)!])

            attributes[key] = value
        }

        return attributes
    }

    private func calculateLinkDensity(_ content: String, textLength: Int) -> Double {
        guard textLength > 0 else { return 1.0 }

        // Count text inside <a> tags
        let linkPattern = "<a\\b[^>]*>([\\s\\S]*?)</a>"
        let regex = try? NSRegularExpression(pattern: linkPattern, options: .caseInsensitive)
        let matches = regex?.matches(in: content, range: NSRange(content.startIndex..., in: content)) ?? []

        var linkTextLength = 0
        for match in matches {
            guard match.numberOfRanges >= 2 else { continue }
            let linkContentRange = match.range(at: 1)
            let linkContent = String(content[Range(linkContentRange, in: content)!])
            linkTextLength += stripHTMLTags(linkContent).count
        }

        return Double(linkTextLength) / Double(textLength)
    }

    private func calculateContentScore(textLength: Int, linkDensity: Double, tag: String, attributes: [String: String]) -> Double {
        var score = 0.0

        // Base score from text length
        score += Double(textLength) / 100.0

        // Penalty for high link density
        score -= linkDensity * 10.0

        // Bonus for semantic tags
        switch tag.lowercased() {
        case "article":
            score += 25.0
        case "main":
            score += 20.0
        case "section":
            score += 15.0
        case "div":
            score += 5.0
        case "p":
            score += 3.0
        default:
            break
        }

        // Analyze class and id attributes for content indicators
        let classValue = attributes["class"]?.lowercased() ?? ""
        let idValue = attributes["id"]?.lowercased() ?? ""

        // Positive indicators
        let positivePatterns = ["content", "article", "main", "body", "text", "post", "entry"]
        for pattern in positivePatterns {
            if classValue.contains(pattern) || idValue.contains(pattern) {
                score += 10.0
            }
        }

        // Negative indicators
        let negativePatterns = ["ad", "advertisement", "sidebar", "nav", "menu", "footer", "header", "social", "comment"]
        for pattern in negativePatterns {
            if classValue.contains(pattern) || idValue.contains(pattern) {
                score -= 15.0
            }
        }

        return score
    }

    // MARK: - Content Selection and Formatting

    private func findMainContent(_ elements: [HTMLElement]) -> String {
        // Sort elements by score (highest first)
        let sortedElements = elements.sorted { $0.score > $1.score }

        // Find the best candidate
        guard let bestElement = sortedElements.first, bestElement.score > 0 else {
            // Fallback: combine all paragraph content
            let paragraphs = elements.filter { $0.tag == "p" }
            return paragraphs.map { $0.content }.joined(separator: "\n\n")
        }

        return bestElement.content
    }

    private func formatContent(_ content: String) -> String {
        var formatted = content

        // Convert common HTML entities
        formatted = decodeHTMLEntities(formatted)

        // Convert block elements to markdown-like formatting
        formatted = formatted.replacingOccurrences(of: "<h1[^>]*>", with: "# ", options: .regularExpression)
        formatted = formatted.replacingOccurrences(of: "</h1>", with: "\n\n")
        formatted = formatted.replacingOccurrences(of: "<h2[^>]*>", with: "## ", options: .regularExpression)
        formatted = formatted.replacingOccurrences(of: "</h2>", with: "\n\n")
        formatted = formatted.replacingOccurrences(of: "<h3[^>]*>", with: "### ", options: .regularExpression)
        formatted = formatted.replacingOccurrences(of: "</h3>", with: "\n\n")

        // Convert paragraphs
        formatted = formatted.replacingOccurrences(of: "<p[^>]*>", with: "", options: .regularExpression)
        formatted = formatted.replacingOccurrences(of: "</p>", with: "\n\n")

        // Convert line breaks
        formatted = formatted.replacingOccurrences(of: "<br[^>]*>", with: "\n", options: .regularExpression)

        // Convert lists
        formatted = formatted.replacingOccurrences(of: "<ul[^>]*>", with: "", options: .regularExpression)
        formatted = formatted.replacingOccurrences(of: "</ul>", with: "\n")
        formatted = formatted.replacingOccurrences(of: "<ol[^>]*>", with: "", options: .regularExpression)
        formatted = formatted.replacingOccurrences(of: "</ol>", with: "\n")
        formatted = formatted.replacingOccurrences(of: "<li[^>]*>", with: "• ", options: .regularExpression)
        formatted = formatted.replacingOccurrences(of: "</li>", with: "\n")

        // Convert emphasis
        formatted = formatted.replacingOccurrences(of: "<strong[^>]*>", with: "**", options: .regularExpression)
        formatted = formatted.replacingOccurrences(of: "</strong>", with: "**")
        formatted = formatted.replacingOccurrences(of: "<b[^>]*>", with: "**", options: .regularExpression)
        formatted = formatted.replacingOccurrences(of: "</b>", with: "**")
        formatted = formatted.replacingOccurrences(of: "<em[^>]*>", with: "*", options: .regularExpression)
        formatted = formatted.replacingOccurrences(of: "</em>", with: "*")
        formatted = formatted.replacingOccurrences(of: "<i[^>]*>", with: "*", options: .regularExpression)
        formatted = formatted.replacingOccurrences(of: "</i>", with: "*")

        // Remove remaining HTML tags
        formatted = stripHTMLTags(formatted)

        // Clean up whitespace
        formatted = formatted.replacingOccurrences(of: "\n{3,}", with: "\n\n", options: .regularExpression)
        formatted = formatted.trimmingCharacters(in: .whitespacesAndNewlines)

        return formatted
    }

    private func stripHTMLTags(_ html: String) -> String {
        return html.replacingOccurrences(
            of: "<[^>]+>",
            with: "",
            options: .regularExpression
        )
    }

    private func decodeHTMLEntities(_ html: String) -> String {
        var decoded = html

        // Common HTML entities
        let entities: [String: String] = [
            "&amp;": "&",
            "&lt;": "<",
            "&gt;": ">",
            "&quot;": "\"",
            "&apos;": "'",
            "&nbsp;": " ",
            "&mdash;": "—",
            "&ndash;": "–",
            "&ldquo;": """,
            "&rdquo;": """,
            "&lsquo;": "'",
            "&rsquo;": "'",
            "&hellip;": "…"
        ]

        for (entity, replacement) in entities {
            decoded = decoded.replacingOccurrences(of: entity, with: replacement)
        }

        // Decode numeric entities (&#123; and &#xAB;)
        decoded = decoded.replacingOccurrences(
            of: "&#(\\d+);",
            with: "",
            options: .regularExpression
        )
        decoded = decoded.replacingOccurrences(
            of: "&#x([0-9A-Fa-f]+);",
            with: "",
            options: .regularExpression
        )

        return decoded
    }
}