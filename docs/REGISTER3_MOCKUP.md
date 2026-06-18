# Register3 Mockup (Frontend-Only Simplification)

## Objective
Design a simplified `Register3` experience with only 3 sections while keeping all existing backend APIs and payload contracts unchanged.

- Section 1: `Basic Information` (expanded)
- Section 2: `Optional Details` (collapsed by default)
- Section 3: `Agreements` (always visible before submit)

---

## Page-Level Wireframe

```text
+--------------------------------------------------------------------------------+
|                           CREATE YOUR PROFILE                                  |
|            Fast signup now, complete optional details anytime                  |
+--------------------------------------------------------------------------------+
| [Step 1 of 1]                                                                  |
| Progress: [##########----------] 50%                                           |
+--------------------------------------------------------------------------------+
| ▼ 1) BASIC INFORMATION                                                         |
|    (Always open)                                                               |
|    ------------------------------------------------------------                |
|    Username*              [____________________]                               |
|    Password*              [____________________]                               |
|    Confirm Password*      [____________________]                               |
|                                                                                |
|    First Name*            [____________________]                               |
|    Last Name*             [____________________]                               |
|    Primary Phone*         [____________________]                               |
|    Email*                 [____________________]                               |
|                                                                                |
|    Birth Month* [v]      Birth Year* [v]      Gender* [v]                     |
|    Height* Feet [v]      Height* Inches [v]                                    |
|                                                                                |
|    Country of Origin* [v]     Country of Residence* [v]                        |
|    State/Province* [v]        City/Town* [____________________]                |
|    Citizenship Status [v] (show for US residence)                              |
|                                                                                |
|    About Me*               [textarea__________________________]                |
|    Family Background*      [textarea__________________________]                |
|    Partner Preference*     [textarea__________________________]                |
|                                                                                |
|    Profile Created By* [v] (Myself / Parent / Other)                           |
|    (if not Myself) Creator Full Name [____________________]                    |
|    (if not Myself) Relationship     [____________________]                    |
|                                                                                |
|    Profile Photo*          [ Upload Photos ]                                   |
|    Education History*      [ + Add Entry ]                                     |
|    Work Experience*        [ + Add Entry ]                                     |
+--------------------------------------------------------------------------------+
| ▶ 2) OPTIONAL DETAILS                                                          |
|    (Closed by default; user can expand)                                        |
+--------------------------------------------------------------------------------+
| 3) AGREEMENTS                                                                  |
|    [ ] I confirm I am at least 18 years old*                                  |
|    [ ] I agree to Terms of Service*                                            |
|    [ ] I agree to Privacy Policy*                                              |
|    [ ] I agree to Community Guidelines*                                        |
|    [ ] I consent to data processing for matchmaking*                           |
|    [ ] I agree to receive marketing updates (optional)                         |
+--------------------------------------------------------------------------------+
| [Save Draft]                                            [Create Profile]       |
+--------------------------------------------------------------------------------+
```

---

## Section Mockup Details

## 1) Basic Information (Expanded)

### Group A: Account
- `username`*
- `password`*
- `passwordConfirm`*

### Group B: Contact
- `contactNumbers[0].number`* (primary)
- `contactEmail`*

### Group C: Personal
- `firstName`*
- `lastName`*
- `birthMonth`*
- `birthYear`*
- `gender`*
- `heightFeet`* + `heightInches`*

### Group D: Residence
- `countryOfOrigin`*
- `countryOfResidence`*
- `state`*
- `location`*
- `citizenshipStatus` (conditional for US residence)

### Group E: Profile Creator Context
- `profileCreatedBy`* (default: "me")
- `creatorInfo.fullName` (required if not self)
- `creatorInfo.relationship` (required if not self)
- `creatorInfo.notes` (optional)

### Group F: Minimum Profile Content
- `aboutMe`*
- `familyBackground`*
- `partnerPreference`*
- `images`* (at least 1)
- `educationHistory`* (at least 1 entry)
- `workExperience`* (at least 1 entry)

---

## 2) Optional Details (Collapsed)

```text
▶ Optional Details
   Add advanced info for better matching (optional)
```

When expanded:

### Contact Preferences
- `smsOptIn`
- `contactNumberVisible`
- `contactEmailVisible`
- `linkedinUrlVisible`

### Culture & Lifestyle
- `religion`
- `languagesSpoken`
- `eatingPreference`
- `caste`
- `motherTongue`
- `familyType`
- `familyValues`
- `relationshipStatus`
- `lookingFor`
- `interests`
- `drinking`
- `smoking`
- `bodyType`
- `hasChildren`
- `wantsChildren`
- `pets`
- `bio`
- `linkedinUrl`

### Advanced Partner Criteria
- Entire `partnerCriteria` object

### Attribution / Promo
- `promoCode`
- `invitedBy` (system)
- `invitationToken` (system)
- `referredByInfo` (system)

---

## 3) Agreements (Always Visible)

### Required
- `agreedToAge`
- `agreedToTerms`
- `agreedToPrivacy`
- `agreedToGuidelines`
- `agreedToDataProcessing`

### Optional
- `agreedToMarketing`

---

## Interaction Behavior (Mockup Rules)

1. Keep `Basic Information` open at all times.
2. Keep `Optional Details` collapsed by default.
3. Keep `Agreements` always visible near submit button.
4. `Create Profile` button remains disabled until:
   - all required basic fields are valid
   - required content blockers are satisfied (photo, education, work)
   - required agreement checkboxes are checked
5. Backend payload names remain unchanged from Register2.

---

## Mobile Mockup (Condensed)

```text
[Create Your Profile]
[Basic Information ▼]
  Account
  Contact
  Personal
  Residence
  Minimum Profile Content

[Optional Details ▶]

[Agreements]
  [ ] Age
  [ ] Terms
  [ ] Privacy
  [ ] Guidelines
  [ ] Data Processing
  [ ] Marketing (optional)

[Create Profile]
```

---

## Notes for Next Step

After mockup approval, implementation can proceed by:
- reusing existing `Register2` state keys and submit handler payload
- changing only layout/section grouping and progressive disclosure behavior
- keeping API calls (`/register`, invitation flows, etc.) unchanged
