# EditProfile.js Restructure Plan

## 🎯 Goal
Match the exact field order of Register.js in EditProfile.js

## 📊 Current vs Target Order

### **REGISTER.JS ORDER (TARGET):**
1. firstName, lastName
2. dateOfBirth, height, gender
3. contactNumber, contactEmail
4. religion, languagesSpoken
5. bio
6. countryOfOrigin, countryOfResidence, state, location
7. citizenshipStatus
8. caste, motherTongue
9. castePreference, eatingPreference
10. familyType, familyValues
11. educationHistory
12. workExperience, workLocation, linkedinUrl
13. relationshipStatus, lookingFor, pets
14. bodyType, drinking, smoking
15. hasChildren, wantsChildren
16. interests
17. familyBackground
18. aboutMe
19. partnerPreference
20. partnerCriteria (entire section)
21. images

### **EDITPROFILE.JS CURRENT ORDER (WRONG):**
1. firstName, lastName
2. contactNumber, contactEmail (should be after dateOfBirth)
3. dateOfBirth, height, sex, citizenshipStatus
4. religion, countryOfOrigin, countryOfResidence
5. state, caste, motherTongue
6. familyType, familyValues, location
7. castePreference, eatingPreference
8. educationHistory
9. workExperience, workLocation, linkedinUrl
10. relationshipStatus, lookingFor, bodyType, drinking, smoking
11. hasChildren, wantsChildren, pets
12. interests
13. familyBackground
14. aboutMe/aboutYou
15. partnerPreference
16. images

## ⚠️ Issues Found:

1. **languagesSpoken** - MISSING in EditProfile form
2. **bio** - Recently added but not in right position
3. **Contact fields** in wrong position
4. **partnerCriteria** - Not displayed in EditProfile form
5. Field groupings don't match Register

## ✅ Action: Complete Restructure Needed

Need to rewrite the entire EditProfile form section to match Register.js order exactly.
