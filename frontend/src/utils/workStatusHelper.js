/**
 * Derive working status from work experience data
 */

export const getWorkingStatus = (user) => {
  if (!user) return null;

  const workExperience = user.workExperience || [];
  
  // Check if user has any current work experience
  const hasCurrentJob = workExperience.some(exp => exp.status === 'current');
  
  if (!hasCurrentJob) {
    return 'Not Currently Working';
  }
  
  // Get current job description(s)
  const currentJobs = workExperience.filter(exp => exp.status === 'current');
  const jobDescriptions = currentJobs.map(exp => exp.description || '').join(' ').toLowerCase();
  
  // Detect self-employment keywords
  const selfEmployedKeywords = [
    'self-employed',
    'self employed',
    'freelance',
    'freelancer',
    'own business',
    'entrepreneur',
    'consultant',
    'independent contractor',
    'business owner',
    'proprietor'
  ];
  
  const isSelfEmployed = selfEmployedKeywords.some(keyword => 
    jobDescriptions.includes(keyword)
  );
  
  if (isSelfEmployed) {
    return 'Self-Employed';
  }
  
  return 'Employed';
};

/**
 * Get detailed work status with current position
 */
export const getDetailedWorkStatus = (user) => {
  if (!user) return null;
  
  const workExperience = user.workExperience || [];
  const currentJobs = workExperience.filter(exp => exp.status === 'current');
  
  if (currentJobs.length === 0) {
    return {
      status: 'Not Currently Working',
      position: null,
      location: null
    };
  }
  
  const primaryJob = currentJobs[0]; // Use first current job
  const status = getWorkingStatus(user);
  
  return {
    status,
    position: primaryJob.description,
    location: primaryJob.location
  };
};

/**
 * Format work experience for display
 */
export const formatWorkExperience = (experience) => {
  if (!experience || !experience.description) {
    return 'No description';
  }
  
  const parts = [];
  
  if (experience.description) {
    parts.push(experience.description);
  }
  
  if (experience.location) {
    parts.push(`in ${experience.location}`);
  }
  
  if (experience.status === 'current') {
    parts.push('(Current)');
  }
  
  return parts.join(' ');
};
