import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import PIIRequestModal from "./PIIRequestModal";
import onlineStatusService from "../services/onlineStatusService";
import "./Profile.css";

const Profile = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  
  console.log('📍 Profile component loaded for username:', username);
  
  // Check for status message from ProtectedRoute
  useEffect(() => {
    const message = sessionStorage.getItem('statusMessage');
    if (message) {
      setStatusMessage(message);
      sessionStorage.removeItem('statusMessage');
      // Auto-hide after 10 seconds
      setTimeout(() => setStatusMessage(""), 10000);
    }
  }, []);
  
  // PII Access states
  const [piiAccess, setPiiAccess] = useState({
    images: false,
    contact_info: false,
    dob: false
  });
  const [showPIIRequestModal, setShowPIIRequestModal] = useState(false);
  
  const currentUsername = localStorage.getItem('username');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // Pass requester to properly handle PII masking
        const res = await api.get(`/profile/${username}?requester=${currentUsername}`);
        setUser(res.data);
        
        // Check if this is the current user's profile
        setIsOwnProfile(currentUsername === username);
        
        // Track profile view (only if viewing someone else's profile)
        if (currentUsername && currentUsername !== username) {
          try {
            await api.post('/profile-views', {
              profileUsername: username,
              viewedByUsername: currentUsername
            });
          } catch (viewErr) {
            // Silently fail - don't block profile loading if tracking fails
            console.error("Error tracking profile view:", viewErr);
          }
          
          // Check PII access
          await checkPIIAccess();
          
          // Check initial online status using service
          const online = await onlineStatusService.isUserOnline(username);
          setIsOnline(online);
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError("Unable to load profile");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
    
    // Poll for PII access changes every 10 seconds
    const accessCheckInterval = setInterval(() => {
      if (currentUsername && currentUsername !== username) {
        checkPIIAccess();
      }
    }, 10000);
    
    // Subscribe to online status changes for this user
    const unsubscribe = onlineStatusService.subscribe((changedUsername, online) => {
      if (changedUsername === username) {
        console.log(`🔄 Status update for ${username}:`, online ? 'online' : 'offline');
        setIsOnline(online);
      }
    });
    
    return () => {
      clearInterval(accessCheckInterval);
      unsubscribe();
    };
  }, [username, currentUsername]);

  const checkPIIAccess = async () => {
    if (!currentUsername || isOwnProfile) return;
    
    try {
      const [imagesRes, contactRes, dobRes] = await Promise.all([
        api.get(`/pii-access/check?requester=${currentUsername}&profile_owner=${username}&access_type=images`),
        api.get(`/pii-access/check?requester=${currentUsername}&profile_owner=${username}&access_type=contact_info`),
        api.get(`/pii-access/check?requester=${currentUsername}&profile_owner=${username}&access_type=dob`)
      ]);
      
      setPiiAccess({
        images: imagesRes.data.hasAccess,
        contact_info: contactRes.data.hasAccess,
        dob: dobRes.data.hasAccess
      });
    } catch (err) {
      console.error("Error checking PII access:", err);
    }
  };

  const calculateAge = (dob) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleEditProfile = () => {
    navigate('/edit-profile');
  };

  if (loading) return <p>Loading profile...</p>;
  if (error) return <p className="text-danger">{error}</p>;
  if (!user) return <p>No profile found.</p>;

  const age = user.dob ? calculateAge(user.dob) : null;
  
  // Check if user has all access
  const hasAllAccess = isOwnProfile || (piiAccess.images && piiAccess.contact_info && piiAccess.dob);
  const hasAnyAccess = piiAccess.images || piiAccess.contact_info || piiAccess.dob;

  return (
    <div className="container mt-4">
      {/* Status Message Bubble */}
      {statusMessage && (
        <div className="status-bubble" style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '12px',
          padding: '12px 16px',
          maxWidth: '350px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
          animation: 'slideInRight 0.3s ease-out'
        }}>
          <span style={{ fontSize: '20px', flexShrink: 0 }}>⚠️</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ color: '#856404', display: 'block', fontSize: '13px', marginBottom: '4px' }}>
              Account Status
            </strong>
            <p style={{ color: '#856404', margin: 0, fontSize: '12px', lineHeight: '1.4' }}>
              {statusMessage}
            </p>
          </div>
          <button 
            onClick={() => setStatusMessage("")}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              color: '#856404',
              padding: '0',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Success Message Bubble */}
      {successMessage && (
        <div className="status-bubble" style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          backgroundColor: '#d4edda',
          border: '1px solid #c3e6cb',
          borderRadius: '12px',
          padding: '12px 16px',
          maxWidth: '350px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
          animation: 'slideInRight 0.3s ease-out'
        }}>
          <span style={{ fontSize: '20px', flexShrink: 0 }}>✅</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ color: '#155724', display: 'block', fontSize: '13px', marginBottom: '4px' }}>
              Success
            </strong>
            <p style={{ color: '#155724', margin: 0, fontSize: '12px', lineHeight: '1.4' }}>
              {successMessage}
            </p>
          </div>
          <button 
            onClick={() => setSuccessMessage("")}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              color: '#155724',
              padding: '0',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <div className="profile-header">
        <div className="profile-title-section">
          <h2>
            {user.firstName} {user.lastName}
            {!isOwnProfile && (
              <span className={`status-bulb-profile ${isOnline ? 'online' : 'offline'}`} title={isOnline ? 'Online Now' : 'Offline'}>
                {isOnline ? '🟢' : '⚪'}
              </span>
            )}
          </h2>
          {/* {!isOwnProfile && (
            <p className="online-status-text">
              {isOnline ? '🟢 Online now' : '⚪ Offline'}
              <span style={{fontSize: '10px', marginLeft: '10px', color: '#999'}}>
                (Debug: {username})
              </span>
            </p>
          )} */}
        </div>
        {isOwnProfile && (
          <button 
            className="btn-edit-profile"
            onClick={handleEditProfile}
            title="Edit Profile"
          >
            <span>✏️</span>
            <span>Edit Profile</span>
          </button>
        )}
      </div>

      {/* PII Request Button (only for others' profiles) */}
      {!isOwnProfile && (
        <div className="pii-request-section">
          {hasAllAccess ? (
            <>
              <button
                className="btn-request-access disabled"
                disabled
              >
                ✅ You Have All Private Information Access
              </button>
              <p className="pii-hint">You can view all photos, contact info, and date of birth</p>
            </>
          ) : (
            <>
              <button
                className="btn-request-access"
                onClick={() => setShowPIIRequestModal(true)}
              >
                🔒 Request Private Information Access
              </button>
              <p className="pii-hint">
                {hasAnyAccess 
                  ? 'Request additional access to photos, contact info, or date of birth'
                  : 'Request access to photos, contact info, or date of birth'
                }
              </p>
            </>
          )}
        </div>
      )}
      
      {/* Basic Info (Always visible) */}
      <div className="profile-section">
        <h3>👤 Basic Information</h3>
        <div className="profile-info">
          <p><strong>Username:</strong> {user.username}</p>
          <p><strong>Sex:</strong> {user.sex}</p>
          {age && <p><strong>Age:</strong> {age} years</p>}
          <p><strong>Height:</strong> {user.height}</p>
          <p><strong>Location:</strong> {user.location}</p>
          <p><strong>Education:</strong> {user.education}</p>
          <p><strong>Working Status:</strong> {user.workingStatus}</p>
          {user.workplace && <p><strong>Workplace:</strong> {user.workplace}</p>}
          <p><strong>Citizenship Status:</strong> {user.citizenshipStatus}</p>
        </div>
      </div>

      {/* Education History */}
      {user.educationHistory && user.educationHistory.length > 0 && (
        <div className="profile-section">
          <h3>🎓 Education History</h3>
          <div className="profile-info">
            {user.educationHistory.map((edu, idx) => (
              <div key={idx} style={{marginBottom: '15px', paddingBottom: '15px', borderBottom: idx < user.educationHistory.length - 1 ? '1px solid #eee' : 'none'}}>
                <p><strong>{edu.degree}</strong></p>
                <p style={{marginLeft: '10px', color: '#666'}}>{edu.institution}</p>
                <p style={{marginLeft: '10px', color: '#999', fontSize: '14px'}}>{edu.year}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Work Experience */}
      {user.workExperience && user.workExperience.length > 0 && (
        <div className="profile-section">
          <h3>💼 Work Experience</h3>
          <div className="profile-info">
            {user.workExperience.map((work, idx) => (
              <div key={idx} style={{marginBottom: '15px', paddingBottom: '15px', borderBottom: idx < user.workExperience.length - 1 ? '1px solid #eee' : 'none'}}>
                <p><strong>{work.position}</strong></p>
                <p style={{marginLeft: '10px', color: '#666'}}>{work.company}</p>
                <p style={{marginLeft: '10px', color: '#999', fontSize: '14px'}}>{work.years}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LinkedIn URL (PII Protected) */}
      {user.linkedinUrl && (
        <div className="profile-section">
          <h3>🔗 LinkedIn Profile</h3>
          {isOwnProfile || !user.linkedinUrlMasked ? (
            <div className="profile-info">
              <p>
                <a href={user.linkedinUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
                  🔗 View LinkedIn Profile
                </a>
              </p>
            </div>
          ) : (
            <div className="pii-locked">
              <div className="lock-icon">🔒</div>
              <p>LinkedIn profile is private</p>
              <button
                className="btn-request-small"
                onClick={() => setShowPIIRequestModal(true)}
              >
                Request Access
              </button>
            </div>
          )}
        </div>
      )}

      {/* Contact Information (PII Protected) */}
      <div className="profile-section">
        <h3>📧 Contact Information</h3>
        {isOwnProfile || piiAccess.contact_info ? (
          <div className="profile-info">
            <p><strong>Contact Number:</strong> {user.contactNumber || 'Not provided'}</p>
            <p><strong>Contact Email:</strong> {user.contactEmail || 'Not provided'}</p>
          </div>
        ) : (
          <div className="pii-locked">
            <div className="lock-icon">🔒</div>
            <p>Contact information is private</p>
            <button
              className="btn-request-small"
              onClick={() => setShowPIIRequestModal(true)}
            >
              Request Access
            </button>
          </div>
        )}
      </div>

      {/* Date of Birth (PII Protected) */}
      <div className="profile-section">
        <h3>🎂 Date of Birth</h3>
        {isOwnProfile || piiAccess.dob ? (
          <div className="profile-info">
            <p><strong>Date of Birth:</strong> {user.dob ? new Date(user.dob).toLocaleDateString() : 'Not provided'}</p>
            {age && <p><strong>Age:</strong> {age} years</p>}
          </div>
        ) : (
          <div className="pii-locked">
            <div className="lock-icon">🔒</div>
            <p>Date of birth is private (Age: {age || 'Unknown'})</p>
            <button
              className="btn-request-small"
              onClick={() => setShowPIIRequestModal(true)}
            >
              Request Access
            </button>
          </div>
        )}
      </div>

      {/* Preferences & Background (Always visible) */}
      <div className="profile-section">
        <h3>💭 Preferences & Background</h3>
        <div className="profile-info">
          <p><strong>Caste Preference:</strong> {user.castePreference}</p>
          <p><strong>Eating Preference:</strong> {user.eatingPreference}</p>
          <p><strong>Family Background:</strong> {user.familyBackground}</p>
          <p><strong>About:</strong> {user.aboutYou}</p>
          <p><strong>Partner Preference:</strong> {user.partnerPreference}</p>
        </div>
      </div>

      {/* Profile Images Section */}
      <div className="profile-section">
        <h3>📷 Photos</h3>
        {isOwnProfile || piiAccess.images ? (
          user.images?.length > 0 ? (
            <div
              id="profileCarousel"
              className="carousel slide profile-carousel"
              data-bs-ride="carousel"
            >
              <div className="carousel-inner">
                {user.images.map((img, idx) => (
                  <div
                    key={idx}
                    className={`carousel-item ${idx === 0 ? "active" : ""}`}
                  >
                    <img
                      src={img}
                      className="d-block w-100"
                      alt={`Slide ${idx + 1}`}
                      style={{ maxHeight: "500px", objectFit: "cover" }}
                    />
                  </div>
                ))}
              </div>
              <button
                className="carousel-control-prev"
                type="button"
                data-bs-target="#profileCarousel"
                data-bs-slide="prev"
              >
                <span className="carousel-control-prev-icon" aria-hidden="true" />
                <span className="visually-hidden">Previous</span>
              </button>
              <button
                className="carousel-control-next"
                type="button"
                data-bs-target="#profileCarousel"
                data-bs-slide="next"
              >
                <span className="carousel-control-next-icon" aria-hidden="true" />
                <span className="visually-hidden">Next</span>
              </button>
            </div>
          ) : (
            <p className="no-data">No photos available</p>
          )
        ) : (
          <div className="pii-locked">
            <div className="lock-icon">🔒</div>
            <p>Photos are private</p>
            <button
              className="btn-request-small"
              onClick={() => setShowPIIRequestModal(true)}
            >
              Request Access
            </button>
          </div>
        )}
      </div>

      {/* PII Request Modal */}
      <PIIRequestModal
        isOpen={showPIIRequestModal}
        profileUsername={username}
        profileName={`${user.firstName} ${user.lastName}`}
        currentAccess={piiAccess}
        onClose={() => setShowPIIRequestModal(false)}
        onSuccess={() => {
          setSuccessMessage('Request sent successfully!');
          setTimeout(() => setSuccessMessage(''), 5000); // Auto-hide after 5 seconds
          checkPIIAccess(); // Refresh access status
        }}
      />
    </div>
  );
};

export default Profile;

