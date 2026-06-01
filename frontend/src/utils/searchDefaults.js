// Pure helpers for building default search criteria from a user profile
// and normalizing the daysBack filter value.
//
// These were extracted from SearchPage2.js to:
//   - keep SearchPage2.js focused on UI/effect orchestration,
//   - enable unit testing of the bootstrap-critical defaults,
//   - allow other components/hooks to reuse the same defaults logic.

// Build default search criteria from a user profile.
// Computes opposite gender, age range, and height range from partnerCriteria
// with gender-based fallbacks. Used by loadCurrentUserProfile,
// loadAndExecuteDefaultSearch, and getDefaultSearchCriteria / handleClearFilters.
export const buildDefaultCriteria = (profile) => {
  if (!profile) {
    return {
      gender: '',
      ageMin: '',
      ageMax: '',
      heightMinFeet: '',
      heightMinInches: '',
      heightMaxFeet: '',
      heightMaxInches: '',
      daysBack: 0,
      hasPhoto: true
    };
  }

  const userGender = profile.gender?.toLowerCase();
  let oppositeGender = '';
  if (userGender === 'male') oppositeGender = 'female';
  else if (userGender === 'female') oppositeGender = 'male';

  // Calculate user's age
  let userAge = null;
  if (profile.birthMonth && profile.birthYear) {
    const today = new Date();
    userAge = today.getFullYear() - profile.birthYear;
    if (today.getMonth() + 1 < profile.birthMonth) userAge--;
  }

  // Parse user's height
  let userHeightTotalInches = null;
  if (profile.height) {
    const heightMatch = profile.height.match(/(\d+)'(\d+)"/);
    if (heightMatch) {
      userHeightTotalInches = parseInt(heightMatch[1]) * 12 + parseInt(heightMatch[2]);
    }
  }

  const partnerCriteria = profile.partnerCriteria;
  let defaultAgeMin = '', defaultAgeMax = '';
  let defaultHeightMinFeet = '', defaultHeightMinInches = '';
  let defaultHeightMaxFeet = '', defaultHeightMaxInches = '';

  // Age range: relative offsets → absolute range → gender-based fallback
  if (partnerCriteria?.ageRangeRelative && userAge) {
    const minOffset = partnerCriteria.ageRangeRelative.minOffset || 0;
    const maxOffset = partnerCriteria.ageRangeRelative.maxOffset || 5;
    defaultAgeMin = Math.max(19, userAge + minOffset).toString();
    defaultAgeMax = Math.min(100, userAge + maxOffset).toString();
  } else if (partnerCriteria?.ageRange?.min && partnerCriteria?.ageRange?.max) {
    defaultAgeMin = partnerCriteria.ageRange.min.toString();
    defaultAgeMax = partnerCriteria.ageRange.max.toString();
  } else if (userAge && userGender) {
    if (userGender === 'male') {
      defaultAgeMin = Math.max(19, userAge - 5).toString();
      defaultAgeMax = Math.min(100, userAge + 1).toString();
    } else if (userGender === 'female') {
      defaultAgeMin = Math.max(19, userAge - 1).toString();
      defaultAgeMax = Math.min(100, userAge + 5).toString();
    }
  }

  // Height range: relative offsets → absolute range → gender-based fallback
  if (partnerCriteria?.heightRangeRelative && userHeightTotalInches) {
    const minInchesOffset = partnerCriteria.heightRangeRelative.minInches || 0;
    const maxInchesOffset = partnerCriteria.heightRangeRelative.maxInches || 6;
    const minTotalInches = userHeightTotalInches + minInchesOffset;
    const maxTotalInches = userHeightTotalInches + maxInchesOffset;
    defaultHeightMinFeet = Math.floor(minTotalInches / 12).toString();
    defaultHeightMinInches = (minTotalInches % 12).toString();
    defaultHeightMaxFeet = Math.floor(maxTotalInches / 12).toString();
    defaultHeightMaxInches = (maxTotalInches % 12).toString();
  } else if (partnerCriteria?.heightRange?.minFeet) {
    defaultHeightMinFeet = partnerCriteria.heightRange.minFeet?.toString() || '';
    defaultHeightMinInches = partnerCriteria.heightRange.minInches?.toString() || '';
    defaultHeightMaxFeet = partnerCriteria.heightRange.maxFeet?.toString() || '';
    defaultHeightMaxInches = partnerCriteria.heightRange.maxInches?.toString() || '';
  } else if (userHeightTotalInches && userGender) {
    if (userGender === 'male') {
      const minTotalInches = userHeightTotalInches - 6;
      const maxTotalInches = userHeightTotalInches;
      defaultHeightMinFeet = Math.floor(minTotalInches / 12).toString();
      defaultHeightMinInches = (minTotalInches % 12).toString();
      defaultHeightMaxFeet = Math.floor(maxTotalInches / 12).toString();
      defaultHeightMaxInches = (maxTotalInches % 12).toString();
    } else if (userGender === 'female') {
      const minTotalInches = userHeightTotalInches + 1;
      const maxTotalInches = userHeightTotalInches + 6;
      defaultHeightMinFeet = Math.floor(minTotalInches / 12).toString();
      defaultHeightMinInches = (minTotalInches % 12).toString();
      defaultHeightMaxFeet = Math.floor(maxTotalInches / 12).toString();
      defaultHeightMaxInches = (maxTotalInches % 12).toString();
    }
  }

  return {
    gender: oppositeGender,
    ageMin: defaultAgeMin,
    ageMax: defaultAgeMax,
    heightMinFeet: defaultHeightMinFeet,
    heightMinInches: defaultHeightMinInches,
    heightMaxFeet: defaultHeightMaxFeet,
    heightMaxInches: defaultHeightMaxInches,
    daysBack: 0,
    hasPhoto: true,
    locations: []
  };
};

// Coerce a daysBack filter value into a number with a fallback.
// Empty string / null / undefined / NaN → fallback (default 0 = ALL).
export const normalizeDaysBackValue = (daysBack, fallback = 0) => {
  if (daysBack === '' || daysBack === null || daysBack === undefined) {
    return fallback;
  }

  const parsed = Number(daysBack);
  return Number.isNaN(parsed) ? fallback : parsed;
};
