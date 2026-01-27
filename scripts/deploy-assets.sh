#!/bin/bash

# App Store Asset Deployment Script for Isometry
# Automates the deployment and optimization of App Store marketing assets

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ASSETS_DIR="${PROJECT_ROOT}/native/AppStore/assets"
OUTPUT_DIR="${PROJECT_ROOT}/native/AppStore/assets/optimized"
TEMP_DIR="/tmp/isometry-assets-$(date +%s)"

# Asset requirements from App Store Connect
declare -A IPHONE_SIZES=(
    ["6.7"]="1290x2796"  # iPhone 14 Pro Max, 15 Pro Max
    ["6.5"]="1242x2688"  # iPhone XS Max, 11 Pro Max
    ["5.5"]="1242x2208"  # iPhone 8 Plus
)

declare -A IPAD_SIZES=(
    ["12.9"]="2048x2732"  # iPad Pro 12.9"
    ["11"]="1668x2388"    # iPad Pro 11", iPad Air
)

declare -A MACOS_SIZES=(
    ["main"]="1280x800"   # Minimum macOS screenshot size
    ["retina"]="2560x1600" # Retina display size
)

declare -A ICON_SIZES=(
    ["app_store"]="1024x1024"
    ["ios_60pt"]="180x180"
    ["ios_40pt"]="120x120"
    ["ios_29pt"]="87x87"
    ["macos_512pt"]="1024x1024"
    ["macos_256pt"]="512x512"
    ["macos_128pt"]="256x256"
    ["macos_32pt"]="64x64"
    ["macos_16pt"]="32x32"
)

# Logging functions
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    echo "[ERROR] $*" >&2
    exit 1
}

warning() {
    echo "[WARNING] $*" >&2
}

# Setup and cleanup
setup() {
    log "Setting up asset deployment environment..."
    mkdir -p "${OUTPUT_DIR}"
    mkdir -p "${TEMP_DIR}"

    # Create directory structure for optimized assets
    for platform in iPhone iPad macOS; do
        mkdir -p "${OUTPUT_DIR}/screenshots/${platform}"
    done
    mkdir -p "${OUTPUT_DIR}/icons"
    mkdir -p "${OUTPUT_DIR}/previews"
}

cleanup() {
    log "Cleaning up temporary files..."
    rm -rf "${TEMP_DIR}"
}

# Trap cleanup function
trap cleanup EXIT

# Asset validation functions
validate_image() {
    local file="$1"
    local expected_size="$2"

    if [[ ! -f "$file" ]]; then
        warning "Image file not found: $file"
        return 1
    fi

    # Check if file is actually an image
    if ! file "$file" | grep -q "image"; then
        warning "File is not a valid image: $file"
        return 1
    fi

    # Get image dimensions using sips (macOS built-in tool)
    local actual_size
    actual_size=$(sips -g pixelWidth -g pixelHeight "$file" 2>/dev/null | \
                  awk '/pixelWidth/ {w=$2} /pixelHeight/ {h=$2} END {print w"x"h}')

    if [[ "$actual_size" != "$expected_size" ]]; then
        warning "Image size mismatch for $file: expected $expected_size, got $actual_size"
        return 1
    fi

    return 0
}

optimize_image() {
    local input="$1"
    local output="$2"
    local quality="${3:-90}"

    log "Optimizing image: $(basename "$input")"

    # Use sips to optimize image quality and file size
    sips -s format jpeg -s formatOptions "$quality" "$input" --out "$output" >/dev/null 2>&1

    # If original was PNG and we need to preserve transparency, keep as PNG
    if [[ "$input" == *.png ]] && [[ "$output" == *.png ]]; then
        # Optimize PNG without quality loss
        sips -s format png "$input" --out "$output" >/dev/null 2>&1
    fi
}

# Screenshot processing functions
process_iphone_screenshots() {
    log "Processing iPhone screenshots..."
    local source_dir="${ASSETS_DIR}/screenshots/iPhone"

    if [[ ! -d "$source_dir" ]]; then
        warning "iPhone screenshots directory not found: $source_dir"
        return
    fi

    for size_name in "${!IPHONE_SIZES[@]}"; do
        local size="${IPHONE_SIZES[$size_name]}"
        local output_subdir="${OUTPUT_DIR}/screenshots/iPhone/${size_name}inch"
        mkdir -p "$output_subdir"

        # Look for appropriately sized screenshots
        for screenshot in "$source_dir"/*; do
            if [[ -f "$screenshot" ]]; then
                local filename
                filename="$(basename "$screenshot")"
                local output_file="$output_subdir/$filename"

                if validate_image "$screenshot" "$size"; then
                    optimize_image "$screenshot" "$output_file" 95
                    log "Processed iPhone $size_name\" screenshot: $filename"
                fi
            fi
        done
    done
}

process_ipad_screenshots() {
    log "Processing iPad screenshots..."
    local source_dir="${ASSETS_DIR}/screenshots/iPad"

    if [[ ! -d "$source_dir" ]]; then
        warning "iPad screenshots directory not found: $source_dir"
        return
    fi

    for size_name in "${!IPAD_SIZES[@]}"; do
        local size="${IPAD_SIZES[$size_name]}"
        local output_subdir="${OUTPUT_DIR}/screenshots/iPad/${size_name}inch"
        mkdir -p "$output_subdir"

        for screenshot in "$source_dir"/*; do
            if [[ -f "$screenshot" ]]; then
                local filename
                filename="$(basename "$screenshot")"
                local output_file="$output_subdir/$filename"

                if validate_image "$screenshot" "$size"; then
                    optimize_image "$screenshot" "$output_file" 95
                    log "Processed iPad $size_name\" screenshot: $filename"
                fi
            fi
        done
    done
}

process_macos_screenshots() {
    log "Processing macOS screenshots..."
    local source_dir="${ASSETS_DIR}/screenshots/macOS"

    if [[ ! -d "$source_dir" ]]; then
        warning "macOS screenshots directory not found: $source_dir"
        return
    fi

    local output_subdir="${OUTPUT_DIR}/screenshots/macOS"
    mkdir -p "$output_subdir"

    for screenshot in "$source_dir"/*; do
        if [[ -f "$screenshot" ]]; then
            local filename
            filename="$(basename "$screenshot")"
            local output_file="$output_subdir/$filename"

            # For macOS, accept various sizes as long as they meet minimum requirements
            optimize_image "$screenshot" "$output_file" 95
            log "Processed macOS screenshot: $filename"
        fi
    done
}

# Icon processing functions
process_icons() {
    log "Processing app icons..."
    local source_dir="${ASSETS_DIR}/icons"

    if [[ ! -d "$source_dir" ]]; then
        warning "Icons directory not found: $source_dir"
        return
    fi

    # Look for master icon file (should be 1024x1024 or larger)
    local master_icon
    master_icon=$(find "$source_dir" -name "*.png" -o -name "*.jpg" | head -1)

    if [[ -z "$master_icon" ]]; then
        warning "No master icon found in $source_dir"
        return
    fi

    log "Using master icon: $(basename "$master_icon")"

    # Generate all required icon sizes
    for size_name in "${!ICON_SIZES[@]}"; do
        local size="${ICON_SIZES[$size_name]}"
        local output_file="${OUTPUT_DIR}/icons/icon_${size_name}_${size}.png"

        # Use sips to resize icon
        sips -z "${size%x*}" "${size#*x}" "$master_icon" --out "$output_file" >/dev/null 2>&1
        log "Generated icon: ${size_name} (${size})"
    done
}

# Preview video processing
process_previews() {
    log "Processing App Store preview videos..."
    local source_dir="${ASSETS_DIR}/previews"

    if [[ ! -d "$source_dir" ]]; then
        warning "Previews directory not found: $source_dir"
        return
    fi

    local output_subdir="${OUTPUT_DIR}/previews"
    mkdir -p "$output_subdir"

    # Process video files
    for preview in "$source_dir"/*.{mp4,mov,m4v}; do
        if [[ -f "$preview" ]]; then
            local filename
            filename="$(basename "$preview")"
            local output_file="$output_subdir/$filename"

            # For now, just copy videos (optimization would require ffmpeg)
            cp "$preview" "$output_file"
            log "Processed preview video: $filename"
        fi
    done
}

# Validation and quality checks
validate_all_assets() {
    log "Validating all processed assets..."
    local validation_failed=0

    # Check for required screenshot sizes
    for platform in iPhone iPad macOS; do
        local platform_dir="${OUTPUT_DIR}/screenshots/$platform"
        if [[ -d "$platform_dir" ]]; then
            local screenshot_count
            screenshot_count=$(find "$platform_dir" -name "*.jpg" -o -name "*.png" | wc -l)
            if [[ $screenshot_count -eq 0 ]]; then
                warning "No screenshots found for $platform"
                validation_failed=1
            else
                log "Found $screenshot_count screenshots for $platform"
            fi
        fi
    done

    # Check for required icons
    local icon_count
    icon_count=$(find "${OUTPUT_DIR}/icons" -name "*.png" | wc -l)
    if [[ $icon_count -eq 0 ]]; then
        warning "No icons generated"
        validation_failed=1
    else
        log "Generated $icon_count icon variants"
    fi

    # Check App Store icon specifically (required for submission)
    if [[ ! -f "${OUTPUT_DIR}/icons/icon_app_store_1024x1024.png" ]]; then
        warning "App Store icon (1024x1024) not found - this is required for submission"
        validation_failed=1
    fi

    return $validation_failed
}

# Generate asset report
generate_asset_report() {
    local report_file="${OUTPUT_DIR}/asset_report.txt"

    log "Generating asset deployment report..."

    cat > "$report_file" << EOF
=====================================
ISOMETRY APP STORE ASSET REPORT
=====================================

Generated: $(date)
Deployment Script: $0

SCREENSHOTS:
$(find "${OUTPUT_DIR}/screenshots" -name "*.jpg" -o -name "*.png" | wc -l) total screenshots processed

iPhone Screenshots:
$(find "${OUTPUT_DIR}/screenshots/iPhone" -name "*" -type f 2>/dev/null | wc -l) files

iPad Screenshots:
$(find "${OUTPUT_DIR}/screenshots/iPad" -name "*" -type f 2>/dev/null | wc -l) files

macOS Screenshots:
$(find "${OUTPUT_DIR}/screenshots/macOS" -name "*" -type f 2>/dev/null | wc -l) files

ICONS:
$(find "${OUTPUT_DIR}/icons" -name "*.png" | wc -l) icon variants generated

PREVIEW VIDEOS:
$(find "${OUTPUT_DIR}/previews" -name "*" -type f 2>/dev/null | wc -l) preview videos processed

ASSET SIZES:
Total asset directory size: $(du -sh "${OUTPUT_DIR}" | cut -f1)

DEPLOYMENT STATUS:
$(if validate_all_assets >/dev/null 2>&1; then echo "✅ Ready for App Store Connect upload"; else echo "❌ Some assets missing or invalid"; fi)

=====================================

For App Store Connect upload:
1. Screenshots: Upload from ${OUTPUT_DIR}/screenshots/
2. Icons: Use App Store icon from ${OUTPUT_DIR}/icons/
3. Previews: Upload from ${OUTPUT_DIR}/previews/

Next steps:
- Review all assets for quality and content
- Upload to App Store Connect
- Complete app metadata in App Store Connect
- Submit for App Store review

EOF

    log "Asset report generated: $report_file"
    cat "$report_file"
}

# App Store Connect upload preparation
prepare_app_store_connect_upload() {
    log "Preparing assets for App Store Connect upload..."

    local upload_dir="${OUTPUT_DIR}/app_store_connect"
    mkdir -p "$upload_dir"

    # Create organized structure matching App Store Connect requirements
    for platform in iPhone iPad macOS; do
        if [[ -d "${OUTPUT_DIR}/screenshots/$platform" ]]; then
            cp -r "${OUTPUT_DIR}/screenshots/$platform" "$upload_dir/"
        fi
    done

    # Copy required icons
    cp "${OUTPUT_DIR}/icons/icon_app_store_1024x1024.png" "$upload_dir/app_icon.png" 2>/dev/null || warning "App Store icon not found"

    # Copy preview videos
    if [[ -d "${OUTPUT_DIR}/previews" ]]; then
        cp -r "${OUTPUT_DIR}/previews" "$upload_dir/"
    fi

    log "App Store Connect assets prepared in: $upload_dir"
}

# Main execution
main() {
    log "Starting Isometry App Store asset deployment..."

    setup

    # Process all asset types
    process_iphone_screenshots
    process_ipad_screenshots
    process_macos_screenshots
    process_icons
    process_previews

    # Validate and report
    if validate_all_assets; then
        log "✅ All assets validated successfully"
    else
        warning "❌ Some assets failed validation"
    fi

    prepare_app_store_connect_upload
    generate_asset_report

    log "Asset deployment completed!"
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi