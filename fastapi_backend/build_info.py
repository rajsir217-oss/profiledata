"""
Build information module
Contains build timestamp and version info
This file is AUTO-GENERATED during build/deployment
Generated at: 2025-11-29 07:44:55 UTC
"""

# Build timestamp (captured at build time, not runtime)
BUILD_TIME = "2025-11-29T07:44:55.635870+00:00"
BUILD_DATE = "November 28, 2025 11:44 PM "
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
