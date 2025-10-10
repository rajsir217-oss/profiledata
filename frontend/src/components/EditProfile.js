import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './EditProfile.css';

const EditProfile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
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
    partnerPreference: ''
  });

  const [images, setImages] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [imagesToDelete, setImagesToDelete] = useState([]);

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
          partnerPreference: userData.partnerPreference || ''
        });

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
            <label className="form-label">Education</label>
            <textarea
              className="form-control"
              name="education"
              value={formData.education}
              onChange={handleChange}
              rows={3}
              required
            />
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

          <div className="mb-3">
            <label className="form-label">About You</label>
            <textarea
              className="form-control"
              name="aboutYou"
              value={formData.aboutYou}
              onChange={handleChange}
              rows={3}
              required
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Partner Preference</label>
            <textarea
              className="form-control"
              name="partnerPreference"
              value={formData.partnerPreference}
              onChange={handleChange}
              rows={3}
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
          <div className="d-flex justify-content-between align-items-center mt-4">
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={saving}
            >
              {saving ? 'Saving...' : '💾 Save Changes'}
            </button>

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
