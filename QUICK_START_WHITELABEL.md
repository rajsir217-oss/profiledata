# 🚀 Quick Start: Whitelabel Your App in 3 Minutes

## Option 1: Interactive Setup (Easiest)

```bash
# Run the setup script
./setup-whitelabel.sh

# Follow the prompts to configure:
# - App name
# - Logo file
# - Tagline (optional)
# - Colors (theme or custom)
```

## Option 2: Manual JSON Edit (Fastest)

```bash
# 1. Edit the config file
nano frontend/public/whitelabel.json

# 2. Update these values:
{
  "branding": {
    "appName": "Your App Name Here",
    "logoPath": "/your-logo.png",
    "showLogo": true
  }
}

# 3. Add your logo to frontend/public/
cp /path/to/logo.png frontend/public/

# 4. Restart frontend
cd frontend && npm start
```

## Option 3: Copy Example

```bash
# Copy the example file
cp frontend/public/whitelabel.example.json frontend/public/whitelabel.json

# Edit it
nano frontend/public/whitelabel.json

# Add your logo
cp /path/to/logo.png frontend/public/

# Restart
cd frontend && npm start
```

---

## What You'll See

```
┌─────────────────────────────────────┐
│  [Your Logo] Your App Name™         │ ← Your Brand Banner (45px)
├─────────────────────────────────────┤
│  ☰  Matrimonial Profile  🔔 👤 ⏻   │ ← TopBar
├─────────────────────────────────────┤
│  Main Content                        │
└─────────────────────────────────────┘
```

---

## Common Configurations

### Just Change App Name
```json
{
  "branding": {
    "appName": "Elite Matches"
  }
}
```

### Add Logo
```json
{
  "branding": {
    "appName": "Elite Matches",
    "logoPath": "/logo.png",
    "showLogo": true
  }
}
```

### Add Tagline
```json
{
  "branding": {
    "appName": "Elite Matches",
    "tagline": "Premium Matchmaking",
    "showTagline": true
  }
}
```

### Custom Colors (Purple)
```json
{
  "branding": {
    "appName": "Elite Matches"
  },
  "colors": {
    "useThemeColors": false,
    "customBannerBg": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    "customTextColor": "#ffffff"
  }
}
```

### Show Environment Badge (Staging)
```json
{
  "branding": {
    "appName": "Elite Matches"
  },
  "environment": {
    "showBadge": true,
    "badgeText": "STAGING",
    "badgeColor": "#ff9800"
  }
}
```

---

## Troubleshooting

**Banner not showing?**
- Check file exists: `frontend/public/whitelabel.json`
- Restart frontend: `cd frontend && npm start`
- Check browser console (F12) for errors

**Logo not showing?**
- Check file exists: `frontend/public/your-logo.png`
- Check `logoPath` matches filename exactly
- Set `showLogo: true`

**Colors wrong?**
- Set `useThemeColors: false` for custom colors
- Provide valid CSS gradient/color values

---

## Need More Help?

See **WHITELABEL_README.md** for complete documentation.

---

**That's it! Your app is now whitelabeled! 🎉**
