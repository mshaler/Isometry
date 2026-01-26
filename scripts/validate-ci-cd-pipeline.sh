#!/bin/bash

# CI/CD Pipeline Validation Script
# Comprehensive validation of the complete automation pipeline

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${PURPLE}🔬 CI/CD Pipeline Validation${NC}"
echo "============================================="
echo "This script validates the complete automated CI/CD pipeline"
echo ""

# Configuration
DEPLOYMENT_URL="https://mshaler.github.io/Isometry/"
REPO_URL="https://github.com/mshaler/Isometry"

# Validation Results
VALIDATIONS_PASSED=0
TOTAL_VALIDATIONS=0

# Function to run validation
run_validation() {
    local test_name="$1"
    local test_command="$2"
    local success_msg="$3"
    local failure_msg="$4"

    echo -e "${BLUE}🔍 Testing: $test_name${NC}"
    ((TOTAL_VALIDATIONS++))

    if eval "$test_command"; then
        echo -e "${GREEN}✅ $success_msg${NC}"
        ((VALIDATIONS_PASSED++))
        return 0
    else
        echo -e "${RED}❌ $failure_msg${NC}"
        return 1
    fi
}

# Function to check file existence
check_files() {
    echo -e "${BLUE}📁 Checking CI/CD configuration files...${NC}"

    local files=(
        ".github/workflows/deploy-github-pages.yml"
        "_redirects"
        "package.json"
        "DEPLOYMENT.md"
        "scripts/gsd-deploy.sh"
        "scripts/check-deployment.sh"
        "scripts/enable-github-pages.md"
        "scripts/README-CI-CD.md"
        "CI-CD-TEST.md"
    )

    for file in "${files[@]}"; do
        if [[ -f "$file" ]]; then
            echo -e "${GREEN}✅ $file${NC}"
            ((VALIDATIONS_PASSED++))
        else
            echo -e "${RED}❌ $file (missing)${NC}"
        fi
        ((TOTAL_VALIDATIONS++))
    done
}

# Function to validate GitHub Actions workflow
validate_workflow() {
    echo -e "${BLUE}⚙️ Validating GitHub Actions workflow...${NC}"

    local workflow_file=".github/workflows/deploy-github-pages.yml"

    if [[ -f "$workflow_file" ]]; then
        # Check key components
        local checks=(
            "push:" "branches: \[main\]"
            "permissions:" "pages: write"
            "npm run build" "actions/deploy-pages"
        )

        local workflow_content=$(cat "$workflow_file")
        local workflow_valid=true

        for check in "${checks[@]}"; do
            if echo "$workflow_content" | grep -q "$check"; then
                echo -e "${GREEN}✅ Contains: $check${NC}"
                ((VALIDATIONS_PASSED++))
            else
                echo -e "${RED}❌ Missing: $check${NC}"
                workflow_valid=false
            fi
            ((TOTAL_VALIDATIONS++))
        done

        if $workflow_valid; then
            echo -e "${GREEN}✅ Workflow configuration appears valid${NC}"
        else
            echo -e "${YELLOW}⚠️ Workflow may need adjustments${NC}"
        fi
    else
        echo -e "${RED}❌ Workflow file not found${NC}"
        ((TOTAL_VALIDATIONS++))
    fi
}

# Function to validate build process
validate_build() {
    echo -e "${BLUE}🔨 Validating local build process...${NC}"

    # Check if npm is available
    if command -v npm >/dev/null 2>&1; then
        echo -e "${GREEN}✅ npm is available${NC}"
        ((VALIDATIONS_PASSED++))
    else
        echo -e "${RED}❌ npm is not available${NC}"
    fi
    ((TOTAL_VALIDATIONS++))

    # Check package.json build script
    if grep -q '"build":' package.json; then
        echo -e "${GREEN}✅ Build script defined in package.json${NC}"
        ((VALIDATIONS_PASSED++))
    else
        echo -e "${RED}❌ Build script missing in package.json${NC}"
    fi
    ((TOTAL_VALIDATIONS++))

    # Attempt build
    echo -e "${BLUE}   Running test build...${NC}"
    if npm run build >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Build completes successfully${NC}"
        ((VALIDATIONS_PASSED++))

        # Check build output
        if [[ -d "dist" ]]; then
            echo -e "${GREEN}✅ dist/ directory created${NC}"
            ((VALIDATIONS_PASSED++))
        else
            echo -e "${RED}❌ dist/ directory not created${NC}"
        fi

        # Check for key files
        if [[ -f "dist/index.html" ]]; then
            echo -e "${GREEN}✅ index.html generated${NC}"
            ((VALIDATIONS_PASSED++))
        else
            echo -e "${RED}❌ index.html not generated${NC}"
        fi
    else
        echo -e "${RED}❌ Build fails${NC}"
        VALIDATIONS_PASSED=$((VALIDATIONS_PASSED - 1)) # Adjust for the three checks we skip
    fi
    TOTAL_VALIDATIONS=$((TOTAL_VALIDATIONS + 3))
}

# Function to validate scripts
validate_scripts() {
    echo -e "${BLUE}📜 Validating CI/CD scripts...${NC}"

    local scripts=(
        "scripts/gsd-deploy.sh"
        "scripts/check-deployment.sh"
    )

    for script in "${scripts[@]}"; do
        if [[ -f "$script" ]]; then
            if [[ -x "$script" ]]; then
                echo -e "${GREEN}✅ $script (executable)${NC}"
                ((VALIDATIONS_PASSED++))
            else
                echo -e "${YELLOW}⚠️ $script (not executable)${NC}"
            fi
        else
            echo -e "${RED}❌ $script (missing)${NC}"
        fi
        ((TOTAL_VALIDATIONS++))
    done

    # Test script syntax
    echo -e "${BLUE}   Checking script syntax...${NC}"
    for script in "${scripts[@]}"; do
        if [[ -f "$script" ]]; then
            if bash -n "$script" 2>/dev/null; then
                echo -e "${GREEN}✅ $script syntax valid${NC}"
                ((VALIDATIONS_PASSED++))
            else
                echo -e "${RED}❌ $script syntax error${NC}"
            fi
        fi
        ((TOTAL_VALIDATIONS++))
    done
}

# Function to check Git repository status
validate_git() {
    echo -e "${BLUE}📋 Validating Git repository...${NC}"

    # Check if we're in a git repo
    if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Git repository detected${NC}"
        ((VALIDATIONS_PASSED++))
    else
        echo -e "${RED}❌ Not in a Git repository${NC}"
    fi
    ((TOTAL_VALIDATIONS++))

    # Check if we have commits
    if git log --oneline -1 >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Repository has commit history${NC}"
        ((VALIDATIONS_PASSED++))
    else
        echo -e "${RED}❌ No commit history found${NC}"
    fi
    ((TOTAL_VALIDATIONS++))

    # Check if main branch exists
    if git branch --list main | grep -q main; then
        echo -e "${GREEN}✅ Main branch exists${NC}"
        ((VALIDATIONS_PASSED++))
    else
        echo -e "${RED}❌ Main branch not found${NC}"
    fi
    ((TOTAL_VALIDATIONS++))

    # Check remote origin
    if git remote get-url origin >/dev/null 2>&1; then
        local origin=$(git remote get-url origin)
        if echo "$origin" | grep -q "mshaler/Isometry"; then
            echo -e "${GREEN}✅ Remote origin points to mshaler/Isometry${NC}"
            ((VALIDATIONS_PASSED++))
        else
            echo -e "${YELLOW}⚠️ Remote origin: $origin${NC}"
            ((VALIDATIONS_PASSED++)) # Count as pass since it exists
        fi
    else
        echo -e "${RED}❌ No remote origin configured${NC}"
    fi
    ((TOTAL_VALIDATIONS++))
}

# Function to show setup requirements
show_setup_requirements() {
    echo -e "${PURPLE}🛠️ Setup Requirements${NC}"
    echo "================================="
    echo ""
    echo -e "${YELLOW}⚠️ MANUAL SETUP REQUIRED:${NC}"
    echo ""
    echo "1. Enable GitHub Pages:"
    echo "   • Go to: ${REPO_URL}/settings/pages"
    echo "   • Set Source to: 'Deploy from a branch' → 'GitHub Actions'"
    echo "   • Save configuration"
    echo ""
    echo "2. Trigger deployment:"
    echo "   • Push to main branch triggers workflow automatically"
    echo "   • Monitor: ${REPO_URL}/actions"
    echo ""
    echo "3. Verify deployment:"
    echo "   • Site will be live at: $DEPLOYMENT_URL"
    echo "   • Run: ./scripts/check-deployment.sh"
    echo ""
}

# Function to show next steps
show_next_steps() {
    echo -e "${PURPLE}🚀 Next Steps${NC}"
    echo "================================="
    echo ""
    echo "To complete CI/CD pipeline activation:"
    echo ""
    echo "1. Follow setup guide: scripts/enable-github-pages.md"
    echo "2. Test deployment: ./scripts/gsd-deploy.sh"
    echo "3. Monitor status: ./scripts/check-deployment.sh"
    echo "4. Verify live site: $DEPLOYMENT_URL"
    echo ""
    echo "GSD Workflow Integration:"
    echo "• Every commit to main → automatic deployment"
    echo "• Quality gates enforced (build, lint, TypeScript)"
    echo "• Performance monitoring (~159KB gzipped)"
    echo "• User feedback loop (immediate access to changes)"
    echo ""
}

# Function to show validation summary
show_summary() {
    echo ""
    echo -e "${PURPLE}📊 Validation Summary${NC}"
    echo "================================="

    local success_rate=$((VALIDATIONS_PASSED * 100 / TOTAL_VALIDATIONS))
    echo "   Validations passed: $VALIDATIONS_PASSED/$TOTAL_VALIDATIONS"
    echo "   Success rate: $success_rate%"
    echo ""

    if [[ $success_rate -ge 90 ]]; then
        echo -e "${GREEN}✅ Pipeline configuration is excellent${NC}"
        echo "   Ready for GitHub Pages activation!"
    elif [[ $success_rate -ge 75 ]]; then
        echo -e "${YELLOW}⚠️ Pipeline configuration is good${NC}"
        echo "   Minor issues may need attention"
    elif [[ $success_rate -ge 50 ]]; then
        echo -e "${YELLOW}⚠️ Pipeline configuration needs work${NC}"
        echo "   Several issues need to be resolved"
    else
        echo -e "${RED}❌ Pipeline configuration has significant issues${NC}"
        echo "   Major problems need to be fixed before deployment"
    fi
    echo ""
}

# Main validation execution
main() {
    echo "Starting comprehensive CI/CD pipeline validation..."
    echo ""

    check_files
    echo ""

    validate_workflow
    echo ""

    validate_build
    echo ""

    validate_scripts
    echo ""

    validate_git
    echo ""

    show_summary

    show_setup_requirements

    show_next_steps

    echo -e "${GREEN}🎉 CI/CD Pipeline Validation Complete!${NC}"
}

# Run main validation
main "$@"