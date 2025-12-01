"""
Audit profile fields - compare frontend form fields with backend API
"""

# Frontend form fields from Register2.js
frontend_fields = {
    # Basic Info
    'username',
    'password',
    'passwordConfirm',
    'firstName',
    'lastName',
    'contactNumber',
    'contactEmail',
    'smsOptIn',
    'birthMonth',
    'birthYear',
    'gender',
    'heightFeet',
    'heightInches',
    
    # Location & Cultural
    'countryOfOrigin',
    'countryOfResidence',
    'state',
    'location',
    'region',  # Auto-generated from location
    'religion',
    'languagesSpoken',
    'caste',
    'motherTongue',
    'profileCreatedBy',
    'creatorInfo',  # Object: fullName, relationship, notes
    
    # Education & Career
    'educationHistory',  # Array of objects
    'workExperience',  # Array of objects
    'linkedinUrl',
    'workingStatus',
    'citizenshipStatus',
    
    # Lifestyle & Personal
    'relationshipStatus',
    'lookingFor',
    'interests',
    'bio',  # Short tagline
    'aboutMe',  # Longer description
    'drinking',
    'smoking',
    'bodyType',
    'hasChildren',
    'wantsChildren',
    'pets',
    'eatingPreference',
    
    # Family
    'familyBackground',
    'familyType',
    'familyValues',
    
    # Partner Preferences
    'partnerPreference',
    'partnerCriteria',  # Object with all preferences
    'ageRangeYounger',
    'ageRangeOlder',
    'heightRangeMin',
    'heightRangeMax',
    'educationLevel',
    'profession',
    'languages',
    'partnerReligion',
    'partnerCaste',
    'partnerLocation',
    'partnerFamilyType',
    
    # Legal
    'agreedToAge',
    'agreedToTerms',
    'agreedToDataProcessing',
    
    # Images
    'images',
    'imagesToDelete',
    'imageOrder',
}

# Backend API fields from routes.py /profile/{username} PUT endpoint
backend_fields = {
    'firstName',
    'lastName',
    'contactNumber',
    'contactEmail',
    'smsOptIn',
    'birthMonth',
    'birthYear',
    'gender',
    'height',  # Combined from heightFeet + heightInches
    
    # Regional/Cultural
    'religion',
    'languagesSpoken',
    'countryOfOrigin',
    'countryOfResidence',
    'state',
    'caste',
    'motherTongue',
    'familyType',
    'familyValues',
    'castePreference',
    'eatingPreference',
    'location',
    
    # Education & Work
    'educationHistory',
    'workExperience',
    'linkedinUrl',
    'workingStatus',
    'citizenshipStatus',
    
    # Personal/Lifestyle
    'relationshipStatus',
    'lookingFor',
    'bodyType',
    'drinking',
    'smoking',
    'hasChildren',
    'wantsChildren',
    'pets',
    'interests',
    'languages',
    
    # Background & About
    'familyBackground',
    'aboutYou',
    'aboutMe',
    'bio',
    'partnerPreference',
    'partnerCriteria',
    
    # Images
    'images',
    'imagesToDelete',
    'imageOrder',
}

def main():
    print("=" * 80)
    print("🔍 PROFILE FIELDS AUDIT - Frontend vs Backend")
    print("=" * 80)
    
    # Fields sent by frontend but NOT accepted by backend
    ignored_fields = frontend_fields - backend_fields
    
    # Fields accepted by backend but NOT sent by frontend
    backend_only = backend_fields - frontend_fields
    
    # Fields in both
    common_fields = frontend_fields & backend_fields
    
    print(f"\n📊 **Summary:**")
    print(f"   - Frontend fields: {len(frontend_fields)}")
    print(f"   - Backend fields: {len(backend_fields)}")
    print(f"   - Common fields: {len(common_fields)}")
    print(f"   - ⚠️  Ignored by backend: {len(ignored_fields)}")
    print(f"   - Backend-only: {len(backend_only)}")
    
    if ignored_fields:
        print(f"\n❌ **FIELDS SENT BY FRONTEND BUT IGNORED BY BACKEND:**")
        for field in sorted(ignored_fields):
            print(f"   - {field}")
    
    if backend_only:
        print(f"\n✅ **FIELDS ACCEPTED BY BACKEND BUT NOT SENT BY FRONTEND:**")
        for field in sorted(backend_only):
            print(f"   - {field}")
    
    # Special handling for combined fields
    print(f"\n🔄 **FIELD TRANSFORMATIONS:**")
    print(f"   - Frontend: heightFeet + heightInches → Backend: height (combined)")
    print(f"   - Frontend: aboutMe → Backend: aboutMe + aboutYou (both)")
    print(f"   - Frontend: region → Generated from location (not sent)")
    
    # Critical missing fields
    critical_missing = {
        'bio',  # Was missing, now FIXED
        'creatorInfo',  # Profile creator metadata
        'profileCreatedBy',  # Who created the profile
        'agreedToAge',  # Legal consent
        'agreedToTerms',  # Legal consent
        'agreedToDataProcessing',  # GDPR consent
        'ageRangeYounger',  # Partner preference
        'ageRangeOlder',  # Partner preference
        'heightRangeMin',  # Partner preference
        'heightRangeMax',  # Partner preference
        'educationLevel',  # Partner preference
        'profession',  # Partner preference
        'partnerReligion',  # Partner preference
        'partnerCaste',  # Partner preference
        'partnerLocation',  # Partner preference
        'partnerFamilyType',  # Partner preference
    }
    
    still_missing = critical_missing & ignored_fields
    if still_missing:
        print(f"\n🚨 **CRITICAL FIELDS STILL IGNORED:**")
        for field in sorted(still_missing):
            print(f"   - {field}")
    
    print("\n" + "=" * 80)

if __name__ == "__main__":
    main()
