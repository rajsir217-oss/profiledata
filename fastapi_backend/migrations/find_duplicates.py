#!/usr/bin/env python3
"""
Script to find duplicate emails and phone numbers in the database.
Run: python -m migrations.find_duplicates
"""

import asyncio
import sys
import os
from collections import defaultdict

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from crypto_utils import get_encryptor
from config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def find_duplicates():
    """Find all duplicate emails and phone numbers"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    logger.info("🔍 Searching for duplicate emails and phone numbers...")
    
    # Get encryptor for decrypting
    try:
        encryptor = get_encryptor()
    except Exception as e:
        logger.error(f"❌ Failed to initialize encryptor: {e}")
        return
    
    # Collect all emails and phones with their usernames
    email_to_users = defaultdict(list)
    phone_to_users = defaultdict(list)
    
    cursor = db.users.find({}, {"username": 1, "contactEmail": 1, "contactNumber": 1, "contactEmailHash": 1, "contactNumberHash": 1, "createdAt": 1})
    
    async for user in cursor:
        username = user.get("username", "unknown")
        created_at = user.get("createdAt", "unknown")
        
        # Process email
        contact_email = user.get("contactEmail")
        email_hash = user.get("contactEmailHash")
        if contact_email:
            try:
                if encryptor.is_encrypted(contact_email):
                    plain_email = encryptor.decrypt(contact_email)
                else:
                    plain_email = contact_email
                
                if plain_email:
                    normalized = plain_email.lower().strip()
                    email_to_users[normalized].append({
                        "username": username,
                        "created_at": created_at,
                        "hash": email_hash
                    })
            except Exception as e:
                logger.warning(f"⚠️ Could not decrypt email for {username}: {e}")
        
        # Process phone
        contact_number = user.get("contactNumber")
        phone_hash = user.get("contactNumberHash")
        if contact_number:
            try:
                if encryptor.is_encrypted(contact_number):
                    plain_phone = encryptor.decrypt(contact_number)
                else:
                    plain_phone = contact_number
                
                if plain_phone:
                    normalized = plain_phone.lower().strip()
                    phone_to_users[normalized].append({
                        "username": username,
                        "created_at": created_at,
                        "hash": phone_hash
                    })
            except Exception as e:
                logger.warning(f"⚠️ Could not decrypt phone for {username}: {e}")
    
    # Find duplicates
    duplicate_emails = {email: users for email, users in email_to_users.items() if len(users) > 1}
    duplicate_phones = {phone: users for phone, users in phone_to_users.items() if len(users) > 1}
    
    # Report findings
    print("\n" + "="*60)
    print("📧 DUPLICATE EMAILS")
    print("="*60)
    
    if duplicate_emails:
        for email, users in duplicate_emails.items():
            print(f"\n📧 {email}")
            for u in users:
                print(f"   └── {u['username']} (created: {u['created_at']})")
        print(f"\n⚠️ Total duplicate email groups: {len(duplicate_emails)}")
    else:
        print("✅ No duplicate emails found!")
    
    print("\n" + "="*60)
    print("📱 DUPLICATE PHONE NUMBERS")
    print("="*60)
    
    if duplicate_phones:
        for phone, users in duplicate_phones.items():
            print(f"\n📱 {phone}")
            for u in users:
                print(f"   └── {u['username']} (created: {u['created_at']})")
        print(f"\n⚠️ Total duplicate phone groups: {len(duplicate_phones)}")
    else:
        print("✅ No duplicate phone numbers found!")
    
    print("\n" + "="*60)
    print("📊 SUMMARY")
    print("="*60)
    print(f"Duplicate email groups: {len(duplicate_emails)}")
    print(f"Duplicate phone groups: {len(duplicate_phones)}")
    
    if duplicate_emails or duplicate_phones:
        print("\n⚠️ ACTION REQUIRED:")
        print("   You need to resolve these duplicates before unique indexes can be created.")
        print("   Options:")
        print("   1. Delete the duplicate accounts (if they are test/spam accounts)")
        print("   2. Update the email/phone to be unique")
        print("   3. Set email/phone to null for duplicates")
    else:
        print("\n✅ No duplicates found! You can create unique indexes now.")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(find_duplicates())
