import SwiftUI

/// Preview component for the notebook workflow with integrated Canvas visualization
/// Hosts native Canvas visualization and preview controls with real-time updates
public struct NotebookPreviewView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var notebookContext = NotebookContext()
    @State private var previewMode: PreviewMode = .canvas
    @State private var isLoading = false
    @State private var error: String?

    public init() {}

    public var body: some View {
        VStack(spacing: 0) {
            // Header with preview mode controls
            HStack {
                Image(systemName: "eye.circle")
                    .foregroundStyle(.blue)
                Text("Preview")
                    .font(.headline)
                    .foregroundStyle(.primary)

                Spacer()

                // Preview mode picker
                Picker("Preview Mode", selection: $previewMode) {
                    ForEach(PreviewMode.allCases, id: \.self) { mode in
                        HStack(spacing: 4) {
                            Image(systemName: mode.icon)
                            Text(mode.rawValue)
                        }
                        .tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 200)

                // Performance indicator (visible when Canvas is active)
                if previewMode == .canvas && notebookContext.showPerformanceInfo {
                    PerformanceIndicator(
                        fps: notebookContext.currentFPS,
                        renderQuality: .full
                    )
                }
            }
            .padding()

            Divider()

            // Content area
            ZStack {
                switch previewMode {
                case .canvas:
                    canvasPreviewView
                case .web:
                    webPreviewView
                case .document:
                    documentPreviewView
                }

                // Loading overlay
                if isLoading {
                    loadingOverlay
                }

                // Error overlay
                if let error = error {
                    errorOverlay(message: error)
                }
            }
        }
        .background {
            RoundedRectangle(cornerRadius: 8)
                .fill(.background)
                .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
        }
        .overlay {
            RoundedRectangle(cornerRadius: 8)
                .stroke(.separator, lineWidth: 0.5)
        }
        .environmentObject(notebookContext)
        .task {
            await initializePreview()
        }
        .onChange(of: previewMode) { _, newMode in
            handlePreviewModeChange(newMode)
        }
        .onChange(of: notebookContext.activeCard) { _, _ in
            Task {
                await refreshPreview()
            }
        }
    }

    // MARK: - Preview Mode Views

    @ViewBuilder
    private var canvasPreviewView: some View {
        if let database = appState.database {
            VisualizationCanvas(database: database)
                .clipped()
                .onReceive(notebookContext.$activeCard) { _ in
                    // Update visualization when active card changes
                    Task {
                        await refreshCanvasData()
                    }
                }
        } else {
            Text("Database not available")
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private var webPreviewView: some View {
        // Placeholder for WKWebView integration (Plan 02)
        VStack(spacing: 16) {
            Image(systemName: "safari")
                .font(.system(size: 40))
                .foregroundStyle(.blue)

            VStack(spacing: 8) {
                Text("Web Preview")
                    .font(.title2)
                    .fontWeight(.semibold)

                Text("WKWebView integration will be implemented in Plan 02")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            Button("Export for Web") {
                prepareWebExport()
            }
            .buttonStyle(.bordered)
        }
        .padding()
    }

    @ViewBuilder
    private var documentPreviewView: some View {
        // Placeholder for document preview (Plan 02)
        VStack(spacing: 16) {
            Image(systemName: "doc.richtext")
                .font(.system(size: 40))
                .foregroundStyle(.orange)

            VStack(spacing: 8) {
                Text("Document Preview")
                    .font(.title2)
                    .fontWeight(.semibold)

                Text("Universal content preview will be implemented in Plan 02")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            HStack(spacing: 12) {
                Button("Export PDF") {
                    exportToPDF()
                }
                .buttonStyle(.bordered)

                Button("Share Content") {
                    shareContent()
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding()
    }

    // MARK: - Overlay Views

    private var loadingOverlay: some View {
        ZStack {
            Color.black.opacity(0.2)
                .ignoresSafeArea()

            VStack(spacing: 12) {
                ProgressView()
                    .scaleEffect(1.2)
                Text("Loading preview...")
                    .font(.body)
                    .foregroundStyle(.secondary)
            }
            .padding()
            .background(.thinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }

    private func errorOverlay(message: String) -> some View {
        ZStack {
            Color.black.opacity(0.2)
                .ignoresSafeArea()

            VStack(spacing: 12) {
                Image(systemName: "exclamationmark.triangle")
                    .font(.system(size: 24))
                    .foregroundStyle(.red)

                Text("Preview Error")
                    .font(.headline)

                Text(message)
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)

                Button("Retry") {
                    Task {
                        await retryPreview()
                    }
                }
                .buttonStyle(.borderedProminent)
            }
            .padding()
            .background(.thinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }

    // MARK: - Preview Management

    private func initializePreview() async {
        isLoading = true
        error = nil

        do {
            // Initialize notebook context with database
            if let database = appState.database {
                await notebookContext.initialize(database: database)
            }

            // Set up default state
            previewMode = .canvas
            notebookContext.showPerformanceInfo = true

        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    private func handlePreviewModeChange(_ newMode: PreviewMode) {
        // Update context based on preview mode
        switch newMode {
        case .canvas:
            notebookContext.showPerformanceInfo = true
        case .web, .document:
            notebookContext.showPerformanceInfo = false
        }

        // Track mode change for analytics
        PerformanceMonitor.shared.recordComponentResize(0.1)
    }

    private func refreshPreview() async {
        switch previewMode {
        case .canvas:
            await refreshCanvasData()
        case .web:
            await refreshWebContent()
        case .document:
            await refreshDocumentContent()
        }
    }

    private func refreshCanvasData() async {
        // Canvas automatically refreshes through data adapter
        // This is called when active card changes
    }

    private func refreshWebContent() async {
        // Implementation for Plan 02
    }

    private func refreshDocumentContent() async {
        // Implementation for Plan 02
    }

    private func retryPreview() async {
        error = nil
        await refreshPreview()
    }

    // MARK: - Export Actions (Placeholder for Plan 02)

    private func prepareWebExport() {
        print("Preparing web export - to be implemented in Plan 02")
    }

    private func exportToPDF() {
        print("Exporting to PDF - to be implemented in Plan 02")
    }

    private func shareContent() {
        print("Sharing content - to be implemented in Plan 02")
    }
}

// MARK: - Supporting Types

/// Preview mode enumeration
public enum PreviewMode: String, CaseIterable {
    case canvas = "Canvas"
    case web = "Web"
    case document = "Document"

    var icon: String {
        switch self {
        case .canvas:
            return "circles.hexagongrid"
        case .web:
            return "safari"
        case .document:
            return "doc.richtext"
        }
    }
}

/// Notebook context for managing active card and visualization state
@MainActor
public class NotebookContext: ObservableObject {
    @Published public var activeCard: VisualizationNotebookCard?
    @Published public var showPerformanceInfo = false
    @Published public var currentFPS: Double = 60.0

    private var database: IsometryDatabase?

    public init() {}

    public func initialize(database: IsometryDatabase) async {
        self.database = database
        // Load initial data
    }

    public func setActiveCard(_ card: VisualizationNotebookCard?) {
        activeCard = card
    }

    public func updatePerformanceInfo(fps: Double) {
        currentFPS = fps
    }
}

// MARK: - Preview

#Preview {
    NotebookPreviewView()
        .environmentObject(AppState())
        .padding()
        .background(.background.secondary)
}