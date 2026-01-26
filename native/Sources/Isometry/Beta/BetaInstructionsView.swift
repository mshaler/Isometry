import SwiftUI

/// Detailed beta testing instructions and guidelines with interactive guidance
public struct BetaInstructionsView: View {
    let betaVersion: BetaVersion?
    @Environment(\.dismiss) private var dismiss

    // UX-03: Interactive testing guidance state
    @StateObject private var betaManager = BetaTestingManager()
    @State private var selectedTab = 0
    @State private var completedSteps: Set<Int> = []
    @State private var showingChecklist = false
    @State private var showingHelp = false

    public init(betaVersion: BetaVersion?) {
        self.betaVersion = betaVersion
    }

    public var body: some View {
        NavigationView {
            TabView(selection: $selectedTab) {
                // UX-03: Interactive Testing Guidance
                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        headerSection
                        progressSection
                        interactiveTestingSection
                        testingFocusSection
                        stepByStepGuide
                    }
                    .padding()
                }
                .tabItem {
                    Image(systemName: "list.bullet.clipboard")
                    Text("Testing Guide")
                }
                .tag(0)

                // UX-03: Feature-specific testing scenarios
                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        featureTestingScenariosSection
                        performanceTestingSection
                        accessibilityTestingSection
                    }
                    .padding()
                }
                .tabItem {
                    Image(systemName: "testtube.2")
                    Text("Scenarios")
                }
                .tag(1)

                // UX-03: Help and support resources
                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        knownIssuesSection
                        feedbackGuidelinesSection
                        contactSection
                        helpResourcesSection
                    }
                    .padding()
                }
                .tabItem {
                    Image(systemName: "questionmark.circle")
                    Text("Help")
                }
                .tag(2)
            }
            .navigationTitle("Beta Testing Guide")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                #if os(iOS)
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: { showingChecklist = true }) {
                        Image(systemName: "checkmark.circle")
                    }
                    .help("Testing Checklist")
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        betaManager.trackBetaEvent(BetaAnalyticsEvent(name: "instructions_viewed"))
                        dismiss()
                    }
                }
                #else
                ToolbarItem(placement: .primaryAction) {
                    Button("Done") {
                        betaManager.trackBetaEvent(BetaAnalyticsEvent(name: "instructions_viewed"))
                        dismiss()
                    }
                }
                #endif
            }
        }
        .sheet(isPresented: $showingChecklist) {
            TestingChecklistView(completedSteps: $completedSteps)
        }
        .onAppear {
            loadUserProgress()
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "testtube.2")
                    .foregroundColor(.orange)
                    .font(.title2)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Isometry Beta Testing")
                        .font(.title2)
                        .fontWeight(.semibold)

                    if let betaVersion = betaVersion {
                        Text("Version \(betaVersion.configuration.version) (\(betaVersion.configuration.build))")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer()
            }

            Text("Thank you for participating in the Isometry beta program! Your feedback is invaluable in helping us create the best possible experience.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding()
        .background(Color.orange.opacity(0.1))
        .cornerRadius(12)
    }

    // MARK: - Progress Section (UX-03)

    private var progressSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Testing Progress")
                    .font(.headline)

                Spacer()

                Text("\(completedSteps.count)/6 completed")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(.blue)
            }

            ProgressView(value: Double(completedSteps.count), total: 6.0)
                .progressViewStyle(.linear)
                .accentColor(.blue)

            HStack {
                if completedSteps.count == 6 {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                    Text("All testing activities completed!")
                        .font(.caption)
                        .foregroundColor(.green)
                } else {
                    Image(systemName: "clock")
                        .foregroundColor(.orange)
                    Text("Continue testing to unlock more features")
                        .font(.caption)
                        .foregroundColor(.orange)
                }

                Spacer()
            }
        }
        .padding()
        .background(Color.blue.opacity(0.05))
        .cornerRadius(12)
    }

    // MARK: - Interactive Testing Section (UX-03)

    private var interactiveTestingSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Quick Start Testing")
                .font(.headline)

            VStack(alignment: .leading, spacing: 12) {
                QuickTestButton(
                    icon: "play.circle.fill",
                    title: "Start Basic Testing",
                    description: "Begin with fundamental app navigation and basic features",
                    color: .green,
                    isCompleted: completedSteps.contains(1)
                ) {
                    markStepCompleted(1)
                }

                QuickTestButton(
                    icon: "arrow.triangle.2.circlepath",
                    title: "Test CloudKit Sync",
                    description: "Verify data synchronization across devices",
                    color: .blue,
                    isCompleted: completedSteps.contains(2)
                ) {
                    markStepCompleted(2)
                }

                QuickTestButton(
                    icon: "speedometer",
                    title: "Performance Testing",
                    description: "Check app responsiveness and battery usage",
                    color: .orange,
                    isCompleted: completedSteps.contains(3)
                ) {
                    markStepCompleted(3)
                }
            }
        }
        .padding()
        .background(Color.gray.opacity(0.05))
        .cornerRadius(12)
    }

    // MARK: - Testing Focus Section

    private var testingFocusSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("What to Focus On")
                .font(.headline)

            VStack(alignment: .leading, spacing: 12) {
                TestingFocusItem(
                    icon: "grid",
                    title: "SuperGrid Visualization",
                    description: "Test with various dataset sizes and configurations. Pay attention to performance with 100+ and 1000+ items.",
                    priority: .high
                )

                TestingFocusItem(
                    icon: "icloud.and.arrow.up.and.arrow.down",
                    title: "CloudKit Sync",
                    description: "Test syncing between multiple devices. Create, edit, and delete items to verify sync reliability.",
                    priority: .high
                )

                TestingFocusItem(
                    icon: "speedometer",
                    title: "Performance",
                    description: "Monitor app responsiveness, launch time, and battery usage. Report any slowdowns or frame drops.",
                    priority: .medium
                )

                TestingFocusItem(
                    icon: "line.horizontal.3.decrease.circle",
                    title: "Filter System",
                    description: "Test filtering by category, time, priority, and search functionality. Verify filter combinations work correctly.",
                    priority: .medium
                )

                TestingFocusItem(
                    icon: "accessibility",
                    title: "Accessibility",
                    description: "Test with VoiceOver, larger text sizes, and high contrast modes. Ensure all features remain usable.",
                    priority: .low
                )
            }
        }
    }

    // MARK: - Step by Step Guide

    private var stepByStepGuide: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Step-by-Step Testing Guide")
                .font(.headline)

            VStack(alignment: .leading, spacing: 16) {
                TestingStep(
                    number: 1,
                    title: "Initial Setup",
                    description: "Launch the app and complete the onboarding process. Import sample data or connect your own data sources.",
                    estimatedTime: "5 minutes"
                )

                TestingStep(
                    number: 2,
                    title: "Basic Navigation",
                    description: "Explore the SuperGrid view. Try zooming, panning, and switching between different view modes (grid, list, etc.).",
                    estimatedTime: "10 minutes"
                )

                TestingStep(
                    number: 3,
                    title: "Data Management",
                    description: "Create new items, edit existing ones, and organize them into categories. Test the full CRUD lifecycle.",
                    estimatedTime: "15 minutes"
                )

                TestingStep(
                    number: 4,
                    title: "Sync Testing",
                    description: "If you have multiple devices, test syncing. Make changes on one device and verify they appear on others.",
                    estimatedTime: "10 minutes"
                )

                TestingStep(
                    number: 5,
                    title: "Filter & Search",
                    description: "Apply various filters, use the search functionality, and test filter combinations. Clear filters and try again.",
                    estimatedTime: "10 minutes"
                )

                TestingStep(
                    number: 6,
                    title: "Edge Cases",
                    description: "Test with large datasets, poor network conditions, and while switching between apps frequently.",
                    estimatedTime: "15 minutes"
                )
            }
        }
    }

    // MARK: - Known Issues Section

    private var knownIssuesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Known Issues")
                .font(.headline)

            if let betaVersion = betaVersion, !betaVersion.knownIssues.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(betaVersion.knownIssues.enumerated()), id: \.offset) { index, issue in
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.orange)
                                .font(.caption)

                            Text(issue)
                                .font(.caption)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                .padding()
                .background(Color.orange.opacity(0.1))
                .cornerRadius(8)
            } else {
                Text("No known issues at this time. If you encounter any problems, please report them using the feedback system.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Feedback Guidelines Section

    private var feedbackGuidelinesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Feedback Guidelines")
                .font(.headline)

            VStack(alignment: .leading, spacing: 12) {
                FeedbackGuideline(
                    icon: "checkmark.circle.fill",
                    title: "Be Specific",
                    description: "Describe exactly what you were doing when the issue occurred. Include step-by-step instructions to reproduce the problem."
                )

                FeedbackGuideline(
                    icon: "camera.fill",
                    title: "Include Screenshots",
                    description: "Screenshots help us understand visual issues quickly. The feedback form can automatically capture screenshots."
                )

                FeedbackGuideline(
                    icon: "info.circle.fill",
                    title: "Provide Context",
                    description: "Include information about your device, what data you were working with, and any relevant settings you had configured."
                )

                FeedbackGuideline(
                    icon: "star.fill",
                    title: "Suggest Improvements",
                    description: "Don't just report problems - tell us what you'd like to see improved or what features would be helpful."
                )
            }

            Text("Quality feedback helps us prioritize fixes and improvements. Every submission is reviewed by our development team.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.top, 8)
        }
    }

    // MARK: - Contact Section

    private var contactSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Contact & Support")
                .font(.headline)

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: "message.fill")
                        .foregroundColor(.blue)
                    Text("Use the in-app feedback system for the fastest response")
                        .font(.caption)
                }

                HStack {
                    Image(systemName: "clock.fill")
                        .foregroundColor(.blue)
                    Text("We typically respond to feedback within 24-48 hours")
                        .font(.caption)
                }

                HStack {
                    Image(systemName: "shield.fill")
                        .foregroundColor(.blue)
                    Text("Your feedback and data are kept private and secure")
                        .font(.caption)
                }
            }
            .padding()
            .background(Color.blue.opacity(0.1))
            .cornerRadius(8)
        }
    }
}

// MARK: - Supporting Views

struct TestingFocusItem: View {
    let icon: String
    let title: String
    let description: String
    let priority: TestingPriority

    enum TestingPriority {
        case high, medium, low

        var color: Color {
            switch self {
            case .high: return .red
            case .medium: return .orange
            case .low: return .blue
            }
        }

        var text: String {
            switch self {
            case .high: return "High"
            case .medium: return "Medium"
            case .low: return "Low"
            }
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(.blue)
                .font(.title3)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(title)
                        .font(.subheadline)
                        .fontWeight(.medium)

                    Spacer()

                    Text(priority.text)
                        .font(.caption2)
                        .fontWeight(.bold)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(priority.color.opacity(0.2))
                        .foregroundColor(priority.color)
                        .cornerRadius(4)
                }

                Text(description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding()
        .background(Color.gray.opacity(0.05))
        .cornerRadius(8)
    }
}

struct TestingStep: View {
    let number: Int
    let title: String
    let description: String
    let estimatedTime: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Text("\(number)")
                .font(.title3)
                .fontWeight(.bold)
                .foregroundColor(.white)
                .frame(width: 32, height: 32)
                .background(Color.blue)
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(title)
                        .font(.subheadline)
                        .fontWeight(.medium)

                    Spacer()

                    Text(estimatedTime)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.gray.opacity(0.1))
                        .cornerRadius(4)
                }

                Text(description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

struct FeedbackGuideline: View {
    let icon: String
    let title: String
    let description: String

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: icon)
                .foregroundColor(.green)
                .font(.caption)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.caption)
                    .fontWeight(.medium)

                Text(description)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    // MARK: - New Feature-Specific Sections (UX-03)

    private var featureTestingScenariosSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Feature Testing Scenarios")
                .font(.title2)
                .fontWeight(.semibold)

            VStack(alignment: .leading, spacing: 12) {
                FeatureTestScenario(
                    icon: "grid",
                    title: "SuperGrid Visualization",
                    steps: [
                        "Create 10+ items and observe rendering performance",
                        "Try different view modes (grid, list, chart)",
                        "Test zoom and pan gestures",
                        "Check responsiveness with 100+ items"
                    ],
                    estimatedTime: "15 min",
                    difficulty: .medium
                )

                FeatureTestScenario(
                    icon: "icloud.and.arrow.up.and.arrow.down",
                    title: "CloudKit Sync Testing",
                    steps: [
                        "Create an item on Device A",
                        "Switch to Device B and verify item appears",
                        "Edit the item on Device B",
                        "Return to Device A and confirm changes sync"
                    ],
                    estimatedTime: "10 min",
                    difficulty: .advanced
                )

                FeatureTestScenario(
                    icon: "line.horizontal.3.decrease.circle",
                    title: "Filter & Search Testing",
                    steps: [
                        "Apply single filter and verify results",
                        "Combine multiple filters",
                        "Search for specific terms",
                        "Clear filters and confirm full dataset returns"
                    ],
                    estimatedTime: "8 min",
                    difficulty: .easy
                )
            }
        }
    }

    private var performanceTestingSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Performance Testing")
                .font(.title2)
                .fontWeight(.semibold)

            VStack(alignment: .leading, spacing: 12) {
                PerformanceTestCard(
                    icon: "speedometer",
                    title: "App Launch Performance",
                    description: "Time the app launch and note any delays",
                    benchmarks: ["Cold start: <3 seconds", "Warm start: <1 second"],
                    color: .blue
                )

                PerformanceTestCard(
                    icon: "battery.100",
                    title: "Battery Usage",
                    description: "Monitor battery consumption during extended use",
                    benchmarks: ["Background: <2%/hour", "Active use: <10%/hour"],
                    color: .green
                )

                PerformanceTestCard(
                    icon: "memorychip",
                    title: "Memory Usage",
                    description: "Check memory consumption with large datasets",
                    benchmarks: ["Idle: <100MB", "1000+ items: <300MB"],
                    color: .orange
                )
            }
        }
    }

    private var accessibilityTestingSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Accessibility Testing")
                .font(.title2)
                .fontWeight(.semibold)

            VStack(alignment: .leading, spacing: 12) {
                AccessibilityTestItem(
                    icon: "eye",
                    title: "VoiceOver Testing",
                    description: "Navigate the app using only VoiceOver",
                    priority: .high
                )

                AccessibilityTestItem(
                    icon: "textformat.size",
                    title: "Dynamic Type Support",
                    description: "Test with largest accessibility text sizes",
                    priority: .medium
                )

                AccessibilityTestItem(
                    icon: "circle.lefthalf.filled",
                    title: "High Contrast Mode",
                    description: "Verify readability in high contrast mode",
                    priority: .medium
                )
            }
        }
    }

    private var helpResourcesSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Help & Resources")
                .font(.title2)
                .fontWeight(.semibold)

            VStack(alignment: .leading, spacing: 12) {
                HelpResourceCard(
                    icon: "questionmark.circle.fill",
                    title: "Frequently Asked Questions",
                    description: "Common questions and troubleshooting tips"
                )

                HelpResourceCard(
                    icon: "video.circle.fill",
                    title: "Testing Video Guides",
                    description: "Step-by-step video tutorials for complex features"
                )

                HelpResourceCard(
                    icon: "person.2.circle.fill",
                    title: "Beta Community",
                    description: "Connect with other beta testers and share experiences"
                )
            }
        }
    }

    // MARK: - Helper Methods (UX-03)

    private func loadUserProgress() {
        let savedSteps = UserDefaults.standard.array(forKey: "beta_completed_steps") as? [Int] ?? []
        completedSteps = Set(savedSteps)
    }

    private func markStepCompleted(_ step: Int) {
        completedSteps.insert(step)
        let stepsArray = Array(completedSteps)
        UserDefaults.standard.set(stepsArray, forKey: "beta_completed_steps")

        betaManager.trackBetaEvent(BetaAnalyticsEvent(
            name: "testing_step_completed",
            properties: ["step": step, "total_completed": completedSteps.count]
        ))
    }
}

// MARK: - Enhanced Supporting Views (UX-03)

struct QuickTestButton: View {
    let icon: String
    let title: String
    let description: String
    let color: Color
    let isCompleted: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: isCompleted ? "checkmark.circle.fill" : icon)
                    .foregroundColor(isCompleted ? .green : color)
                    .font(.title2)

                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(.primary)

                    Text(description)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.leading)
                }

                Spacer()

                if isCompleted {
                    Text("Completed")
                        .font(.caption)
                        .foregroundColor(.green)
                        .fontWeight(.medium)
                }
            }
            .padding()
            .background(isCompleted ? Color.green.opacity(0.1) : Color.white)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isCompleted ? Color.green.opacity(0.3) : Color.gray.opacity(0.2), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

struct FeatureTestScenario: View {
    let icon: String
    let title: String
    let steps: [String]
    let estimatedTime: String
    let difficulty: TestDifficulty

    enum TestDifficulty {
        case easy, medium, advanced

        var color: Color {
            switch self {
            case .easy: return .green
            case .medium: return .orange
            case .advanced: return .red
            }
        }

        var text: String {
            switch self {
            case .easy: return "Easy"
            case .medium: return "Medium"
            case .advanced: return "Advanced"
            }
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(.blue)
                    .font(.title3)

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.subheadline)
                        .fontWeight(.medium)

                    HStack {
                        Text(estimatedTime)
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        Text("•")
                            .foregroundStyle(.tertiary)

                        Text(difficulty.text)
                            .font(.caption)
                            .foregroundColor(difficulty.color)
                            .fontWeight(.medium)
                    }
                }

                Spacer()
            }

            VStack(alignment: .leading, spacing: 6) {
                ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                    HStack(alignment: .top, spacing: 8) {
                        Text("\(index + 1).")
                            .font(.caption)
                            .fontWeight(.medium)
                            .foregroundColor(.blue)
                            .frame(width: 20, alignment: .leading)

                        Text(step)
                            .font(.caption)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        .padding()
        .background(Color.gray.opacity(0.05))
        .cornerRadius(12)
    }
}

struct PerformanceTestCard: View {
    let icon: String
    let title: String
    let description: String
    let benchmarks: [String]
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(color)
                    .font(.title3)

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.subheadline)
                        .fontWeight(.medium)

                    Text(description)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("Benchmarks:")
                    .font(.caption2)
                    .fontWeight(.medium)
                    .foregroundStyle(.secondary)

                ForEach(benchmarks, id: \.self) { benchmark in
                    HStack {
                        Text("•")
                            .foregroundColor(color)
                        Text(benchmark)
                            .font(.caption2)
                    }
                }
            }
        }
        .padding()
        .background(color.opacity(0.05))
        .cornerRadius(12)
    }
}

struct AccessibilityTestItem: View {
    let icon: String
    let title: String
    let description: String
    let priority: TestPriority

    enum TestPriority {
        case high, medium, low

        var color: Color {
            switch self {
            case .high: return .red
            case .medium: return .orange
            case .low: return .blue
            }
        }

        var text: String {
            switch self {
            case .high: return "High Priority"
            case .medium: return "Medium Priority"
            case .low: return "Low Priority"
            }
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(.purple)
                .font(.title3)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(title)
                        .font(.subheadline)
                        .fontWeight(.medium)

                    Spacer()

                    Text(priority.text)
                        .font(.caption2)
                        .foregroundColor(priority.color)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(priority.color.opacity(0.1))
                        .cornerRadius(4)
                }

                Text(description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(Color.purple.opacity(0.05))
        .cornerRadius(12)
    }
}

struct HelpResourceCard: View {
    let icon: String
    let title: String
    let description: String

    var body: some View {
        Button(action: {
            // Would open resource
        }) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .foregroundColor(.blue)
                    .font(.title2)

                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(.primary)

                    Text(description)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.leading)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .foregroundStyle(.tertiary)
                    .font(.caption)
            }
            .padding()
            .background(Color.blue.opacity(0.05))
            .cornerRadius(12)
        }
        .buttonStyle(.plain)
    }
}

struct TestingChecklistView: View {
    @Binding var completedSteps: Set<Int>
    @Environment(\.dismiss) private var dismiss

    private let checklistItems = [
        "Launch app and explore main interface",
        "Create and edit data items",
        "Test CloudKit sync functionality",
        "Apply filters and search",
        "Submit feedback through the app",
        "Test accessibility features"
    ]

    var body: some View {
        NavigationView {
            List {
                Section("Testing Checklist") {
                    ForEach(Array(checklistItems.enumerated()), id: \.offset) { index, item in
                        HStack {
                            Button(action: {
                                if completedSteps.contains(index) {
                                    completedSteps.remove(index)
                                } else {
                                    completedSteps.insert(index)
                                }
                            }) {
                                Image(systemName: completedSteps.contains(index) ? "checkmark.circle.fill" : "circle")
                                    .foregroundColor(completedSteps.contains(index) ? .green : .gray)
                            }
                            .buttonStyle(.plain)

                            Text(item)
                                .strikethrough(completedSteps.contains(index))
                        }
                    }
                }

                Section("Progress") {
                    HStack {
                        Text("Completion:")
                        Spacer()
                        Text("\(completedSteps.count)/\(checklistItems.count)")
                            .fontWeight(.medium)
                    }

                    ProgressView(value: Double(completedSteps.count), total: Double(checklistItems.count))
                        .progressViewStyle(.linear)
                }
            }
            .navigationTitle("Testing Checklist")
            .navigationBarTitleDisplayMode(.inline)
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