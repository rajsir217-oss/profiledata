"""
WhatsApp Group Verification Router
Handles verification of WhatsApp group members against registered users
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any, Optional
import csv
import io
import phonenumbers
from pymongo import MongoClient
from auth.jwt_auth import get_current_user_dependency as get_current_user
from config import Settings

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp_verification"])

settings = Settings()

def normalize_phone_number(phone: str) -> Optional[str]:
    """Normalize phone number to standard format"""
    if not phone:
        return None
    
    try:
        # Remove all non-numeric characters
        phone = ''.join(filter(str.isdigit, phone))
        
        # Parse with phonenumbers library
        parsed = phonenumbers.parse(phone, "US")
        
        # Format to E.164 standard
        if phonenumbers.is_valid_number(parsed):
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
        
        return None
    except:
        # Fallback: if it starts with country code, keep as is
        if len(phone) >= 10 and phone.startswith('1'):
            return f"+{phone}"
        return None

@router.get("/export-registered")
async def export_registered_numbers(current_user: dict = Depends(get_current_user)):
    """Export all registered phone numbers as CSV"""
    # Check if admin
    if current_user.get("username") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    from database import get_database
    db = get_database()
    
    try:
        # Get all users with phone numbers
        users = await db.users.find(
            {"contactNumber": {"$exists": True, "$ne": None, "$ne": ""}},
            {"username": 1, "firstName": 1, "lastName": 1, "contactNumber": 1, "accountStatus": 1}
        ).to_list(None)
        
        # Create CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow(["Username", "Full Name", "Phone Number", "Status", "Normalized Phone"])
        
        # Data rows
        for user in users:
            phone = user.get("contactNumber", "")
            normalized = normalize_phone_number(phone)
            full_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
            status = user.get("accountStatus", "unknown")
            
            writer.writerow([
                user.get("username", ""),
                full_name,
                phone,
                status,
                normalized or "INVALID"
            ])
        
        # Prepare response
        output.seek(0)
        
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode('utf-8')),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=registered_numbers.csv"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

@router.post("/compare-group")
async def compare_whatsapp_group(
    group_file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Compare WhatsApp group export with registered users"""
    # Check if admin
    if current_user.get("username") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    from database import get_database
    db = get_database()
    
    try:
        # Read uploaded file
        content = await group_file.read()
        
        # Parse CSV (assuming format: name, phone)
        group_members = []
        if group_file.filename.endswith('.csv'):
            content_str = content.decode('utf-8')
            csv_reader = csv.DictReader(io.StringIO(content_str))
            
            for row in csv_reader:
                # Try different column names for phone
                phone = row.get('Phone') or row.get('phone') or row.get('Contact') or row.get('contact') or row.get('Number') or row.get('number')
                name = row.get('Name') or row.get('name') or row.get('Member') or row.get('member')
                
                if phone:
                    normalized = normalize_phone_number(phone)
                    if normalized:
                        group_members.append({
                            'name': name or 'Unknown',
                            'phone': phone,
                            'normalized_phone': normalized
                        })
        
        # Get registered users
        registered_users = await db.users.find(
            {"contactNumber": {"$exists": True, "$ne": None, "$ne": ""}},
            {"username": 1, "firstName": 1, "lastName": 1, "contactNumber": 1, "accountStatus": 1}
        ).to_list(None)
        
        # Normalize registered phones
        registered_phones = {}
        for user in registered_users:
            phone = user.get("contactNumber", "")
            normalized = normalize_phone_number(phone)
            if normalized:
                registered_phones[normalized] = {
                    'username': user.get("username", ""),
                    'full_name': f"{user.get('firstName', '')} {user.get('lastName', '')}".strip(),
                    'original_phone': phone,
                    'status': user.get("accountStatus", "unknown")
                }
        
        # Compare
        group_phones = {member['normalized_phone']: member for member in group_members}
        
        # Find unauthorized members (in group but not registered)
        unauthorized = []
        for phone, member in group_phones.items():
            if phone not in registered_phones:
                unauthorized.append(member)
        
        # Find registered users not in group
        not_in_group = []
        for phone, user in registered_phones.items():
            if phone not in group_phones:
                not_in_group.append(user)
        
        # Find verified members (in both)
        verified = []
        for phone, member in group_phones.items():
            if phone in registered_phones:
                verified.append({
                    **member,
                    'registered_user': registered_phones[phone]
                })
        
        return {
            "summary": {
                "total_group_members": len(group_members),
                "total_registered_users": len(registered_users),
                "verified_count": len(verified),
                "unauthorized_count": len(unauthorized),
                "not_in_group_count": len(not_in_group)
            },
            "verified_members": verified,
            "unauthorized_members": unauthorized,
            "registered_not_in_group": not_in_group,
            "verification_rate": round((len(verified) / len(group_members) * 100), 1) if group_members else 0
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison failed: {str(e)}")

@router.get("/verification-stats")
async def get_verification_stats(current_user: dict = Depends(get_current_user)):
    """Get current verification statistics"""
    # Check if admin
    if current_user.get("username") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    from database import get_database
    db = get_database()
    
    try:
        # Get stats
        total_users = await db.users.count_documents({})
        users_with_phone = await db.users.count_documents({
            "contactNumber": {"$exists": True, "$ne": None, "$ne": ""}
        })
        
        active_users = await db.users.count_documents({"accountStatus": "active"})
        
        return {
            "total_registered_users": total_users,
            "users_with_phone": users_with_phone,
            "active_users": active_users,
            "phone_coverage": round((users_with_phone / total_users * 100), 1) if total_users > 0 else 0
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stats failed: {str(e)}")
