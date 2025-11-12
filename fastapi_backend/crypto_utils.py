# fastapi_backend/crypto_utils.py
"""
PII Encryption Utilities
Provides field-level encryption for sensitive user data at rest
"""

from cryptography.fernet import Fernet, InvalidToken
from typing import Optional, List, Dict, Any
import logging
import base64
import os

logger = logging.getLogger(__name__)

class PIIEncryption:
    """
    Handles encryption/decryption of PII fields using Fernet (symmetric encryption)
    
    Encrypted fields:
    - contactEmail
    - contactNumber
    - location
    - linkedinUrl
    - images (optional - may be large)
    """
    
    # Fields that should be encrypted
    ENCRYPTED_FIELDS = {
        'contactEmail',
        'contactNumber',
        'location',
        'linkedinUrl',
    }
    
    def __init__(self, encryption_key: Optional[str] = None):
        """
        Initialize encryption with key from environment or config
        
        Args:
            encryption_key: Base64-encoded Fernet key (32 bytes)
        """
        if encryption_key is None:
            from config import settings
            encryption_key = settings.encryption_key
        
        if not encryption_key:
            raise ValueError("ENCRYPTION_KEY not configured. Generate with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'")
        
        try:
            # Ensure key is bytes
            if isinstance(encryption_key, str):
                encryption_key = encryption_key.encode()
            
            self.cipher = Fernet(encryption_key)
            logger.info("✅ PII encryption initialized successfully")
        except Exception as e:
            logger.error(f"❌ Failed to initialize encryption: {e}")
            raise ValueError(f"Invalid encryption key: {e}")
    
    def encrypt(self, data: Optional[str]) -> Optional[str]:
        """
        Encrypt a string value
        
        Args:
            data: Plaintext string to encrypt
            
        Returns:
            Base64-encoded encrypted string, or None if input is None/empty
        """
        if not data or data == "":
            return data
        
        try:
            # Encrypt and return as string
            encrypted_bytes = self.cipher.encrypt(data.encode('utf-8'))
            return encrypted_bytes.decode('utf-8')
        except Exception as e:
            logger.error(f"❌ Encryption failed: {e}")
            raise
    
    def decrypt(self, encrypted_data: Optional[str]) -> Optional[str]:
        """
        Decrypt an encrypted string value
        
        Args:
            encrypted_data: Base64-encoded encrypted string
            
        Returns:
            Decrypted plaintext string, or None if input is None/empty
        """
        if not encrypted_data or encrypted_data == "":
            return encrypted_data
        
        # If data doesn't look encrypted (legacy data), return as-is
        # Encrypted data starts with 'gAAAAA' (Fernet token prefix)
        if not isinstance(encrypted_data, str) or not encrypted_data.startswith('gAAAAA'):
            logger.warning(f"⚠️ Data does not appear to be encrypted, returning as-is")
            return encrypted_data
        
        try:
            # Decrypt and return as string
            decrypted_bytes = self.cipher.decrypt(encrypted_data.encode('utf-8'))
            return decrypted_bytes.decode('utf-8')
        except InvalidToken:
            logger.error(f"❌ Decryption failed: Invalid token (data may be corrupted or use wrong key)")
            # Return None or raise - depends on your error handling preference
            return None
        except Exception as e:
            logger.error(f"❌ Decryption failed: {e}")
            return None
    
    def encrypt_list(self, data_list: Optional[List[str]]) -> Optional[List[str]]:
        """
        Encrypt a list of strings (e.g., image URLs)
        
        Args:
            data_list: List of plaintext strings
            
        Returns:
            List of encrypted strings
        """
        if not data_list:
            return data_list
        
        return [self.encrypt(item) for item in data_list if item]
    
    def decrypt_list(self, encrypted_list: Optional[List[str]]) -> Optional[List[str]]:
        """
        Decrypt a list of encrypted strings
        
        Args:
            encrypted_list: List of encrypted strings
            
        Returns:
            List of decrypted strings
        """
        if not encrypted_list:
            return encrypted_list
        
        return [self.decrypt(item) for item in encrypted_list if item]
    
    def encrypt_user_pii(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Encrypt all PII fields in user data before storing to database
        
        Args:
            user_data: User document with plaintext PII
            
        Returns:
            User document with encrypted PII fields
        """
        encrypted_data = user_data.copy()
        
        for field in self.ENCRYPTED_FIELDS:
            if field in encrypted_data and encrypted_data[field]:
                try:
                    encrypted_data[field] = self.encrypt(encrypted_data[field])
                    logger.debug(f"🔒 Encrypted field: {field}")
                except Exception as e:
                    logger.error(f"❌ Failed to encrypt {field}: {e}")
                    # Keep original value on error (or raise depending on requirements)
        
        # Optionally encrypt images list
        if 'images' in encrypted_data and encrypted_data['images']:
            try:
                # For now, skip encrypting images as they're paths/URLs
                # Uncomment to enable:
                # encrypted_data['images'] = self.encrypt_list(encrypted_data['images'])
                pass
            except Exception as e:
                logger.error(f"❌ Failed to encrypt images: {e}")
        
        return encrypted_data
    
    def decrypt_user_pii(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Decrypt all PII fields in user data after retrieving from database
        
        Args:
            user_data: User document with encrypted PII
            
        Returns:
            User document with decrypted PII fields
        """
        decrypted_data = user_data.copy()
        
        for field in self.ENCRYPTED_FIELDS:
            if field in decrypted_data and decrypted_data[field]:
                try:
                    decrypted_data[field] = self.decrypt(decrypted_data[field])
                    logger.debug(f"🔓 Decrypted field: {field}")
                except Exception as e:
                    logger.error(f"❌ Failed to decrypt {field}: {e}")
                    # Set to None on error to avoid exposing corrupted data
                    decrypted_data[field] = None
        
        # Optionally decrypt images list
        if 'images' in decrypted_data and decrypted_data['images']:
            try:
                # For now, skip decrypting images
                # Uncomment to enable:
                # decrypted_data['images'] = self.decrypt_list(decrypted_data['images'])
                pass
            except Exception as e:
                logger.error(f"❌ Failed to decrypt images: {e}")
        
        return decrypted_data
    
    def is_encrypted(self, data: Optional[str]) -> bool:
        """
        Check if data appears to be encrypted
        
        Args:
            data: String to check
            
        Returns:
            True if data looks encrypted, False otherwise
        """
        if not data or not isinstance(data, str):
            return False
        
        # Fernet tokens start with 'gAAAAA' (base64 of version + timestamp)
        return data.startswith('gAAAAA')


def generate_encryption_key() -> str:
    """
    Generate a new Fernet encryption key
    
    Returns:
        Base64-encoded 32-byte key as string
    """
    key = Fernet.generate_key()
    return key.decode('utf-8')


# Global instance (initialized on first import)
_encryptor = None

def get_encryptor() -> PIIEncryption:
    """
    Get singleton encryption instance
    
    Returns:
        PIIEncryption instance
    """
    global _encryptor
    if _encryptor is None:
        _encryptor = PIIEncryption()
    return _encryptor


if __name__ == "__main__":
    # CLI utility for generating keys
    print("=== PII Encryption Key Generator ===")
    print("\nGenerated encryption key (add to .env as ENCRYPTION_KEY):")
    print(generate_encryption_key())
    print("\nExample .env entry:")
    print(f"ENCRYPTION_KEY={generate_encryption_key()}")
