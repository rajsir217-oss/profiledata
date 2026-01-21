"""
Profile Display Utilities

Shared utility functions for extracting and formatting user profile data
for display in emails, notifications, and UI components.

This module provides a single source of truth for:
- Education extraction (from educationHistory, education field, etc.)
- Occupation extraction (from workExperience, occupation field, etc.)
- Profile picture URL extraction (from imageVisibility, images, photos, etc.)
- Location formatting (from city/state)

Used by:
- daily_digest_template.py
- saved_search_matches_notifier.py
- Other email templates and notifiers
"""

from typing import Dict, Any, Optional
from config import Settings

settings = Settings()


def extract_profile_display_data(user: Dict[str, Any]) -> Dict[str, str]:
    """
    Extract display-friendly data from a user document.
    
    Args:
        user: MongoDB user document
        
    Returns:
        Dictionary with extracted display data:
        - education: Formatted education string
        - occupation: Formatted occupation string
        - profilePicture: Profile picture URL
        - location: Formatted location string
        - firstName: First name
        - lastName: Last name
        - displayName: Formatted display name (e.g., "John D.")
    """
    result = {
        "education": "",
        "occupation": "",
        "profilePicture": "",
        "location": "",
        "firstName": user.get("firstName", ""),
        "lastName": user.get("lastName", ""),
        "displayName": ""
    }
    
    # Build display name
    first_name = user.get("firstName", "")
    last_name = user.get("lastName", "")
    if first_name and last_name:
        result["displayName"] = f"{first_name} {last_name[0]}."
    elif first_name:
        result["displayName"] = first_name
    else:
        result["displayName"] = user.get("username", "User")
    
    # === EDUCATION ===
    result["education"] = extract_education(user)
    
    # === OCCUPATION ===
    result["occupation"] = extract_occupation(user)
    
    # === PROFILE PICTURE ===
    # Use default avatar if no picture found (for emails)
    result["profilePicture"] = extract_profile_picture(user, use_default_avatar=True)
    
    # === LOCATION ===
    result["location"] = extract_location(user)
    
    return result


def extract_education(user: Dict[str, Any]) -> str:
    """
    Extract education string from user document.
    
    Priority:
    1. educationHistory array (degree + institution)
    2. education field (string or array)
    3. highestEducation or educationLevel field
    """
    education = ""
    
    # 1. Check educationHistory array (primary field)
    edu_history = user.get('educationHistory', [])
    if isinstance(edu_history, list) and len(edu_history) > 0:
        first_edu = edu_history[0]
        if isinstance(first_edu, dict):
            degree = first_edu.get('degree') or first_edu.get('level') or ''
            institution = first_edu.get('institution') or ''
            if degree and institution:
                education = f"{degree} from {institution}"
            elif degree:
                education = degree
            elif institution:
                education = institution
    
    # 2. Fallback to education field (can be string or array)
    if not education and user.get('education'):
        edu_data = user['education']
        if isinstance(edu_data, str) and edu_data.strip():
            education = edu_data
        elif isinstance(edu_data, list) and len(edu_data) > 0:
            first_edu = edu_data[0]
            if isinstance(first_edu, dict):
                education = first_edu.get('degree') or first_edu.get('qualification') or first_edu.get('level', '')
            elif isinstance(first_edu, str):
                education = first_edu
    
    # 3. Fallback to highestEducation or educationLevel
    if not education:
        education = user.get('highestEducation') or user.get('educationLevel') or ''
    
    return education


def extract_occupation(user: Dict[str, Any]) -> str:
    """
    Extract occupation string from user document.
    
    Priority:
    1. occupation field (string)
    2. workExperience array (current job first, then first entry)
       - jobTitle/title/position + company/employer
       - Fallback to description (truncated)
    """
    occupation = user.get('occupation')
    
    if not occupation:
        # Check workExperience array for current job
        work_exp = user.get('workExperience', [])
        if isinstance(work_exp, list) and len(work_exp) > 0:
            # Find current job (isCurrent=True or status='current') or use the first entry
            current_job = None
            for job in work_exp:
                if isinstance(job, dict) and (job.get('isCurrent') or job.get('status') == 'current'):
                    current_job = job
                    break
            if not current_job and work_exp:
                current_job = work_exp[0] if isinstance(work_exp[0], dict) else None
            
            if current_job:
                job_title = current_job.get('jobTitle') or current_job.get('title') or current_job.get('position')
                company = current_job.get('company') or current_job.get('employer')
                if job_title:
                    occupation = f"{job_title}" + (f" at {company}" if company else "")
                elif current_job.get('description'):
                    # Fallback to description, truncate to first 50 chars
                    desc = current_job.get('description', '')
                    occupation = desc[:50] + "..." if len(desc) > 50 else desc
    
    return occupation or ""


def extract_profile_picture(
    user: Dict[str, Any], 
    convert_to_public_url: bool = False,
    use_default_avatar: bool = False
) -> str:
    """
    Extract profile picture URL from user document.
    
    Priority:
    1. imageVisibility.profilePic (new 3-bucket system)
    2. images array (first image)
    3. photos array (legacy)
    4. profilePhoto/profilePicture/photoUrl field
    5. Default avatar (if use_default_avatar=True)
    
    Args:
        user: MongoDB user document
        convert_to_public_url: If True, convert relative paths to full GCS URLs
        use_default_avatar: If True, return a default avatar URL when no picture found
    """
    profile_photo_url = ''
    
    # 1. Check imageVisibility.profilePic (new 3-bucket system)
    image_visibility = user.get('imageVisibility', {})
    if image_visibility and image_visibility.get('profilePic'):
        profile_photo_url = image_visibility['profilePic']
    
    # 2. Fallback to images array (main storage)
    if not profile_photo_url:
        images = user.get('images', [])
        if images and isinstance(images, list) and len(images) > 0:
            first_image = images[0]
            if isinstance(first_image, str):
                profile_photo_url = first_image
            elif isinstance(first_image, dict):
                profile_photo_url = first_image.get('url', first_image.get('path', ''))
    
    # 3. Fallback to photos array (legacy)
    if not profile_photo_url:
        photos = user.get('photos', [])
        if photos and isinstance(photos, list) and len(photos) > 0:
            first_photo = photos[0]
            if isinstance(first_photo, dict):
                profile_photo_url = first_photo.get('url', first_photo.get('thumbnail', ''))
            elif isinstance(first_photo, str):
                profile_photo_url = first_photo
    
    # 4. Fallback to profilePhoto/profilePicture field
    if not profile_photo_url:
        profile_photo_url = user.get('profilePhoto') or user.get('profilePicture') or user.get('photoUrl', '')
    
    # Convert to public URL if requested (for emails)
    if convert_to_public_url and profile_photo_url:
        profile_photo_url = convert_to_gcs_url(profile_photo_url)
    
    # Generate default avatar if no picture found and requested
    if not profile_photo_url and use_default_avatar:
        first_name = user.get('firstName', '')
        last_name = user.get('lastName', '')
        name = f"{first_name} {last_name}".strip() or user.get('username', 'User')
        # Use ui-avatars.com for a nice avatar with initials
        import urllib.parse
        encoded_name = urllib.parse.quote(name)
        profile_photo_url = f"https://ui-avatars.com/api/?name={encoded_name}&background=667eea&color=fff&size=80&bold=true"
    
    return profile_photo_url


def extract_location(user: Dict[str, Any]) -> str:
    """
    Extract location string from user document.
    
    Uses city and state fields (not encrypted location field).
    """
    location_parts = []
    if user.get("city"):
        location_parts.append(user.get("city"))
    if user.get("state"):
        location_parts.append(user.get("state"))
    return ", ".join(location_parts) if location_parts else ""


def convert_to_gcs_url(url: str) -> str:
    """
    Convert relative image paths to full GCS bucket URLs.
    
    For emails, images must be publicly accessible.
    """
    if not url:
        return ""
    
    # Already a full URL
    if url.startswith('http://') or url.startswith('https://'):
        return url
    
    # Convert relative path to GCS URL
    gcs_bucket = getattr(settings, 'gcs_bucket_name', 'matrimonial-uploads-matrimonial-staging')
    
    # Remove leading slash if present
    if url.startswith('/'):
        url = url[1:]
    
    return f"https://storage.googleapis.com/{gcs_bucket}/{url}"


def render_profile_card_html(
    profile_data: Dict[str, str],
    style: str = "default",
    show_education: bool = True,
    show_occupation: bool = True,
    show_location: bool = True,
    profile_url: Optional[str] = None
) -> str:
    """
    Render an HTML profile card for emails.
    
    Args:
        profile_data: Dictionary from extract_profile_display_data()
        style: Card style ("default", "compact", "minimal")
        show_education: Whether to show education
        show_occupation: Whether to show occupation
        show_location: Whether to show location
        profile_url: URL to link to the profile
        
    Returns:
        HTML string for the profile card
    """
    name = profile_data.get("displayName", "User")
    education = profile_data.get("education", "")
    occupation = profile_data.get("occupation", "")
    location = profile_data.get("location", "")
    profile_pic = profile_data.get("profilePicture", "")
    
    # Default avatar if no profile picture
    if not profile_pic:
        profile_pic = "https://storage.googleapis.com/matrimonial-uploads-matrimonial-staging/default-avatar.png"
    
    # Build optional detail rows
    education_html = ""
    if show_education and education:
        education_html = f'''
        <div style="display: flex; align-items: center; font-size: 14px; color: #4a5568; margin-bottom: 6px;">
            <span style="margin-right: 8px;">🎓</span>
            <span>{education}</span>
        </div>
        '''
    
    occupation_html = ""
    if show_occupation and occupation:
        occupation_html = f'''
        <div style="display: flex; align-items: center; font-size: 14px; color: #4a5568; margin-bottom: 6px;">
            <span style="margin-right: 8px;">💼</span>
            <span>{occupation}</span>
        </div>
        '''
    
    location_html = ""
    if show_location and location:
        location_html = f'''
        <div style="display: flex; align-items: center; font-size: 14px; color: #4a5568; margin-bottom: 6px;">
            <span style="margin-right: 8px;">📍</span>
            <span>{location}</span>
        </div>
        '''
    
    # Profile link
    profile_link_html = ""
    if profile_url:
        profile_link_html = f'''
        <a href="{profile_url}" style="display: inline-block; color: #667eea; text-decoration: none; font-weight: 500; font-size: 14px; margin-top: 8px;">View Full Profile →</a>
        '''
    
    # Render based on style
    if style == "compact":
        return f'''
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: #f8f9fa; border-radius: 8px; margin-bottom: 10px;">
            <img src="{profile_pic}" alt="{name}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;" />
            <div>
                <strong style="color: #1a202c;">{name}</strong>
                {f'<span style="color: #718096; font-size: 13px;"> • {location}</span>' if location else ''}
            </div>
        </div>
        '''
    
    elif style == "minimal":
        return f'''
        <div style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
            <strong>{name}</strong>
            {f' - {occupation}' if occupation else ''}
            {f' ({location})' if location else ''}
        </div>
        '''
    
    # Default style
    return f'''
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); display: flex; gap: 20px;">
        <div style="flex-shrink: 0;">
            <img src="{profile_pic}" alt="{name}" style="width: 80px; height: 80px; border-radius: 12px; object-fit: cover; border: 3px solid #667eea;" />
        </div>
        <div style="flex: 1; padding-left: 5px;">
            <h3 style="font-size: 18px; font-weight: 700; color: #1a202c; margin: 0 0 8px 0;">{name}</h3>
            <div style="margin-bottom: 8px;">
                {location_html}
                {education_html}
                {occupation_html}
            </div>
            {profile_link_html}
        </div>
    </div>
    '''
