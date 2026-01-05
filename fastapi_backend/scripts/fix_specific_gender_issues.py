#!/usr/bin/env python3
"""
Quick script to check and fix specific users with gender issues.
Run on production to fix Gautam Banuru and Vikas Chittepu.

Usage:
  python scripts/fix_specific_gender_issues.py --check
  python scripts/fix_specific_gender_issues.py --fix
"""

import asyncio
import argparse
from motor.motor_asyncio import AsyncIOMotorClient
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv

load_dotenv()

# Users reported with wrong gender (male names appearing in Female search)
USERS_TO_CHECK = [
    {'firstName': 'Gautam', 'expectedGender': 'Male'},
    {'firstName': 'Vikas', 'expectedGender': 'Male'},
    {'firstName': 'Miheer', 'expectedGender': 'Male'},
]


async def check_and_fix(fix_mode=False):
    mongodb_url = os.getenv('MONGODB_URL', 'mongodb://localhost:27017')
    db_name = os.getenv('DATABASE_NAME', 'matrimonialDB')
    
    print(f"Connecting to: {mongodb_url}")
    print(f"Database: {db_name}")
    print("=" * 60)
    
    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]
    
    issues_found = []
    
    for user_check in USERS_TO_CHECK:
        first_name = user_check['firstName']
        expected_gender = user_check['expectedGender']
        
        # Find users with this first name
        cursor = db.users.find(
            {'firstName': {'$regex': f'^{first_name}$', '$options': 'i'}},
            {'username': 1, 'firstName': 1, 'lastName': 1, 'gender': 1, 'accountStatus': 1}
        )
        
        async for user in cursor:
            current_gender = user.get('gender')
            username = user.get('username')
            
            if current_gender != expected_gender:
                issues_found.append({
                    'username': username,
                    'firstName': user.get('firstName'),
                    'lastName': user.get('lastName'),
                    'currentGender': current_gender,
                    'expectedGender': expected_gender,
                    'accountStatus': user.get('accountStatus')
                })
                print(f"❌ MISMATCH: {user.get('firstName')} {user.get('lastName')} ({username})")
                print(f"   Current: {current_gender} → Expected: {expected_gender}")
            else:
                print(f"✅ OK: {user.get('firstName')} {user.get('lastName')} ({username}) - Gender: {current_gender}")
    
    print("\n" + "=" * 60)
    print(f"Found {len(issues_found)} gender mismatches")
    
    if fix_mode and issues_found:
        print("\n⚠️  FIXING GENDER ISSUES...")
        for issue in issues_found:
            result = await db.users.update_one(
                {'username': issue['username']},
                {'$set': {'gender': issue['expectedGender']}}
            )
            if result.modified_count > 0:
                print(f"✅ Fixed {issue['username']}: {issue['currentGender']} → {issue['expectedGender']}")
            else:
                print(f"❌ Failed to fix {issue['username']}")
        print("\n✅ Done! Gender issues fixed.")
    elif issues_found:
        print("\n💡 Run with --fix to correct these issues")
    
    client.close()


def main():
    parser = argparse.ArgumentParser(description='Check and fix specific gender issues')
    parser.add_argument('--check', action='store_true', help='Check for issues')
    parser.add_argument('--fix', action='store_true', help='Fix issues')
    
    args = parser.parse_args()
    
    asyncio.run(check_and_fix(fix_mode=args.fix))


if __name__ == '__main__':
    main()
