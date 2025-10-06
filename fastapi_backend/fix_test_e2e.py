#!/usr/bin/env python3
"""
Script to fix files parameter in test_e2e_api.py
"""

import re

with open("tests/test_e2e_api.py", "r") as f:
    content = f.read()

# Fix files={"images": []} to not be passed at all
content = re.sub(r',\s*files=\{"images":\s*\[\]\}', '', content)

# Write the fixed content
with open("tests/test_e2e_api.py", "w") as f:
    f.write(content)

print("Fixed files parameter in test_e2e_api.py")
