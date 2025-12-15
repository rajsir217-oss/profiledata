/**
 * Whitelabel Configuration Loader
 * Loads branding configuration from whitelabel.json or whitelabel.ini
 */

// Default configuration (fallback if file doesn't exist)
const defaultConfig = {
  branding: {
    appName: "ProfileData",
    tagline: "Connecting Two Cultures, One Heart",
    logoPath: "",
    logoText: "🪷🦅",
    showLogo: true,
    showTagline: false,
    bannerHeight: "45px"
  },
  colors: {
    useThemeColors: true,
    customBannerBg: "",
    customTextColor: ""
  },
  behavior: {
    clickableHome: true,
    homeRoute: "/dashboard",
    sticky: true
  },
  environment: {
    showBadge: false,
    badgeText: "DEMO",
    badgeColor: "#ff9800"
  }
};

// parseINI function removed - no longer needed (JSON-only configuration)

/**
 * Load whitelabel configuration
 * PRIMARY: Loads from whitelabel.json
 * FALLBACK: Uses default configuration
 */
export async function loadWhitelabelConfig() {
  try {
    // Load JSON configuration (primary method)
    const response = await fetch('/whitelabel.json');
    if (response.ok) {
      const config = await response.json();
      // Config loaded successfully (silent in production)
      return config;
    }
    
    // File not found or error - use defaults (silent in production)
    return defaultConfig;
    
  } catch (error) {
    // Silent fallback in production
    return defaultConfig;
  }
}

/**
 * Get banner background style based on config
 */
export function getBannerBackground(config) {
  if (!config.colors.useThemeColors && config.colors.customBannerBg) {
    return config.colors.customBannerBg;
  }
  return 'linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%)';
}

/**
 * Get banner text color based on config
 */
export function getBannerTextColor(config) {
  if (!config.colors.useThemeColors && config.colors.customTextColor) {
    return config.colors.customTextColor;
  }
  return '#ffffff';
}

export default loadWhitelabelConfig;
