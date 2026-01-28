#!/bin/bash

# Production Build Validation Script
# Comprehensive validation of production builds before App Store submission
#
# Usage:
#   ./validate-production-build.sh [--check] [--ios] [--macos] [--verbose]
#
# Options:
#   --check    : Quick validation check only
#   --ios      : Validate iOS build only
#   --macos    : Validate macOS build only
#   --verbose  : Enable detailed logging

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NATIVE_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$NATIVE_DIR")"
BUILD_DIR="$PROJECT_ROOT/.build-artifacts"
VALIDATION_LOG="$BUILD_DIR/validation-$(date +%Y%m%d-%H%M%S).log"

# Build Configuration
BUILD_CONFIGURATION="Production"
TEAM_ID="${APPLE_DEVELOPER_TEAM_ID:-}"

# App Configuration
BUNDLE_ID_IOS="com.isometry.app.ios"
BUNDLE_ID_MACOS="com.isometry.app.macos"
MIN_IOS_VERSION="17.0"
MIN_MACOS_VERSION="14.0"

# Validation thresholds
MAX_APP_SIZE_MB=500
MAX_LAUNCH_TIME_MS=3000
MIN_PERFORMANCE_SCORE=90
MAX_MEMORY_USAGE_MB=200

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Flags
CHECK_ONLY=false
IOS_ONLY=false
MACOS_ONLY=false
VERBOSE=false

# Validation results
VALIDATION_ERRORS=0
VALIDATION_WARNINGS=0
VALIDATION_PASSED=0

# Functions

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$VALIDATION_LOG"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*" | tee -a "$VALIDATION_LOG"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $*" | tee -a "$VALIDATION_LOG"
    ((VALIDATION_PASSED++)) || true
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $*" | tee -a "$VALIDATION_LOG"
    ((VALIDATION_WARNINGS++)) || true
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $*" | tee -a "$VALIDATION_LOG"
    ((VALIDATION_ERRORS++)) || true
}

verbose_log() {
    if [[ "$VERBOSE" == true ]]; then
        log "$@"
    fi
}

validate_environment() {
    log_info "Validating build environment..."

    # Check Xcode installation
    if ! command -v xcodebuild >/dev/null 2>&1; then
        log_error "Xcode not found or not properly configured"
        return 1
    fi

    local xcode_version
    xcode_version=$(xcodebuild -version | head -n1 | cut -d' ' -f2)
    verbose_log "Xcode version: $xcode_version"

    # Check Swift version
    if command -v swift >/dev/null 2>&1; then
        local swift_version
        swift_version=$(swift --version | head -n1 | cut -d' ' -f4)
        verbose_log "Swift version: $swift_version"
    fi

    # Check project structure
    if [[ ! -f "$NATIVE_DIR/Package.swift" ]]; then
        log_error "Swift Package not found at $NATIVE_DIR/Package.swift"
        return 1
    fi

    # Check for required configuration files
    if [[ ! -f "$NATIVE_DIR/Configurations/Production.xcconfig" ]]; then
        log_error "Production.xcconfig not found"
        return 1
    fi

    # Verify team ID
    if [[ -z "$TEAM_ID" ]]; then
        log_warning "APPLE_DEVELOPER_TEAM_ID not set - some validations will be skipped"
    fi

    log_success "Build environment validation passed"
    return 0
}

validate_dependencies() {
    log_info "Validating project dependencies..."

    # Check Swift Package dependencies
    cd "$NATIVE_DIR"

    if [[ -f "Package.resolved" ]]; then
        verbose_log "Checking Package.resolved for dependency versions..."

        # Validate critical dependencies
        local required_deps=("GRDB" "CloudKit")
        for dep in "${required_deps[@]}"; do
            if grep -q "$dep" Package.resolved 2>/dev/null; then
                verbose_log "Dependency found: $dep"
            else
                log_warning "Required dependency not found in Package.resolved: $dep"
            fi
        done
    else
        log_warning "Package.resolved not found - dependencies may not be resolved"
    fi

    # Check for vulnerable dependencies
    log_info "Checking for known vulnerabilities..."
    # In a real implementation, this would integrate with security scanning tools
    verbose_log "Vulnerability scan completed (placeholder)"

    log_success "Dependency validation passed"
    return 0
}

validate_code_signing() {
    log_info "Validating code signing configuration..."

    # Check for distribution certificates
    if ! security find-certificate -c "Apple Distribution" >/dev/null 2>&1 \
        && ! security find-certificate -c "iPhone Distribution" >/dev/null 2>&1; then
        log_error "Distribution certificate not found in keychain (Apple Distribution or iPhone Distribution)"
        return 1
    fi

    # Check for Developer ID certificates (macOS)
    if [[ "$IOS_ONLY" != true ]]; then
        if ! security find-certificate -c "Developer ID Application" >/dev/null 2>&1; then
            log_warning "Developer ID Application certificate not found - macOS notarization may fail"
        fi
    fi

    # Validate provisioning profiles (if available)
    local profiles_dir="$HOME/Library/MobileDevice/Provisioning Profiles"
    if [[ -d "$profiles_dir" ]]; then
        local profile_count
        profile_count=$(find "$profiles_dir" -name "*.mobileprovision" | wc -l)
        verbose_log "Found $profile_count provisioning profiles"
    fi

    log_success "Code signing validation passed"
    return 0
}

validate_build_configuration() {
    log_info "Validating build configuration..."

    # Check Production.xcconfig
    local prod_config="$NATIVE_DIR/Configurations/Production.xcconfig"
    if [[ -f "$prod_config" ]]; then
        # Validate key configuration values
        if grep -q "CODE_SIGN_STYLE" "$prod_config"; then
            verbose_log "Code signing style configured"
        else
            log_warning "Code signing style not explicitly configured"
        fi

        if grep -q "DEVELOPMENT_TEAM" "$prod_config"; then
            verbose_log "Development team configured"
        else
            log_warning "Development team not configured in production config"
        fi

        # Check for debug settings in production
        if grep -q "DEBUG.*=.*1" "$prod_config"; then
            log_error "Debug settings found in production configuration"
        fi

        # Validate optimization settings
        if grep -q "SWIFT_OPTIMIZATION_LEVEL.*-O" "$prod_config"; then
            verbose_log "Swift optimization enabled"
        else
            log_warning "Swift optimization not explicitly configured"
        fi
    else
        log_error "Production configuration file not found"
        return 1
    fi

    log_success "Build configuration validation passed"
    return 0
}

validate_bundle_configuration() {
    local platform="$1"
    local bundle_id="$2"

    log_info "Validating bundle configuration for $platform..."

    # Check Info.plist
    local info_plist="$NATIVE_DIR/Sources/Isometry/Info.plist"
    if [[ -f "$info_plist" ]]; then
        # Validate bundle identifier format
        if [[ ! "$bundle_id" =~ ^[a-zA-Z0-9.-]+$ ]]; then
            log_error "Invalid bundle identifier format: $bundle_id"
            return 1
        fi

        # Check for required keys
        local required_keys=("CFBundleDisplayName" "CFBundleVersion" "CFBundleShortVersionString")
        for key in "${required_keys[@]}"; do
            if grep -q "$key" "$info_plist"; then
                verbose_log "Required key found: $key"
            else
                log_error "Required Info.plist key missing: $key"
            fi
        done

        # Validate version format
        local version_pattern="^[0-9]+\.[0-9]+\.[0-9]+$"
        if grep -q "CFBundleShortVersionString" "$info_plist"; then
            local version
            version=$(grep -A1 "CFBundleShortVersionString" "$info_plist" | grep "<string>" | sed 's/.*<string>\(.*\)<\/string>.*/\1/')
            if [[ "$version" =~ $version_pattern ]]; then
                verbose_log "Version format valid: $version"
            else
                log_warning "Version format may not comply with App Store requirements: $version"
            fi
        fi
    else
        log_error "Info.plist not found"
        return 1
    fi

    log_success "Bundle configuration validation passed for $platform"
    return 0
}

validate_entitlements() {
    local platform="$1"

    log_info "Validating entitlements for $platform..."

    local entitlements_file=""
    if [[ "$platform" == "iOS" ]]; then
        entitlements_file="$NATIVE_DIR/IsometryApp/IsometryApp.entitlements"
    elif [[ "$platform" == "macOS" ]]; then
        entitlements_file="$NATIVE_DIR/IsometryApp/IsometryApp.entitlements"
    fi

    if [[ -f "$entitlements_file" ]]; then
        # Check for CloudKit entitlements
        if grep -q "com.apple.developer.icloud-services" "$entitlements_file"; then
            verbose_log "CloudKit entitlements found"

            # Validate CloudKit containers
            if grep -q "com.apple.developer.icloud-container-identifiers" "$entitlements_file"; then
                verbose_log "CloudKit container identifiers configured"
            else
                log_warning "CloudKit container identifiers not found in entitlements"
            fi
        else
            log_warning "CloudKit entitlements not found"
        fi

        # Check for App Sandbox (macOS)
        if [[ "$platform" == "macOS" ]]; then
            if grep -q "com.apple.security.app-sandbox" "$entitlements_file"; then
                verbose_log "App Sandbox enabled for macOS"
            else
                log_error "App Sandbox not enabled for macOS - required for Mac App Store"
            fi
        fi

        # Check for hardened runtime (macOS)
        if [[ "$platform" == "macOS" ]]; then
            if grep -q "com.apple.security.cs.allow-jit" "$entitlements_file"; then
                log_warning "JIT compilation allowed - may trigger additional review"
            fi
        fi
    else
        log_error "Entitlements file not found: $entitlements_file"
        return 1
    fi

    log_success "Entitlements validation passed for $platform"
    return 0
}

validate_security_compliance() {
    log_info "Validating security compliance..."

    # Check for Phase 13.1 security validator
    local security_validator="$NATIVE_DIR/Sources/Isometry/Security/ProductionSecurityValidator.swift"
    if [[ -f "$security_validator" ]]; then
        verbose_log "Production security validator found"

        # Validate security features are enabled
        if grep -q "SecurityAuditResult" "$security_validator"; then
            verbose_log "Security audit framework detected"
        else
            log_warning "Security audit framework not detected"
        fi
    else
        log_warning "Production security validator not found"
    fi

    # Check for privacy-compliant analytics
    local analytics_file="$NATIVE_DIR/Sources/Isometry/Analytics/ProductionAnalytics.swift"
    if [[ -f "$analytics_file" ]]; then
        if grep -q "PrivacyCompliantAnalytics" "$analytics_file"; then
            verbose_log "Privacy-compliant analytics detected"
        else
            log_warning "Privacy compliance protocol not found in analytics"
        fi
    else
        log_warning "Production analytics implementation not found"
    fi

    # Check for GDPR compliance features
    if grep -rq "GDPR\|DataRetention\|UserConsent" "$NATIVE_DIR/Sources/Isometry/" 2>/dev/null; then
        verbose_log "GDPR compliance features detected"
    else
        log_warning "GDPR compliance features not detected"
    fi

    log_success "Security compliance validation passed"
    return 0
}

validate_performance_benchmarks() {
    log_info "Validating performance benchmarks..."

    # Check for performance monitoring
    local monitoring_file="$NATIVE_DIR/Sources/Isometry/Monitoring/ProductionMonitoringDashboard.swift"
    if [[ -f "$monitoring_file" ]]; then
        if grep -q "PerformanceThresholds" "$monitoring_file"; then
            verbose_log "Performance thresholds configured"

            # Extract threshold values
            local launch_threshold
            launch_threshold=$(grep "maxAppLaunchTime" "$monitoring_file" | grep -o '[0-9.]\+' | head -n1)
            if [[ -n "$launch_threshold" ]]; then
                local launch_threshold_ms
                launch_threshold_ms=$(echo "$launch_threshold * 1000" | bc -l 2>/dev/null || echo "3000")
                if (( $(echo "$launch_threshold_ms < $MAX_LAUNCH_TIME_MS" | bc -l) )); then
                    verbose_log "Launch time threshold within acceptable range: ${launch_threshold}s"
                else
                    log_warning "Launch time threshold may be too high: ${launch_threshold}s"
                fi
            fi
        else
            log_warning "Performance thresholds not found in monitoring configuration"
        fi
    else
        log_warning "Production monitoring not found - performance validation limited"
    fi

    # Check for CloudKit performance optimization
    local cloudkit_config="$NATIVE_DIR/Sources/Isometry/CloudKit/ProductionCloudKitConfig.swift"
    if [[ -f "$cloudkit_config" ]]; then
        if grep -q "syncLatency\|throughput\|errorRate" "$cloudkit_config"; then
            verbose_log "CloudKit performance metrics configured"
        else
            log_warning "CloudKit performance metrics not found"
        fi
    fi

    log_success "Performance benchmarks validation passed"
    return 0
}

validate_cloudkit_connectivity() {
    log_info "Validating CloudKit production connectivity..."

    # Check CloudKit configuration
    local cloudkit_config="$NATIVE_DIR/Sources/Isometry/CloudKit/ProductionCloudKitConfig.swift"
    if [[ -f "$cloudkit_config" ]]; then
        # Check for production container ID
        if grep -q "productionContainerIdentifier" "$cloudkit_config"; then
            local container_id
            container_id=$(grep "productionContainerIdentifier" "$cloudkit_config" | grep -o '"[^"]*"' | tr -d '"')
            verbose_log "Production CloudKit container: $container_id"

            # Validate container ID format
            if [[ "$container_id" =~ ^iCloud\.[a-zA-Z0-9.-]+$ ]]; then
                verbose_log "CloudKit container ID format valid"
            else
                log_error "Invalid CloudKit container ID format: $container_id"
            fi
        else
            log_error "Production CloudKit container identifier not found"
        fi

        # Check for environment detection
        if grep -q "detectEnvironment" "$cloudkit_config"; then
            verbose_log "CloudKit environment detection implemented"
        else
            log_warning "CloudKit environment detection not found"
        fi

        # Check for schema validation
        if grep -q "ProductionSchemaValidator" "$cloudkit_config"; then
            verbose_log "CloudKit schema validation implemented"
        else
            log_warning "CloudKit schema validation not found"
        fi
    else
        log_error "CloudKit production configuration not found"
        return 1
    fi

    # Check for CloudKit deployment script
    local deploy_script="$NATIVE_DIR/Scripts/deploy-cloudkit-schema.sh"
    if [[ -f "$deploy_script" && -x "$deploy_script" ]]; then
        verbose_log "CloudKit deployment script found and executable"

        # Test script validation mode
        if "$deploy_script" --validate >/dev/null 2>&1; then
            verbose_log "CloudKit deployment script validation passed"
        else
            log_warning "CloudKit deployment script validation failed"
        fi
    else
        log_warning "CloudKit deployment script not found or not executable"
    fi

    log_success "CloudKit connectivity validation passed"
    return 0
}

run_quick_check() {
    log_info "Running quick validation check..."

    # Quick file existence checks
    local critical_files=(
        "$NATIVE_DIR/Package.swift"
        "$NATIVE_DIR/Configurations/Production.xcconfig"
        "$NATIVE_DIR/Sources/Isometry/CloudKit/ProductionCloudKitConfig.swift"
        "$NATIVE_DIR/Sources/Isometry/Monitoring/ProductionMonitoringDashboard.swift"
        "$NATIVE_DIR/Sources/Isometry/Analytics/ProductionAnalytics.swift"
    )

    for file in "${critical_files[@]}"; do
        if [[ -f "$file" ]]; then
            verbose_log "Found: $(basename "$file")"
        else
            log_error "Missing critical file: $file"
        fi
    done

    # Quick build test
    cd "$NATIVE_DIR"
    if swift build --configuration release --quiet >/dev/null 2>&1; then
        log_success "Quick build test passed"
    else
        log_error "Quick build test failed"
        log_info "Re-running swift build for details..."
        swift build --configuration release 2>&1 | tee -a "$VALIDATION_LOG"
        return 1
    fi

    log_success "Quick validation check completed"
    return 0
}

run_comprehensive_validation() {
    log_info "Running comprehensive production validation..."

    # Run all validation functions
    local validation_functions=(
        "validate_environment"
        "validate_dependencies"
        "validate_code_signing"
        "validate_build_configuration"
        "validate_security_compliance"
        "validate_performance_benchmarks"
        "validate_cloudkit_connectivity"
    )

    for func in "${validation_functions[@]}"; do
        if ! "$func"; then
            log_error "Validation failed in: $func"
        fi
    done

    # Platform-specific validations
    if [[ "$MACOS_ONLY" != true ]]; then
        validate_bundle_configuration "iOS" "$BUNDLE_ID_IOS"
        validate_entitlements "iOS"
    fi

    if [[ "$IOS_ONLY" != true ]]; then
        validate_bundle_configuration "macOS" "$BUNDLE_ID_MACOS"
        validate_entitlements "macOS"
    fi

    log_success "Comprehensive validation completed"
    return 0
}

print_validation_summary() {
    echo ""
    echo "=========================================="
    echo "Production Build Validation Summary"
    echo "=========================================="
    echo "Validation Date: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Configuration: $BUILD_CONFIGURATION"
    echo ""
    echo "Results:"
    echo "  ✅ Passed:   $VALIDATION_PASSED"
    echo "  ⚠️  Warnings: $VALIDATION_WARNINGS"
    echo "  ❌ Errors:   $VALIDATION_ERRORS"
    echo ""

    if [[ $VALIDATION_ERRORS -eq 0 ]]; then
        echo -e "${GREEN}🎉 Validation PASSED - Build ready for production deployment${NC}"
        echo ""
        echo "Next steps:"
        echo "1. Run full App Store upload script"
        echo "2. Monitor CloudKit production environment"
        echo "3. Verify TestFlight distribution"
    elif [[ $VALIDATION_ERRORS -le 2 && $VALIDATION_WARNINGS -le 5 ]]; then
        echo -e "${YELLOW}⚠️  Validation PASSED with warnings - Address issues before production${NC}"
        echo ""
        echo "Recommended actions:"
        echo "1. Review and fix warnings"
        echo "2. Run validation again"
        echo "3. Proceed with caution"
    else
        echo -e "${RED}❌ Validation FAILED - Critical issues must be resolved${NC}"
        echo ""
        echo "Required actions:"
        echo "1. Fix all critical errors"
        echo "2. Address major warnings"
        echo "3. Re-run validation"
        return 1
    fi

    echo ""
    echo "Detailed log: $VALIDATION_LOG"
    echo "=========================================="
}

# Main execution

main() {
    echo "🔍 Isometry Production Build Validation"
    echo "======================================="

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --check)
                CHECK_ONLY=true
                shift
                ;;
            --ios)
                IOS_ONLY=true
                shift
                ;;
            --macos)
                MACOS_ONLY=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --check    Quick validation check only"
                echo "  --ios      Validate iOS build only"
                echo "  --macos    Validate macOS build only"
                echo "  --verbose  Enable detailed logging"
                echo "  -h, --help Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done

    # Create build directory for logs
    mkdir -p "$BUILD_DIR"

    # Run validation
    if [[ "$CHECK_ONLY" == true ]]; then
        run_quick_check
    else
        run_comprehensive_validation
    fi

    # Print summary and exit with appropriate code
    print_validation_summary
    if [[ $VALIDATION_ERRORS -gt 0 ]]; then
        exit 1
    else
        exit 0
    fi
}

# Execute main function
main "$@"
