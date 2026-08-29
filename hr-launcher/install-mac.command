#!/bin/bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST="$HOME/Library/LaunchAgents/uz.eses.hr-launcher.plist"
START_CMD="$DIR/start.command"
LOG="$DIR/hr-launcher.log"

chmod +x "$START_CMD"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>uz.eses.hr-launcher</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$START_CMD</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
  <key>StandardOutPath</key>
  <string>$LOG</string>
  <key>StandardErrorPath</key>
  <string>$LOG</string>
  <key>WorkingDirectory</key>
  <string>$DIR</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/uz.eses.hr-launcher" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl enable "gui/$(id -u)/uz.eses.hr-launcher"
launchctl kickstart -k "gui/$(id -u)/uz.eses.hr-launcher"

echo "Tayyor!"
echo "- Mac login da launcher avtomatik ishga tushadi"
echo "- Endi eses.uz da HR ni bosishingiz mumkin"
