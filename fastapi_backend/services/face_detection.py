"""
Face Detection Service
Validates that uploaded images contain a human face using OpenCV (headless).
Uses Haar cascade classifier - works in headless server environments (Cloud Run, etc.)
without requiring OpenGL or a display context.
"""

import io
import logging
from typing import Tuple
from PIL import Image

logger = logging.getLogger(__name__)

# Lazy-load OpenCV to avoid import errors if not installed
_face_cascade = None
_cv2_available = None


def _get_face_detector():
    """Lazy-initialize OpenCV Haar cascade face detector (singleton)."""
    global _face_cascade, _cv2_available

    if _cv2_available is False:
        return None

    if _face_cascade is not None:
        return _face_cascade

    try:
        import cv2

        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        _face_cascade = cv2.CascadeClassifier(cascade_path)

        if _face_cascade.empty():
            raise RuntimeError(f"Failed to load cascade classifier from: {cascade_path}")

        _cv2_available = True
        logger.info("✅ Face detection initialized (OpenCV Haar cascade, headless-safe)")
        return _face_cascade

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

    detector = _get_face_detector()
    if detector is None:
        # opencv not installed — allow upload (graceful degradation for missing lib)
        return True, "Face detection unavailable – skipping check"

    try:
        import cv2
        import numpy as np

        # Open with PIL, convert to RGB then grayscale for Haar cascade
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode != "RGB":
            img = img.convert("RGB")

        img_array = np.array(img)
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)

        # Detect faces — scaleFactor and minNeighbors tuned for strict detection
        # minNeighbors=6 (default 3) reduces false positives significantly
        faces = detector.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=6,
            minSize=(60, 60),  # Ignore tiny detected regions
            flags=cv2.CASCADE_SCALE_IMAGE
        )

        if len(faces) > 0:
            logger.debug(f"👤 Face detected: {len(faces)} face(s) found")
            return True, f"Face detected ({len(faces)} face(s) found)"

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
