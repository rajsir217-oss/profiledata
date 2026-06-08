#!/usr/bin/env python3
"""
Test the activity logs chart-data API endpoint
"""
import asyncio
import aiohttp
import json
from datetime import datetime, timedelta

async def test_chart_api():
    try:
        # Test the chart-data endpoint
        url = "http://localhost:8000/api/activity-logs/chart-data?days=30"
        
        # You'll need to get a valid admin token
        # For testing, let's try without auth first to see the error
        async with aiohttp.ClientSession() as session:
            print(f"🔍 Testing: {url}")
            
            # Try without auth first
            async with session.get(url) as response:
                print(f"Status: {response.status}")
                if response.status == 200:
                    data = await response.json()
                    print("✅ Response data:")
                    print(json.dumps(data, indent=2, default=str))
                else:
                    text = await response.text()
                    print(f"❌ Error: {text}")
            
            # Now try with auth (you'll need to replace with actual token)
            headers = {"Authorization": "Bearer YOUR_TOKEN_HERE"}
            print(f"\n🔍 Testing with auth...")
            async with session.get(url, headers=headers) as response:
                print(f"Status: {response.status}")
                if response.status == 200:
                    data = await response.json()
                    print("✅ Response data:")
                    print(json.dumps(data, indent=2, default=str))
                else:
                    text = await response.text()
                    print(f"❌ Error: {text}")
        
    except Exception as e:
        print(f"❌ Error testing API: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_chart_api())
