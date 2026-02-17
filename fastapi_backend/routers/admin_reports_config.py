"""
Admin Reports Configuration
Centralized settings for admin reports behavior
"""

from typing import Dict, Any

# Database query limits
MAX_USERS_PER_QUERY = 1000
MAX_USERS_PER_GROUP = 100
MAX_RESULTS_PER_REPORT = 50

# Cache settings
ENCRYPTOR_CACHE_SIZE = 1
SUMMARY_CACHE_TTL = 300  # 5 minutes

# Age range settings
MIN_AGE = 18
MAX_AGE = 79

# Profession categorization settings
DEFAULT_PROFESSION_CATEGORY = "Other"

# Logging configuration
LOG_LEVEL = "INFO"
DEBUG_LOG_ERRORS = True

# Performance settings
ENABLE_QUERY_OPTIMIZATION = True
ENABLE_RESULT_CACHING = False  # Can be enabled later

# Response format settings
INCLUDE_USER_DETAILS = True
INCLUDE_EMPTY_GROUPS = False

# Security settings
REQUIRE_ADMIN_ACCESS = True
LOG_ACCESS_ATTEMPTS = True

# Error handling settings
MAX_RETRY_ATTEMPTS = 3
RETRY_DELAY_SECONDS = 1

# Data validation settings
VALIDATE_JSON_FIELDS = True
SANITIZE_USER_INPUT = True

# Export settings
EXPORT_FORMATS = ["json", "csv"]
MAX_EXPORT_RECORDS = 10000

# Report-specific settings
AGE_REPORT_SETTINGS = {
    "group_size_years": 3,
    "include_age_outliers": False,
    "sort_by_age": True
}

LOCATION_REPORT_SETTINGS = {
    "decrypt_locations": True,
    "group_by_city_state": True,
    "include_empty_locations": False
}

PROFESSION_REPORT_SETTINGS = {
    "use_regex_categorization": True,
    "fallback_to_other": True,
    "include_work_experience": True
}

SUMMARY_REPORT_SETTINGS = {
    "include_gender_breakdown": True,
    "include_other_category": True,
    "cache_results": True
}

# All settings in one dictionary for easy access
ADMIN_REPORTS_CONFIG: Dict[str, Any] = {
    "max_users_per_query": MAX_USERS_PER_QUERY,
    "max_users_per_group": MAX_USERS_PER_GROUP,
    "max_results_per_report": MAX_RESULTS_PER_REPORT,
    "encryptor_cache_size": ENCRYPTOR_CACHE_SIZE,
    "summary_cache_ttl": SUMMARY_CACHE_TTL,
    "min_age": MIN_AGE,
    "max_age": MAX_AGE,
    "default_profession_category": DEFAULT_PROFESSION_CATEGORY,
    "log_level": LOG_LEVEL,
    "debug_log_errors": DEBUG_LOG_ERRORS,
    "enable_query_optimization": ENABLE_QUERY_OPTIMIZATION,
    "enable_result_caching": ENABLE_RESULT_CACHING,
    "include_user_details": INCLUDE_USER_DETAILS,
    "include_empty_groups": INCLUDE_EMPTY_GROUPS,
    "require_admin_access": REQUIRE_ADMIN_ACCESS,
    "log_access_attempts": LOG_ACCESS_ATTEMPTS,
    "max_retry_attempts": MAX_RETRY_ATTEMPTS,
    "retry_delay_seconds": RETRY_DELAY_SECONDS,
    "validate_json_fields": VALIDATE_JSON_FIELDS,
    "sanitize_user_input": SANITIZE_USER_INPUT,
    "export_formats": EXPORT_FORMATS,
    "max_export_records": MAX_EXPORT_RECORDS,
    "age_report": AGE_REPORT_SETTINGS,
    "location_report": LOCATION_REPORT_SETTINGS,
    "profession_report": PROFESSION_REPORT_SETTINGS,
    "summary_report": SUMMARY_REPORT_SETTINGS
}
