# 🎨 Whitelabel Configuration Guide

Complete guide to customizing the ProfileData application branding for different clients.

## Overview

The whitelabel system allows you to customize:
- **App Name** - Displayed in the brand banner
- **Logo** - Your company/product logo
- **Tagline** - Optional subtitle/slogan
- **Colors** - Use theme colors or custom colors
- **Behavior** - Clickability, sticky positioning
- **Environment Badge** - DEMO/STAGING/PRODUCTION indicator

---

## Quick Start

### 1. Choose Configuration Method

**Option A: JSON (Recommended)**
Edit `/frontend/public/whitelabel.json`

**Option B: INI File**
Edit `/frontend/public/whitelabel.ini`

### 2. Basic Configuration

Edit your chosen config file with your branding:

```json
{
  "branding": {
    "appName": "YourCompany Match",
    "tagline": "Find Your Perfect Partner",
    "logoPath": "/logo.png",
    "showLogo": true,
    "showTagline": true,
    "bannerHeight": "45px"
  }
}
```

### 3. Add Your Logo

Place your logo file in `/frontend/public/` directory:
- Recommended size: 200x200px minimum
- Formats: PNG (with transparency), SVG, JPG
- File will be displayed at 32px height (auto-scaled)

### 4. Restart Frontend

```bash
cd frontend
npm start
```

Your branding will appear above the TopBar!

---

## Configuration Files

### whitelabel.json (Recommended)

**Location:** `/frontend/public/whitelabel.json`

**Full Example:**
```json
{
  "branding": {
    "appName": "ProfileData",
    "tagline": "Find Your Perfect Match",
    "logoPath": "/logo192.png",
    "showLogo": true,
    "showTagline": false,
    "bannerHeight": "45px"
  },
  "colors": {
    "useThemeColors": true,
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
```

### whitelabel.ini (Alternative)

**Location:** `/frontend/public/whitelabel.ini`

**Full Example:**
```ini
# Whitelabel Configuration File

[branding]
appName = ProfileData
tagline = Find Your Perfect Match
logoPath = /logo192.png
showLogo = true
showTagline = false
bannerHeight = 45px

[colors]
useThemeColors = true
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
```

---

## Configuration Options

### [branding] Section

| Option | Type | Description | Example |
|--------|------|-------------|---------|
| `appName` | string | Your app/company name | "Elite Matches" |
| `tagline` | string | Subtitle/slogan (optional) | "Premium Matchmaking" |
| `logoPath` | string | Path to logo file | "/logo.png" |
| `showLogo` | boolean | Show/hide logo | true |
| `showTagline` | boolean | Show/hide tagline | false |
| `bannerHeight` | string | Banner height (CSS units) | "45px" |

### [colors] Section

| Option | Type | Description | Example |
|--------|------|-------------|---------|
| `useThemeColors` | boolean | Use app theme colors | true |
| `customBannerBg` | string | Custom background (gradient/color) | "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" |
| `customTextColor` | string | Custom text color | "#ffffff" |

**Theme Colors (when useThemeColors = true):**
- Background: Uses primary-to-secondary gradient
- Text: White (#ffffff)
- Adapts to theme changes automatically

**Custom Colors (when useThemeColors = false):**
```json
"colors": {
  "useThemeColors": false,
  "customBannerBg": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "customTextColor": "#ffffff"
}
```

### [behavior] Section

| Option | Type | Description | Example |
|--------|------|-------------|---------|
| `clickableHome` | boolean | Click banner to navigate home | true |
| `homeRoute` | string | Home page route | "/dashboard" |
| `sticky` | boolean | Banner stays at top when scrolling | true |

### [environment] Section

| Option | Type | Description | Example |
|--------|------|-------------|---------|
| `showBadge` | boolean | Show environment badge | true |
| `badgeText` | string | Badge text | "STAGING" |
| `badgeColor` | string | Badge background color | "#ff9800" |

**Common Badge Configurations:**

**Production:**
```json
"environment": {
  "showBadge": false
}
```

**Staging:**
```json
"environment": {
  "showBadge": true,
  "badgeText": "STAGING",
  "badgeColor": "#ff9800"
}
```

**Demo:**
```json
"environment": {
  "showBadge": true,
  "badgeText": "DEMO",
  "badgeColor": "#2196f3"
}
```

---

## Example Configurations

### Example 1: Simple Rebrand
```json
{
  "branding": {
    "appName": "Elite Matches",
    "logoPath": "/elite-logo.png",
    "showLogo": true,
    "showTagline": false,
    "bannerHeight": "45px"
  },
  "colors": {
    "useThemeColors": true
  },
  "behavior": {
    "clickableHome": true,
    "homeRoute": "/dashboard",
    "sticky": true
  },
  "environment": {
    "showBadge": false
  }
}
```

### Example 2: Full Custom Branding
```json
{
  "branding": {
    "appName": "PerfectMatch Pro",
    "tagline": "AI-Powered Matchmaking",
    "logoPath": "/perfectmatch-logo.svg",
    "showLogo": true,
    "showTagline": true,
    "bannerHeight": "50px"
  },
  "colors": {
    "useThemeColors": false,
    "customBannerBg": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    "customTextColor": "#ffffff"
  },
  "behavior": {
    "clickableHome": true,
    "homeRoute": "/dashboard",
    "sticky": true
  },
  "environment": {
    "showBadge": false
  }
}
```

### Example 3: Staging Environment
```json
{
  "branding": {
    "appName": "MatchMaker",
    "logoPath": "/logo.png",
    "showLogo": true,
    "showTagline": false,
    "bannerHeight": "45px"
  },
  "colors": {
    "useThemeColors": true
  },
  "behavior": {
    "clickableHome": true,
    "homeRoute": "/dashboard",
    "sticky": true
  },
  "environment": {
    "showBadge": true,
    "badgeText": "STAGING",
    "badgeColor": "#ff9800"
  }
}
```

---

## Logo Guidelines

### Recommended Specifications

**Size:**
- Minimum: 200x200px
- Recommended: 400x400px or higher
- Display size: 32px height (auto-scaled)

**Format:**
- **PNG** - Best for logos with transparency
- **SVG** - Best for scalability and small file size
- **JPG** - Use only if no transparency needed

**Design:**
- Simple, clean design
- High contrast against banner background
- Works well at small sizes
- Square or horizontal orientation

**File Naming:**
- Use lowercase
- No spaces (use hyphens)
- Examples: `logo.png`, `company-logo.svg`, `brand-mark.png`

### Adding Your Logo

1. **Prepare logo file** (follow guidelines above)
2. **Save to** `/frontend/public/` directory
3. **Update config:**
   ```json
   "logoPath": "/your-logo.png"
   ```
4. **Restart frontend**

### Logo Not Showing?

**Check:**
- [ ] File exists in `/frontend/public/`
- [ ] File name matches `logoPath` exactly (case-sensitive)
- [ ] `showLogo: true` in config
- [ ] No browser console errors
- [ ] Try different file format (PNG recommended)

---

## Customization Examples

### Hide Logo, Show Name Only
```json
{
  "branding": {
    "appName": "Your Company",
    "showLogo": false,
    "showTagline": false
  }
}
```

### Logo + Name + Tagline
```json
{
  "branding": {
    "appName": "Elite Matches",
    "tagline": "Premium Matchmaking Since 2024",
    "logoPath": "/logo.png",
    "showLogo": true,
    "showTagline": true
  }
}
```

### Custom Purple Theme
```json
{
  "colors": {
    "useThemeColors": false,
    "customBannerBg": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    "customTextColor": "#ffffff"
  }
}
```

### Taller Banner
```json
{
  "branding": {
    "bannerHeight": "60px"
  }
}
```

### Non-Sticky Banner
```json
{
  "behavior": {
    "sticky": false
  }
}
```

### Different Home Route
```json
{
  "behavior": {
    "clickableHome": true,
    "homeRoute": "/search"
  }
}
```

---

## Multi-Tenant Setup

For hosting multiple clients with different branding:

### Option 1: Subdomain-Based

**client1.yourapp.com:**
- Deploy with `whitelabel.json` for Client 1
- Logo: `/client1-logo.png`

**client2.yourapp.com:**
- Deploy with different `whitelabel.json` for Client 2
- Logo: `/client2-logo.png`

### Option 2: Environment Variables

Modify `/frontend/src/utils/whitelabelConfig.js` to load config based on:
- URL subdomain
- Environment variable
- API response

**Example:**
```javascript
export async function loadWhitelabelConfig() {
  // Detect client from subdomain
  const subdomain = window.location.hostname.split('.')[0];
  
  try {
    const response = await fetch(`/whitelabel-${subdomain}.json`);
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    // Fallback to default
  }
  
  return defaultConfig;
}
```

---

## Troubleshooting

### Banner Not Appearing

**Check:**
1. Config file exists: `/frontend/public/whitelabel.json` or `.ini`
2. Valid JSON/INI syntax (use validator)
3. Browser console for errors (F12)
4. Frontend restarted after config changes

### Logo Not Loading

**Check:**
1. File path is correct (starts with `/`)
2. File exists in `/frontend/public/`
3. File name matches exactly (case-sensitive)
4. File format supported (PNG, SVG, JPG)
5. Browser console for 404 errors

### Colors Not Working

**Check:**
1. `useThemeColors` set to `false` for custom colors
2. Valid CSS color values
3. Gradient syntax correct
4. Contrast sufficient (text readable on background)

### Config Not Updating

**Try:**
1. Clear browser cache (Ctrl+F5)
2. Restart frontend server
3. Check browser console for errors
4. Verify config file syntax

---

## Advanced Customization

### Custom Font in Banner

Edit `/frontend/src/components/BrandBanner.css`:

```css
.brand-app-name {
  font-family: 'Your Custom Font', sans-serif;
  font-size: 18px;
  font-weight: 700;
}
```

### Custom Animation

Add to `/frontend/src/components/BrandBanner.css`:

```css
.brand-banner {
  animation: slideDown 0.5s ease-out;
}

@keyframes slideDown {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
```

### Conditional Display

Modify `/frontend/src/components/BrandBanner.js` to hide banner on specific pages:

```javascript
const location = useLocation();
const hideBannerPaths = ['/profile', '/messages'];

if (hideBannerPaths.includes(location.pathname)) {
  return null;
}
```

---

## Best Practices

### ✅ Do's

- **Use SVG logos** for best quality and small file size
- **Test in all themes** to ensure visibility
- **Keep app name short** (< 20 characters)
- **Use theme colors** for consistency
- **Test on mobile** - tagline auto-hides
- **Version control** your config files
- **Document** client-specific customizations

### ❌ Don'ts

- **Don't hardcode** client names in code
- **Don't use huge logos** (keep < 100KB)
- **Don't make banner too tall** (affects content space)
- **Don't use low contrast** colors (accessibility)
- **Don't forget** to test sticky behavior
- **Don't commit** client logos to main repo

---

## Support

**File Locations:**
- Config: `/frontend/public/whitelabel.json` or `.ini`
- Component: `/frontend/src/components/BrandBanner.js`
- Styles: `/frontend/src/components/BrandBanner.css`
- Loader: `/frontend/src/utils/whitelabelConfig.js`

**Testing:**
1. Edit config file
2. Restart frontend: `npm start`
3. Check browser console for errors
4. Test on: Desktop, tablet, mobile
5. Test with: All themes, sticky scrolling

**Common Issues:**
- See "Troubleshooting" section above
- Check browser console (F12) for errors
- Verify JSON/INI syntax
- Clear cache and hard refresh

---

## Migration from Hardcoded Branding

### Step 1: Extract Current Branding
Note down current:
- App name (from TopBar or elsewhere)
- Logo file location
- Colors used

### Step 2: Create Config File
Create `/frontend/public/whitelabel.json` with current values

### Step 3: Test
Verify banner shows correctly with current branding

### Step 4: Remove Hardcoded Values
Remove any hardcoded app names/logos from other components

### Step 5: Deploy
Deploy with new whitelabel system

---

## License & Credits

**Created:** November 24, 2025  
**Component:** BrandBanner  
**Configuration:** whitelabel.json / whitelabel.ini  

---

*For additional support or custom requirements, contact the development team.*
