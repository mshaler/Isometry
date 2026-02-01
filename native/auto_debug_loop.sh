#!/bin/bash

# Automated Debug Loop - Build, Test, Analyze, Fix, Repeat
set -e

ITERATION=1
MAX_ITERATIONS=5

echo "🤖 Starting automated debug loop (max $MAX_ITERATIONS iterations)..."

analyze_diagnostic() {
    local diagnostic_file="/tmp/isometry_bridge_diagnostic.json"

    if [ ! -f "$diagnostic_file" ]; then
        echo "❌ No diagnostic file found"
        return 1
    fi

    echo "📊 Analyzing diagnostic results..."

    # Extract key information using jq if available, otherwise use grep/sed
    if command -v jq >/dev/null 2>&1; then
        local webkit_exists=$(jq -r '.tests.webkit_exists' "$diagnostic_file")
        local handlers_exist=$(jq -r '.tests.messageHandlers_exists' "$diagnostic_file")
        local available_handlers=$(jq -r '.tests.available_handlers | length' "$diagnostic_file")
        local direct_msg_sent=$(jq -r '.tests.direct_message_sent' "$diagnostic_file")
        local bridge_wrapper_exists=$(jq -r '.tests.bridge_wrapper_exists' "$diagnostic_file")
        local errors=$(jq -r '.summary.errors[]' "$diagnostic_file" 2>/dev/null | wc -l)

        echo "📋 Diagnostic Summary:"
        echo "  - WebKit exists: $webkit_exists"
        echo "  - Message handlers exist: $handlers_exist"
        echo "  - Available handlers: $available_handlers"
        echo "  - Direct message sent: $direct_msg_sent"
        echo "  - Bridge wrapper exists: $bridge_wrapper_exists"
        echo "  - Total errors: $errors"

        # Return status based on analysis
        if [ "$webkit_exists" = "true" ] && [ "$handlers_exist" = "true" ] && [ "$available_handlers" -gt 0 ] && [ "$direct_msg_sent" = "true" ]; then
            echo "✅ Bridge appears to be working!"
            return 0
        else
            echo "❌ Bridge has issues that need fixing"
            return 1
        fi
    else
        # Fallback analysis without jq
        if grep -q '"webkit_exists": *true' "$diagnostic_file" &&
           grep -q '"messageHandlers_exists": *true' "$diagnostic_file" &&
           grep -q '"direct_message_sent": *true' "$diagnostic_file"; then
            echo "✅ Bridge appears to be working!"
            return 0
        else
            echo "❌ Bridge has issues that need fixing"
            return 1
        fi
    fi
}

run_iteration() {
    local iter=$1
    echo ""
    echo "🔄 ITERATION $iter/$MAX_ITERATIONS"
    echo "================================"

    # Clean up previous diagnostic
    rm -f /tmp/isometry_bridge_diagnostic.json

    # Run the debug script
    if ./debug_bridge.sh; then
        echo "✅ Debug script completed successfully"

        # Analyze results
        if analyze_diagnostic; then
            echo "🎉 SUCCESS! Bridge is working correctly."
            return 0
        else
            echo "🔧 Bridge needs fixes, continuing..."
            return 1
        fi
    else
        echo "❌ Debug script failed"
        return 1
    fi
}

main() {
    echo "🤖 Automated Debug Loop Starting"
    echo "==============================="

    for i in $(seq 1 $MAX_ITERATIONS); do
        if run_iteration $i; then
            echo "🎉 Bridge fixed successfully in $i iterations!"
            exit 0
        fi

        if [ $i -lt $MAX_ITERATIONS ]; then
            echo "⏰ Waiting 2 seconds before next iteration..."
            sleep 2
        fi
    done

    echo "❌ Failed to fix bridge after $MAX_ITERATIONS iterations"
    echo "📋 Final diagnostic:"
    if [ -f "/tmp/isometry_bridge_diagnostic.json" ]; then
        cat /tmp/isometry_bridge_diagnostic.json
    fi
    exit 1
}

# Run main function
main "$@"