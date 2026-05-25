from fastapi import APIRouter, Depends, HTTPException
from config import settings
from auth.jwt_auth import get_current_user_dependency as get_current_user

router = APIRouter(prefix="/api/mobile", tags=["mobile"])


@router.get("/android/apk-url")
async def get_android_apk_url(current_user: dict = Depends(get_current_user)):
    apk_bucket_name = (settings.android_apk_gcs_bucket_name or settings.gcs_bucket_name or "").strip()
    if not apk_bucket_name:
        raise HTTPException(
            status_code=404,
            detail="Android APK download is not configured (missing ANDROID_APK_GCS_BUCKET_NAME or GCS_BUCKET_NAME)",
        )

    gcs_object = (settings.android_apk_gcs_object or "").strip().lstrip("/")
    if not gcs_object:
        raise HTTPException(
            status_code=404,
            detail="Android APK download is not configured (missing ANDROID_APK_GCS_OBJECT)",
        )

    if "/" not in gcs_object:
        raise HTTPException(status_code=500, detail="Android APK configuration is invalid")

    folder, filename = gcs_object.rsplit("/", 1)
    if not folder or not filename:
        raise HTTPException(status_code=500, detail="Android APK configuration is invalid")

    from services.storage_service import StorageService, get_storage_service

    storage = None
    if settings.use_gcs:
        try:
            storage = get_storage_service()
        except Exception:
            storage = None

    if storage is None or not getattr(storage, "use_gcs", False):
        storage = StorageService(use_gcs=True, bucket_name=apk_bucket_name)

    if not storage.use_gcs:
        raise HTTPException(
            status_code=500,
            detail="GCS is not available to generate APK download URL (check credentials and bucket permissions)",
        )

    signed_url = storage.generate_signed_url(
        filename=filename,
        folder=folder,
        expiration_minutes=settings.android_apk_signed_url_expiration_minutes,
        bucket_name=apk_bucket_name,
    )

    if not signed_url:
        raise HTTPException(status_code=500, detail="Failed to generate download URL")

    return {"url": signed_url}
