import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import api, { imageAccess } from "../api";
import { getBackendUrl } from "../config/apiConfig";
import PIIRequestModal from "./PIIRequestModal";
import ProfileImage from "./ProfileImage";
import ImageAccessRequestModal from "./ImageAccessRequestModal";
import ActivationBadge from "./ActivationBadge";
import onlineStatusService from "../services/onlineStatusService";
import L3V3LMatchingTable from "./L3V3LMatchingTable";
import { onPIIAccessChange } from "../utils/piiAccessEvents";
import "./Profile.css";

// Create axios instance for verification API
const verificationApi = axios.create({
  baseURL: getBackendUrl()
});

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
  
  // L3V3L Matching Data
  const [l3v3lMatchData, setL3v3lMatchData] = useState(null);
  
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
    date_of_birth: false
  });
  const [piiRequestStatus, setPiiRequestStatus] = useState({});
  const [showPIIRequestModal, setShowPIIRequestModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Image Access states (new privacy system)
  const [accessibleImages, setAccessibleImages] = useState([]);
  const [showImageAccessModal, setShowImageAccessModal] = useState(false);
  const [selectedImageForAccess, setSelectedImageForAccess] = useState(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isShortlisted, setIsShortlisted] = useState(false);
  
  // Inline editing state (Phase 2: Full implementation)
  const [editingSection, setEditingSection] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [savingSection, setSavingSection] = useState(null);
  
  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  
  // Activation status state
  const [activationStatus, setActivationStatus] = useState(null);
  
  const currentUsername = localStorage.getItem('username');
  
  // Debug: Log user data when it changes
  useEffect(() => {
    if (user) {
      console.log('👤 User data loaded:', {
        username: user.username,
        gender: user.gender,
        height: user.height,
        location: user.location,
        workingStatus: user.workingStatus
      });
    }
  }, [user]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // Check if current user is admin
        const userRole = localStorage.getItem('userRole');
        const adminStatus = currentUsername === 'admin' || userRole === 'admin';
        setIsAdmin(adminStatus);
        
        // Pass requester to properly handle PII masking
        const res = await api.get(`/profile/${username}?requester=${currentUsername}`);
        console.log('📡 API Response:', res);
        console.log('📡 API Response Data:', res.data);
        console.log('📡 Data keys:', Object.keys(res.data || {}));
        console.log('📡 Gender value:', res.data?.gender);
        console.log('📡 Height value:', res.data?.height);
        console.log('📡 Location value:', res.data?.location);
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
          
          // Load accessible images with privacy settings
          await loadAccessibleImages();
          
          // Check user relationship (favorites/shortlist)
          await checkUserRelationship();
          
          // Check initial online status using service
          const online = await onlineStatusService.isUserOnline(username);
          setIsOnline(online);
        }
        
        // Fetch KPI stats for all profiles
        await fetchKPIStats();
        
        // Fetch activation status if viewing own profile
        if (currentUsername === username) {
          await fetchActivationStatus();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, currentUsername]);

  // Fetch L3V3L matching data if viewing from matches page
  useEffect(() => {
    const fetchL3V3LMatchData = async () => {
      // Only fetch if viewing someone else's profile
      if (!currentUsername || isOwnProfile) return;
      
      try {
        console.log('🦋 Fetching L3V3L match data for:', username);
        const response = await api.get(`/l3v3l-match-details/${currentUsername}/${username}`);
        
        if (response.data && response.data.matchScore) {
          setL3v3lMatchData({
            overall: response.data.matchScore,
            love: response.data.breakdown?.love || 0,
            loyalty: response.data.breakdown?.loyalty || 0,
            laughter: response.data.breakdown?.laughter || 0,
            vulnerability: response.data.breakdown?.vulnerability || 0,
            elevation: response.data.breakdown?.elevation || 0,
            demographics: response.data.breakdown?.demographics || 0,
            career: response.data.breakdown?.career || 0,
            cultural: response.data.breakdown?.cultural || 0,
            physical: response.data.breakdown?.physical || 0,
            lifestyle: response.data.breakdown?.lifestyle || 0
          });
          console.log('✅ L3V3L match data loaded:', response.data);
        }
      } catch (error) {
        // Silently fail - not all profiles will have L3V3L data
        console.log('📝 No L3V3L match data available (this is normal if not accessed from L3V3L matches page)');
      }
    };
    
    fetchL3V3LMatchData();
  }, [username, currentUsername, isOwnProfile]);

  const fetchActivationStatus = async () => {
    try {
      const response = await verificationApi.get(`/api/verification/status/${username}`);
      setActivationStatus(response.data);
      console.log('📧 Activation status loaded:', response.data);
    } catch (error) {
      console.error('Error fetching activation status:', error);
      // Don't fail silently, but don't block profile loading
    }
  };

  const handleResendEmail = async () => {
    try {
      const response = await verificationApi.post('/api/verification/resend-verification', {
        username: username
      });
      if (response.data.success) {
        setSuccessMessage('✅ Verification email sent! Please check your inbox.');
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        setStatusMessage(response.data.message || '❌ Failed to resend email.');
        setTimeout(() => setStatusMessage(''), 5000);
      }
    } catch (error) {
      console.error('Resend email error:', error);
      setStatusMessage(
        error.response?.data?.detail || 
        error.response?.data?.message || 
        '❌ Failed to resend verification email.'
      );
      setTimeout(() => setStatusMessage(''), 5000);
    }
  };

  const checkPIIAccess = async () => {
    if (!currentUsername || isOwnProfile) return;
    
    // ✅ ADMIN BYPASS - Admins have full access to all PII
    if (isAdmin) {
      console.log('🔓 Admin user detected - granting full PII access');
      setPiiAccess({
        images: true,
        contact_info: true,
        date_of_birth: true
      });
      return;
    }
    
    try {
      const [imagesRes, contactRes, dobRes, linkedinRes] = await Promise.all([
        api.get(`/pii-access/check?requester=${currentUsername}&profile_owner=${username}&access_type=images`),
        api.get(`/pii-access/check?requester=${currentUsername}&profile_owner=${username}&access_type=contact_info`),
        api.get(`/pii-access/check?requester=${currentUsername}&profile_owner=${username}&access_type=date_of_birth`),
        api.get(`/pii-access/check?requester=${currentUsername}&profile_owner=${username}&access_type=linkedin_url`)
      ]);
      
      console.log('🔍 PII Access Check Results:', {
        images: imagesRes.data.hasAccess,
        contact_info: contactRes.data.hasAccess,
        date_of_birth: dobRes.data.hasAccess,
        linkedin_url: linkedinRes.data.hasAccess
      });
      
      setPiiAccess({
        images: imagesRes.data.hasAccess,
        contact_info: contactRes.data.hasAccess,
        date_of_birth: dobRes.data.hasAccess,
        linkedin_url: linkedinRes.data.hasAccess
      });
      
      // Check pending request status for each type
      const requestStatus = {};
      const piiTypes = ['images', 'contact_info', 'date_of_birth', 'linkedin_url'];
      
      for (const type of piiTypes) {
        if (imagesRes.data.hasAccess && type === 'images') {
          requestStatus[type] = 'approved';
        } else if (contactRes.data.hasAccess && type === 'contact_info') {
          requestStatus[type] = 'approved';
        } else if (dobRes.data.hasAccess && type === 'date_of_birth') {
          requestStatus[type] = 'approved';
        } else if (linkedinRes.data.hasAccess && type === 'linkedin_url') {
          requestStatus[type] = 'approved';
        }
      }
      
      setPiiRequestStatus(requestStatus);
    } catch (err) {
      console.error("Error checking PII access:", err);
    }
  };

  // Load accessible images with privacy settings and expiry info
  const loadAccessibleImages = async () => {
    if (isOwnProfile || !currentUsername) {
      // Owner sees all images normally
      return;
    }

    try {
      // Fetch PII access info to get expiry details
      const accessResponse = await api.get(`/pii-access/${currentUsername}/received`);
      const receivedAccess = accessResponse.data.receivedAccess || [];
      
      // Find access record for this profile owner
      const accessRecord = receivedAccess.find(
        access => access.userProfile?.username === username && 
                  access.accessTypes?.includes('images')
      );
      
      if (accessRecord && user.images?.length > 0) {
        // Get expiry info from accessDetails for images
        const imageAccessDetails = accessRecord.accessDetails?.images || {};
        
        // Create image objects with access details
        const imagesWithAccess = user.images.map((img, idx) => ({
          imageId: `${username}-img-${idx}`,
          imageUrl: img,
          imageOrder: idx,
          isProfilePic: idx === 0,
          hasAccess: true,
          accessDetails: {
            grantedAt: imageAccessDetails.grantedAt,
            expiresAt: imageAccessDetails.expiresAt
          }
        }));
        
        console.log('📸 Loaded images with access details:', {
          accessRecord,
          imageAccessDetails,
          imagesWithAccess
        });
        setAccessibleImages(imagesWithAccess);
      } else {
        console.log('📸 No access record found or no images available');
        setAccessibleImages([]);
      }
    } catch (err) {
      console.error("Error loading accessible images:", err);
      setAccessibleImages([]);
    }
  };
  
  // Listen for PII access changes (when owner grants/revokes access)
  useEffect(() => {
    const cleanup = onPIIAccessChange(async (detail) => {
      const { action, targetUsername, ownerUsername } = detail;
      
      console.log('🔔 PII Access Change Event Received:', detail);
      
      // If this is about access to the current profile we're viewing
      if (ownerUsername === username && targetUsername === currentUsername) {
        console.log('🔄 Refreshing access for current profile...');
        
        // Reload PII access status
        await checkPIIAccess();
        
        // Reload accessible images
        await loadAccessibleImages();
        
        // Show success message
        if (action === 'granted') {
          setSuccessMessage('🎉 Access granted! Images are now visible.');
          setTimeout(() => setSuccessMessage(''), 5000);
        } else if (action === 'revoked') {
          setSuccessMessage('Access has been revoked.');
          setTimeout(() => setSuccessMessage(''), 5000);
        }
      }
    });
    
    // Cleanup listener on unmount
    return cleanup;
  }, [username, currentUsername]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-load accessible images when PII access is granted
  useEffect(() => {
    if (piiAccess.images && !isOwnProfile && user && user.images?.length > 0) {
      console.log('🔄 Auto-loading accessible images with expiry details...');
      loadAccessibleImages();
    }
  }, [piiAccess.images, user, isOwnProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check if user has favorited/shortlisted this profile
  const checkUserRelationship = async () => {
    if (isOwnProfile || !currentUsername) return;

    try {
      const [favResponse, shortlistResponse] = await Promise.all([
        api.get(`/favorites/${currentUsername}`),
        api.get(`/shortlist/${currentUsername}`)
      ]);

      const favorites = favResponse.data.favorites || favResponse.data || [];
      const shortlist = shortlistResponse.data.shortlist || shortlistResponse.data || [];

      setIsFavorited(favorites.some(u => (u.username || u) === username));
      setIsShortlisted(shortlist.some(u => (u.username || u) === username));
    } catch (err) {
      console.error("Error checking user relationship:", err);
    }
  };

  // Handle access request
  const handleRequestAccess = (image) => {
    setSelectedImageForAccess(image);
    setShowImageAccessModal(true);
  };

  // Handle renewal request
  const handleRenewAccess = (image) => {
    setSelectedImageForAccess(image);
    setShowImageAccessModal(true);
  };

  // Submit access request
  const handleSubmitAccessRequest = async (requestData) => {
    try {
      // Validate we have necessary data
      if (!currentUsername) {
        setError('You must be logged in to request access');
        return;
      }

      if (!user.images || user.images.length === 0) {
        setError('No images to request access for');
        return;
      }

      console.log('Submitting access request:', {
        requesterUsername: currentUsername,
        ownerUsername: username,
        imageCount: user.images.length
      });

      const response = await imageAccess.requestAccess({
        requesterUsername: currentUsername,
        ownerUsername: username,
        imageIds: user.images.map((img, idx) => `${username}-img-${idx}`),
        message: requestData.message || ''
      });

      console.log('Access request response:', response);

      setSuccessMessage('✅ Access request sent successfully!');
      setShowImageAccessModal(false);
      setSelectedImageForAccess(null);
      setTimeout(() => setSuccessMessage(''), 5000);
      
      // Refresh accessible images
      await loadAccessibleImages();
    } catch (err) {
      console.error('Error requesting access:', err);
      console.error('Error details:', err.response?.data);
      setError(err.response?.data?.message || 'Failed to send access request');
      setTimeout(() => setError(''), 5000);
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

  const handleEditProfile = () => {
    navigate('/edit-profile');
  };

  // Toast notification helper
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: '' });
    }, 5000);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingSection(null);
    setEditFormData({});
  };

  // Handle form input changes
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Save inline edits
  const handleSaveEdit = async (section) => {
    setSavingSection(section);
    
    try {
      // Prepare FormData for API
      const formData = new FormData();
      
      console.log('💾 Saving section:', section);
      console.log('📝 Edit form data:', editFormData);
      
      // Add fields based on section - send all fields from editFormData
      if (section === 'basic') {
        // Send all fields with their current values from editFormData
        const fieldsToSave = [
          'gender', 'height', 'location', 'religion', 'relationshipStatus',
          'lookingFor', 'workingStatus', 
          'citizenshipStatus'
        ];
        
        fieldsToSave.forEach(field => {
          const value = editFormData[field];
          // Only send fields that have actual values (not empty strings)
          if (value !== undefined && value !== null && value !== '') {
            formData.append(field, value);
            console.log(`  ✓ ${field}: "${value}"`);
          } else {
            console.log(`  ⊘ ${field}: SKIPPED (empty or undefined)`);
          }
        });
      } else if (section === 'contact') {
        if (editFormData.contactNumber !== undefined && editFormData.contactNumber !== null && editFormData.contactNumber !== '') {
          formData.append('contactNumber', editFormData.contactNumber);
          console.log(`  ✓ contactNumber: "${editFormData.contactNumber}"`);
        }
        if (editFormData.contactEmail !== undefined && editFormData.contactEmail !== null && editFormData.contactEmail !== '') {
          formData.append('contactEmail', editFormData.contactEmail);
          console.log(`  ✓ contactEmail: "${editFormData.contactEmail}"`);
        }
      } else if (section === 'dateOfBirth') {
        if (editFormData.dateOfBirth !== undefined && editFormData.dateOfBirth !== null && editFormData.dateOfBirth !== '') {
          formData.append('dateOfBirth', editFormData.dateOfBirth);
          console.log(`  ✓ dateOfBirth: "${editFormData.dateOfBirth}"`);
        }
      }
      
      // Check if we have any fields to update
      let hasFields = false;
      // eslint-disable-next-line no-unused-vars
      for (const _pair of formData.entries()) {
        hasFields = true;
        break;
      }
      
      if (!hasFields) {
        console.warn('⚠️ No fields to update - canceling save');
        showToast('No changes to save', 'info');
        setEditingSection(null);
        setEditFormData({});
        setSavingSection(null);
        return;
      }
      
      // Make API call
      const response = await api.put(`/profile/${username}`, formData);
      
      console.log('✅ API Response:', response.data);
      
      // Update user data with the response (API returns {message, user})
      setUser(response.data.user || response.data);
      
      // Close editing and show success
      setEditingSection(null);
      setEditFormData({});
      showToast('Profile updated successfully!', 'success');
      
    } catch (err) {
      console.error('❌ Error saving profile:', err);
      console.error('Error details:', err.response?.data);
      showToast('Failed to update profile. Please try again.', 'error');
    } finally {
      setSavingSection(null);
    }
  };

  if (loading) return <p>Loading profile...</p>;
  if (error) return <p className="text-danger">{error}</p>;
  if (!user) return <p>No profile found.</p>;

  const age = user.dateOfBirth ? calculateAge(user.dateOfBirth) : null;
  
  // Check if user has all access
  const hasAllAccess = isOwnProfile || (piiAccess.images && piiAccess.contact_info && piiAccess.date_of_birth);
  const hasAnyAccess = piiAccess.images || piiAccess.contact_info || piiAccess.date_of_birth;

  return (
    <div className="container mt-4">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`toast-notification toast-${toast.type}`} style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          padding: '12px 16px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 10001,
          animation: 'slideInRight 0.3s ease-out',
          minWidth: '280px',
          maxWidth: '350px',
          maxHeight: '60px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: toast.type === 'success' ? '#4caf50' : 
                     toast.type === 'error' ? '#f44336' :
                     '#2196f3',
          color: 'white'
        }}>
          <span style={{ fontSize: '20px', flexShrink: 0 }}>
            {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}
          </span>
          <span style={{ flex: 1, fontWeight: '500', fontSize: '14px' }}>{toast.message}</span>
          <button 
            onClick={() => setToast({ show: false, message: '', type: '' })}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              cursor: 'pointer',
              color: 'white',
              fontSize: '18px',
              lineHeight: 1,
              flexShrink: 0
            }}
          >×</button>
        </div>
      )}
      
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

      {/* Activation Badge - Show only on own profile */}
      {isOwnProfile && activationStatus && (
        <ActivationBadge
          accountStatus={activationStatus.accountStatus}
          emailVerified={activationStatus.emailVerified}
          adminApprovalStatus={activationStatus.adminApprovalStatus}
          onResendEmail={handleResendEmail}
          username={username}
        />
      )}

      <div className="profile-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '25px', width: '100%', flexWrap: 'wrap', position: 'relative' }}>
          {/* Profile Avatar */}
          {isOwnProfile && (
            <div style={{ flexShrink: 0, width: '120px', height: '120px' }}>
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
            
            {/* Account Status Indicator - Show only for own profile if not fully activated */}
            {/* DEBUG: Always show for debugging */}
            {isOwnProfile && activationStatus && (
              <div style={{
                marginTop: '8px',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                display: 'inline-block',
                backgroundColor: '#f0f0f0',
                color: '#666',
                border: '1px solid #ddd'
              }}>
                DEBUG: Status = {activationStatus.accountStatus || 'undefined'} | Email Verified = {activationStatus.emailVerified ? 'Yes' : 'No'}
              </div>
            )}
            {isOwnProfile && activationStatus && activationStatus.accountStatus !== 'active' && (
              <div style={{
                marginTop: '8px',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '500',
                display: 'inline-block',
                backgroundColor: activationStatus.accountStatus === 'pending_email_verification' 
                  ? 'var(--warning-light)' 
                  : activationStatus.accountStatus === 'pending_admin_approval'
                  ? 'var(--info-light)'
                  : 'var(--danger-light)',
                color: activationStatus.accountStatus === 'pending_email_verification'
                  ? 'var(--warning-dark)'
                  : activationStatus.accountStatus === 'pending_admin_approval'
                  ? 'var(--info-color)'
                  : 'var(--danger-color)',
                border: `1px solid ${
                  activationStatus.accountStatus === 'pending_email_verification'
                    ? 'var(--warning-color)'
                    : activationStatus.accountStatus === 'pending_admin_approval'
                    ? 'var(--info-color)'
                    : 'var(--danger-color)'
                }`
              }}>
                {activationStatus.accountStatus === 'pending_email_verification' && '📧 Email Verification Pending'}
                {activationStatus.accountStatus === 'pending_admin_approval' && '⏳ Pending Admin Approval'}
                {activationStatus.accountStatus === 'suspended' && '🚫 Account Suspended'}
                {activationStatus.accountStatus === 'deactivated' && '⚪ Account Deactivated'}
              </div>
            )}
            
            {/* Meta Field Badges */}
            {user.visibleMetaFields && (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                marginTop: '12px'
              }}>
                {/* Verification Badges */}
                {user.visibleMetaFields.idVerified && (
                  <span className="meta-badge verification" title="ID Verified">
                    ✓ ID Verified
                  </span>
                )}
                {user.visibleMetaFields.phoneVerified && (
                  <span className="meta-badge verification" title="Phone Verified">
                    📱 Phone
                  </span>
                )}
                {user.visibleMetaFields.emailVerified && (
                  <span className="meta-badge verification" title="Email Verified">
                    📧 Email
                  </span>
                )}
                {user.visibleMetaFields.employmentVerified && (
                  <span className="meta-badge verification" title="Employment Verified">
                    💼 Employment
                  </span>
                )}
                {user.visibleMetaFields.educationVerified && (
                  <span className="meta-badge verification" title="Education Verified">
                    🎓 Education
                  </span>
                )}
                {user.visibleMetaFields.backgroundCheckStatus === 'passed' && (
                  <span className="meta-badge verification" title="Background Checked">
                    🛡️ Verified
                  </span>
                )}
                
                {/* Premium Badges */}
                {user.visibleMetaFields.isPremium && (
                  <span className="meta-badge premium" title={`${user.visibleMetaFields.premiumStatus} Member`}>
                    💎 {user.visibleMetaFields.premiumStatus === 'vip' ? 'VIP' : user.visibleMetaFields.premiumStatus === 'elite' ? 'Elite' : 'Premium'}
                  </span>
                )}
                {user.visibleMetaFields.isFeatured && (
                  <span className="meta-badge featured" title="Featured Profile">
                    🚀 Featured
                  </span>
                )}
                {user.visibleMetaFields.isStaffPick && (
                  <span className="meta-badge staff-pick" title="Staff Pick">
                    🎖️ Staff Pick
                  </span>
                )}
                
                {/* Achievement Badges */}
                {user.visibleMetaFields.profileRank && (
                  <span className="meta-badge achievement" title="Profile Rank">
                    🏆 {user.visibleMetaFields.profileRank}
                  </span>
                )}
                {user.visibleMetaFields.trustScore >= 80 && (
                  <span className="meta-badge trust" title={`Trust Score: ${user.visibleMetaFields.trustScore}`}>
                    ⭐ Trusted
                  </span>
                )}
              </div>
            )}
          </div>
          
          {/* Floating Ribbon with Stats - Positioned before Edit Button */}
          {isOwnProfile && (
            <div className="stats-ribbon">
              {/* Profile Views */}
              <div className="stat-ribbon-item stat-views">
                <span className="stat-icon">👁️</span>
                <span className="stat-value">{kpiStats.profileViews}</span>
                <div className="ribbon-flag"></div>
              </div>
              
              {/* Shortlisted */}
              <div className="stat-ribbon-item stat-shortlist">
                <span className="stat-icon">📝</span>
                <span className="stat-value">{kpiStats.shortlistedBy}</span>
                <div className="ribbon-flag"></div>
              </div>
              
              {/* Favorites */}
              <div className="stat-ribbon-item stat-favorites">
                <span className="stat-icon">❤️</span>
                <span className="stat-value">{kpiStats.favoritedBy}</span>
                <div className="ribbon-flag"></div>
              </div>
            </div>
          )}
          
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
                onClick={async () => {
                  console.log('📋 Opening PII Request Modal - Refreshing access status...');
                  await checkPIIAccess(); // Refresh access status before opening modal
                  setShowPIIRequestModal(true);
                }}
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
        <div className="section-header-with-edit">
          <h3>👤 Basic Information</h3>
          {isOwnProfile && editingSection === 'basic' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn-save-section"
                onClick={() => handleSaveEdit('basic')}
                disabled={savingSection === 'basic'}
              >
                {savingSection === 'basic' ? '💾 Saving...' : '💾 Save'}
              </button>
              <button 
                className="btn-cancel-section"
                onClick={handleCancelEdit}
                disabled={savingSection === 'basic'}
              >
                ✕ Cancel
              </button>
            </div>
          )}
        </div>
        {editingSection === 'basic' ? (
          <div className="inline-edit-form">
            <div className="form-row">
              <div className="form-group">
                <label><strong>Gender:</strong></label>
                <select name="gender" value={editFormData.gender || ''} onChange={handleEditChange} className="form-control">
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label><strong>Height:</strong></label>
                <input type="text" name="height" value={editFormData.height || ''} onChange={handleEditChange} className="form-control" placeholder="e.g. 5'8&quot;" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label><strong>Location:</strong></label>
                <input type="text" name="location" value={editFormData.location || ''} onChange={handleEditChange} className="form-control" placeholder="City, Country" />
              </div>
              <div className="form-group">
                <label><strong>Religion:</strong></label>
                <select name="religion" value={editFormData.religion || ''} onChange={handleEditChange} className="form-control">
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
            </div>
            <div className="form-row">
              <div className="form-group">
                <label><strong>Relationship Status:</strong></label>
                <select name="relationshipStatus" value={editFormData.relationshipStatus || ''} onChange={handleEditChange} className="form-control">
                  <option value="">Select</option>
                  <option value="Single">Single</option>
                  <option value="Divorced">Divorced</option>
                  <option value="Widowed">Widowed</option>
                  <option value="Separated">Separated</option>
                </select>
              </div>
              <div className="form-group">
                <label><strong>Looking For:</strong></label>
                <select name="lookingFor" value={editFormData.lookingFor || ''} onChange={handleEditChange} className="form-control">
                  <option value="">Select...</option>
                  <option value="Marriage">Marriage</option>
                  <option value="Life Partner">Life Partner</option>
                  <option value="Serious Relationship">Serious Relationship</option>
                  <option value="Casual Dating">Casual Dating</option>
                  <option value="Friendship">Friendship</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label><strong>Working Status:</strong></label>
                <select name="workingStatus" value={editFormData.workingStatus || ''} onChange={handleEditChange} className="form-control">
                  <option value="">Select</option>
                  <option value="Employed">Employed</option>
                  <option value="Self-Employed">Self-Employed</option>
                  <option value="Unemployed">Unemployed</option>
                  <option value="Student">Student</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label><strong>Citizenship Status:</strong></label>
                <select name="citizenshipStatus" value={editFormData.citizenshipStatus || ''} onChange={handleEditChange} className="form-control">
                  <option value="">Select...</option>
                  <option value="Citizen">Citizen</option>
                  <option value="Greencard">Greencard</option>
                  <option value="Work Visa">Work Visa</option>
                  <option value="Student Visa">Student Visa</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>
        ) : (
          <div className="profile-info">
            {user.username && <p><strong>Username:</strong> {user.username}</p>}
            {(user.gender || user.sex) && <p><strong>Gender:</strong> {user.gender || user.sex}</p>}
            {age && <p><strong>Age:</strong> {age} years</p>}
            {user.height && <p><strong>Height:</strong> {user.height}</p>}
            {user.location && <p><strong>Location:</strong> {user.location}</p>}
            {user.religion && <p><strong>Religion:</strong> {user.religion}</p>}
            {user.relationshipStatus && <p><strong>Relationship Status:</strong> {user.relationshipStatus}</p>}
            {user.lookingFor && <p><strong>Looking For:</strong> {user.lookingFor}</p>}
            {user.workingStatus && <p><strong>Working Status:</strong> {user.workingStatus}</p>}
            {user.linkedinUrl && <p><strong>LinkedIn:</strong> <a href={user.linkedinUrl} target="_blank" rel="noopener noreferrer">{user.linkedinUrl}</a></p>}
            {user.citizenshipStatus && <p><strong>Citizenship Status:</strong> {user.citizenshipStatus}</p>}
          </div>
        )}
      </div>

      {/* Regional & Cultural Information */}
      {(user.countryOfOrigin || user.countryOfResidence || user.state || user.languagesSpoken?.length > 0 || user.motherTongue || user.caste || user.familyType || user.familyValues || user.castePreference || user.eatingPreference) && (
        <div className="profile-section">
          <div className="section-header-with-edit">
            <h3>🌍 Regional & Cultural</h3>
          </div>
          <div className="profile-info">
            {user.countryOfOrigin && <p><strong>Country of Origin:</strong> {user.countryOfOrigin === 'IN' ? 'India' : user.countryOfOrigin === 'US' ? 'USA' : user.countryOfOrigin}</p>}
            {user.countryOfResidence && <p><strong>Residence:</strong> {user.countryOfResidence === 'IN' ? 'India' : user.countryOfResidence === 'US' ? 'USA' : user.countryOfResidence}</p>}
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
          <div className="section-header-with-edit">
            <h3>💭 Personal & Lifestyle</h3>
          </div>
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
          <div className="section-header-with-edit">
            <h3>🎓 Education History</h3>
          </div>
          <div className="profile-info">
            {user.educationHistory.map((edu, idx) => (
              <div key={idx} style={{marginBottom: '15px', paddingBottom: '15px', borderBottom: idx < user.educationHistory.length - 1 ? '1px solid #eee' : 'none'}}>
                <p><strong>{edu.level ? `${edu.level} - ${edu.degree}` : edu.degree}</strong></p>
                <p style={{marginLeft: '10px', color: '#666'}}>{edu.institution}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Work Experience */}
      {user.workExperience && user.workExperience.length > 0 && (
        <div className="profile-section">
          <div className="section-header-with-edit">
            <h3>💼 Work Experience</h3>
          </div>
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
                onClick={async () => {
                  await checkPIIAccess();
                  setShowPIIRequestModal(true);
                }}
              >
                Request Access
              </button>
            </div>
          )}
        </div>
      )}

      {/* Contact Information (PII Protected) */}
      <div className="profile-section">
        <div className="section-header-with-edit">
          <h3>📧 Contact Information</h3>
          {isOwnProfile && editingSection === 'contact' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn-save-section"
                onClick={() => handleSaveEdit('contact')}
                disabled={savingSection === 'contact'}
              >
                {savingSection === 'contact' ? '💾 Saving...' : '💾 Save'}
              </button>
              <button 
                className="btn-cancel-section"
                onClick={handleCancelEdit}
                disabled={savingSection === 'contact'}
              >
                ✕ Cancel
              </button>
            </div>
          )}
        </div>
        {isOwnProfile || piiAccess.contact_info ? (
          editingSection === 'contact' ? (
            <div className="inline-edit-form">
              <div className="form-row">
                <div className="form-group">
                  <label><strong>Contact Number:</strong></label>
                  <input type="tel" name="contactNumber" value={editFormData.contactNumber || ''} onChange={handleEditChange} className="form-control" placeholder="+1 234 567 8900" />
                </div>
                <div className="form-group">
                  <label><strong>Contact Email:</strong></label>
                  <input type="email" name="contactEmail" value={editFormData.contactEmail || ''} onChange={handleEditChange} className="form-control" placeholder="email@example.com" />
                </div>
              </div>
            </div>
          ) : (
            <div className="profile-info">
              <p><strong>Contact Number:</strong> {user.contactNumber || 'Not provided'}</p>
              <p><strong>Contact Email:</strong> {user.contactEmail || 'Not provided'}</p>
            </div>
          )
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
        <div className="section-header-with-edit">
          <h3>🎂 Date of Birth</h3>
          {isOwnProfile && editingSection === 'dateOfBirth' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn-save-section"
                onClick={() => handleSaveEdit('dateOfBirth')}
                disabled={savingSection === 'dateOfBirth'}
              >
                {savingSection === 'dateOfBirth' ? '💾 Saving...' : '💾 Save'}
              </button>
              <button 
                className="btn-cancel-section"
                onClick={handleCancelEdit}
                disabled={savingSection === 'dateOfBirth'}
              >
                ✕ Cancel
              </button>
            </div>
          )}
        </div>
        {isOwnProfile || piiAccess.date_of_birth ? (
          editingSection === 'dateOfBirth' ? (
            <div className="inline-edit-form">
              <div className="form-row">
                <div className="form-group">
                  <label><strong>Date of Birth:</strong></label>
                  <input type="date" name="dateOfBirth" value={editFormData.dateOfBirth || ''} onChange={handleEditChange} className="form-control" />
                </div>
              </div>
              <p style={{ marginTop: '12px', fontSize: '14px', color: 'var(--text-secondary, #666)' }}>Current Age: {editFormData.dateOfBirth ? calculateAge(editFormData.dateOfBirth) : 'N/A'} years</p>
            </div>
          ) : (
            <div className="profile-info">
              <p><strong>Date of Birth:</strong> {user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : 'Not provided'}</p>
              {age && <p><strong>Age:</strong> {age} years</p>}
            </div>
          )
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
        <div className="section-header-with-edit">
          <h3>💭 Preferences & Background</h3>
        </div>
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
          <div className="section-header-with-edit">
            <h3>🎯 Partner Matching Criteria</h3>
          </div>
          <div className="profile-info">
            {user.partnerCriteria.ageRangeRelative ? (
              <p>
                <strong>Preferred Age Range:</strong>{' '}
                {(() => {
                  const userAge = (() => {
                    if (!user.dateOfBirth) return null;
                    const birthDate = new Date(user.dateOfBirth);
                    const today = new Date();
                    let age = today.getFullYear() - birthDate.getFullYear();
                    const monthDiff = today.getMonth() - birthDate.getMonth();
                    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                      age--;
                    }
                    return age;
                  })();
                  
                  if (!userAge) return 'Not specified';
                  
                  const minAge = userAge + (user.partnerCriteria.ageRangeRelative.minOffset || 0);
                  const maxAge = userAge + (user.partnerCriteria.ageRangeRelative.maxOffset || 0);
                  const minText = user.partnerCriteria.ageRangeRelative.minOffset === 0 ? 'same age' : `${Math.abs(user.partnerCriteria.ageRangeRelative.minOffset)} ${user.partnerCriteria.ageRangeRelative.minOffset < 0 ? 'year(s) younger' : 'year(s) older'}`;
                  const maxText = user.partnerCriteria.ageRangeRelative.maxOffset === 0 ? 'same age' : `${Math.abs(user.partnerCriteria.ageRangeRelative.maxOffset)} ${user.partnerCriteria.ageRangeRelative.maxOffset < 0 ? 'year(s) younger' : 'year(s) older'}`;
                  
                  return `${minAge}-${maxAge} years (${minText} to ${maxText})`;
                })()}
              </p>
            ) : user.partnerCriteria.ageRange && (user.partnerCriteria.ageRange.min || user.partnerCriteria.ageRange.max) && (
              <p>
                <strong>Preferred Age Range:</strong>{' '}
                {user.partnerCriteria.ageRange.min || 'Any'} - {user.partnerCriteria.ageRange.max || 'Any'} years
              </p>
            )}
            {user.partnerCriteria.heightRangeRelative ? (
              <p>
                <strong>Preferred Height Range:</strong>{' '}
                {(() => {
                  if (!user.height) return 'Not specified';
                  
                  // Parse user's height (e.g., "5'8\"" or "5'8")
                  const heightMatch = user.height.match(/(\d+)'(\d+)/);
                  if (!heightMatch) return 'Not specified';
                  
                  const userHeightInches = (parseInt(heightMatch[1]) * 12) + parseInt(heightMatch[2]);
                  const minInches = userHeightInches + (user.partnerCriteria.heightRangeRelative.minInches || 0);
                  const maxInches = userHeightInches + (user.partnerCriteria.heightRangeRelative.maxInches || 0);
                  
                  const minFeet = Math.floor(minInches / 12);
                  const minRemainInches = minInches % 12;
                  const maxFeet = Math.floor(maxInches / 12);
                  const maxRemainInches = maxInches % 12;
                  
                  const minText = user.partnerCriteria.heightRangeRelative.minInches === 0 ? 'same height' : `${Math.abs(user.partnerCriteria.heightRangeRelative.minInches)} in ${user.partnerCriteria.heightRangeRelative.minInches < 0 ? 'shorter' : 'taller'}`;
                  const maxText = user.partnerCriteria.heightRangeRelative.maxInches === 0 ? 'same height' : `${Math.abs(user.partnerCriteria.heightRangeRelative.maxInches)} in ${user.partnerCriteria.heightRangeRelative.maxInches < 0 ? 'shorter' : 'taller'}`;
                  
                  return `${minFeet}'${minRemainInches}" - ${maxFeet}'${maxRemainInches}" (${minText} to ${maxText})`;
                })()}
              </p>
            ) : user.partnerCriteria.heightRange && (
              <>
                {(user.partnerCriteria.heightRange.minFeet || user.partnerCriteria.heightRange.maxFeet) ? (
                  <p>
                    <strong>Preferred Height Range:</strong>{' '}
                    {user.partnerCriteria.heightRange.minFeet ? 
                      `${user.partnerCriteria.heightRange.minFeet}'${user.partnerCriteria.heightRange.minInches || 0}"` : 
                      'Any'} 
                    {' - '}
                    {user.partnerCriteria.heightRange.maxFeet ? 
                      `${user.partnerCriteria.heightRange.maxFeet}'${user.partnerCriteria.heightRange.maxInches || 0}"` : 
                      'Any'}
                  </p>
                ) : (
                  <p><strong>Preferred Height Range:</strong> Not specified</p>
                )}
              </>
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
        <div className="section-header-with-edit">
          <h3>📷 Photos</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isOwnProfile && currentUsername && (
              <button
                onClick={async () => {
                  console.log('🔄 Manual refresh triggered');
                  await checkPIIAccess();
                  await loadAccessibleImages();
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  background: 'white',
                  color: '#667eea',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                title="Refresh image access status"
              >
                🔄 Refresh
              </button>
            )}
          </div>
        </div>
        {isOwnProfile ? (
          user.images?.length > 0 ? (
            <div className="images-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '16px',
              marginTop: '16px'
            }}>
              {user.images.map((img, idx) => (
                <div key={idx} style={{ aspectRatio: '1', maxWidth: '400px' }}>
                  <img
                    src={img}
                    alt={`${user.firstName}'s profile ${idx + 1}`}
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      objectFit: 'cover', 
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                  />
                  {idx === 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      left: '12px',
                      background: 'linear-gradient(135deg, #ffc107, #ff9800)',
                      color: 'white',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: '700',
                      boxShadow: '0 2px 8px rgba(255, 193, 7, 0.4)'
                    }}>
                      ⭐ Profile Picture
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="no-data">No photos available</p>
          )
        ) : piiAccess.images ? (
          user.images?.length > 0 ? (
            <div className="images-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '16px',
              marginTop: '16px'
            }}>
              {(accessibleImages.length > 0 ? accessibleImages : 
                user.images?.map((img, idx) => ({
                  imageId: `${username}-img-${idx}`,
                  imageUrl: img,
                  imageOrder: idx,
                  isProfilePic: idx === 0,
                  hasAccess: piiAccess.images, // ✅ Use PII access status
                  initialVisibility: { type: 'clear' } // ✅ Show clear if has access
                }))
              ).map((image, idx) => (
                <ProfileImage
                  key={image.imageId || idx}
                  image={image}
                  viewerUsername={currentUsername}
                  profileOwnerUsername={username}
                  isFavorited={isFavorited}
                  isShortlisted={isShortlisted}
                  onRequestAccess={handleRequestAccess}
                  onRenewAccess={handleRenewAccess}
                />
              ))}
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

      {/* L3V3L Matching Breakdown Table */}
      {l3v3lMatchData && !isOwnProfile && (
        <L3V3LMatchingTable matchingData={l3v3lMatchData} />
      )}

      {/* Image Access Request Modal */}
      {showImageAccessModal && (
        <ImageAccessRequestModal
          isOpen={showImageAccessModal}
          onClose={() => {
            setShowImageAccessModal(false);
            setSelectedImageForAccess(null);
          }}
          ownerName={user.firstName}
          ownerUsername={username}
          imageCount={user.images?.length || 0}
          requestType={selectedImageForAccess?.hasAccess ? 'renewal' : 'initial'}
          onSubmit={handleSubmitAccessRequest}
        />
      )}

      {/* PII Request Modal */}
      <PIIRequestModal
        isOpen={showPIIRequestModal}
        profileUsername={username}
        profileName={`${user.firstName} ${user.lastName}`}
        currentAccess={piiAccess}
        requestStatus={piiRequestStatus}
        onClose={() => setShowPIIRequestModal(false)}
        onRefresh={() => {
          console.log('🔄 PIIRequestModal requested refresh');
          checkPIIAccess(); // Refresh access status when modal opens
        }}
        onSuccess={() => {
          setSuccessMessage('Request sent successfully!');
          setTimeout(() => setSuccessMessage(''), 5000); // Auto-hide after 5 seconds
          checkPIIAccess(); // Refresh access status after submit
        }}
      />
    </div>
  );
};

export default Profile;

