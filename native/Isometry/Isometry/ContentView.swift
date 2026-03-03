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

        // Allow inline media playback (iOS only — macOS doesn't have this property)
        #if os(iOS)
        config.allowsInlineMediaPlayback = true
        #endif

        // Forward JS console.log/warn/error to Xcode console (DEBUG only)
        #if DEBUG
        let consoleScript = WKUserScript(
            source: """
            (function() {
                var origLog = console.log;
                var origWarn = console.warn;
                var origError = console.error;
                function stringify(a) {
                    if (a instanceof Error) return a.message + (a.code ? ' [' + a.code + ']' : '') + (a.stack ? '\\n' + a.stack : '');
                    if (typeof a === 'object' && a !== null) try { return JSON.stringify(a); } catch(e) { return String(a); }
                    return String(a);
                }
                function send(level, args) {
                    try {
                        var parts = [];
                        for (var i = 0; i < args.length; i++) parts.push(stringify(args[i]));
                        window.webkit.messageHandlers.consoleLog.postMessage(level + ': ' + parts.join(' '));
                    } catch(e) {}
                }
                console.log = function() { send('LOG', arguments); origLog.apply(console, arguments); };
                console.warn = function() { send('WARN', arguments); origWarn.apply(console, arguments); };
                console.error = function() { send('ERROR', arguments); origError.apply(console, arguments); };
                window.addEventListener('error', function(e) {
                    send('UNCAUGHT', [e.message, 'at', e.filename + ':' + e.lineno]);
                });
                window.addEventListener('unhandledrejection', function(e) {
                    send('REJECTION', [e.reason instanceof Error ? e.reason.message : String(e.reason)]);
                });
            })();
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
        config.userContentController.addUserScript(consoleScript)
        config.userContentController.add(ConsoleLogHandler(), name: "consoleLog")
        #endif

        // Register custom URL scheme handler for serving bundled web assets
        config.setURLSchemeHandler(AssetsSchemeHandler(), forURLScheme: "app")

        let webView = WKWebView(frame: .zero, configuration: config)

        #if DEBUG
        webView.isInspectable = true
        #endif

        // Load the bundled web app via custom scheme
        webView.load(URLRequest(url: URL(string: "app://localhost/index.html")!))

        return webView
    }
}

#if DEBUG
/// Receives JS console messages and prints them to Xcode console
class ConsoleLogHandler: NSObject, WKScriptMessageHandler {
    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        if let body = message.body as? String {
            print("[JS] \(body)")
        }
    }
}
#endif
