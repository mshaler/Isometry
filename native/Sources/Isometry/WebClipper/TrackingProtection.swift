import Foundation
import WebKit

/// Additional tracking protection utilities for web clipping
public struct TrackingProtection {

    /// List of known tracking domains to block
    public static let trackingDomains = [
        // Analytics
        "google-analytics.com",
        "googletagmanager.com",
        "googlesyndication.com",
        "doubleclick.net",
        "google-analytics.com",
        "analytics.google.com",

        // Social Media Tracking
        "facebook.com",
        "connect.facebook.net",
        "twitter.com",
        "platform.twitter.com",
        "linkedin.com",
        "platform.linkedin.com",

        // Ad Networks
        "googlesyndication.com",
        "amazon-adsystem.com",
        "adsystem.amazon.com",
        "media.net",
        "bing.com",

        // Other Trackers
        "hotjar.com",
        "crazyegg.com",
        "mixpanel.com",
        "segment.io",
        "amplitude.com"
    ]

    /// User agents that provide good privacy without being blocked
    public static let privacyUserAgents = [
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15"
    ]

    /// Checks if a URL is from a tracking domain
    public static func isTrackingDomain(_ url: URL) -> Bool {
        guard let host = url.host?.lowercased() else { return false }

        return trackingDomains.contains { trackingDomain in
            host == trackingDomain || host.hasSuffix("." + trackingDomain)
        }
    }

    /// Gets a random privacy-respecting user agent
    public static func getRandomUserAgent() -> String {
        return privacyUserAgents.randomElement() ?? privacyUserAgents[0]
    }

    /// Creates headers that help avoid fingerprinting
    public static func getPrivacyHeaders() -> [String: String] {
        return [
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate",
            "DNT": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Cache-Control": "max-age=0"
        ]
    }

    /// Removes tracking query parameters from URLs
    public static func cleanTrackingParameters(from urlString: String) -> String {
        guard let url = URL(string: urlString),
              var components = URLComponents(url: url, resolvingAgainstBaseURL: true) else {
            return urlString
        }

        if let queryItems = components.queryItems {
            let cleanedItems = queryItems.filter { !isTrackingParameter($0.name) }
            components.queryItems = cleanedItems.isEmpty ? nil : cleanedItems
        }

        return components.url?.absoluteString ?? urlString
    }

    /// Checks if a parameter name is used for tracking
    private static func isTrackingParameter(_ name: String) -> Bool {
        let trackingParams = [
            "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
            "gclid", "gclsrc", "dclid", "fbclid", "twclid", "msclkid",
            "_ga", "_gl", "mc_cid", "mc_eid",
            "igshid", "feature", "app", "via"
        ]

        let lowercaseName = name.lowercased()
        return trackingParams.contains(lowercaseName) ||
               lowercaseName.hasPrefix("utm_") ||
               lowercaseName.hasPrefix("fb_") ||
               lowercaseName.contains("tracking")
    }
}