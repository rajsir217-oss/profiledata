#!/usr/bin/env python3
"""
Script to remove async/await from test_routes_integration.py
"""

import re

with open("tests/test_routes_integration.py", "r") as f:
    content = f.read()

# Remove @pytest.mark.asyncio decorators
content = re.sub(r'@pytest\.mark\.asyncio\n\s*', '', content)

# Change async def to def
content = re.sub(r'async def (test_\w+)', r'def \1', content)

# Remove await from client calls
content = re.sub(r'await (client\.\w+)', r'\1', content)

# Write the fixed content
with open("tests/test_routes_integration.py", "w") as f:
    f.write(content)

print("Fixed test_routes_integration.py")
