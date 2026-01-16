#if os(macOS)
import SwiftUI

/// macOS Settings/Preferences window
public struct MacOSSettingsView: View {
    public init() {}

    public var body: some View {
        TabView {
            GeneralSettingsTab()
                .tabItem {
                    Label("General", systemImage: "gear")
                }

            SyncSettingsTab()
                .tabItem {
                    Label("Sync", systemImage: "arrow.triangle.2.circlepath")
                }

            AppearanceSettingsTab()
                .tabItem {
                    Label("Appearance", systemImage: "paintbrush")
                }

            ShortcutsSettingsTab()
                .tabItem {
                    Label("Shortcuts", systemImage: "keyboard")
                }
        }
        .frame(width: 500, height: 350)
    }
}

// MARK: - General Settings

struct GeneralSettingsTab: View {
    @AppStorage("defaultFolder") private var defaultFolder = "Notes"
    @AppStorage("showMenuBarIcon") private var showMenuBarIcon = true
    @AppStorage("launchAtLogin") private var launchAtLogin = false

    var body: some View {
        Form {
            Section("Default Behavior") {
                TextField("Default Folder", text: $defaultFolder)

                Toggle("Show in Menu Bar", isOn: $showMenuBarIcon)

                Toggle("Launch at Login", isOn: $launchAtLogin)
            }

            Section("Editor") {
                Picker("Font Size", selection: .constant("Medium")) {
                    Text("Small").tag("Small")
                    Text("Medium").tag("Medium")
                    Text("Large").tag("Large")
                }

                Toggle("Show line numbers", isOn: .constant(false))

                Toggle("Spell checking", isOn: .constant(true))
            }
        }
        .formStyle(.grouped)
        .padding()
    }
}

// MARK: - Sync Settings

struct SyncSettingsTab: View {
    @EnvironmentObject private var appState: AppState
    @State private var syncState: SyncState?

    var body: some View {
        Form {
            Section("iCloud Sync") {
                HStack {
                    Text("Status")
                    Spacer()
                    syncStatusBadge
                }

                if let state = syncState {
                    HStack {
                        Text("Last Sync")
                        Spacer()
                        Text(state.lastSyncAt?.formatted() ?? "Never")
                            .foregroundStyle(.secondary)
                    }

                    HStack {
                        Text("Pending Changes")
                        Spacer()
                        Text("\(state.pendingChanges)")
                            .foregroundStyle(.secondary)
                    }

                    if state.conflictCount > 0 {
                        HStack {
                            Text("Conflicts")
                            Spacer()
                            Text("\(state.conflictCount)")
                                .foregroundStyle(.orange)
                        }
                    }
                }

                Button("Sync Now") {
                    Task {
                        await appState.sync()
                        await loadSyncState()
                    }
                }
                .disabled(appState.syncStatus == .syncing)
            }

            Section("Options") {
                Toggle("Auto-sync on changes", isOn: .constant(true))

                Toggle("Sync over cellular", isOn: .constant(false))

                Picker("Sync frequency", selection: .constant("Automatic")) {
                    Text("Automatic").tag("Automatic")
                    Text("Every 5 minutes").tag("5min")
                    Text("Every 15 minutes").tag("15min")
                    Text("Manual").tag("Manual")
                }
            }
        }
        .formStyle(.grouped)
        .padding()
        .task {
            await loadSyncState()
        }
    }

    @ViewBuilder
    private var syncStatusBadge: some View {
        HStack(spacing: 6) {
            switch appState.syncStatus {
            case .idle:
                Circle()
                    .fill(.gray)
                    .frame(width: 8, height: 8)
                Text("Ready")
            case .syncing:
                ProgressView()
                    .scaleEffect(0.6)
                Text("Syncing...")
            case .synced:
                Circle()
                    .fill(.green)
                    .frame(width: 8, height: 8)
                Text("Synced")
            case .error:
                Circle()
                    .fill(.red)
                    .frame(width: 8, height: 8)
                Text("Error")
            }
        }
        .foregroundStyle(.secondary)
    }

    private func loadSyncState() async {
        guard let db = appState.database else { return }
        do {
            syncState = try await db.getSyncState()
        } catch {
            print("Failed to load sync state: \(error)")
        }
    }
}

// MARK: - Appearance Settings

struct AppearanceSettingsTab: View {
    @AppStorage("theme") private var theme = "system"
    @AppStorage("accentColor") private var accentColor = "blue"
    @AppStorage("sidebarIconStyle") private var sidebarIconStyle = "filled"

    var body: some View {
        Form {
            Section("Theme") {
                Picker("Appearance", selection: $theme) {
                    Text("System").tag("system")
                    Text("Light").tag("light")
                    Text("Dark").tag("dark")
                    Text("NeXTSTEP").tag("nextstep")
                }
                .pickerStyle(.radioGroup)
            }

            Section("Colors") {
                Picker("Accent Color", selection: $accentColor) {
                    HStack {
                        Circle().fill(.blue).frame(width: 12, height: 12)
                        Text("Blue")
                    }.tag("blue")
                    HStack {
                        Circle().fill(.purple).frame(width: 12, height: 12)
                        Text("Purple")
                    }.tag("purple")
                    HStack {
                        Circle().fill(.pink).frame(width: 12, height: 12)
                        Text("Pink")
                    }.tag("pink")
                    HStack {
                        Circle().fill(.orange).frame(width: 12, height: 12)
                        Text("Orange")
                    }.tag("orange")
                    HStack {
                        Circle().fill(.green).frame(width: 12, height: 12)
                        Text("Green")
                    }.tag("green")
                }
            }

            Section("Sidebar") {
                Picker("Icon Style", selection: $sidebarIconStyle) {
                    Text("Filled").tag("filled")
                    Text("Outlined").tag("outlined")
                }
                .pickerStyle(.segmented)

                Toggle("Show item counts", isOn: .constant(true))
            }
        }
        .formStyle(.grouped)
        .padding()
    }
}

// MARK: - Shortcuts Settings

struct ShortcutsSettingsTab: View {
    var body: some View {
        Form {
            Section("Navigation") {
                KeyboardShortcutRow(action: "New Note", shortcut: "⌘N")
                KeyboardShortcutRow(action: "New Folder", shortcut: "⇧⌘N")
                KeyboardShortcutRow(action: "Search", shortcut: "⌘F")
                KeyboardShortcutRow(action: "Toggle Sidebar", shortcut: "⌃⌘S")
            }

            Section("Editor") {
                KeyboardShortcutRow(action: "Bold", shortcut: "⌘B")
                KeyboardShortcutRow(action: "Italic", shortcut: "⌘I")
                KeyboardShortcutRow(action: "Link", shortcut: "⌘K")
                KeyboardShortcutRow(action: "Code", shortcut: "⌘`")
            }

            Section("Sync") {
                KeyboardShortcutRow(action: "Sync Now", shortcut: "⇧⌘S")
            }
        }
        .formStyle(.grouped)
        .padding()
    }
}

struct KeyboardShortcutRow: View {
    let action: String
    let shortcut: String

    var body: some View {
        HStack {
            Text(action)
            Spacer()
            Text(shortcut)
                .font(.system(.body, design: .monospaced))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(.quaternary)
                .clipShape(RoundedRectangle(cornerRadius: 4))
        }
    }
}

// MARK: - Preview

#Preview {
    MacOSSettingsView()
        .environmentObject(AppState())
}
#endif
