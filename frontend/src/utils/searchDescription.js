// Pure helper that builds a human-readable, multi-clause description of
// a search criteria object. Used to:
//   - render saved-search descriptions in the saved-searches panel,
//   - persist a description alongside saved searches.
//
// Extracted from SearchPage2.js. The original component closure depended
// on `minMatchScore`; all current callers already pass `matchScore`
// explicitly, so the function is now strictly pure.

import { normalizeDaysBackValue } from './searchDefaults';

export const generateSearchDescription = (criteria, matchScore = 0) => {
  if (!criteria) return 'Search with no specific criteria';

  const parts = [];

  // Start with "I'm looking for"
  let intro = "I'm looking for";

  // Gender
  if (criteria.gender) {
    const genderMap = {
      'male': 'a guy',
      'female': 'a girl',
      'other': 'someone'
    };
    intro += ` ${genderMap[criteria.gender.toLowerCase()] || 'someone'}`;
  } else {
    intro += ' someone';
  }

  parts.push(intro);

  // Age range
  if (criteria.ageMin || criteria.ageMax) {
    const ageMin = criteria.ageMin || '?';
    const ageMax = criteria.ageMax || '?';
    parts.push(`age ranges from ${ageMin} to ${ageMax} years old`);
  }

  // Height range
  if (criteria.heightMinFeet || criteria.heightMaxFeet) {
    const heightMin = criteria.heightMinFeet
      ? `${criteria.heightMinFeet}ft${criteria.heightMinInches ? ' ' + criteria.heightMinInches + 'in' : ''}`
      : '?';
    const heightMax = criteria.heightMaxFeet
      ? `${criteria.heightMaxFeet}ft${criteria.heightMaxInches ? ' ' + criteria.heightMaxInches + 'in' : ''}`
      : '?';
    parts.push(`height from ${heightMin} to ${heightMax}`);
  }

  // Location (handle both single location and locations array)
  if (criteria.locations && criteria.locations.length > 0) {
    if (criteria.locations.length === 1) {
      parts.push(`living around ${criteria.locations[0]}`);
    } else {
      parts.push(`living around ${criteria.locations.slice(0, 2).join(' or ')}${criteria.locations.length > 2 ? ` (+${criteria.locations.length - 2} more)` : ''}`);
    }
  } else if (criteria.location) {
    parts.push(`living around ${criteria.location}`);
  }

  // Religion
  if (criteria.religion && criteria.religion !== '') {
    parts.push(`religion ${criteria.religion}`);
  }

  // Education
  if (criteria.education && criteria.education !== '') {
    parts.push(`education ${criteria.education}`);
  }

  // Occupation (handle both old single and new multi-select format)
  if (criteria.occupations && criteria.occupations.length > 0) {
    if (criteria.occupations.length === 1) {
      parts.push(`working as ${criteria.occupations[0]}`);
    } else {
      parts.push(`working as ${criteria.occupations.slice(0, 2).join(' or ')}${criteria.occupations.length > 2 ? ` (+${criteria.occupations.length - 2} more)` : ''}`);
    }
  } else if (criteria.occupation && criteria.occupation !== '') {
    parts.push(`working as ${criteria.occupation}`);
  }

  // Body Type
  if (criteria.bodyType && criteria.bodyType !== '') {
    parts.push(`body type ${criteria.bodyType.toLowerCase()}`);
  }

  // Eating Preference
  if (criteria.eatingPreference && criteria.eatingPreference !== '') {
    parts.push(`eating preference ${criteria.eatingPreference.toLowerCase()}`);
  }

  // L3V3L Match Score
  const effectiveScore = matchScore != null ? matchScore : 0;
  if (effectiveScore > 0) {
    parts.push(`L3V3L match score ≥${effectiveScore}%`);
  }

  // Keyword
  if (criteria.keyword) {
    parts.push(`with keywords "${criteria.keyword}"`);
  }

  // Days Back (new profiles)
  const normalizedDaysBack = normalizeDaysBackValue(criteria.daysBack, 30);

  if (normalizedDaysBack === 0) {
    parts.push('across all time');
  } else if (normalizedDaysBack > 0) {
    parts.push(`joined in last ${normalizedDaysBack} days`);
  }

  // Join all parts with commas and "and" before the last item
  if (parts.length === 0) {
    return 'Search with no specific criteria';
  }

  if (parts.length === 1) {
    return parts[0];
  }

  // Join with commas and add "and" before last item
  const lastPart = parts.pop();
  return parts.join(', ') + ' and ' + lastPart;
};
