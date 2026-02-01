import Foundation

/// Metadata extracted from web pages including Open Graph, Twitter Cards, and JSON-LD
public struct WebPageMetadata: Codable, Sendable {
    public let title: String?
    public let description: String?
    public let imageUrl: String?
    public let siteName: String?
    public let type: String?
    public let url: String?
    public let author: String?
    public let publishedDate: Date?
    public let modifiedDate: Date?
    public let tags: [String]
    public let language: String?
    public let favicon: String?

    // Open Graph specific
    public let ogTitle: String?
    public let ogDescription: String?
    public let ogImage: String?
    public let ogType: String?
    public let ogUrl: String?
    public let ogSiteName: String?

    // Twitter Card specific
    public let twitterCard: String?
    public let twitterTitle: String?
    public let twitterDescription: String?
    public let twitterImage: String?
    public let twitterSite: String?
    public let twitterCreator: String?

    // JSON-LD structured data
    public let jsonLdData: [String: Any]?

    public init(
        title: String? = nil,
        description: String? = nil,
        imageUrl: String? = nil,
        siteName: String? = nil,
        type: String? = nil,
        url: String? = nil,
        author: String? = nil,
        publishedDate: Date? = nil,
        modifiedDate: Date? = nil,
        tags: [String] = [],
        language: String? = nil,
        favicon: String? = nil,
        ogTitle: String? = nil,
        ogDescription: String? = nil,
        ogImage: String? = nil,
        ogType: String? = nil,
        ogUrl: String? = nil,
        ogSiteName: String? = nil,
        twitterCard: String? = nil,
        twitterTitle: String? = nil,
        twitterDescription: String? = nil,
        twitterImage: String? = nil,
        twitterSite: String? = nil,
        twitterCreator: String? = nil,
        jsonLdData: [String: Any]? = nil
    ) {
        self.title = title
        self.description = description
        self.imageUrl = imageUrl
        self.siteName = siteName
        self.type = type
        self.url = url
        self.author = author
        self.publishedDate = publishedDate
        self.modifiedDate = modifiedDate
        self.tags = tags
        self.language = language
        self.favicon = favicon
        self.ogTitle = ogTitle
        self.ogDescription = ogDescription
        self.ogImage = ogImage
        self.ogType = ogType
        self.ogUrl = ogUrl
        self.ogSiteName = ogSiteName
        self.twitterCard = twitterCard
        self.twitterTitle = twitterTitle
        self.twitterDescription = twitterDescription
        self.twitterImage = twitterImage
        self.twitterSite = twitterSite
        self.twitterCreator = twitterCreator
        self.jsonLdData = jsonLdData
    }

    // Custom coding to handle [String: Any]
    enum CodingKeys: String, CodingKey {
        case title, description, imageUrl, siteName, type, url, author
        case publishedDate, modifiedDate, tags, language, favicon
        case ogTitle, ogDescription, ogImage, ogType, ogUrl, ogSiteName
        case twitterCard, twitterTitle, twitterDescription, twitterImage, twitterSite, twitterCreator
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(title, forKey: .title)
        try container.encodeIfPresent(description, forKey: .description)
        try container.encodeIfPresent(imageUrl, forKey: .imageUrl)
        try container.encodeIfPresent(siteName, forKey: .siteName)
        try container.encodeIfPresent(type, forKey: .type)
        try container.encodeIfPresent(url, forKey: .url)
        try container.encodeIfPresent(author, forKey: .author)
        try container.encodeIfPresent(publishedDate, forKey: .publishedDate)
        try container.encodeIfPresent(modifiedDate, forKey: .modifiedDate)
        try container.encode(tags, forKey: .tags)
        try container.encodeIfPresent(language, forKey: .language)
        try container.encodeIfPresent(favicon, forKey: .favicon)
        try container.encodeIfPresent(ogTitle, forKey: .ogTitle)
        try container.encodeIfPresent(ogDescription, forKey: .ogDescription)
        try container.encodeIfPresent(ogImage, forKey: .ogImage)
        try container.encodeIfPresent(ogType, forKey: .ogType)
        try container.encodeIfPresent(ogUrl, forKey: .ogUrl)
        try container.encodeIfPresent(ogSiteName, forKey: .ogSiteName)
        try container.encodeIfPresent(twitterCard, forKey: .twitterCard)
        try container.encodeIfPresent(twitterTitle, forKey: .twitterTitle)
        try container.encodeIfPresent(twitterDescription, forKey: .twitterDescription)
        try container.encodeIfPresent(twitterImage, forKey: .twitterImage)
        try container.encodeIfPresent(twitterSite, forKey: .twitterSite)
        try container.encodeIfPresent(twitterCreator, forKey: .twitterCreator)
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        imageUrl = try container.decodeIfPresent(String.self, forKey: .imageUrl)
        siteName = try container.decodeIfPresent(String.self, forKey: .siteName)
        type = try container.decodeIfPresent(String.self, forKey: .type)
        url = try container.decodeIfPresent(String.self, forKey: .url)
        author = try container.decodeIfPresent(String.self, forKey: .author)
        publishedDate = try container.decodeIfPresent(Date.self, forKey: .publishedDate)
        modifiedDate = try container.decodeIfPresent(Date.self, forKey: .modifiedDate)
        tags = try container.decode([String].self, forKey: .tags)
        language = try container.decodeIfPresent(String.self, forKey: .language)
        favicon = try container.decodeIfPresent(String.self, forKey: .favicon)
        ogTitle = try container.decodeIfPresent(String.self, forKey: .ogTitle)
        ogDescription = try container.decodeIfPresent(String.self, forKey: .ogDescription)
        ogImage = try container.decodeIfPresent(String.self, forKey: .ogImage)
        ogType = try container.decodeIfPresent(String.self, forKey: .ogType)
        ogUrl = try container.decodeIfPresent(String.self, forKey: .ogUrl)
        ogSiteName = try container.decodeIfPresent(String.self, forKey: .ogSiteName)
        twitterCard = try container.decodeIfPresent(String.self, forKey: .twitterCard)
        twitterTitle = try container.decodeIfPresent(String.self, forKey: .twitterTitle)
        twitterDescription = try container.decodeIfPresent(String.self, forKey: .twitterDescription)
        twitterImage = try container.decodeIfPresent(String.self, forKey: .twitterImage)
        twitterSite = try container.decodeIfPresent(String.self, forKey: .twitterSite)
        twitterCreator = try container.decodeIfPresent(String.self, forKey: .twitterCreator)
        jsonLdData = nil // Skip JSON-LD for Codable simplicity
    }
}

/// MetadataExtractor for parsing Open Graph, Twitter Cards, and JSON-LD from HTML
public actor MetadataExtractor {

    public init() {}

    // MARK: - Public Interface

    /// Extracts comprehensive metadata from HTML content
    public func extractMetadata(from html: String, url: URL) async -> WebPageMetadata {
        // Extract different types of metadata
        let basicMetadata = extractBasicMetadata(from: html)
        let openGraphData = extractOpenGraphMetadata(from: html)
        let twitterCardData = extractTwitterCardMetadata(from: html)
        let jsonLdData = extractJSONLDMetadata(from: html)
        let faviconUrl = extractFavicon(from: html, baseUrl: url)

        // Combine all metadata with fallbacks
        return WebPageMetadata(
            title: openGraphData.title ?? twitterCardData.title ?? basicMetadata.title,
            description: openGraphData.description ?? twitterCardData.description ?? basicMetadata.description,
            imageUrl: openGraphData.image ?? twitterCardData.image ?? basicMetadata.image,
            siteName: openGraphData.siteName ?? twitterCardData.site,
            type: openGraphData.type ?? "website",
            url: openGraphData.url ?? url.absoluteString,
            author: basicMetadata.author ?? twitterCardData.creator,
            publishedDate: basicMetadata.publishedDate,
            modifiedDate: basicMetadata.modifiedDate,
            tags: basicMetadata.keywords,
            language: basicMetadata.language,
            favicon: faviconUrl,
            ogTitle: openGraphData.title,
            ogDescription: openGraphData.description,
            ogImage: openGraphData.image,
            ogType: openGraphData.type,
            ogUrl: openGraphData.url,
            ogSiteName: openGraphData.siteName,
            twitterCard: twitterCardData.card,
            twitterTitle: twitterCardData.title,
            twitterDescription: twitterCardData.description,
            twitterImage: twitterCardData.image,
            twitterSite: twitterCardData.site,
            twitterCreator: twitterCardData.creator,
            jsonLdData: jsonLdData
        )
    }

    // MARK: - Basic HTML Metadata

    private struct BasicMetadata {
        let title: String?
        let description: String?
        let image: String?
        let author: String?
        let keywords: [String]
        let language: String?
        let publishedDate: Date?
        let modifiedDate: Date?
    }

    private func extractBasicMetadata(from html: String) -> BasicMetadata {
        return BasicMetadata(
            title: extractMetaContent(from: html, name: "title") ?? extractTitleTag(from: html),
            description: extractMetaContent(from: html, name: "description"),
            image: extractMetaContent(from: html, name: "image"),
            author: extractMetaContent(from: html, name: "author"),
            keywords: parseKeywords(extractMetaContent(from: html, name: "keywords")),
            language: extractLanguage(from: html),
            publishedDate: parseDate(extractMetaContent(from: html, name: "article:published_time")),
            modifiedDate: parseDate(extractMetaContent(from: html, name: "article:modified_time"))
        )
    }

    // MARK: - Open Graph Metadata

    private struct OpenGraphMetadata {
        let title: String?
        let description: String?
        let image: String?
        let type: String?
        let url: String?
        let siteName: String?
    }

    private func extractOpenGraphMetadata(from html: String) -> OpenGraphMetadata {
        return OpenGraphMetadata(
            title: extractMetaProperty(from: html, property: "og:title"),
            description: extractMetaProperty(from: html, property: "og:description"),
            image: extractMetaProperty(from: html, property: "og:image"),
            type: extractMetaProperty(from: html, property: "og:type"),
            url: extractMetaProperty(from: html, property: "og:url"),
            siteName: extractMetaProperty(from: html, property: "og:site_name")
        )
    }

    // MARK: - Twitter Card Metadata

    private struct TwitterCardMetadata {
        let card: String?
        let title: String?
        let description: String?
        let image: String?
        let site: String?
        let creator: String?
    }

    private func extractTwitterCardMetadata(from html: String) -> TwitterCardMetadata {
        return TwitterCardMetadata(
            card: extractMetaName(from: html, name: "twitter:card"),
            title: extractMetaName(from: html, name: "twitter:title"),
            description: extractMetaName(from: html, name: "twitter:description"),
            image: extractMetaName(from: html, name: "twitter:image"),
            site: extractMetaName(from: html, name: "twitter:site"),
            creator: extractMetaName(from: html, name: "twitter:creator")
        )
    }

    // MARK: - JSON-LD Structured Data

    private func extractJSONLDMetadata(from html: String) -> [String: Any]? {
        let pattern = "<script[^>]*type=[\"']application/ld\\+json[\"'][^>]*>([\\s\\S]*?)</script>"
        let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive)
        let matches = regex?.matches(in: html, range: NSRange(html.startIndex..., in: html)) ?? []

        guard let match = matches.first, match.numberOfRanges >= 2 else { return nil }

        let jsonRange = match.range(at: 1)
        let jsonString = String(html[Range(jsonRange, in: html)!])

        guard let data = jsonString.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }

        return json
    }

    // MARK: - Favicon Extraction

    private func extractFavicon(from html: String, baseUrl: URL) -> String? {
        // Look for various favicon link types
        let faviconPatterns = [
            "icon",
            "shortcut icon",
            "apple-touch-icon",
            "apple-touch-icon-precomposed"
        ]

        for pattern in faviconPatterns {
            if let href = extractLinkHref(from: html, rel: pattern) {
                return resolveUrl(href, baseUrl: baseUrl)
            }
        }

        // Fallback to /favicon.ico
        return baseUrl.appendingPathComponent("/favicon.ico").absoluteString
    }

    // MARK: - HTML Parsing Utilities

    private func extractMetaContent(from html: String, name: String) -> String? {
        let pattern = "<meta[^>]*name=[\"']\(name)[\"'][^>]*content=[\"']([^\"']*)[\"'][^>]*>"
        return extractWithRegex(html: html, pattern: pattern)
    }

    private func extractMetaProperty(from html: String, property: String) -> String? {
        let pattern = "<meta[^>]*property=[\"']\(property)[\"'][^>]*content=[\"']([^\"']*)[\"'][^>]*>"
        return extractWithRegex(html: html, pattern: pattern)
    }

    private func extractMetaName(from html: String, name: String) -> String? {
        let pattern = "<meta[^>]*name=[\"']\(name)[\"'][^>]*content=[\"']([^\"']*)[\"'][^>]*>"
        return extractWithRegex(html: html, pattern: pattern)
    }

    private func extractLinkHref(from html: String, rel: String) -> String? {
        let pattern = "<link[^>]*rel=[\"']\(rel)[\"'][^>]*href=[\"']([^\"']*)[\"'][^>]*>"
        return extractWithRegex(html: html, pattern: pattern)
    }

    private func extractTitleTag(from html: String) -> String? {
        let pattern = "<title[^>]*>([\\s\\S]*?)</title>"
        return extractWithRegex(html: html, pattern: pattern)?.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func extractLanguage(from html: String) -> String? {
        let htmlPattern = "<html[^>]*lang=[\"']([^\"']*)[\"'][^>]*>"
        if let lang = extractWithRegex(html: html, pattern: htmlPattern) {
            return lang
        }

        let metaPattern = "<meta[^>]*http-equiv=[\"']content-language[\"'][^>]*content=[\"']([^\"']*)[\"'][^>]*>"
        return extractWithRegex(html: html, pattern: metaPattern)
    }

    private func extractWithRegex(html: String, pattern: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
              let match = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
              match.numberOfRanges >= 2 else {
            return nil
        }

        let range = match.range(at: 1)
        return String(html[Range(range, in: html)!])
    }

    private func parseKeywords(_ keywords: String?) -> [String] {
        guard let keywords = keywords?.trimmingCharacters(in: .whitespacesAndNewlines),
              !keywords.isEmpty else {
            return []
        }

        return keywords
            .components(separatedBy: ",")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    private func parseDate(_ dateString: String?) -> Date? {
        guard let dateString = dateString else { return nil }

        let formatters = [
            ISO8601DateFormatter(),
            {
                let formatter = DateFormatter()
                formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ssZ"
                return formatter
            }(),
            {
                let formatter = DateFormatter()
                formatter.dateFormat = "yyyy-MM-dd"
                return formatter
            }()
        ]

        for formatter in formatters {
            if let date = formatter.date(from: dateString) {
                return date
            }
        }

        return nil
    }

    private func resolveUrl(_ urlString: String, baseUrl: URL) -> String? {
        if urlString.hasPrefix("http") {
            return urlString
        }

        if urlString.hasPrefix("//") {
            return "\(baseUrl.scheme ?? "https"):\(urlString)"
        }

        if urlString.hasPrefix("/") {
            return "\(baseUrl.scheme ?? "https")://\(baseUrl.host ?? "")\(urlString)"
        }

        // Relative URL
        return baseUrl.appendingPathComponent(urlString).absoluteString
    }
}