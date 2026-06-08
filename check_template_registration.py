#!/usr/bin/env python3
"""
Script to check if the activity cleanup template is registered
"""

import sys
import os

# Add the backend directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'fastapi_backend'))

from job_templates.registry import get_template_registry

def check_template():
    """Check if template is registered"""
    
    registry = get_template_registry()
    
    # List all templates
    print("📋 Registered Templates:")
    for template in registry.list_templates():
        print(f"  - {template.template_type}: {template.template_name}")
    
    # Check for our specific template
    template = registry.get("contribution_popup_activity_cleanup")
    
    if template:
        print(f"\n✅ Template 'contribution_popup_activity_cleanup' found!")
        print(f"   Name: {template.template_name}")
        print(f"   Description: {template.template_description}")
        print(f"   Category: {template.category}")
        
        # Test validation
        test_params = {
            "retention_days": 120,
            "batch_size": 1000,
            "dry_run": False,
            "archive": True
        }
        
        valid, error = template.validate_params(test_params)
        if valid:
            print(f"   ✅ Parameter validation: PASSED")
        else:
            print(f"   ❌ Parameter validation: FAILED - {error}")
    else:
        print(f"\n❌ Template 'contribution_popup_activity_cleanup' NOT found!")
        print("\n💡 Make sure:")
        print("   1. The server is restarted after adding the template")
        print("   2. The template is properly imported in registry.py")
        print("   3. There are no syntax errors in the template file")

if __name__ == "__main__":
    check_template()
