#!/usr/bin/env python3
"""
Script to reload job templates in a running server
"""

import asyncio
import sys
import os
import aiohttp
import json

async def reload_templates():
    """Reload templates via API"""
    
    # Check if server is running
    try:
        async with aiohttp.ClientSession() as session:
            # Try to access the templates endpoint
            async with session.get('http://localhost:8000/api/admin/scheduler/templates') as resp:
                if resp.status == 200:
                    data = await resp.json()
                    print("✅ Server is running")
                    print(f"📋 Currently loaded templates: {len(data.get('templates', []))}")
                    
                    # Check if our template is loaded
                    our_template = None
                    for template in data.get('templates', []):
                        if template.get('template_type') == 'contribution_popup_activity_cleanup':
                            our_template = template
                            break
                    
                    if our_template:
                        print("✅ Template is already loaded!")
                        print(f"   Name: {our_template.get('name')}")
                        return True
                    else:
                        print("❌ Template is NOT loaded")
                        print("\n⚠️  No reload endpoint available")
                        print("   You must restart the server to load new templates")
                        return False
                else:
                    print(f"❌ Server returned status {resp.status}")
                    return False
                    
    except Exception as e:
        print(f"❌ Cannot connect to server: {e}")
        print("\n💡 Make sure the FastAPI server is running on port 8000")
        return False

if __name__ == "__main__":
    print("🔄 Checking template status...")
    result = asyncio.run(reload_templates())
    
    if not result:
        print("\n🔧 To fix this:")
        print("1. Stop the FastAPI server (Ctrl+C)")
        print("2. Run: cd fastapi_backend && python3 main.py")
        print("3. The server will load all templates on startup")
