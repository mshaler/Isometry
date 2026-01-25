import SwiftUI
import Isometry

@main
struct IsometryAppMain: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            MacOSContentView()
                .environmentObject(appState)
        }
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

        Settings {
            MacOSSettingsView()
                .environmentObject(appState)
        }
    }
}