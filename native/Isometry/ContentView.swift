import SwiftUI
import WebKit

struct ContentView: View {
    @State private var webView: WKWebView = ContentView.makeWebView()

    var body: some View {
        WebViewContainer(webView: webView)
            .ignoresSafeArea()
    }

    private static func makeWebView() -> WKWebView {
        let config = WKWebViewConfiguration()

        // Allow inline media playback (needed for any future video content)
        config.allowsInlineMediaPlayback = true

        #if !DEBUG
        // Register custom scheme handler (Release builds only)
        config.setURLSchemeHandler(AssetsSchemeHandler(), forURLScheme: "app")
        #endif

        let webView = WKWebView(frame: .zero, configuration: config)

        #if DEBUG
        // Load from Vite dev server for HMR
        webView.load(URLRequest(url: URL(string: "http://localhost:5173")!))
        // Enable Safari Web Inspector (requires iOS 16.4+ / macOS 13.3+)
        webView.isInspectable = true
        #else
        // Load from bundled app:// scheme
        webView.load(URLRequest(url: URL(string: "app://localhost/index.html")!))
        #endif

        return webView
    }
}
