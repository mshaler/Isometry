# CI/CD Scripts

Automation scripts for the GSD-integrated CI/CD pipeline.

## Scripts Overview

### 🚀 `gsd-deploy.sh`
**Main deployment script** - Implements the complete GSD → commit → deploy workflow.

```bash
./scripts/gsd-deploy.sh
```

**Features:**
- Interactive GSD-style commit creation
- Local build verification
- Automated deployment trigger
- Deployment monitoring
- Performance metrics display

**Usage Flow:**
1. Detects uncommitted changes
2. Guides through GSD commit creation (type, phase-plan, description)
3. Runs local build verification
4. Pushes to trigger GitHub Actions
5. Monitors deployment progress
6. Verifies successful deployment

### 🔍 `check-deployment.sh`
**Deployment monitoring script** - Checks status and health of live deployment.

```bash
# Full health check (default)
./scripts/check-deployment.sh

# Quick status check
./scripts/check-deployment.sh status

# Comprehensive health check
./scripts/check-deployment.sh health

# Deployment info
./scripts/check-deployment.sh info
```

**Health Checks:**
- Site availability (HTTP 200)
- Content integrity (React app, D3 scripts, Isometry branding)
- Performance metrics (response time, compression)
- GitHub Actions status guidance

### 📋 `enable-github-pages.md`
**Setup guide** - Manual steps to enable GitHub Pages (when GitHub CLI unavailable).

**Steps:**
1. Repository Settings → Pages
2. Set source to "GitHub Actions"
3. Verify workflow triggers
4. Test live deployment

## Integration with GSD Methodology

### Automated Deployment Flow

```
GSD Task Execution
       ↓
./scripts/gsd-deploy.sh
       ↓
Interactive Commit Creation
       ↓
Local Build Verification
       ↓
git push origin main
       ↓
GitHub Actions Workflow
       ↓
Live Deployment
       ↓
Verification & Monitoring
```

### Quality Gates

Each deployment enforces:
- ✅ **Build Success**: `npm run build` must succeed
- ✅ **ESLint Compliance**: Zero errors enforced
- ✅ **TypeScript Safety**: Production build validates types
- ✅ **Performance**: Bundle size monitoring (~159KB gzipped)

### Commit Message Format

Scripts generate GSD-compliant commits:
```
feat(10-01): implement PAFV canvas controls

🚀 Automated deployment to https://mshaler.github.io/Isometry/
✅ Quality gates: Build success, ESLint compliance, TypeScript safety
📊 Performance: ~159KB gzipped bundle, <4s build time

Generated with GSD-integrated CI/CD workflow
```

## Workflow Examples

### Standard Development Cycle

```bash
# Make changes to React prototype
vim src/components/MyComponent.tsx

# Deploy with GSD workflow
./scripts/gsd-deploy.sh
# → Prompts for commit type, phase-plan, description
# → Builds locally, pushes, deploys automatically

# Check deployment status
./scripts/check-deployment.sh
# → Verifies live site health and performance
```

### Quick Status Check

```bash
# Just check if site is live
./scripts/check-deployment.sh status

# Get deployment URLs and info
./scripts/check-deployment.sh info
```

### Troubleshooting Deployment

```bash
# Run comprehensive health check
./scripts/check-deployment.sh health

# Check GitHub Actions manually:
# → https://github.com/mshaler/Isometry/actions
```

## Configuration

### Environment Variables
- `DEPLOYMENT_URL`: https://mshaler.github.io/Isometry/ (default)
- `GITHUB_REPO`: mshaler/Isometry (default)

### Customization
Scripts can be customized for:
- Different deployment targets
- Custom performance thresholds
- Additional health checks
- Alternative commit message formats

## Benefits

1. **Rapid Iteration**: Commit → Deploy → Live in ~3 minutes
2. **Quality Assurance**: Automated quality gates prevent broken deployments
3. **User Feedback Loop**: Immediate access for real users to test changes
4. **GSD Integration**: Maintains proper commit history and methodology
5. **Monitoring**: Automated health checks and performance tracking

## Future Enhancements

- [ ] GitHub CLI integration for workflow status
- [ ] Automated Lighthouse performance testing
- [ ] Slack/Discord deployment notifications
- [ ] Staging environment for feature branches
- [ ] Analytics integration for usage tracking