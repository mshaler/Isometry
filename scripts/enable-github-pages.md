# Enable GitHub Pages - Manual Steps

Since GitHub CLI is not available, follow these manual steps to enable GitHub Pages:

## Step 1: Navigate to Repository Settings

1. Go to https://github.com/mshaler/Isometry
2. Click on the "Settings" tab (far right in the tab bar)
3. Scroll down to find "Pages" in the left sidebar under "Code and automation"

## Step 2: Configure Pages Source

1. In the "Source" section, select "Deploy from a branch" dropdown
2. Change it to "GitHub Actions"
3. The system will detect the existing workflow file: `.github/workflows/deploy-github-pages.yml`

## Step 3: Verify Configuration

After enabling GitHub Actions as the source:

1. The workflow should trigger automatically on the next push to main
2. Check the "Actions" tab to see if "Deploy to GitHub Pages" workflow is running
3. Once complete, the site will be available at: https://mshaler.github.io/Isometry/

## Step 4: Test Deployment

1. Wait for the workflow to complete (usually 2-3 minutes)
2. Visit https://mshaler.github.io/Isometry/
3. Verify:
   - React app loads correctly
   - D3 visualizations render
   - Navigation works (SPA routing)
   - No console errors
   - Performance is good (<4s load time)

## Verification Checklist

- [ ] GitHub Pages source set to "GitHub Actions"
- [ ] Workflow runs successfully without errors
- [ ] Site is live at https://mshaler.github.io/Isometry/
- [ ] All functionality works in production environment
- [ ] Performance meets targets (bundle size ~159KB gzipped)

## Troubleshooting

If the workflow fails:
1. Check the Actions tab for error details
2. Common issues:
   - Node.js version mismatch (should be 18)
   - Build failures (run `npm run build` locally to test)
   - Permission issues (check workflow permissions)

## Automation Confirmed

Once enabled, every commit to main will:
1. Trigger the GitHub Actions workflow automatically
2. Build the React app with `npm run build`
3. Deploy to GitHub Pages
4. Make changes live at https://mshaler.github.io/Isometry/

This enables the GSD → commit → deploy → user feedback loop for rapid iteration.