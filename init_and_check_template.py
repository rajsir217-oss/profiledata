#!/usr/bin/env python3
"""
Script to initialize and check template registration
"""

import sys
import os

# Add the backend directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'fastapi_backend'))

from job_templates.registry import initialize_templates, get_template_registry

def init_and_check():
    """Initialize templates and check"""
    
    print("🔧 Initializing templates...")
    
    # Initialize templates
    registry = initialize_templates()
    
    print(f"✅ Initialized {len(registry.list_templates())} templates")
    
    # List all templates
    print("\n📋 All Registered Templates:")
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
        
        # Check if the file exists
        template_file = os.path.join(os.path.dirname(__file__), 'fastapi_backend', 'job_templates', 'contribution_popup_activity_cleanup_job.py')
        if os.path.exists(template_file):
            print(f"   ✅ Template file exists: {template_file}")
        else:
            print(f"   ❌ Template file NOT found: {template_file}")

if __name__ == "__main__":
    init_and_check()
