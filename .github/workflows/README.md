# CI/CD Workflows

This directory contains the CI/CD workflows for the Isometry project. All workflows are designed to align with the project's Phase 1 stabilization goals and sql.js architecture.

## Workflow Status

| Workflow | Status | Purpose |
|----------|--------|---------|
| **CI** | [![CI](https://github.com/mshaler/isometry/actions/workflows/ci.yml/badge.svg)](https://github.com/mshaler/isometry/actions/workflows/ci.yml) | Core quality gates for PRs and pushes |
| **GitHub Pages** | [![Deploy to GitHub Pages](https://github.com/mshaler/isometry/actions/workflows/deploy-github-pages.yml/badge.svg)](https://github.com/mshaler/isometry/actions/workflows/deploy-github-pages.yml) | Web app deployment |
| **App Store** | [![App Store Deployment](https://github.com/mshaler/isometry/actions/workflows/app-store-deployment.yml/badge.svg)](https://github.com/mshaler/isometry/actions/workflows/app-store-deployment.yml) | iOS/macOS app distribution |
| **ETL Testing** | [![ETL Pipeline Testing](https://github.com/mshaler/isometry/actions/workflows/etl-testing.yml/badge.svg)](https://github.com/mshaler/isometry/actions/workflows/etl-testing.yml) | Data pipeline integrity |

## Quality Gates

All workflows enforce the project's quality standards defined in `CLAUDE.md`:

- ✅ **TypeScript compilation** (`npm run check:types`)
- ✅ **ESLint compliance** (`npm run check:lint`) - max 700 warnings
- ✅ **Build validation** (`npm run build`)
- ✅ **Unused export detection** (`npm run check:unused`)
- ✅ **Code duplication analysis** (`npm run check:duplication`)
- ✅ **Dependency boundaries** (`npm run check:boundaries`)
- ✅ **Directory health** (`npm run check:directory-health`)

## Workflow Descriptions

### 1. CI Workflow (`ci.yml`)

**Triggers:** Push to main/develop, Pull requests
**Duration:** ~10-15 minutes
**Purpose:** Primary quality gate for all code changes

**Jobs:**
- **Quality Gates** - Runs `npm run check` and builds the application
- **Test Suite** - Executes Vitest tests if they exist
- **Desktop Validation** - Validates Tauri builds on Linux/macOS
- **Audits** - Runs Lighthouse performance and accessibility audits
- **Security** - npm audit and CodeQL analysis
- **CI Summary** - Generates comprehensive status report

**Key Features:**
- ⚡ Parallel job execution for speed
- 📦 Caches dependencies and build artifacts
- 🎯 Conditional execution based on project structure
- 📊 Comprehensive status reporting
- 🔒 Security scanning included

### 2. GitHub Pages Deployment (`deploy-github-pages.yml`)

**Triggers:** Push to main, Manual dispatch
**Duration:** ~5-8 minutes
**Purpose:** Deploy web application to GitHub Pages

**Jobs:**
- **Quality Checks** - Ensures quality gates pass before deployment
- **Build** - Creates optimized production build
- **Deploy** - Uploads to GitHub Pages

**Key Features:**
- 🚫 **Blocks deployment** if quality checks fail
- 📦 Caches build artifacts between jobs
- ✅ Validates build output before deployment
- 🔄 Handles SPA routing with _redirects

### 3. App Store Deployment (`app-store-deployment.yml`)

**Triggers:** Version tags (v*), Manual dispatch
**Duration:** ~30-45 minutes per platform
**Purpose:** Build and distribute iOS/macOS apps to App Store

**Jobs:**
- **Validate & Prepare** - Version extraction and validation
- **iOS Build** - Archive, sign, and upload iOS app
- **macOS Build** - Archive, sign, and upload macOS app
- **Post-deployment** - Generate deployment report
- **Cleanup** - Artifact cleanup

**Key Features:**
- 🍎 Full App Store Connect integration
- 🔐 Secure certificate and provisioning profile handling
- 📱 Parallel iOS and macOS builds
- ✅ Production build validation
- 📊 Comprehensive deployment reporting
- 🛡️ Dry-run support for testing

### 4. ETL Testing (`etl-testing.yml`)

**Triggers:** ETL-related file changes, Daily schedule, Manual dispatch
**Duration:** ~15-30 minutes
**Purpose:** Validate data import pipelines and sql.js integration

**Jobs:**
- **Setup** - Environment validation and test configuration
- **Fast Validation** - Quick tests for PRs
- **sql.js ETL Testing** - Web-based ETL testing with sql.js
- **ETL Testing Matrix** - Comprehensive Swift-based ETL tests
- **Aggregate Results** - Test result compilation
- **Update Baselines** - Performance baseline maintenance

**Key Features:**
- 🚀 Fast validation mode for PRs
- 🗄️ sql.js integration testing
- 📊 Data integrity validation
- 🔄 Performance regression detection
- 🎯 Matrix testing across platforms
- 📈 Automated baseline updates

## Environment Requirements

### Secrets (for App Store deployment)

Required GitHub repository secrets:

```
# Apple Developer
APPLE_DEVELOPER_TEAM_ID
IOS_DISTRIBUTION_CERTIFICATE (base64)
IOS_DISTRIBUTION_CERTIFICATE_PASSWORD
MACOS_DISTRIBUTION_CERTIFICATE (base64)
MACOS_DISTRIBUTION_CERTIFICATE_PASSWORD
IOS_PROVISIONING_PROFILE (base64)
MACOS_PROVISIONING_PROFILE (base64)
KEYCHAIN_PASSWORD

# App Store Connect
ASC_API_KEY_ID
ASC_API_ISSUER_ID
ASC_API_KEY (API key content)
```

### Dependencies

- **Node.js 18+** - All web-based workflows
- **Swift 5.9+** - Native ETL and App Store workflows
- **Xcode 15.2+** - iOS/macOS builds
- **Rust** - Tauri desktop builds (if present)

## Workflow Optimization

### Performance Features

- **Dependency Caching** - npm packages cached across jobs
- **Build Artifact Caching** - Compiled outputs shared between jobs
- **Conditional Execution** - Jobs skip if dependencies not present
- **Parallel Execution** - Multiple jobs run simultaneously
- **Fast Paths** - Reduced scope for PR validation

### Reliability Features

- **Timeouts** - All jobs have reasonable timeout limits
- **Error Handling** - Proper exit codes and error messages
- **Artifact Retention** - Test results and logs preserved
- **Status Reporting** - Comprehensive success/failure feedback
- **Rollback Safety** - Quality gates prevent bad deployments

## Monitoring & Debugging

### Artifact Downloads

Each workflow produces downloadable artifacts:

- **CI**: Build artifacts, test results, Lighthouse reports
- **GitHub Pages**: Build validation logs
- **App Store**: iOS/macOS archives, export logs, deployment metadata
- **ETL Testing**: Test results, performance data, baseline comparisons

### Log Analysis

All workflows include structured logging:

- 🔍 **Validation steps** clearly marked
- ⚡ **Performance metrics** captured
- ❌ **Error conditions** explicitly handled
- 📊 **Status summaries** generated

### Status Monitoring

- **GitHub Actions UI** - Real-time workflow status
- **Status badges** - At-a-glance health indicators
- **PR comments** - Automated test result summaries
- **Step summaries** - Detailed job output in GitHub UI

## Troubleshooting

### Common Issues

1. **Quality gate failures**
   - Run `npm run check` locally
   - Fix TypeScript/ESLint errors
   - Ensure all tests pass

2. **Build failures**
   - Check dependency compatibility
   - Verify build scripts work locally
   - Review build output for missing files

3. **App Store upload failures**
   - Verify certificates are valid
   - Check provisioning profiles
   - Ensure bundle IDs match

4. **ETL test failures**
   - Validate test data is available
   - Check sql.js integration
   - Review data integrity constraints

### Debug Commands

```bash
# Local quality check (matches CI)
npm run check

# Local build verification
npm run build

# Local test execution
npm run test:run

# Local Tauri build validation
npm run build:desktop:debug
```

## Contributing

When modifying workflows:

1. **Test locally first** using the debug commands above
2. **Update this documentation** if adding new workflows
3. **Follow the project's commit conventions** (`feat:`, `fix:`, etc.)
4. **Ensure quality gates pass** before requesting review

All workflows are designed to support the project's Phase 1 stabilization goals and sql.js architecture migration.