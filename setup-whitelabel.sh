#!/bin/bash

# Whitelabel Setup Script
# Quick setup for brand customization

echo "🎨 ProfileData Whitelabel Setup"
echo "================================"
echo ""

# Check if we're in the right directory
if [ ! -d "frontend/public" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Function to create whitelabel.json
create_json_config() {
    echo "📝 Creating whitelabel.json configuration..."
    
    read -p "App Name (e.g., Elite Matches): " APP_NAME
    read -p "Tagline (optional, press Enter to skip): " TAGLINE
    read -p "Logo filename in /public (e.g., logo.png): " LOGO_FILE
    read -p "Show logo? (y/n, default: y): " SHOW_LOGO
    read -p "Show tagline? (y/n, default: n): " SHOW_TAGLINE
    read -p "Banner height (default: 45px): " BANNER_HEIGHT
    read -p "Use theme colors? (y/n, default: y): " USE_THEME
    
    # Set defaults
    SHOW_LOGO=${SHOW_LOGO:-y}
    SHOW_TAGLINE=${SHOW_TAGLINE:-n}
    BANNER_HEIGHT=${BANNER_HEIGHT:-45px}
    USE_THEME=${USE_THEME:-y}
    LOGO_PATH="/${LOGO_FILE}"
    
    # Convert y/n to true/false
    [[ "$SHOW_LOGO" == "y" ]] && SHOW_LOGO="true" || SHOW_LOGO="false"
    [[ "$SHOW_TAGLINE" == "y" ]] && SHOW_TAGLINE="true" || SHOW_TAGLINE="false"
    [[ "$USE_THEME" == "y" ]] && USE_THEME="true" || USE_THEME="false"
    
    # Create JSON file
    cat > frontend/public/whitelabel.json <<EOF
{
  "branding": {
    "appName": "$APP_NAME",
    "tagline": "$TAGLINE",
    "logoPath": "$LOGO_PATH",
    "showLogo": $SHOW_LOGO,
    "showTagline": $SHOW_TAGLINE,
    "bannerHeight": "$BANNER_HEIGHT"
  },
  "colors": {
    "useThemeColors": $USE_THEME,
    "customBannerBg": "",
    "customTextColor": ""
  },
  "behavior": {
    "clickableHome": true,
    "homeRoute": "/dashboard",
    "sticky": true
  },
  "environment": {
    "showBadge": false,
    "badgeText": "DEMO",
    "badgeColor": "#ff9800"
  }
}
EOF
    
    echo "✅ Created frontend/public/whitelabel.json"
}

# Function to create whitelabel.ini
create_ini_config() {
    echo "📝 Creating whitelabel.ini configuration..."
    
    read -p "App Name (e.g., Elite Matches): " APP_NAME
    read -p "Tagline (optional, press Enter to skip): " TAGLINE
    read -p "Logo filename in /public (e.g., logo.png): " LOGO_FILE
    read -p "Show logo? (true/false, default: true): " SHOW_LOGO
    read -p "Show tagline? (true/false, default: false): " SHOW_TAGLINE
    read -p "Banner height (default: 45px): " BANNER_HEIGHT
    read -p "Use theme colors? (true/false, default: true): " USE_THEME
    
    # Set defaults
    SHOW_LOGO=${SHOW_LOGO:-true}
    SHOW_TAGLINE=${SHOW_TAGLINE:-false}
    BANNER_HEIGHT=${BANNER_HEIGHT:-45px}
    USE_THEME=${USE_THEME:-true}
    LOGO_PATH="/${LOGO_FILE}"
    
    # Create INI file
    cat > frontend/public/whitelabel.ini <<EOF
# Whitelabel Configuration File

[branding]
appName = $APP_NAME
tagline = $TAGLINE
logoPath = $LOGO_PATH
showLogo = $SHOW_LOGO
showTagline = $SHOW_TAGLINE
bannerHeight = $BANNER_HEIGHT

[colors]
useThemeColors = $USE_THEME
customBannerBg = 
customTextColor = 

[behavior]
clickableHome = true
homeRoute = /dashboard
sticky = true

[environment]
showBadge = false
badgeText = DEMO
badgeColor = #ff9800
EOF
    
    echo "✅ Created frontend/public/whitelabel.ini"
}

# Main menu
echo "Choose configuration format:"
echo "1) JSON (recommended)"
echo "2) INI"
echo "3) Copy example and edit manually"
echo "4) Exit"
echo ""
read -p "Your choice (1-4): " CHOICE

case $CHOICE in
    1)
        create_json_config
        ;;
    2)
        create_ini_config
        ;;
    3)
        cp frontend/public/whitelabel.example.json frontend/public/whitelabel.json
        echo "✅ Copied example to whitelabel.json"
        echo "📝 Edit frontend/public/whitelabel.json to customize"
        ;;
    4)
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "📋 Next Steps:"
echo "1. Place your logo file in frontend/public/"
echo "2. Edit frontend/public/whitelabel.json if needed"
echo "3. Restart frontend: cd frontend && npm start"
echo "4. Check browser for brand banner above TopBar"
echo ""
echo "📖 For more info, see WHITELABEL_README.md"
echo ""
echo "✅ Setup complete!"
