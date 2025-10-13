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
  
  // KPI Stats
  const [kpiStats, setKpiStats] = useState({
    profileViews: 0,
    shortlistedBy: 0,
    favoritedBy: 0
  });
  
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
        
        // Fetch KPI stats for all profiles
        await fetchKPIStats();
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
    
    // Poll for KPI stats updates every 15 seconds
    const kpiStatsInterval = setInterval(() => {
      fetchKPIStats();
    }, 15000);
    
    // Refresh KPI stats when page regains focus
    const handleFocus = () => {
      console.log('🔄 Page focused - refreshing KPI stats');
      fetchKPIStats();
    };
    window.addEventListener('focus', handleFocus);
    
    // Subscribe to online status changes for this user
    const unsubscribe = onlineStatusService.subscribe((changedUsername, online) => {
      if (changedUsername === username) {
        console.log(`🔄 Status update for ${username}:`, online ? 'online' : 'offline');
        setIsOnline(online);
      }
    });
    
    return () => {
      clearInterval(accessCheckInterval);
      clearInterval(kpiStatsInterval);
      window.removeEventListener('focus', handleFocus);
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

  const fetchKPIStats = async () => {
    try {
      console.log('📊 Fetching KPI stats for:', username);
      
      const [viewsRes, shortlistRes, favoritesRes] = await Promise.all([
        api.get(`/profile-views/${username}/count`),
        api.get(`/their-shortlists/${username}`),
        api.get(`/their-favorites/${username}`)
      ]);
      
      console.log('📊 Views Response:', viewsRes.data);
      console.log('📊 Shortlist Response:', shortlistRes.data);
      console.log('📊 Favorites Response:', favoritesRes.data);
      
      const stats = {
        profileViews: viewsRes.data?.totalViews || viewsRes.data?.uniqueViewers || 0,
        shortlistedBy: shortlistRes.data?.users?.length || 0,
        favoritedBy: favoritesRes.data?.users?.length || 0
      };
      
      console.log('📊 Parsed KPI stats:', stats);
      setKpiStats(stats);
    } catch (err) {
      console.error("❌ Error fetching KPI stats:", err);
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
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '25px', width: '100%', flexWrap: 'wrap' }}>
          {/* Profile Avatar with KPI Bubbles */}
          {isOwnProfile && (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {/* Main Avatar */}
              <div style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                overflow: 'hidden',
                border: '4px solid var(--primary-color, #667eea)',
                boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                backgroundColor: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '48px',
                fontWeight: 'bold',
                color: '#667eea'
              }}>
                {user.images?.[0] ? (
                  <img src={user.images[0]} alt={user.firstName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span>{user.firstName?.[0]}{user.lastName?.[0]}</span>
                )}
              </div>
              
              {/* KPI Bubbles positioned around avatar */}
              {/* Top-left: Profile Views */}
              <div style={{
                position: 'absolute',
                top: '-10px',
                left: '-20px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                backgroundColor: '#fff3cd',
                borderRadius: '20px',
                border: '2px solid #ffc107',
                boxShadow: '0 3px 10px rgba(255, 193, 7, 0.4)',
                fontSize: '11px',
                fontWeight: '600',
                color: '#856404',
                whiteSpace: 'nowrap',
                zIndex: 10
              }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#ffc107',
                  boxShadow: '0 0 8px rgba(255, 193, 7, 0.8)'
                }} />
                <span>👁️ {kpiStats.profileViews}</span>
              </div>

              {/* Top-right: Shortlisted */}
              <div style={{
                position: 'absolute',
                top: '-10px',
                right: '-20px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                backgroundColor: '#d1ecf1',
                borderRadius: '20px',
                border: '2px solid #17a2b8',
                boxShadow: '0 3px 10px rgba(23, 162, 184, 0.4)',
                fontSize: '11px',
                fontWeight: '600',
                color: '#0c5460',
                whiteSpace: 'nowrap',
                zIndex: 10
              }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#17a2b8',
                  boxShadow: '0 0 8px rgba(23, 162, 184, 0.8)'
                }} />
                <span>📝 {kpiStats.shortlistedBy}</span>
              </div>

              {/* Bottom: Favorites */}
              <div style={{
                position: 'absolute',
                bottom: '-10px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                backgroundColor: '#f8d7da',
                borderRadius: '20px',
                border: '2px solid #dc3545',
                boxShadow: '0 3px 10px rgba(220, 53, 69, 0.4)',
                fontSize: '11px',
                fontWeight: '600',
                color: '#721c24',
                whiteSpace: 'nowrap',
                zIndex: 10
              }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#dc3545',
                  boxShadow: '0 0 8px rgba(220, 53, 69, 0.8)'
                }} />
                <span>❤️ {kpiStats.favoritedBy}</span>
              </div>
            </div>
          )}
          
          {/* Profile Info */}
          <div className="profile-title-section" style={{ flex: 1, minWidth: '250px' }}>
            <h2>
              {user.firstName} {user.lastName}
              {!isOwnProfile && (
                <span className={`status-bulb-profile ${isOnline ? 'online' : 'offline'}`} title={isOnline ? 'Online Now' : 'Offline'}>
                  {isOnline ? '🟢' : '⚪'}
                </span>
              )}
            </h2>
            {user.profileId && (
              <p style={{ 
                fontSize: '14px', 
                color: '#6c757d', 
                margin: '5px 0 0 0',
                fontFamily: 'monospace',
                letterSpacing: '1px'
              }}>
                <strong>Profile ID:</strong> <span style={{ 
                  backgroundColor: '#f0f0f0', 
                  padding: '2px 8px', 
                  borderRadius: '4px',
                  color: '#495057'
                }}>{user.profileId}</span>
              </p>
            )}
          </div>
          
          {/* Edit Profile Button */}
          {isOwnProfile && (
            <button 
              className="btn-edit-profile"
              onClick={handleEditProfile}
              title="Edit Profile"
              style={{ alignSelf: 'flex-start' }}
            >
              <span>✏️</span>
              <span>Edit Profile</span>
            </button>
          )}
        </div>
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
      
      {/* Bio / Tagline */}
      {user.bio && (
        <div className="profile-section" style={{ 
          backgroundColor: '#f8f9fa', 
          borderLeft: '4px solid #007bff',
          fontStyle: 'italic',
          fontSize: '16px',
          textAlign: 'center',
          padding: '20px'
        }}>
          <p style={{ margin: 0, color: '#495057' }}>"{user.bio}"</p>
        </div>
      )}

      {/* Basic Info (Always visible) */}
      <div className="profile-section">
        <h3>👤 Basic Information</h3>
        <div className="profile-info">
          <p><strong>Username:</strong> {user.username}</p>
          <p><strong>Gender:</strong> {user.gender || user.sex}</p>
          {age && <p><strong>Age:</strong> {age} years</p>}
          <p><strong>Height:</strong> {user.height}</p>
          <p><strong>Location:</strong> {user.location}</p>
          {user.religion && <p><strong>Religion:</strong> {user.religion}</p>}
          {user.relationshipStatus && <p><strong>Relationship Status:</strong> {user.relationshipStatus}</p>}
          {user.lookingFor && <p><strong>Looking For:</strong> {user.lookingFor}</p>}
          {user.education && <p><strong>Education:</strong> {user.education}</p>}
          <p><strong>Working Status:</strong> {user.workingStatus}</p>
          {user.workplace && <p><strong>Workplace:</strong> {user.workplace}</p>}
          {user.workLocation && <p><strong>Work Location:</strong> {user.workLocation}</p>}
          {user.linkedinUrl && <p><strong>LinkedIn:</strong> <a href={user.linkedinUrl} target="_blank" rel="noopener noreferrer">{user.linkedinUrl}</a></p>}
          {user.citizenshipStatus && <p><strong>Citizenship Status:</strong> {user.citizenshipStatus}</p>}
        </div>
      </div>

      {/* Regional & Cultural Information */}
      {(user.countryOfOrigin || user.countryOfResidence || user.state || user.languagesSpoken?.length > 0 || user.motherTongue || user.caste || user.familyType || user.familyValues || user.castePreference || user.eatingPreference) && (
        <div className="profile-section">
          <h3>🌍 Regional & Cultural</h3>
          <div className="profile-info">
            {user.countryOfOrigin && <p><strong>Country of Origin:</strong> {user.countryOfOrigin === 'IN' ? 'India' : user.countryOfOrigin === 'US' ? 'USA' : user.countryOfOrigin}</p>}
            {user.countryOfResidence && <p><strong>Country of Residence:</strong> {user.countryOfResidence === 'IN' ? 'India' : user.countryOfResidence === 'US' ? 'USA' : user.countryOfResidence}</p>}
            {user.state && <p><strong>State:</strong> {user.state}</p>}
            {user.languagesSpoken && user.languagesSpoken.length > 0 && (
              <p><strong>Languages Spoken:</strong> {user.languagesSpoken.join(', ')}</p>
            )}
            {user.motherTongue && <p><strong>Mother Tongue:</strong> {user.motherTongue}</p>}
            {user.caste && <p><strong>Caste:</strong> {user.caste}</p>}
            {user.castePreference && <p><strong>Caste Preference:</strong> {user.castePreference}</p>}
            {user.eatingPreference && <p><strong>Eating Preference:</strong> {user.eatingPreference}</p>}
            {user.familyType && <p><strong>Family Type:</strong> {user.familyType}</p>}
            {user.familyValues && <p><strong>Family Values:</strong> {user.familyValues}</p>}
          </div>
        </div>
      )}

      {/* Personal & Lifestyle */}
      {(user.bodyType || user.drinking || user.smoking || user.hasChildren || user.wantsChildren || user.pets || user.interests || user.languages) && (
        <div className="profile-section">
          <h3>💭 Personal & Lifestyle</h3>
          <div className="profile-info">
            {user.bodyType && <p><strong>Body Type:</strong> {user.bodyType}</p>}
            {user.drinking && <p><strong>Drinking:</strong> {user.drinking}</p>}
            {user.smoking && <p><strong>Smoking:</strong> {user.smoking}</p>}
            {user.hasChildren && <p><strong>Has Children:</strong> {user.hasChildren}</p>}
            {user.wantsChildren && <p><strong>Wants Children:</strong> {user.wantsChildren}</p>}
            {user.pets && <p><strong>Pets:</strong> {user.pets}</p>}
            {user.interests && <p><strong>Interests & Hobbies:</strong> {user.interests}</p>}
            {user.languages && <p><strong>Languages:</strong> {user.languages}</p>}
          </div>
        </div>
      )}

      {/* Education History */}
      {user.educationHistory && user.educationHistory.length > 0 && (
        <div className="profile-section">
          <h3>🎓 Education History</h3>
          <div className="profile-info">
            {user.educationHistory.map((edu, idx) => (
              <div key={idx} style={{marginBottom: '15px', paddingBottom: '15px', borderBottom: idx < user.educationHistory.length - 1 ? '1px solid #eee' : 'none'}}>
                <p><strong>{edu.level ? `${edu.level} - ${edu.degree}` : edu.degree}</strong></p>
                <p style={{marginLeft: '10px', color: '#666'}}>{edu.institution}</p>
                <p style={{marginLeft: '10px', color: '#999', fontSize: '14px'}}>
                  {edu.startYear && edu.endYear ? `${edu.startYear} - ${edu.endYear}` : (edu.year || 'N/A')}
                </p>
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
                <p><strong>{work.status === 'current' ? '🟢 Current Position' : '⚪ Past Position'}</strong></p>
                <p style={{marginLeft: '10px', color: '#666', whiteSpace: 'pre-wrap'}}>{work.description}</p>
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
          {user.castePreference && <p><strong>Caste Preference:</strong> {user.castePreference}</p>}
          {user.eatingPreference && <p><strong>Eating Preference:</strong> {user.eatingPreference}</p>}
          {user.familyType && <p><strong>Family Type:</strong> {user.familyType}</p>}
          {user.familyValues && <p><strong>Family Values:</strong> {user.familyValues}</p>}
          {user.familyBackground && <p><strong>Family Background:</strong> {user.familyBackground}</p>}
          {(user.aboutMe || user.aboutYou) && <p><strong>About:</strong> {user.aboutMe || user.aboutYou}</p>}
          {user.partnerPreference && <p><strong>Partner Preference:</strong> {user.partnerPreference}</p>}
        </div>
      </div>

      {/* Partner Matching Criteria */}
      {user.partnerCriteria && Object.keys(user.partnerCriteria).length > 0 && (
        <div className="profile-section">
          <h3>🎯 Partner Matching Criteria</h3>
          <div className="profile-info">
            {user.partnerCriteria.ageRange && (user.partnerCriteria.ageRange.min || user.partnerCriteria.ageRange.max) && (
              <p><strong>Preferred Age Range:</strong> {user.partnerCriteria.ageRange.min || '?'} - {user.partnerCriteria.ageRange.max || '?'} years</p>
            )}
            {user.partnerCriteria.heightRange && (
              <p><strong>Preferred Height Range:</strong> {user.partnerCriteria.heightRange.minFeet || '?'}'{user.partnerCriteria.heightRange.minInches || '0'}" - {user.partnerCriteria.heightRange.maxFeet || '?'}'{user.partnerCriteria.heightRange.maxInches || '0'}"</p>
            )}
            {user.partnerCriteria.educationLevel && user.partnerCriteria.educationLevel.length > 0 && (
              <p><strong>Preferred Education:</strong> {user.partnerCriteria.educationLevel.join(', ')}</p>
            )}
            {user.partnerCriteria.profession && user.partnerCriteria.profession.length > 0 && (
              <p><strong>Preferred Profession:</strong> {user.partnerCriteria.profession.join(', ')}</p>
            )}
            {user.partnerCriteria.location && user.partnerCriteria.location.length > 0 && (
              <p><strong>Preferred Locations:</strong> {user.partnerCriteria.location.join(', ')}</p>
            )}
            {user.partnerCriteria.languages && user.partnerCriteria.languages.length > 0 && (
              <p><strong>Preferred Languages:</strong> {user.partnerCriteria.languages.join(', ')}</p>
            )}
            {user.partnerCriteria.religion && <p><strong>Preferred Religion:</strong> {user.partnerCriteria.religion}</p>}
            {user.partnerCriteria.caste && <p><strong>Preferred Caste:</strong> {user.partnerCriteria.caste}</p>}
            {user.partnerCriteria.eatingPreference && user.partnerCriteria.eatingPreference.length > 0 && (
              <p><strong>Preferred Eating:</strong> {user.partnerCriteria.eatingPreference.join(', ')}</p>
            )}
            {user.partnerCriteria.familyType && user.partnerCriteria.familyType.length > 0 && (
              <p><strong>Preferred Family Type:</strong> {user.partnerCriteria.familyType.join(', ')}</p>
            )}
            {user.partnerCriteria.familyValues && user.partnerCriteria.familyValues.length > 0 && (
              <p><strong>Preferred Family Values:</strong> {user.partnerCriteria.familyValues.join(', ')}</p>
            )}
          </div>
        </div>
      )}

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

