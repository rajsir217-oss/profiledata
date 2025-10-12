import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import ProfilePreview from './ProfilePreview';
import './EditProfile.css';

const EditProfile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    contactNumber: '',
    contactEmail: '',
    dob: '',
    sex: '',
    height: '',
    castePreference: '',
    eatingPreference: '',
    location: '',
    education: '',
    workingStatus: 'Yes',
    workplace: '',
    citizenshipStatus: 'Citizen',
    familyBackground: '',
    aboutYou: '',
    partnerPreference: '',
    linkedinUrl: ''
  });

  const [educationHistory, setEducationHistory] = useState([]);
  const [workExperience, setWorkExperience] = useState([]);

  const [images, setImages] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [imagesToDelete, setImagesToDelete] = useState([]);

  // Sample description carousel states
  const [aboutYouSampleIndex, setAboutYouSampleIndex] = useState(0);
  const [partnerPrefSampleIndex, setPartnerPrefSampleIndex] = useState(0);

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

        // Populate form with existing data
        setFormData({
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          contactNumber: userData.contactNumber || '',
          contactEmail: userData.contactEmail || '',
          dob: userData.dob || '',
          sex: userData.sex || '',
          height: userData.height || '',
          castePreference: userData.castePreference || '',
          eatingPreference: userData.eatingPreference || '',
          location: userData.location || '',
          education: userData.education || '',
          workingStatus: userData.workingStatus || 'Yes',
          workplace: userData.workplace || '',
          citizenshipStatus: userData.citizenshipStatus || 'Citizen',
          familyBackground: userData.familyBackground || '',
          aboutYou: userData.aboutYou || '',
          partnerPreference: userData.partnerPreference || '',
          linkedinUrl: userData.linkedinUrl || ''
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

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + existingImages.length - imagesToDelete.length > 5) {
      setErrorMsg('❌ Maximum 5 images allowed in total');
      return;
    }
    setImages(files);
    setErrorMsg('');
  };

  const handleRemoveExistingImage = (imageUrl) => {
    setImagesToDelete(prev => [...prev, imageUrl]);
    setExistingImages(prev => prev.filter(img => img !== imageUrl));
  };

  // Education handlers
  const addEducation = () => {
    setEducationHistory([...educationHistory, { degree: '', institution: '', year: '' }]);
  };

  const updateEducation = (index, field, value) => {
    const updated = [...educationHistory];
    updated[index][field] = value;
    setEducationHistory(updated);
  };

  const removeEducation = (index) => {
    setEducationHistory(educationHistory.filter((_, i) => i !== index));
  };

  // Work experience handlers
  const addWorkExperience = () => {
    setWorkExperience([...workExperience, { position: '', company: '', years: '' }]);
  };

  const updateWorkExperience = (index, field, value) => {
    const updated = [...workExperience];
    updated[index][field] = value;
    setWorkExperience(updated);
  };

  const removeWorkExperience = (index) => {
    setWorkExperience(workExperience.filter((_, i) => i !== index));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const username = localStorage.getItem('username');
      
      // Prepare form data
      const data = new FormData();
      Object.keys(formData).forEach(key => {
        if (formData[key] && formData[key].toString().trim()) {
          data.append(key, formData[key]);
        }
      });
      
      // Add structured data as JSON strings
      if (educationHistory.length > 0) {
        data.append('educationHistory', JSON.stringify(educationHistory));
      }
      if (workExperience.length > 0) {
        data.append('workExperience', JSON.stringify(workExperience));
      }
      
      // Add new images
      images.forEach(img => data.append('images', img));
      
      // Add images to delete
      if (imagesToDelete.length > 0) {
        data.append('imagesToDelete', JSON.stringify(imagesToDelete));
      }
      
      // Log what we're sending
      console.log('📤 Sending update request for:', username);
      console.log('📝 Form fields being sent:');
      for (let [key, value] of data.entries()) {
        if (key !== 'images') {
          console.log(`  ${key}: ${value}`);
        }
      }
      console.log(`📸 Images: ${images.length} new file(s)`);
      console.log(`🗑️ Images to delete: ${imagesToDelete.length}`, imagesToDelete);
      
      // Send update request with proper headers
      const response = await api.put(`/profile/${username}`, data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      console.log('✅ Update response:', response.data);
      setSuccessMsg('✅ ' + response.data.message);
      
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
          {/* Name Fields */}
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

          {/* Contact Fields */}
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

          {/* Personal Details */}
          <div className="row mb-3">
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
                required
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Sex</label>
              <select
                className="form-control"
                name="sex"
                value={formData.sex}
                onChange={handleChange}
                required
              >
                <option value="">Select...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Citizenship Status</label>
              <select
                className="form-control"
                name="citizenshipStatus"
                value={formData.citizenshipStatus}
                onChange={handleChange}
              >
                <option>Citizen</option>
                <option>Greencard</option>
              </select>
            </div>
          </div>

          {/* Preferences */}
          <div className="row mb-3">
            <div className="col-md-4">
              <label className="form-label">Caste Preference</label>
              <input
                type="text"
                className="form-control"
                name="castePreference"
                value={formData.castePreference}
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Eating Preference</label>
              <select
                className="form-control"
                name="eatingPreference"
                value={formData.eatingPreference}
                onChange={handleChange}
                required
              >
                <option value="">Select...</option>
                <option value="Vegetarian">Vegetarian</option>
                <option value="Eggetarian">Eggetarian</option>
                <option value="Non-Veg">Non-Veg</option>
                <option value="Others">Others</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Location</label>
              <input
                type="text"
                className="form-control"
                name="location"
                value={formData.location}
                onChange={handleChange}
                required
              />
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

          {/* Text Areas */}
          <div className="mb-3">
            <label className="form-label">Education (Legacy - for backward compatibility)</label>
            <textarea
              className="form-control"
              name="education"
              value={formData.education}
              onChange={handleChange}
              rows={3}
            />
          </div>

          {/* Education History Section */}
          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <label className="form-label mb-0">🎓 Education History</label>
              <button type="button" className="btn btn-sm btn-primary" onClick={addEducation}>
                + Add Education
              </button>
            </div>
            {educationHistory.map((edu, index) => (
              <div key={index} className="card mb-2 p-3 bg-light">
                <div className="row">
                  <div className="col-md-4">
                    <input
                      type="text"
                      className="form-control form-control-sm mb-2"
                      placeholder="Degree (e.g., B.S. Computer Science)"
                      value={edu.degree}
                      onChange={(e) => updateEducation(index, 'degree', e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <input
                      type="text"
                      className="form-control form-control-sm mb-2"
                      placeholder="Institution (e.g., MIT)"
                      value={edu.institution}
                      onChange={(e) => updateEducation(index, 'institution', e.target.value)}
                    />
                  </div>
                  <div className="col-md-3">
                    <input
                      type="text"
                      className="form-control form-control-sm mb-2"
                      placeholder="Year (e.g., 2015-2019)"
                      value={edu.year}
                      onChange={(e) => updateEducation(index, 'year', e.target.value)}
                    />
                  </div>
                  <div className="col-md-1 text-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => removeEducation(index)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Work Experience Section */}
          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <label className="form-label mb-0">💼 Work Experience</label>
              <button type="button" className="btn btn-sm btn-primary" onClick={addWorkExperience}>
                + Add Work Experience
              </button>
            </div>
            {workExperience.map((work, index) => (
              <div key={index} className="card mb-2 p-3 bg-light">
                <div className="row">
                  <div className="col-md-4">
                    <input
                      type="text"
                      className="form-control form-control-sm mb-2"
                      placeholder="Position (e.g., Senior Engineer)"
                      value={work.position}
                      onChange={(e) => updateWorkExperience(index, 'position', e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <input
                      type="text"
                      className="form-control form-control-sm mb-2"
                      placeholder="Company (e.g., Google)"
                      value={work.company}
                      onChange={(e) => updateWorkExperience(index, 'company', e.target.value)}
                    />
                  </div>
                  <div className="col-md-3">
                    <input
                      type="text"
                      className="form-control form-control-sm mb-2"
                      placeholder="Years (e.g., 2019-Present)"
                      value={work.years}
                      onChange={(e) => updateWorkExperience(index, 'years', e.target.value)}
                    />
                  </div>
                  <div className="col-md-1 text-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => removeWorkExperience(index)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

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

          <div className="mb-3">
            <label className="form-label">Workplace</label>
            <textarea
              className="form-control"
              name="workplace"
              value={formData.workplace}
              onChange={handleChange}
              rows={3}
              required
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Family Background</label>
            <textarea
              className="form-control"
              name="familyBackground"
              value={formData.familyBackground}
              onChange={handleChange}
              rows={3}
              required
            />
          </div>

          {/* About You with Sample Carousel */}
          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <label className="form-label mb-0">About You</label>
              <div className="d-flex align-items-center gap-2">
                <small className="text-muted" style={{ fontSize: '13px' }}>Samples:</small>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => setAboutYouSampleIndex((prev) => (prev - 1 + aboutYouSamples.length) % aboutYouSamples.length)}
                  style={{ padding: '4px 10px', fontSize: '16px', lineHeight: '1', borderRadius: '6px' }}
                  title="Previous sample"
                >
                  ‹
                </button>
                <span className="badge bg-primary" style={{ minWidth: '50px', padding: '6px 10px', fontSize: '13px', borderRadius: '6px' }}>
                  {aboutYouSampleIndex + 1}/{aboutYouSamples.length}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => setAboutYouSampleIndex((prev) => (prev + 1) % aboutYouSamples.length)}
                  style={{ padding: '4px 10px', fontSize: '16px', lineHeight: '1', borderRadius: '6px' }}
                  title="Next sample"
                >
                  ›
              </button>
            </div>
          </div>
          <div 
              className="card p-2 mb-2" 
              onClick={() => setFormData({ ...formData, aboutYou: aboutYouSamples[aboutYouSampleIndex] })}
              style={{ 
                backgroundColor: '#f8f9fa', 
                border: '1px dashed #dee2e6',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e3f2fd';
                e.currentTarget.style.borderColor = '#2196f3';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f8f9fa';
                e.currentTarget.style.borderColor = '#dee2e6';
              }}
              title="Click to load this sample"
            >
              <small className="text-muted" style={{ fontSize: '12px', lineHeight: '1.4' }}>
                <strong>Sample {aboutYouSampleIndex + 1}:</strong> {aboutYouSamples[aboutYouSampleIndex].substring(0, 150)}... <span style={{ color: '#2196f3', fontWeight: 'bold' }}>↓ Click to use</span>
              </small>
            </div>
            <textarea
              className="form-control"
              name="aboutYou"
              value={formData.aboutYou}
              onChange={handleChange}
              rows={5}
              placeholder="Click 'Use This Sample' above to load a sample description, then customize it to your liking..."
              required
            />
          </div>

          {/* Partner Preference with Sample Carousel */}
          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <label className="form-label mb-0">Partner Preference</label>
              <div className="d-flex align-items-center gap-2">
                <small className="text-muted" style={{ fontSize: '13px' }}>Samples:</small>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => setPartnerPrefSampleIndex((prev) => (prev - 1 + partnerPrefSamples.length) % partnerPrefSamples.length)}
                  style={{ padding: '4px 10px', fontSize: '16px', lineHeight: '1', borderRadius: '6px' }}
                  title="Previous sample"
                >
                  ‹
                </button>
                <span className="badge bg-primary" style={{ minWidth: '50px', padding: '6px 10px', fontSize: '13px', borderRadius: '6px' }}>
                  {partnerPrefSampleIndex + 1}/{partnerPrefSamples.length}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => setPartnerPrefSampleIndex((prev) => (prev + 1) % partnerPrefSamples.length)}
                  style={{ padding: '4px 10px', fontSize: '16px', lineHeight: '1', borderRadius: '6px' }}
                  title="Next sample"
                >
                  ›
                </button>
              </div>
            </div>
            <div 
              className="card p-2 mb-2" 
              onClick={() => setFormData({ ...formData, partnerPreference: partnerPrefSamples[partnerPrefSampleIndex] })}
              style={{ 
                backgroundColor: '#f8f9fa', 
                border: '1px dashed #dee2e6',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e3f2fd';
                e.currentTarget.style.borderColor = '#2196f3';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f8f9fa';
                e.currentTarget.style.borderColor = '#dee2e6';
              }}
              title="Click to load this sample"
            >
              <small className="text-muted" style={{ fontSize: '12px', lineHeight: '1.4' }}>
                <strong>Sample {partnerPrefSampleIndex + 1}:</strong> {partnerPrefSamples[partnerPrefSampleIndex].substring(0, 150)}... <span style={{ color: '#2196f3', fontWeight: 'bold' }}>↓ Click to use</span>
              </small>
            </div>
            <textarea
              className="form-control"
              name="partnerPreference"
              value={formData.partnerPreference}
              onChange={handleChange}
              rows={5}
              placeholder="Click 'Use This Sample' above to load a sample description, then customize it to your liking..."
              required
            />
          </div>

          {/* Existing Images */}
          {existingImages.length > 0 && (
            <div className="mb-3">
              <label className="form-label">Current Images</label>
              <div className="row">
                {existingImages.map((img, idx) => (
                  <div key={idx} className="col-md-3 mb-3">
                    <div className="position-relative">
                      <img
                        src={img}
                        alt={`Profile ${idx + 1}`}
                        className="img-thumbnail"
                        style={{ width: '100%', height: '150px', objectFit: 'cover' }}
                      />
                      <button
                        type="button"
                        className="btn btn-danger btn-sm position-absolute top-0 end-0 m-1"
                        onClick={() => handleRemoveExistingImage(img)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Images Upload */}
          <div className="mb-3">
            <label className="form-label">Upload New Images (Max 5 total)</label>
            <input
              type="file"
              className="form-control"
              multiple
              accept="image/*"
              onChange={handleImageChange}
            />
            <small className="text-muted">
              Current: {existingImages.length} | New: {images.length} | 
              Total: {existingImages.length + images.length}
            </small>
          </div>

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
