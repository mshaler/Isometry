import SwiftUI
import Isometry

@main
struct IsometryAppMain: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            #if os(macOS)
            // Temporary simple view to test window appears
            if appState.isLoading {
                VStack {
                    ProgressView()
                    Text("Loading Isometry...")
                        .padding()
                    Text("Initializing database...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .frame(minWidth: 400, minHeight: 300)
            } else if let error = appState.error {
                VStack {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.largeTitle)
                        .foregroundColor(.red)
                    Text("Startup Error")
                        .font(.headline)
                    Text(error.localizedDescription)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding()
                }
                .frame(minWidth: 400, minHeight: 300)
            } else {
                MacOSContentView()
                    .environmentObject(appState)
            }
            #else
            ContentView()
                .environmentObject(appState)
            #endif
        }
        #if os(macOS)
        .windowStyle(.hiddenTitleBar)
        .windowToolbarStyle(.unified(showsTitle: false))
        .defaultSize(width: 1200, height: 800)
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("New Note") {
                    // Create new note
                }
                .keyboardShortcut("n", modifiers: .command)

                Button("New Folder") {
                    // Create new folder
                }
                .keyboardShortcut("n", modifiers: [.command, .shift])
            }

            CommandMenu("View") {
                Button("Show Sidebar") {
                    // Toggle sidebar
                }
                .keyboardShortcut("s", modifiers: [.command, .control])

                Divider()

                Button("Zoom In") { }
                    .keyboardShortcut("+", modifiers: .command)

                Button("Zoom Out") { }
                    .keyboardShortcut("-", modifiers: .command)
            }
        }
        #endif

        #if os(macOS)
        Settings {
            MacOSSettingsView()
                .environmentObject(appState)
        }
        #endif
    }
}
