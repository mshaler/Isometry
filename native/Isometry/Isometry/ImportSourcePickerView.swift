import SwiftUI

// ---------------------------------------------------------------------------
// ImportSourcePickerView — Native Import Source Picker
// ---------------------------------------------------------------------------
// Shows available native import sources (Reminders, Calendar, Notes) with
// future sources greyed out. In DEBUG builds, Mock and Stress Test sources
// are available for pipeline validation.

struct ImportSource: Identifiable {
    let id: String
    let displayName: String
    let systemImage: String
    let isAvailable: Bool
}

struct ImportSourcePickerView: View {
    var onSelect: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    private var sources: [ImportSource] {
        var list: [ImportSource] = [
            ImportSource(id: "native_reminders", displayName: "Reminders", systemImage: "list.bullet", isAvailable: true),
            ImportSource(id: "native_calendar", displayName: "Calendar", systemImage: "calendar", isAvailable: true),
            ImportSource(id: "native_notes", displayName: "Notes", systemImage: "note.text", isAvailable: true),
            ImportSource(id: "alto_index", displayName: "Alto Index", systemImage: "tray.full", isAvailable: AltoIndexAdapter().checkPermission() == .granted),
        ]
        #if DEBUG
        list.append(ImportSource(id: "mock", displayName: "Mock (Debug)", systemImage: "hammer", isAvailable: true))
        list.append(ImportSource(id: "mock_large", displayName: "Stress Test (5K)", systemImage: "flame", isAvailable: true))
        #endif
        return list
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(sources) { source in
                    Button {
                        if source.isAvailable {
                            dismiss()
                            onSelect(source.id)
                        }
                    } label: {
                        Label(source.displayName, systemImage: source.systemImage)
                    }
                    .disabled(!source.isAvailable)
                    .foregroundStyle(source.isAvailable ? .primary : .secondary)
                }
            }
            .navigationTitle("Import from...")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        #if os(macOS)
        .frame(minWidth: 320, minHeight: 300)
        #endif
    }
}
