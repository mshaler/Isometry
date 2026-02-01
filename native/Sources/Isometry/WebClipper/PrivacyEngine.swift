import Foundation
import WebKit

/// Privacy engine for protecting user privacy during web clipping
public actor PrivacyEngine {
    public init() {}

    // MARK: - Public Interface

    /// Creates a privacy-configured WebView
    public func createPrivacyWebView() async -> WKWebView {
        let config = await createPrivacyConfiguration()
        return WKWebView(frame: .zero, configuration: config)
    }

    /// Strips tracking parameters from a URL
    public func stripTrackingParameters(from url: URL) -> URL {
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: true) else {
            return url
        }

        // Remove tracking query parameters
        if let queryItems = components.queryItems {
            let filteredItems = queryItems.filter { !isTrackingParameter($0.name) }
            components.queryItems = filteredItems.isEmpty ? nil : filteredItems
        }

        return components.url ?? url
    }

    /// Strips tracking parameters from HTML content
    public func stripTrackingFromHTML(_ html: String, baseURL: URL) async -> String {
        var cleanedHTML = html

        // Remove common tracking scripts
        cleanedHTML = await removeTrackingScripts(cleanedHTML)

        // Clean up tracking URLs in links
        cleanedHTML = await cleanTrackingLinks(cleanedHTML, baseURL: baseURL)

        // Remove tracking pixels and beacons
        cleanedHTML = await removeTrackingPixels(cleanedHTML)

        return cleanedHTML
    }

    /// Creates a privacy-respecting URLRequest
    public func createPrivacyRequest(for url: URL, userAgent: String) -> URLRequest {
        let cleanedURL = stripTrackingParameters(from: url)
        var request = URLRequest(url: cleanedURL)

        // Set privacy headers
        request.setValue(userAgent, forHTTPHeaderField: "User-Agent")
        request.setValue("1", forHTTPHeaderField: "DNT") // Do Not Track
        request.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
        request.setValue("no-cache", forHTTPHeaderField: "Pragma")

        // Remove referrer for privacy
        request.setValue("no-referrer", forHTTPHeaderField: "Referrer-Policy")

        return request
    }

    // MARK: - WebView Configuration

    private func createPrivacyConfiguration() async -> WKWebViewConfiguration {
        let config = WKWebViewConfiguration()

        // Use ephemeral data store (no persistence)
        config.websiteDataStore = WKWebsiteDataStore.nonPersistent()

        // Configure preferences for privacy
        config.preferences.javaScriptEnabled = false // Disable JS for privacy and security
        config.preferences.javaScriptCanOpenWindowsAutomatically = false

        // Disable media features that could be used for fingerprinting
        if #available(macOS 12.0, iOS 15.0, *) {
            config.preferences.isElementFullscreenEnabled = false
        }

        // Add content blocking rules
        await addPrivacyContentRules(to: config)

        return config
    }

    private func addPrivacyContentRules(to config: WKWebViewConfiguration) async {
        // Content blocking rules to block tracking
        let blockingRules = """
        [
            {
                "trigger": {
                    "url-filter": ".*",
                    "resource-type": ["script"],
                    "url-filter-is-case-sensitive": false,
                    "if-domain": ["google-analytics.com", "googletagmanager.com", "facebook.com", "doubleclick.net", "googlesyndication.com"]
                },
                "action": {
                    "type": "block"
                }
            },
            {
                "trigger": {
                    "url-filter": ".*analytics.*\\.js",
                    "resource-type": ["script"]
                },
                "action": {
                    "type": "block"
                }
            },
            {
                "trigger": {
                    "url-filter": ".*tracking.*",
                    "resource-type": ["script", "image"]
                },
                "action": {
                    "type": "block"
                }
            }
        ]
        """

        do {
            let contentRuleList = try await WKContentRuleListStore.default().compileContentRuleList(
                forIdentifier: "PrivacyRules",
                encodedContentRuleList: blockingRules
            )

            config.userContentController.add(contentRuleList)
        } catch {
            print("Failed to add privacy content rules: \(error)")
        }
    }

    // MARK: - URL Parameter Cleaning

    private func isTrackingParameter(_ parameter: String) -> Bool {
        let trackingParams = [
            // Google Analytics
            "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
            "gclid", "gclsrc", "dclid", "gbraid", "wbraid",

            // Facebook
            "fbclid", "fb_source", "fb_ref",

            // Twitter
            "twclid",

            // Microsoft
            "msclkid",

            // Amazon
            "tag", "ref_", "ref",

            // General tracking
            "_ga", "_gl", "mc_cid", "mc_eid",

            // Email tracking
            "email_source", "email_campaign",

            // Affiliate tracking
            "aff_id", "affiliate_id", "aff_sub", "clickid",

            // Other common ones
            "igshid", "feature", "app", "via"
        ]

        let lowercaseParam = parameter.lowercased()

        // Check exact matches
        if trackingParams.contains(lowercaseParam) {
            return true
        }

        // Check patterns
        if lowercaseParam.hasPrefix("utm_") ||
           lowercaseParam.hasPrefix("fb_") ||
           lowercaseParam.hasPrefix("_ga") ||
           lowercaseParam.contains("tracking") ||
           lowercaseParam.contains("analytics") {
            return true
        }

        return false
    }

    // MARK: - HTML Cleaning

    private func removeTrackingScripts(_ html: String) async -> String {
        var cleanedHTML = html

        // Remove Google Analytics
        cleanedHTML = cleanedHTML.replacingOccurrences(
            of: "<script[^>]*google-analytics[^>]*>[\\s\\S]*?</script>",
            with: "",
            options: [.regularExpression, .caseInsensitive]
        )

        // Remove Google Tag Manager
        cleanedHTML = cleanedHTML.replacingOccurrences(
            of: "<script[^>]*googletagmanager[^>]*>[\\s\\S]*?</script>",
            with: "",
            options: [.regularExpression, .caseInsensitive]
        )

        // Remove Facebook Pixel
        cleanedHTML = cleanedHTML.replacingOccurrences(
            of: "<script[^>]*facebook[^>]*>[\\s\\S]*?</script>",
            with: "",
            options: [.regularExpression, .caseInsensitive]
        )

        // Remove tracking scripts by pattern
        let trackingPatterns = [
            "<script[^>]*analytics[^>]*>[\\s\\S]*?</script>",
            "<script[^>]*tracking[^>]*>[\\s\\S]*?</script>",
            "<script[^>]*track[^>]*>[\\s\\S]*?</script>"
        ]

        for pattern in trackingPatterns {
            cleanedHTML = cleanedHTML.replacingOccurrences(
                of: pattern,
                with: "",
                options: [.regularExpression, .caseInsensitive]
            )
        }

        return cleanedHTML
    }

    private func cleanTrackingLinks(_ html: String, baseURL: URL) async -> String {
        var cleanedHTML = html

        // Find all links and clean their URLs
        let linkPattern = "href=[\"']([^\"']*)[\"']"
        if let regex = try? NSRegularExpression(pattern: linkPattern, options: .caseInsensitive) {
            let matches = regex.matches(in: html, range: NSRange(html.startIndex..., in: html))

            // Process matches in reverse order to maintain string indices
            for match in matches.reversed() {
                guard match.numberOfRanges >= 2 else { continue }

                let fullRange = match.range(at: 0)
                let urlRange = match.range(at: 1)

                let urlString = String(html[Range(urlRange, in: html)!])

                if let url = URL(string: urlString, relativeTo: baseURL) {
                    let cleanedURL = stripTrackingParameters(from: url)
                    let replacement = "href=\"\(cleanedURL.absoluteString)\""

                    let startIndex = html.index(html.startIndex, offsetBy: fullRange.location)
                    let endIndex = html.index(startIndex, offsetBy: fullRange.length)

                    cleanedHTML = cleanedHTML.replacingCharacters(in: startIndex..<endIndex, with: replacement)
                }
            }
        }

        return cleanedHTML
    }

    private func removeTrackingPixels(_ html: String) async -> String {
        var cleanedHTML = html

        // Remove tracking pixels (1x1 images)
        cleanedHTML = cleanedHTML.replacingOccurrences(
            of: "<img[^>]*width=[\"']1[\"'][^>]*height=[\"']1[\"'][^>]*>",
            with: "",
            options: [.regularExpression, .caseInsensitive]
        )

        cleanedHTML = cleanedHTML.replacingOccurrences(
            of: "<img[^>]*height=[\"']1[\"'][^>]*width=[\"']1[\"'][^>]*>",
            with: "",
            options: [.regularExpression, .caseInsensitive]
        )

        // Remove images from known tracking domains
        let trackingDomains = [
            "google-analytics.com",
            "googletagmanager.com",
            "facebook.com",
            "doubleclick.net",
            "googlesyndication.com"
        ]

        for domain in trackingDomains {
            cleanedHTML = cleanedHTML.replacingOccurrences(
                of: "<img[^>]*src=[\"'][^\"']*\(domain)[^\"']*[\"'][^>]*>",
                with: "",
                options: [.regularExpression, .caseInsensitive]
            )
        }

        return cleanedHTML
    }
}