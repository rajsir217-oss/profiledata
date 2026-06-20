"""Phone normalization helpers for SMS providers."""


def normalize_phone_for_sms(phone: str) -> str:
    """Normalize a phone string into a 10-digit US number when possible."""
    digits = "".join(filter(str.isdigit, str(phone or "")))

    if not digits:
        return ""

    # Strip US country code prefix if present
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]

    # SimpleTexting only supports US/Canada 10-digit numbers
    if len(digits) != 10:
        return ""

    return digits


def format_phone_for_twilio(phone: str) -> str:
    """Format phone for Twilio in E.164 (+1XXXXXXXXXX) for US numbers."""
    normalized = normalize_phone_for_sms(phone)

    if len(normalized) == 10:
        return f"+1{normalized}"

    if len(normalized) == 11 and normalized.startswith("1"):
        return f"+{normalized}"

    return f"+{normalized}" if normalized else ""
