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
    """Export all registered phone numbers as CSV (includes all contactNumbers entries)"""
    # Check if admin
    if current_user.get("role_name") != "admin" and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    from database import get_database
    db = get_database()
    
    try:
        from crypto_utils import get_encryptor
        encryptor = get_encryptor()
        
        # Get all users with phone numbers (either contactNumber or contactNumbers array)
        users = await db.users.find(
            {"$or": [
                {"contactNumber": {"$exists": True, "$ne": None, "$ne": ""}},
                {"contactNumbers": {"$exists": True, "$ne": None, "$ne": []}}
            ]},
            {"username": 1, "firstName": 1, "lastName": 1, "contactNumber": 1, "contactNumbers": 1, "accountStatus": 1}
        ).to_list(None)
        
        # Decrypt PII fields before export
        for i, user in enumerate(users):
            try:
                users[i] = encryptor.decrypt_user_pii(user)
            except Exception as decrypt_err:
                pass  # Use as-is if decryption fails
        
        # Create CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow(["Username", "Full Name", "Phone Number", "Label", "Visible", "Status", "Normalized Phone"])
        
        # Data rows - expand contactNumbers array into individual rows
        for user in users:
            full_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
            status = user.get("accountStatus", "unknown")
            username = user.get("username", "")
            
            contact_numbers = user.get("contactNumbers")
            if contact_numbers and isinstance(contact_numbers, list) and len(contact_numbers) > 0:
                # Write one row per contactNumbers entry
                for entry in contact_numbers:
                    if isinstance(entry, dict):
                        phone = entry.get("number", "")
                        label = entry.get("label", "primary")
                        visible = "Yes" if entry.get("visible", True) else "No"
                        normalized = normalize_phone_number(phone) if phone else None
                        writer.writerow([username, full_name, phone, label, visible, status, normalized or "INVALID"])
            else:
                # Fallback: single contactNumber for old profiles
                phone = user.get("contactNumber", "")
                normalized = normalize_phone_number(phone)
                writer.writerow([username, full_name, phone, "primary", "Yes", status, normalized or "INVALID"])
        
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
    if current_user.get("role_name") != "admin" and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    from database import get_database
    db = get_database()
    
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Read uploaded file
        content = await group_file.read()
        content_str = content.decode('utf-8-sig', errors='replace')
        
        # Parse file - support CSV and plain text formats
        group_members = []
        raw_lines = content_str.strip().splitlines()
        logger.info(f"📱 WhatsApp compare: file={group_file.filename}, lines={len(raw_lines)}")
        
        parsed_as_csv = False
        if group_file.filename.endswith('.csv'):
            try:
                csv_reader = csv.DictReader(io.StringIO(content_str))
                fieldnames = csv_reader.fieldnames or []
                logger.info(f"📱 CSV columns detected: {fieldnames}")
                
                # Try different column names for phone
                phone_cols = ['Phone', 'phone', 'Phone Number', 'phone number', 'Contact', 'contact', 
                              'Number', 'number', 'Mobile', 'mobile', 'Tel', 'tel', 'WhatsApp Number',
                              'Phone number', 'PHONE', 'MOBILE', 'NUMBER']
                name_cols = ['Public Display Name', 'Saved Name', 'Name', 'name', 'Display Name',
                             'Member', 'member', 'display name', 'Contact Name', 'NAME', 'MEMBER']
                
                # Find matching column names
                phone_col = next((c for c in phone_cols if c in fieldnames), None)
                name_col = next((c for c in name_cols if c in fieldnames), None)
                
                # If no known phone column, try first column that looks like it has phone data
                if not phone_col and fieldnames:
                    # Read first row to check which column has phone-like data
                    csv_reader2 = csv.DictReader(io.StringIO(content_str))
                    for test_row in csv_reader2:
                        for col_name, col_val in test_row.items():
                            if col_val and any(c.isdigit() for c in col_val) and sum(c.isdigit() for c in col_val) >= 7:
                                phone_col = col_name
                                break
                        break
                
                logger.info(f"📱 Using columns: phone={phone_col}, name={name_col}")
                
                # Collect all available name columns for fallback
                all_name_cols = [c for c in name_cols if c in fieldnames]
                
                if phone_col:
                    for row in csv_reader:
                        phone = row.get(phone_col, '').strip()
                        # Try each name column until we find a non-empty value
                        name = 'Unknown'
                        for nc in all_name_cols:
                            val = (row.get(nc) or '').strip()
                            if val and val != "'":
                                name = val
                                break
                        
                        if phone:
                            normalized = normalize_phone_number(phone)
                            if normalized:
                                group_members.append({
                                    'name': name or 'Unknown',
                                    'phone': phone,
                                    'normalized_phone': normalized
                                })
                    parsed_as_csv = True
            except Exception as csv_err:
                logger.warning(f"📱 CSV parsing failed: {csv_err}, falling back to line-by-line")
        
        # Fallback: parse as plain text (one phone number per line)
        if not parsed_as_csv or not group_members:
            logger.info(f"📱 Parsing as plain text, {len(raw_lines)} lines")
            for line in raw_lines:
                line = line.strip()
                if not line:
                    continue
                # Extract phone-like content (digits, +, spaces, dashes, parens)
                # Could be "John Doe +1234567890" or just "+1234567890" or "1234567890"
                import re
                phone_match = re.search(r'[\+]?[\d\s\-\(\)]{7,}', line)
                if phone_match:
                    phone = phone_match.group().strip()
                    # Name is everything before the phone number
                    name_part = line[:phone_match.start()].strip().rstrip(',;:-')
                    normalized = normalize_phone_number(phone)
                    if normalized:
                        group_members.append({
                            'name': name_part or 'Unknown',
                            'phone': phone,
                            'normalized_phone': normalized
                        })
        
        logger.info(f"📱 Parsed {len(group_members)} group members from file")
        
        # Get registered users (include contactNumbers array)
        registered_users = await db.users.find(
            {"$or": [
                {"contactNumber": {"$exists": True, "$ne": None, "$ne": ""}},
                {"contactNumbers": {"$exists": True, "$ne": None, "$ne": []}}
            ]},
            {"username": 1, "firstName": 1, "lastName": 1, "contactNumber": 1, "contactNumbers": 1, "accountStatus": 1}
        ).to_list(None)
        
        # Decrypt PII fields before comparison
        from crypto_utils import get_encryptor
        encryptor = get_encryptor()
        for i, user in enumerate(registered_users):
            try:
                registered_users[i] = encryptor.decrypt_user_pii(user)
            except Exception:
                pass  # Use as-is if decryption fails
        
        # Normalize registered phones - include all numbers from contactNumbers array
        registered_phones = {}
        for user in registered_users:
            full_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
            status = user.get("accountStatus", "unknown")
            username = user.get("username", "")
            
            # Collect all phone numbers for this user
            all_phones = []
            contact_numbers = user.get("contactNumbers")
            if contact_numbers and isinstance(contact_numbers, list):
                for entry in contact_numbers:
                    if isinstance(entry, dict) and entry.get("number"):
                        all_phones.append((entry["number"], entry.get("label", "primary")))
            
            # Fallback: single contactNumber if no contactNumbers array
            if not all_phones:
                phone = user.get("contactNumber", "")
                if phone:
                    all_phones.append((phone, "primary"))
            
            for phone, label in all_phones:
                normalized = normalize_phone_number(phone)
                if normalized:
                    registered_phones[normalized] = {
                        'username': username,
                        'full_name': full_name,
                        'original_phone': phone,
                        'label': label,
                        'status': status
                    }
        
        logger.info(f"📱 Registered phones normalized: {len(registered_phones)} numbers from {len(registered_users)} users")
        # Log sample for debugging
        sample_registered = list(registered_phones.keys())[:5]
        sample_group = [m['normalized_phone'] for m in group_members[:5]]
        logger.info(f"📱 Sample registered phones: {sample_registered}")
        logger.info(f"📱 Sample group phones: {sample_group}")
        
        # Compare
        group_phones = {member['normalized_phone']: member for member in group_members}
        
        # Find unauthorized members (in group but not registered)
        unauthorized = []
        for phone, member in group_phones.items():
            if phone not in registered_phones:
                unauthorized.append(member)
        
        # Find registered users not in group (deduplicate by username)
        not_in_group = []
        seen_usernames = set()
        for phone, user in registered_phones.items():
            if phone not in group_phones and user['username'] not in seen_usernames:
                not_in_group.append(user)
                seen_usernames.add(user['username'])
        
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
                "not_in_group_count": len(not_in_group),
                "verification_rate": round((len(verified) / len(group_members) * 100), 1) if group_members else 0
            },
            "verified_members": verified,
            "unauthorized_members": unauthorized,
            "registered_not_in_group": not_in_group
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison failed: {str(e)}")

@router.get("/verification-stats")
async def get_verification_stats(current_user: dict = Depends(get_current_user)):
    """Get current verification statistics"""
    # Check if admin
    if current_user.get("role_name") != "admin" and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    from database import get_database
    db = get_database()
    
    try:
        # Get stats - count users with any phone (contactNumber or contactNumbers array)
        total_users = await db.users.count_documents({})
        users_with_phone = await db.users.count_documents({
            "$or": [
                {"contactNumber": {"$exists": True, "$ne": None, "$ne": ""}},
                {"contactNumbers": {"$exists": True, "$ne": None, "$ne": []}}
            ]
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
