import React, { useState, useEffect } from 'react';
import './ProfileConfirmationModal.css';

/**
 * Profile Confirmation Modal (Modal 1 Style)
 * 
 * Shows editable summary of profile data before final submission
 * Features:
 * - Purple gradient header with dark close button
 * - Editable fields for quick fixes
 * - ESC key to close
 * - Validation before proceeding
 */
const ProfileConfirmationModal = ({
  formData,
  onConfirm,
  onCancel,
  onFieldChange,
  isSubmitting = false,
  isEditMode = false
}) => {
  const [localData, setLocalData] = useState(formData);

  // ESC key handler
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [onCancel, isSubmitting]);

  // Update local data when formData changes
  useEffect(() => {
    setLocalData(formData);
  }, [formData]);

  const handleLocalChange = (field, value) => {
    setLocalData(prev => ({ ...prev, [field]: value }));
    if (onFieldChange) {
      onFieldChange(field, value);
    }
  };

  const handleConfirm = () => {
    // Sync local changes back to parent
    Object.keys(localData).forEach(key => {
      if (localData[key] !== formData[key] && onFieldChange) {
        onFieldChange(key, localData[key]);
      }
    });
    onConfirm();
  };

  // Calculate age from DOB
  const calculateAge = (dob) => {
    if (!dob) return 'Not provided';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="profile-confirmation-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal 1 Style Header */}
        <div className="modal-header">
          <h2>📋 Confirm Your Profile</h2>
          <button className="modal-close" onClick={onCancel} disabled={isSubmitting}>✕</button>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="modal-body">
          <p className="confirmation-intro">
            Please review your information below. You can edit any field before submitting.
          </p>

          {/* Personal Information */}
          <div className="confirmation-section">
            <h4 className="section-title">👤 Personal Information</h4>
            <div className="field-grid">
              <div className="field-item">
                <label>Name:</label>
                <div className="field-display">
                  <input
                    type="text"
                    value={localData.firstName || ''}
                    onChange={(e) => handleLocalChange('firstName', e.target.value)}
                    disabled={isSubmitting}
                  />
                  <input
                    type="text"
                    value={localData.lastName || ''}
                    onChange={(e) => handleLocalChange('lastName', e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {!isEditMode && (
                <div className="field-item">
                  <label>Username:</label>
                  <div className="field-display">
                    <input
                      type="text"
                      value={localData.username || ''}
                      onChange={(e) => handleLocalChange('username', e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              )}

              <div className="field-item">
                <label>Age:</label>
                <div className="field-display">{calculateAge(localData.dateOfBirth)} years</div>
              </div>

              <div className="field-item">
                <label>Gender:</label>
                <div className="field-display">{localData.gender || 'Not specified'}</div>
              </div>

              <div className="field-item">
                <label>Height:</label>
                <div className="field-display">
                  {localData.heightFeet && localData.heightInches !== '' 
                    ? `${localData.heightFeet}'${localData.heightInches}"` 
                    : 'Not specified'}
                </div>
              </div>

              <div className="field-item">
                <label>Contact:</label>
                <div className="field-display">
                  <input
                    type="email"
                    value={localData.contactEmail || ''}
                    onChange={(e) => handleLocalChange('contactEmail', e.target.value)}
                    disabled={isSubmitting}
                  />
                  <input
                    type="tel"
                    value={localData.contactNumber || ''}
                    onChange={(e) => handleLocalChange('contactNumber', e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="field-item">
                <label>Location:</label>
                <div className="field-display">
                  {localData.location}, {localData.state}, {localData.countryOfResidence}
                </div>
              </div>
            </div>
          </div>

          {/* Education & Work */}
          <div className="confirmation-section">
            <h4 className="section-title">🎓 Qualifications</h4>
            <div className="field-grid">
              <div className="field-item">
                <label>Education:</label>
                <div className="field-display">
                  {localData.educationHistory?.length > 0 
                    ? `${localData.educationHistory.length} ${localData.educationHistory.length === 1 ? 'entry' : 'entries'}`
                    : 'None added'}
                </div>
              </div>

              <div className="field-item">
                <label>Work Experience:</label>
                <div className="field-display">
                  {localData.workExperience?.length > 0 
                    ? `${localData.workExperience.length} ${localData.workExperience.length === 1 ? 'entry' : 'entries'}`
                    : 'None added'}
                </div>
              </div>
            </div>
          </div>

          {/* About Me */}
          {localData.aboutMe && (
            <div className="confirmation-section">
              <h4 className="section-title">✍️ About Me</h4>
              <textarea
                value={localData.aboutMe || ''}
                onChange={(e) => handleLocalChange('aboutMe', e.target.value)}
                disabled={isSubmitting}
                rows="3"
              />
            </div>
          )}

          {/* Partner Preferences */}
          {localData.partnerPreference && (
            <div className="confirmation-section">
              <h4 className="section-title">💕 Partner Preferences</h4>
              <textarea
                value={localData.partnerPreference || ''}
                onChange={(e) => handleLocalChange('partnerPreference', e.target.value)}
                disabled={isSubmitting}
                rows="3"
              />
            </div>
          )}

          {/* Warning if incomplete */}
          {(!localData.educationHistory || localData.educationHistory.length === 0 || 
            !localData.workExperience || localData.workExperience.length === 0) && (
            <div className="alert alert-warning">
              ⚠️ Some sections appear incomplete. Please ensure you've added education and work experience entries.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button 
            className="btn-secondary" 
            onClick={onCancel}
            disabled={isSubmitting}
          >
            ← Go Back & Edit
          </button>
          <button 
            className="btn-primary" 
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="spinner"></span>
                {isEditMode ? 'Saving...' : 'Registering...'}
              </>
            ) : (
              isEditMode ? '💾 Save Profile' : '🚀 Register My Profile'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileConfirmationModal;
