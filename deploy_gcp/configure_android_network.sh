#!/bin/bash

##############################################
# 🔧 Configure Android Network Security
# Allows HTTP traffic for local development
# Run this after: ./setup_android.sh
##############################################

echo "🔧 Configuring Android network security..."

# Create network security config directory
mkdir -p ../frontend/android/app/src/main/res/xml

# Create network security config file
cat > ../frontend/android/app/src/main/res/xml/network_security_config.xml << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Allow cleartext traffic for local development -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">10.0.2.2</domain>
        <domain includeSubdomains="true">127.0.0.1</domain>
    </domain-config>
</network-security-config>
EOF

echo "✅ Network security config created"

# Update AndroidManifest.xml if not already configured
MANIFEST="../frontend/android/app/src/main/AndroidManifest.xml"

if grep -q "networkSecurityConfig" "$MANIFEST"; then
    echo "✅ AndroidManifest.xml already configured"
else
    echo "📝 Updating AndroidManifest.xml..."
    
    # Backup original
    cp "$MANIFEST" "$MANIFEST.backup"
    
    # Add networkSecurityConfig attribute
    sed -i.bak 's/android:theme="@style\/AppTheme"/android:theme="@style\/AppTheme"\n        android:networkSecurityConfig="@xml\/network_security_config"/g' "$MANIFEST"
    
    rm "$MANIFEST.bak"
    echo "✅ AndroidManifest.xml updated"
fi

echo ""
echo "🎉 Android network security configured!"
echo ""
echo "This allows HTTP traffic to:"
echo "  • localhost"
echo "  • 10.0.2.2 (emulator host)"
echo "  • 127.0.0.1"
echo ""
echo "⚠️  For production, use HTTPS only!"
