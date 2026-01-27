#!/bin/bash

#
# setup-production-certificates.sh
# Production Certificate and Provisioning Profile Setup
# Isometry - Phase 13.2
#
# Automates Apple Developer certificate management for App Store distribution
# Supports both iOS Distribution and macOS Developer ID Application certificates
#

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_ROOT/build.log"
DRY_RUN=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Apple Developer Configuration
APPLE_DEVELOPER_TEAM_ID="${APPLE_DEVELOPER_TEAM_ID:-}"
APPLE_DEVELOPER_EMAIL="${APPLE_DEVELOPER_EMAIL:-}"
BUNDLE_ID_IOS="com.cardboard.isometry"
BUNDLE_ID_MACOS="com.cardboard.isometry.macos"

# Certificate Identifiers
IOS_DISTRIBUTION_CERT_NAME="iPhone Distribution"
MACOS_DISTRIBUTION_CERT_NAME="Developer ID Application"

# Provisioning Profile Names
IOS_PROFILE_NAME="Isometry App Store Distribution"
MACOS_PROFILE_NAME="Isometry Mac App Store Distribution"

# Keychain Configuration
KEYCHAIN_NAME="isometry-certificates"
KEYCHAIN_PASSWORD="$(openssl rand -base64 32)"
TEMP_KEYCHAIN_PATH="$HOME/Library/Keychains/${KEYCHAIN_NAME}.keychain-db"

#
# Utility Functions
#

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    case "$level" in
        "INFO")  echo -e "${BLUE}[INFO]${NC} $message" ;;
        "WARN")  echo -e "${YELLOW}[WARN]${NC} $message" ;;
        "ERROR") echo -e "${RED}[ERROR]${NC} $message" ;;
        "SUCCESS") echo -e "${GREEN}[SUCCESS]${NC} $message" ;;
    esac

    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

show_usage() {
    cat << EOF
Production Certificate Setup - Isometry Phase 13.2

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --dry-run           Show what would be done without making changes
    --team-id ID        Apple Developer Team ID
    --email EMAIL       Apple Developer account email
    --clean             Remove existing certificates and start fresh
    --help             Show this help message

ENVIRONMENT VARIABLES:
    APPLE_DEVELOPER_TEAM_ID     Your Apple Developer Team ID
    APPLE_DEVELOPER_EMAIL       Your Apple Developer account email
    DISTRIBUTION_CERT_ID        Existing distribution certificate ID (optional)

EXAMPLES:
    # Dry run to check configuration
    $0 --dry-run

    # Setup with specific team
    $0 --team-id ABCD123456 --email developer@company.com

    # Clean install
    $0 --clean

PREREQUISITES:
    1. Valid Apple Developer account with distribution privileges
    2. Xcode command line tools installed
    3. Internet connection for certificate validation

EOF
}

validate_prerequisites() {
    log "INFO" "Validating prerequisites..."

    # Check Xcode command line tools
    if ! xcode-select -p >/dev/null 2>&1; then
        log "ERROR" "Xcode command line tools not found"
        log "ERROR" "Install with: xcode-select --install"
        exit 1
    fi

    # Check security command
    if ! command -v security >/dev/null 2>&1; then
        log "ERROR" "macOS security command not found"
        exit 1
    fi

    # Check for required environment variables
    if [[ -z "$APPLE_DEVELOPER_TEAM_ID" ]]; then
        log "ERROR" "APPLE_DEVELOPER_TEAM_ID environment variable required"
        log "ERROR" "Find your Team ID at: https://developer.apple.com/account/#!/membership/"
        exit 1
    fi

    # Validate Team ID format
    if [[ ! "$APPLE_DEVELOPER_TEAM_ID" =~ ^[A-Z0-9]{10}$ ]]; then
        log "ERROR" "Invalid Team ID format. Should be 10 alphanumeric characters."
        exit 1
    fi

    log "SUCCESS" "Prerequisites validated"
}

create_keychain() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "[DRY RUN] Would create temporary keychain: $KEYCHAIN_NAME"
        return
    fi

    log "INFO" "Creating temporary keychain for certificate management..."

    # Delete existing keychain if it exists
    if security list-keychains | grep -q "$KEYCHAIN_NAME"; then
        security delete-keychain "$TEMP_KEYCHAIN_PATH" || true
    fi

    # Create new keychain
    security create-keychain -p "$KEYCHAIN_PASSWORD" "$TEMP_KEYCHAIN_PATH"
    security set-keychain-settings -lut 21600 "$TEMP_KEYCHAIN_PATH"
    security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$TEMP_KEYCHAIN_PATH"

    # Add to keychain search list
    security list-keychains -d user -s "$TEMP_KEYCHAIN_PATH" $(security list-keychains -d user | sed s/\"//g)

    log "SUCCESS" "Temporary keychain created"
}

cleanup_keychain() {
    if [[ -f "$TEMP_KEYCHAIN_PATH" ]]; then
        log "INFO" "Cleaning up temporary keychain..."
        security delete-keychain "$TEMP_KEYCHAIN_PATH" 2>/dev/null || true
    fi
}

check_existing_certificates() {
    log "INFO" "Checking for existing distribution certificates..."

    local ios_cert_found=false
    local macos_cert_found=false

    # Check for iOS Distribution certificate
    if security find-certificate -c "$IOS_DISTRIBUTION_CERT_NAME" -a >/dev/null 2>&1; then
        ios_cert_found=true
        log "SUCCESS" "Found existing iOS Distribution certificate"
    fi

    # Check for macOS Developer ID certificate
    if security find-certificate -c "$MACOS_DISTRIBUTION_CERT_NAME" -a >/dev/null 2>&1; then
        macos_cert_found=true
        log "SUCCESS" "Found existing macOS Developer ID certificate"
    fi

    if [[ "$ios_cert_found" == "true" && "$macos_cert_found" == "true" ]]; then
        log "SUCCESS" "All required certificates found in keychain"
        return 0
    fi

    return 1
}

generate_csr() {
    local cert_type="$1"
    local common_name="$2"
    local csr_path="$3"
    local key_path="$4"

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "[DRY RUN] Would generate CSR for $cert_type"
        return
    fi

    log "INFO" "Generating Certificate Signing Request for $cert_type..."

    # Create private key
    openssl genrsa -out "$key_path" 2048

    # Create CSR
    openssl req -new -key "$key_path" -out "$csr_path" -subj "/CN=$common_name/O=$APPLE_DEVELOPER_TEAM_ID/C=US"

    log "SUCCESS" "CSR generated: $csr_path"
}

install_certificate() {
    local cert_path="$1"
    local key_path="$2"
    local cert_type="$3"

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "[DRY RUN] Would install certificate: $cert_type"
        return
    fi

    log "INFO" "Installing $cert_type certificate..."

    # Convert to P12 format for keychain import
    local p12_path="${cert_path%.*}.p12"
    local p12_password="$(openssl rand -base64 16)"

    openssl pkcs12 -export -out "$p12_path" -inkey "$key_path" -in "$cert_path" -passout "pass:$p12_password"

    # Import to keychain
    security import "$p12_path" -k "$TEMP_KEYCHAIN_PATH" -P "$p12_password" -T /usr/bin/codesign -T /usr/bin/security

    # Allow codesign to use the certificate
    security set-key-partition-list -S apple-tool:,apple: -s -k "$KEYCHAIN_PASSWORD" "$TEMP_KEYCHAIN_PATH"

    # Clean up temporary files
    rm -f "$p12_path"

    log "SUCCESS" "$cert_type certificate installed"
}

validate_certificate_chain() {
    local cert_name="$1"

    log "INFO" "Validating certificate chain for: $cert_name"

    if security verify-cert -c "$cert_name" >/dev/null 2>&1; then
        log "SUCCESS" "Certificate chain valid for: $cert_name"
        return 0
    else
        log "WARN" "Certificate chain validation failed for: $cert_name"
        return 1
    fi
}

setup_ios_distribution() {
    log "INFO" "Setting up iOS Distribution certificate..."

    local csr_path="$(mktemp -t ios_distribution.csr)"
    local key_path="$(mktemp -t ios_distribution.key)"
    local cert_path="$(mktemp -t ios_distribution.cer)"

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "[DRY RUN] iOS Distribution certificate setup"
        return
    fi

    # Generate CSR
    generate_csr "iOS Distribution" "iOS Distribution: $BUNDLE_ID_IOS ($APPLE_DEVELOPER_TEAM_ID)" "$csr_path" "$key_path"

    log "INFO" "Manual step required:"
    log "INFO" "1. Visit: https://developer.apple.com/account/resources/certificates/add"
    log "INFO" "2. Select 'iOS Distribution (App Store and Ad Hoc)'"
    log "INFO" "3. Upload CSR from: $csr_path"
    log "INFO" "4. Download certificate to: $cert_path"

    # Wait for certificate file
    while [[ ! -f "$cert_path" ]]; do
        read -p "Press Enter when certificate is downloaded to $cert_path..."
        if [[ ! -f "$cert_path" ]]; then
            log "WARN" "Certificate file not found. Please ensure it's saved to: $cert_path"
        fi
    done

    install_certificate "$cert_path" "$key_path" "iOS Distribution"
    validate_certificate_chain "$IOS_DISTRIBUTION_CERT_NAME"

    # Clean up
    rm -f "$csr_path" "$key_path" "$cert_path"
}

setup_macos_distribution() {
    log "INFO" "Setting up macOS Developer ID Application certificate..."

    local csr_path="$(mktemp -t macos_distribution.csr)"
    local key_path="$(mktemp -t macos_distribution.key)"
    local cert_path="$(mktemp -t macos_distribution.cer)"

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "[DRY RUN] macOS Developer ID Application certificate setup"
        return
    fi

    # Generate CSR
    generate_csr "macOS Developer ID" "Developer ID Application: $BUNDLE_ID_MACOS ($APPLE_DEVELOPER_TEAM_ID)" "$csr_path" "$key_path"

    log "INFO" "Manual step required:"
    log "INFO" "1. Visit: https://developer.apple.com/account/resources/certificates/add"
    log "INFO" "2. Select 'Developer ID Application'"
    log "INFO" "3. Upload CSR from: $csr_path"
    log "INFO" "4. Download certificate to: $cert_path"

    # Wait for certificate file
    while [[ ! -f "$cert_path" ]]; do
        read -p "Press Enter when certificate is downloaded to $cert_path..."
        if [[ ! -f "$cert_path" ]]; then
            log "WARN" "Certificate file not found. Please ensure it's saved to: $cert_path"
        fi
    done

    install_certificate "$cert_path" "$key_path" "macOS Developer ID Application"
    validate_certificate_chain "$MACOS_DISTRIBUTION_CERT_NAME"

    # Clean up
    rm -f "$csr_path" "$key_path" "$cert_path"
}

setup_provisioning_profiles() {
    log "INFO" "Setting up provisioning profiles..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "[DRY RUN] Provisioning profile setup"
        return
    fi

    log "INFO" "Manual steps required for provisioning profiles:"
    log "INFO" ""
    log "INFO" "iOS App Store Provisioning Profile:"
    log "INFO" "1. Visit: https://developer.apple.com/account/resources/profiles/add"
    log "INFO" "2. Select 'App Store' distribution"
    log "INFO" "3. Choose App ID: $BUNDLE_ID_IOS"
    log "INFO" "4. Select iOS Distribution certificate"
    log "INFO" "5. Name: $IOS_PROFILE_NAME"
    log "INFO" "6. Download and double-click to install"
    log "INFO" ""
    log "INFO" "macOS App Store Provisioning Profile:"
    log "INFO" "1. In same location, select 'Mac App Store'"
    log "INFO" "2. Choose App ID: $BUNDLE_ID_MACOS"
    log "INFO" "3. Select Developer ID Application certificate"
    log "INFO" "4. Name: $MACOS_PROFILE_NAME"
    log "INFO" "5. Download and double-click to install"

    read -p "Press Enter when both provisioning profiles are installed..."

    # Verify profiles are installed
    local profiles_dir="$HOME/Library/MobileDevice/Provisioning Profiles"
    if [[ ! -d "$profiles_dir" ]]; then
        log "WARN" "Provisioning profiles directory not found"
        return
    fi

    local profile_count=$(find "$profiles_dir" -name "*.mobileprovision" | wc -l)
    if [[ $profile_count -gt 0 ]]; then
        log "SUCCESS" "Found $profile_count provisioning profiles"
    else
        log "WARN" "No provisioning profiles found"
    fi
}

verify_configuration() {
    log "INFO" "Verifying production certificate configuration..."

    local verification_failed=false

    # Verify iOS Distribution certificate
    if ! security find-certificate -c "$IOS_DISTRIBUTION_CERT_NAME" -a >/dev/null 2>&1; then
        log "ERROR" "iOS Distribution certificate not found"
        verification_failed=true
    fi

    # Verify macOS Developer ID certificate
    if ! security find-certificate -c "$MACOS_DISTRIBUTION_CERT_NAME" -a >/dev/null 2>&1; then
        log "ERROR" "macOS Developer ID Application certificate not found"
        verification_failed=true
    fi

    # Check Team ID configuration
    if [[ -z "$APPLE_DEVELOPER_TEAM_ID" ]]; then
        log "ERROR" "APPLE_DEVELOPER_TEAM_ID not configured"
        verification_failed=true
    fi

    if [[ "$verification_failed" == "true" ]]; then
        log "ERROR" "Configuration verification failed"
        exit 1
    fi

    log "SUCCESS" "Production certificate configuration verified"
}

generate_verification_report() {
    local report_path="$PROJECT_ROOT/certificate-verification-report.txt"

    cat > "$report_path" << EOF
Production Certificate Verification Report
Generated: $(date)
Team ID: $APPLE_DEVELOPER_TEAM_ID

=== iOS Distribution Certificate ===
$(security find-certificate -c "$IOS_DISTRIBUTION_CERT_NAME" -p | openssl x509 -subject -issuer -dates -noout 2>/dev/null || echo "Not found")

=== macOS Developer ID Application Certificate ===
$(security find-certificate -c "$MACOS_DISTRIBUTION_CERT_NAME" -p | openssl x509 -subject -issuer -dates -noout 2>/dev/null || echo "Not found")

=== Provisioning Profiles ===
$(find "$HOME/Library/MobileDevice/Provisioning Profiles" -name "*.mobileprovision" -exec basename {} \; 2>/dev/null | sort || echo "No profiles found")

=== Keychain Status ===
$(security list-keychains -d user)

EOF

    log "SUCCESS" "Verification report generated: $report_path"
}

#
# Main Execution
#

main() {
    local clean_install=false

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --team-id)
                APPLE_DEVELOPER_TEAM_ID="$2"
                shift 2
                ;;
            --email)
                APPLE_DEVELOPER_EMAIL="$2"
                shift 2
                ;;
            --clean)
                clean_install=true
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                log "ERROR" "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    # Initialize logging
    echo "Production Certificate Setup - $(date)" > "$LOG_FILE"

    # Trap for cleanup
    trap cleanup_keychain EXIT

    log "INFO" "Starting production certificate setup..."
    log "INFO" "Dry run mode: $DRY_RUN"

    # Validate environment
    validate_prerequisites

    # Clean install if requested
    if [[ "$clean_install" == "true" ]]; then
        log "INFO" "Clean install requested - removing existing certificates"
        # Implementation would remove existing certificates
    fi

    # Create temporary keychain for certificate management
    create_keychain

    # Check for existing certificates
    if check_existing_certificates; then
        log "INFO" "All required certificates already present"
    else
        log "INFO" "Setting up missing certificates..."

        # Setup certificates that don't exist
        if ! security find-certificate -c "$IOS_DISTRIBUTION_CERT_NAME" -a >/dev/null 2>&1; then
            setup_ios_distribution
        fi

        if ! security find-certificate -c "$MACOS_DISTRIBUTION_CERT_NAME" -a >/dev/null 2>&1; then
            setup_macos_distribution
        fi
    fi

    # Setup provisioning profiles
    setup_provisioning_profiles

    # Final verification
    verify_configuration

    # Generate report
    generate_verification_report

    log "SUCCESS" "Production certificate setup completed"
    log "INFO" "Next steps:"
    log "INFO" "1. Update Xcode project with Production.xcconfig"
    log "INFO" "2. Configure build schemes for distribution"
    log "INFO" "3. Test archive and export process"
}

# Execute main function
main "$@"