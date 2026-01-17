"""
GCP Secret Manager Utility
Manages secrets for the application with local fallback
"""
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Cache for secrets to avoid repeated API calls
_secrets_cache = {}


def get_secret(secret_id: str, default: Optional[str] = None) -> Optional[str]:
    """
    Get a secret from GCP Secret Manager with local .env fallback
    
    Args:
        secret_id: The secret ID (e.g., 'COURIER_API_KEY')
        default: Default value if secret not found
        
    Returns:
        The secret value or default
    """
    # Check cache first
    if secret_id in _secrets_cache:
        return _secrets_cache[secret_id]
    
    # Check if we're in a GCP environment
    is_gcp = os.environ.get('K_SERVICE') or os.environ.get('GOOGLE_CLOUD_PROJECT')
    
    if is_gcp:
        try:
            value = _get_secret_from_gcp(secret_id)
            if value:
                _secrets_cache[secret_id] = value
                return value
        except Exception as e:
            logger.warning(f"Failed to get secret '{secret_id}' from GCP: {e}")
    
    # Fallback to environment variable
    value = os.environ.get(secret_id, default)
    if value:
        _secrets_cache[secret_id] = value
    return value


def _get_secret_from_gcp(secret_id: str) -> Optional[str]:
    """
    Fetch secret from GCP Secret Manager
    
    Args:
        secret_id: The secret ID
        
    Returns:
        The secret value or None
    """
    try:
        from google.cloud import secretmanager
        
        # Get project ID
        project_id = os.environ.get('GOOGLE_CLOUD_PROJECT') or os.environ.get('GCS_PROJECT_ID')
        if not project_id:
            logger.warning("No GCP project ID found for Secret Manager")
            return None
        
        # Create client
        client = secretmanager.SecretManagerServiceClient()
        
        # Build the resource name
        name = f"projects/{project_id}/secrets/{secret_id}/versions/latest"
        
        # Access the secret
        response = client.access_secret_version(request={"name": name})
        
        # Return the secret value
        return response.payload.data.decode("UTF-8")
        
    except ImportError:
        logger.warning("google-cloud-secret-manager not installed")
        return None
    except Exception as e:
        logger.warning(f"Error accessing secret '{secret_id}': {e}")
        return None


def clear_cache():
    """Clear the secrets cache"""
    global _secrets_cache
    _secrets_cache = {}


# Email-specific secret getters with failover support
def get_email_config() -> dict:
    """
    Get email configuration with Courier -> Gmail SMTP failover
    
    Returns:
        dict with email configuration (always includes SMTP for failover)
    """
    config = {
        'provider': 'smtp',  # Default to SMTP
        'courier_api_key': None,
        'smtp_host': None,
        'smtp_port': 587,
        'smtp_user': None,
        'smtp_password': None,
        'from_email': None,
        'from_name': 'L3V3L MATCHES'
    }
    
    # Always load SMTP credentials for failover
    smtp_user = get_secret('SMTP_USER')
    smtp_password = get_secret('SMTP_PASSWORD')
    if smtp_user and smtp_password:
        config['smtp_host'] = get_secret('SMTP_HOST', 'smtp.gmail.com')
        config['smtp_port'] = int(get_secret('SMTP_PORT', '587'))
        config['smtp_user'] = smtp_user
        config['smtp_password'] = smtp_password
    
    # Try Courier first (preferred)
    courier_key = get_secret('COURIER_API_KEY')
    if courier_key:
        config['provider'] = 'courier'
        config['courier_api_key'] = courier_key
        config['from_email'] = get_secret('FROM_EMAIL', 'noreply@l3v3lmatches.com')
        config['from_name'] = get_secret('FROM_NAME', 'L3V3L MATCHES')
        logger.info("📧 Using Courier for email delivery (SMTP fallback available)")
        return config
    
    # Fallback to Gmail SMTP only
    if smtp_user and smtp_password:
        config['provider'] = 'smtp'
        config['from_email'] = get_secret('FROM_EMAIL', smtp_user)
        config['from_name'] = get_secret('FROM_NAME', 'L3V3L MATCHES')
        logger.info("📧 Using Gmail SMTP for email delivery (Courier fallback)")
        return config
    
    logger.error("❌ No email configuration available (neither Courier nor SMTP)")
    return config


# Script to create secrets in GCP
def create_gcp_secrets():
    """
    Create secrets in GCP Secret Manager
    Run this script once to set up secrets
    
    Usage:
        python -c "from utils.gcp_secrets import create_gcp_secrets; create_gcp_secrets()"
    """
    try:
        from google.cloud import secretmanager
    except ImportError:
        print("❌ google-cloud-secret-manager not installed")
        print("   Run: pip install google-cloud-secret-manager")
        return
    
    project_id = os.environ.get('GOOGLE_CLOUD_PROJECT') or os.environ.get('GCS_PROJECT_ID')
    if not project_id:
        print("❌ No GCP project ID found. Set GOOGLE_CLOUD_PROJECT or GCS_PROJECT_ID")
        return
    
    client = secretmanager.SecretManagerServiceClient()
    parent = f"projects/{project_id}"
    
    # Secrets to create (get from current environment)
    secrets = {
        'COURIER_API_KEY': os.environ.get('COURIER_API_KEY'),
        'COURIER_CLIENT_KEY': os.environ.get('COURIER_CLIENT_KEY'),
        'SMTP_HOST': os.environ.get('SMTP_HOST', 'smtp.gmail.com'),
        'SMTP_PORT': os.environ.get('SMTP_PORT', '587'),
        'SMTP_USER': os.environ.get('SMTP_USER'),
        'SMTP_PASSWORD': os.environ.get('SMTP_PASSWORD'),
        'FROM_EMAIL': os.environ.get('FROM_EMAIL'),
        'FROM_NAME': os.environ.get('FROM_NAME', 'L3V3L MATCHES'),
    }
    
    for secret_id, secret_value in secrets.items():
        if not secret_value:
            print(f"⚠️ Skipping {secret_id} - no value set in environment")
            continue
        
        try:
            # Try to create the secret
            secret = client.create_secret(
                request={
                    "parent": parent,
                    "secret_id": secret_id,
                    "secret": {"replication": {"automatic": {}}},
                }
            )
            print(f"✅ Created secret: {secret_id}")
        except Exception as e:
            if "already exists" in str(e).lower():
                print(f"ℹ️ Secret already exists: {secret_id}")
            else:
                print(f"❌ Error creating secret {secret_id}: {e}")
                continue
        
        # Add the secret version
        try:
            version = client.add_secret_version(
                request={
                    "parent": f"{parent}/secrets/{secret_id}",
                    "payload": {"data": secret_value.encode("UTF-8")},
                }
            )
            print(f"   Added version for {secret_id}")
        except Exception as e:
            print(f"❌ Error adding version for {secret_id}: {e}")
    
    print("\n✅ Done! Secrets are now in GCP Secret Manager")
    print("   The app will automatically use them when running on Cloud Run")


if __name__ == "__main__":
    # Test the secret retrieval
    print("Testing GCP Secret Manager utility...")
    
    # Test email config
    email_config = get_email_config()
    print(f"\nEmail Configuration:")
    print(f"  Provider: {email_config['provider']}")
    print(f"  From: {email_config['from_name']} <{email_config['from_email']}>")
    
    if email_config['provider'] == 'courier':
        print(f"  Courier API Key: {'SET' if email_config['courier_api_key'] else 'NOT SET'}")
    else:
        print(f"  SMTP Host: {email_config['smtp_host']}")
        print(f"  SMTP User: {email_config['smtp_user']}")
