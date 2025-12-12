"""
AI Router - Endpoints for AI-powered features

Provides endpoints for:
- Rephrasing About Me text using Gemini API
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from auth.jwt_auth import get_current_user_dependency as get_current_user
from services.ai_service import rephrase_about_me

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["AI"])


class RephraseRequest(BaseModel):
    """Request model for text rephrasing"""
    text: str = Field(..., min_length=20, max_length=5000, description="Text to rephrase")
    style: Optional[str] = Field("warm", description="Style: warm, professional, casual")
    provider: Optional[str] = Field(None, description="AI provider: groq, gemini (optional, uses default if not specified)")


class RephraseResponse(BaseModel):
    """Response model for text rephrasing"""
    success: bool
    rephrased_text: Optional[str] = None
    provider: Optional[str] = None
    original_length: Optional[int] = None
    new_length: Optional[int] = None
    error: Optional[str] = None


@router.post("/rephrase", response_model=RephraseResponse)
async def rephrase_text(
    request: RephraseRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Rephrase About Me text using AI (Gemini)
    
    Styles available:
    - warm: Friendly and approachable (default)
    - professional: Polished and refined
    - casual: Relaxed and conversational
    """
    username = current_user.get("username", "unknown")
    logger.info(f"🤖 AI rephrase request from user '{username}' (style: {request.style}, provider: {request.provider})")
    
    # Validate style
    valid_styles = ["concise", "warm", "professional", "casual"]
    style = request.style.lower() if request.style else "warm"
    if style not in valid_styles:
        style = "warm"
    
    # Validate provider (optional - if specified, use it)
    provider = None
    if request.provider:
        valid_providers = ["groq", "gemini"]
        provider = request.provider.lower()
        if provider not in valid_providers:
            provider = None
    
    # Call AI service with optional provider override
    result = await rephrase_about_me(request.text, style, provider)
    
    if result["success"]:
        logger.info(f"✅ AI rephrase successful for user '{username}'")
    else:
        logger.warning(f"⚠️ AI rephrase failed for user '{username}': {result.get('error')}")
    
    return RephraseResponse(**result)


@router.get("/status")
async def ai_status(current_user: dict = Depends(get_current_user)):
    """Check if AI service is configured and available"""
    from config import settings
    from services.ai_service import get_active_provider
    
    provider, _ = get_active_provider()
    is_configured = provider is not None
    
    return {
        "configured": is_configured,
        "provider": provider,
        "preferred_provider": settings.ai_provider,
        "available_providers": {
            "groq": bool(settings.groq_api_key),
            "gemini": bool(settings.gemini_api_key)
        },
        "features": ["rephrase"] if is_configured else []
    }
