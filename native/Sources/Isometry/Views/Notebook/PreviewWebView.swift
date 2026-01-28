import SwiftUI
import WebKit
import os.log

#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

/// Secure WKWebView integration for universal content preview
/// Provides secure web content rendering with App Sandbox compliance
public struct PreviewWebView: View {
    @State private var webView: WKWebView?
    @State private var isLoading = false
    @State private var loadProgress: Double = 0.0
    @State private var canGoBack = false
    @State private var canGoForward = false
    @State private var currentURL: URL?
    @State private var error: PreviewError?

    // Configuration
    private let configuration: PreviewConfiguration
    private let securityPolicy: SecurityPolicy

    // Logging
    private let logger = Logger(subsystem: "com.isometry.app", category: "PreviewWebView")

    public init(
        configuration: PreviewConfiguration = .default,
        securityPolicy: SecurityPolicy = .restrictive
    ) {
        self.configuration = configuration
        self.securityPolicy = securityPolicy
    }

    public var body: some View {
        VStack(spacing: 0) {
            // Navigation controls
            if configuration.showControls {
                navigationControls
            }

            // Progress indicator
            if isLoading && configuration.showProgress {
                ProgressView(value: loadProgress, total: 1.0)
                    .progressViewStyle(LinearProgressViewStyle())
                    .frame(height: 4)
            }

            // WebView content
            WebViewRepresentable(
                webView: $webView,
                isLoading: $isLoading,
                loadProgress: $loadProgress,
                canGoBack: $canGoBack,
                canGoForward: $canGoForward,
                currentURL: $currentURL,
                error: $error,
                configuration: configuration,
                securityPolicy: securityPolicy
            )
            .clipped()
        }
        .alert("Web Content Error", isPresented: .constant(error != nil)) {
            Button("Dismiss") { error = nil }
            if let error = error, error.isRetryable {
                Button("Retry") { retryLastRequest() }
            }
        } message: {
            if let error = error {
                Text(error.localizedDescription)
            }
        }
    }

    // MARK: - Navigation Controls

    @ViewBuilder
    private var navigationControls: some View {
        HStack(spacing: 12) {
            // Back button
            Button(action: goBack) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 16, weight: .medium))
            }
            .disabled(!canGoBack)

            // Forward button
            Button(action: goForward) {
                Image(systemName: "chevron.right")
                    .font(.system(size: 16, weight: .medium))
            }
            .disabled(!canGoForward)

            // Reload button
            Button(action: reload) {
                Image(systemName: isLoading ? "xmark" : "arrow.clockwise")
                    .font(.system(size: 16, weight: .medium))
            }

            Spacer()

            // URL indicator
            if let currentURL = currentURL {
                Text(currentURL.host ?? currentURL.absoluteString)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }

            // Security indicator
            securityIndicator
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial)
        .overlay(
            Divider(),
            alignment: .bottom
        )
    }

    @ViewBuilder
    private var securityIndicator: some View {
        Image(systemName: securityPolicy == .restrictive ? "lock.shield" : "lock")
            .font(.system(size: 14))
            .foregroundStyle(securityPolicy == .restrictive ? .green : .orange)
    }

    // MARK: - Navigation Actions

    private func goBack() {
        webView?.goBack()
    }

    private func goForward() {
        webView?.goForward()
    }

    private func reload() {
        if isLoading {
            webView?.stopLoading()
        } else {
            webView?.reload()
        }
    }

    private func retryLastRequest() {
        error = nil
        reload()
    }

    // MARK: - Public Interface

    /// Load web content from URL
    public func loadURL(_ url: URL) {
        guard isURLAllowed(url) else {
            error = .blockedURL(url)
            logger.warning("Blocked URL access: \(url.absoluteString)")
            return
        }

        let request = URLRequest(url: url)
        webView?.load(request)
        logger.debug("Loading URL: \(url.absoluteString)")
    }

    /// Load HTML content directly
    public func loadHTML(_ html: String, baseURL: URL? = nil) {
        let sanitizedHTML = sanitizeHTML(html)
        webView?.loadHTMLString(sanitizedHTML, baseURL: baseURL)
        logger.debug("Loading HTML content (length: \(html.count))")
    }

    /// Load local file from app document directory
    public func loadLocalFile(_ path: String) {
        guard isLocalPathAllowed(path) else {
            error = .blockedPath(path)
            logger.warning("Blocked local file access: \(path)")
            return
        }

        let fileURL = URL(fileURLWithPath: path)
        guard FileManager.default.fileExists(atPath: path) else {
            error = .fileNotFound(path)
            logger.error("File not found: \(path)")
            return
        }

        webView?.loadFileURL(fileURL, allowingReadAccessTo: fileURL.deletingLastPathComponent())
        logger.debug("Loading local file: \(path)")
    }

    /// Execute JavaScript with security validation
    public func evaluateJavaScript(_ script: String) async throws -> Any? {
        guard isJavaScriptAllowed(script) else {
            throw PreviewError.blockedScript
        }

        return try await webView?.evaluateJavaScript(script)
    }
}

// MARK: - WebView Representable

#if canImport(UIKit)
private struct WebViewRepresentable: UIViewRepresentable {
    @Binding var webView: WKWebView?
    @Binding var isLoading: Bool
    @Binding var loadProgress: Double
    @Binding var canGoBack: Bool
    @Binding var canGoForward: Bool
    @Binding var currentURL: URL?
    @Binding var error: PreviewError?

    let configuration: PreviewConfiguration
    let securityPolicy: SecurityPolicy

    func makeUIView(context: Context) -> WKWebView {
        let webView = createSecureWebView(context: context)
        DispatchQueue.main.async {
            self.webView = webView
        }
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        // Update bindings
        isLoading = webView.isLoading
        loadProgress = webView.estimatedProgress
        canGoBack = webView.canGoBack
        canGoForward = webView.canGoForward
        currentURL = webView.url
    }

    private func createSecureWebView(context: Context) -> WKWebView {
        let config = createSecureConfiguration()
        let webView = WKWebView(frame: .zero, configuration: config)

        // Set delegates
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator

        // Configure for security
        webView.allowsBackForwardNavigationGestures = configuration.allowGestures
        webView.allowsLinkPreview = false

        return webView
    }

    private func createSecureConfiguration() -> WKWebViewConfiguration {
        let config = WKWebViewConfiguration()

        // Security policies
        config.applicationNameForUserAgent = "IsometryApp/1.0"

        // Content blocking
        let preferences = WKWebpagePreferences()
        preferences.allowsContentJavaScript = securityPolicy.allowsJavaScript
        config.defaultWebpagePreferences = preferences

        // Process pool isolation
        config.processPool = WKProcessPool()

        // Media policies
        config.allowsInlineMediaPlayback = configuration.allowInlineMedia
        config.allowsAirPlayForMediaPlayback = false
        config.allowsPictureInPictureMediaPlayback = false

        // Data store isolation
        if securityPolicy == .restrictive {
            config.websiteDataStore = WKWebsiteDataStore.nonPersistent()
        }

        return config
    }

    func makeCoordinator() -> WebViewCoordinator {
        WebViewCoordinator(
            isLoading: $isLoading,
            error: $error,
            securityPolicy: securityPolicy
        )
    }
}

#elseif canImport(AppKit)
private struct WebViewRepresentable: NSViewRepresentable {
    @Binding var webView: WKWebView?
    @Binding var isLoading: Bool
    @Binding var loadProgress: Double
    @Binding var canGoBack: Bool
    @Binding var canGoForward: Bool
    @Binding var currentURL: URL?
    @Binding var error: PreviewError?

    let configuration: PreviewConfiguration
    let securityPolicy: SecurityPolicy

    func makeNSView(context: Context) -> WKWebView {
        let webView = createSecureWebView(context: context)
        DispatchQueue.main.async {
            self.webView = webView
        }
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        // Update bindings
        isLoading = webView.isLoading
        loadProgress = webView.estimatedProgress
        canGoBack = webView.canGoBack
        canGoForward = webView.canGoForward
        currentURL = webView.url
    }

    private func createSecureWebView(context: Context) -> WKWebView {
        let config = createSecureConfiguration()
        let webView = WKWebView(frame: .zero, configuration: config)

        // Set delegates
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator

        // Configure for security
        webView.allowsBackForwardNavigationGestures = configuration.allowGestures
        webView.allowsLinkPreview = false

        return webView
    }

    private func createSecureConfiguration() -> WKWebViewConfiguration {
        let config = WKWebViewConfiguration()

        // Security policies
        config.applicationNameForUserAgent = "IsometryApp/1.0"

        // Content blocking
        let preferences = WKWebpagePreferences()
        preferences.allowsContentJavaScript = securityPolicy.allowsJavaScript
        config.defaultWebpagePreferences = preferences

        // Process pool isolation
        config.processPool = WKProcessPool()

        // Media policies
        config.allowsInlineMediaPlayback = configuration.allowInlineMedia
        config.allowsAirPlayForMediaPlayback = false
        config.allowsPictureInPictureMediaPlayback = false

        // Data store isolation
        if securityPolicy == .restrictive {
            config.websiteDataStore = WKWebsiteDataStore.nonPersistent()
        }

        return config
    }

    func makeCoordinator() -> WebViewCoordinator {
        WebViewCoordinator(
            isLoading: $isLoading,
            error: $error,
            securityPolicy: securityPolicy
        )
    }
}
#endif

// MARK: - WebView Coordinator

private class WebViewCoordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
    @Binding var isLoading: Bool
    @Binding var error: PreviewError?

    let securityPolicy: SecurityPolicy
    private let logger = Logger(subsystem: "com.isometry.app", category: "WebViewCoordinator")

    init(
        isLoading: Binding<Bool>,
        error: Binding<PreviewError?>,
        securityPolicy: SecurityPolicy
    ) {
        self._isLoading = isLoading
        self._error = error
        self.securityPolicy = securityPolicy
    }

    // MARK: - Navigation Delegate

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        isLoading = true
        error = nil
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        isLoading = false
        logger.debug("Successfully loaded: \(webView.url?.absoluteString ?? "unknown")")
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        isLoading = false
        self.error = .navigationError(error)
        logger.error("Navigation failed: \(error.localizedDescription)")
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }

        // Security validation
        if !isNavigationAllowed(url, type: navigationAction.navigationType) {
            logger.warning("Blocked navigation to: \(url.absoluteString)")
            error = .blockedURL(url)
            decisionHandler(.cancel)
            return
        }

        decisionHandler(.allow)
    }

    // MARK: - UI Delegate

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        // Block popup windows for security
        if securityPolicy == .restrictive {
            logger.warning("Blocked popup window creation")
            return nil
        }

        // Allow controlled popup creation for permissive policy
        return nil
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptAlertPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping () -> Void
    ) {
        // Block JavaScript alerts in restrictive mode
        if securityPolicy == .restrictive {
            logger.warning("Blocked JavaScript alert")
            completionHandler()
            return
        }

        // Handle alert in permissive mode
        completionHandler()
    }

    // MARK: - Security Validation

    private func isNavigationAllowed(_ url: URL, type: WKNavigationType) -> Bool {
        // Always allow initial loads and reloads
        if type == .reload || type == .other {
            return true
        }

        // Check URL against security policy
        return isURLAllowedByPolicy(url)
    }

    private func isURLAllowedByPolicy(_ url: URL) -> Bool {
        switch securityPolicy {
        case .restrictive:
            return isRestrictiveURLAllowed(url)
        case .permissive:
            return isPermissiveURLAllowed(url)
        }
    }

    private func isRestrictiveURLAllowed(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased() else { return false }

        // Only allow specific schemes
        let allowedSchemes = ["https", "file", "data"]
        guard allowedSchemes.contains(scheme) else { return false }

        // For HTTPS, check against allowlist
        if scheme == "https" {
            return isHostAllowed(url.host)
        }

        // Allow file URLs only within app sandbox
        if scheme == "file" {
            return isFileURLInSandbox(url)
        }

        // Allow data URLs for inline content
        if scheme == "data" {
            return true
        }

        return false
    }

    private func isPermissiveURLAllowed(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased() else { return false }

        // Block dangerous schemes
        let blockedSchemes = ["file", "javascript", "vbscript", "data"]
        return !blockedSchemes.contains(scheme)
    }

    private func isHostAllowed(_ host: String?) -> Bool {
        guard let host = host else { return false }

        // Basic allowlist - can be expanded
        let allowedHosts = [
            "github.com",
            "docs.github.com",
            "developer.apple.com",
            "swift.org"
        ]

        return allowedHosts.contains { allowedHost in
            host == allowedHost || host.hasSuffix("." + allowedHost)
        }
    }

    private func isFileURLInSandbox(_ url: URL) -> Bool {
        let path = url.path
        let fileManager = FileManager.default

        // Check if path is within app sandbox
        let allowedPaths = [
            fileManager.urls(for: .documentDirectory, in: .userDomainMask).first?.path,
            fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first?.path,
            NSTemporaryDirectory()
        ].compactMap { $0 }

        return allowedPaths.contains { allowedPath in
            path.hasPrefix(allowedPath)
        }
    }
}

// MARK: - Security Helper Functions

private func isURLAllowed(_ url: URL) -> Bool {
    guard let scheme = url.scheme?.lowercased() else { return false }

    let allowedSchemes = ["https", "file", "data"]
    return allowedSchemes.contains(scheme)
}

private func isLocalPathAllowed(_ path: String) -> Bool {
    let fileManager = FileManager.default
    let allowedDirectories = [
        fileManager.urls(for: .documentDirectory, in: .userDomainMask).first?.path,
        fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first?.path,
        NSTemporaryDirectory()
    ].compactMap { $0 }

    return allowedDirectories.contains { allowedDir in
        path.hasPrefix(allowedDir)
    }
}

private func isJavaScriptAllowed(_ script: String) -> Bool {
    // Basic script validation - block dangerous patterns
    let blockedPatterns = [
        "eval(",
        "Function(",
        "setTimeout(",
        "setInterval(",
        "document.cookie",
        "localStorage",
        "sessionStorage",
        "XMLHttpRequest",
        "fetch("
    ]

    let lowercaseScript = script.lowercased()
    return !blockedPatterns.contains { pattern in
        lowercaseScript.contains(pattern.lowercased())
    }
}

private func sanitizeHTML(_ html: String) -> String {
    // Basic HTML sanitization
    var sanitized = html

    // Remove script tags
    sanitized = sanitized.replacingOccurrences(
        of: "<script[^>]*>.*?</script>",
        with: "",
        options: [.regularExpression, .caseInsensitive]
    )

    // Remove event handlers
    let eventHandlers = ["onclick", "onload", "onerror", "onmouseover"]
    for handler in eventHandlers {
        sanitized = sanitized.replacingOccurrences(
            of: "\(handler)\\s*=\\s*[\"'][^\"']*[\"']",
            with: "",
            options: [.regularExpression, .caseInsensitive]
        )
    }

    return sanitized
}

// MARK: - Configuration Types

/// Configuration for WebView behavior
public struct PreviewConfiguration {
    let showControls: Bool
    let showProgress: Bool
    let allowGestures: Bool
    let allowInlineMedia: Bool

    public init(
        showControls: Bool = true,
        showProgress: Bool = true,
        allowGestures: Bool = true,
        allowInlineMedia: Bool = false
    ) {
        self.showControls = showControls
        self.showProgress = showProgress
        self.allowGestures = allowGestures
        self.allowInlineMedia = allowInlineMedia
    }

    public static let `default` = PreviewConfiguration()

    public static let minimal = PreviewConfiguration(
        showControls: false,
        showProgress: false,
        allowGestures: false,
        allowInlineMedia: false
    )
}

/// Security policy for content filtering
public enum SecurityPolicy {
    case restrictive  // Strict allowlist, blocks most external content
    case permissive   // Basic filtering, allows most HTTPS content

    var allowsJavaScript: Bool {
        switch self {
        case .restrictive:
            return false
        case .permissive:
            return true
        }
    }
}

/// Preview-specific errors
public enum PreviewError: Error, LocalizedError {
    case blockedURL(URL)
    case blockedPath(String)
    case blockedScript
    case fileNotFound(String)
    case navigationError(Error)
    case securityViolation

    public var errorDescription: String? {
        switch self {
        case .blockedURL(let url):
            return "Access to '\(url.absoluteString)' is blocked by security policy"
        case .blockedPath(let path):
            return "Access to '\(path)' is not allowed"
        case .blockedScript:
            return "JavaScript execution blocked by security policy"
        case .fileNotFound(let path):
            return "File not found: \(path)"
        case .navigationError(let error):
            return "Navigation failed: \(error.localizedDescription)"
        case .securityViolation:
            return "Security policy violation"
        }
    }

    var isRetryable: Bool {
        switch self {
        case .navigationError:
            return true
        default:
            return false
        }
    }
}

// MARK: - Preview Support

#Preview {
    PreviewWebView(
        configuration: .default,
        securityPolicy: .restrictive
    )
    .frame(height: 400)
    .padding()
}