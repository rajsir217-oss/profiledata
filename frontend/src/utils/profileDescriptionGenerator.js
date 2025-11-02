/**
 * Profile Description Generator
 * Generates natural-language narratives from structured profile data
 * Keywords are highlighted with <strong> and <span class="highlight">
 */

/**
 * Generate "About Me" narrative from user profile data
 * @param {Object} user - User profile data
 * @returns {String} HTML string with highlighted keywords
 */
export const generateAboutMe = (user) => {
  if (!user) return '';

  const parts = [];

  // Part 1: Identity and Basic Info
  const age = user.age || calculateAge(user.dateOfBirth);
  const location = user.location || user.state || '';
  const country = user.countryOfResidence || user.countryOfOrigin || '';
  
  let intro = `I'm a <span class="highlight"><strong>${age}-year-old</strong></span>`;
  
  // Add profession/student status
  if (user.workExperience && user.workExperience.length > 0) {
    intro += ' <span class="highlight"><strong>professional</strong></span>';
  } else if (user.educationHistory && user.educationHistory.length > 0) {
    intro += ' <span class="highlight"><strong>student</strong></span>';
  }
  
  // Add location
  if (location && country) {
    intro += ` from <span class="highlight"><strong>${location}, ${country}</strong></span>`;
  } else if (country) {
    intro += ` from <span class="highlight"><strong>${country}</strong></span>`;
  }
  
  // Add citizenship/working status
  if (user.citizenshipStatus && user.citizenshipStatus.toLowerCase().includes('greencard')) {
    intro += ', currently working in the <span class="highlight"><strong>USA</strong></span>';
  } else if (user.citizenshipStatus && user.citizenshipStatus.toLowerCase().includes('citizen')) {
    const citizenCountry = user.citizenshipStatus.match(/\(([^)]+)\)/)?.[1];
    if (citizenCountry) {
      intro += `, <span class="highlight"><strong>${citizenCountry} citizen</strong></span>`;
    }
  }
  
  intro += '.';
  
  // Add height and build
  const height = formatHeight(user.heightFeet, user.heightInches) || user.height;
  const bodyType = user.bodyType || '';
  
  if (height) {
    intro += ` Standing at <span class="highlight"><strong>${height}</strong></span>`;
    if (bodyType && bodyType.toLowerCase() !== 'prefer not to say') {
      intro += ` with <span class="highlight"><strong>${bodyType.toLowerCase()}</strong></span> build`;
    }
    intro += ',';
  }
  
  // Add lifestyle traits
  const lifestyle = [];
  if (user.interests && Array.isArray(user.interests) && user.interests.length > 0) {
    const activeWords = ['trekking', 'sports', 'hiking', 'running', 'gym', 'yoga'];
    const hasActive = user.interests.some(i => 
      activeWords.some(word => i.toLowerCase().includes(word))
    );
    if (hasActive) {
      lifestyle.push('lead an <span class="highlight"><strong>active lifestyle</strong></span>');
    }
  }
  
  // Add interests
  if (user.interests && Array.isArray(user.interests) && user.interests.length > 0) {
    const interestsList = user.interests.slice(0, 4).map(i => 
      `<span class="highlight"><strong>${i.toLowerCase()}</strong></span>`
    ).join(', ');
    if (lifestyle.length > 0) {
      intro += ` ${lifestyle[0]} and enjoy ${interestsList}.`;
    } else {
      intro += ` I enjoy ${interestsList}.`;
    }
  } else if (lifestyle.length > 0) {
    intro += ` I ${lifestyle[0]}.`;
  }
  
  parts.push(intro);

  // Part 2: Lifestyle Details and Cultural Background
  const lifestyle2 = [];
  
  // Drinking and smoking
  if (user.drinking && user.drinking.toLowerCase() === 'socially') {
    lifestyle2.push(`a <span class="highlight"><strong>social drinker</strong></span>`);
  } else if (user.drinking && user.drinking.toLowerCase() !== 'no' && user.drinking.toLowerCase() !== 'prefer not to say') {
    lifestyle2.push(`${user.drinking.toLowerCase()}`);
  }
  
  if (user.smoking && user.smoking.toLowerCase() === 'socially') {
    lifestyle2.push(`<span class="highlight"><strong>occasional smoker</strong></span>`);
  } else if (user.smoking && user.smoking.toLowerCase() !== 'no' && user.smoking.toLowerCase() !== 'prefer not to say') {
    lifestyle2.push(`${user.smoking.toLowerCase()}`);
  }
  
  // Eating preference
  if (user.eatingPreference && user.eatingPreference.toLowerCase() !== 'any') {
    lifestyle2.push(`<span class="highlight"><strong>${user.eatingPreference.toLowerCase()}</strong></span> diet preference`);
  }
  
  if (lifestyle2.length > 0) {
    parts.push(`I'm ${lifestyle2.join(' and ')}.`);
  }
  
  // Languages and cultural background
  const cultural = [];
  
  if (user.languagesSpoken && Array.isArray(user.languagesSpoken) && user.languagesSpoken.length > 0) {
    const langList = user.languagesSpoken.slice(0, 3).map(l => 
      `<span class="highlight"><strong>${l}</strong></span>`
    ).join(', ');
    cultural.push(`I speak ${langList} fluently`);
  }
  
  if (user.caste && user.caste.toLowerCase() !== 'no caste' && user.caste.toLowerCase() !== 'prefer not to say') {
    cultural.push(`come from a <span class="highlight"><strong>${user.caste}</strong></span> background`);
  }
  
  if (user.religion && user.religion.toLowerCase() === 'other') {
    cultural.push(`am <span class="highlight"><strong>open to any religion</strong></span>`);
  } else if (user.religion && user.religion.toLowerCase() !== 'prefer not to say') {
    cultural.push(`follow <span class="highlight"><strong>${user.religion}</strong></span>`);
  }
  
  if (cultural.length > 0) {
    parts.push(cultural.join(', and ') + '.');
  }

  // Part 3: Family and Relationship Goals
  const family = [];
  
  // Children status
  if (user.hasChildren === 'Yes' || user.hasChildren === true) {
    const childCount = typeof user.hasChildren === 'string' && user.hasChildren.includes('(') 
      ? user.hasChildren.match(/\((\d+)\)/)?.[1] 
      : '1';
    const childText = childCount === '1' ? 'one child' : `${childCount} children`;
    family.push(`I'm a <span class="highlight"><strong>single parent</strong></span> to ${childText}`);
    
    if (user.wantsChildren && user.wantsChildren.toLowerCase().includes('open')) {
      family.push(`am <span class="highlight"><strong>open to discussing</strong></span> having more children with the right partner`);
    } else if (user.wantsChildren && user.wantsChildren.toLowerCase() === 'yes') {
      family.push(`would love to have more children`);
    }
  } else if (user.wantsChildren && user.wantsChildren.toLowerCase() === 'yes') {
    family.push(`I look forward to <span class="highlight"><strong>building a family</strong></span>`);
  } else if (user.wantsChildren && user.wantsChildren.toLowerCase().includes('open')) {
    family.push(`I'm <span class="highlight"><strong>open to discussing children</strong></span> in the future`);
  }
  
  if (family.length > 0) {
    parts.push(family.join(' and ') + '.');
  }
  
  // Relationship goals
  const lookingFor = user.lookingFor || 'relationship';
  const relationshipGoal = `I'm looking for a <span class="highlight"><strong>${lookingFor.toLowerCase()}</strong></span> with someone who values <span class="highlight"><strong>adventure, family</strong></span>, and building a <span class="highlight"><strong>meaningful connection</strong></span>.`;
  parts.push(relationshipGoal);

  return parts.join(' ');
};

/**
 * Generate "What I'm Looking For" narrative from partner preferences
 * @param {Object} prefs - Partner preference data
 * @returns {String} HTML string with highlighted keywords
 */
export const generatePartnerPreference = (prefs) => {
  if (!prefs) return '';

  const parts = [];

  // Use free-text partner preference if available
  if (prefs.partnerPreference && prefs.partnerPreference.trim()) {
    // Highlight key words in the existing text
    let text = prefs.partnerPreference;
    
    // Keywords to highlight
    const keywords = [
      'family', 'honesty', 'respect', 'educated', 'career-oriented',
      'balanced', 'independence', 'togetherness', 'teamwork',
      'ambitions', 'passions', 'interests', 'genuine', 'integrity',
      'humor', 'equality', 'mutual growth', 'loving home',
      'perfect match', 'life partner', 'values'
    ];
    
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b(${keyword})\\b`, 'gi');
      text = text.replace(regex, '<span class="highlight"><strong>$1</strong></span>');
    });
    
    parts.push(text);
  } else {
    // Generate from structured preferences
    parts.push(
      `I'm seeking a <span class="highlight"><strong>life partner</strong></span> who values ` +
      `<span class="highlight"><strong>family</strong></span>, ` +
      `<span class="highlight"><strong>honesty</strong></span>, and ` +
      `<span class="highlight"><strong>mutual respect</strong></span>.`
    );
  }

  return parts.join(' ');
};

/**
 * Format partner preferences as structured list
 * @param {Object} prefs - Partner preference data
 * @param {Object} user - User profile data (for relative calculations)
 * @returns {Array} Array of preference objects with label and value
 */
export const formatPreferencesList = (prefs, user) => {
  if (!prefs) return [];

  const list = [];
  const userAge = user?.age || calculateAge(user?.dateOfBirth) || 20;
  const userHeight = parseHeight(user?.heightFeet, user?.heightInches) || 67; // Default 5'7"

  // Age range
  if (prefs.ageRangeYounger || prefs.ageRangeOlder) {
    const younger = prefs.ageRangeYounger || 0;
    const older = prefs.ageRangeOlder || 0;
    const minAge = userAge - younger;
    const maxAge = userAge + older;
    list.push({
      label: 'Age',
      value: `<span class="highlight"><strong>${minAge}-${maxAge} years</strong></span>`
    });
  }

  // Height range
  if (prefs.heightRangeMin || prefs.heightRangeMax) {
    const minHeight = prefs.heightRangeMin || (userHeight - 4);
    const maxHeight = prefs.heightRangeMax || userHeight;
    list.push({
      label: 'Height',
      value: `<span class="highlight"><strong>${formatHeightFromInches(minHeight)} to ${formatHeightFromInches(maxHeight)}</strong></span>`
    });
  }

  // Education
  if (prefs.educationLevel) {
    const eduArray = Array.isArray(prefs.educationLevel) ? prefs.educationLevel : [prefs.educationLevel];
    if (eduArray.length > 0) {
      const edu = eduArray.join(', ');
      list.push({
        label: 'Education',
        value: `<span class="highlight"><strong>${edu}</strong></span>`
      });
    }
  }

  // Profession
  if (prefs.profession) {
    const profArray = Array.isArray(prefs.profession) ? prefs.profession : [prefs.profession];
    if (profArray.length > 0) {
      const prof = profArray.slice(0, 3).join(', ');
      list.push({
        label: 'Profession',
        value: `<span class="highlight"><strong>${prof}</strong></span>`
      });
    }
  }

  // Location
  if (prefs.partnerLocation) {
    const locArray = Array.isArray(prefs.partnerLocation) ? prefs.partnerLocation : [prefs.partnerLocation];
    if (locArray.length > 0) {
      const locations = locArray.slice(0, 3).join(', ');
      list.push({
        label: 'Location',
        value: `<span class="highlight"><strong>${locations}</strong></span>`
      });
    }
  }

  // Eating preference
  if (prefs.eatingPreference && prefs.eatingPreference.toLowerCase() !== 'any') {
    list.push({
      label: 'Eating',
      value: `<span class="highlight"><strong>${prefs.eatingPreference}</strong></span>`
    });
  }

  // Languages
  if (prefs.languages) {
    const langArray = Array.isArray(prefs.languages) ? prefs.languages : [prefs.languages];
    if (langArray.length > 0) {
      const langs = langArray.join(', ');
      list.push({
        label: 'Languages',
        value: `<span class="highlight"><strong>${langs}</strong></span>`
      });
    }
  }

  // Family type
  if (prefs.partnerFamilyType && prefs.partnerFamilyType.toLowerCase() !== 'any') {
    list.push({
      label: 'Family Type',
      value: `<span class="highlight"><strong>${prefs.partnerFamilyType}</strong></span>`
    });
  }

  // Religion
  if (prefs.partnerReligion && prefs.partnerReligion.toLowerCase() !== 'any') {
    list.push({
      label: 'Religion',
      value: `<span class="highlight"><strong>${prefs.partnerReligion}</strong></span>`
    });
  }

  return list;
};

// Helper functions
const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const formatHeight = (feet, inches) => {
  if (!feet) return null;
  const inchesNum = inches || 0;
  return `${feet}'${inchesNum}"`;
};

const parseHeight = (feet, inches) => {
  if (!feet) return null;
  return parseInt(feet) * 12 + (parseInt(inches) || 0);
};

const formatHeightFromInches = (totalInches) => {
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}'${inches}"`;
};
