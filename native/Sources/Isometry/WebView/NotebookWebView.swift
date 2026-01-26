import SwiftUI
import WebKit
import Foundation

/// SwiftUI wrapper for WKWebView that runs the React prototype with secure MessageHandler bridge
public struct NotebookWebView: View {
    @StateObject private var webViewStore = WebViewStore()
    @State private var isLoading = true
    @State private var loadingError: String?
    @State private var progress: Double = 0.0

    private let bridge: WebViewBridge

    public init() {
        self.bridge = WebViewBridge()
    }

    public var body: some View {
        ZStack {
            // WebView container
            WebViewRepresentable(
                store: webViewStore,
                bridge: bridge,
                onLoadingStateChange: { loading in
                    isLoading = loading
                },
                onError: { error in
                    loadingError = error
                },
                onProgressChange: { newProgress in
                    progress = newProgress
                }
            )
            .opacity(isLoading ? 0 : 1)

            // Loading overlay
            if isLoading {
                loadingView
            }

            // Error overlay
            if let error = loadingError {
                errorView(error)
            }
        }
        .onAppear {
            loadReactApp()
        }
        .navigationBarHidden(false)
        .navigationTitle("Notebook")
    }

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView(value: progress, total: 1.0)
                .progressViewStyle(LinearProgressViewStyle())
                .frame(maxWidth: 200)

            VStack(spacing: 8) {
                Text("Loading Isometry Notebook")
                    .font(.headline)

                Text("React prototype initializing...")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(32)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
        .transition(.opacity.combined(with: .scale))
    }

    private func errorView(_ error: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
                .font(.largeTitle)

            Text("Failed to Load Notebook")
                .font(.headline)

            Text(error)
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Button("Retry") {
                loadingError = nil
                isLoading = true
                loadReactApp()
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(32)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    }

    private func loadReactApp() {
        guard let reactBundlePath = findReactBundlePath() else {
            loadingError = "React build artifacts not found. Run 'npm run build' in project root."
            isLoading = false
            return
        }

        let indexURL = URL(fileURLWithPath: reactBundlePath).appendingPathComponent("index.html")

        guard FileManager.default.fileExists(atPath: indexURL.path) else {
            loadingError = "React index.html not found at \(indexURL.path)"
            isLoading = false
            return
        }

        webViewStore.loadURL(indexURL)
    }

    /// Find React build artifacts in project bundle or development location
    private func findReactBundlePath() -> String? {
        // First try bundled production build
        if let bundlePath = Bundle.main.path(forResource: "build", ofType: nil) {
            return bundlePath
        }

        // Try development location relative to app bundle
        let appBundlePath = Bundle.main.bundlePath
        let projectRoot = URL(fileURLWithPath: appBundlePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()

        let devBuildPath = projectRoot.appendingPathComponent("dist").path
        if FileManager.default.fileExists(atPath: devBuildPath) {
            return devBuildPath
        }

        // Try legacy build folder
        let legacyBuildPath = projectRoot.appendingPathComponent("build").path
        if FileManager.default.fileExists(atPath: legacyBuildPath) {
            return legacyBuildPath
        }

        return nil
    }
}

/// Store for managing WebView state and interactions
@MainActor
class WebViewStore: ObservableObject {
    @Published var webView: WKWebView?
    @Published var canGoBack = false
    @Published var canGoForward = false
    @Published var isLoading = true

    func configure(with bridge: WebViewBridge) {
        let configuration = WKWebViewConfiguration()

        // Security settings
        configuration.websiteDataStore = WKWebsiteDataStore.nonPersistent()
        configuration.preferences.javaScriptEnabled = true
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false

        // Disable unnecessary web features for security
        configuration.allowsInlineMediaPlayback = false
        configuration.allowsAirPlayForMediaPlayback = false
        configuration.allowsPictureInPictureMediaPlayback = false

        // Register message handlers
        let userContentController = WKUserContentController()
        userContentController.add(bridge.databaseHandler, name: "database")
        userContentController.add(bridge.fileSystemHandler, name: "filesystem")
        configuration.userContentController = userContentController

        // Inject bridge initialization script
        let bridgeScript = WKUserScript(
            source: bridge.bridgeInitializationScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        userContentController.addUserScript(bridgeScript)

        // Custom User-Agent for identification
        configuration.applicationNameForUserAgent = "IsometryNative/1.0"

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = bridge
        webView.uiDelegate = bridge

        // Enable debugging in development
        #if DEBUG
        if #available(iOS 16.4, macOS 13.3, *) {
            webView.isInspectable = true
        }
        #endif

        self.webView = webView
    }

    func loadURL(_ url: URL) {
        guard let webView = webView else { return }

        // Allow loading local files from bundle
        let allowedURL = url.deletingLastPathComponent()
        webView.loadFileURL(url, allowingReadAccessTo: allowedURL)
    }

    func reload() {
        webView?.reload()
    }

    func goBack() {
        webView?.goBack()
    }

    func goForward() {
        webView?.goForward()
    }
}

/// Platform-specific WebView representable
struct WebViewRepresentable: UIViewRepresentable {
    let store: WebViewStore
    let bridge: WebViewBridge
    let onLoadingStateChange: (Bool) -> Void
    let onError: (String) -> Void
    let onProgressChange: (Double) -> Void

    func makeUIView(context: Context) -> WKWebView {
        store.configure(with: bridge)

        guard let webView = store.webView else {
            fatalError("WebView configuration failed")
        }

        // Set up KVO for loading state
        webView.addObserver(
            context.coordinator,
            forKeyPath: #keyPath(WKWebView.isLoading),
            options: [.new],
            context: nil
        )

        webView.addObserver(
            context.coordinator,
            forKeyPath: #keyPath(WKWebView.estimatedProgress),
            options: [.new],
            context: nil
        )

        webView.addObserver(
            context.coordinator,
            forKeyPath: #keyPath(WKWebView.canGoBack),
            options: [.new],
            context: nil
        )

        webView.addObserver(
            context.coordinator,
            forKeyPath: #keyPath(WKWebView.canGoForward),
            options: [.new],
            context: nil
        )

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        // Updates are handled through the store
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(
            store: store,
            onLoadingStateChange: onLoadingStateChange,
            onError: onError,
            onProgressChange: onProgressChange
        )
    }

    class Coordinator: NSObject {
        let store: WebViewStore
        let onLoadingStateChange: (Bool) -> Void
        let onError: (String) -> Void
        let onProgressChange: (Double) -> Void

        init(
            store: WebViewStore,
            onLoadingStateChange: @escaping (Bool) -> Void,
            onError: @escaping (String) -> Void,
            onProgressChange: @escaping (Double) -> Void
        ) {
            self.store = store
            self.onLoadingStateChange = onLoadingStateChange
            self.onError = onError
            self.onProgressChange = onProgressChange
        }

        override func observeValue(
            forKeyPath keyPath: String?,
            of object: Any?,
            change: [NSKeyValueChangeKey : Any]?,
            context: UnsafeMutableRawPointer?
        ) {
            DispatchQueue.main.async { [weak self] in
                guard let self = self, let webView = object as? WKWebView else { return }

                switch keyPath {
                case #keyPath(WKWebView.isLoading):
                    let isLoading = webView.isLoading
                    self.store.isLoading = isLoading
                    self.onLoadingStateChange(isLoading)

                case #keyPath(WKWebView.estimatedProgress):
                    let progress = webView.estimatedProgress
                    self.onProgressChange(progress)

                case #keyPath(WKWebView.canGoBack):
                    self.store.canGoBack = webView.canGoBack

                case #keyPath(WKWebView.canGoForward):
                    self.store.canGoForward = webView.canGoForward

                default:
                    break
                }
            }
        }

        deinit {
            store.webView?.removeObserver(self, forKeyPath: #keyPath(WKWebView.isLoading))
            store.webView?.removeObserver(self, forKeyPath: #keyPath(WKWebView.estimatedProgress))
            store.webView?.removeObserver(self, forKeyPath: #keyPath(WKWebView.canGoBack))
            store.webView?.removeObserver(self, forKeyPath: #keyPath(WKWebView.canGoForward))
        }
    }
}

#if os(macOS)
extension WebViewRepresentable: NSViewRepresentable {
    func makeNSView(context: Context) -> WKWebView {
        return makeUIView(context: context)
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {
        updateUIView(nsView, context: context)
    }
}
#endif

// MARK: - Preview

#Preview {
    NavigationView {
        NotebookWebView()
    }
}