import SwiftUI
import WebKit

struct ContentView: View {
    /// BridgeManager is owned by IsometryApp and passed in via init.
    /// Using @ObservedObject (not @StateObject) because lifecycle is managed by the parent.
    @ObservedObject var bridgeManager: BridgeManager
    @State private var webView: WKWebView?

    var body: some View {
        ZStack {
            if let webView = webView {
                WebViewContainer(webView: webView)
                    .ignoresSafeArea()
            }

            // Crash recovery overlay (SHELL-05)
            // Shown when WebContent process terminates unexpectedly.
            // Auto-dismisses when JS signals native:ready after reload.
            if bridgeManager.showingRecoveryOverlay {
                recoveryOverlay
            }
        }
        .onAppear {
            setupWebView()
        }
    }

    // MARK: - Recovery Overlay

    private var recoveryOverlay: some View {
        ZStack {
            Color.black.opacity(0.5)
                .ignoresSafeArea()
            VStack(spacing: 16) {
                ProgressView()
                    .scaleEffect(1.5)
                Text("Restoring...")
                    .font(.headline)
                    .foregroundColor(.white)
                Text("Your data is safe")
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.7))
            }
            .padding(40)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
        }
    }

    // MARK: - WebView Setup

    private func setupWebView() {
        let config = WKWebViewConfiguration()

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

        // Register bridge handler BEFORE creating WKWebView
        bridgeManager.register(with: config)

        // Register custom URL scheme handler for serving bundled web assets
        config.setURLSchemeHandler(AssetsSchemeHandler(), forURLScheme: "app")

        let wv = WKWebView(frame: .zero, configuration: config)

        #if DEBUG
        wv.isInspectable = true
        #endif

        // Connect BridgeManager to webView (sets weak ref + navigationDelegate)
        bridgeManager.configure(webView: wv)

        // Wire DatabaseManager for checkpoint persistence
        do {
            bridgeManager.databaseManager = try DatabaseManager()
        } catch {
            print("[Isometry] Failed to initialize DatabaseManager: \(error)")
            // App still functions without persistence — data will not survive relaunch
        }

        // Load the bundled web app via custom scheme
        wv.load(URLRequest(url: URL(string: "app://localhost/index.html")!))

        self.webView = wv
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
