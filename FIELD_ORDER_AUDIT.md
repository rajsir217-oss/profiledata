# Field Order Audit - Register vs EditProfile vs Profile

## 📋 Register.js Field Order (MASTER ORDER)

### **Section 1: Account & Basic Info**
1. username (Register only - can't edit)
2. password (Register only - separate change password)
3. firstName
4. lastName

### **Section 2: Personal Details**
5. dateOfBirth (Date picker)
6. height (heightFeet + heightInches dropdowns)
7. gender (Radio buttons: Male, Female)

### **Section 3: Contact**
8. contactNumber
9. contactEmail

### **Section 4: Religion & Languages**
10. religion (Dropdown)
11. languagesSpoken (Multi-select)

### **Section 5: Bio**
12. bio (Textarea with samples)

### **Section 6: Regional/Location**
13. countryOfOrigin (Dropdown: US/IN)
14. countryOfResidence (Dropdown: US/IN)
15. state (Dropdown - varies by country)
16. location (City/Town text input)
17. citizenshipStatus (For USA: Citizen/Greencard)

### **Section 7: Cultural (India-specific)**
18. caste (Text input)
19. motherTongue (Text input)
20. castePreference (Dropdown: None/Open/Specific)
21. eatingPreference (Dropdown: Veg/Non-Veg/Eggetarian/Vegan/None)
22. familyType (Dropdown: Nuclear/Joint/Extended)
23. familyValues (Dropdown: Traditional/Modern/Liberal/Conservative)

### **Section 8: Education**
24. educationHistory (Array component)

### **Section 9: Work**
25. workExperience (Array component)
26. workLocation (Text input)
27. linkedinUrl (URL input)

### **Section 10: Dating Preferences**
28. relationshipStatus (Dropdown)
29. lookingFor (Dropdown)
30. religion (already shown above - duplicate?)
31. pets (Dropdown)
32. bodyType (Dropdown)
33. drinking (Dropdown)
34. smoking (Dropdown)
35. hasChildren (Dropdown: Yes/No)
36. wantsChildren (Dropdown: Yes/No)
37. interests (Text input - comma separated)

### **Section 11: About & Background**
38. familyBackground (Textarea with samples)
39. aboutMe (Textarea with samples)
40. partnerPreference (Textarea with samples)

### **Section 12: Partner Criteria**
41. partnerCriteria.ageRange (min, max)
42. partnerCriteria.heightRange (minFeet, minInches, maxFeet, maxInches)
43. partnerCriteria.educationLevel (Multi-select)
44. partnerCriteria.profession (Multi-select)
45. partnerCriteria.location (Multi-select)
46. partnerCriteria.languages (Multi-select)
47. partnerCriteria.religion (Multi-select)
48. partnerCriteria.caste (Text)
49. partnerCriteria.eatingPreference (Multi-select)
50. partnerCriteria.familyType (Multi-select)
51. partnerCriteria.familyValues (Multi-select)

### **Section 13: Images**
52. images (File upload - multiple)

### **Section 14: Legal (Register only)**
53. agreedToAge (Checkbox)
54. agreedToTerms (Checkbox)
55. agreedToPrivacy (Checkbox)
56. agreedToGuidelines (Checkbox)
57. agreedToDataProcessing (Checkbox)
58. agreedToMarketing (Checkbox - optional)

---

## ✅ Action Required

Need to verify EditProfile.js and Profile.js match this exact order!
