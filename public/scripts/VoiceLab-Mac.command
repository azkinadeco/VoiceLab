#!/bin/bash
# ElevenVoice AI Lab - macOS Desktop App Launcher
echo "Starting ElevenVoice AI Lab Desktop..."

# Try launching in Chrome standalone app mode if available
if [ -d "/Applications/Google Chrome.app" ]; then
    open -na "Google Chrome" --args --app=http://localhost:3000
    exit 0
fi

# Try Microsoft Edge
if [ -d "/Applications/Microsoft Edge.app" ]; then
    open -na "Microsoft Edge" --args --app=http://localhost:3000
    exit 0
fi

# Fallback open in default browser
open http://localhost:3000
exit 0
