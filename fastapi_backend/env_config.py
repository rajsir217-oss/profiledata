"""
Environment Configuration Management
Automatically loads the right configuration based on environment detection
"""
import os
from pathlib import Path
from typing import Dict, Optional
from dotenv import load_dotenv

class EnvironmentManager:
    """Manages environment configuration based on deployment context"""
    
    @staticmethod
    def detect_environment() -> str:
        """
        Detect current environment based on various indicators
        Returns: 'local', 'staging', or 'production'
        """
        # Check explicit environment variable first
        env = os.environ.get('APP_ENVIRONMENT', '').lower()
        if env:
            return env
            
        # Check if running on Google Cloud Run
        if os.environ.get('K_SERVICE'):
            # We're on Cloud Run
            service_name = os.environ.get('K_SERVICE', '')
            if 'staging' in service_name:
                return 'staging'
            return 'production'
            
        # Check if running in Docker
        if os.path.exists('/.dockerenv'):
            return 'docker'
            
        # Check hostname/port indicators
        port = os.environ.get('PORT', '8000')
        if port == '8080':  # Cloud Run default
            return 'production'
            
        # Default to local
        return 'local'
    
    @staticmethod
    def load_environment_config(env: Optional[str] = None) -> Dict[str, str]:
        """
        Load configuration for specified environment
        Args:
            env: Environment name ('local', 'staging', 'production')
                 If None, auto-detects environment
        Returns:
            Dictionary of configuration values
        """
        if env is None:
            env = EnvironmentManager.detect_environment()
            
        print(f"🔧 Loading configuration for environment: {env}")
        
        # Get the base directory
        base_dir = Path(__file__).resolve().parent
        
        # Map environment to config file
        env_files = {
            'local': '.env.local',
            'staging': '.env.staging', 
            'production': '.env.production',
            'docker': '.env.docker',
            'test': '.env.test'
        }
        
        # Get the appropriate env file
        env_file = env_files.get(env, '.env')
        env_path = base_dir / env_file
        
        # Check if specific env file exists, fallback to .env
        if not env_path.exists():
            print(f"⚠️ {env_file} not found, using default .env")
            env_path = base_dir / '.env'
            
        # Load the environment file
        if env_path.exists():
            load_dotenv(env_path, override=True)
            print(f"✅ Loaded configuration from {env_path.name}")
        else:
            print(f"❌ No configuration file found at {env_path}")
            
        # Return current environment variables
        return dict(os.environ)
    
    @staticmethod
    def get_required_configs() -> Dict[str, str]:
        """
        Returns a dictionary of all required configuration keys and their descriptions
        """
        return {
            # Database
            'MONGODB_URL': 'MongoDB connection string',
            'DATABASE_NAME': 'MongoDB database name',
            'REDIS_URL': 'Redis connection string (optional)',
            
            # URLs
            'FRONTEND_URL': 'Frontend application URL',
            'BACKEND_URL': 'Backend API URL',
            'APP_URL': 'Main application URL',
            
            # Authentication
            'SECRET_KEY': 'JWT secret key for token signing',
            'ALGORITHM': 'JWT algorithm (HS256)',
            'ACCESS_TOKEN_EXPIRE_MINUTES': 'Token expiration time',
            
            # Storage
            'USE_GCS': 'Use Google Cloud Storage (true/false)',
            'UPLOAD_DIR': 'Local upload directory',
            'GCS_BUCKET_NAME': 'GCS bucket name (if USE_GCS=true)',
            'GCS_PROJECT_ID': 'GCP project ID (if USE_GCS=true)',
            
            # Email
            'SMTP_HOST': 'SMTP server hostname',
            'SMTP_PORT': 'SMTP server port',
            'SMTP_USER': 'SMTP username',
            'SMTP_PASSWORD': 'SMTP password',
            'FROM_EMAIL': 'From email address',
            'FROM_NAME': 'From name for emails',
            
            # SMS (Optional)
            'SMS_PROVIDER': 'SMS provider (twilio)',
            'TWILIO_ACCOUNT_SID': 'Twilio account SID',
            'TWILIO_AUTH_TOKEN': 'Twilio auth token',
            'TWILIO_FROM_PHONE': 'Twilio phone number',
            
            # Features
            'ENABLE_NOTIFICATIONS': 'Enable notification system',
            'ENABLE_SCHEDULER': 'Enable job scheduler',
            'ENABLE_WEBSOCKETS': 'Enable WebSocket connections',
            'DEBUG_MODE': 'Enable debug mode',
            
            # Logging
            'LOG_LEVEL': 'Logging level (DEBUG, INFO, WARNING, ERROR)',
            'LOG_FILE': 'Log file path',
            
            # Stripe Payments
            'STRIPE_SECRET_KEY': 'Stripe secret key (sk_live_... or sk_test_...)',
            'STRIPE_PUBLISHABLE_KEY': 'Stripe publishable key (pk_live_... or pk_test_...)',
            'STRIPE_WEBHOOK_SECRET': 'Stripe webhook signing secret (whsec_...)',
        }
    
    @staticmethod
    def validate_config(env: Optional[str] = None) -> bool:
        """
        Validate that all required configurations are set
        Args:
            env: Environment to validate
        Returns:
            True if all required configs are present
        """
        config = EnvironmentManager.load_environment_config(env)
        required = EnvironmentManager.get_required_configs()
        
        missing = []
        for key in required:
            if key not in config or not config[key]:
                # Some configs are optional
                optional = ['REDIS_URL', 'SMS_PROVIDER', 'TWILIO_ACCOUNT_SID', 
                           'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_PHONE']
                if key not in optional:
                    missing.append(key)
        
        if missing:
            print(f"❌ Missing required configurations: {', '.join(missing)}")
            return False
            
        print("✅ All required configurations are present")
        return True

# Usage example
if __name__ == "__main__":
    # Auto-detect and load environment
    env_manager = EnvironmentManager()
    current_env = env_manager.detect_environment()
    print(f"Detected environment: {current_env}")
    
    # Load configuration
    config = env_manager.load_environment_config()
    
    # Validate configuration
    is_valid = env_manager.validate_config()
    
    # Show some key configurations (without sensitive data)
    print("\n📋 Current Configuration:")
    print(f"  - MongoDB: {config.get('MONGODB_URL', 'Not set')[:30]}...")
    print(f"  - Frontend URL: {config.get('FRONTEND_URL', 'Not set')}")
    print(f"  - Backend URL: {config.get('BACKEND_URL', 'Not set')}")
    print(f"  - Use GCS: {config.get('USE_GCS', 'Not set')}")
    print(f"  - Debug Mode: {config.get('DEBUG_MODE', 'Not set')}")
