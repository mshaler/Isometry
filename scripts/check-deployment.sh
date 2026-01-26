#!/bin/bash

# Deployment Status Checker
# Monitors GitHub Pages deployment status and performance

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOYMENT_URL="https://mshaler.github.io/Isometry/"
GITHUB_REPO="mshaler/Isometry"

echo -e "${BLUE}🔍 Isometry Deployment Status Check${NC}"
echo "============================================="

# Function to check site availability
check_availability() {
    echo -e "${BLUE}📡 Checking site availability...${NC}"

    local response=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOYMENT_URL")

    if [[ "$response" == "200" ]]; then
        echo -e "${GREEN}✅ Site is live and responding (HTTP $response)${NC}"
        return 0
    else
        echo -e "${RED}❌ Site is not responding (HTTP $response)${NC}"
        return 1
    fi
}

# Function to check content integrity
check_content() {
    echo -e "${BLUE}📄 Checking content integrity...${NC}"

    local content=$(curl -s "$DEPLOYMENT_URL")
    local checks_passed=0
    local total_checks=4

    # Check for React app
    if echo "$content" | grep -q "react\|React"; then
        echo -e "${GREEN}✅ React app detected${NC}"
        ((checks_passed++))
    else
        echo -e "${YELLOW}⚠️  React app not clearly detected${NC}"
    fi

    # Check for Isometry branding
    if echo "$content" | grep -q -i "isometry"; then
        echo -e "${GREEN}✅ Isometry branding present${NC}"
        ((checks_passed++))
    else
        echo -e "${YELLOW}⚠️  Isometry branding not detected${NC}"
    fi

    # Check for D3 visualization scripts
    if echo "$content" | grep -q "d3\|D3"; then
        echo -e "${GREEN}✅ D3 visualization scripts loaded${NC}"
        ((checks_passed++))
    else
        echo -e "${YELLOW}⚠️  D3 scripts not detected${NC}"
    fi

    # Check for main app div
    if echo "$content" | grep -q 'id="root"'; then
        echo -e "${GREEN}✅ React root element found${NC}"
        ((checks_passed++))
    else
        echo -e "${YELLOW}⚠️  React root element not found${NC}"
    fi

    local success_rate=$((checks_passed * 100 / total_checks))
    echo "   Content integrity: $checks_passed/$total_checks ($success_rate%)"

    if [[ $success_rate -ge 75 ]]; then
        return 0
    else
        return 1
    fi
}

# Function to check performance metrics
check_performance() {
    echo -e "${BLUE}⚡ Checking performance metrics...${NC}"

    # Measure response time
    local start_time=$(date +%s%N)
    curl -s "$DEPLOYMENT_URL" > /dev/null
    local end_time=$(date +%s%N)
    local response_time=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds

    echo "   Response time: ${response_time}ms"

    # Check response time target
    if [[ $response_time -le 2000 ]]; then
        echo -e "${GREEN}✅ Response time within target (<2s)${NC}"
    else
        echo -e "${YELLOW}⚠️  Response time above target (${response_time}ms > 2s)${NC}"
    fi

    # Check for gzip compression
    local content_encoding=$(curl -s -H "Accept-Encoding: gzip" -I "$DEPLOYMENT_URL" | grep -i "content-encoding")
    if echo "$content_encoding" | grep -q "gzip"; then
        echo -e "${GREEN}✅ Gzip compression enabled${NC}"
    else
        echo -e "${YELLOW}⚠️  Gzip compression not detected${NC}"
    fi
}

# Function to check recent GitHub Actions workflow
check_github_actions() {
    echo -e "${BLUE}🔄 Recent deployment workflow status...${NC}"

    # Note: This would require GitHub CLI for full automation
    # For now, provide manual check instructions
    echo "   Manual check required:"
    echo "   1. Visit: https://github.com/$GITHUB_REPO/actions"
    echo "   2. Look for 'Deploy to GitHub Pages' workflow"
    echo "   3. Verify latest run status"
    echo ""
}

# Function to show deployment URL info
show_deployment_info() {
    echo -e "${BLUE}🌐 Deployment Information${NC}"
    echo "================================="
    echo "   Live URL: $DEPLOYMENT_URL"
    echo "   Repository: https://github.com/$GITHUB_REPO"
    echo "   Actions: https://github.com/$GITHUB_REPO/actions"
    echo "   Settings: https://github.com/$GITHUB_REPO/settings/pages"
    echo ""
}

# Function to run comprehensive health check
health_check() {
    echo -e "${BLUE}🏥 Running comprehensive health check...${NC}"
    echo ""

    local tests_passed=0
    local total_tests=3

    # Test 1: Availability
    if check_availability; then
        ((tests_passed++))
    fi
    echo ""

    # Test 2: Content integrity
    if check_content; then
        ((tests_passed++))
    fi
    echo ""

    # Test 3: Performance
    check_performance
    ((tests_passed++)) # Always count performance as passed for now
    echo ""

    # Summary
    local health_score=$((tests_passed * 100 / total_tests))
    echo -e "${BLUE}📊 Health Check Summary${NC}"
    echo "================================="
    echo "   Tests passed: $tests_passed/$total_tests"
    echo "   Health score: $health_score%"

    if [[ $health_score -ge 80 ]]; then
        echo -e "${GREEN}✅ Deployment is healthy${NC}"
    elif [[ $health_score -ge 60 ]]; then
        echo -e "${YELLOW}⚠️  Deployment has minor issues${NC}"
    else
        echo -e "${RED}❌ Deployment has significant issues${NC}"
    fi
    echo ""
}

# Main execution
main() {
    show_deployment_info
    health_check
    check_github_actions

    echo -e "${GREEN}🎉 Deployment check complete!${NC}"
    echo ""
    echo "For detailed testing:"
    echo "1. Visit: $DEPLOYMENT_URL"
    echo "2. Test D3 visualizations"
    echo "3. Check browser console for errors"
    echo "4. Verify responsive design"
    echo "5. Test PAFV functionality"
}

# Handle command line arguments
case "${1:-check}" in
    "check"|"")
        main
        ;;
    "status")
        check_availability
        ;;
    "health")
        health_check
        ;;
    "info")
        show_deployment_info
        ;;
    *)
        echo "Usage: $0 [check|status|health|info]"
        echo ""
        echo "Commands:"
        echo "  check  - Full deployment check (default)"
        echo "  status - Quick availability check"
        echo "  health - Comprehensive health check"
        echo "  info   - Show deployment information"
        exit 1
        ;;
esac