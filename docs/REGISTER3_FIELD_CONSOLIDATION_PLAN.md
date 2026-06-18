# Register3 Field Consolidation Plan

## Goal
Consolidate current `Register2` tabs into 3 sections:
1. `Basic Information`
2. `Optional Details` (collapsed/closed by default)
3. `Agreements` (terms + policy checkboxes)

This list is based on current code behavior in `frontend/src/components/Register2.js` (form defaults + validation + submit checks).

---

## Section 1: Basic Information (show expanded by default)

These are the fields that should be treated as **core profile creation inputs** for Register3.

### Account + Identity
- `username`
- `password`
- `passwordConfirm`
- `firstName`
- `lastName`

### Contact
- `contactNumbers[0].number` (primary number)
- `contactEmail`

### Personal
- `birthMonth`
- `birthYear`
- `gender`
- `heightFeet`
- `heightInches`

### Residence
- `countryOfOrigin`
- `countryOfResidence`
- `state`
- `location`
- `citizenshipStatus` (US-focused; keep in basic for now because it is currently in main profile form)

### Profile quality blockers currently enforced before submit
- At least 1 profile photo (`images`)
- At least 1 `educationHistory` entry
- At least 1 `workExperience` entry
- `aboutMe`
- `familyBackground`
- `partnerPreference`

### Profile Creator Context
- `profileCreatedBy`
- `creatorInfo.fullName`
- `creatorInfo.relationship`
- `creatorInfo.notes`

> Note: In current Register2 code, `aboutMe`, `familyBackground`, and `partnerPreference` are validated in final submit and can block registration.

---

## Section 2: Optional Details (collapsed by default)

These can remain hidden initially and expanded by user choice.

### Contact/Privacy Preferences
- `smsOptIn`
- `contactNumberVisible`
- `contactEmailVisible`
- `linkedinUrlVisible`

### Cultural / Lifestyle
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

### Partner Criteria (advanced matching)
- `partnerCriteria.ageRange`
- `partnerCriteria.ageRangeRelative`
- `partnerCriteria.heightRange`
- `partnerCriteria.heightRangeRelative`
- `partnerCriteria.educationLevel`
- `partnerCriteria.profession`
- `partnerCriteria.languages`
- `partnerCriteria.religion`
- `partnerCriteria.caste`
- `partnerCriteria.location`
- `partnerCriteria.eatingPreference`
- `partnerCriteria.familyType`
- `partnerCriteria.familyValues`
- `partnerCriteria.relationshipStatus`
- `partnerCriteria.lookingFor`
- `partnerCriteria.bodyType`
- `partnerCriteria.pets`
- `partnerCriteria.drinking`
- `partnerCriteria.smoking`
- `partnerCriteria.hasChildren`
- `partnerCriteria.wantsChildren`

### Invitation / Attribution (system-driven)
- `promoCode`
- `invitedBy`
- `invitationToken`
- `referredByInfo`

---

## Section 3: Agreements (dedicated checkbox section)

### Required to submit
- `agreedToAge`
- `agreedToTerms`
- `agreedToPrivacy`
- `agreedToGuidelines`
- `agreedToDataProcessing`

### Optional
- `agreedToMarketing`

---

## Suggested Register3 UX Behavior

### Basic Information section
- Always open.
- Include the fields needed to complete registration without opening optional details.

### Optional Details section
- Closed by default.
- User can expand to add richer profile and partner matching preferences.

### Agreements section
- Keep at end, always visible before submit.
- Block submit until all required agreement checkboxes are checked.

---

## Implementation Notes for Register3 (start state)

1. Keep `Basic Information` limited to fields necessary for account creation + searchable profile minimum.
2. Move all advanced preferences and profile enrichment to `Optional Details`.
3. Preserve existing backend payload names to avoid API changes during first pass.
4. Keep agreement field names unchanged to preserve legal/audit behavior.
5. If desired, a follow-up pass can relax current blockers (`familyBackground`, `partnerPreference`, etc.) if product wants faster onboarding.
