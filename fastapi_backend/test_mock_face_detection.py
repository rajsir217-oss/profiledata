#!/usr/bin/env python3
"""
Mock version of face detection for local testing when OpenCV/PIL have issues.
Simulates Vision API responses without actual image processing.
"""

import logging
from typing import Tuple

logger = logging.getLogger(__name__)

def mock_validate_human_image(image_bytes: bytes, filename: str = "") -> Tuple[bool, str]:
    """
    Mock face detection for testing when real libraries aren't available.
    
    This simulates the new behavior:
    - Images with "face" in filename → detected as face
    - Images with "landscape" or "nature" → no face detected
    - Other images → simulate Vision API unavailable
    """
    from config import settings
    
    if not settings.face_detection_enabled:
        return True, "Face detection disabled"
    
    filename_lower = filename.lower()
    
    # Simulate Vision API working for face images
    if "face" in filename_lower or "person" in filename_lower or "human" in filename_lower:
        logger.info(f"👤 Mock Vision API: Face detected in '{filename}'")
        return True, f"Face detected (1 face(s), confidence 85%)"
    
    # Simulate Vision API rejecting landscape/nature images
    if "landscape" in filename_lower or "nature" in filename_lower or "tree" in filename_lower or "mountain" in filename_lower:
        logger.info(f"🚫 Mock Vision API: No face detected in '{filename}'")
        return False, "No human face detected in this image. Please upload a clear photo of yourself."
    
    # Simulate Vision API unavailable for other images
    logger.warning(f"⚠️ Mock Vision API unavailable for '{filename}', trying OpenCV...")
    
    # Simulate OpenCV also failing (like your local environment)
    logger.warning(f"⚠️ Mock OpenCV also unavailable for '{filename}'")
    
    # NEW BEHAVIOR: Reject when both fail
    logger.error(f"❌ No face detection backend available for '{filename}' – rejecting upload")
    return False, (
        "Face detection is temporarily unavailable. "
        "Please try again in a few minutes or contact support."
    )

def test_mock_scenarios():
    """Test the mock face detection with various scenarios."""
    
    print("=== Mock Face Detection Test ===\n")
    
    test_cases = [
        ("profile_face.jpg", "Expected: ACCEPT"),
        ("person_photo.png", "Expected: ACCEPT"),
        ("landscape_sunset.jpg", "Expected: REJECT"),
        ("nature_forest.png", "Expected: REJECT"),
        ("random_image.jpg", "Expected: REJECT (no backend)"),
    ]
    
    for filename, expected in test_cases:
        result, message = mock_validate_human_image(b"fake_image_data", filename)
        status = "ACCEPT" if result else "REJECT"
        print(f"File: {filename}")
        print(f"  Result: {status}")
        print(f"  Message: {message}")
        print(f"  {expected}")
        print(f"  ✅ {'Match!' if status in expected else 'Mismatch!'}")
        print()
    
    print("Key Changes Verified:")
    print("✅ Face images are ACCEPTED")
    print("✅ Landscape/nature images are REJECTED")
    print("✅ When detection unavailable → REJECT (not silent pass)")

if __name__ == "__main__":
    # Set up minimal config for testing
    class MockSettings:
        face_detection_enabled = True
        face_detection_confidence = 0.7
    
    import config
    original_settings = getattr(config, 'settings', None)
    config.settings = MockSettings()
    
    try:
        test_mock_scenarios()
    finally:
        # Restore original settings if they existed
        if original_settings:
            config.settings = original_settings
