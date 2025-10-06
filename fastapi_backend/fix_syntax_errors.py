#!/usr/bin/env python3
"""
Fix all syntax errors with extra closing parentheses
"""
import re

with open("routes.py", "r") as f:
    content = f.read()

# Fix all instances of double closing parentheses at end of logger statements
content = re.sub(r'(logger\.\w+\([^)]+\))\)', r'\1', content)

# Write back
with open("routes.py", "w") as f:
    f.write(content)

print("Fixed all syntax errors with extra parentheses")
