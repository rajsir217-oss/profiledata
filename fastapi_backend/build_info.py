"""
Build information module
Contains build timestamp and version info
This file is AUTO-GENERATED during build/deployment
<<<<<<< HEAD
<<<<<<< HEAD
Generated at: 2026-01-05 07:44:10 UTC
"""

# Build timestamp (captured at build time, not runtime)
BUILD_TIME = "2026-01-05T07:44:10.838313+00:00"
BUILD_DATE = "January 05, 2026 01:14 PM "
=======
Generated at: 2026-01-06 05:20:23 UTC
"""

# Build timestamp (captured at build time, not runtime)
BUILD_TIME = "2026-01-06T05:20:23.192782+00:00"
BUILD_DATE = "January 06, 2026 10:50 AM "
>>>>>>> dev
=======
Generated at: 2026-01-06 10:54:04 UTC
"""

# Build timestamp (captured at build time, not runtime)
BUILD_TIME = "2026-01-06T10:54:04.822736+00:00"
BUILD_DATE = "January 06, 2026 04:24 PM "
>>>>>>> dev
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
