"""
Face Detection Service
Validates that uploaded images contain a human face using mediapipe.
Used during registration and profile editing to prevent non-human image uploads.
"""

import io
import logging
from typing import Tuple
from PIL import Image

logger = logging.getLogger(__name__)

# Lazy-load mediapipe to avoid import errors if not installed
_face_detection = None
_mp_available = None


def _get_face_detector():
    """Lazy-initialize mediapipe face detector (singleton)."""
    global _face_detection, _mp_available

    if _mp_available is False:
        return None

    if _face_detection is not None:
        return _face_detection

    try:
        import mediapipe as mp
        from config import settings

        min_confidence = settings.face_detection_confidence or 0.5
        _face_detection = mp.solutions.face_detection.FaceDetection(
            model_selection=1,  # 1 = full-range model (better for varied distances)
            min_detection_confidence=min_confidence,
        )
        _mp_available = True
        logger.info(f"✅ Face detection initialized (confidence={min_confidence})")
        return _face_detection
    except ImportError:
        _mp_available = False
        logger.warning(
            "⚠️ mediapipe not installed – face detection disabled. "
            "Install with: pip install mediapipe"
        )
        return None
    except Exception as e:
        _mp_available = False
        logger.error(f"❌ Failed to initialize face detection: {e}")
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

    # Skip validation when feature is disabled
    if not settings.face_detection_enabled:
        return True, "Face detection disabled"

    detector = _get_face_detector()
    if detector is None:
        # If mediapipe isn't available, allow the upload (graceful degradation)
        return True, "Face detection unavailable – skipping check"

    try:
        # Open image with PIL and convert to RGB (mediapipe expects RGB numpy array)
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode != "RGB":
            img = img.convert("RGB")

        import numpy as np

        img_array = np.array(img)

        # Run face detection
        results = detector.process(img_array)

        if results.detections and len(results.detections) > 0:
            best_score = max(d.score[0] for d in results.detections)
            logger.debug(
                f"👤 Face detected (confidence={best_score:.2f}, "
                f"count={len(results.detections)})"
            )
            return True, f"Face detected (confidence={best_score:.2f})"

        logger.info("🚫 No human face detected in uploaded image")
        return False, (
            "No human face detected in this image. "
            "Please upload a clear photo of yourself."
        )

    except Exception as e:
        logger.error(f"❌ Face detection error: {e}", exc_info=True)
        # On error, allow the upload (don't block users due to bugs)
        return True, f"Face detection error – skipping check: {e}"


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
