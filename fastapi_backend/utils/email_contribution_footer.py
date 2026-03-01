"""
Shared Contribution Footer for Email Notifications

Generates a reusable HTML footer section that encourages users to contribute
to support the platform. Includes PayPal button, Venmo QR, and PayPal QR options.

Usage:
    from utils.email_contribution_footer import get_contribution_footer_html

    footer_html = get_contribution_footer_html(app_url="https://l3v3lmatches.com")
"""

from config import settings


# Triggers that should include the contribution footer
# These are positive/engagement emails where the ask feels natural
CONTRIBUTION_FOOTER_TRIGGERS = {
    "status_approved",
    "status_reactivated",
    "account_unpaused",
    "favorited",
    "shortlist_added",
    "mutual_favorite",
    "pii_granted",
    "saved_search_matches",
    "new_match",
    "new_users_matching",
    "match_milestone",
    "profile_view",
    "profile_visibility_spike",
    "search_appearance",
}

# Triggers that should NOT include the contribution footer
# (negative events, transactional, already contribution-related, digests)
CONTRIBUTION_FOOTER_EXCLUDED = {
    "status_suspended",
    "status_banned",
    "status_paused",
    "account_paused",
    "suspicious_login",
    "pii_request",
    "pii_denied",
    "pii_revoked",
    "pii_expiring",
    "pending_pii_request",
    "new_message",
    "message_read",
    "unread_messages",
    "daily_digest",
    "weekly_digest",
    "monthly_digest",
    "pause_weekly_summary",
    "poll_reminder",
    "contribution_thank_you",
    "conversation_cold",
    "profile_incomplete",
    "upload_photos",
    "profile_unavailable",
    "admin_login_reminder",
    "new_profile_created",
    "invitation_sent",
    "auto_unpause_reminder",
}


def should_include_contribution_footer(trigger: str) -> bool:
    """Check if this email trigger should include the contribution footer"""
    if not trigger:
        return False
    trigger_lower = trigger.lower().strip()
    if trigger_lower in CONTRIBUTION_FOOTER_EXCLUDED:
        return False
    if trigger_lower in CONTRIBUTION_FOOTER_TRIGGERS:
        return True
    # Default: don't include for unknown triggers
    return False


def get_contribution_footer_html(app_url: str = None) -> str:
    """
    Generate the contribution footer HTML for email notifications.
    
    Args:
        app_url: Base URL of the frontend app (defaults to settings.frontend_url)
    
    Returns:
        HTML string for the contribution footer section
    """
    if not app_url:
        app_url = settings.frontend_url or "https://l3v3lmatches.com"
    
    # QR code image URLs - always use production domain since email clients
    # cannot access localhost images
    image_base_url = "https://l3v3lmatches.com"
    venmo_qr_url = f"{image_base_url}/images/VenmoQR.png"
    paypal_qr_url = f"{image_base_url}/images/PaypalQR.png"
    
    footer_html = f"""
    <!-- Contribution Support Section -->
    <div style="max-width: 600px; margin: 25px auto 0 auto; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fef3c7 100%); border-radius: 12px; padding: 28px 24px; text-align: center; border: 1px solid #f59e0b;">
        
        <!-- Header -->
        <div style="margin-bottom: 16px;">
            <span style="font-size: 36px;">🦋</span>
            <h3 style="margin: 8px 0 4px 0; font-size: 18px; font-weight: 700; color: #92400e;">
                Support L3V3L Matches
            </h3>
            <p style="margin: 0; font-size: 14px; color: #78350f; line-height: 1.5;">
                We're a community-supported platform. Your contribution helps us keep the service free, improve features, and connect more people.
            </p>
        </div>
        
        <!-- Contribute Button -->
        <div style="margin: 18px 0;">
            <a href="{app_url}/search" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 12px 32px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 15px; box-shadow: 0 3px 10px rgba(245, 158, 11, 0.3);">
                💝 Contribute Now
            </a>
        </div>
        
        <!-- QR Codes Row -->
        <div style="margin: 20px 0 10px 0;">
            <p style="margin: 0 0 12px 0; font-size: 13px; color: #92400e; font-weight: 600;">
                Scan to contribute via mobile:
            </p>
            <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                <tr>
                    <!-- Venmo QR -->
                    <td style="padding: 0 10px; text-align: center; vertical-align: top;">
                        <div style="background: white; border-radius: 10px; padding: 10px; border: 1px solid #e5e7eb; display: inline-block;">
                            <img src="{venmo_qr_url}" alt="Venmo QR Code" width="90" height="90" style="display: block; border-radius: 6px;" />
                        </div>
                        <p style="margin: 6px 0 0 0; font-size: 12px; color: #78350f; font-weight: 600;">
                            <span style="color: #3D95CE; font-weight: 700;">V</span> Venmo
                        </p>
                    </td>
                    <!-- PayPal QR -->
                    <td style="padding: 0 10px; text-align: center; vertical-align: top;">
                        <div style="background: white; border-radius: 10px; padding: 10px; border: 1px solid #e5e7eb; display: inline-block;">
                            <img src="{paypal_qr_url}" alt="PayPal QR Code" width="90" height="90" style="display: block; border-radius: 6px;" />
                        </div>
                        <p style="margin: 6px 0 0 0; font-size: 12px; color: #78350f; font-weight: 600;">
                            <span style="color: #003087; font-weight: 700;">P</span> PayPal
                        </p>
                    </td>
                </tr>
            </table>
        </div>
        
        <!-- Small note -->
        <p style="margin: 8px 0 0 0; font-size: 11px; color: #a16207; line-height: 1.4;">
            Every contribution, big or small, makes a difference. Thank you! 🙏
        </p>
    </div>
    """
    return footer_html
