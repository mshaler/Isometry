import WebKit
import Foundation

/// Coordinates WebView bridge communication between React prototype and native services
/// Manages MessageHandlers, navigation delegation, and bridge initialization
public class WebViewBridge: NSObject {
    // MARK: - Properties

    public let databaseHandler: DatabaseMessageHandler
    public let fileSystemHandler: FileSystemMessageHandler

    private weak var database: IsometryDatabase?
    private let logger = Logger(subsystem: "IsometryWebView", category: "Bridge")

    // MARK: - Initialization

    public init(database: IsometryDatabase? = nil) {
        // Create handlers
        self.databaseHandler = DatabaseMessageHandler(database: database)
        self.fileSystemHandler = FileSystemMessageHandler()
        self.database = database

        super.init()
    }

    /// Connect to database after initialization
    public func connectToDatabase(_ database: IsometryDatabase) {
        self.database = database
        // Update handler with real database
        self.databaseHandler.setDatabase(database)
    }

    // MARK: - Bridge Initialization Script

    /// JavaScript code injected at document start to set up the bridge interface
    public var bridgeInitializationScript: String {
        return """
            (function() {
                // Create bridge namespace
                window._isometryBridge = {
                    pendingRequests: new Map(),
                    requestId: 0,

                    // Generate unique request ID
                    generateRequestId: function() {
                        return 'req_' + (++this.requestId) + '_' + Date.now();
                    },

                    // Send message to native handler
                    sendMessage: function(handler, method, params) {
                        return new Promise((resolve, reject) => {
                            const requestId = this.generateRequestId();

                            // Store promise callbacks
                            this.pendingRequests.set(requestId, { resolve, reject });

                            // Send message to native
                            const message = {
                                id: requestId,
                                method: method,
                                params: params || {}
                            };

                            try {
                                window.webkit.messageHandlers[handler].postMessage(message);
                            } catch (error) {
                                this.pendingRequests.delete(requestId);
                                reject(new Error('Failed to send message: ' + error.message));
                            }

                            // Timeout after 30 seconds
                            setTimeout(() => {
                                if (this.pendingRequests.has(requestId)) {
                                    this.pendingRequests.delete(requestId);
                                    reject(new Error('Request timeout'));
                                }
                            }, 30000);
                        });
                    },

                    // Handle response from native
                    handleResponse: function(response) {
                        const { id, success, result, error } = response;
                        const pending = this.pendingRequests.get(id);

                        if (!pending) {
                            console.warn('Received response for unknown request:', id);
                            return;
                        }

                        this.pendingRequests.delete(id);

                        if (success) {
                            pending.resolve(result);
                        } else {
                            pending.reject(new Error(error || 'Unknown error'));
                        }
                    },

                    // Database operations
                    database: {
                        execute: function(sql, params) {
                            return window._isometryBridge.sendMessage('database', 'execute', { sql, params });
                        },

                        getNodes: function(options = {}) {
                            return window._isometryBridge.sendMessage('database', 'getNodes', options);
                        },

                        createNode: function(node) {
                            return window._isometryBridge.sendMessage('database', 'createNode', { node });
                        },

                        updateNode: function(node) {
                            return window._isometryBridge.sendMessage('database', 'updateNode', { node });
                        },

                        deleteNode: function(id) {
                            return window._isometryBridge.sendMessage('database', 'deleteNode', { id });
                        },

                        search: function(query, options = {}) {
                            return window._isometryBridge.sendMessage('database', 'search',
                                { query, ...options });
                        },

                        getGraph: function(options = {}) {
                            return window._isometryBridge.sendMessage('database', 'getGraph', options);
                        },

                        reset: function() {
                            return window._isometryBridge.sendMessage('database', 'reset', {});
                        }
                    },

                    // File system operations
                    filesystem: {
                        readFile: function(path) {
                            return window._isometryBridge.sendMessage('filesystem', 'readFile', { path });
                        },

                        writeFile: function(path, content) {
                            return window._isometryBridge.sendMessage('filesystem', 'writeFile',
                                { path, content });
                        },

                        deleteFile: function(path) {
                            return window._isometryBridge.sendMessage('filesystem', 'deleteFile', { path });
                        },

                        listFiles: function(path) {
                            return window._isometryBridge.sendMessage('filesystem', 'listFiles', { path });
                        },

                        fileExists: function(path) {
                            return window._isometryBridge.sendMessage('filesystem', 'fileExists', { path });
                        }
                    },

                    // Environment detection
                    environment: {
                        isNative: true,
                        platform: '\(platformString)',
                        version: '\(bundleVersion)',
                        transport: 'webview-bridge'
                    }
                };

                // Legacy compatibility - expose database directly for existing React code
                window.isometryDatabase = window._isometryBridge.database;
                window.isometryFilesystem = window._isometryBridge.filesystem;

                // Signal that bridge is ready
                window.dispatchEvent(new CustomEvent('isometry-bridge-ready'));

                console.log('Isometry WebView Bridge initialized');
            })();
        """
    }

    private var platformString: String {
        #if os(iOS)
        return "iOS"
        #else
        return "macOS"
        #endif
    }

    private var bundleVersion: String {
        return Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
    }

    // MARK: - Message Handling

    /// Handle incoming message from WebView
    public func handleMessage(_ message: WKScriptMessage) async {
        let handlerName = message.name
        logger.debug("Received WebView message for handler: \(handlerName)")

        switch handlerName {
        case "database":
            databaseHandler.userContentController(message.webView?.configuration.userContentController ?? WKUserContentController(), didReceive: message)

        case "filesystem":
            fileSystemHandler.userContentController(message.webView?.configuration.userContentController ?? WKUserContentController(), didReceive: message)

        default:
            logger.warning("Unknown message handler: \(handlerName)")
            sendError(
                to: message.webView,
                error: "Unknown message handler: \(handlerName)",
                requestId: extractRequestId(from: message)
            )
        }
    }

    private func extractRequestId(from message: WKScriptMessage) -> String? {
        guard let messageBody = message.body as? [String: Any],
              let requestId = messageBody["id"] as? String else {
            return nil
        }
        return requestId
    }

    private func sendError(to webView: WKWebView?, error: String, requestId: String?) {
        guard let webView = webView else { return }

        let response: [String: Any] = [
            "id": requestId ?? "",
            "success": false,
            "error": error
        ]

        do {
            let responseData = try JSONSerialization.data(withJSONObject: response)
            let responseString = String(data: responseData, encoding: .utf8) ?? "{}"

            let script = "window._isometryBridge?.handleResponse(\(responseString))"

            DispatchQueue.main.async {
                webView.evaluateJavaScript(script) { _, error in
                    if let error = error {
                        self.logger.error("Failed to send bridge error: \(error)")
                    }
                }
            }
        } catch {
            logger.error("Failed to serialize bridge error response: \(error)")
        }
    }

    // MARK: - Development & Debugging

    /// Inject development tools and debugging helpers
    public func injectDevelopmentTools(into webView: WKWebView) {
        #if DEBUG
        let devScript = """
            window._isometryBridge.debug = {
                logMessages: true,
                showPerformance: true,

                // Log all bridge calls for debugging
                originalSendMessage: window._isometryBridge.sendMessage,

                init: function() {
                    const self = this;
                    window._isometryBridge.sendMessage = function(handler, method, params) {
                        if (self.logMessages) {
                            console.log('[Bridge]', handler + '.' + method, params);
                        }

                        const start = performance.now();
                        return self.originalSendMessage.call(window._isometryBridge, handler, method, params)
                            .then(result => {
                                if (self.showPerformance) {
                                    const duration = performance.now() - start;
                                    console.log('[Bridge Performance]', handler + '.' + method, duration + 'ms');
                                }
                                return result;
                            });
                    };
                }
            };

            window._isometryBridge.debug.init();
            console.log('WebView bridge debugging enabled');
        """

        webView.evaluateJavaScript(devScript) { _, error in
            if let error = error {
                self.logger.debug("Failed to inject dev tools: \(error)")
            }
        }
        #endif
    }
}

// MARK: - WKNavigationDelegate

extension WebViewBridge: WKNavigationDelegate {
    public func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        logger.debug("WebView started loading")
    }

    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        logger.debug("WebView finished loading")

        // Inject development tools if in debug mode
        #if DEBUG
        injectDevelopmentTools(into: webView)
        #endif
    }

    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        logger.error("WebView navigation failed: \(error.localizedDescription)")
    }

    public func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }

        // Allow file:// URLs for local React app
        if url.isFileURL {
            decisionHandler(.allow)
            return
        }

        // Block external navigation for security
        logger.warning("Blocked external navigation to: \(url)")
        decisionHandler(.cancel)
    }
}

// MARK: - WKUIDelegate

extension WebViewBridge: WKUIDelegate {
    public func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        logger.debug("JavaScript alert: \(message)")
        completionHandler()
    }

    public func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        logger.debug("JavaScript confirm: \(message)")
        completionHandler(true)
    }
}


// MARK: - Logger

/// Simple logging utility for WebView bridge
struct Logger {
    let subsystem: String
    let category: String

    func debug(_ message: String) {
        #if DEBUG
        print("[\(subsystem):\(category)] DEBUG: \(message)")
        #endif
    }

    func warning(_ message: String) {
        print("[\(subsystem):\(category)] WARNING: \(message)")
    }

    func error(_ message: String) {
        print("[\(subsystem):\(category)] ERROR: \(message)")
    }
}