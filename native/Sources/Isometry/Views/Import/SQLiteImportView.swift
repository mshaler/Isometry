import SwiftUI
import UniformTypeIdentifiers

/// Native SwiftUI view for importing SQLite databases from Apple apps
struct SQLiteImportView: View {
    @StateObject private var syncManager: DirectAppleSyncManager
    @State private var isImporting = false
    @State private var importResults: [ImportResult] = []
    @State private var selectedFiles: [URL] = []
    @State private var showingFilePicker = false
    @State private var syncConfiguration = DirectAppleSyncManager.SyncConfiguration.default
    @State private var showingAdvancedSettings = false
    @State private var lastSyncResult: SyncResult?

    @Environment(\.dismiss) private var dismiss

    private let database: IsometryDatabase

    init(database: IsometryDatabase) {
        self.database = database
        self._syncManager = StateObject(wrappedValue: DirectAppleSyncManager(database: database))
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                headerSection

                ScrollView {
                    VStack(spacing: 24) {
                        syncOptionsSection
                        importActionsSection

                        if !selectedFiles.isEmpty {
                            selectedFilesSection
                        }

                        if let syncResult = lastSyncResult {
                            resultsSummarySection(syncResult)
                        }

                        if !importResults.isEmpty {
                            importHistorySection
                        }
                    }
                    .padding(.horizontal)
                }
            }
            .navigationTitle("Database Import")
            #if os(iOS)
            #if canImport(UIKit)
.navigationBarTitleDisplayMode(.large)
#endif
            #endif
            .toolbar {
                #if os(iOS)
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") { dismiss() }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        showingAdvancedSettings.toggle()
                    } label: {
                        Image(systemName: "gearshape")
                    }
                }
                #else
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showingAdvancedSettings.toggle()
                    } label: {
                        Image(systemName: "gearshape")
                    }
                }
                #endif
            }
            .fileImporter(
                isPresented: $showingFilePicker,
                allowedContentTypes: [
                    UTType(filenameExtension: "sqlite")!,
                    UTType(filenameExtension: "db")!,
                    UTType(filenameExtension: "sqlite3")!,
                    UTType(filenameExtension: "sqlitedb")!
                ],
                allowsMultipleSelection: true
            ) { result in
                handleFileSelection(result)
            }
            .sheet(isPresented: $showingAdvancedSettings) {
                AdvancedSyncSettingsView(configuration: $syncConfiguration)
            }
        }
    }

    // MARK: - View Sections

    private var headerSection: some View {
        VStack(spacing: 12) {
            Image(systemName: "cylinder.split.1x2")
                .font(.system(size: 48))
                .foregroundColor(.blue)

            Text("Direct SQLite Sync")
                .font(.title2)
                .fontWeight(.semibold)

            Text("Import data directly from Apple app databases")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(.vertical)
    }

    private var syncOptionsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Data Sources")
                .font(.headline)

            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                SyncOptionToggle(
                    title: "Notes",
                    icon: "note.text",
                    isEnabled: syncConfiguration.notesEnabled
                ) { enabled in
                    syncConfiguration = DirectAppleSyncManager.SyncConfiguration(
                        notesEnabled: enabled,
                        remindersEnabled: syncConfiguration.remindersEnabled,
                        calendarEnabled: syncConfiguration.calendarEnabled,
                        contactsEnabled: syncConfiguration.contactsEnabled,
                        safariEnabled: syncConfiguration.safariEnabled,
                        syncInterval: syncConfiguration.syncInterval,
                        batchSize: syncConfiguration.batchSize
                    )
                }

                SyncOptionToggle(
                    title: "Reminders",
                    icon: "checklist",
                    isEnabled: syncConfiguration.remindersEnabled
                ) { enabled in
                    syncConfiguration = DirectAppleSyncManager.SyncConfiguration(
                        notesEnabled: syncConfiguration.notesEnabled,
                        remindersEnabled: enabled,
                        calendarEnabled: syncConfiguration.calendarEnabled,
                        contactsEnabled: syncConfiguration.contactsEnabled,
                        safariEnabled: syncConfiguration.safariEnabled,
                        syncInterval: syncConfiguration.syncInterval,
                        batchSize: syncConfiguration.batchSize
                    )
                }

                SyncOptionToggle(
                    title: "Calendar",
                    icon: "calendar",
                    isEnabled: syncConfiguration.calendarEnabled
                ) { enabled in
                    syncConfiguration = DirectAppleSyncManager.SyncConfiguration(
                        notesEnabled: syncConfiguration.notesEnabled,
                        remindersEnabled: syncConfiguration.remindersEnabled,
                        calendarEnabled: enabled,
                        contactsEnabled: syncConfiguration.contactsEnabled,
                        safariEnabled: syncConfiguration.safariEnabled,
                        syncInterval: syncConfiguration.syncInterval,
                        batchSize: syncConfiguration.batchSize
                    )
                }

                SyncOptionToggle(
                    title: "Contacts",
                    icon: "person.crop.circle",
                    isEnabled: syncConfiguration.contactsEnabled
                ) { enabled in
                    syncConfiguration = DirectAppleSyncManager.SyncConfiguration(
                        notesEnabled: syncConfiguration.notesEnabled,
                        remindersEnabled: syncConfiguration.remindersEnabled,
                        calendarEnabled: syncConfiguration.calendarEnabled,
                        contactsEnabled: enabled,
                        safariEnabled: syncConfiguration.safariEnabled,
                        syncInterval: syncConfiguration.syncInterval,
                        batchSize: syncConfiguration.batchSize
                    )
                }

                SyncOptionToggle(
                    title: "Safari",
                    icon: "safari",
                    isEnabled: syncConfiguration.safariEnabled
                ) { enabled in
                    syncConfiguration = DirectAppleSyncManager.SyncConfiguration(
                        notesEnabled: syncConfiguration.notesEnabled,
                        remindersEnabled: syncConfiguration.remindersEnabled,
                        calendarEnabled: syncConfiguration.calendarEnabled,
                        contactsEnabled: syncConfiguration.contactsEnabled,
                        safariEnabled: enabled,
                        syncInterval: syncConfiguration.syncInterval,
                        batchSize: syncConfiguration.batchSize
                    )
                }
            }
        }
        .padding()
        .background(Color(.secondary).opacity(0.1))
        .cornerRadius(12)
    }

    private var importActionsSection: some View {
        VStack(spacing: 16) {
            VStack(spacing: 12) {
                Button {
                    Task {
                        await performDirectSync()
                    }
                } label: {
                    HStack {
                        Image(systemName: "arrow.triangle.2.circlepath.circle")
                        Text("Direct Sync from System")
                        if isImporting {
                            Spacer()
                            ProgressView()
                                .scaleEffect(0.8)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(10)
                }
                .disabled(isImporting)

                Text("Directly access Apple app databases on this device")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Divider()

            VStack(spacing: 12) {
                Button {
                    showingFilePicker = true
                } label: {
                    HStack {
                        Image(systemName: "folder")
                        Text("Import SQLite Files")
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color(.systemGray5))
                    .foregroundColor(.primary)
                    .cornerRadius(10)
                }

                Text("Import exported SQLite database files")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }

    private var selectedFilesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Selected Files")
                    .font(.headline)
                Spacer()
                Button("Clear") {
                    selectedFiles.removeAll()
                }
                .foregroundColor(.red)
            }

            ForEach(selectedFiles, id: \.self) { fileURL in
                HStack {
                    Image(systemName: "cylinder")
                    VStack(alignment: .leading) {
                        Text(fileURL.lastPathComponent)
                            .font(.subheadline)
                        Text(fileURL.path)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    Button {
                        selectedFiles.removeAll { $0 == fileURL }
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.red)
                    }
                }
                .padding(.vertical, 4)
            }

            if !selectedFiles.isEmpty {
                Button {
                    Task {
                        await importSelectedFiles()
                    }
                } label: {
                    HStack {
                        Image(systemName: "square.and.arrow.down")
                        Text("Import Selected Files")
                        if isImporting {
                            Spacer()
                            ProgressView()
                                .scaleEffect(0.8)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.green)
                    .foregroundColor(.white)
                    .cornerRadius(10)
                }
                .disabled(isImporting)
            }
        }
        .padding()
        .background(Color(.secondary).opacity(0.1))
        .cornerRadius(12)
    }

    private func resultsSummarySection(_ result: SyncResult) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Last Sync Results")
                .font(.headline)

            HStack(spacing: 20) {
                VStack {
                    Text("\(result.imported)")
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(.green)
                    Text("Imported")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                VStack {
                    Text("\(result.failed)")
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(.red)
                    Text("Failed")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                VStack {
                    Text("\(result.errors.count)")
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(.orange)
                    Text("Errors")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()
            }

            if !result.errors.isEmpty {
                DisclosureGroup("View Errors") {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(result.errors.indices, id: \.self) { index in
                            Text(result.errors[index].localizedDescription)
                                .font(.caption)
                                .foregroundColor(.red)
                                .padding(.horizontal, 8)
                        }
                    }
                }
                .padding(.top, 8)
            }
        }
        .padding()
        .background(Color(.secondary).opacity(0.1))
        .cornerRadius(12)
    }

    private var importHistorySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Import History")
                .font(.headline)

            ForEach(importResults.indices, id: \.self) { index in
                let result = importResults[index]
                HStack {
                    VStack(alignment: .leading) {
                        Text("Import \(index + 1)")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        Text("\(result.imported) imported, \(result.failed) failed")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    Text(Date(), style: .time)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding(.vertical, 4)
            }
        }
        .padding()
        .background(Color(.secondary).opacity(0.1))
        .cornerRadius(12)
    }

    // MARK: - Actions

    private func performDirectSync() async {
        isImporting = true
        defer { isImporting = false }

        do {
            let syncManager = DirectAppleSyncManager(database: database, configuration: syncConfiguration)
            let result = try await syncManager.performFullSync()

            await MainActor.run {
                lastSyncResult = result

                // Create import result for history
                let importResult = ImportResult(
                    imported: result.imported,
                    failed: result.failed,
                    errors: result.errors
                )
                importResults.append(importResult)
            }
        } catch {
            await MainActor.run {
                let errorResult = SyncResult()
                errorResult.errors = [error]
                lastSyncResult = errorResult
            }
        }
    }

    private func importSelectedFiles() async {
        isImporting = true
        defer { isImporting = false }

        var totalImported = 0
        var totalFailed = 0
        var allErrors: [Error] = []

        let fileImporter = SQLiteFileImporter(database: database)

        for fileURL in selectedFiles {
            do {
                let result = try await fileImporter.importDatabase(from: fileURL)
                totalImported += result.imported
                totalFailed += result.failed
                allErrors.append(contentsOf: result.errors)
            } catch {
                totalFailed += 1
                allErrors.append(error)
            }
        }

        await MainActor.run {
            let result = SyncResult()
            result.imported = totalImported
            result.failed = totalFailed
            result.errors = allErrors
            lastSyncResult = result

            // Create import result for history
            let importResult = ImportResult(
                imported: totalImported,
                failed: totalFailed,
                errors: allErrors
            )
            importResults.append(importResult)

            // Clear selected files after successful import
            selectedFiles.removeAll()
        }
    }

    private func handleFileSelection(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            selectedFiles.append(contentsOf: urls)
        case .failure(let error):
            // Handle file selection error
            print("File selection error: \(error)")
        }
    }
}

// MARK: - Supporting Views

struct SyncOptionToggle: View {
    let title: String
    let icon: String
    let isEnabled: Bool
    let onToggle: (Bool) -> Void

    var body: some View {
        Button {
            onToggle(!isEnabled)
        } label: {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(isEnabled ? .white : .primary)
                VStack(alignment: .leading) {
                    Text(title)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(isEnabled ? .white : .primary)
                }
                Spacer()
                if isEnabled {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.white)
                }
            }
            .padding()
            .background(isEnabled ? Color.blue : Color(.systemGray5))
            .cornerRadius(8)
        }
        .buttonStyle(.plain)
    }
}

struct AdvancedSyncSettingsView: View {
    @Binding var configuration: DirectAppleSyncManager.SyncConfiguration
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Performance") {
                    HStack {
                        Text("Batch Size")
                        Spacer()
                        TextField("Batch Size", value: $configuration.batchSize, format: .number)
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 100)
                    }

                    HStack {
                        Text("Sync Interval")
                        Spacer()
                        TextField("Minutes", value: Binding(
                            get: { configuration.syncInterval / 60 },
                            set: { configuration.syncInterval = $0 * 60 }
                        ), format: .number)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 100)
                        Text("min")
                    }
                }

                Section("Info") {
                    Label("Batch size controls how many records are processed at once", systemImage: "info.circle")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Label("Sync interval applies to automatic background sync", systemImage: "info.circle")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .navigationTitle("Advanced Settings")
            #if canImport(UIKit)
.navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Supporting Types

// MARK: - Preview

#Preview {
    do {
        let database = try IsometryDatabase(path: ":memory:")
        return SQLiteImportView(database: database)
    } catch {
        return Text("Failed to create database: \(error)")
    }
}