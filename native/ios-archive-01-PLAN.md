---
phase: ios-archive
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [
  /Users/mshaler/Developer/Projects/Isometry/native/Configurations/Production.xcconfig,
  /Users/mshaler/Developer/Projects/Isometry/native/IsometryiOS/IsometryiOS.xcodeproj/project.pbxproj,
  /Users/mshaler/Developer/Projects/Isometry/native/IsometryiOS/IsometryiOS/Info.plist
]
autonomous: true

must_haves:
  truths:
    - "Production configuration is properly configured for App Store distribution"
    - "All required certificates and provisioning profiles are available"
    - "Project builds successfully in Release configuration"
    - "Bundle identifier matches App Store Connect app record"
  artifacts:
    - path: "/Users/mshaler/Developer/Projects/Isometry/native/Configurations/Production.xcconfig"
      provides: "Production build configuration"
      contains: "CODE_SIGN_STYLE = Manual"
    - path: "/Users/mshaler/Developer/Projects/Isometry/native/IsometryiOS/IsometryiOS.xcodeproj/project.pbxproj"
      provides: "iOS app target configuration"
      contains: "Production"
  key_links:
    - from: "Production.xcconfig"
      to: "iPhone Distribution certificate"
      via: "CODE_SIGN_IDENTITY configuration"
      pattern: "iPhone Distribution"
    - from: "project.pbxproj"
      to: "App Store provisioning profile"
      via: "PROVISIONING_PROFILE_SPECIFIER"
      pattern: "App Store Distribution"
---

<objective>
Validate and prepare the iOS build environment for archive creation, ensuring all code signing certificates, provisioning profiles, and build configurations are properly set up for App Store distribution.

Purpose: Establish a clean, validated build environment before attempting archive creation
Output: Validated build environment ready for iOS archive creation
</objective>

<execution_context>
@/Users/mshaler/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mshaler/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/mshaler/Developer/Projects/Isometry/native/Package.swift
@/Users/mshaler/Developer/Projects/Isometry/native/IsometryiOS/IsometryiOS.xcodeproj/project.pbxproj
@/Users/mshaler/Developer/Projects/Isometry/native/Configurations/Production.xcconfig
@/Users/mshaler/Developer/Projects/Isometry/native/IsometryiOS/IsometryiOS/Info.plist
@/Users/mshaler/Developer/Projects/Isometry/native/IsometryiOS/IsometryiOS/IsometryiOS.entitlements
</context>

<tasks>

<task type="auto">
  <name>Validate code signing environment</name>
  <files>/Users/mshaler/Developer/Projects/Isometry/native/Configurations/Production.xcconfig</files>
  <action>
    1. Verify iPhone Distribution certificate exists and is valid using `security find-identity -v -p codesigning`
    2. Check that DEVELOPMENT_TEAM is set correctly (77CCZHWQL7)
    3. Verify Production.xcconfig has proper manual code signing configuration:
       - CODE_SIGN_STYLE = Manual
       - CODE_SIGN_IDENTITY[sdk=iphoneos*] = iPhone Distribution
       - PROVISIONING_PROFILE_SPECIFIER[sdk=iphoneos*] = Isometry App Store Distribution
    4. Update bundle identifier to match App Store Connect if needed (com.cardboard.isometry vs com.mshaler.isometry)
    5. Ensure MARKETING_VERSION and CURRENT_PROJECT_VERSION are set properly for submission
  </action>
  <verify>Run `security find-identity -v -p codesigning | grep "iPhone Distribution"` to confirm certificate availability</verify>
  <done>iPhone Distribution certificate is available and Production.xcconfig contains proper manual code signing configuration</done>
</task>

<task type="auto">
  <name>Clean and validate iOS project build</name>
  <files>/Users/mshaler/Developer/Projects/Isometry/native/IsometryiOS/IsometryiOS.xcodeproj/project.pbxproj</files>
  <action>
    1. Clean all previous build artifacts: `rm -rf /Users/mshaler/Developer/Projects/Isometry/native/.build`
    2. Clean Xcode derived data: `rm -rf ~/Library/Developer/Xcode/DerivedData/IsometryiOS*`
    3. Resolve Swift Package dependencies: `cd /Users/mshaler/Developer/Projects/Isometry/native && swift package resolve`
    4. Build iOS project in Production configuration to verify no compilation errors:
       `xcodebuild -project IsometryiOS/IsometryiOS.xcodeproj -scheme IsometryiOS -configuration Production -destination 'generic/platform=iOS' clean build`
    5. Verify that all Swift compiler warnings from previous build are acceptable for production
  </action>
  <verify>Run build command above and verify exit code 0 with "BUILD SUCCEEDED" message</verify>
  <done>iOS project builds successfully in Production configuration with zero errors</done>
</task>

<task type="auto">
  <name>Verify App Store requirements compliance</name>
  <files>/Users/mshaler/Developer/Projects/Isometry/native/IsometryiOS/IsometryiOS/Info.plist</files>
  <action>
    1. Check that Info.plist contains all required App Store keys:
       - CFBundleDisplayName, CFBundleIdentifier, CFBundleShortVersionString
       - LSRequiresIPhoneOS = true, UIRequiredDeviceCapabilities includes arm64
       - UISupportedInterfaceOrientations is properly configured
    2. Verify CloudKit entitlements are properly set up in IsometryiOS.entitlements
    3. Check that privacy descriptions are present for CloudKit usage
    4. Ensure minimum iOS deployment target (17.0) is acceptable for App Store submission
    5. Verify that all required app icons exist in Assets.xcassets
  </action>
  <verify>Check Info.plist contents and verify all required keys exist with valid values</verify>
  <done>Info.plist and entitlements are properly configured for App Store submission requirements</done>
</task>

</tasks>

<verification>
- iPhone Distribution certificate is available in keychain
- Production.xcconfig has manual code signing properly configured
- iOS project builds successfully in Production configuration
- Info.plist contains all required App Store metadata
- CloudKit entitlements are properly configured
</verification>

<success_criteria>
- Code signing environment is validated and ready
- iOS project builds without errors in Production configuration
- All App Store submission requirements are met
- Build environment is clean and reproducible
</success_criteria>

<output>
After completion, create `.planning/phases/ios-archive/ios-archive-01-SUMMARY.md`
</output>