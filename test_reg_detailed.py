#!/usr/bin/env python3
"""Test registration with detailed error output"""
import requests
import json
import traceback

url = "http://localhost:8000/api/users/register"

# Minimal registration data
files = {
    'username': (None, 'testdetail999'),
    'password': (None, 'password123'),
    'firstName': (None, 'Test'),
    'lastName': (None, 'User'),
    'state': (None, 'California'),
    'birthMonth': (None, '6'),
    'birthYear': (None, '1990'),
    'agreedToAge': (None, 'true'),
    'agreedToTerms': (None, 'true'),
    'agreedToPrivacy': (None, 'true'),
    'agreedToGuidelines': (None, 'true'),
    'agreedToDataProcessing': (None, 'true'),
    'educationHistory': (None, json.dumps([{
        "level": "Bachelor",
        "degree": "BS",
        "institution": "Test University",
        "startYear": "2010",
        "endYear": "2014"
    }])),
    'workExperience': (None, json.dumps([{
        "status": "current",
        "description": "Software Engineer"
    }]))
}

try:
    print("Sending registration request...")
    response = requests.post(url, files=files, headers={'Origin': 'http://localhost:3000'})
    
    print(f"\n{'='*60}")
    print(f"Status Code: {response.status_code}")
    print(f"{'='*60}")
    
    if response.status_code >= 400:
        print(f"\n❌ Error Response:")
        print(f"Content-Type: {response.headers.get('content-type')}")
        print(f"Response Text: {response.text[:500]}")
        
        # Try to parse as JSON
        try:
            error_data = response.json()
            print(f"\nError Detail: {json.dumps(error_data, indent=2)}")
        except:
            print(f"\nNon-JSON error response")
    else:
        print(f"\n✅ Success!")
        try:
            data = response.json()
            print(f"Username: {data.get('username')}")
            print(f"ProfileId: {data.get('profileId')}")
        except:
            print(f"Response: {response.text[:200]}")
            
except Exception as e:
    print(f"\n❌ Exception occurred:")
    print(traceback.format_exc())
