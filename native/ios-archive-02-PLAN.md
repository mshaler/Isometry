---
phase: ios-archive
plan: 02
type: execute
wave: 2
depends_on: [ios-archive-01]
files_modified: []
autonomous: false
user_setup: []

must_haves:
  truths:
    - "iOS archive is successfully created using Production configuration"
    - "Archive contains properly signed app bundle with all required frameworks"
    - "Archive is ready for App Store validation and upload"
  artifacts:
    - path: "~/Library/Developer/Xcode/Archives/*/IsometryiOS.xcarchive"
      provides: "Signed iOS archive for App Store submission"
      min_lines: 1
  key_links:
    - from: "xcodebuild archive command"
      to: "iPhone Distribution certificate"
      via: "automatic code signing resolution"
      pattern: "CodeSign.*iPhone Distribution"
---

<objective>
Create a production-ready iOS archive using Xcode build tools with proper code signing for App Store submission.

Purpose: Generate the final iOS archive package that will be submitted to App Store Connect
Output: Signed iOS archive (.xcarchive) ready for validation and upload
</objective>

<execution_context>
@/Users/mshaler/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mshaler/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@ios-archive-01-SUMMARY.md
@/Users/mshaler/Developer/Projects/Isometry/native/IsometryiOS/IsometryiOS.xcodeproj/project.pbxproj
@/Users/mshaler/Developer/Projects/Isometry/native/Configurations/Production.xcconfig
</context>

<tasks>

<task type="auto">
  <name>Create iOS archive with Production configuration</name>
  <files></files>
  <action>
    1. Navigate to iOS project directory: `cd /Users/mshaler/Developer/Projects/Isometry/native`
    2. Create archive using xcodebuild with Production configuration:
       `xcodebuild -project IsometryiOS/IsometryiOS.xcodeproj -scheme IsometryiOS -configuration Production -destination 'generic/platform=iOS' -archivePath ~/Desktop/IsometryiOS.xcarchive archive`
    3. Monitor build output for successful code signing with iPhone Distribution certificate
    4. Verify archive creation completed successfully with "ARCHIVE SUCCEEDED" message
    5. Check that archive exists at specified path and contains proper app bundle structure
    6. Capture archive location and basic metadata for next steps
  </action>
  <verify>Check that archive file exists: `ls -la ~/Desktop/IsometryiOS.xcarchive` and contains Products/Applications/IsometryiOS.app</verify>
  <done>iOS archive is successfully created and contains properly signed app bundle</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>iOS archive created with Production configuration and code signing</what-built>
  <how-to-verify>
    1. Open Xcode Organizer (Window > Organizer)
    2. Select the "Archives" tab
    3. Verify the IsometryiOS archive appears in the list
    4. Check that the archive shows "Valid" status with proper signing information
    5. Note the archive creation date/time and version information
    6. Verify the archive size is reasonable (should be several MB)
  </how-to-verify>
  <resume-signal>Type "archive-verified" to confirm archive appears correctly in Xcode Organizer</resume-signal>
</task>

</tasks>

<verification>
- iOS archive is created successfully at ~/Desktop/IsometryiOS.xcarchive
- Archive contains properly signed iOS app bundle
- Archive appears in Xcode Organizer with valid status
- Build logs show successful code signing with Distribution certificate
</verification>

<success_criteria>
- Archive creation completes without errors
- Archive is properly signed for App Store distribution
- Archive structure contains all required components
- Archive is ready for validation and upload processes
</success_criteria>

<output>
After completion, create `.planning/phases/ios-archive/ios-archive-02-SUMMARY.md`
</output>