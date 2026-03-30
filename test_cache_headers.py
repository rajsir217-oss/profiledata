#!/usr/bin/env python3
"""
Test script to verify Cache-Control headers for PCI compliance.

This script tests that:
1. Sensitive routes have: max-age=0, must-revalidate, no-cache, no-store, private
2. Non-sensitive routes have: no-cache
3. No routes have duplicate or missing Cache-Control headers
"""

import requests
import re
from urllib.parse import urljoin

# Test configuration
BASE_URL = "https://l3v3lmatches.com"

# Routes to test
SENSITIVE_ROUTES = [
    "/register2",
    "/login",
    "/api/users/profile",
    "/api/payments",
    "/api/virtual-meets/events",
    "/api/admin/users",
]

NON_SENSITIVE_ROUTES = [
    "/",
    "/about",
    "/contact",
    "/static/css/main.css",
]

def test_cache_headers():
    """Test Cache-Control headers on various routes."""
    
    print("=== Cache-Control Header Test for PCI Compliance ===\n")
    
    results = {
        "sensitive": {"pass": 0, "fail": 0, "details": []},
        "non_sensitive": {"pass": 0, "fail": 0, "details": []},
    }
    
    # Test sensitive routes
    print("🔒 Testing SENSITIVE Routes:")
    print("Expected: max-age=0, must-revalidate, no-cache, no-store, private")
    print("-" * 70)
    
    for route in SENSITIVE_ROUTES:
        url = urljoin(BASE_URL, route)
        try:
            response = requests.get(url, timeout=10, allow_redirects=True)
            cache_control = response.headers.get("Cache-Control", "")
            pragma = response.headers.get("Pragma", "")
            
            # Check for required directives
            required = ["max-age=0", "must-revalidate", "no-cache", "no-store", "private"]
            missing = [req for req in required if req not in cache_control]
            
            # Check for duplicates
            if "no-cache no-cache" in cache_control:
                issues = ["Duplicate 'no-cache' directive"]
            elif missing:
                issues = [f"Missing: {', '.join(missing)}"]
            else:
                issues = []
            
            # Check for deprecated Pragma header (PCI issue)
            if pragma == "no-cache":
                issues.append("Deprecated Pragma header (should only be for HTTP/1.0)")
            
            if not issues:
                status = "✅ PASS"
                results["sensitive"]["pass"] += 1
            else:
                status = "❌ FAIL"
                results["sensitive"]["fail"] += 1
            
            results["sensitive"]["details"].append({
                "route": route,
                "status": status,
                "cache_control": cache_control,
                "pragma": pragma,
                "issues": issues
            })
            
            print(f"{status} {route}")
            print(f"     Cache-Control: {cache_control}")
            print(f"     Pragma: {pragma}")
            if issues:
                print(f"     Issues: {', '.join(issues)}")
            print()
            
        except requests.RequestException as e:
            print(f"❌ ERROR {route}: {e}")
            results["sensitive"]["fail"] += 1
            results["sensitive"]["details"].append({
                "route": route,
                "status": "❌ ERROR",
                "error": str(e)
            })
            print()
    
    # Test non-sensitive routes
    print("\n🌐 Testing NON-SENSITIVE Routes:")
    print("Expected: no-cache")
    print("-" * 70)
    
    for route in NON_SENSITIVE_ROUTES:
        url = urljoin(BASE_URL, route)
        try:
            response = requests.get(url, timeout=10, allow_redirects=True)
            cache_control = response.headers.get("Cache-Control", "")
            
            if cache_control == "no-cache":
                status = "✅ PASS"
                results["non_sensitive"]["pass"] += 1
            else:
                status = "❌ FAIL"
                results["non_sensitive"]["fail"] += 1
            
            results["non_sensitive"]["details"].append({
                "route": route,
                "status": status,
                "cache_control": cache_control
            })
            
            print(f"{status} {route}")
            print(f"     Cache-Control: {cache_control}")
            print()
            
        except requests.RequestException as e:
            print(f"❌ ERROR {route}: {e}")
            results["non_sensitive"]["fail"] += 1
            print()
    
    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    
    total_sensitive = len(SENSITIVE_ROUTES)
    total_non_sensitive = len(NON_SENSITIVE_ROUTES)
    
    print(f"\nSensitive Routes: {results['sensitive']['pass']}/{total_sensitive} passed")
    if results["sensitive"]["fail"] > 0:
        print("❌ Failed sensitive routes:")
        for detail in results["sensitive"]["details"]:
            if detail["status"] in ["❌ FAIL", "❌ ERROR"]:
                print(f"   - {detail['route']}: {detail.get('issues', [detail.get('error', 'Unknown error')])}")
    
    print(f"\nNon-Sensitive Routes: {results['non_sensitive']['pass']}/{total_non_sensitive} passed")
    if results["non_sensitive"]["fail"] > 0:
        print("❌ Failed non-sensitive routes:")
        for detail in results["non_sensitive"]["details"]:
            if detail["status"] in ["❌ FAIL", "❌ ERROR"]:
                print(f"   - {detail['route']}: {detail.get('cache_control', 'No Cache-Control header')}")
    
    # Overall result
    total_pass = results["sensitive"]["pass"] + results["non_sensitive"]["pass"]
    total_tests = total_sensitive + total_non_sensitive
    
    if total_pass == total_tests:
        print(f"\n✅ PCI COMPLIANCE TEST PASSED: {total_pass}/{total_tests} routes compliant")
        return True
    else:
        print(f"\n❌ PCI COMPLIANCE TEST FAILED: {total_pass}/{total_tests} routes compliant")
        return False

def test_specific_route(route):
    """Test a specific route for Cache-Control headers."""
    url = urljoin(BASE_URL, route)
    print(f"\nTesting: {url}")
    
    try:
        response = requests.get(url, timeout=10, allow_redirects=True)
        
        print(f"Status Code: {response.status_code}")
        print(f"Cache-Control: {response.headers.get('Cache-Control', 'NOT SET')}")
        print(f"Pragma: {response.headers.get('Pragma', 'NOT SET')}")
        print(f"Expires: {response.headers.get('Expires', 'NOT SET')}")
        print(f"ETag: {response.headers.get('ETag', 'NOT SET')}")
        
        # Check PCI compliance
        cache_control = response.headers.get("Cache-Control", "")
        if "max-age=0" in cache_control and "no-store" in cache_control and "private" in cache_control:
            print("✅ PCI Compliant (sensitive)")
        elif cache_control == "no-cache":
            print("✅ PCI Compliant (non-sensitive)")
        else:
            print("❌ NOT PCI Compliant")
            
    except requests.RequestException as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        # Test specific route
        test_specific_route(sys.argv[1])
    else:
        # Run full compliance test
        success = test_cache_headers()
        sys.exit(0 if success else 1)
