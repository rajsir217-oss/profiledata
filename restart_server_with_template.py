#!/usr/bin/env python3
"""
Script to verify template is registered and provide restart instructions
"""

import sys
import os

# Add the backend directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'fastapi_backend'))

from job_templates.registry import get_template_registry

def verify_template():
    """Verify template registration"""
    
    print("🔍 Checking template registration...")
    
    # Get registry
    registry = get_template_registry()
    
    # Check if template is registered
    template = registry.get("contribution_popup_activity_cleanup")
    
    if template:
        print(f"✅ Template is registered in memory!")
        print(f"   Name: {template.template_name}")
        print(f"   Type: {template.template_type}")
        
        # Test validation
        test_params = {
            "retention_days": 120,
            "batch_size": 1000,
            "dry_run": False,
            "archive": True
        }
        
        valid, error = template.validate_params(test_params)
        if valid:
            print(f"   ✅ Parameter validation works")
        else:
            print(f"   ❌ Parameter validation failed: {error}")
    else:
        print("❌ Template NOT registered in memory")
        print("\n💡 The template needs to be loaded by the FastAPI server")
    
    print("\n📋 To fix the 422 error:")
    print("1. Stop the FastAPI server (Ctrl+C)")
    print("2. Restart it with: cd fastapi_backend && python3 main.py")
    print("3. The server will call initialize_templates() on startup")
    print("4. Try updating the job again in the UI")
    
    print("\n🔧 Alternative: Run this to force template registration:")
    print("   python3 init_and_check_template.py")
    print("   (This simulates what the server does on startup)")

if __name__ == "__main__":
    verify_template()
