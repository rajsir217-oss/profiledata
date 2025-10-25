import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import ProfilePreview from './ProfilePreview';
import ImageManager from './ImageManager';
import { EducationHistory, WorkExperience, TextAreaWithSamples, HeightSelector, GenderSelector } from './shared';
import './EditProfile.css';

const EditProfile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Helper function to calculate age from date of birth
  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return null;
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };
  
  // Helper function to convert height to inches
  const heightToInches = (feet, inches) => {
    const f = parseInt(feet) || 0;
    const i = parseInt(inches) || 0;
    return (f * 12) + i;
  };
  
  // Helper function to convert inches to feet'inches" format
  const inchesToHeightString = (totalInches) => {
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return `${feet}'${inches}"`;
  };
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    contactNumber: '',
    contactEmail: '',
    dateOfBirth: '',
    sex: '',
    gender: '',
    height: '',
    heightFeet: '',
    heightInches: '',
    // Regional/Cultural
    religion: '',
    languagesSpoken: [],
    countryOfOrigin: 'US',
    countryOfResidence: 'US',
    state: '',
    caste: '',
    motherTongue: '',
    familyType: '',
    familyValues: '',
    castePreference: '',
    eatingPreference: '',
    location: '',
    // Education & Work
    workingStatus: 'Yes',
    citizenshipStatus: 'Citizen',
    // Personal/Lifestyle
    relationshipStatus: '',
    lookingFor: '',
    bodyType: '',
    drinking: '',
    smoking: '',
    hasChildren: '',
    wantsChildren: '',
    pets: '',
    interests: '',
    languages: '',
    // Background
    familyBackground: '',
    aboutYou: '',
    aboutMe: '',
    partnerPreference: '',
    bio: '',
    linkedinUrl: '',
    // Partner Criteria (will be object)
    partnerCriteria: {
      ageRange: { min: '', max: '' }, // Legacy - kept for backward compatibility
      ageRangeRelative: { minOffset: 0, maxOffset: 5 }, // NEW: Relative age preference
      heightRange: { minFeet: '', minInches: '', maxFeet: '', maxInches: '' }, // Legacy
      heightRangeRelative: { minInches: 0, maxInches: 6 }, // NEW: Relative height in inches
      educationLevel: [],
      profession: [],
      location: [],
      languages: [],
      religion: [],
      caste: '',
      eatingPreference: [],
      familyType: [],
      familyValues: []
    }
  });

  const [educationHistory, setEducationHistory] = useState([]);
  const [workExperience, setWorkExperience] = useState([]);

  const [newImages, setNewImages] = useState([]); // Renamed from images for clarity
  const [existingImages, setExistingImages] = useState([]);
  const [imagesToDelete, setImagesToDelete] = useState([]);

  // Sample description carousel states are now managed inside TextAreaWithSamples component

  // Sample descriptions for "About You"
  const aboutYouSamples = [
    "I am a warm-hearted and family-oriented individual who values tradition while embracing modern perspectives. My friends describe me as compassionate, reliable, and someone with a great sense of humor. I enjoy meaningful conversations, weekend getaways, and trying new cuisines. In my free time, I love reading, cooking, and spending quality time with loved ones. I believe in honesty, respect, and building a strong foundation of friendship in a relationship.",
    
    "As a dedicated professional, I've built a successful career while maintaining a healthy work-life balance. I'm passionate about personal growth, fitness, and exploring new cultures through travel. I value deep connections and believe in the power of communication and understanding. Whether it's a quiet evening at home or an adventure in the mountains, I appreciate life's simple pleasures. I'm looking for someone who shares my values and is ready to build a beautiful future together.",
    
    "I'm an optimistic person who finds joy in life's little moments. My family means everything to me, and I cherish the values they've instilled in me. I have a curious mind and love learning new things, whether it's picking up a new hobby or exploring different perspectives. I enjoy cooking traditional dishes with a modern twist, practicing yoga, and volunteering in my community. I believe in mutual respect, trust, and supporting each other's dreams in a partnership.",
    
    "I would describe myself as down-to-earth, ambitious, and emotionally intelligent. My career in [your field] keeps me engaged, but I always make time for family, friends, and personal interests. I'm passionate about music, art, and staying active through sports or outdoor activities. I value authenticity and believe that the best relationships are built on friendship, laughter, and shared values. I'm looking for a life partner who is equally committed to growing together while celebrating our individual strengths.",
    
    "I'm a creative soul with a practical approach to life. I balance my professional responsibilities with hobbies like photography, gardening, and exploring local food scenes. My friends appreciate my loyalty and my ability to listen without judgment. I come from a close-knit family and hope to create the same warmth in my own home someday. I value kindness, integrity, and a good sense of humor. Life's too short not to laugh, love, and make beautiful memories along the way."
  ];

  // Sample descriptions for "Partner Preference"
  const partnerPrefSamples = [
    "I'm seeking a life partner who values family, honesty, and mutual respect. Someone who is educated, career-oriented, and has a balanced approach to life. I appreciate a person who can engage in meaningful conversations and shares similar cultural values while being open-minded. A good sense of humor and the ability to handle life's ups and downs with grace are qualities I deeply admire. Most importantly, I'm looking for someone who believes in partnership, where we support each other's goals and grow together.",
    
    "I'm looking for someone who is kind-hearted, ambitious, and has strong family values. Education and career are important, but what matters most is finding someone with emotional maturity and excellent communication skills. I value a partner who enjoys both quiet evenings at home and occasional adventures exploring new places. Someone who respects traditions while embracing modern thinking would be a perfect match. Honesty, loyalty, and a positive outlook on life are qualities I hold dear in a potential life partner.",
    
    "My ideal partner is someone who is compassionate, well-educated, and has a strong sense of self. I appreciate independence but also value togetherness and teamwork in building a life. Someone who shares my love for family, respects my ambitions, and has their own passions and interests would be wonderful. I'm drawn to people who are genuine, have integrity, and can find humor in everyday situations. A partner who believes in equality, mutual growth, and creating a loving home together would be my perfect match.",
    
    "I'm seeking a partner who is emotionally intelligent, supportive, and shares similar values about family and relationships. Professional stability is important, but I'm more interested in someone's character, kindness, and ability to communicate openly. I appreciate someone who is health-conscious, enjoys staying active, and values personal growth. A great sense of humor, patience, and the ability to be both my best friend and life partner are qualities I'm looking for. Together, I hope we can build a relationship based on trust, love, and mutual respect.",
    
    "I envision a partner who is confident yet humble, successful yet grounded. Someone who values their roots while being open to new experiences and perspectives. I appreciate a person who can balance career ambitions with family priorities and knows the importance of quality time together. Shared values about honesty, loyalty, and commitment are essential to me. I'm looking for someone who can be my companion through life's journey—celebrating successes, supporting through challenges, and creating a warm, loving family together."
  ];

  // Sample descriptions for "Family Background"
  const familyBackgroundSamples = [
    "I come from a close-knit, traditional family that values education, respect, and strong moral principles. My parents have been wonderful role models, teaching me the importance of hard work, honesty, and compassion. We celebrate all festivals together and maintain strong bonds with extended family. My family is supportive of my career and personal choices while instilling cultural values. They believe in modern thinking while respecting traditions, and family gatherings are always filled with warmth and joy.",
    
    "I belong to a modern, progressive family that encourages independence and personal growth. My parents are both professionals who have always supported my education and career aspirations. We have a small, close family that values open communication and mutual respect. While we respect our cultural roots, we're also open to different perspectives and beliefs. Family is important to us, but we also believe in giving each other space to pursue individual dreams and passions.",
    
    "I come from a well-educated, middle-class family with strong values of integrity and kindness. My father is retired, and my mother is a homemaker who has been the pillar of our family. I have siblings who are all well-settled in their respective careers. We're a traditional yet modern family that believes in maintaining cultural heritage while embracing change. Family gatherings, festivals, and celebrations are an integral part of our lives, and we share a deep bond of love and support.",
    
    "My family is small but very loving and supportive. We believe in simplicity, honesty, and treating everyone with respect. My parents have always encouraged me to pursue my dreams while staying grounded in our values. We may not have elaborate celebrations, but we treasure quality time together. Education and good character have always been priorities in our household. My family is understanding and would welcome a life partner who shares similar values of respect and love.",
    
    "I belong to a large, joint family where traditions and togetherness are highly valued. We have regular family gatherings, celebrate all occasions with enthusiasm, and maintain strong connections with relatives. My family is well-respected in our community and places great importance on values like hospitality, respect for elders, and cultural traditions. At the same time, they're progressive in their thinking and supportive of individual choices. Growing up in such a nurturing environment has shaped my values and outlook on relationships and family life."
  ];

  // Sample descriptions for "Bio / Tagline"
  const bioSamples = [
    "Family-oriented professional seeking genuine connection and lifelong partnership 💕",
    "Traditional values, modern outlook. Love travel, food, and meaningful conversations ✨",
    "Balanced life, big heart. Looking for my partner in crime and best friend 🌟",
    "Adventure seeker with strong family values. Let's create beautiful memories together 🎯",
    "Passionate about life, career, and relationships. Seeking someone who values honesty and respect 💫"
  ];

  // Load current user's profile data
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const username = localStorage.getItem('username');
        if (!username) {
          navigate('/login');
          return;
        }

        const response = await api.get(`/profile/${username}?requester=${username}`);
        const userData = response.data;

        // Parse height from format "5'8"" into feet and inches
        let heightFeet = '';
        let heightInches = '';
        if (userData.height) {
          const heightMatch = userData.height.match(/(\d+)'(\d+)"/);
          if (heightMatch) {
            heightFeet = heightMatch[1];
            heightInches = heightMatch[2];
          }
        }

        // Populate form with existing data
        setFormData({
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          contactNumber: userData.contactNumber || '',
          contactEmail: userData.contactEmail || '',
          dateOfBirth: userData.dateOfBirth || '',
          sex: userData.sex || userData.gender || '',
          gender: userData.gender || userData.sex || '',
          height: userData.height || '',
          heightFeet: heightFeet,
          heightInches: heightInches,
          // Regional/Cultural
          religion: userData.religion || '',
          languagesSpoken: userData.languagesSpoken || [],
          countryOfOrigin: userData.countryOfOrigin || 'US',
          countryOfResidence: userData.countryOfResidence || 'US',
          state: userData.state || '',
          caste: userData.caste || '',
          motherTongue: userData.motherTongue || '',
          familyType: userData.familyType || '',
          familyValues: userData.familyValues || '',
          castePreference: userData.castePreference || '',
          eatingPreference: userData.eatingPreference || '',
          location: userData.location || '',
          // Education & Work
          workingStatus: userData.workingStatus || 'Yes',
          citizenshipStatus: userData.citizenshipStatus || 'Citizen',
          // Personal/Lifestyle
          relationshipStatus: userData.relationshipStatus || '',
          lookingFor: userData.lookingFor || '',
          bodyType: userData.bodyType || '',
          drinking: userData.drinking || '',
          smoking: userData.smoking || '',
          hasChildren: userData.hasChildren || '',
          wantsChildren: userData.wantsChildren || '',
          pets: userData.pets || '',
          interests: userData.interests || '',
          languages: userData.languages || '',
          // Background
          familyBackground: userData.familyBackground || '',
          aboutYou: userData.aboutYou || userData.aboutMe || '',
          aboutMe: userData.aboutMe || userData.aboutYou || '',
          partnerPreference: userData.partnerPreference || '',
          bio: userData.bio || '',
          linkedinUrl: userData.linkedinUrl || '',
          // Partner Criteria - ensure all fields exist with defaults
          partnerCriteria: {
            ageRange: userData.partnerCriteria?.ageRange || { min: '', max: '' },
            ageRangeRelative: userData.partnerCriteria?.ageRangeRelative || { minOffset: 0, maxOffset: 5 },
            heightRange: userData.partnerCriteria?.heightRange || { minFeet: '', minInches: '', maxFeet: '', maxInches: '' },
            heightRangeRelative: userData.partnerCriteria?.heightRangeRelative || { minInches: 0, maxInches: 6 },
            educationLevel: userData.partnerCriteria?.educationLevel || [],
            profession: userData.partnerCriteria?.profession || [],
            location: userData.partnerCriteria?.location || [],
            languages: userData.partnerCriteria?.languages || [],
            religion: Array.isArray(userData.partnerCriteria?.religion) ? userData.partnerCriteria.religion : (userData.partnerCriteria?.religion ? [userData.partnerCriteria.religion] : []),
            caste: userData.partnerCriteria?.caste || '',
            eatingPreference: userData.partnerCriteria?.eatingPreference || [],
            familyType: userData.partnerCriteria?.familyType || [],
            familyValues: userData.partnerCriteria?.familyValues || []
          }
        });

        setEducationHistory(userData.educationHistory || []);
        setWorkExperience(userData.workExperience || []);

        setExistingImages(userData.images || []);
        setLoading(false);
      } catch (error) {
        console.error('Error loading profile:', error);
        setErrorMsg('Failed to load profile data');
        setLoading(false);
      }
    };

    loadProfile();
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrorMsg('');
  };

  // handleImageChange removed - now handled by ImageManager component

  // Education and Work Experience handlers are now in shared components

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const username = localStorage.getItem('username');
      
      // Prepare form data
      const data = new FormData();
      
      // Combine heightFeet and heightInches into height field
      if (formData.heightFeet && formData.heightInches !== '') {
        formData.height = `${formData.heightFeet}'${formData.heightInches}"`;
      }
      
      // Add simple string fields
      const simpleFields = [
        'firstName', 'lastName', 'contactNumber', 'contactEmail',
        'dateOfBirth', 'sex', 'gender', 'height',
        'religion', 'countryOfOrigin', 'countryOfResidence', 'state',
        'caste', 'motherTongue', 'familyType', 'familyValues',
        'castePreference', 'eatingPreference', 'location',
        'workingStatus', 'citizenshipStatus',
        'relationshipStatus', 'lookingFor', 'bodyType', 'drinking', 'smoking',
        'hasChildren', 'wantsChildren', 'pets', 'interests', 'languages',
        'familyBackground', 'aboutYou', 'aboutMe', 'partnerPreference', 'bio', 'linkedinUrl'
      ];
      
      simpleFields.forEach(key => {
        if (formData[key] && typeof formData[key] === 'string' && formData[key].trim()) {
          data.append(key, formData[key]);
        } else if (formData[key] && typeof formData[key] !== 'object') {
          data.append(key, formData[key]);
        }
      });
      
      // Add array fields as JSON strings
      if (formData.languagesSpoken && Array.isArray(formData.languagesSpoken) && formData.languagesSpoken.length > 0) {
        data.append('languagesSpoken', JSON.stringify(formData.languagesSpoken));
      }
      
      // Add partner criteria as JSON string
      if (formData.partnerCriteria && Object.keys(formData.partnerCriteria).length > 0) {
        data.append('partnerCriteria', JSON.stringify(formData.partnerCriteria));
      }
      
      // Add structured data as JSON strings
      if (educationHistory.length > 0) {
        data.append('educationHistory', JSON.stringify(educationHistory));
      }
      if (workExperience.length > 0) {
        data.append('workExperience', JSON.stringify(workExperience));
      }
      
      // Add new images
      newImages.forEach(img => data.append('images', img));
      
      // Add images to delete
      if (imagesToDelete.length > 0) {
        data.append('imagesToDelete', JSON.stringify(imagesToDelete));
      }
      
      // Add image order (to preserve profile pic selection and ordering)
      if (existingImages.length > 0) {
        data.append('imageOrder', JSON.stringify(existingImages));
        console.log(`📋 Image order being sent: ${JSON.stringify(existingImages)}`);
      }
      console.log(`📸 Images: ${newImages.length} new file(s)`);
      console.log(`🗑️ Images to delete: ${imagesToDelete.length}`, imagesToDelete);
      
      // Send update request with proper headers
      const response = await api.put(`/profile/${username}`, data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      console.log('✅ Update response:', response.data);
      setSuccessMsg('✅ ' + response.data.message);
      
      // Clear new images and images to delete after successful upload
      setNewImages([]);
      setImagesToDelete([]);
      
      // Redirect after short delay
      setTimeout(() => {
        navigate(`/profile/${username}`);
      }, 1500);
    } catch (error) {
      console.error('❌ Error updating profile:', error);
      console.error('Error details:', error.response?.data);
      setErrorMsg(error.response?.data?.detail || '❌ Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProfile = async () => {
    setDeleting(true);
    setErrorMsg('');

    try {
      const username = localStorage.getItem('username');
      
      // Send delete request
      const response = await api.delete(`/profile/${username}`);
      
      setSuccessMsg('✅ ' + response.data.message);
      setShowDeleteConfirm(false);
      
      // Clear localStorage and redirect
      setTimeout(() => {
        localStorage.removeItem('username');
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userStatus');
        localStorage.removeItem('appTheme');
        window.dispatchEvent(new Event('loginStatusChanged'));
        navigate('/login');
      }, 1500);
    } catch (error) {
      console.error('Error deleting profile:', error);
      setErrorMsg(error.response?.data?.detail || '❌ Failed to delete profile');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCancel = () => {
    const username = localStorage.getItem('username');
    navigate(`/profile/${username}`);
  };

  if (loading) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3">Loading profile data...</p>
      </div>
    );
  }

  return (
    <div className="edit-profile-container">
      <div className="card p-4 shadow">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h3>Edit Profile</h3>
          <button className="btn btn-outline-secondary" onClick={handleCancel}>
            ← Back to Profile
          </button>
        </div>

        {errorMsg && <div className="alert alert-danger">{errorMsg}</div>}
        {successMsg && <div className="alert alert-success">{successMsg}</div>}

        <form onSubmit={handleUpdate}>
          {/* Section 1: Name Fields */}
          <div className="row mb-3">
            <div className="col-md-6">
              <label className="form-label">First Name</label>
              <input
                type="text"
                className="form-control"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Last Name</label>
              <input
                type="text"
                className="form-control"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Section 2: Personal Details - dateOfBirth, height, gender */}
          <div className="row mb-3">
            <div className="col-md-4">
              <label className="form-label">Date of Birth</label>
              <input
                type="date"
                className="form-control"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-md-4">
              <HeightSelector
                heightFeet={formData.heightFeet}
                heightInches={formData.heightInches}
                onFeetChange={handleChange}
                onInchesChange={handleChange}
                required
                label="Height"
              />
            </div>
            <div className="col-md-4">
              <GenderSelector
                value={formData.sex}
                onChange={handleChange}
                required
                label="Gender"
                name="sex"
              />
            </div>
          </div>

          {/* Section 3: Contact Fields (MOVED FROM TOP) */}
          <div className="row mb-3">
            <div className="col-md-6">
              <label className="form-label">Contact Number</label>
              <input
                type="text"
                className="form-control"
                name="contactNumber"
                value={formData.contactNumber}
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Contact Email</label>
              <input
                type="email"
                className="form-control"
                name="contactEmail"
                value={formData.contactEmail}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Section 4: Religion & Languages Spoken */}
          <div className="row mb-3">
<<<<<<< HEAD
            <div className="col-md-3">
              <label className="form-label">Date of Birth</label>
              <input
                type="date"
                className="form-control"
                name="dob"
                value={formData.dob}
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Height</label>
              <input
                type="text"
                className="form-control"
                name="height"
                value={formData.height}
                onChange={handleChange}
                placeholder="e.g., 5'8&quot;"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Sex</label>
=======
            <div className="col-md-6">
              <label className="form-label">Religion</label>
>>>>>>> dev
              <select
                className="form-control"
                name="religion"
                value={formData.religion}
                onChange={handleChange}
              >
                <option value="">Select Religion</option>
                <option value="Hindu">Hindu</option>
                <option value="Muslim">Muslim</option>
                <option value="Christian">Christian</option>
                <option value="Sikh">Sikh</option>
                <option value="Buddhist">Buddhist</option>
                <option value="Jain">Jain</option>
                <option value="Jewish">Jewish</option>
                <option value="Parsi">Parsi</option>
                <option value="No Religion">No Religion</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label">Languages Spoken</label>
              <select
                multiple
                className="form-control"
                name="languagesSpoken"
                value={formData.languagesSpoken}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  setFormData(prev => ({ ...prev, languagesSpoken: selected }));
                }}
                style={{ minHeight: '100px' }}
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
                <option value="Tamil">Tamil</option>
                <option value="Telugu">Telugu</option>
                <option value="Marathi">Marathi</option>
                <option value="Bengali">Bengali</option>
                <option value="Gujarati">Gujarati</option>
                <option value="Kannada">Kannada</option>
                <option value="Malayalam">Malayalam</option>
                <option value="Punjabi">Punjabi</option>
                <option value="Urdu">Urdu</option>
                <option value="Spanish">Spanish</option>
                <option value="French">French</option>
                <option value="German">German</option>
                <option value="Chinese">Chinese</option>
                <option value="Japanese">Japanese</option>
                <option value="Korean">Korean</option>
                <option value="Arabic">Arabic</option>
                <option value="Other">Other</option>
              </select>
              <small className="text-muted">Hold Ctrl/Cmd to select multiple. Selected: {formData.languagesSpoken.length}</small>
            </div>
          </div>

          {/* Section 5: Bio / Tagline (MOVED FROM END) */}
          <TextAreaWithSamples
            label="Bio / Tagline"
            name="bio"
            value={formData.bio}
            onChange={handleChange}
            rows={3}
            placeholder="A short tagline that captures your personality..."
            samples={bioSamples}
            showSamples={true}
            helperText="Max 200 characters. This appears at the top of your profile."
          />

          {/* Section 6: Regional/Location Information */}
          <h5 className="mt-4 mb-3 text-primary">🌍 Regional & Location Information</h5>
          <div className="row mb-3">
            <div className="col-md-3">
              <label className="form-label">Country of Origin</label>
              <select
                className="form-control"
                name="countryOfOrigin"
                value={formData.countryOfOrigin}
                onChange={handleChange}
              >
                <option value="US">USA</option>
                <option value="IN">India</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Residence</label>
              <select
                className="form-control"
                name="countryOfResidence"
                value={formData.countryOfResidence}
                onChange={handleChange}
              >
                <option value="US">USA</option>
                <option value="IN">India</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">State</label>
              <input
                type="text"
                className="form-control"
                name="state"
                value={formData.state}
                onChange={handleChange}
                placeholder="e.g., California, Tamil Nadu"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Location (City)</label>
              <input
                type="text"
                className="form-control"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="City/Town"
                required
              />
            </div>
          </div>

          <div className="row mb-3">
            <div className="col-md-12">
              <label className="form-label">Citizenship Status</label>
              <select
                className="form-control"
                name="citizenshipStatus"
                value={formData.citizenshipStatus}
                onChange={handleChange}
              >
                <option value="">Select...</option>
                <option value="Citizen">Citizen</option>
                <option value="Greencard">Greencard</option>
                <option value="Work Visa">Work Visa</option>
                <option value="Student Visa">Student Visa</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Section 7: Cultural Information (India-Specific - Conditional) */}
          {formData.countryOfOrigin === 'IN' && (
            <>
              <div className="alert alert-info" style={{marginBottom: '20px'}}>
                <strong>🇮🇳 India-Specific Fields</strong> - These fields are important for matrimonial matchmaking in India
              </div>
              <h5 className="mt-4 mb-3 text-primary">🕉️ Cultural Information</h5>
              <div className="row mb-3">
                <div className="col-md-6">
                  <label className="form-label">Caste <span className="text-muted">(Optional)</span></label>
                  <input
                    type="text"
                    className="form-control"
                    name="caste"
                    value={formData.caste}
                    onChange={handleChange}
                    placeholder="e.g., Brahmin, Kshatriya, etc."
                  />
                  <small className="text-muted">Only visible to matched users</small>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Mother Tongue</label>
                  <select
                    className="form-control"
                    name="motherTongue"
                    value={formData.motherTongue}
                    onChange={handleChange}
                  >
                    <option value="">Select Language</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Tamil">Tamil</option>
                    <option value="Telugu">Telugu</option>
                    <option value="Marathi">Marathi</option>
                    <option value="Bengali">Bengali</option>
                    <option value="Gujarati">Gujarati</option>
                    <option value="Kannada">Kannada</option>
                    <option value="Malayalam">Malayalam</option>
                    <option value="Punjabi">Punjabi</option>
                    <option value="Urdu">Urdu</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-6">
                  <label className="form-label">Family Type</label>
                  <select
                    className="form-control"
                    name="familyType"
                    value={formData.familyType}
                    onChange={handleChange}
                  >
                    <option value="">Select Type</option>
                    <option value="Joint Family">Joint Family</option>
                    <option value="Nuclear Family">Nuclear Family</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Family Values</label>
                  <select
                    className="form-control"
                    name="familyValues"
                    value={formData.familyValues}
                    onChange={handleChange}
                  >
                    <option value="">Select Values</option>
                    <option value="Traditional">Traditional</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Liberal">Liberal</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Section 8: Preferences (Always Visible) */}
          <h5 className="mt-4 mb-3 text-primary">💭 Preferences</h5>
          <div className="row mb-3">
            <div className="col-md-6">
              <label className="form-label">Caste Preference</label>
              <select
                className="form-control"
                name="castePreference"
                value={formData.castePreference}
                onChange={handleChange}
              >
                <option value="">Select...</option>
                <option value="None">No Preference</option>
                <option value="Open to all">Open to all</option>
                <option value="Specific">Within caste only</option>
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label">Eating Preference</label>
              <select
                className="form-control"
                name="eatingPreference"
                value={formData.eatingPreference}
                onChange={handleChange}
              >
                <option value="">Select...</option>
                <option value="Vegetarian">Vegetarian</option>
                <option value="Eggetarian">Eggetarian</option>
                <option value="Non-Vegetarian">Non-Vegetarian</option>
                <option value="Vegan">Vegan</option>
                <option value="None">No Preference</option>
              </select>
            </div>
          </div>

          {/* Working Status */}
          <div className="mb-3">
            <label className="form-label me-3">Working Status</label>
            <div className="d-flex align-items-center">
              <div className="form-check form-check-inline">
                <input
                  className="form-check-input"
                  type="radio"
                  name="workingStatus"
                  id="workingStatusYes"
                  value="Yes"
                  checked={formData.workingStatus === 'Yes'}
                  onChange={handleChange}
                />
                <label className="form-check-label" htmlFor="workingStatusYes">
                  Yes
                </label>
              </div>
              <div className="form-check form-check-inline">
                <input
                  className="form-check-input"
                  type="radio"
                  name="workingStatus"
                  id="workingStatusNo"
                  value="No"
                  checked={formData.workingStatus === 'No'}
                  onChange={handleChange}
                />
                <label className="form-check-label" htmlFor="workingStatusNo">
                  No
                </label>
              </div>
            </div>
          </div>

          {/* Education History Section - Using Shared Component */}
          <EducationHistory
            educationHistory={educationHistory}
            setEducationHistory={setEducationHistory}
            isRequired={false}
            showValidation={false}
            errorMsg={errorMsg}
            setErrorMsg={setErrorMsg}
          />

          {/* Work Experience Section - Using Shared Component */}
          <WorkExperience
            workExperience={workExperience}
            setWorkExperience={setWorkExperience}
            isRequired={false}
            showValidation={false}
            errorMsg={errorMsg}
            setErrorMsg={setErrorMsg}
          />

          {/* LinkedIn URL - Private Field */}
          <div className="mb-3">
            <label className="form-label">
              🔗 LinkedIn Profile URL 
              <span className="badge bg-warning text-dark ms-2">🔒 Private</span>
            </label>
            <input
              type="url"
              className="form-control"
              name="linkedinUrl"
              value={formData.linkedinUrl}
              onChange={handleChange}
              placeholder="https://www.linkedin.com/in/yourprofile"
            />
            <small className="text-muted">
              This will be masked. Others need to request access to view it.
            </small>
          </div>
          {/* Personal & Lifestyle Section */}
          <h5 className="mt-4 mb-3 text-primary">👥 Personal & Lifestyle</h5>
          <div className="row mb-3">
            <div className="col-md-4">
              <label className="form-label">Relationship Status</label>
              <select
                className="form-control"
                name="relationshipStatus"
                value={formData.relationshipStatus}
                onChange={handleChange}
              >
                <option value="">Select...</option>
                <option value="Single">Single</option>
                <option value="Divorced">Divorced</option>
                <option value="Widowed">Widowed</option>
                <option value="Separated">Separated</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Looking For</label>
              <select
                className="form-control"
                name="lookingFor"
                value={formData.lookingFor}
                onChange={handleChange}
              >
                <option value="">Select...</option>
                <option value="Marriage">Marriage</option>
                <option value="Life Partner">Life Partner</option>
                <option value="Serious Relationship">Serious Relationship</option>
                <option value="Casual Dating">Casual Dating</option>
                <option value="Friendship">Friendship</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Body Type</label>
              <select
                className="form-control"
                name="bodyType"
                value={formData.bodyType}
                onChange={handleChange}
              >
                <option value="">Select...</option>
                <option value="Slim">Slim</option>
                <option value="Athletic">Athletic</option>
                <option value="Average">Average</option>
                <option value="Curvy">Curvy</option>
                <option value="Heavyset">Heavyset</option>
              </select>
            </div>
          </div>

          <div className="row mb-3">
            <div className="col-md-3">
              <label className="form-label">Drinking</label>
              <select
                className="form-control"
                name="drinking"
                value={formData.drinking}
                onChange={handleChange}
              >
                <option value="">Select...</option>
                <option value="Never">Never</option>
                <option value="Socially">Socially</option>
                <option value="Regularly">Regularly</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Smoking</label>
              <select
                className="form-control"
                name="smoking"
                value={formData.smoking}
                onChange={handleChange}
              >
                <option value="">Select...</option>
                <option value="Never">Never</option>
                <option value="Socially">Socially</option>
                <option value="Regularly">Regularly</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Has Children</label>
              <select
                className="form-control"
                name="hasChildren"
                value={formData.hasChildren}
                onChange={handleChange}
              >
                <option value="">Select...</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Wants Children</label>
              <select
                className="form-control"
                name="wantsChildren"
                value={formData.wantsChildren}
                onChange={handleChange}
              >
                <option value="">Select...</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
                <option value="Maybe">Maybe</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
          </div>

          <div className="row mb-3">
            <div className="col-md-4">
              <label className="form-label">Pets</label>
              <select
                className="form-control"
                name="pets"
                value={formData.pets}
                onChange={handleChange}
              >
                <option value="">Select...</option>
                <option value="Dog">Dog</option>
                <option value="Cat">Cat</option>
                <option value="Both">Both</option>
                <option value="Other">Other</option>
                <option value="None">None</option>
              </select>
            </div>
            <div className="col-md-8">
              <label className="form-label">Interests & Hobbies</label>
              <input
                type="text"
                className="form-control"
                name="interests"
                value={formData.interests}
                onChange={handleChange}
                placeholder="e.g., Reading, Hiking, Cooking, Photography"
              />
              <small className="text-muted">Comma-separated list</small>
            </div>
          </div>

          {/* Section 11: About & Background */}
          <h5 className="mt-4 mb-3 text-primary">📝 About & Background</h5>
          
          <TextAreaWithSamples
            label="Family Background"
            name="familyBackground"
            value={formData.familyBackground}
            onChange={handleChange}
            required
            rows={5}
            placeholder="Click the sample texts above to load a description, then customize it to your liking..."
            samples={familyBackgroundSamples}
            showSamples={true}
          />

          <TextAreaWithSamples
            label="About Me"
            name="aboutYou"
            value={formData.aboutYou}
            onChange={handleChange}
            required
            rows={5}
            placeholder="Click the sample texts above to load a description, then customize it to your liking..."
            samples={aboutYouSamples}
            showSamples={true}
          />

          <TextAreaWithSamples
            label="Partner Preference"
            name="partnerPreference"
            value={formData.partnerPreference}
            onChange={handleChange}
            required
            rows={5}
            placeholder="Click the sample texts above to load a description, then customize it to your liking..."
            samples={partnerPrefSamples}
            showSamples={true}
          />

          {/* Section 12: Partner Criteria */}
          <h5 className="mt-4 mb-3 text-primary">🎯 Partner Matching Criteria</h5>
          <p className="text-muted mb-3">Specify your preferences for a potential partner</p>
          
          {/* Age Range - Relative to Your Age */}
          <div className="mb-4" style={{ background: 'var(--info-background, #e7f3ff)', padding: '16px', borderRadius: '8px', border: '2px solid var(--info-border, #b3d9ff)' }}>
            <h6 style={{ color: 'var(--text-color, #333)', marginBottom: '12px' }}>💝 Age Preference (relative to your age)</h6>
            <div className="row mb-3">
              <div className="col-md-6">
                <label className="form-label">How much younger?</label>
                <select
                  className="form-control"
                  value={formData.partnerCriteria.ageRangeRelative.minOffset}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    partnerCriteria: {
                      ...prev.partnerCriteria,
                      ageRangeRelative: { ...prev.partnerCriteria.ageRangeRelative, minOffset: parseInt(e.target.value) }
                    }
                  }))}
                >
                  <option value="0">Same age</option>
                  <option value="-1">1 year younger</option>
                  <option value="-2">2 years younger</option>
                  <option value="-3">3 years younger</option>
                  <option value="-5">5 years younger</option>
                  <option value="-10">10 years younger</option>
                  <option value="-15">15 years younger</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">How much older?</label>
                <select
                  className="form-control"
                  value={formData.partnerCriteria.ageRangeRelative.maxOffset}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    partnerCriteria: {
                      ...prev.partnerCriteria,
                      ageRangeRelative: { ...prev.partnerCriteria.ageRangeRelative, maxOffset: parseInt(e.target.value) }
                    }
                  }))}
                >
                  <option value="0">Same age</option>
                  <option value="1">1 year older</option>
                  <option value="2">2 years older</option>
                  <option value="3">3 years older</option>
                  <option value="5">5 years older</option>
                  <option value="10">10 years older</option>
                  <option value="15">15 years older</option>
                  <option value="20">20 years older</option>
                </select>
              </div>
            </div>
            {formData.dateOfBirth && (
              <div className="alert alert-info mb-0" style={{ fontSize: '14px' }}>
                📊 <strong>Preview:</strong> Looking for ages{' '}
                <strong>{calculateAge(formData.dateOfBirth) + formData.partnerCriteria.ageRangeRelative.minOffset}</strong> to{' '}
                <strong>{calculateAge(formData.dateOfBirth) + formData.partnerCriteria.ageRangeRelative.maxOffset}</strong>{' '}
                (based on your age: {calculateAge(formData.dateOfBirth)})
              </div>
            )}
            {!formData.dateOfBirth && (
              <div className="alert alert-warning mb-0" style={{ fontSize: '13px' }}>
                ⚠️ Please set your date of birth above to see age preview
              </div>
            )}
          </div>

          {/* Height Range - Relative to Your Height */}
          <div className="mb-4" style={{ background: 'var(--info-background, #e7f3ff)', padding: '16px', borderRadius: '8px', border: '2px solid var(--info-border, #b3d9ff)' }}>
            <h6 style={{ color: 'var(--text-color, #333)', marginBottom: '12px' }}>📏 Height Preference (relative to your height)</h6>
            <div className="row mb-3">
              <div className="col-md-6">
                <label className="form-label">How much shorter?</label>
                <select
                  className="form-control"
                  value={formData.partnerCriteria.heightRangeRelative.minInches}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    partnerCriteria: {
                      ...prev.partnerCriteria,
                      heightRangeRelative: { ...prev.partnerCriteria.heightRangeRelative, minInches: parseInt(e.target.value) }
                    }
                  }))}
                >
                  <option value="0">Same height as mine</option>
                  <option value="-1">1 inch shorter</option>
                  <option value="-2">2 inches shorter</option>
                  <option value="-3">3 inches shorter</option>
                  <option value="-4">4 inches shorter</option>
                  <option value="-6">6 inches shorter</option>
                  <option value="-12">1 foot shorter</option>
                  <option value="-24">2 feet shorter</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">How much taller?</label>
                <select
                  className="form-control"
                  value={formData.partnerCriteria.heightRangeRelative.maxInches}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    partnerCriteria: {
                      ...prev.partnerCriteria,
                      heightRangeRelative: { ...prev.partnerCriteria.heightRangeRelative, maxInches: parseInt(e.target.value) }
                    }
                  }))}
                >
                  <option value="0">Same height as mine</option>
                  <option value="1">1 inch taller</option>
                  <option value="2">2 inches taller</option>
                  <option value="3">3 inches taller</option>
                  <option value="4">4 inches taller</option>
                  <option value="6">6 inches taller</option>
                  <option value="12">1 foot taller</option>
                  <option value="24">2 feet taller</option>
                </select>
              </div>
            </div>
            {formData.height && (
              <div className="alert alert-info mb-0" style={{ fontSize: '14px' }}>
                📊 <strong>Preview:</strong> Looking for heights{' '}
                <strong>{inchesToHeightString(heightToInches(formData.heightFeet, formData.heightInches) + formData.partnerCriteria.heightRangeRelative.minInches)}</strong> to{' '}
                <strong>{inchesToHeightString(heightToInches(formData.heightFeet, formData.heightInches) + formData.partnerCriteria.heightRangeRelative.maxInches)}</strong>{' '}
                (based on your height: {formData.height})
              </div>
            )}
            {!formData.height && (
              <div className="alert alert-warning mb-0" style={{ fontSize: '13px' }}>
                ⚠️ Please set your height above to see height preview
              </div>
            )}
          </div>

          {/* Education Level & Profession */}
          <div className="row mb-3">
            <div className="col-md-6">
              <label className="form-label">Preferred Education Levels</label>
              <select
                multiple
                className="form-control"
                value={formData.partnerCriteria.educationLevel}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  setFormData(prev => ({
                    ...prev,
                    partnerCriteria: { ...prev.partnerCriteria, educationLevel: selected }
                  }));
                }}
                style={{ minHeight: '80px' }}
              >
                <option value="High School">High School</option>
                <option value="Associate Degree">Associate Degree</option>
                <option value="Bachelor's Degree">Bachelor's Degree</option>
                <option value="Master's Degree">Master's Degree</option>
                <option value="Doctorate/PhD">Doctorate/PhD</option>
                <option value="Professional Degree">Professional Degree</option>
                <option value="Trade/Vocational">Trade/Vocational</option>
              </select>
              <small className="text-muted">Hold Ctrl/Cmd to select multiple</small>
            </div>
            <div className="col-md-6">
              <label className="form-label">Preferred Professions</label>
              <select
                multiple
                className="form-control"
                value={formData.partnerCriteria.profession}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  setFormData(prev => ({
                    ...prev,
                    partnerCriteria: { ...prev.partnerCriteria, profession: selected }
                  }));
                }}
                style={{ minHeight: '80px' }}
              >
                <option value="Software Engineer">Software Engineer</option>
                <option value="Doctor">Doctor</option>
                <option value="Teacher">Teacher</option>
                <option value="Business">Business</option>
                <option value="Finance">Finance</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Any">Any Profession</option>
              </select>
              <small className="text-muted">Hold Ctrl/Cmd to select multiple</small>
            </div>
          </div>

          {/* Location & Languages */}
          <div className="row mb-3">
            <div className="col-md-6">
              <label className="form-label">Preferred Locations</label>
              <select
                multiple
                className="form-control"
                value={formData.partnerCriteria.location}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  setFormData(prev => ({
                    ...prev,
                    partnerCriteria: { ...prev.partnerCriteria, location: selected }
                  }));
                }}
                style={{ minHeight: '80px' }}
              >
                <option value="USA">USA</option>
                <option value="India">India</option>
                <option value="Canada">Canada</option>
                <option value="UK">UK</option>
                <option value="Willing to Relocate">Willing to Relocate</option>
                <option value="Any">Any Location</option>
              </select>
              <small className="text-muted">Hold Ctrl/Cmd to select multiple</small>
            </div>
            <div className="col-md-6">
              <label className="form-label">Preferred Languages</label>
              <select
                multiple
                className="form-control"
                value={formData.partnerCriteria.languages}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  setFormData(prev => ({
                    ...prev,
                    partnerCriteria: { ...prev.partnerCriteria, languages: selected }
                  }));
                }}
                style={{ minHeight: '80px' }}
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
                <option value="Tamil">Tamil</option>
                <option value="Telugu">Telugu</option>
                <option value="Spanish">Spanish</option>
                <option value="Any">Any Language</option>
              </select>
              <small className="text-muted">Hold Ctrl/Cmd to select multiple</small>
            </div>
          </div>

          {/* Religion & Caste */}
          <div className="row mb-3">
            <div className="col-md-6">
              <label className="form-label">Preferred Religions</label>
              <select
                multiple
                className="form-control"
                value={formData.partnerCriteria.religion}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  setFormData(prev => ({
                    ...prev,
                    partnerCriteria: { ...prev.partnerCriteria, religion: selected }
                  }));
                }}
                style={{ minHeight: '80px' }}
              >
                <option value="Hindu">Hindu</option>
                <option value="Muslim">Muslim</option>
                <option value="Christian">Christian</option>
                <option value="Sikh">Sikh</option>
                <option value="Buddhist">Buddhist</option>
                <option value="Jain">Jain</option>
                <option value="Any">Any Religion</option>
              </select>
              <small className="text-muted">Hold Ctrl/Cmd to select multiple</small>
            </div>
            <div className="col-md-6">
              <label className="form-label">Preferred Caste</label>
              <input
                type="text"
                className="form-control"
                value={formData.partnerCriteria.caste}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  partnerCriteria: { ...prev.partnerCriteria, caste: e.target.value }
                }))}
                placeholder="Any or specific caste"
              />
            </div>
          </div>

          {/* Eating Preference, Family Type, Family Values */}
          <div className="row mb-3">
            <div className="col-md-4">
              <label className="form-label">Preferred Eating Habits</label>
              <select
                multiple
                className="form-control"
                value={formData.partnerCriteria.eatingPreference}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  setFormData(prev => ({
                    ...prev,
                    partnerCriteria: { ...prev.partnerCriteria, eatingPreference: selected }
                  }));
                }}
                style={{ minHeight: '80px' }}
              >
                <option value="Vegetarian">Vegetarian</option>
                <option value="Non-Vegetarian">Non-Vegetarian</option>
                <option value="Eggetarian">Eggetarian</option>
                <option value="Vegan">Vegan</option>
                <option value="Any">Any</option>
              </select>
              <small className="text-muted">Hold Ctrl/Cmd for multiple</small>
            </div>
            <div className="col-md-4">
              <label className="form-label">Preferred Family Types</label>
              <select
                multiple
                className="form-control"
                value={formData.partnerCriteria.familyType}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  setFormData(prev => ({
                    ...prev,
                    partnerCriteria: { ...prev.partnerCriteria, familyType: selected }
                  }));
                }}
                style={{ minHeight: '80px' }}
              >
                <option value="Nuclear Family">Nuclear Family</option>
                <option value="Joint Family">Joint Family</option>
                <option value="Extended Family">Extended Family</option>
                <option value="Any">Any</option>
              </select>
              <small className="text-muted">Hold Ctrl/Cmd for multiple</small>
            </div>
            <div className="col-md-4">
              <label className="form-label">Preferred Family Values</label>
              <select
                multiple
                className="form-control"
                value={formData.partnerCriteria.familyValues}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  setFormData(prev => ({
                    ...prev,
                    partnerCriteria: { ...prev.partnerCriteria, familyValues: selected }
                  }));
                }}
                style={{ minHeight: '80px' }}
              >
                <option value="Traditional">Traditional</option>
                <option value="Moderate">Moderate</option>
                <option value="Liberal">Liberal</option>
                <option value="Conservative">Conservative</option>
                <option value="Any">Any</option>
              </select>
              <small className="text-muted">Hold Ctrl/Cmd for multiple</small>
            </div>
          </div>

          {/* Image Manager - Drag & Drop with Profile Pic Selection */}
          <ImageManager
            existingImages={existingImages}
            setExistingImages={setExistingImages}
            imagesToDelete={imagesToDelete}
            setImagesToDelete={setImagesToDelete}
            newImages={newImages}
            setNewImages={setNewImages}
            onError={setErrorMsg}
          />

          {/* Action Buttons */}
          <div className="d-flex justify-content-between align-items-center mt-4 gap-2">
            <div className="d-flex gap-2">
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={saving}
              >
                {saving ? 'Saving...' : '💾 Save Changes'}
              </button>
              
              <button
                type="button"
                className="btn btn-info btn-lg"
                onClick={() => setShowPreview(true)}
                disabled={saving}
              >
                👁️ Preview
              </button>
            </div>

            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
            >
              🗑️ Delete Profile
            </button>
          </div>
        </form>
      </div>

      {/* Profile Preview Modal */}
      {showPreview && (
        <ProfilePreview
          user={{
            ...formData,
            educationHistory,
            workExperience,
            images: existingImages,
            username: localStorage.getItem('username')
          }}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h4>⚠️ Confirm Profile Deletion</h4>
            <p>
              Are you sure you want to delete your profile? This action cannot be undone.
              All your data and images will be permanently removed.
            </p>
            <div className="d-flex justify-content-end gap-2 mt-4">
              <button
                className="btn btn-secondary"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteProfile}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete My Profile'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditProfile;
