"""
Centralized branding utility
Reads app name and branding from whitelabel.json
"""

import logging
import json
import os
from functools import lru_cache

logger = logging.getLogger(__name__)

@lru_cache(maxsize=1)
def get_app_branding():
    """
    Load app branding from whitelabel.json
    Returns dict with app_name and app_name_short
    Cached for performance
    """
    try:
        # Path to whitelabel.json in frontend/public
        whitelabel_path = os.path.join(
            os.path.dirname(__file__), 
            "..", "..", "frontend", "public", "whitelabel.json"
        )
        
        if os.path.exists(whitelabel_path):
            with open(whitelabel_path, 'r') as f:
                config = json.load(f)
                branding = config.get("branding", {})
                
                app_name = branding.get("appName", "")
                tagline = branding.get("tagline", "")
                
                # Combine appName and tagline if both exist
                if app_name and tagline:
                    full_name = f"{app_name} {tagline}"
                elif app_name:
                    full_name = app_name
                else:
                    full_name = "L3V3L MATCHES"  # Ultimate fallback
                
                return {
                    "app_name": full_name,
                    "app_name_short": app_name or "L3V3L",
                    "tagline": tagline
                }
        
        # Fallback if file doesn't exist
        return {
            "app_name": "L3V3L MATCHES",
            "app_name_short": "L3V3L",
            "tagline": ""
        }
        
    except Exception as e:
        logger.warning(f"Warning: Could not load whitelabel.json: {e}")
        return {
            "app_name": "L3V3L MATCHES",
            "app_name_short": "L3V3L",
            "tagline": ""
        }


def get_app_name():
    """Get full app name (e.g., 'USVEDIKA for US Citizens & GC Holders')"""
    return get_app_branding()["app_name"]


def get_app_name_short():
    """Get short app name (e.g., 'USVEDIKA')"""
    return get_app_branding()["app_name_short"]
