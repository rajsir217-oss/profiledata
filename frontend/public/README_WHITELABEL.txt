================================================================================
  WHITELABEL CONFIGURATION QUICK REFERENCE
================================================================================

📝 Configuration File: whitelabel.json (this folder)

🎨 Current Logo: 🪷🦅 (Lotus + Eagle = Indo-American)

🎨 To Customize Your App Branding:

1. Edit whitelabel.json and change:
   - appName: Your company/product name
   - logoText: Emoji/text logo (e.g., "🪷🦅", "🇮🇳🇺🇸", "🕉️💕")
   - logoPath: Path to image logo file (e.g., "/my-logo.png")
   - tagline: Optional subtitle/slogan
   - showLogo: true/false to show/hide logo
   - showTagline: true/false to show/hide tagline

2. Use emoji logo (EASY):
   - Set logoText: "🪷🦅" (or any emoji combo)
   - No image files needed!
   - Instant loading, scales perfectly

3. Or use custom image logo:
   - Place logo file in this folder (frontend/public/)
   - Recommended: PNG with transparency, 200x200px minimum
   - File will display at 32px height (auto-scaled)
   - Set logoPath: "/your-logo.png"

4. Restart frontend:
   cd frontend && npm start

5. Your brand banner will appear above the TopBar!

================================================================================

COMMON EXAMPLES:

Simple Rebrand (name only):
{
  "branding": {
    "appName": "Elite Matches"
  }
}

Indo-American Emoji Logo (Current):
{
  "branding": {
    "logoText": "🪷🦅",
    "tagline": "Connecting Two Cultures, One Heart"
  }
}

Alternative Emoji Logos:
{
  "branding": {
    "logoText": "🇮🇳🇺🇸"  // Flags
    // Or: "🕉️🗽"  (Om + Liberty)
    // Or: "🦚🦅"   (Peacock + Eagle)
    // Or: "🙏❤️"   (Namaste + Heart)
    // Or: "🛕💕"   (Temple + Hearts)
  }
}

With Custom Image Logo:
{
  "branding": {
    "appName": "Elite Matches",
    "logoPath": "/elite-logo.png",
    "logoText": "",
    "showLogo": true
  }
}

With Tagline:
{
  "branding": {
    "appName": "Elite Matches",
    "tagline": "Premium Matchmaking Since 2024",
    "showTagline": true
  }
}

Custom Colors (Purple):
{
  "colors": {
    "useThemeColors": false,
    "customBannerBg": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    "customTextColor": "#ffffff"
  }
}

Environment Badge (Staging):
{
  "environment": {
    "showBadge": true,
    "badgeText": "STAGING",
    "badgeColor": "#ff9800"
  }
}

================================================================================

📖 Full Documentation:
   - /WHITELABEL_README.md - Complete configuration guide
   - /QUICK_START_WHITELABEL.md - 3-minute setup
   - /INDO_AMERICAN_LOGO_OPTIONS.md - 10+ logo combinations
   - /LOGO_CHANGE_SUMMARY.md - Current logo explained

🎨 Logo Options:
   🪷🦅 - Lotus + Eagle (Current)
   🇮🇳🇺🇸 - Flags
   🕉️🗽 - Om + Liberty
   🦚🦅 - Peacock + Eagle
   🙏❤️ - Namaste + Heart
   🛕💕 - Temple + Hearts
   🪔⭐ - Diya + Star
   ... and more in INDO_AMERICAN_LOGO_OPTIONS.md!

================================================================================
