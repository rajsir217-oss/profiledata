#!/usr/bin/env python3
"""
Gender Data Audit Script
Identifies users with potentially mismatched gender based on common name patterns.

Usage:
  python scripts/audit_gender_data.py --check      # Just report mismatches
  python scripts/audit_gender_data.py --fix        # Fix mismatches (with confirmation)
"""

import asyncio
import argparse
from motor.motor_asyncio import AsyncIOMotorClient
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv

load_dotenv()

# Common Indian male names
MALE_NAMES = {
    'aarav', 'abhishek', 'aditya', 'ajay', 'akash', 'aman', 'amit', 'ankit', 
    'arjun', 'aryan', 'deepak', 'gaurav', 'harsh', 'jay', 'kabir', 'karan',
    'krishna', 'manish', 'neil', 'nikhil', 'prateek', 'rahul', 'raj', 'rajesh',
    'reyansh', 'rohan', 'sandeep', 'shiv', 'siddharth', 'vihaan', 'vikram',
    'vishal', 'yogesh', 'sai'  # Sai can be both but often male
}

# Common Indian female names
FEMALE_NAMES = {
    'aarohi', 'aditi', 'anika', 'anjali', 'ananya', 'divya', 'diya', 'ira',
    'isha', 'kavya', 'kiara', 'kirtana', 'lakshmi', 'mansi', 'maya', 'megha',
    'myra', 'naina', 'neha', 'pari', 'pooja', 'preeti', 'priya', 'ritika',
    'saanvi', 'sara', 'shanaya', 'shreya', 'simran', 'sneha', 'sonal', 'sravya',
    'tanvi', 'tara', 'zara'
}


async def audit_gender_data(fix_mode=False):
    """Check for gender mismatches and optionally fix them."""
    
    mongodb_url = os.getenv('MONGODB_URL', 'mongodb://localhost:27017')
    db_name = os.getenv('DATABASE_NAME', 'matrimonialDB')
    
    print(f"Connecting to: {mongodb_url}")
    print(f"Database: {db_name}")
    print("=" * 60)
    
    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]
    
    mismatches = []
    
    # Get all users with gender data
    cursor = db.users.find(
        {'gender': {'$in': ['Male', 'Female']}},
        {'username': 1, 'firstName': 1, 'lastName': 1, 'gender': 1, 'accountStatus': 1}
    )
    
    async for user in cursor:
        first_name = (user.get('firstName') or '').lower().strip()
        gender = user.get('gender')
        username = user.get('username')
        
        # Check for mismatches
        is_mismatch = False
        expected_gender = None
        
        if first_name in MALE_NAMES and gender == 'Female':
            is_mismatch = True
            expected_gender = 'Male'
        elif first_name in FEMALE_NAMES and gender == 'Male':
            is_mismatch = True
            expected_gender = 'Female'
        
        if is_mismatch:
            mismatches.append({
                'username': username,
                'firstName': user.get('firstName'),
                'lastName': user.get('lastName'),
                'currentGender': gender,
                'expectedGender': expected_gender,
                'accountStatus': user.get('accountStatus')
            })
    
    # Report findings
    print(f"\n🔍 Found {len(mismatches)} potential gender mismatches:\n")
    
    if not mismatches:
        print("✅ No mismatches found!")
        return
    
    for m in mismatches:
        status = f" [{m['accountStatus']}]" if m['accountStatus'] != 'active' else ""
        print(f"  ❌ {m['firstName']} {m['lastName'] or ''} ({m['username']}){status}")
        print(f"     Current: {m['currentGender']} → Expected: {m['expectedGender']}")
        print()
    
    # Fix mode
    if fix_mode:
        print("=" * 60)
        confirm = input(f"Fix {len(mismatches)} mismatches? (yes/no): ")
        
        if confirm.lower() == 'yes':
            fixed = 0
            for m in mismatches:
                result = await db.users.update_one(
                    {'username': m['username']},
                    {'$set': {'gender': m['expectedGender']}}
                )
                if result.modified_count > 0:
                    fixed += 1
                    print(f"  ✅ Fixed {m['username']}: {m['currentGender']} → {m['expectedGender']}")
            
            print(f"\n✅ Fixed {fixed}/{len(mismatches)} users")
        else:
            print("❌ Cancelled - no changes made")
    else:
        print("💡 Run with --fix to correct these mismatches")
    
    client.close()


def main():
    parser = argparse.ArgumentParser(description='Audit gender data for mismatches')
    parser.add_argument('--check', action='store_true', help='Check for mismatches (default)')
    parser.add_argument('--fix', action='store_true', help='Fix mismatches with confirmation')
    
    args = parser.parse_args()
    
    asyncio.run(audit_gender_data(fix_mode=args.fix))


if __name__ == '__main__':
    main()
