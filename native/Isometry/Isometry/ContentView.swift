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
    static let importFromSource = Notification.Name("works.isometry.importFromSource")
    static let undoAction = Notification.Name("works.isometry.undo")
    static let redoAction = Notification.Name("works.isometry.redo")
    static let pickAltoDirectory = Notification.Name("works.isometry.pickAltoDirectory")

    // View switching — menu bar Cmd+1-9 (KEYS-02)
    static let switchToList = Notification.Name("works.isometry.switchToList")
    static let switchToGrid = Notification.Name("works.isometry.switchToGrid")
    static let switchToKanban = Notification.Name("works.isometry.switchToKanban")
    static let switchToCalendar = Notification.Name("works.isometry.switchToCalendar")
    static let switchToTimeline = Notification.Name("works.isometry.switchToTimeline")
    static let switchToGallery = Notification.Name("works.isometry.switchToGallery")
    static let switchToNetwork = Notification.Name("works.isometry.switchToNetwork")
    static let switchToTree = Notification.Name("works.isometry.switchToTree")
    static let switchToSupergrid = Notification.Name("works.isometry.switchToSupergrid")
}

// MARK: - ContentView

struct ContentView: View {
    @ObservedObject var bridgeManager: BridgeManager
    @ObservedObject var subscriptionManager: SubscriptionManager
    @ObservedObject var metricKitSubscriber: MetricKitSubscriber
    @AppStorage("theme") private var theme: String = "dark"

    // MARK: Sheet State

    @State private var showingImporter = false
    @State private var showingFileTooLargeAlert = false
    @State private var showingSettings = false
    @State private var showingPaywall = false
    @State private var showingImportSourcePicker = false
    @StateObject private var importCoordinator = NativeImportCoordinator()
    @State private var showingPermissionSheet = false
    @State private var pendingImportSourceType: String?
    @State private var pendingPermissionState: PermissionStatus = .notDetermined
    @AppStorage("hasSeenWelcome") private var hasSeenWelcome = false
    @State private var showingWelcome = false
    @State private var showingAltoDirectoryPicker = false

    @Environment(\.horizontalSizeClass) private var sizeClass

    private var preferredScheme: ColorScheme? {
        switch theme {
        case "light": return .light
        case "dark": return .dark
        default: return nil
        }
    }

    // MARK: - Body

    var body: some View {
        // Full-bleed web content — DockNav (web) owns all navigation.
        // No NavigationSplitView sidebar — macOS uses Designer Workbench,
        // iOS will use Story Explorer (future).
        ZStack {
            if let webView = bridgeManager.webView {
                WebViewContainer(webView: webView)
                    .ignoresSafeArea(edges: .bottom)
            }

            // Sync error banner (SUXR-01)
            if let syncStatus = bridgeManager.syncStatusPublisher {
                VStack {
                    SyncErrorBanner(
                        statusPublisher: syncStatus,
                        onRetry: {
                            Task { await bridgeManager.syncManager?.fetchChanges() }
                        },
                        onDismiss: {}
                    )
                    Spacer()
                }
            }

            // Crash recovery overlay (SHELL-05)
            if bridgeManager.showingRecoveryOverlay {
                recoveryOverlay
            }
        }
        .toolbar {
            // MARK: Sync Status (SYNC-09)
            if let syncStatus = bridgeManager.syncStatusPublisher {
                #if os(iOS)
                ToolbarItem(placement: .navigationBarLeading) {
                    SyncStatusView(statusPublisher: syncStatus)
                }
                #else
                ToolbarItem(placement: .navigation) {
                    SyncStatusView(statusPublisher: syncStatus)
                }
                #endif
            }

            // MARK: Import Menu (file + native) — gated by FeatureGate (TIER-04)
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button {
                        if FeatureGate.isAllowed(.fileImport, for: subscriptionManager.currentTier) {
                            NotificationCenter.default.post(name: .importFile, object: nil)
                        } else {
                            showingPaywall = true
                        }
                    } label: {
                        Label("Import File...", systemImage: "doc")
                    }

                    Button {
                        showingImportSourcePicker = true
                    } label: {
                        Label("Import from...", systemImage: "arrow.down.app")
                    }
                } label: {
                    Image(systemName: "square.and.arrow.down")
                }
            }

            // MARK: Settings Button (always visible — TIER-03)
            ToolbarItem(placement: .secondaryAction) {
                Button {
                    showingSettings = true
                } label: {
                    Image(systemName: "gearshape")
                }
            }
        }
        // MARK: Theme Sync
        .preferredColorScheme(preferredScheme)
        .onChange(of: theme) { _, newTheme in
            let js = "window.__isometry?.themeProvider?.setTheme('\(newTheme)')"
            Task { try? await bridgeManager.webView?.evaluateJavaScript(js) }
        }
        // MARK: Lifecycle
        .onAppear {
            let savedTheme = UserDefaults.standard.string(forKey: "theme") ?? "dark"
            bridgeManager.setupWebViewIfNeeded(savedTheme: savedTheme)
            bridgeManager.importCoordinator = importCoordinator
            if !hasSeenWelcome {
                showingWelcome = true
            }
        }
        // MARK: Undo / Redo
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
        // MARK: View Switch — Cmd+1-9 menu bar shortcuts (KEYS-02)
        // Notifications posted by IsometryApp menu commands → direct JS evaluation.
        // No sidebar binding — DockNav in the web layer handles active state.
        .onReceive(NotificationCenter.default.publisher(for: .switchToList)) { _ in switchView(to: "list") }
        .onReceive(NotificationCenter.default.publisher(for: .switchToGrid)) { _ in switchView(to: "grid") }
        .onReceive(NotificationCenter.default.publisher(for: .switchToKanban)) { _ in switchView(to: "kanban") }
        .onReceive(NotificationCenter.default.publisher(for: .switchToCalendar)) { _ in switchView(to: "calendar") }
        .onReceive(NotificationCenter.default.publisher(for: .switchToTimeline)) { _ in switchView(to: "timeline") }
        .onReceive(NotificationCenter.default.publisher(for: .switchToGallery)) { _ in switchView(to: "gallery") }
        .onReceive(NotificationCenter.default.publisher(for: .switchToNetwork)) { _ in switchView(to: "network") }
        .onReceive(NotificationCenter.default.publisher(for: .switchToTree)) { _ in switchView(to: "tree") }
        .onReceive(NotificationCenter.default.publisher(for: .switchToSupergrid)) { _ in switchView(to: "supergrid") }
        // MARK: File Import (FILE-01, FILE-02)
        .onReceive(NotificationCenter.default.publisher(for: .importFile)) { _ in
            #if os(macOS)
            showOpenPanel()
            #else
            showingImporter = true
            #endif
        }
        .onReceive(NotificationCenter.default.publisher(for: .importFromSource)) { _ in
            showingImportSourcePicker = true
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
        // MARK: Settings Sheet (TIER-03)
        .sheet(isPresented: $showingSettings) {
            SettingsView(
                subscriptionManager: subscriptionManager,
                metricKitSubscriber: metricKitSubscriber,
                syncManager: bridgeManager.syncManager
            )
        }
        // MARK: Paywall Sheet (TIER-04)
        .sheet(isPresented: $showingPaywall) {
            PaywallView(subscriptionManager: subscriptionManager)
        }
        // MARK: Import Source Picker Sheet (FNDX-01)
        .sheet(isPresented: $showingImportSourcePicker) {
            ImportSourcePickerView { sourceType in
                Task {
                    await runNativeImport(sourceType: sourceType)
                }
            }
        }
        // MARK: Permission Sheet (Phase 34+35)
        .sheet(isPresented: $showingPermissionSheet) {
            if let sourceType = pendingImportSourceType {
                PermissionSheetView(
                    sourceType: sourceType,
                    permissionState: pendingPermissionState,
                    onGranted: {
                        Task {
                            await runNativeImport(sourceType: sourceType)
                        }
                    },
                    onOpenSettings: {
                        let pm = PermissionManager()
                        pm.openSystemSettings(for: sourceType)
                    }
                )
            }
        }
        // MARK: Welcome Sheet (WLCM-01)
        .sheet(isPresented: $showingWelcome) {
            WelcomeSheet(
                onLoadSampleData: {
                    hasSeenWelcome = true
                    showingWelcome = false
                    Task {
                        try? await bridgeManager.webView?.evaluateJavaScript(
                            "window.__isometry?.sampleDataManager?.generate()"
                        )
                    }
                },
                onStartEmpty: {
                    hasSeenWelcome = true
                    showingWelcome = false
                }
            )
        }
        // MARK: Alto-Index Directory Picker (DISC-01)
        .onReceive(NotificationCenter.default.publisher(for: .pickAltoDirectory)) { _ in
            showingAltoDirectoryPicker = true
        }
        .onChange(of: showingAltoDirectoryPicker) { _, isShowing in
            guard isShowing else { return }
            showingAltoDirectoryPicker = false
            #if os(macOS)
            let panel = NSOpenPanel()
            panel.title = "Choose Alto-Index Folder"
            panel.canChooseDirectories = true
            panel.canChooseFiles = false
            panel.allowsMultipleSelection = false
            panel.canCreateDirectories = false
            if panel.runModal() == .OK, let url = panel.url {
                discoverAltoIndex(at: url)
            }
            #endif
        }
        #if os(iOS)
        .fileImporter(
            isPresented: $showingAltoDirectoryPicker,
            allowedContentTypes: [.folder],
            onCompletion: { result in
                if case .success(let url) = result {
                    discoverAltoIndex(at: url)
                }
            }
        )
        #endif
        // MARK: Tier Change → Re-send LaunchPayload (TIER-03)
        .onChange(of: subscriptionManager.currentTier) { _, newTier in
            Task {
                await bridgeManager.sendLaunchPayload()
            }
        }
    }

    // MARK: - Native Import

    private func runNativeImport(sourceType: String) async {
        importCoordinator.webView = bridgeManager.webView

        let adapter: any NativeImportAdapter
        switch sourceType {
        case "native_reminders":
            adapter = RemindersAdapter()
        case "native_calendar":
            adapter = CalendarAdapter()
        case "native_notes":
            adapter = NotesAdapter()
        case "alto_index":
            showingAltoDirectoryPicker = true
            return
        #if DEBUG
        case "mock":
            adapter = MockAdapter()
        case "mock_large":
            adapter = LargeMockAdapter()
        #endif
        default:
            print("[NativeImport] Unknown source type: \(sourceType)")
            return
        }

        let permission = adapter.checkPermission()
        switch permission {
        case .granted:
            break
        case .notDetermined:
            let result = await adapter.requestPermission()
            guard result == .granted else {
                let currentState = adapter.checkPermission()
                pendingImportSourceType = sourceType
                pendingPermissionState = currentState
                showingPermissionSheet = true
                return
            }
        case .denied, .restricted:
            pendingImportSourceType = sourceType
            pendingPermissionState = permission
            showingPermissionSheet = true
            return
        }

        do {
            try await importCoordinator.runImport(adapter: adapter)
            print("[NativeImport] Import complete for \(sourceType)")
        } catch {
            print("[NativeImport] Import failed: \(error)")
        }
    }

    // MARK: - Alto Index Discovery (DISC-01, DISC-02)

    private func discoverAltoIndex(at url: URL) {
        let gained = url.startAccessingSecurityScopedResource()
        defer { if gained { url.stopAccessingSecurityScopedResource() } }

        let discovered = AltoIndexAdapter.discoverSubdirectories(in: url)
        let rootName = url.lastPathComponent
        let rootPath = url.path

        Task { @MainActor in
            bridgeManager.sendAltoDiscoveryResult(
                rootPath: rootPath,
                rootName: rootName,
                subdirectories: discovered
            )
        }
    }

    // MARK: - View Switching

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

        let resourceValues = try? url.resourceValues(forKeys: [.fileSizeKey])
        let fileSize = resourceValues?.fileSize ?? 0
        let maxBytes = 50 * 1024 * 1024
        guard fileSize <= maxBytes else {
            showingFileTooLargeAlert = true
            return
        }

        guard let data = try? Data(contentsOf: url) else {
            print("[FileImport] Failed to read file: \(url.lastPathComponent)")
            return
        }

        let ext = url.pathExtension.lowercased()
        let source = etlSource(for: ext)
        let filename = url.lastPathComponent

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
