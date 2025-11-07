#!/usr/bin/env python3
"""
Generate build_info.py with actual build timestamp
Run during deployment to capture build time
"""
import os
from datetime import datetime, timezone

def generate_build_info():
    """Generate build_info.py with current timestamp"""
    
    build_time_utc = datetime.now(timezone.utc)
    build_time_local = datetime.now()
    
    version = os.getenv('APP_VERSION', '1.0.0')
    environment = os.getenv('ENVIRONMENT', 'local')
    git_commit = os.getenv('GIT_COMMIT', 'unknown')
    git_branch = os.getenv('GIT_BRANCH', 'unknown')
    
    build_info_content = f'''"""
Build information module
Contains build timestamp and version info
This file is AUTO-GENERATED during build/deployment
Generated at: {build_time_utc.strftime('%Y-%m-%d %H:%M:%S UTC')}
"""

# Build timestamp (captured at build time, not runtime)
BUILD_TIME = "{build_time_utc.isoformat()}"
BUILD_DATE = "{build_time_local.strftime('%B %d, %Y %I:%M %p %Z')}"
VERSION = "{version}"
ENVIRONMENT = "{environment}"
GIT_COMMIT = "{git_commit}"
GIT_BRANCH = "{git_branch}"

def get_build_info():
    """Return build information as dictionary"""
    return {{
        'buildTime': BUILD_TIME,
        'buildDate': BUILD_DATE,
        'version': VERSION,
        'environment': ENVIRONMENT,
        'gitCommit': GIT_COMMIT,
        'gitBranch': GIT_BRANCH
    }}
'''
    
    # Write to build_info.py
    output_path = os.path.join(os.path.dirname(__file__), 'build_info.py')
    with open(output_path, 'w') as f:
        f.write(build_info_content)
    
    print(f"✅ Backend build info generated")
    print(f"   Build Time: {build_time_local.strftime('%B %d, %Y %I:%M %p %Z')}")
    print(f"   Version: {version}")
    print(f"   Environment: {environment}")
    print(f"📝 Written to: {output_path}")

if __name__ == '__main__':
    generate_build_info()
