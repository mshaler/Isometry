import SwiftUI
import WebKit
import UniformTypeIdentifiers
#if os(macOS)
import AppKit
#endif

// MARK: - UTType Extension

extension UTType {
    static let xlsx = UTType(filenameExtension: "xlsx")
        ?? UTType(importedAs: "org.openxmlformats.spreadsheetml.sheet")
}

// MARK: - Notification Names

extension Notification.Name {
    static let importFile = Notification.Name("works.isometry.importFile")
    static let undoAction = Notification.Name("works.isometry.undo")
    static let redoAction = Notification.Name("works.isometry.redo")
}

// MARK: - View Model

/// Maps display names to JavaScript viewType strings and SF Symbols.
struct IsometryView: Identifiable, Hashable {
    let id: String          // JS viewType key: "list", "grid", etc.
    let displayName: String
    let systemImage: String
}

private let isometryViews: [IsometryView] = [
    IsometryView(id: "grid",      displayName: "Grid",      systemImage: "square.grid.2x2"),
    IsometryView(id: "list",      displayName: "List",      systemImage: "list.bullet"),
    IsometryView(id: "kanban",    displayName: "Kanban",    systemImage: "rectangle.3.group"),
    IsometryView(id: "calendar",  displayName: "Calendar",  systemImage: "calendar"),
    IsometryView(id: "timeline",  displayName: "Timeline",  systemImage: "timeline.selection"),
    IsometryView(id: "network",   displayName: "Network",   systemImage: "point.3.connected.trianglepath.dotted"),
    IsometryView(id: "tree",      displayName: "Tree",      systemImage: "list.bullet.indent"),
    IsometryView(id: "gallery",   displayName: "Gallery",   systemImage: "square.grid.3x3"),
    IsometryView(id: "supergrid", displayName: "SuperGrid", systemImage: "tablecells"),
]

// MARK: - ContentView

struct ContentView: View {
    /// BridgeManager is owned by IsometryApp and passed in via init.
    /// Using @ObservedObject (not @StateObject) because lifecycle is managed by the parent.
    @ObservedObject var bridgeManager: BridgeManager
    @State private var webView: WKWebView?

    // MARK: Navigation State

    /// Sidebar visibility — collapsed by default to maximise D3 canvas area (CHRM-01).
    @State private var columnVisibility = NavigationSplitViewVisibility.detailOnly
    /// Currently selected view (matches JS viewType key).
    /// Optional binding required for single-selection List on iOS.
    @State private var selectedViewID: String? = "list"
    /// iPhone compact-width sheet state (CHRM-02).
    @State private var showingViewPicker = false
    /// File import picker state (FILE-01).
    @State private var showingImporter = false
    /// File too large alert state (FILE-04).
    @State private var showingFileTooLargeAlert = false

    @Environment(\.horizontalSizeClass) private var sizeClass

    // MARK: - Body

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            // MARK: Sidebar (iPad / macOS)
            List(selection: $selectedViewID) {
                ForEach(isometryViews) { view in
                    Label(view.displayName, systemImage: view.systemImage)
                        .tag(view.id)
                }
            }
            .navigationTitle("Views")
        } detail: {
            // MARK: Detail Pane — web content + recovery overlay
            ZStack {
                if let webView = webView {
                    WebViewContainer(webView: webView)
                        .ignoresSafeArea(edges: .bottom)
                }

                // Crash recovery overlay (SHELL-05)
                // Shown when WebContent process terminates unexpectedly.
                // Auto-dismisses when JS signals native:ready after reload.
                if bridgeManager.showingRecoveryOverlay {
                    recoveryOverlay
                }
            }
            .toolbar {
                // MARK: Sidebar Toggle (iPad/macOS only)
                #if os(iOS)
                if sizeClass != .compact {
                    ToolbarItem(placement: .navigationBarLeading) {
                        Button {
                            withAnimation {
                                columnVisibility = columnVisibility == .detailOnly ? .all : .detailOnly
                            }
                        } label: {
                            Image(systemName: "sidebar.left")
                        }
                    }
                }
                #else
                ToolbarItem(placement: .navigation) {
                    Button {
                        withAnimation {
                            columnVisibility = columnVisibility == .detailOnly ? .all : .detailOnly
                        }
                    } label: {
                        Image(systemName: "sidebar.left")
                    }
                }
                #endif

                // MARK: Import Button (all platforms)
                // Posts notification — fileImporter modifier added in Plan 02.
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        NotificationCenter.default.post(name: .importFile, object: nil)
                    } label: {
                        Image(systemName: "square.and.arrow.down")
                    }
                }

                // MARK: View Picker Button (iPhone compact only — CHRM-02)
                #if os(iOS)
                if sizeClass == .compact {
                    ToolbarItem(placement: .bottomBar) {
                        Button { showingViewPicker = true } label: {
                            Label("Views", systemImage: "rectangle.3.group")
                        }
                    }
                }
                #endif
            }
        }
        // MARK: iPhone View Picker Sheet
        .sheet(isPresented: $showingViewPicker) {
            NavigationStack {
                List {
                    ForEach(isometryViews) { view in
                        Button {
                            selectedViewID = view.id
                            showingViewPicker = false
                        } label: {
                            Label(view.displayName, systemImage: view.systemImage)
                        }
                        .foregroundStyle(.primary)
                    }
                }
                .navigationTitle("Views")
                #if os(iOS)
                .navigationBarTitleDisplayMode(.inline)
                #endif
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { showingViewPicker = false }
                    }
                }
            }
        }
        // MARK: Lifecycle
        .onAppear {
            setupWebView()
        }
        // MARK: View Switch
        .onChange(of: selectedViewID) { _, newViewID in
            if let newViewID {
                switchView(to: newViewID)
            }
        }
        // MARK: Undo / Redo Notification Handlers
        .onReceive(NotificationCenter.default.publisher(for: .undoAction)) { _ in
            Task {
                try? await bridgeManager.webView?.evaluateJavaScript(
                    "window.__isometry?.mutationManager?.undo()"
                )
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .redoAction)) { _ in
            Task {
                try? await bridgeManager.webView?.evaluateJavaScript(
                    "window.__isometry?.mutationManager?.redo()"
                )
            }
        }
        // MARK: File Import (FILE-01, FILE-02)
        .onReceive(NotificationCenter.default.publisher(for: .importFile)) { _ in
            #if os(macOS)
            showOpenPanel()
            #else
            showingImporter = true
            #endif
        }
        #if os(iOS)
        .fileImporter(
            isPresented: $showingImporter,
            allowedContentTypes: [.json, .plainText, .commaSeparatedText, .xlsx],
            allowsMultipleSelection: false
        ) { result in
            handleFileImportResult(result)
        }
        #endif
        .alert("File Too Large", isPresented: $showingFileTooLargeAlert) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Please select a file smaller than 50 MB.")
        }
    }

    // MARK: - View Switching

    /// Instructs the web runtime to switch to the given view type.
    private func switchView(to viewID: String) {
        let js = "window.__isometry?.viewManager?.switchTo('\(viewID)', window.__isometry?.viewFactory?.['\(viewID)'])"
        Task {
            try? await bridgeManager.webView?.evaluateJavaScript(js)
        }
    }

    // MARK: - File Import (FILE-01 through FILE-04)

    #if os(macOS)
    private func showOpenPanel() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.json, .plainText, .commaSeparatedText, .xlsx]
        panel.allowsMultipleSelection = false
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.prompt = "Import"

        guard panel.runModal() == .OK, let url = panel.url else { return }
        processImportedFile(url: url, needsSecurityScope: false)
    }
    #endif

    private func handleFileImportResult(_ result: Result<[URL], Error>) {
        switch result {
        case .failure(let error):
            print("[FileImport] Picker error: \(error.localizedDescription)")
        case .success(let urls):
            guard let url = urls.first else { return }
            processImportedFile(url: url, needsSecurityScope: true)
        }
    }

    private func processImportedFile(url: URL, needsSecurityScope: Bool) {
        // Security scope (iOS sandboxed file access)
        if needsSecurityScope {
            guard url.startAccessingSecurityScopedResource() else {
                print("[FileImport] Access denied to: \(url)")
                return
            }
        }
        defer {
            if needsSecurityScope {
                url.stopAccessingSecurityScopedResource()
            }
        }

        // Size check (FILE-04): 50MB cap
        let resourceValues = try? url.resourceValues(forKeys: [.fileSizeKey])
        let fileSize = resourceValues?.fileSize ?? 0
        let maxBytes = 50 * 1024 * 1024
        guard fileSize <= maxBytes else {
            showingFileTooLargeAlert = true
            return
        }

        // Read file bytes
        guard let data = try? Data(contentsOf: url) else {
            print("[FileImport] Failed to read file: \(url.lastPathComponent)")
            return
        }

        // Determine ETL source type from extension
        let ext = url.pathExtension.lowercased()
        let source = etlSource(for: ext)
        let filename = url.lastPathComponent

        // For text formats: decode to UTF-8 string
        // For binary (xlsx): base64 encode
        // CRITICAL: ETL parsers expect UTF-8 text for json/csv/markdown,
        // but base64 for xlsx (Pitfall 5 from RESEARCH.md)
        if ext == "xlsx" {
            let base64 = data.base64EncodedString()
            bridgeManager.sendFileImport(data: base64, source: source, filename: filename)
        } else {
            guard let text = String(data: data, encoding: .utf8) else {
                print("[FileImport] File is not valid UTF-8: \(filename)")
                return
            }
            bridgeManager.sendFileImport(data: text, source: source, filename: filename)
        }
    }

    private func etlSource(for ext: String) -> String {
        switch ext {
        case "json":       return "json"
        case "md", "txt":  return "markdown"
        case "csv":        return "csv"
        case "xlsx":       return "excel"
        default:           return "json"
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

        // Wire DatabaseManager for checkpoint persistence.
        // Uses async factory to resolve iCloud ubiquity container on background thread
        // without blocking WebView loading (Pitfall 1: url(forUbiquityContainerIdentifier:) blocks).
        // DatabaseManager will be ready before the first 30s checkpoint save is needed.
        Task {
            do {
                bridgeManager.databaseManager = try await DatabaseManager.makeForProduction()
            } catch {
                print("[Isometry] Failed to initialize DatabaseManager: \(error)")
                // App still functions without persistence — data will not survive relaunch
            }
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
