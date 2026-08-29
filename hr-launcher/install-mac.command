#!/bin/bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST="$HOME/Library/LaunchAgents/uz.eses.hr-launcher.plist"
START_CMD="$DIR/start.command"
LOG="$DIR/hr-launcher.log"
APP="$HOME/Applications/SES-HR-Launcher.app"

chmod +x "$START_CMD"

# ses-hr:// protokoli (HR bosilganda Mac da launcher ishga tushishi uchun)
mkdir -p "$APP/Contents/MacOS"
cat > "$APP/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>launcher</string>
  <key>CFBundleIdentifier</key>
  <string>uz.eses.hr-launcher</string>
  <key>CFBundleName</key>
  <string>SES HR Launcher</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleURLName</key>
      <string>SES HR</string>
      <key>CFBundleURLSchemes</key>
      <array>
        <string>ses-hr</string>
      </array>
    </dict>
  </array>
</dict>
</plist>
EOF

cat > "$APP/Contents/MacOS/launcher" <<EOF
#!/bin/bash
exec "$START_CMD"
EOF
chmod +x "$APP/Contents/MacOS/launcher"

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
  <true/>
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

"$START_CMD"
open "$APP" 2>/dev/null || true

echo ""
echo "Tayyor!"
echo "- ses-hr:// protokoli ro'yxatdan o'tdi"
echo "- Login da launcher avtomatik ishga tushadi"
echo "- Endi eses.uz da HR ni bosishingiz mumkin"
echo ""
echo "Agar Chrome ruxsat so'rasa — Allow bosing."
