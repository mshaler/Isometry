# Isometry v5 Native Shell Specification

## Overview

The Native Shell is the thin host container that runs on Apple platforms (macOS and iOS). Its sole purpose is to provide native system integration while keeping all product logic inside the WebView.

**Guiding Principle:** sql.js (WASM SQLite) is the universal data layer. One codebase, one database format, feature-gated tiers.

**Constraint:** As much TypeScript/JavaScript as possible, as little Swift/SwiftUI as possible.

---

## Unified Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Isometry (All Platforms)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         SwiftUI Native Shell                             ││
│  │  • WKWebView container                                                   ││
│  │  • CloudKit sync (SQLite file)                                           ││
│  │  • File system access                                                    ││
│  │  • Apple app database access (ETL sources)                               ││
│  │  • App lifecycle, menus, share sheets                                    ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                    │                                         │
│                         Bridge Contract (minimal)                            │
│                                    │                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                      WebView Runtime (sql.js + D3.js)                    ││
│  │  • sql.js in Web Worker — ALL data access                                ││
│  │  • D3.js — ALL rendering                                                 ││
│  │  • Providers — ALL state management                                      ││
│  │  • ETL parsers — ALL data transformation                                 ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Feature-Gated Tiers (Same Codebase)

Differentiate by **features**, not data format:

| Tier | Platform | Cards | ETL | Editing | Views | Price |
|------|----------|-------|-----|---------|-------|-------|
| **Free** | iOS/macOS | 500 | ❌ | Read-only | Basic (list, grid) | Free |
| **Pro** | iOS/macOS | 10K | Apple Apps | Read-write | All 9 views | $X/mo |
| **Workbench** | macOS | Unlimited | Full (Slack, etc.) | + Designer | + App Builder | $Y/mo |

### Feature Gate Implementation

```swift
// Sources/FeatureGate.swift

enum Tier: String, Codable, CaseIterable {
    case free
    case pro
    case workbench
}

@MainActor
class FeatureGate: ObservableObject {
    static let shared = FeatureGate()
    
    @Published var current: Tier = .free
    
    var maxCards: Int {
        switch current {
        case .free: return 500
        case .pro: return 10_000
        case .workbench: return .max
        }
    }
    
    var canImportAppleApps: Bool {
        current != .free
    }
    
    var canImportSlack: Bool {
        current == .workbench
    }
    
    var canEdit: Bool {
        current != .free
    }
    
    var canUseDesigner: Bool {
        current == .workbench
    }
    
    var availableViews: Set<ViewType> {
        switch current {
        case .free:
            return [.list, .grid]
        case .pro, .workbench:
            return Set(ViewType.allCases)
        }
    }
}
```

---

## The Boundary: Swift vs JavaScript

### What Lives in Swift (Platform Integration Only)

| Responsibility | Why Native | Implementation |
|----------------|------------|----------------|
| WKWebView container | Platform requirement | `IsometryWebView` |
| CloudKit sync | Apple API, no JS equivalent | `CloudKitSyncManager` |
| File system access | Sandboxed, entitlements | `DatabaseManager` |
| Apple app DB access | Sandbox bypass for ETL | `AppleDataAccess` |
| Push notifications | System integration | `SyncNotificationHandler` |
| App lifecycle | OS-level events | `SceneDelegate` |
| Native menus | Platform UX | `MenuBuilder` |
| Share sheets | System integration | `ShareExtension` |
| In-App Purchase | StoreKit | `SubscriptionManager` |

### What Lives in JavaScript (Everything Else)

| Component | Technology | Location |
|-----------|------------|----------|
| Query engine | sql.js (WASM) | Web Worker |
| Schema & migrations | SQL | `schema.sql` |
| All views | D3.js | `Views/*.ts` |
| State management | Providers | `Providers/*.ts` |
| ETL parsers | TypeScript | `ETL/*.ts` |
| PAFV projection | TypeScript | `Core/PAFV.ts` |
| Interaction logic | TypeScript | `Interaction/*.ts` |

---

## Bridge Contract

The bridge is intentionally minimal—three message types:

### 1. Launch Payload (Swift → JS)

```typescript
// Sent once on WebView load
interface LaunchPayload {
  type: 'launch';
  
  // Database
  dbData: ArrayBuffer | null;  // Existing database, or null for new
  dbPath: string;              // Path for save location
  
  // Platform context
  platform: 'ios' | 'macos';
  tier: 'free' | 'pro' | 'workbench';
  
  // iCloud
  iCloudAvailable: boolean;
  iCloudIdentity: string | null;
  
  // Viewport
  viewport: { width: number; height: number };
  safeAreaInsets: { top: number; bottom: number; left: number; right: number };
}
```

### 2. Checkpoint Request (JS → Swift)

```typescript
// Sent when JS wants to persist or sync
interface CheckpointRequest {
  type: 'checkpoint';
  
  dbData: ArrayBuffer;  // Full database
  reason: 'autosave' | 'explicit' | 'background' | 'sync';
}
```

### 3. Native Action Request (JS → Swift)

```typescript
// Sent when JS needs native capability
interface NativeActionRequest {
  type: 'native_action';
  
  action: 
    | { kind: 'importAppleApp'; source: 'reminders' | 'calendar' | 'contacts' | 'mail' | 'messages' | 'photos' }
    | { kind: 'shareSheet'; data: ShareData }
    | { kind: 'openURL'; url: string }
    | { kind: 'hapticFeedback'; style: 'light' | 'medium' | 'heavy' }
    | { kind: 'requestReview' }
    | { kind: 'purchase'; productId: string };
}
```

### 4. Native Response (Swift → JS)

```typescript
// Sent in response to native actions
interface NativeResponse {
  type: 'native_response';
  
  requestId: string;
  result: 
    | { success: true; data?: ArrayBuffer | string }
    | { success: false; error: string };
}
```

### 5. Sync Notification (Swift → JS)

```typescript
// Sent when CloudKit detects changes
interface SyncNotification {
  type: 'sync';
  
  event: 
    | { kind: 'remoteChange'; dbData: ArrayBuffer }
    | { kind: 'conflict'; local: ArrayBuffer; remote: ArrayBuffer }
    | { kind: 'accountChanged'; available: boolean };
}
```

---

## SwiftUI Shell Implementation

### App Entry Point

```swift
// Sources/IsometryApp.swift

import SwiftUI

@main
struct IsometryApp: App {
    @StateObject private var appState = AppState()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .environmentObject(FeatureGate.shared)
        }
        #if os(macOS)
        .commands {
            IsometryCommands()
        }
        #endif
    }
}
```

### Main Content View

```swift
// Sources/Views/ContentView.swift

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var featureGate: FeatureGate
    
    var body: some View {
        ZStack {
            IsometryWebView()
                .ignoresSafeArea()
            
            // Native overlays
            if appState.showSyncStatus {
                SyncStatusOverlay()
            }
            
            if appState.showUpgradePrompt {
                UpgradePromptSheet()
            }
        }
        .onAppear {
            Task {
                await appState.initialize()
            }
        }
    }
}
```

### WebView Container

```swift
// Sources/Views/IsometryWebView.swift

import SwiftUI
import WebKit

struct IsometryWebView: UIViewRepresentable {  // or NSViewRepresentable for macOS
    @EnvironmentObject var appState: AppState
    
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        
        // Enable Web Worker for sql.js
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        
        // Register message handlers
        let coordinator = context.coordinator
        config.userContentController.add(coordinator, name: "checkpoint")
        config.userContentController.add(coordinator, name: "nativeAction")
        
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = coordinator
        
        #if DEBUG
        webView.isInspectable = true
        #endif
        
        // Load the app
        if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "WebApp") {
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
        
        coordinator.webView = webView
        return webView
    }
    
    func updateUIView(_ webView: WKWebView, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(appState: appState)
    }
    
    class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        var webView: WKWebView?
        let appState: AppState
        
        init(appState: AppState) {
            self.appState = appState
        }
        
        // MARK: - WKNavigationDelegate
        
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            Task {
                await sendLaunchPayload()
            }
        }
        
        // MARK: - WKScriptMessageHandler
        
        func userContentController(_ controller: WKUserContentController, 
                                   didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any] else { return }
            
            Task {
                switch message.name {
                case "checkpoint":
                    await handleCheckpoint(body)
                case "nativeAction":
                    await handleNativeAction(body)
                default:
                    break
                }
            }
        }
        
        // MARK: - Launch
        
        private func sendLaunchPayload() async {
            let dbManager = DatabaseManager.shared
            let dbData = await dbManager.loadDatabase()
            
            let payload: [String: Any] = [
                "type": "launch",
                "dbPath": dbManager.databasePath.path,
                "platform": platform,
                "tier": FeatureGate.shared.current.rawValue,
                "iCloudAvailable": FileManager.default.ubiquityIdentityToken != nil,
                "viewport": [
                    "width": webView?.bounds.width ?? 0,
                    "height": webView?.bounds.height ?? 0
                ]
            ]
            
            // Send ArrayBuffer separately for efficiency
            if let data = dbData {
                await sendArrayBuffer(data, withPayload: payload)
            } else {
                await sendMessage(payload)
            }
        }
        
        // MARK: - Checkpoint
        
        private func handleCheckpoint(_ body: [String: Any]) async {
            guard let base64 = body["dbData"] as? String,
                  let data = Data(base64Encoded: base64) else { return }
            
            let reason = body["reason"] as? String ?? "autosave"
            
            do {
                try await DatabaseManager.shared.saveDatabase(data)
                
                if reason == "sync" {
                    await CloudKitSyncManager.shared.pushChanges()
                }
            } catch {
                print("Checkpoint failed: \(error)")
            }
        }
        
        // MARK: - Native Actions
        
        private func handleNativeAction(_ body: [String: Any]) async {
            guard let action = body["action"] as? [String: Any],
                  let kind = action["kind"] as? String,
                  let requestId = body["requestId"] as? String else { return }
            
            do {
                let result: Any
                
                switch kind {
                case "importAppleApp":
                    let source = action["source"] as! String
                    result = try await importAppleApp(source: source)
                    
                case "shareSheet":
                    // Handle share sheet
                    result = true
                    
                case "openURL":
                    let urlString = action["url"] as! String
                    if let url = URL(string: urlString) {
                        await UIApplication.shared.open(url)
                    }
                    result = true
                    
                case "hapticFeedback":
                    let style = action["style"] as? String ?? "medium"
                    await triggerHaptic(style: style)
                    result = true
                    
                case "purchase":
                    let productId = action["productId"] as! String
                    result = try await SubscriptionManager.shared.purchase(productId)
                    
                default:
                    throw NativeActionError.unknownAction(kind)
                }
                
                await sendNativeResponse(requestId: requestId, success: true, data: result)
                
            } catch {
                await sendNativeResponse(requestId: requestId, success: false, error: error.localizedDescription)
            }
        }
        
        // MARK: - Apple App Import
        
        private func importAppleApp(source: String) async throws -> Data {
            let appleSource = AppleDataSource(rawValue: source)!
            let data = try appleSource.readDatabase()
            return data
        }
        
        // MARK: - Helpers
        
        private var platform: String {
            #if os(iOS)
            return "ios"
            #else
            return "macos"
            #endif
        }
        
        private func sendMessage(_ payload: [String: Any]) async {
            guard let json = try? JSONSerialization.data(withJSONObject: payload),
                  let jsonString = String(data: json, encoding: .utf8) else { return }
            
            await MainActor.run {
                webView?.evaluateJavaScript("window.nativebridge.receive(\(jsonString))")
            }
        }
        
        private func sendArrayBuffer(_ data: Data, withPayload payload: [String: Any]) async {
            var fullPayload = payload
            fullPayload["dbData"] = data.base64EncodedString()
            await sendMessage(fullPayload)
        }
        
        private func sendNativeResponse(requestId: String, success: Bool, data: Any? = nil, error: String? = nil) async {
            var response: [String: Any] = [
                "type": "native_response",
                "requestId": requestId,
                "success": success
            ]
            
            if let data = data as? Data {
                response["data"] = data.base64EncodedString()
            } else if let data = data {
                response["data"] = data
            }
            
            if let error = error {
                response["error"] = error
            }
            
            await sendMessage(response)
        }
        
        private func triggerHaptic(style: String) async {
            #if os(iOS)
            await MainActor.run {
                let generator: UIImpactFeedbackGenerator
                switch style {
                case "light": generator = UIImpactFeedbackGenerator(style: .light)
                case "heavy": generator = UIImpactFeedbackGenerator(style: .heavy)
                default: generator = UIImpactFeedbackGenerator(style: .medium)
                }
                generator.impactOccurred()
            }
            #endif
        }
    }
}
```

---

## Database Manager

```swift
// Sources/Data/DatabaseManager.swift

import Foundation

actor DatabaseManager {
    static let shared = DatabaseManager()
    
    private init() {}
    
    var databasePath: URL {
        // Use iCloud container if available
        if let container = FileManager.default.url(forUbiquityContainerIdentifier: nil) {
            return container
                .appendingPathComponent("Documents", isDirectory: true)
                .appendingPathComponent("isometry.db")
        }
        
        // Fall back to local documents
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        return documents.appendingPathComponent("isometry.db")
    }
    
    func loadDatabase() async -> Data? {
        let path = databasePath
        
        // Ensure directory exists
        let directory = path.deletingLastPathComponent()
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        
        // Load existing database
        guard FileManager.default.fileExists(atPath: path.path) else {
            return nil  // New database, JS will initialize
        }
        
        return try? Data(contentsOf: path)
    }
    
    func saveDatabase(_ data: Data) async throws {
        let path = databasePath
        
        // Atomic write
        let tempPath = path.appendingPathExtension("tmp")
        try data.write(to: tempPath, options: .atomic)
        
        // Move to final location
        _ = try? FileManager.default.removeItem(at: path)
        try FileManager.default.moveItem(at: tempPath, to: path)
    }
}
```

---

## CloudKit Sync

```swift
// Sources/Sync/CloudKitSyncManager.swift

import CloudKit

actor CloudKitSyncManager {
    static let shared = CloudKitSyncManager()
    
    private let container = CKContainer(identifier: "iCloud.com.isometry.app")
    private let zoneID = CKRecordZone.ID(zoneName: "IsometryZone", ownerName: CKCurrentUserDefaultName)
    private let recordType = "Database"
    private let recordID: CKRecord.ID
    
    private var changeToken: CKServerChangeToken?
    
    private init() {
        recordID = CKRecord.ID(recordName: "isometry-db", zoneID: zoneID)
    }
    
    func setup() async throws {
        // Create zone if needed
        let zone = CKRecordZone(zoneID: zoneID)
        _ = try? await container.privateCloudDatabase.modifyRecordZones(saving: [zone], deleting: [])
        
        // Setup subscription for push notifications
        let subscription = CKDatabaseSubscription(subscriptionID: "isometry-changes")
        subscription.notificationInfo = CKSubscription.NotificationInfo()
        subscription.notificationInfo?.shouldSendContentAvailable = true
        
        _ = try? await container.privateCloudDatabase.modifySubscriptions(saving: [subscription], deleting: [])
    }
    
    func pushChanges() async throws {
        let data = try await DatabaseManager.shared.loadDatabase()
        guard let data else { return }
        
        // Create or update record
        let record = CKRecord(recordType: recordType, recordID: recordID)
        
        // Store database as CKAsset
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try data.write(to: tempURL)
        record["database"] = CKAsset(fileURL: tempURL)
        record["modifiedAt"] = Date()
        
        _ = try await container.privateCloudDatabase.modifyRecords(
            saving: [record],
            deleting: [],
            savePolicy: .changedKeys
        )
        
        try? FileManager.default.removeItem(at: tempURL)
    }
    
    func pullChanges() async throws -> Data? {
        let record = try await container.privateCloudDatabase.record(for: recordID)
        
        guard let asset = record["database"] as? CKAsset,
              let fileURL = asset.fileURL else {
            return nil
        }
        
        return try Data(contentsOf: fileURL)
    }
}
```

---

## JavaScript Bridge Receiver

```typescript
// src/native/bridge.ts

interface NativeBridge {
  receive(payload: LaunchPayload | NativeResponse | SyncNotification): void;
}

class NativeBridgeImpl implements NativeBridge {
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }>();
  
  private onLaunch?: (payload: LaunchPayload) => void;
  private onSync?: (notification: SyncNotification) => void;
  
  receive(payload: any): void {
    switch (payload.type) {
      case 'launch':
        this.handleLaunch(payload);
        break;
        
      case 'native_response':
        this.handleResponse(payload);
        break;
        
      case 'sync':
        this.handleSync(payload);
        break;
    }
  }
  
  private handleLaunch(payload: LaunchPayload): void {
    // Decode ArrayBuffer from base64
    if (payload.dbData && typeof payload.dbData === 'string') {
      const binary = atob(payload.dbData);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      payload.dbData = bytes.buffer;
    }
    
    this.onLaunch?.(payload);
  }
  
  private handleResponse(payload: NativeResponse): void {
    const pending = this.pendingRequests.get(payload.requestId);
    if (!pending) return;
    
    this.pendingRequests.delete(payload.requestId);
    
    if (payload.result.success) {
      pending.resolve(payload.result.data);
    } else {
      pending.reject(new Error(payload.result.error));
    }
  }
  
  private handleSync(notification: SyncNotification): void {
    this.onSync?.(notification);
  }
  
  // MARK: - Outgoing
  
  async checkpoint(dbData: ArrayBuffer, reason: string): Promise<void> {
    const base64 = btoa(String.fromCharCode(...new Uint8Array(dbData)));
    
    (window as any).webkit?.messageHandlers?.checkpoint?.postMessage({
      dbData: base64,
      reason
    });
  }
  
  async requestNativeAction<T>(action: NativeActionRequest['action']): Promise<T> {
    const requestId = crypto.randomUUID();
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });
      
      (window as any).webkit?.messageHandlers?.nativeAction?.postMessage({
        requestId,
        action
      });
      
      // Timeout after 30s
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Native action timed out'));
        }
      }, 30000);
    });
  }
  
  // MARK: - Registration
  
  registerLaunchHandler(handler: (payload: LaunchPayload) => void): void {
    this.onLaunch = handler;
  }
  
  registerSyncHandler(handler: (notification: SyncNotification) => void): void {
    this.onSync = handler;
  }
}

// Global instance
(window as any).nativebridge = new NativeBridgeImpl();

export const nativeBridge = (window as any).nativebridge as NativeBridgeImpl;
```

---

## App Initialization Flow

```typescript
// src/main.ts

import { nativeBridge } from './native/bridge';
import { workerBridge } from './core/WorkerBridge';
import { stateCoordinator } from './core/Providers';

nativeBridge.registerLaunchHandler(async (payload) => {
  console.log(`Launching on ${payload.platform} with tier: ${payload.tier}`);
  
  // Initialize sql.js with database
  if (payload.dbData) {
    await workerBridge.importDatabase(payload.dbData);
  } else {
    await workerBridge.init();  // Creates new database
  }
  
  // Restore state
  await stateCoordinator.restore();
  
  // Set feature flags
  FeatureGate.setTier(payload.tier);
  
  // Initialize D3 renderer
  initializeRenderer(payload.viewport);
  
  // Setup autosave
  setInterval(async () => {
    const dbData = await workerBridge.exportDatabase();
    await nativeBridge.checkpoint(dbData, 'autosave');
  }, 30000);  // Every 30 seconds
});

nativeBridge.registerSyncHandler(async (notification) => {
  if (notification.event.kind === 'remoteChange') {
    // Reload database from remote
    await workerBridge.importDatabase(notification.event.dbData);
    await stateCoordinator.restore();
    rerender();
  }
});
```

---

## Platform-Specific Considerations

### macOS

```swift
// Sources/macOS/MacCommands.swift

import SwiftUI

struct IsometryCommands: Commands {
    var body: some Commands {
        CommandGroup(after: .newItem) {
            Button("Import from Reminders") {
                NotificationCenter.default.post(name: .importAppleApp, object: "reminders")
            }
            .keyboardShortcut("I", modifiers: [.command, .shift])
            
            Button("Import from Calendar") {
                NotificationCenter.default.post(name: .importAppleApp, object: "calendar")
            }
        }
        
        CommandGroup(replacing: .undoRedo) {
            Button("Undo") {
                NotificationCenter.default.post(name: .undo, object: nil)
            }
            .keyboardShortcut("Z", modifiers: .command)
            
            Button("Redo") {
                NotificationCenter.default.post(name: .redo, object: nil)
            }
            .keyboardShortcut("Z", modifiers: [.command, .shift])
        }
    }
}
```

### iOS

```swift
// Sources/iOS/iOSExtensions.swift

import SwiftUI

extension ContentView {
    var toolbar: some ToolbarContent {
        ToolbarItemGroup(placement: .bottomBar) {
            Button(action: { showImportSheet = true }) {
                Image(systemName: "square.and.arrow.down")
            }
            
            Spacer()
            
            Button(action: { showViewPicker = true }) {
                Image(systemName: "rectangle.3.group")
            }
        }
    }
}
```

---

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Cold launch | < 2s | Time to first render |
| Database load | < 500ms | ArrayBuffer → sql.js init |
| Checkpoint | < 200ms | Export + save |
| Sync round-trip | < 2s | Local → CloudKit → remote |
| Memory (10K cards) | < 100MB | Total app footprint |

---

## Summary

| Principle | Implementation |
|-----------|----------------|
| **One database format** | sql.js SQLite everywhere |
| **Feature-gated tiers** | Same code, different limits |
| **Minimal bridge** | 5 message types total |
| **Swift is plumbing** | Only platform integration |
| **JavaScript owns data** | All queries, all mutations |
| **Reusable shell** | Same SwiftUI for iOS/macOS |
