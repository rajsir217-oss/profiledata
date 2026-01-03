import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { imageAccess } from "../api";
import { getBackendUrl } from "../config/apiConfig";
import PIIRequestModal from "./PIIRequestModal";
import ProfileImage from "./ProfileImage";
import ImageAccessRequestModal from "./ImageAccessRequestModal";
import ActivationBadge from "./ActivationBadge";
import onlineStatusService from "../services/onlineStatusService";
import L3V3LMatchingTable from "./L3V3LMatchingTable";
import MessageModal from "./MessageModal";
import { onPIIAccessChange } from "../utils/piiAccessEvents";
import { getActivityBadgeProps, getRelativeActivityTime } from "../utils/activityFormatter";
import { generateAboutMe, generatePartnerPreference } from "../utils/profileDescriptionGenerator";
import ProfileCreatorBadge from "./ProfileCreatorBadge";
import { getWorkingStatus } from "../utils/workStatusHelper";
import { getAuthenticatedImageUrl } from "../utils/imageUtils";
import logger from "../utils/logger";
import "./Profile.css";
import { ACTION_ICONS } from "../constants/icons";

/**
 * EmbeddedProfile - A version of Profile component that accepts username as prop
 * Used in split-screen layout to embed profile details without navigation
 */
const EmbeddedProfile = ({ 
  username,
  onMessage,
  onFavorite,
  onShortlist,
  onExclude,
  onRequestPII,
  isFavorited = false,
  isShortlisted = false,
  isExcluded = false,
  embedded = true  // Flag to indicate embedded mode
}) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  
  // L3V3L Matching Data
  const [l3v3lMatchData, setL3v3lMatchData] = useState(null);
  
  // PII Access states
  const [piiAccess, setPiiAccess] = useState({
    images: false,
    contact_info: false,
    contact_number: false,
    contact_email: false,
    linkedin_url: false
  });
  
  const [piiRequestStatus, setPiiRequestStatus] = useState({});
  const [showPIIRequestModal, setShowPIIRequestModal] = useState(false);
  const [showImageAccessModal, setShowImageAccessModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  
  // Lightbox state
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  
  // Expanded sections state
  const [expandedSections, setExpandedSections] = useState({
    aboutMe: true,
    lookingFor: true,
    basicInfo: false,
    lifestyle: false,
    contact: false,
    preferences: false,
    l3v3l: false
  });
  
  // Current user profile for PII modal
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  
  const currentUsername = localStorage.getItem("username");
  
  // Toggle section expansion
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Load profile data
  useEffect(() => {
    if (!username) return;
    
    const loadProfile = async () => {
      setLoading(true);
      setError("");
      
      try {
        // Load profile
        const response = await api.get(`/profile/${username}?requester=${currentUsername}`);
        setUser(response.data);
        setIsOwnProfile(username === currentUsername);
        
        // Check online status
        try {
          const onlineStatus = await onlineStatusService.checkOnlineStatus(username);
          setIsOnline(onlineStatus);
        } catch (err) {
          logger.debug('Error checking online status:', err);
        }
        
        // Load L3V3L match data if not own profile
        if (username !== currentUsername) {
          try {
            const matchResponse = await api.get(`/l3v3l-match-details/${currentUsername}/${username}`);
            setL3v3lMatchData(matchResponse.data);
          } catch (err) {
            logger.debug('Error loading L3V3L match data:', err);
          }
        }
        
        // Load PII access status
        await checkPIIAccess();
        
        // Load current user profile for PII modal
        try {
          const currentUserResponse = await api.get(`/profile/${currentUsername}?requester=${currentUsername}`);
          setCurrentUserProfile(currentUserResponse.data);
        } catch (err) {
          logger.debug('Error loading current user profile:', err);
        }
        
      } catch (err) {
        logger.error('Error loading profile:', err);
        setError(err.response?.data?.detail || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    
    loadProfile();
  }, [username, currentUsername]);
  
  // Check PII access
  const checkPIIAccess = async () => {
    try {
      const [requestsResponse, accessResponse] = await Promise.all([
        api.get(`/pii-requests/${currentUsername}/outgoing`),
        api.get(`/pii-access/${currentUsername}/received`)
      ]);
      
      const requests = requestsResponse.data.requests || [];
      const receivedAccess = accessResponse.data.receivedAccess || [];
      
      // Build status map
      const statusMap = {};
      const accessMap = {
        images: false,
        contact_info: false,
        contact_number: false,
        contact_email: false,
        linkedin_url: false
      };
      
      // Check pending requests
      requests.forEach(req => {
        if (req.profileUsername === username) {
          req.requestTypes?.forEach(type => {
            statusMap[type] = req.status;
          });
        }
      });
      
      // Check granted access
      receivedAccess.forEach(access => {
        if (access.granterUsername === username && access.isActive) {
          access.accessTypes?.forEach(type => {
            accessMap[type] = true;
            statusMap[type] = 'approved';
          });
        }
      });
      
      setPiiAccess(accessMap);
      setPiiRequestStatus(statusMap);
      
    } catch (err) {
      logger.error('Error checking PII access:', err);
    }
  };
  
  // Listen for PII access changes - reload profile to get updated images
  useEffect(() => {
    const unsubscribe = onPIIAccessChange(async (detail) => {
      // Check if this change affects the current profile
      if (detail.ownerUsername === username || detail.targetUsername === currentUsername) {
        // Reload profile to get updated images (filtered by access)
        try {
          const response = await api.get(`/profile/${username}?requester=${currentUsername}`);
          setUser(response.data);
        } catch (err) {
          logger.error('Error reloading profile after PII change:', err);
        }
      }
      checkPIIAccess();
    });
    return () => unsubscribe();
  }, [username, currentUsername]);
  
  // Handle message
  const handleMessage = () => {
    if (onMessage) {
      onMessage(user);
    } else {
      setShowMessageModal(true);
    }
  };
  
  // Handle favorite
  const handleFavorite = () => {
    if (onFavorite) {
      onFavorite(user);
    }
  };
  
  // Handle shortlist
  const handleShortlist = () => {
    if (onShortlist) {
      onShortlist(user);
    }
  };
  
  // Handle exclude/hide
  const handleExclude = () => {
    if (onExclude) {
      onExclude(user);
    }
  };
  
  // Handle PII request
  const handleRequestPII = () => {
    if (onRequestPII) {
      onRequestPII(user);
    } else {
      setShowPIIRequestModal(true);
    }
  };

  if (loading) {
    return (
      <div className="embedded-profile-loading" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--text-muted)'
      }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="embedded-profile-error" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--danger-color)'
      }}>
        <p>{error}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="embedded-profile-empty" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--text-muted)'
      }}>
        <p>Select a profile to view details</p>
      </div>
    );
  }

  return (
    <div className={`embedded-profile ${embedded ? 'embedded-mode' : ''}`}>
      {/* Floating Action Buttons - Same style as Profile page */}
      {!isOwnProfile && (
        <div className="floating-action-buttons" style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'var(--card-background)',
          padding: '12px 0',
          marginBottom: '16px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-end',
          flexWrap: 'wrap'
        }}>
          {/* Message */}
          <button
            className="fab-btn fab-message"
            onClick={handleMessage}
            title="Send Message"
          >
            💬 <span className="fab-text">Message</span>
          </button>
          
          {/* Favorite */}
          <button
            className={`fab-btn fab-favorite ${isFavorited ? 'active' : ''}`}
            onClick={handleFavorite}
            title={isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
          >
            {isFavorited ? '💔' : '⭐'} <span className="fab-text">{isFavorited ? 'Unfavorite' : 'Favorite'}</span>
          </button>
          
          {/* Shortlist */}
          <button
            className={`fab-btn fab-shortlist ${isShortlisted ? 'active' : ''}`}
            onClick={handleShortlist}
            title={isShortlisted ? 'Remove from Shortlist' : 'Add to Shortlist'}
          >
            {isShortlisted ? '📤' : '📋'} <span className="fab-text">{isShortlisted ? 'Remove' : 'Shortlist'}</span>
          </button>
          
          {/* Hide */}
          <button
            className={`fab-btn fab-hide ${isExcluded ? 'active' : ''}`}
            onClick={handleExclude}
            title={isExcluded ? 'Unhide Profile' : 'Hide Profile'}
          >
            {isExcluded ? '✅' : '🚫'} <span className="fab-text">{isExcluded ? 'Unhide' : 'Hide'}</span>
          </button>
          
          {/* Request Info */}
          <button
            className="fab-btn fab-request"
            onClick={handleRequestPII}
            title="Request Contact Info"
          >
            🔒 <span className="fab-text">Request Info</span>
          </button>
        </div>
      )}

      {/* Profile Header */}
      <div className="profile-header-section" style={{
        display: 'flex',
        gap: '20px',
        marginBottom: '24px',
        paddingBottom: '20px',
        borderBottom: '2px solid var(--border-color)'
      }}>
        {/* Profile Picture */}
        <div className="profile-avatar" style={{
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '40px',
          color: 'white',
          fontWeight: 600,
          flexShrink: 0,
          border: '4px solid var(--surface-color)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          {user.firstName?.charAt(0) || user.username?.charAt(0) || '?'}
        </div>
        
        {/* Profile Info */}
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 600 }}>
            {user.firstName} {user.lastName}
            {isOnline && <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--success-color)' }}>● Online</span>}
          </h2>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            <strong>Username:</strong> {user.username}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            <strong>Profile ID:</strong> {user.profileId || 'N/A'}
          </div>
          {l3v3lMatchData?.matchScore && (
            <div style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))',
              color: 'white',
              padding: '6px 16px',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: 600
            }}>
              🦋 {l3v3lMatchData.matchScore}% Match
            </div>
          )}
        </div>
      </div>

      {/* Photo Gallery */}
      <div className="photo-gallery" style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        overflowX: 'auto',
        paddingBottom: '8px'
      }}>
        {user.images && user.images.length > 0 ? (
          user.images.slice(0, 5).map((img, i) => {
            const reason = user.imageReasons?.[i] || 'unknown';
            const reasonColors = {
              'profilePic': { bg: '#ffc107', text: '#000' },
              'memberVisible': { bg: '#28a745', text: '#fff' },
              'onRequest (granted)': { bg: '#6366f1', text: '#fff' },
              'unknown': { bg: '#6c757d', text: '#fff' }
            };
            const colors = reasonColors[reason] || reasonColors['unknown'];
            
            return (
              <div 
                key={i} 
                style={{
                  position: 'relative',
                  width: '80px',
                  height: '80px',
                  background: 'var(--surface-color)',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                  flexShrink: 0,
                  cursor: 'pointer'
                }}
                onClick={() => {
                  setLightboxImage(img);
                  setShowLightbox(true);
                }}
              >
                <img 
                  src={getAuthenticatedImageUrl(img)} 
                  alt={`${i + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {/* Debug: Show visibility reason */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: colors.bg,
                  color: colors.text,
                  fontSize: '8px',
                  padding: '2px 4px',
                  textAlign: 'center',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {reason}
                </div>
              </div>
            );
          })
        ) : (
          [1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{
              width: '80px',
              height: '80px',
              background: 'var(--surface-color)',
              borderRadius: 'var(--radius-sm)',
              border: '2px dashed var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: 'var(--text-muted)',
              flexShrink: 0
            }}>
              Photo {i}
            </div>
          ))
        )}
      </div>

      {/* Bio Quote */}
      {user.bio && (
        <div style={{
          background: 'var(--surface-color)',
          padding: '16px',
          borderRadius: 'var(--radius-md)',
          borderLeft: '4px solid var(--primary-color)',
          marginBottom: '20px',
          fontStyle: 'italic',
          color: 'var(--text-secondary)'
        }}>
          "{user.bio}"
        </div>
      )}

      {/* Collapsible Sections */}
      {/* About Me */}
      <div className="profile-section" style={{ marginBottom: '12px' }}>
        <div
          onClick={() => toggleSection('aboutMe')}
          style={{
            background: 'var(--surface-color)',
            padding: '12px 16px',
            borderRadius: expandedSections.aboutMe ? 'var(--radius-sm) var(--radius-sm) 0 0' : 'var(--radius-sm)',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontWeight: 600,
            border: '1px solid var(--border-color)'
          }}
        >
          <span>📖 About Me</span>
          <span>{expandedSections.aboutMe ? '▼' : '▶'}</span>
        </div>
        {expandedSections.aboutMe && (
          <div style={{
            padding: '16px',
            background: 'var(--card-background)',
            border: '1px solid var(--border-color)',
            borderTop: 'none',
            borderRadius: '0 0 var(--radius-sm) var(--radius-sm)'
          }}>
            <p style={{ margin: 0, lineHeight: 1.6 }}>
              {user.aboutMe || generateAboutMe(user) || 'No information provided.'}
            </p>
          </div>
        )}
      </div>

      {/* What You're Looking For */}
      <div className="profile-section" style={{ marginBottom: '12px' }}>
        <div
          onClick={() => toggleSection('lookingFor')}
          style={{
            background: 'var(--surface-color)',
            padding: '12px 16px',
            borderRadius: expandedSections.lookingFor ? 'var(--radius-sm) var(--radius-sm) 0 0' : 'var(--radius-sm)',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontWeight: 600,
            border: '1px solid var(--border-color)'
          }}
        >
          <span>💝 What You're Looking For</span>
          <span>{expandedSections.lookingFor ? '▼' : '▶'}</span>
        </div>
        {expandedSections.lookingFor && (
          <div style={{
            padding: '16px',
            background: 'var(--card-background)',
            border: '1px solid var(--border-color)',
            borderTop: 'none',
            borderRadius: '0 0 var(--radius-sm) var(--radius-sm)'
          }}>
            <p style={{ margin: 0, lineHeight: 1.6 }}>
              {user.lookingFor || generatePartnerPreference(user) || 'No preferences specified.'}
            </p>
          </div>
        )}
      </div>

      {/* Basic Information */}
      <div className="profile-section" style={{ marginBottom: '12px' }}>
        <div
          onClick={() => toggleSection('basicInfo')}
          style={{
            background: 'var(--surface-color)',
            padding: '12px 16px',
            borderRadius: expandedSections.basicInfo ? 'var(--radius-sm) var(--radius-sm) 0 0' : 'var(--radius-sm)',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontWeight: 600,
            border: '1px solid var(--border-color)'
          }}
        >
          <span>👤 Basic Information</span>
          <span>{expandedSections.basicInfo ? '▼' : '▶'}</span>
        </div>
        {expandedSections.basicInfo && (
          <div style={{
            padding: '16px',
            background: 'var(--card-background)',
            border: '1px solid var(--border-color)',
            borderTop: 'none',
            borderRadius: '0 0 var(--radius-sm) var(--radius-sm)'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><strong>Age:</strong> {user.age || 'N/A'}</div>
              <div><strong>Height:</strong> {user.height || 'N/A'}</div>
              <div><strong>Location:</strong> {user.location || user.city || 'N/A'}</div>
              <div><strong>Occupation:</strong> {user.occupation || 'N/A'}</div>
              <div><strong>Education:</strong> {user.education || 'N/A'}</div>
              <div><strong>Religion:</strong> {user.religion || 'N/A'}</div>
              <div><strong>Relationship Status:</strong> {user.relationshipStatus || 'N/A'}</div>
              <div><strong>Mother Tongue:</strong> {user.motherTongue || 'N/A'}</div>
            </div>
          </div>
        )}
      </div>

      {/* Personal & Lifestyle */}
      <div className="profile-section" style={{ marginBottom: '12px' }}>
        <div
          onClick={() => toggleSection('lifestyle')}
          style={{
            background: 'var(--surface-color)',
            padding: '12px 16px',
            borderRadius: expandedSections.lifestyle ? 'var(--radius-sm) var(--radius-sm) 0 0' : 'var(--radius-sm)',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontWeight: 600,
            border: '1px solid var(--border-color)'
          }}
        >
          <span>🎨 Personal & Lifestyle</span>
          <span>{expandedSections.lifestyle ? '▼' : '▶'}</span>
        </div>
        {expandedSections.lifestyle && (
          <div style={{
            padding: '16px',
            background: 'var(--card-background)',
            border: '1px solid var(--border-color)',
            borderTop: 'none',
            borderRadius: '0 0 var(--radius-sm) var(--radius-sm)'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><strong>Drinking:</strong> {user.drinking || 'N/A'}</div>
              <div><strong>Smoking:</strong> {user.smoking || 'N/A'}</div>
              <div><strong>Diet:</strong> {user.diet || 'N/A'}</div>
              <div><strong>Body Type:</strong> {user.bodyType || 'N/A'}</div>
            </div>
          </div>
        )}
      </div>

      {/* Contact Information */}
      <div className="profile-section" style={{ marginBottom: '12px' }}>
        <div
          onClick={() => toggleSection('contact')}
          style={{
            background: 'var(--surface-color)',
            padding: '12px 16px',
            borderRadius: expandedSections.contact ? 'var(--radius-sm) var(--radius-sm) 0 0' : 'var(--radius-sm)',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontWeight: 600,
            border: '1px solid var(--border-color)'
          }}
        >
          <span>📞 Contact Information</span>
          <span>{expandedSections.contact ? '▼' : '▶'}</span>
        </div>
        {expandedSections.contact && (
          <div style={{
            padding: '16px',
            background: 'var(--card-background)',
            border: '1px solid var(--border-color)',
            borderTop: 'none',
            borderRadius: '0 0 var(--radius-sm) var(--radius-sm)'
          }}>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div>
                <strong>Email:</strong>{' '}
                {piiAccess.contact_email || user.contactEmailVisible ? 
                  (user.contactEmail || 'Not provided') : 
                  <span style={{ color: 'var(--text-muted)' }}>🔒 Request Access</span>
                }
              </div>
              <div>
                <strong>Phone:</strong>{' '}
                {piiAccess.contact_number || user.contactNumberVisible ? 
                  (user.contactNumber || 'Not provided') : 
                  <span style={{ color: 'var(--text-muted)' }}>🔒 Request Access</span>
                }
              </div>
              <div>
                <strong>LinkedIn:</strong>{' '}
                {piiAccess.linkedin_url || user.linkedinUrlVisible ? 
                  (user.linkedinUrl ? <a href={user.linkedinUrl} target="_blank" rel="noopener noreferrer">{user.linkedinUrl}</a> : 'Not provided') : 
                  <span style={{ color: 'var(--text-muted)' }}>🔒 Request Access</span>
                }
              </div>
            </div>
          </div>
        )}
      </div>

      {/* L3V3L Matching Breakdown */}
      {l3v3lMatchData && !isOwnProfile && (
        <div className="profile-section" style={{ marginBottom: '12px' }}>
          <div
            onClick={() => toggleSection('l3v3l')}
            style={{
              background: 'var(--surface-color)',
              padding: '12px 16px',
              borderRadius: expandedSections.l3v3l ? 'var(--radius-sm) var(--radius-sm) 0 0' : 'var(--radius-sm)',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontWeight: 600,
              border: '1px solid var(--border-color)'
            }}
          >
            <span>🦋 L3V3L Matching Breakdown</span>
            <span>{expandedSections.l3v3l ? '▼' : '▶'}</span>
          </div>
          {expandedSections.l3v3l && (
            <div style={{
              padding: '16px',
              background: 'var(--card-background)',
              border: '1px solid var(--border-color)',
              borderTop: 'none',
              borderRadius: '0 0 var(--radius-sm) var(--radius-sm)'
            }}>
              <L3V3LMatchingTable matchData={l3v3lMatchData} />
            </div>
          )}
        </div>
      )}

      {/* Message Modal */}
      <MessageModal
        isOpen={showMessageModal}
        profile={user}
        onClose={() => setShowMessageModal(false)}
      />

      {/* PII Request Modal */}
      {showPIIRequestModal && (
        <PIIRequestModal
          isOpen={showPIIRequestModal}
          profileUsername={user.username}
          profileName={`${user.firstName} ${user.lastName}`}
          currentAccess={piiAccess}
          requestStatus={piiRequestStatus}
          visibilitySettings={{
            contactNumberVisible: user.contactNumberVisible,
            contactEmailVisible: user.contactEmailVisible,
            linkedinUrlVisible: user.linkedinUrlVisible
          }}
          requesterProfile={currentUserProfile}
          targetProfile={user}
          onClose={() => setShowPIIRequestModal(false)}
          onSuccess={() => {
            checkPIIAccess();
            setShowPIIRequestModal(false);
          }}
        />
      )}

      {/* Lightbox */}
      {showLightbox && lightboxImage && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          onClick={() => {
            setShowLightbox(false);
            setLightboxImage(null);
          }}
        >
          <button
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255, 255, 255, 0.9)',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              fontSize: '24px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={(e) => {
              e.stopPropagation();
              setShowLightbox(false);
              setLightboxImage(null);
            }}
          >
            ✕
          </button>
          <img 
            src={getAuthenticatedImageUrl(lightboxImage)} 
            alt="Enlarged view"
            style={{
              maxWidth: '90%',
              maxHeight: '90%',
              objectFit: 'contain',
              borderRadius: '8px'
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default EmbeddedProfile;
