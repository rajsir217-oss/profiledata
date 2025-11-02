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

  // PARAGRAPH 1: Personal basics (age, location, physical, lifestyle, languages, religion)
  let para1 = '';
  
  // Identity and basic info
  const age = user.age || calculateAge(user.dateOfBirth);
  const location = user.location || user.state || '';
  const country = user.countryOfResidence || user.countryOfOrigin || '';
  
  para1 = `I'm a <span class="highlight"><strong>${age}-year-old</strong></span>`;
  
  if (user.workExperience && user.workExperience.length > 0) {
    para1 += ' <span class="highlight"><strong>professional</strong></span>';
  }
  
  if (location && country) {
    para1 += ` from <span class="highlight"><strong>${location}, ${country}</strong></span>`;
  } else if (country) {
    para1 += ` from <span class="highlight"><strong>${country}</strong></span>`;
  }
  
  if (user.citizenshipStatus && user.citizenshipStatus.toLowerCase().includes('greencard')) {
    para1 += ', currently working in the <span class="highlight"><strong>USA</strong></span>';
  }
  
  // Height and build
  const height = formatHeight(user.heightFeet, user.heightInches);
  const bodyType = user.bodyType;
  if (height) {
    para1 += `. Standing at <span class="highlight"><strong>${height}</strong></span>`;
    if (bodyType && bodyType.toLowerCase() !== 'prefer not to say') {
      para1 += ` with <span class="highlight"><strong>${bodyType.toLowerCase()}</strong></span> build`;
    }
  }
  
  // Lifestyle details
  const lifestyleDetails = [];
  if (user.drinking && user.drinking.toLowerCase() === 'socially') {
    lifestyleDetails.push(`<span class="highlight"><strong>social drinker</strong></span>`);
  }
  if (user.smoking && user.smoking.toLowerCase() === 'socially') {
    lifestyleDetails.push(`<span class="highlight"><strong>occasional smoker</strong></span>`);
  }
  if (user.eatingPreference && user.eatingPreference.toLowerCase() !== 'any') {
    lifestyleDetails.push(`<span class="highlight"><strong>${user.eatingPreference.toLowerCase()}</strong></span> diet preference`);
  }
  
  if (lifestyleDetails.length > 0) {
    para1 += `, I'm a ${lifestyleDetails.join(' and ')}`;
  }
  
  // Languages and religion
  if (user.languagesSpoken && Array.isArray(user.languagesSpoken) && user.languagesSpoken.length > 0) {
    const langList = user.languagesSpoken.slice(0, 3).map(l => 
      `<span class="highlight"><strong>${l}</strong></span>`
    ).join(', ');
    para1 += `. I speak ${langList} fluently`;
  }
  
  if (user.religion && user.religion.toLowerCase() === 'other') {
    para1 += `, and am <span class="highlight"><strong>open to any religion</strong></span>`;
  } else if (user.religion && user.religion.toLowerCase() !== 'prefer not to say') {
    para1 += `, and follow <span class="highlight"><strong>${user.religion}</strong></span>`;
  }
  
  // Children
  if (user.hasChildren === 'Yes' || user.hasChildren === true) {
    const childCount = typeof user.hasChildren === 'string' && user.hasChildren.includes('(') 
      ? user.hasChildren.match(/\((\d+)\)/)?.[1] 
      : '1';
    para1 += `. I'm a <span class="highlight"><strong>single parent</strong></span>`;
  } else if (user.wantsChildren && user.wantsChildren.toLowerCase() === 'yes') {
    para1 += `. I look forward to <span class="highlight"><strong>building a family</strong></span>`;
  } else if (user.wantsChildren && user.wantsChildren.toLowerCase().includes('open')) {
    para1 += `. I'm <span class="highlight"><strong>open to discussing children</strong></span> in the future`;
  }
  
  para1 += '.';

  // PARAGRAPH 2: Education, work, and family background
  let para2 = '';
  
  // Education and work
  if (user.educationHistory && Array.isArray(user.educationHistory) && user.educationHistory.length > 0) {
    const latestEdu = user.educationHistory[0];
    if (latestEdu.degree && latestEdu.institution) {
      para2 = `I hold a <span class="highlight"><strong>${latestEdu.degree}</strong></span> from <span class="highlight"><strong>${latestEdu.institution}</strong></span>`;
    }
  }
  
  if (user.workExperience && Array.isArray(user.workExperience) && user.workExperience.length > 0) {
    const currentWork = user.workExperience.find(w => w.status && w.status.toLowerCase() === 'current');
    const work = currentWork || user.workExperience[0];
    if (work.description) {
      if (para2) {
        para2 += ` and currently work as a <span class="highlight"><strong>${work.description}</strong></span>`;
      } else {
        para2 = `I currently work as a <span class="highlight"><strong>${work.description}</strong></span>`;
      }
      if (work.location) {
        para2 += ` in <span class="highlight"><strong>${work.location}</strong></span>`;
      }
      para2 += '.';
    }
  }
  
  // Family background
  if (user.familyBackground && user.familyBackground.trim()) {
    if (para2) {
      para2 += ' ' + user.familyBackground;
    } else {
      para2 = user.familyBackground;
    }
  }

  // PARAGRAPH 3: Personal description + relationship goals
  let para3 = '';
  
  if (user.aboutMe && user.aboutMe.trim()) {
    para3 = user.aboutMe;
  }
  
  // Add relationship goals
  const lookingFor = user.lookingFor || 'relationship';
  const relationshipGoal = ` I'm looking for a <span class="highlight"><strong>${lookingFor.toLowerCase()}</strong></span> with someone who values <span class="highlight"><strong>adventure, family</strong></span>, and building a <span class="highlight"><strong>meaningful connection</strong></span>.`;
  para3 += relationshipGoal;

  // Combine paragraphs
  const paragraphs = [para1, para2, para3].filter(p => p.trim());
  return paragraphs.join('<br/><br/>');
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

  // Add preferences for eating and languages if available
  const preferenceDetails = [];
  
  if (prefs.eatingPreference && prefs.eatingPreference.toLowerCase() !== 'any') {
    preferenceDetails.push(
      `preferably <span class="highlight"><strong>${prefs.eatingPreference.toLowerCase()}</strong></span>`
    );
  }
  
  if (prefs.languages) {
    const langArray = Array.isArray(prefs.languages) ? prefs.languages : [prefs.languages];
    if (langArray.length > 0) {
      const langList = langArray.slice(0, 3).map(l => 
        `<span class="highlight"><strong>${l}</strong></span>`
      ).join(', ');
      preferenceDetails.push(
        `someone who speaks ${langList}`
      );
    }
  }
  
  if (preferenceDetails.length > 0) {
    parts.push(`I'm looking for ${preferenceDetails.join(' and ')}.`);
  }

  // Join with space for partner preferences (shorter, keeps together)
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
