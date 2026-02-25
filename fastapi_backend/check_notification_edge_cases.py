#!/usr/bin/env python3
"""
Check Notification System Edge Cases
Comprehensive check for potential bugs and edge cases in the notification system
"""

import asyncio
import sys
import re
from pathlib import Path

async def check_edge_cases():
    """Check for various edge cases in the notification system"""
    
    print("🔍 Checking Notification System Edge Cases")
    print("=" * 60)
    
    issues_found = []
    
    # 1. Check for parameter mismatches in mark_as_sent calls
    print("\n1️⃣ Checking mark_as_sent parameter usage...")
    
    backend_dir = Path("/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend")
    
    for py_file in backend_dir.rglob("*.py"):
        if "node_modules" in str(py_file) or "__pycache__" in str(py_file):
            continue
            
        try:
            content = py_file.read_text()
            
            # Check for mark_as_sent calls with incorrect parameters
            mark_as_sent_pattern = r'mark_as_sent\s*\([^)]+\)'
            matches = re.findall(mark_as_sent_pattern, content)
            
            for match in matches:
                # Check if using status= instead of success=
                if 'status=' in match and 'success=' not in match:
                    issues_found.append({
                        'file': str(py_file),
                        'type': 'parameter_mismatch',
                        'issue': f'Using status= instead of success= in mark_as_sent: {match}',
                        'severity': 'critical'
                    })
                
                # Check if missing success parameter
                if 'mark_as_sent(' in match and 'success=' not in match and 'status=' not in match:
                    issues_found.append({
                        'file': str(py_file),
                        'type': 'missing_success_param',
                        'issue': f'Missing success parameter in mark_as_sent: {match}',
                        'severity': 'critical'
                    })
            
            # Check for notification.dict().get("_id") pattern (should use notification.id)
            dict_pattern = r'notification\.dict\(\)\.get\(["\']_id["\']'
            dict_matches = re.findall(dict_pattern, content)
            if dict_matches:
                issues_found.append({
                    'file': str(py_file),
                    'type': 'wrong_id_access',
                    'issue': f'Using notification.dict().get("_id") instead of notification.id',
                    'severity': 'high'
                })
            
            # Check for MongoDB update operator issues
            update_pattern = r'\{"\$set":.*"\$inc":'
            update_matches = re.findall(update_pattern, content, re.DOTALL)
            if update_matches:
                issues_found.append({
                    'file': str(py_file),
                    'type': 'mongodb_operator_mix',
                    'issue': f'Mixed $set and $inc in same MongoDB update (should be separate)',
                    'severity': 'high'
                })
            
            # Check for hardcoded localhost URLs
            localhost_pattern = r'http://localhost:[0-9]+'
            localhost_matches = re.findall(localhost_pattern, content)
            if localhost_matches:
                issues_found.append({
                    'file': str(py_file),
                    'type': 'hardcoded_localhost',
                    'issue': f'Hardcoded localhost URL found: {localhost_matches}',
                    'severity': 'medium'
                })
            
            # Check for console.log in production code
            console_pattern = r'console\.log\('
            console_matches = re.findall(console_pattern, content)
            if console_matches and 'frontend' in str(py_file):
                issues_found.append({
                    'file': str(py_file),
                    'type': 'console_log',
                    'issue': f'console.log found in frontend code (should use logger)',
                    'severity': 'low'
                })
                
        except Exception as e:
            print(f"⚠️ Error reading {py_file}: {e}")
    
    # 2. Check for specific notification-related edge cases
    print("\n2️⃣ Checking notification-specific edge cases...")
    
    # Check email notifier template
    email_notifier = backend_dir / "job_templates" / "email_notifier_template.py"
    if email_notifier.exists():
        content = email_notifier.read_text()
        
        # Check for proper exception handling
        if 'except Exception as e:' not in content:
            issues_found.append({
                'file': str(email_notifier),
                'type': 'missing_exception_handling',
                'issue': 'Missing exception handling in email notifier',
                'severity': 'high'
            })
        
        # Check for atomic notification claiming
        if 'find_one_and_update' not in content:
            issues_found.append({
                'file': str(email_notifier),
                'type': 'non_atomic_claiming',
                'issue': 'Notifications not claimed atomically (race condition risk)',
                'severity': 'high'
            })
    
    # 3. Check for infinite loop patterns
    print("\n3️⃣ Checking for infinite loop patterns...")
    
    for py_file in backend_dir.rglob("*.py"):
        if "node_modules" in str(py_file) or "__pycache__" in str(py_file):
            continue
            
        try:
            content = py_file.read_text()
            
            # Check for while True without break
            while_true_pattern = r'while\s+True:'
            while_matches = re.findall(while_true_pattern, content)
            
            for match in while_matches:
                # Get the function context
                lines = content.split('\n')
                for i, line in enumerate(lines):
                    if match in line:
                        # Check next 20 lines for break
                        has_break = any('break' in lines[j] for j in range(i+1, min(i+20, len(lines))))
                        if not has_break:
                            issues_found.append({
                                'file': str(py_file),
                                'type': 'potential_infinite_loop',
                                'issue': f'while True loop without break found at line {i+1}',
                                'severity': 'medium'
                            })
                        break
            
            # Check for recursive calls without base case
            if 'def ' in content:
                # Simple check for recursion
                lines = content.split('\n')
                for i, line in enumerate(lines):
                    if 'def ' in line and 'async def' not in line:
                        func_name = re.search(r'def\s+(\w+)', line)
                        if func_name:
                            name = func_name.group(1)
                            # Check if function calls itself
                            func_content = '\n'.join(lines[i:])
                            if f'{name}(' in func_content and 'return' not in func_content[:200]:
                                issues_found.append({
                                    'file': str(py_file),
                                    'type': 'potential_recursion',
                                    'issue': f'Function {name} might be recursive without proper base case',
                                    'severity': 'medium'
                                })
                                
        except Exception as e:
            print(f"⚠️ Error analyzing {py_file}: {e}")
    
    # 4. Check for database connection leaks
    print("\n4️⃣ Checking for database connection leaks...")
    
    for py_file in backend_dir.rglob("*.py"):
        if "node_modules" in str(py_file) or "__pycache__" in str(py_file):
            continue
            
        try:
            content = py_file.read_text()
            
            # Check for AsyncIOMotorClient without close
            if 'AsyncIOMotorClient(' in content and '.close()' not in content:
                issues_found.append({
                    'file': str(py_file),
                    'type': 'potential_db_leak',
                    'issue': 'AsyncIOMotorClient created but not closed',
                    'severity': 'medium'
                })
                
        except Exception as e:
            print(f"⚠️ Error checking DB leaks in {py_file}: {e}")
    
    # 5. Check for memory leaks in notification processing
    print("\n5️⃣ Checking for memory leak patterns...")
    
    for py_file in backend_dir.rglob("*.py"):
        if "node_modules" in str(py_file) or "__pycache__" in str(py_file):
            continue
            
        try:
            content = py_file.read_text()
            
            # Check for lists that grow without bounds
            if '.append(' in content and 'notification' in content.lower():
                # Check if there's any mechanism to clear the list
                if '.clear()' not in content and 'del ' not in content:
                    issues_found.append({
                        'file': str(py_file),
                        'type': 'potential_memory_leak',
                        'issue': 'List append without clearing mechanism in notification code',
                        'severity': 'low'
                    })
                    
        except Exception as e:
            print(f"⚠️ Error checking memory leaks in {py_file}: {e}")
    
    # Report results
    print(f"\n📊 Edge Case Analysis Results:")
    print("=" * 60)
    
    if not issues_found:
        print("✅ No critical edge cases found!")
    else:
        print(f"⚠️ Found {len(issues_found)} potential issues:")
        
        # Group by severity
        critical = [i for i in issues_found if i['severity'] == 'critical']
        high = [i for i in issues_found if i['severity'] == 'high']
        medium = [i for i in issues_found if i['severity'] == 'medium']
        low = [i for i in issues_found if i['severity'] == 'low']
        
        if critical:
            print(f"\n🚨 CRITICAL ({len(critical)}):")
            for issue in critical:
                print(f"   ❌ {issue['file']}")
                print(f"      {issue['issue']}")
        
        if high:
            print(f"\n⚠️ HIGH ({len(high)}):")
            for issue in high:
                print(f"   ⚠️ {issue['file']}")
                print(f"      {issue['issue']}")
        
        if medium:
            print(f"\n🟡 MEDIUM ({len(medium)}):")
            for issue in medium:
                print(f"   🟡 {issue['file']}")
                print(f"      {issue['issue']}")
        
        if low:
            print(f"\n🔵 LOW ({len(low)}):")
            for issue in low:
                print(f"   🔵 {issue['file']}")
                print(f"      {issue['issue']}")
    
    # Recommendations
    print(f"\n💡 Recommendations:")
    print("=" * 60)
    
    if critical:
        print("🚨 IMMEDIATE ACTION REQUIRED:")
        print("   1. Fix all critical issues before next deployment")
        print("   2. Test notification system thoroughly")
        print("   3. Monitor queue for stuck notifications")
    
    if high:
        print("⚠️ HIGH PRIORITY:")
        print("   1. Review and fix high-severity issues")
        print("   2. Add monitoring for these patterns")
        print("   3. Consider code review process improvements")
    
    if medium:
        print("🟡 MEDIUM PRIORITY:")
        print("   1. Address in next sprint")
        print("   2. Add unit tests to catch these issues")
        print("   3. Document best practices")
    
    if low:
        print("🔵 LOW PRIORITY:")
        print("   1. Clean up when time permits")
        print("   2. Add to technical debt backlog")
        print("   3. Consider during refactoring")
    
    if not issues_found:
        print("✅ System appears healthy!")
        print("   1. Continue with regular monitoring")
        print("   2. Maintain code review standards")
        print("   3. Keep automated tests up to date")
    
    return len(issues_found) == 0

if __name__ == "__main__":
    success = asyncio.run(check_edge_cases())
    sys.exit(0 if success else 1)
