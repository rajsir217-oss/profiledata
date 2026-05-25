"""
Build information module
Contains build timestamp and version info
This file is AUTO-GENERATED during build/deployment
Generated at: 2026-05-25 18:11:21 UTC
"""

# Build timestamp (captured at build time, not runtime)
BUILD_TIME = "2026-05-25T18:11:21.048803+00:00"
BUILD_DATE = "May 25, 2026 11:11 AM "
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
