#!/bin/bash

# Automated Bridge Debugging Script
# This script builds, launches, monitors, and iterates on the bridge fix

set -e

echo "🤖 Starting automated bridge debugging..."

# Function to kill any running IsometryApp instances
cleanup() {
    echo "🧹 Cleaning up..."
    pkill -f IsometryApp || true
    sleep 1
}

# Function to build the app
build_app() {
    echo "🔨 Building Swift app..."
    swift build
    if [ $? -eq 0 ]; then
        echo "✅ Build successful"
        return 0
    else
        echo "❌ Build failed"
        return 1
    fi
}

# Function to launch app and monitor
launch_and_monitor() {
    echo "🚀 Launching app..."
    cleanup

    # Start the app in background
    ./.build/arm64-apple-macosx/debug/IsometryApp > app_output.log 2>&1 &
    APP_PID=$!

    echo "📱 App launched with PID: $APP_PID"
    echo "⏰ Waiting 10 seconds for diagnostic to complete..."
    sleep 10

    # Check if diagnostic file was created
    if [ -f "/tmp/isometry_bridge_diagnostic.json" ]; then
        echo "✅ Diagnostic file found!"
        cat /tmp/isometry_bridge_diagnostic.json
        return 0
    else
        echo "❌ No diagnostic file found"
        echo "📋 App output:"
        cat app_output.log
        return 1
    fi
}

# Main execution
main() {
    echo "🤖 Automated Bridge Debug Session Started"
    echo "========================================"

    # Build
    if ! build_app; then
        echo "❌ Build failed, exiting"
        exit 1
    fi

    # Launch and monitor
    if ! launch_and_monitor; then
        echo "❌ Launch/monitor failed"
        cleanup
        exit 1
    fi

    # Cleanup
    cleanup
    echo "✅ Debug session complete"
}

# Set up signal handlers
trap cleanup EXIT

# Run main function
main "$@"