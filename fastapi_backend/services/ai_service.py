"""
AI Service - Multi-provider AI Integration for text rephrasing

Supports:
- Groq (Very Fast, Free Tier) - https://console.groq.com
- Gemini (Google, Free Tier) - https://aistudio.google.com

Used to rephrase About Me text for matrimonial profiles.
"""

import logging
import httpx
from typing import Optional
from config import settings

logger = logging.getLogger(__name__)

# API URLs
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"


def get_active_provider() -> tuple[str, str]:
    """
    Determine which AI provider to use based on config and available keys.
    Returns (provider_name, api_key) or (None, None) if none configured.
    """
    preferred = (settings.ai_provider or "groq").lower()
    
    # Try preferred provider first
    if preferred == "groq" and settings.groq_api_key:
        return "groq", settings.groq_api_key
    elif preferred == "gemini" and settings.gemini_api_key:
        return "gemini", settings.gemini_api_key
    
    # Fallback to any available provider
    if settings.groq_api_key:
        return "groq", settings.groq_api_key
    if settings.gemini_api_key:
        return "gemini", settings.gemini_api_key
    
    return None, None


def build_prompt(text: str, style: str) -> str:
    """Build the prompt for rephrasing."""
    style_instructions = {
        "concise": "Tighten the writing by removing redundant phrases and filler words, but KEEP ALL the content and information. Make every sentence impactful. Do NOT shorten significantly - just make it sharper.",
        "warm": "Make it warm, friendly, and approachable.",
        "professional": "Make it polished and professional while still being personable.",
        "casual": "Make it relaxed and conversational, like talking to a friend."
    }
    
    style_note = style_instructions.get(style, style_instructions["warm"])
    
    # Different length guidance for concise vs other styles
    length_guidance = "Keep the same approximate length (within 20% of original)." if style != "concise" else "Keep at least 80% of the original length - do NOT drastically shorten."
    
    return f"""You are a professional writer helping someone improve their matrimonial profile's "About Me" section.

Rephrase the following text to make it more engaging and personable while keeping all the factual information intact.
{style_note}
{length_guidance}
Do not add any new information that wasn't in the original.
Do not use clichés like "looking for my soulmate" or "partner in crime".
Write in first person.
Return ONLY the rephrased text, no explanations or quotes.

Original text:
{text}

Rephrased version:"""


async def rephrase_with_groq(text: str, prompt: str, api_key: str) -> dict:
    """Rephrase using Groq API (OpenAI-compatible, very fast)."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                GROQ_API_URL,
                json={
                    "model": "llama-3.1-8b-instant",  # Fast and free
                    "messages": [
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 4096
                },
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                rephrased = data["choices"][0]["message"]["content"].strip()
                
                # Remove quotes if wrapped
                if rephrased.startswith('"') and rephrased.endswith('"'):
                    rephrased = rephrased[1:-1]
                
                logger.info(f"[Groq] Successfully rephrased ({len(text)} -> {len(rephrased)} chars)")
                return {
                    "success": True,
                    "rephrased_text": rephrased,
                    "provider": "groq",
                    "original_length": len(text),
                    "new_length": len(rephrased)
                }
            
            elif response.status_code == 429:
                logger.warning("Groq API rate limit exceeded")
                return {"success": False, "error": "AI service is busy. Please try again in a minute."}
            
            else:
                logger.error(f"Groq API error: {response.status_code} - {response.text}")
                return {"success": False, "error": f"AI service error ({response.status_code})."}
                
    except httpx.TimeoutException:
        return {"success": False, "error": "AI service timed out. Please try again."}
    except Exception as e:
        logger.error(f"Groq API exception: {e}", exc_info=True)
        return {"success": False, "error": "An unexpected error occurred."}


async def rephrase_with_gemini(text: str, prompt: str, api_key: str) -> dict:
    """Rephrase using Google Gemini API."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{GEMINI_API_URL}?key={api_key}",
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.7,
                        "maxOutputTokens": 4096,
                        "topP": 0.9,
                        "thinkingConfig": {
                            "thinkingBudget": 0
                        }
                    }
                },
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                rephrased = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                
                # Remove quotes if wrapped
                if rephrased.startswith('"') and rephrased.endswith('"'):
                    rephrased = rephrased[1:-1]
                
                logger.info(f"[Gemini] Successfully rephrased ({len(text)} -> {len(rephrased)} chars)")
                return {
                    "success": True,
                    "rephrased_text": rephrased,
                    "provider": "gemini",
                    "original_length": len(text),
                    "new_length": len(rephrased)
                }
            
            elif response.status_code == 429:
                logger.warning("Gemini API rate limit exceeded")
                return {"success": False, "error": "AI service is busy. Please try again in a minute."}
            
            else:
                logger.error(f"Gemini API error: {response.status_code} - {response.text}")
                return {"success": False, "error": f"AI service error ({response.status_code})."}
                
    except httpx.TimeoutException:
        return {"success": False, "error": "AI service timed out. Please try again."}
    except Exception as e:
        logger.error(f"Gemini API exception: {e}", exc_info=True)
        return {"success": False, "error": "An unexpected error occurred."}


async def rephrase_about_me(text: str, style: str = "warm", requested_provider: str = None) -> dict:
    """
    Rephrase About Me text using configured AI provider.
    
    Args:
        text: The original About Me text
        style: Style of rephrasing - "warm", "professional", "casual"
        requested_provider: Optional provider override - "groq" or "gemini"
        
    Returns:
        dict with "success", "rephrased_text", "provider" or "error"
    """
    # If user requested a specific provider, try to use it
    if requested_provider:
        if requested_provider == "groq" and settings.groq_api_key:
            provider, api_key = "groq", settings.groq_api_key
        elif requested_provider == "gemini" and settings.gemini_api_key:
            provider, api_key = "gemini", settings.gemini_api_key
        else:
            # Requested provider not available, fall back to default
            provider, api_key = get_active_provider()
            if provider:
                logger.warning(f"Requested provider '{requested_provider}' not available, using '{provider}'")
    else:
        provider, api_key = get_active_provider()
    
    if not provider:
        logger.warning("No AI provider configured")
        return {
            "success": False,
            "error": "AI service not configured. Please contact support."
        }
    
    if not text or len(text.strip()) < 20:
        return {
            "success": False,
            "error": "Text is too short to rephrase. Please provide at least 20 characters."
        }
    
    prompt = build_prompt(text, style)
    logger.info(f"🤖 Using AI provider: {provider}")
    
    if provider == "groq":
        return await rephrase_with_groq(text, prompt, api_key)
    else:
        return await rephrase_with_gemini(text, prompt, api_key)
