"""
Face Detection Service
Validates that uploaded images contain a human face.

Strategy (in priority order):
  1. Google Cloud Vision API  – REST call via httpx + google-auth
     Works on Cloud Run (ADC) and locally with GOOGLE_APPLICATION_CREDENTIALS.
  2. OpenCV Haar cascades     – offline fallback when Vision API is unavailable
  3. If BOTH fail             – REJECT the upload (no silent pass-through)
"""

import base64
import io
import logging
from typing import Tuple

from PIL import Image

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Google Cloud Vision API (primary)
# ---------------------------------------------------------------------------
_vision_available = None   # None = not checked, True/False after first call
_gcp_credentials = None
_gcp_project = None


def _init_vision():
    """Try to obtain GCP credentials for the Vision API."""
    global _vision_available, _gcp_credentials, _gcp_project

    if _vision_available is not None:
        return _vision_available

    try:
        import google.auth
        from google.auth.transport.requests import Request

        credentials, project = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-vision"]
        )
        credentials.refresh(Request())

        _gcp_credentials = credentials
        _gcp_project = project
        _vision_available = True
        logger.info("✅ Google Cloud Vision API credentials obtained")
        return True

    except Exception as e:
        _vision_available = False
        logger.warning(f"⚠️ Google Cloud Vision API unavailable: {e}")
        return False


def _detect_face_vision(image_bytes: bytes) -> Tuple[bool, str]:
    """
    Call the Vision API REST endpoint to detect faces.

    Uses httpx (already a project dependency) instead of the heavy
    google-cloud-vision SDK.
    """
    import httpx

    if not _init_vision():
        return None, "Vision API not available"

    try:
        from google.auth.transport.requests import Request
        _gcp_credentials.refresh(Request())

        # Resize to max 1024px before sending (reduces latency & cost)
        img = Image.open(io.BytesIO(image_bytes))
        max_dim = 1024
        if img.width > max_dim or img.height > max_dim:
            ratio = min(max_dim / img.width, max_dim / img.height)
            img = img.resize(
                (int(img.width * ratio), int(img.height * ratio)),
                Image.LANCZOS,
            )
        buf = io.BytesIO()
        img_format = "JPEG"
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        img.save(buf, format=img_format, quality=80)
        b64_image = base64.b64encode(buf.getvalue()).decode("utf-8")

        payload = {
            "requests": [
                {
                    "image": {"content": b64_image},
                    "features": [{"type": "FACE_DETECTION", "maxResults": 5}],
                }
            ]
        }

        resp = httpx.post(
            "https://vision.googleapis.com/v1/images:annotate",
            headers={
                "Authorization": f"Bearer {_gcp_credentials.token}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=15.0,
        )

        if resp.status_code != 200:
            logger.error(f"❌ Vision API HTTP {resp.status_code}: {resp.text[:300]}")
            return None, f"Vision API error (HTTP {resp.status_code})"

        data = resp.json()
        annotations = (
            data.get("responses", [{}])[0].get("faceAnnotations") or []
        )

        if annotations:
            from config import settings
            min_confidence = getattr(settings, "face_detection_confidence", 0.7)

            # Vision API returns detection_confidence (0.0–1.0)
            # and likelihoodName values like VERY_LIKELY, LIKELY, POSSIBLE, etc.
            confident_faces = []
            for ann in annotations:
                confidence = ann.get("detectionConfidence", 0)
                if confidence >= min_confidence:
                    confident_faces.append(confidence)

            if confident_faces:
                best = max(confident_faces)
                logger.info(
                    f"👤 Vision API: {len(confident_faces)} face(s) detected "
                    f"(best confidence: {best:.2f})"
                )
                return True, (
                    f"Face detected ({len(confident_faces)} face(s), "
                    f"confidence {best:.0%})"
                )
            else:
                # Faces found but below confidence threshold
                logger.info(
                    f"🚫 Vision API: {len(annotations)} face(s) found but "
                    f"below confidence threshold ({min_confidence})"
                )
                return False, (
                    "No clear human face detected in this image. "
                    "Please upload a clear photo of yourself."
                )
        else:
            logger.info("🚫 Vision API: No faces detected in image")
            return False, (
                "No human face detected in this image. "
                "Please upload a clear photo of yourself."
            )

    except Exception as e:
        logger.error(f"❌ Vision API call failed: {e}", exc_info=True)
        return None, f"Vision API error: {e}"


# ---------------------------------------------------------------------------
# OpenCV Haar cascades (fallback)
# ---------------------------------------------------------------------------
_detectors = None
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
        logger.info("✅ OpenCV face detection initialized (frontal + profile cascades)")
        return _detectors

    except ImportError as e:
        _cv2_available = False
        logger.warning(
            f"⚠️ opencv-python-headless not available: {e}"
        )
        return None
    except Exception as e:
        _cv2_available = False
        logger.error(f"❌ Failed to initialize OpenCV face detection: {e}", exc_info=True)
        return None


def _detect_faces_cv(cascade, gray):
    """Run detectMultiScale with strict settings to minimise false positives."""
    import cv2
    return cascade.detectMultiScale(
        gray,
        scaleFactor=1.05,
        minNeighbors=8,
        minSize=(80, 80),
        flags=cv2.CASCADE_SCALE_IMAGE,
    )


def _detect_face_opencv(image_bytes: bytes) -> Tuple[bool, str]:
    """Attempt face detection with OpenCV Haar cascades."""
    detectors = _get_detectors()
    if detectors is None:
        return None, "OpenCV not available"

    try:
        import cv2
        import numpy as np

        img = Image.open(io.BytesIO(image_bytes))
        if img.mode != "RGB":
            img = img.convert("RGB")

        img_array = np.array(img)
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)

        # Pass 1: frontal face cascade
        faces = _detect_faces_cv(detectors["frontal"], gray)
        if len(faces) > 0:
            logger.debug(f"👤 OpenCV frontal face detected: {len(faces)} face(s)")
            return True, f"Face detected ({len(faces)} face(s) found)"

        # Pass 2: profile face cascade (side-facing portraits)
        if detectors["profile"] is not None:
            profile_faces = _detect_faces_cv(detectors["profile"], gray)
            if len(profile_faces) > 0:
                logger.debug(f"👤 OpenCV profile face detected: {len(profile_faces)} face(s)")
                return True, f"Face detected ({len(profile_faces)} profile face(s) found)"

            # Also check horizontally flipped image for profile faces
            flipped = cv2.flip(gray, 1)
            profile_flipped = _detect_faces_cv(detectors["profile"], flipped)
            if len(profile_flipped) > 0:
                logger.debug(f"👤 OpenCV profile face detected (flipped): {len(profile_flipped)} face(s)")
                return True, f"Face detected ({len(profile_flipped)} profile face(s) found)"

        logger.info("🚫 OpenCV: No human face detected in uploaded image")
        return False, (
            "No human face detected in this image. "
            "Please upload a clear photo of yourself."
        )

    except Exception as e:
        logger.error(f"❌ OpenCV face detection error: {e}", exc_info=True)
        return None, f"OpenCV error: {e}"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def validate_human_image(image_bytes: bytes) -> Tuple[bool, str]:
    """
    Check whether *image_bytes* contain at least one human face.

    Strategy:
      1. Try Google Cloud Vision API (most reliable)
      2. Fall back to OpenCV Haar cascades
      3. If both unavailable → REJECT (no silent pass-through)

    Returns:
        (is_valid, message)
        - (True, "...")  when a face is found
        - (False, "...") when no face is detected or an error occurs
    """
    from config import settings

    if not settings.face_detection_enabled:
        return True, "Face detection disabled"

    # --- Strategy 1: Google Cloud Vision API ---
    result, message = _detect_face_vision(image_bytes)
    if result is not None:
        # Got a definitive answer (True or False)
        return result, message
    logger.warning(f"⚠️ Vision API inconclusive ({message}), trying OpenCV fallback...")

    # --- Strategy 2: OpenCV Haar cascades ---
    result, message = _detect_face_opencv(image_bytes)
    if result is not None:
        return result, message
    logger.warning(f"⚠️ OpenCV also unavailable ({message})")

    # --- Strategy 3: Both unavailable → REJECT ---
    logger.error("❌ No face detection backend available – rejecting upload")
    return False, (
        "Face detection is temporarily unavailable. "
        "Please try again in a few minutes or contact support."
    )


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
