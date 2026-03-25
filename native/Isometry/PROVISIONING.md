# Provisioning Profile Regeneration

## Prerequisites
- Apple Developer account with active membership
- Xcode 16+ installed
- CloudKit container `iCloud.works.isometry.Isometry` created in Apple Developer Portal

## Steps

### 1. Register App IDs (if not already done)
1. Open Apple Developer Portal > Certificates, Identifiers & Profiles > Identifiers
2. Verify `works.isometry.Isometry` (iOS) exists with CloudKit capability enabled
3. Verify `works.isometry.Isometry` (macOS) exists with CloudKit capability enabled

### 2. Create/Regenerate Provisioning Profiles
#### iOS
1. Profiles > + > iOS App Development
2. Select App ID: `works.isometry.Isometry`
3. Select development certificate
4. Select test devices
5. Name: "Isometry iOS Development"
6. Download and double-click to install

#### macOS
1. Profiles > + > macOS App Development
2. Select App ID: `works.isometry.Isometry`
3. Select development certificate
4. Name: "Isometry macOS Development"
5. Download and double-click to install

### 3. Xcode Configuration
1. Open `native/Isometry/Isometry.xcodeproj`
2. Select Isometry target > Signing & Capabilities
3. Uncheck "Automatically manage signing" if using manual profiles
4. Select the downloaded provisioning profile for each target
5. Verify CloudKit capability shows container `iCloud.works.isometry.Isometry`

### 4. TestFlight Archive
1. Select "Any iOS Device" or "My Mac" destination
2. Product > Archive
3. In Organizer, click "Distribute App" > TestFlight (App Store Connect)
4. Upload

## Troubleshooting
- If CloudKit entitlement missing: re-enable in App ID, regenerate profile
- If archive fails with signing error: delete derived data, clean build folder
