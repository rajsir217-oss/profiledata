#!/usr/bin/env python3
"""
Check Critical Notification System Bugs
Focus on high-impact edge cases that could cause production issues
"""

import asyncio
import sys
import re
from pathlib import Path

async def check_critical_bugs():
    """Check for critical bugs in notification system"""
    
    print("🚨 Checking Critical Notification System Bugs")
    print("=" * 60)
    
    critical_issues = []
    high_issues = []
    
    backend_dir = Path("/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend")
    
    # 1. Check for parameter mismatches in mark_as_sent (CRITICAL)
    print("\n1️⃣ Checking mark_as_sent parameter mismatches...")
    
    for py_file in backend_dir.rglob("*.py"):
        if "node_modules" in str(py_file) or "__pycache__" in str(py_file) or "venv" in str(py_file):
            continue
            
        try:
            content = py_file.read_text()
            
            # Check for mark_as_sent calls
            mark_as_sent_pattern = r'mark_as_sent\s*\([^)]+\)'
            matches = re.findall(mark_as_sent_pattern, content)
            
            for match in matches:
                # Check for incorrect parameter usage
                if 'status=' in match:
                    critical_issues.append({
                        'file': str(py_file),
                        'type': 'mark_as_sent_parameter_bug',
                        'issue': f'CRITICAL: Using status= instead of success= in mark_as_sent: {match}',
                        'fix': 'Change status="success"/"failed" to success=True/False'
                    })
                
                # Check if missing success parameter entirely
                if 'mark_as_sent(' in match and 'success=' not in match and 'status=' not in match:
                    critical_issues.append({
                        'file': str(py_file),
                        'type': 'mark_as_sent_missing_success',
                        'issue': f'CRITICAL: Missing success parameter in mark_as_sent: {match}',
                        'fix': 'Add success=True/False parameter'
                    })
                    
        except Exception as e:
            print(f"⚠️ Error reading {py_file}: {e}")
    
    # 2. Check for notification.id vs notification.dict().get("_id") (CRITICAL)
    print("\n2️⃣ Checking notification ID access patterns...")
    
    for py_file in backend_dir.rglob("*.py"):
        if "node_modules" in str(py_file) or "__pycache__" in str(py_file) or "venv" in str(py_file):
            continue
            
        try:
            content = py_file.read_text()
            
            # Check for wrong ID access pattern
            dict_pattern = r'notification\.dict\(\)\.get\(["\']_id["\']'
            if re.search(dict_pattern, content):
                critical_issues.append({
                    'file': str(py_file),
                    'type': 'notification_id_bug',
                    'issue': 'CRITICAL: Using notification.dict().get("_id") instead of notification.id',
                    'fix': 'Replace notification.dict().get("_id") with notification.id'
                })
            
            # Check for direct _id access that might fail
            direct_id_pattern = r'notification\["_id"\]'
            if re.search(direct_id_pattern, content):
                high_issues.append({
                    'file': str(py_file),
                    'type': 'direct_notification_id',
                    'issue': 'HIGH: Using notification["_id"] - should use notification.id',
                    'fix': 'Replace notification["_id"] with notification.id'
                })
                
        except Exception as e:
            print(f"⚠️ Error checking ID patterns in {py_file}: {e}")
    
    # 3. Check for MongoDB update operator mixing (HIGH)
    print("\n3️⃣ Checking MongoDB update operator issues...")
    
    for py_file in backend_dir.rglob("*.py"):
        if "node_modules" in str(py_file) or "__pycache__" in str(py_file) or "venv" in str(py_file):
            continue
            
        try:
            content = py_file.read_text()
            
            # Check for mixed $set and $inc in same update
            mixed_update_pattern = r'\{\s*"\$set":.*"\$inc":'
            if re.search(mixed_update_pattern, content, re.DOTALL):
                high_issues.append({
                    'file': str(py_file),
                    'type': 'mongodb_operator_mix',
                    'issue': 'HIGH: Mixed $set and $inc in same MongoDB update (will fail)',
                    'fix': 'Separate $set and $inc into different objects in the update'
                })
                
        except Exception as e:
            print(f"⚠️ Error checking MongoDB updates in {py_file}: {e}")
    
    # 4. Check for email/phone field access patterns (HIGH)
    print("\n4️⃣ Checking email/phone field access patterns...")
    
    for py_file in backend_dir.rglob("*.py"):
        if "node_modules" in str(py_file) or "__pycache__" in str(py_file) or "venv" in str(py_file):
            continue
            
        try:
            content = py_file.read_text()
            
            # Check for single field access (should check both)
            if 'notification' in content.lower() or 'email' in content:
                # Check for only checking 'email' field
                single_email_pattern = r'user\.get\(["\']email["\']\)(?!\s*or\s*user\.get\(["\']contactEmail["\'])'
                if re.search(single_email_pattern, content):
                    high_issues.append({
                        'file': str(py_file),
                        'type': 'single_email_field',
                        'issue': 'HIGH: Only checking email field, should also check contactEmail',
                        'fix': 'Use: user.get("email") or user.get("contactEmail")'
                    })
                
                # Check for only checking 'phone' field  
                single_phone_pattern = r'user\.get\(["\']phone["\']\)(?!\s*or\s*user\.get\(["\']contactNumber["\'])'
                if re.search(single_phone_pattern, content):
                    high_issues.append({
                        'file': str(py_file),
                        'type': 'single_phone_field',
                        'issue': 'HIGH: Only checking phone field, should also check contactNumber',
                        'fix': 'Use: user.get("phone") or user.get("contactNumber")'
                    })
                    
        except Exception as e:
            print(f"⚠️ Error checking field access in {py_file}: {e}")
    
    # 5. Check for infinite retry patterns (HIGH)
    print("\n5️⃣ Checking for infinite retry patterns...")
    
    for py_file in backend_dir.rglob("*.py"):
        if "node_modules" in str(py_file) or "__pycache__" in str(py_file) or "venv" in str(py_file):
            continue
            
        try:
            content = py_file.read_text()
            
            # Check for retry logic without proper limits
            if 'retry' in content.lower() and 'mark_as_sent' in content:
                # Look for patterns that might cause infinite retries
                retry_pattern = r'except.*:\s*.*continue\s*$'
                lines = content.split('\n')
                for i, line in enumerate(lines):
                    if re.search(retry_pattern, line):
                        # Check context for infinite retry
                        context = '\n'.join(lines[max(0, i-5):i+5])
                        if 'mark_as_sent' not in context and 'success=' not in context:
                            high_issues.append({
                                'file': str(py_file),
                                'type': 'infinite_retry_risk',
                                'issue': f'HIGH: Potential infinite retry at line {i+1} - exception without marking notification',
                                'fix': 'Add mark_as_sent(success=False) in exception handler'
                            })
                            
        except Exception as e:
            print(f"⚠️ Error checking retry patterns in {py_file}: {e}")
    
    # 6. Check for race conditions in notification claiming (HIGH)
    print("\n6️⃣ Checking for race condition risks...")
    
    for py_file in backend_dir.rglob("*.py"):
        if "node_modules" in str(py_file) or "__pycache__" in str(py_file) or "venv" in str(py_file):
            continue
            
        try:
            content = py_file.read_text()
            
            # Check for non-atomic notification claiming
            if 'notification' in content and 'find(' in content:
                # Look for find() followed by update() (non-atomic)
                find_update_pattern = r'\.find\([^)]+\).*\.update\('
                if re.search(find_update_pattern, content, re.DOTALL):
                    # Check if it's notification-related
                    notification_context = content[content.find('find(')-100:content.find('find(')+500]
                    if 'notification' in notification_context.lower():
                        high_issues.append({
                            'file': str(py_file),
                            'type': 'race_condition_risk',
                            'issue': 'HIGH: Non-atomic find() then update() - potential race condition',
                            'fix': 'Use find_one_and_update() for atomic operations'
                        })
                        
        except Exception as e:
            print(f"⚠️ Error checking race conditions in {py_file}: {e}")
    
    # Report results
    print(f"\n📊 Critical Bug Analysis Results:")
    print("=" * 60)
    
    if critical_issues:
        print(f"\n🚨 CRITICAL ISSUES ({len(critical_issues)}) - IMMEDIATE ACTION REQUIRED:")
        for i, issue in enumerate(critical_issues, 1):
            print(f"   {i}. {issue['file']}")
            print(f"      Issue: {issue['issue']}")
            print(f"      Fix: {issue['fix']}")
            print()
    
    if high_issues:
        print(f"\n⚠️ HIGH SEVERITY ISSUES ({len(high_issues)}) - FIX ASAP:")
        for i, issue in enumerate(high_issues, 1):
            print(f"   {i}. {issue['file']}")
            print(f"      Issue: {issue['issue']}")
            print(f"      Fix: {issue['fix']}")
            print()
    
    if not critical_issues and not high_issues:
        print("✅ No critical or high-severity bugs found!")
    
    # Production deployment checklist
    print(f"\n🚀 PRODUCTION DEPLOYMENT CHECKLIST:")
    print("=" * 60)
    
    if critical_issues:
        print("❌ DO NOT DEPLOY TO PRODUCTION!")
        print("   1. Fix all critical issues first")
        print("   2. Test notification system thoroughly")
        print("   3. Monitor for stuck notifications")
        print("   4. Have rollback plan ready")
    elif high_issues:
        print("⚠️ DEPLOY WITH CAUTION!")
        print("   1. Fix high-severity issues if possible")
        print("   2. Add monitoring for these patterns")
        print("   3. Test thoroughly in staging")
        print("   4. Monitor closely after deployment")
    else:
        print("✅ READY FOR DEPLOYMENT!")
        print("   1. Standard deployment process applies")
        print("   2. Monitor notification queue health")
        print("   3. Watch for unusual email patterns")
        print("   4. Have standard rollback ready")
    
    return len(critical_issues) == 0 and len(high_issues) == 0

if __name__ == "__main__":
    success = asyncio.run(check_critical_bugs())
    sys.exit(0 if success else 1)
