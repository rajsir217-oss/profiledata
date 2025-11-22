#!/usr/bin/env python3
"""Test registration endpoint to see actual error"""
import requests
import json

url = "http://localhost:8000/api/users/register"

data = {
    "username": "testuser999",
    "password": "password123",
    "firstName": "Test",
    "state": "California",
    "birthMonth": "6",
    "birthYear": "1990",
    "agreedToAge": "true",
    "agreedToTerms": "true",
    "agreedToPrivacy": "true",
    "agreedToGuidelines": "true",
    "agreedToDataProcessing": "true",
    "educationHistory": json.dumps([{"level":"Bachelor","degree":"BS","institution":"Test University","startYear":"2010","endYear":"2014"}]),
    "workExperience": json.dumps([{"status":"current","description":"Software Engineer"}])
}

try:
    response = requests.post(url, data=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    if response.status_code >= 400:
        print(f"\nHeaders: {dict(response.headers)}")
except Exception as e:
    print(f"Error: {e}")
