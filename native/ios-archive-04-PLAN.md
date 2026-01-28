---
phase: ios-archive
plan: 04
type: execute
wave: 3
depends_on: [ios-archive-02, ios-archive-03]
files_modified: []
autonomous: false

must_haves:
  truths:
    - "iOS archive passes all App Store validation checks"
    - "Archive is successfully uploaded to App Store Connect"
    - "App status changes to 'Waiting for Review' or 'In Review'"
    - "Submission is complete and ready for Apple review process"
  artifacts:
    - path: "App Store Connect submission record"
      provides: "Completed app submission for review"
      contains: "build upload"
  key_links:
    - from: "iOS archive validation"
      to: "App Store Connect upload"
      via: "successful validation process"
      pattern: "validation successful"
---

<objective>
Validate the iOS archive against App Store requirements and complete the submission process to App Store Connect.

Purpose: Finalize the iOS app submission by validating archive and uploading to Apple for review
Output: Successfully submitted iOS app awaiting Apple's review process
</objective>

<execution_context>
@/Users/mshaler/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mshaler/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@ios-archive-02-SUMMARY.md
@ios-archive-03-SUMMARY.md
@/Users/mshaler/Developer/Projects/Isometry/native/IsometryiOS/IsometryiOS.xcodeproj/project.pbxproj
</context>

<tasks>

<task type="auto">
  <name>Validate iOS archive for App Store submission</name>
  <files></files>
  <action>
    1. Use xcodebuild to validate the archive against App Store requirements:
       `xcodebuild -exportArchive -archivePath ~/Desktop/IsometryiOS.xcarchive -exportPath ~/Desktop/IsometryiOS-Export -exportOptionsPlist <(echo '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>method</key><string>app-store</string><key>teamID</key><string>77CCZHWQL7</string><key>uploadBitcode</key><true/><key>uploadSymbols</key><true/></dict></plist>') -allowProvisioningUpdates`
    2. Alternative: Use Xcode Organizer validation by running `xcodebuild -exportArchive` with validation-only options
    3. Check validation output for any warnings or errors:
       - Code signing issues
       - Missing entitlements
       - App Store policy violations
       - Framework compatibility issues
    4. Resolve any validation errors found before proceeding
    5. Generate IPA file if validation succeeds for upload preparation
  </action>
  <verify>Check that export command completes successfully and IPA file is created in export directory</verify>
  <done>iOS archive passes all App Store validation checks and IPA is ready for upload</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Validated iOS archive and IPA ready for App Store submission</what-built>
  <how-to-verify>
    1. Open Xcode Organizer (Window > Organizer)
    2. Select the IsometryiOS archive
    3. Click "Distribute App" button
    4. Choose "App Store Connect" distribution method
    5. Select "Upload" option
    6. Follow the distribution wizard and monitor for:
       - Successful authentication with App Store Connect
       - Archive validation completing without errors
       - Upload progress completing successfully
    7. Verify in App Store Connect that new build appears under "TestFlight" or builds section
    8. Check that app status updates to reflect the new build
  </how-to-verify>
  <resume-signal>Type "upload-complete" when archive is successfully uploaded and appears in App Store Connect</resume-signal>
</task>

</tasks>

<verification>
- iOS archive passes all validation checks without errors
- Archive is successfully uploaded to App Store Connect
- New build appears in App Store Connect dashboard
- App submission process is complete and ready for review
</verification>

<success_criteria>
- Archive validation completes with no blocking errors
- Upload to App Store Connect succeeds
- App status changes to "Waiting for Review" or similar ready state
- Apple review process can begin immediately
</success_criteria>

<output>
After completion, create `.planning/phases/ios-archive/ios-archive-04-SUMMARY.md`
</output>