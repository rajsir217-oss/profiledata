# Field Audit: Register vs EditProfile vs Profile

## 📋 Missing Fields Analysis

### **Fields in Register.js but MISSING in EditProfile.js:**

1. ✅ `bio` - Bio/Tagline field (has sample carousel in Register)
2. ✅ `educationHistory` - Array field (replaced with shared component)
3. ✅ `workExperience` - Array field (replaced with shared component)

### **Fields in Register.js but MISSING in Profile.js display:**

1. ❌ `bio` - Not displayed on Profile page
2. ❌ `castePreference` - Not displayed
3. ❌ `eatingPreference` - Not displayed
4. ❌ `linkedinUrl` - Not displayed
5. ❌ `workLocation` - Not displayed
6. ❌ `familyType` - Not displayed
7. ❌ `familyValues` - Not displayed
8. ❌ `motherTongue` - Not displayed
9. ❌ `caste` - Not displayed
10. ❌ `languagesSpoken` - Not displayed (shows `languages` instead)

### **Field Name Inconsistencies:**

| Register.js | EditProfile.js | Backend/DB | Issue |
|-------------|----------------|------------|-------|
| `aboutMe` | `aboutYou` + `aboutMe` | ? | Confusion |
| `languagesSpoken` | `languagesSpoken` + `languages` | ? | Duplication |
| `dateOfBirth` | `dob` + `dateOfBirth` | ? | Duplication |
| `gender` | `sex` + `gender` | ? | Duplication |

---

## 🔧 Required Fixes

### **Priority 1: Add Missing `bio` field to EditProfile.js**
- Used in Register.js with sample carousel
- Should be in EditProfile.js for editing
- Should display on Profile.js page

### **Priority 2: Display Missing Fields on Profile.js**
- Add Bio/Tagline display
- Add LinkedIn URL display
- Add Work Location display
- Add Languages Spoken display (array)
- Add Cultural fields (caste, mother tongue, family type/values)
- Add Dietary preferences (castePreference, eatingPreference)

### **Priority 3: Fix Field Name Inconsistencies**
- Standardize on one field name per data point
- Update backend to accept both old and new names (backwards compatibility)

---

## ✅ Action Items

1. Add `bio` field to EditProfile.js state
2. Add `bio` TextAreaWithSamples component to EditProfile.js form
3. Add `bio` display to Profile.js
4. Add missing fields to Profile.js display sections
5. Standardize field names across all components
