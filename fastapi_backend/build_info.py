"""
Build information module
Contains build timestamp and version info
This file is AUTO-GENERATED during build/deployment
Generated at: 2025-11-30 23:48:08 UTC
"""

# Build timestamp (captured at build time, not runtime)
BUILD_TIME = "2025-11-30T23:48:08.535452+00:00"
BUILD_DATE = "November 30, 2025 03:48 PM "
VERSION = "1.0.0"
ENVIRONMENT = "local"
GIT_COMMIT = "unknown"
GIT_BRANCH = "unknown"

def get_build_info():
    """Return build information as dictionary"""
    return {
        'buildTime': BUILD_TIME,
        'buildDate': BUILD_DATE,
        'version': VERSION,
        'environment': ENVIRONMENT,
        'gitCommit': GIT_COMMIT,
        'gitBranch': GIT_BRANCH
    }
