# fastapi_backend/profanity_filter.py
"""
Profanity Filter - Detects and filters inappropriate language in chat messages
"""

import re
import logging
from typing import Dict, List, Tuple

logger = logging.getLogger(__name__)

class ProfanityFilter:
    """Filter to detect and block inappropriate language"""
    
    # Common profanity words (sanitized list)
    PROFANITY_LIST = [
        # Add your profanity words here - keeping it minimal for production
        "fuck", "shit", "bitch", "ass", "damn", "crap", "bastard",
        "dick", "pussy", "cock", "cunt", "whore", "slut", "fag",
        # Add more as needed
    ]
    
    # Sexual/explicit content patterns
    EXPLICIT_PATTERNS = [
        r'\bsex\b', r'\bsexual\b', r'\bnude\b', r'\bnaked\b',
        r'\bporn\b', r'\bxxx\b', r'\berotic\b'
    ]
    
    # Harassment patterns
    HARASSMENT_PATTERNS = [
        r'\bkill\b.*\byou\b', r'\bdie\b', r'\bhate\b.*\byou\b',
        r'\bstupid\b', r'\bidiot\b', r'\bloser\b', r'\bdumb\b'
    ]
    
    def __init__(self):
        # Compile regex patterns for efficiency
        self.profanity_regex = self._compile_word_list(self.PROFANITY_LIST)
        self.explicit_regex = [re.compile(pattern, re.IGNORECASE) for pattern in self.EXPLICIT_PATTERNS]
        self.harassment_regex = [re.compile(pattern, re.IGNORECASE) for pattern in self.HARASSMENT_PATTERNS]
    
    def _compile_word_list(self, words: List[str]) -> re.Pattern:
        """Compile list of words into regex pattern"""
        # Match whole words with word boundaries
        pattern = r'\b(' + '|'.join(re.escape(word) for word in words) + r')\b'
        return re.compile(pattern, re.IGNORECASE)
    
    def check_message(self, message: str) -> Dict:
        """
        Check if message contains inappropriate content
        
        Returns:
            {
                "is_clean": bool,
                "violations": List[str],
                "severity": str (low/medium/high),
                "filtered_message": str
            }
        """
        violations = []
        severity = "none"
        
        # Check for profanity
        profanity_matches = self.profanity_regex.findall(message)
        if profanity_matches:
            violations.append("profanity")
            severity = "medium"
        
        # Check for explicit content
        for pattern in self.explicit_regex:
            if pattern.search(message):
                violations.append("explicit")
                severity = "high"
                break
        
        # Check for harassment
        for pattern in self.harassment_regex:
            if pattern.search(message):
                violations.append("harassment")
                severity = "high"
                break
        
        # Filter the message
        filtered_message = self.filter_message(message) if violations else message
        
        is_clean = len(violations) == 0
        
        return {
            "is_clean": is_clean,
            "violations": violations,
            "severity": severity,
            "filtered_message": filtered_message,
            "original_message": message
        }
    
    def filter_message(self, message: str) -> str:
        """Replace inappropriate words with asterisks"""
        # Replace profanity
        filtered = self.profanity_regex.sub(lambda m: '*' * len(m.group()), message)
        
        # Replace explicit content
        for pattern in self.explicit_regex:
            filtered = pattern.sub(lambda m: '*' * len(m.group()), filtered)
        
        return filtered
    
    def get_warning_message(self, severity: str) -> str:
        """Get appropriate warning message based on severity"""
        if severity == "high":
            return (
                "⚠️ WARNING: This message contains inappropriate content that violates our "
                "community guidelines. Repeated violations may result in account suspension or ban."
            )
        elif severity == "medium":
            return (
                "⚠️ Please maintain professional communication. "
                "Inappropriate language is not allowed."
            )
        else:
            return ""


# Global profanity filter instance
profanity_filter = ProfanityFilter()


def check_message_content(message: str) -> Dict:
    """Check if message content is appropriate"""
    return profanity_filter.check_message(message)


def get_community_guidelines() -> Dict:
    """Get community guidelines text"""
    return {
        "title": "Community Guidelines",
        "sections": [
            {
                "title": "Professional Conduct",
                "content": "All users must maintain professional and respectful communication. "
                          "Vulgar, abusive, or inappropriate language is strictly prohibited."
            },
            {
                "title": "Zero Tolerance Policy",
                "content": "We have zero tolerance for harassment, hate speech, threats, or "
                          "sexually explicit content. Violations will result in immediate "
                          "account suspension or permanent ban."
            },
            {
                "title": "Reporting Violations",
                "content": "If you encounter inappropriate behavior, please report it immediately. "
                          "All reports are reviewed promptly and kept confidential."
            },
            {
                "title": "Consequences",
                "content": "First violation: Warning\n"
                          "Second violation: 7-day suspension\n"
                          "Third violation: Permanent ban\n"
                          "Severe violations may result in immediate permanent ban."
            }
        ],
        "chat_banner": {
            "text": "⚠️ Be Professional. No vulgar or abusive language. Violations result in immediate suspension or ban.",
            "style": "warning"
        }
    }
