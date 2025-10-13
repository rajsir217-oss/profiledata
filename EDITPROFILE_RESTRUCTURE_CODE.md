# EditProfile.js Complete Restructure

## Order Matching Register.js Exactly

### Current Issues:
1. ❌ Contact fields (contactNumber, contactEmail) after firstName/lastName - SHOULD BE AFTER dateOfBirth/height/gender
2. ❌ languagesSpoken missing completely
3. ❌ bio is at end - SHOULD BE EARLY (after religion/languagesSpoken)
4. ❌ partnerCriteria section missing
5. ❌ Some fields out of order

### Target Structure (Match Register.js):

**1. Basic Info:**
- firstName, lastName

**2. Personal Details:**
- dateOfBirth, height, gender

**3. Contact (MOVE HERE):**
- contactNumber, contactEmail  

**4. Religion & Languages:**
- religion (dropdown)
- languagesSpoken (multi-select) **← ADD THIS**

**5. Bio (MOVE HERE):**
- bio **← MOVE FROM END**

**6. Regional/Location:**
- countryOfOrigin, countryOfResidence
- state, location
- citizenshipStatus

**7. Cultural:**
- caste, motherTongue
- castePreference, eatingPreference  
- familyType, familyValues

**8. Education:**
- educationHistory

**9. Work:**
- workExperience
- workLocation, linkedinUrl

**10. Dating Preferences:**
- relationshipStatus, lookingFor, religion, pets
- bodyType, drinking, smoking
- hasChildren, wantsChildren
- interests

**11. About & Background:**
- familyBackground
- aboutMe
- partnerPreference

**12. Partner Criteria:** **← ADD THIS ENTIRE SECTION**
- ageRange
- heightRange
- educationLevel
- profession
- location
- languages
- religion
- caste
- eatingPreference
- familyType
- familyValues

**13. Images:**
- Existing images
- Upload new images

This requires ~300-400 lines of restructuring!
