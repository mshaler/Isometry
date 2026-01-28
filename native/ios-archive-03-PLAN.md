---
phase: ios-archive
plan: 03
type: execute
wave: 2
depends_on: [ios-archive-01]
files_modified: []
autonomous: false
user_setup:
  - service: app-store-connect
    why: "App Store metadata and submission preparation"
    env_vars: []
    dashboard_config:
      - task: "Create or verify app record exists"
        location: "App Store Connect -> Apps -> + (if new app)"
      - task: "Configure app metadata (name, description, keywords)"
        location: "App Store Connect -> App Information"
      - task: "Set up app categories and ratings"
        location: "App Store Connect -> App Information"
      - task: "Upload required app screenshots and metadata"
        location: "App Store Connect -> App Store -> iOS App -> Prepare for Submission"

must_haves:
  truths:
    - "App Store Connect app record exists with correct bundle identifier"
    - "Required app metadata is complete (name, description, categories)"
    - "App screenshots and promotional materials are uploaded"
    - "Privacy policy and app review information is provided"
  artifacts:
    - path: "App Store Connect Dashboard"
      provides: "Complete app listing ready for submission"
      contains: "app metadata"
  key_links:
    - from: "Bundle identifier in Xcode"
      to: "App Store Connect app record"
      via: "matching bundle ID"
      pattern: "com.cardboard.isometry"
---

<objective>
Prepare App Store Connect with complete app metadata, screenshots, and submission requirements parallel to archive creation.

Purpose: Set up App Store Connect app listing so archive can be immediately submitted upon creation
Output: Complete App Store Connect app record ready to receive archive upload
</objective>

<execution_context>
@/Users/mshaler/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mshaler/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@ios-archive-01-SUMMARY.md
@/Users/mshaler/Developer/Projects/Isometry/native/IsometryiOS/IsometryiOS/Info.plist
@/Users/mshaler/Developer/Projects/Isometry/native/Configurations/Production.xcconfig
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <action>Verify or create App Store Connect app record</action>
  <instructions>
    1. Log into App Store Connect (https://appstoreconnect.apple.com)
    2. Navigate to "Apps" section
    3. Check if "Isometry" app already exists with bundle ID "com.cardboard.isometry"
    4. If app doesn't exist:
       - Click the "+" button to create new app
       - Enter App Name: "Isometry"
       - Bundle ID: Select "com.cardboard.isometry" (must match Xcode project)
       - SKU: Can be "isometry-ios-app" or similar unique identifier
       - Primary Language: English
    5. Verify app record shows "Prepare for Submission" status
  </instructions>
  <resume-signal>Type "app-record-ready" when app exists in App Store Connect</resume-signal>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <action>Complete required app metadata and materials</action>
  <instructions>
    1. In App Store Connect, select the Isometry app
    2. Go to "App Information" tab and complete:
       - App Name: "Isometry"
       - Subtitle: Brief description (e.g., "Data Visualization & Organization")
       - Category: Primary "Productivity", Secondary "Business" or "Developer Tools"
       - Content Rights: Verify ownership
    3. Go to "App Store" tab -> "iOS App" -> version "2.5.0"
    4. Complete "App Store Information":
       - Description: Detailed app description highlighting PAFV architecture, LATCH filtering, CloudKit sync
       - Keywords: Relevant search terms (data visualization, productivity, organization, etc.)
       - Support URL: Provide if available
       - Marketing URL: Optional
    5. Upload App Icon (1024x1024 PNG) if not already present
    6. Add required screenshots for iPhone and iPad (minimum sizes required)
  </instructions>
  <resume-signal>Type "metadata-complete" when app information and screenshots are uploaded</resume-signal>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <action>Configure app review and compliance information</action>
  <instructions>
    1. In "App Review Information" section:
       - Provide contact information for review team
       - Add demo account credentials if app requires login
       - Include any special instructions for reviewers
    2. In "Version Release" section:
       - Choose release option (manual release recommended for first submission)
    3. Answer "App Review Questions" if any appear
    4. In "Age Rating" section, complete questionnaire:
       - Answer questions about content (violence, profanity, etc.)
       - For productivity app, should result in 4+ rating
    5. Save all changes and verify no red warning indicators remain
  </instructions>
  <resume-signal>Type "review-info-complete" when all app review information is configured</resume-signal>
</task>

</tasks>

<verification>
- App Store Connect app record exists with correct bundle identifier
- All required metadata fields are completed
- App screenshots and icon are uploaded
- App review information is provided and complete
- No validation errors or warnings in App Store Connect
</verification>

<success_criteria>
- App Store Connect shows "Ready to Submit" or "Waiting for Review" status
- All required app information is complete and validated
- App listing is prepared to receive archive upload
- Submission process can proceed immediately after archive validation
</success_criteria>

<output>
After completion, create `.planning/phases/ios-archive/ios-archive-03-SUMMARY.md`
</output>