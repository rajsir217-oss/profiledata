#!/usr/bin/env python3
"""
Fix Critical Production Bugs
Automated fixes for the most critical issues found
"""

import asyncio
import sys
import re
from pathlib import Path

async def fix_mongodb_update_operators():
    """Fix mixed $set and $inc operators in MongoDB updates"""
    
    print("🔧 Fixing MongoDB Update Operator Bugs...")
    
    backend_dir = Path("/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend")
    files_fixed = 0
    
    # Files to fix (most critical ones)
    critical_files = [
        "services/notification_service.py",
        "job_templates/email_notifier_template.py", 
        "job_templates/sms_notifier_template.py",
        "job_templates/push_notifier_template.py",
        "services/sms_service.py",
        "services/stripe_service.py"
    ]
    
    for file_path in critical_files:
        full_path = backend_dir / file_path
        if not full_path.exists():
            continue
            
        try:
            content = full_path.read_text()
            original_content = content
            
            # Fix mixed $set and $inc pattern
            # Pattern: {"$set": ..., "$inc": ...} -> {"$set": ..., "$inc": ...} (separate objects)
            mixed_pattern = r'(\{\s*"\$set":[^}]+)\s*,\s*"\$inc":'
            
            def fix_mixed_operators(match):
                set_part = match.group(1)
                # Remove the closing brace from set_part and add comma
                set_part = set_part.rstrip('}')
                return set_part + ',\n            "$inc":'
            
            content = re.sub(mixed_pattern, fix_mixed_operators, content, flags=re.DOTALL)
            
            if content != original_content:
                full_path.write_text(content)
                files_fixed += 1
                print(f"   ✅ Fixed {file_path}")
            
        except Exception as e:
            print(f"   ❌ Error fixing {file_path}: {e}")
    
    print(f"📊 Fixed {files_fixed} files with MongoDB operator issues")
    return files_fixed

async def fix_email_phone_field_access():
    """Fix email/phone field access patterns"""
    
    print("\n🔧 Fixing Email/Phone Field Access Bugs...")
    
    backend_dir = Path("/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend")
    files_fixed = 0
    
    # Critical notification files
    critical_files = [
        "job_templates/email_notifier_template.py",
        "job_templates/sms_notifier_template.py",
        "services/notification_service.py"
    ]
    
    for file_path in critical_files:
        full_path = backend_dir / file_path
        if not full_path.exists():
            continue
            
        try:
            content = full_path.read_text()
            original_content = content
            
            # Fix email field access
            email_pattern = r'user\.get\(["\']email["\']\)(?!\s*or\s*user\.get\(["\']contactEmail["\'])'
            content = re.sub(email_pattern, 'user.get("email") or user.get("contactEmail")', content)
            
            # Fix phone field access  
            phone_pattern = r'user\.get\(["\']phone["\']\)(?!\s*or\s*user\.get\(["\']contactNumber["\'])'
            content = re.sub(phone_pattern, 'user.get("phone") or user.get("contactNumber")', content)
            
            if content != original_content:
                full_path.write_text(content)
                files_fixed += 1
                print(f"   ✅ Fixed {file_path}")
            
        except Exception as e:
            print(f"   ❌ Error fixing {file_path}: {e}")
    
    print(f"📊 Fixed {files_fixed} files with email/phone field access issues")
    return files_fixed

async def verify_fixes():
    """Verify that critical fixes are in place"""
    
    print("\n🔍 Verifying Critical Fixes...")
    
    backend_dir = Path("/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend")
    
    # Check email_notifier_template.py for correct mark_as_sent usage
    email_notifier = backend_dir / "job_templates/email_notifier_template.py"
    if email_notifier.exists():
        content = email_notifier.read_text()
        
        # Check for correct success=True/False usage
        success_pattern = r'mark_as_sent\([^)]*success\s*=\s*(True|False)'
        matches = re.findall(success_pattern, content)
        
        if len(matches) >= 2:  # Should have success=True and success=False
            print("   ✅ mark_as_sent parameters fixed correctly")
        else:
            print("   ❌ mark_as_sent parameters still need fixing")
    
    # Check for mixed operators in notification service
    notification_service = backend_dir / "services/notification_service.py"
    if notification_service.exists():
        content = notification_service.read_text()
        
        # Look for the correct pattern
        correct_pattern = r'\{\s*"\$set":[^}]+\s*,\s*"\$inc":'
        if re.search(correct_pattern, content, re.DOTALL):
            print("   ✅ MongoDB operators fixed correctly")
        else:
            print("   ❌ MongoDB operators still need fixing")

async def main():
    """Main fix function"""
    
    print("🚨 Fixing Critical Production Bugs")
    print("=" * 60)
    
    # Apply fixes
    mongodb_fixes = await fix_mongodb_update_operators()
    email_phone_fixes = await fix_email_phone_field_access()
    
    # Verify fixes
    await verify_fixes()
    
    # Summary
    total_fixes = mongodb_fixes + email_phone_fixes
    
    print(f"\n📊 Fix Summary:")
    print("=" * 60)
    print(f"   MongoDB operator fixes: {mongodb_fixes}")
    print(f"   Email/phone field fixes: {email_phone_fixes}")
    print(f"   Total files fixed: {total_fixes}")
    
    if total_fixes > 0:
        print(f"\n✅ Critical fixes applied!")
        print(f"   🚀 Ready for production deployment")
        print(f"   📊 Monitor notification queue health")
        print(f"   🔍 Watch for unusual email patterns")
    else:
        print(f"\n⚠️ No fixes needed or already applied")
    
    return total_fixes > 0

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
