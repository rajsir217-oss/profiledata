"""
Face Detection Service
Validates that uploaded images contain a human face using OpenCV (headless).
Uses multi-cascade strategy (frontal + profile) with strict minNeighbors to
avoid false positives on clothing/texture patterns.
Works in headless server environments (Cloud Run) without OpenGL.
"""

import io
import logging
from typing import Tuple
from PIL import Image

logger = logging.getLogger(__name__)

# Lazy-load OpenCV to avoid import errors if not installed
_detectors = None       # dict: {'frontal': cascade, 'profile': cascade}
_cv2_available = None


def _get_detectors():
    """Lazy-initialize all cascade detectors (singleton dict)."""
    global _detectors, _cv2_available

    if _cv2_available is False:
        return None

    if _detectors is not None:
        return _detectors

    try:
        import cv2

        haarcascades = cv2.data.haarcascades

        frontal = cv2.CascadeClassifier(haarcascades + "haarcascade_frontalface_default.xml")
        profile = cv2.CascadeClassifier(haarcascades + "haarcascade_profileface.xml")

        if frontal.empty():
            raise RuntimeError("Failed to load frontalface cascade")

        _detectors = {
            "frontal": frontal,
            "profile": None if profile.empty() else profile,
        }
        _cv2_available = True
        logger.info("✅ Face detection initialized (frontal + profile cascades, headless-safe)")
        return _detectors

    except ImportError as e:
        _cv2_available = False
        logger.warning(
            f"⚠️ opencv-python-headless not available – face detection disabled. "
            f"Error: {e}. Install with: pip install opencv-python-headless"
        )
        return None
    except Exception as e:
        _cv2_available = False
        logger.error(f"❌ Failed to initialize face detection: {e}", exc_info=True)
        return None


def _detect_faces(cascade, gray):
    """Run detectMultiScale with strict settings to minimise false positives."""
    import cv2
    return cascade.detectMultiScale(
        gray,
        scaleFactor=1.05,   # smaller step = more thorough scan
        minNeighbors=8,     # high value = strict: requires strong consensus
        minSize=(80, 80),   # faces must be at least 80x80px
        flags=cv2.CASCADE_SCALE_IMAGE,
    )


def validate_human_image(image_bytes: bytes) -> Tuple[bool, str]:
    """
    Check whether *image_bytes* contain at least one human face.

    Returns:
        (is_valid, message)
        - (True, "...")  when a face is found
        - (False, "...") when no face is detected or an error occurs
    """
    from config import settings

    if not settings.face_detection_enabled:
        return True, "Face detection disabled"

    detectors = _get_detectors()
    if detectors is None:
        # opencv not installed — allow upload (graceful degradation for missing lib)
        return True, "Face detection unavailable – skipping check"

    try:
        import cv2
        import numpy as np

        img = Image.open(io.BytesIO(image_bytes))
        if img.mode != "RGB":
            img = img.convert("RGB")

        img_array = np.array(img)
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)

        # Pass 1: frontal face cascade
        faces = _detect_faces(detectors["frontal"], gray)
        if len(faces) > 0:
            logger.debug(f"👤 Frontal face detected: {len(faces)} face(s)")
            return True, f"Face detected ({len(faces)} face(s) found)"

        # Pass 2: profile face cascade (side-facing portraits)
        if detectors["profile"] is not None:
            profile_faces = _detect_faces(detectors["profile"], gray)
            if len(profile_faces) > 0:
                logger.debug(f"👤 Profile face detected: {len(profile_faces)} face(s)")
                return True, f"Face detected ({len(profile_faces)} profile face(s) found)"

            # Also check horizontally flipped image for profile faces
            flipped = cv2.flip(gray, 1)
            profile_flipped = _detect_faces(detectors["profile"], flipped)
            if len(profile_flipped) > 0:
                logger.debug(f"👤 Profile face detected (flipped): {len(profile_flipped)} face(s)")
                return True, f"Face detected ({len(profile_flipped)} profile face(s) found)"

        logger.info("🚫 No human face detected in uploaded image")
        return False, (
            "No human face detected in this image. "
            "Please upload a clear photo of yourself."
        )

    except Exception as e:
        logger.error(f"❌ Face detection error: {e}", exc_info=True)
        return False, "Unable to validate image. Please upload a clear photo of yourself."


async def validate_uploaded_images(files_with_bytes: list) -> Tuple[list, list]:
    """
    Validate a batch of (filename, image_bytes) tuples.

    Args:
        files_with_bytes: list of (filename: str, content: bytes)

    Returns:
        (valid_files, rejected_files)
        - valid_files:    [(filename, bytes), ...]
        - rejected_files: [(filename, reason), ...]
    """
    from config import settings

    if not settings.face_detection_enabled:
        return files_with_bytes, []

    valid = []
    rejected = []

    for filename, content in files_with_bytes:
        is_valid, message = validate_human_image(content)
        if is_valid:
            valid.append((filename, content))
        else:
            rejected.append((filename, message))
            logger.warning(f"🚫 Rejected image '{filename}': {message}")

    return valid, rejected
