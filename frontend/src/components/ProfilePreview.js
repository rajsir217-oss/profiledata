import React from 'react';
import { getImageUrl } from '../utils/urlHelper';
import './ProfilePreview.css';

const ProfilePreview = ({ user, onClose }) => {
  const calculateAge = (birthMonth, birthYear) => {
    if (!birthMonth || !birthYear) return 'N/A';
    const today = new Date();
    let age = today.getFullYear() - birthYear;
    if (today.getMonth() + 1 < birthMonth) {
      age--;
    }
    return age;
  };

  return (
    <div className="profile-preview-overlay" onClick={onClose}>
      <div className="profile-preview-container" onClick={(e) => e.stopPropagation()}>
        {/* Header with Close Button */}
        <div className="preview-header">
          <h4>📄 Profile Preview</h4>
          <button className="preview-close-btn" onClick={onClose} title="Close Preview">
            ✕
          </button>
        </div>

        {/* One-Pager Content */}
        <div className="profile-one-pager">
          {/* Top Section - Name & Photo */}
          <div className="onepager-header">
            <div className="onepager-name-section">
              <h1 className="onepager-name">
                {user.firstName} {user.lastName}
              </h1>
              <p className="onepager-username">@{user.username}</p>
            </div>
            {user.images && user.images.length > 0 && (
              <div className="onepager-photo">
                <img src={getImageUrl(user.images[0])} alt="Profile" />
              </div>
            )}
          </div>

          {/* Key Details Grid */}
          <div className="onepager-details-grid">
            <div className="detail-item">
              <span className="detail-label">Age</span>
              <span className="detail-value">{user.age || calculateAge(user.birthMonth, user.birthYear)} years</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Height</span>
              <span className="detail-value">{user.height || 'N/A'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Location</span>
              <span className="detail-value">{user.location || 'N/A'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Status</span>
              <span className="detail-value">{user.citizenshipStatus || 'N/A'}</span>
            </div>
          </div>

          {/* Education Section */}
          {user.educationHistory && user.educationHistory.length > 0 && (
            <div className="onepager-section">
              <h3 className="section-title">🎓 Education</h3>
              <div className="education-list">
                {user.educationHistory.map((edu, idx) => (
                  <div key={idx} className="education-item">
                    <strong>{edu.degree}</strong>
                    <span className="edu-institution">{edu.institution}</span>
                    <span className="edu-year">{edu.year}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Work Experience Section */}
          {user.workExperience && user.workExperience.length > 0 && (
            <div className="onepager-section">
              <h3 className="section-title">💼 Work Experience</h3>
              <div className="work-list">
                {user.workExperience.map((work, idx) => (
                  <div key={idx} className="work-item">
                    <strong>{work.position}</strong>
                    <span className="work-company">{work.company}</span>
                    <span className="work-years">{work.years}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* About Section */}
          {user.aboutYou && (
            <div className="onepager-section">
              <h3 className="section-title">👤 About</h3>
              <p className="onepager-text">{user.aboutYou}</p>
            </div>
          )}

          {/* Preferences */}
          <div className="onepager-section">
            <h3 className="section-title">✨ Preferences</h3>
            <div className="preferences-grid">
              {user.castePreference && (
                <div className="pref-item">
                  <span className="pref-label">Community:</span>
                  <span className="pref-value">{user.castePreference}</span>
                </div>
              )}
              {user.eatingPreference && (
                <div className="pref-item">
                  <span className="pref-label">Diet:</span>
                  <span className="pref-value">{user.eatingPreference}</span>
                </div>
              )}
            </div>
          </div>

          {/* Partner Preference */}
          {user.partnerPreference && (
            <div className="onepager-section">
              <h3 className="section-title">💑 Looking For</h3>
              <p className="onepager-text">{user.partnerPreference}</p>
            </div>
          )}

          {/* Contact Info Footer (if visible) */}
          {!user.contactEmailMasked && user.contactEmail && (
            <div className="onepager-footer">
              <div className="contact-item">
                <span className="contact-icon">📧</span>
                <span>{user.contactEmail}</span>
              </div>
              {!user.contactNumberMasked && user.contactNumber && (
                <div className="contact-item">
                  <span className="contact-icon">📱</span>
                  <span>{user.contactNumber}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="preview-footer">
          <button className="btn-preview-close" onClick={onClose}>
            Close Preview
          </button>
          <button 
            className="btn-preview-print" 
            onClick={() => window.print()}
            title="Print or save as PDF"
          >
            🖨️ Print/PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePreview;
