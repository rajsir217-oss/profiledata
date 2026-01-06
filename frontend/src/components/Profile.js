import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
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
import RichTextEditor from "./shared/RichTextEditor";
import { getAuthenticatedImageUrl } from "../utils/imageUtils";
import logger from "../utils/logger";
import "./Profile.css";
import { ACTION_ICONS } from "../constants/icons";

// Create axios instance for verification API
const verificationApi = axios.create({
  baseURL: getBackendUrl()
});

const Profile = ({ 
  usernameFromProp = null,  // Optional: username passed as prop for embedded mode
  embedded = false,         // Flag for embedded mode (hides header/navigation)
  initialUserData = null    // Optional: Pre-loaded user data to show immediately
}) => {
  const { username: usernameFromParams } = useParams();
  const username = usernameFromProp || usernameFromParams;
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(initialUserData);
  const [loading, setLoading] = useState(!initialUserData);
  const [error, setError] = useState("");
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  
  // Search carousel navigation state
  const [searchResults, setSearchResults] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(null);
  
  // KPI Stats
  const [kpiStats, setKpiStats] = useState({
    profileViews: 0,
    shortlistedBy: 0,
    favoritedBy: 0
  });
  
  // Action states (isExcluded and showMessageModal only - others already exist)
  const [isExcluded, setIsExcluded] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  
  // L3V3L Matching Data
  const [l3v3lMatchData, setL3v3lMatchData] = useState(null);
  
  // Editable About Me state
  const [isEditingAboutMe, setIsEditingAboutMe] = useState(false);
  const [editedAboutMe, setEditedAboutMe] = useState('');
  const [savingAboutMe, setSavingAboutMe] = useState(false);
  
  // AI Rephrase state
  const [isRephrasing, setIsRephrasing] = useState(false);
  const [rephraseStyle, setRephraseStyle] = useState('concise');
  const [aiProvider, setAiProvider] = useState('groq'); // 'groq' (recommended) or 'gemini'
  
  logger.debug('Profile component loaded for:', username);
  
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
  
  // Extract search carousel context from navigation state
  useEffect(() => {
    if (location.state?.searchResults && location.state?.currentIndex !== null) {
      setSearchResults(location.state.searchResults);
      setCurrentIndex(location.state.currentIndex);
      logger.debug('Carousel context loaded:', {
        totalResults: location.state.searchResults.length,
        currentIndex: location.state.currentIndex,
        currentProfile: username
      });
    }
  }, [location.state, username]);
  
  // PII Access states
  const [piiAccess, setPiiAccess] = useState({
    images: false,
    contact_info: false,
    contact_number: false,
    contact_email: false,
    date_of_birth: false,
    linkedin_url: false
  });
  const [piiRequestStatus, setPiiRequestStatus] = useState({});
  const [showPIIRequestModal, setShowPIIRequestModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState(null); // For PII request validation
  
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
  
  // Image lightbox state
  const [lightboxImage, setLightboxImage] = useState(null);
  const [showLightbox, setShowLightbox] = useState(false);
  
  // Collapsed sections state (all collapsed by default)
  const [collapsedSections, setCollapsedSections] = useState({
    basicInfo: true,
    regionalCultural: true,
    personalLifestyle: true,
    educationHistory: true,
    workExperience: true,
    contactInformation: true,
    preferencesBackground: true,
    partnerCriteria: true
  });

  // Deep-link support (e.g. from email CTA): /profile/:username?open=contact
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const open = params.get('open');
    if (open === 'contact') {
      setCollapsedSections(prev => ({
        ...prev,
        contactInformation: false
      }));
    }
  }, [location.search]);
  
  const toggleSection = (sectionName) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };
  
  // Touch swipe state for mobile navigation
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  
  const currentUsername = localStorage.getItem('username');
  
  // Debug: Log user data when it changes
  useEffect(() => {
    if (user) {
      logger.debug('User data loaded:', {
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
        
        // Pass requester to properly handle PII masking, and include context to avoid waterfall
        const res = await api.get(`/profile/${username}?requester=${currentUsername}&include_context=true`);
        logger.debug('API Response:', res);
        
        const profileData = res.data;
        setUser(profileData);
        
        // Populate consolidated context data
        if (profileData.kpiStats) {
          setKpiStats(profileData.kpiStats);
        }
        
        if (profileData.piiAccess) {
          setPiiAccess(profileData.piiAccess);
        }
        
        if (profileData.piiRequestStatus) {
          setPiiRequestStatus(profileData.piiRequestStatus);
        }
        
        if (profileData.isOnline !== undefined) {
          setIsOnline(profileData.isOnline);
        }
        
        // Debug: Log relationship status from API
        console.log('💜 Profile relationship status from API:', {
          isFavorited: profileData.isFavorited,
          isShortlisted: profileData.isShortlisted,
          isExcluded: profileData.isExcluded,
          username: profileData.username
        });
        
        if (profileData.isFavorited !== undefined) {
          setIsFavorited(profileData.isFavorited);
        }
        
        if (profileData.isShortlisted !== undefined) {
          setIsShortlisted(profileData.isShortlisted);
        }
        
        if (profileData.isExcluded !== undefined) {
          setIsExcluded(profileData.isExcluded);
        }
        
        // Debug: Log visibility settings
        console.log('👁️ Profile data received - visibility settings:', {
          contactEmailVisible: profileData.contactEmailVisible,
          contactNumberVisible: profileData.contactNumberVisible,
          linkedinUrlVisible: profileData.linkedinUrlVisible,
          contactEmailMasked: profileData.contactEmailMasked,
          contactNumberMasked: profileData.contactNumberMasked,
          contactNumber: profileData.contactNumber ? 'present' : 'missing',
          contactEmail: profileData.contactEmail ? 'present' : 'missing'
        });
        
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
          
          // Fetch current user's profile for PII request validation
          // (Still needed if not already cached, but could be optimized later)
          if (!currentUserProfile) {
            try {
              const myProfileRes = await api.get(`/profile/${currentUsername}?requester=${currentUsername}`);
              setCurrentUserProfile(myProfileRes.data);
            } catch (profileErr) {
              console.error("Error fetching current user profile:", profileErr);
            }
          }
          
          // Load accessible images with privacy settings (Legacy system check)
          await loadAccessibleImages();
          
          // Fallback: If API didn't return relationship status, fetch it separately
          if (profileData.isFavorited === undefined || profileData.isShortlisted === undefined) {
            try {
              const [favResponse, shortlistResponse] = await Promise.all([
                api.get(`/favorites/${currentUsername}`),
                api.get(`/shortlist/${currentUsername}`)
              ]);
              
              const favorites = favResponse.data.favorites || favResponse.data || [];
              const shortlist = shortlistResponse.data.shortlist || shortlistResponse.data || [];
              
              setIsFavorited(favorites.some(u => (u.username || u) === username));
              setIsShortlisted(shortlist.some(u => (u.username || u) === username));
            } catch (relErr) {
              console.error("Error checking user relationship:", relErr);
            }
          }
        }
        
        // Activation status if viewing own profile
        if (currentUsername === username) {
          await fetchActivationStatus();
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
        console.error("Error details:", {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status,
          username: username,
          currentUsername: currentUsername
        });
        
        // More specific error messages
        if (err.response?.status === 404) {
          setError(`Profile not found: ${username}`);
        } else if (err.response?.status === 403) {
          setError("You don't have permission to view this profile");
        } else if (err.response?.data?.detail) {
          setError(err.response.data.detail);
        } else {
          setError(`Unable to load profile: ${err.message || 'Unknown error'}`);
        }
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
      logger.debug('Page focused - refreshing KPI stats');
      fetchKPIStats();
    };
    window.addEventListener('focus', handleFocus);
    
    // Subscribe to online status changes for this user
    const unsubscribe = onlineStatusService.subscribe((changedUsername, online) => {
      if (changedUsername === username) {
        logger.debug(`Status update for ${username}:`, online ? 'online' : 'offline');
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
        logger.debug('Fetching L3V3L match data for:', username);
        const response = await api.get(`/l3v3l-match-details/${currentUsername}/${username}`);
        
        if (response.data && response.data.matchScore) {
          setL3v3lMatchData({
            overall: response.data.matchScore,
            compatibilityLevel: response.data.compatibilityLevel || 'Good Match',
            gender: response.data.breakdown?.gender || 0,
            l3v3l_pillars: response.data.breakdown?.l3v3l_pillars || 0,
            demographics: response.data.breakdown?.demographics || 0,
            partner_preferences: response.data.breakdown?.partner_preferences || 0,
            habits_personality: response.data.breakdown?.habits_personality || 0,
            career_education: response.data.breakdown?.career_education || 0,
            physical_attributes: response.data.breakdown?.physical_attributes || 0,
            cultural_factors: response.data.breakdown?.cultural_factors || 0,
            matchReasons: response.data.matchReasons || []
          });
          logger.debug('L3V3L match data loaded:', response.data);
        }
      } catch (error) {
        // Silently fail - not all profiles will have L3V3L data
        logger.debug('No L3V3L match data available');
      }
    };
    
    fetchL3V3LMatchData();
  }, [username, currentUsername, isOwnProfile]);

  const fetchActivationStatus = async () => {
    try {
      const response = await verificationApi.get(`/api/verification/status/${username}`);
      setActivationStatus(response.data);
      logger.debug('Activation status loaded:', response.data);
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
      logger.debug('Admin user - full PII access');
      setPiiAccess({
        images: true,
        contact_info: true,
        contact_number: true,
        contact_email: true,
        date_of_birth: true,
        linkedin_url: true
      });
      return;
    }
    
    try {
      const [imagesRes, contactNumberRes, contactEmailRes, dobRes, linkedinRes] = await Promise.all([
        api.get(`/pii-access/check?requester=${currentUsername}&profile_owner=${username}&access_type=images`),
        api.get(`/pii-access/check?requester=${currentUsername}&profile_owner=${username}&access_type=contact_number`),
        api.get(`/pii-access/check?requester=${currentUsername}&profile_owner=${username}&access_type=contact_email`),
        api.get(`/pii-access/check?requester=${currentUsername}&profile_owner=${username}&access_type=date_of_birth`),
        api.get(`/pii-access/check?requester=${currentUsername}&profile_owner=${username}&access_type=linkedin_url`)
      ]);
      
      logger.debug('PII Access Check Results:', {
        images: imagesRes.data.hasAccess,
        contact_number: contactNumberRes.data.hasAccess,
        contact_email: contactEmailRes.data.hasAccess,
        date_of_birth: dobRes.data.hasAccess,
        linkedin_url: linkedinRes.data.hasAccess
      });
      
      setPiiAccess({
        images: imagesRes.data.hasAccess,
        contact_info: contactNumberRes.data.hasAccess || contactEmailRes.data.hasAccess, // Legacy: true if either contact field has access
        contact_number: contactNumberRes.data.hasAccess,
        contact_email: contactEmailRes.data.hasAccess,
        date_of_birth: dobRes.data.hasAccess,
        linkedin_url: linkedinRes.data.hasAccess
      });
      
      // Check pending request status for each type
      const requestStatus = {};
      
      // Fetch pending outgoing requests to this profile
      try {
        const outgoingRes = await api.get(`/pii-requests/${currentUsername}/outgoing`);
        const outgoingRequests = outgoingRes.data.requests || [];
        
        // Find pending requests to this specific profile
        outgoingRequests.forEach(req => {
          if (req.profileUsername === username && req.status === 'pending') {
            // Map requestType to our status keys
            const typeMap = {
              'images': 'images',
              'contact_number': 'contact_number',
              'contact_email': 'contact_email',
              'date_of_birth': 'date_of_birth',
              'linkedin_url': 'linkedin_url'
            };
            const statusKey = typeMap[req.requestType];
            if (statusKey) {
              requestStatus[statusKey] = 'pending';
            }
          }
        });
      } catch (err) {
        logger.error('Error fetching outgoing requests:', err);
      }
      
      // For images, check per-image access if not pending
      if (!requestStatus['images'] && imagesRes.data.hasAccess) {
        try {
          const perImageRes = await api.get(`/pii-access/check-images`, {
            params: { requester: currentUsername, profile_owner: username }
          });
          const imageAccessList = perImageRes.data.images || [];
          const hasAnyActiveAccess = imageAccessList.some(img => img.hasAccess && img.reason === 'granted');
          
          if (hasAnyActiveAccess) {
            requestStatus['images'] = 'approved';
          } else {
            requestStatus['images'] = 'expired';
          }
        } catch (err) {
          requestStatus['images'] = 'approved';
        }
      }
      
      // Other PII types - set approved if has access and not pending
      if (!requestStatus['contact_number'] && contactNumberRes.data.hasAccess) {
        requestStatus['contact_number'] = 'approved';
      }
      if (!requestStatus['contact_email'] && contactEmailRes.data.hasAccess) {
        requestStatus['contact_email'] = 'approved';
      }
      if (!requestStatus['date_of_birth'] && dobRes.data.hasAccess) {
        requestStatus['date_of_birth'] = 'approved';
      }
      if (!requestStatus['linkedin_url'] && linkedinRes.data.hasAccess) {
        requestStatus['linkedin_url'] = 'approved';
      }
      
      setPiiRequestStatus(requestStatus);
    } catch (err) {
      console.error("Error checking PII access:", err);
    }
  };

  // Load accessible images with privacy settings and expiry info
  const loadAccessibleImages = async () => {
    if (isOwnProfile || !currentUsername || !user) {
      // Owner sees all images normally, or user not loaded yet
      return;
    }

    try {
      // Use the new per-image access check endpoint
      // This accounts for one-time views, expiry, and per-image access rules
      const accessResponse = await api.get(`/pii-access/check-images`, {
        params: {
          requester: currentUsername,
          profile_owner: username
        }
      });
      
      const imageAccessList = accessResponse.data.images || [];
      
      if (user?.images?.length > 0) {
        // Create image objects with per-image access status
        const imagesWithAccess = user.images.map((img, idx) => {
          const accessInfo = imageAccessList.find(a => a.index === idx) || { hasAccess: false, reason: 'unknown' };
          return {
            imageId: `${username}-img-${idx}`,
            imageUrl: img,
            imageOrder: idx,
            isProfilePic: idx === 0,
            hasAccess: accessInfo.hasAccess,
            accessReason: accessInfo.reason,
            // For images without access, show blurred
            initialVisibility: accessInfo.hasAccess 
              ? { type: 'clear' } 
              : { type: 'blurred', blurLevel: 'heavy' }
          };
        });
        
        logger.debug('Loaded images with per-image access:', imagesWithAccess);
        setAccessibleImages(imagesWithAccess);
      } else {
        logger.debug('No images to load');
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
      
      logger.debug('PII Access Change Event:', detail);
      
      // If this is about access to the current profile we're viewing
      if (ownerUsername === username && targetUsername === currentUsername) {
        logger.debug('Refreshing access');
        
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
      logger.debug('Auto-loading accessible images');
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

      logger.debug('Submitting access request:', {
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

      logger.debug('Access request response:', response);

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
      logger.debug('Fetching KPI stats for:', username);
      
      const [viewsRes, shortlistRes, favoritesRes] = await Promise.all([
        api.get(`/profile-views/${username}/count`),
        api.get(`/their-shortlists/${username}`),
        api.get(`/their-favorites/${username}`)
      ]);
      
      logger.debug('Views Response:', viewsRes.data);
      logger.debug('Shortlist Response:', shortlistRes.data);
      logger.debug('Favorites Response:', favoritesRes.data);
      
      const stats = {
        profileViews: viewsRes.data?.totalViews || viewsRes.data?.uniqueViewers || 0,
        shortlistedBy: shortlistRes.data?.users?.length || 0,
        favoritedBy: favoritesRes.data?.users?.length || 0
      };
      
      logger.debug('Parsed KPI stats:', stats);
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

  // Carousel navigation handlers
  const handlePreviousProfile = () => {
    if (searchResults && currentIndex !== null && currentIndex > 0) {
      const prevUser = searchResults[currentIndex - 1];
      navigate(`/profile/${prevUser.username}`, {
        state: {
          searchResults,
          currentIndex: currentIndex - 1,
          fromSearch: true
        }
      });
    }
  };

  const handleNextProfile = () => {
    if (searchResults && currentIndex !== null && currentIndex < searchResults.length - 1) {
      const nextUser = searchResults[currentIndex + 1];
      navigate(`/profile/${nextUser.username}`, {
        state: {
          searchResults,
          currentIndex: currentIndex + 1,
          fromSearch: true
        }
      });
    }
  };

  const handleBackToSearch = () => {
    navigate('/search'); // Navigate directly back to search page
  };

  // Touch swipe gesture handlers
  const minSwipeDistance = 50; // Minimum distance for a swipe (in pixels)

  const onTouchStart = (e) => {
    setTouchEnd(null); // Reset touch end
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (searchResults && currentIndex !== null) {
      if (isLeftSwipe) {
        // Swipe left = Next profile
        logger.debug('Swipe left - next profile');
        handleNextProfile();
      } else if (isRightSwipe) {
        // Swipe right = Previous profile
        logger.debug('Swipe right - previous profile');
        handlePreviousProfile();
      }
    }
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
      
      logger.debug('Saving section:', section);
      logger.debug('Edit form data:', editFormData);
      
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
            logger.debug(`Saving field: ${field}`);
          } else {
            // Skipped empty field
          }
        });
      } else if (section === 'contact') {
        if (editFormData.contactNumber !== undefined && editFormData.contactNumber !== null && editFormData.contactNumber !== '') {
          formData.append('contactNumber', editFormData.contactNumber);
          logger.debug('Saving contactNumber');
        }
        if (editFormData.contactEmail !== undefined && editFormData.contactEmail !== null && editFormData.contactEmail !== '') {
          formData.append('contactEmail', editFormData.contactEmail);
          logger.debug('Saving contactEmail');
        }
      } else if (section === 'dateOfBirth') {
        if (editFormData.dateOfBirth !== undefined && editFormData.dateOfBirth !== null && editFormData.dateOfBirth !== '') {
          formData.append('dateOfBirth', editFormData.dateOfBirth);
          logger.debug('Saving dateOfBirth');
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
      
      logger.debug('API Response:', response.data);
      
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

  // Handle About Me edit
  const handleEditAboutMe = () => {
    // Initialize with custom content or strip HTML from generated content
    const currentContent = user.customAboutMe || 
      generateAboutMe(user).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    setEditedAboutMe(currentContent);
    setIsEditingAboutMe(true);
  };

  const handleSaveAboutMe = async () => {
    setSavingAboutMe(true);
    try {
      const formData = new FormData();
      formData.append('customAboutMe', editedAboutMe);
      
      const response = await api.put(`/profile/${username}`, formData);
      setUser(response.data.user || response.data);
      setIsEditingAboutMe(false);
      showToast('About Me updated successfully!', 'success');
    } catch (err) {
      console.error('Error saving About Me:', err);
      showToast('Failed to update About Me', 'error');
    } finally {
      setSavingAboutMe(false);
    }
  };

  const handleResetAboutMe = async () => {
    setSavingAboutMe(true);
    try {
      const formData = new FormData();
      formData.append('customAboutMe', '__RESET__');  // Special value to clear custom content
      
      const response = await api.put(`/profile/${username}`, formData);
      setUser(response.data.user || response.data);
      setIsEditingAboutMe(false);
      showToast('About Me reset to auto-generated content', 'success');
    } catch (err) {
      console.error('Error resetting About Me:', err);
      showToast('Failed to reset About Me', 'error');
    } finally {
      setSavingAboutMe(false);
    }
  };

  // AI Rephrase handler
  const handleRephraseWithAI = async () => {
    if (!editedAboutMe || editedAboutMe.trim().length < 20) {
      showToast('Please enter at least 20 characters to rephrase', 'warning');
      return;
    }
    
    setIsRephrasing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/ai/rephrase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: editedAboutMe.replace(/<[^>]*>/g, ''), // Strip HTML tags
          style: rephraseStyle,
          provider: aiProvider
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.rephrased_text) {
        setEditedAboutMe(data.rephrased_text);
        showToast('✨ Text rephrased with AI!', 'success');
      } else {
        showToast(data.error || 'Failed to rephrase text', 'error');
      }
    } catch (err) {
      console.error('Error rephrasing with AI:', err);
      showToast('Failed to connect to AI service', 'error');
    } finally {
      setIsRephrasing(false);
    }
  };

  if (loading) return <p>Loading profile...</p>;
  if (error) return <p className="text-danger">{error}</p>;
  if (!user) return <p>No profile found.</p>;

  const age = user.dateOfBirth ? calculateAge(user.dateOfBirth) : null;

  const publicImages = Array.isArray(user.publicImages) ? user.publicImages : [];
  const publicImageObjects = publicImages.map((img, idx) => ({
    imageId: `${username}-public-${idx}`,
    imageUrl: img,
    imageOrder: idx,
    isProfilePic: false,
    hasAccess: false,
    initialVisibility: { type: 'clear' }
  }));
  // publicAvatar available for future use if needed
  // const publicAvatar = publicImages?.[0] || null;
  
  // Check if user has all access
  const hasAllAccess = isOwnProfile || (piiAccess.images && piiAccess.contact_info && piiAccess.date_of_birth);

  return (
    <div 
      className={`container profile-page-wide ${embedded ? 'profile-embedded' : 'mt-4'}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
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

      {/* Search Carousel Navigation - Show only when viewing from search (not in embedded mode) */}
      {!embedded && searchResults && currentIndex !== null && (
        <div className="profile-carousel-nav">
          <button 
            className="carousel-back-btn"
            onClick={handleBackToSearch}
            title="Back to Search Results"
          >
            <span className="back-icon">↩</span>
            <span className="back-text">Back to Search</span>
          </button>
          
          <div className="carousel-controls">
            <button 
              className="carousel-nav-btn carousel-prev"
              onClick={handlePreviousProfile}
              disabled={currentIndex === 0}
              title="Previous Profile"
            >
              <span className="carousel-arrow">‹‹</span>
              <span className="carousel-label">Previous</span>
            </button>
            
            <span className="carousel-position">
              {currentIndex + 1} / {searchResults.length}
            </span>
            
            <button 
              className="carousel-nav-btn carousel-next"
              onClick={handleNextProfile}
              disabled={currentIndex === searchResults.length - 1}
              title="Next Profile"
            >
              <span className="carousel-label">Next</span>
              <span className="carousel-arrow">››</span>
            </button>
          </div>
        </div>
      )}

      <div className="profile-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '25px', width: '100%', flexWrap: 'wrap', position: 'relative' }}>
          {/* Profile Avatar - Always shown */}
          <div className="profile-avatar-container" style={{ flexShrink: 0, width: '120px', height: '120px' }}>
            {/* Main Avatar - Always use image[0] (profile picture) */}
            {(() => {
              // Check per-image access for avatar (first image, index 0)
              const avatarAccessInfo = accessibleImages.find(img => img.imageOrder === 0);
              // If accessibleImages is empty (not loaded yet), default to false for non-owners
              const hasAvatarAccess = accessibleImages.length > 0 
                ? (avatarAccessInfo?.hasAccess ?? false)
                : false;
              
              // Check if profile picture is visible due to global setting (backend sets profilePicVisible: true)
              const profilePicVisibleGlobal = user.profilePicVisible === true;
              
              // ALSO check if images array has content - if backend sent images, they should be visible
              const hasImagesFromBackend = user.images && user.images.length > 0 && !user.imagesMasked;
              
              // Avatar should ALWAYS be image[0] (the profile picture)
              // Show it clearly if: own profile, admin, has per-image access, global setting, OR backend sent unmasked images
              const viewerHasAvatarAccess = (isOwnProfile || isAdmin || (piiAccess.images && hasAvatarAccess) || profilePicVisibleGlobal || hasImagesFromBackend);
              const avatarSrc = user.images?.[0]; // Always use image[0] as avatar
              const canOpenAvatar = viewerHasAvatarAccess && !!avatarSrc;

              return (
            <div style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              overflow: 'hidden',
              border: `4px solid ${user.gender === 'Female' ? '#ec4899' : 'var(--primary-color, #667eea)'}`,
              boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
              backgroundColor: user.gender === 'Female' ? '#fce7f3' : '#e0e7ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '48px',
              fontWeight: 'bold',
              color: user.gender === 'Female' ? '#ec4899' : '#667eea',
              cursor: canOpenAvatar ? 'pointer' : 'default',
              position: 'relative'
            }}
            onClick={() => {
              if (canOpenAvatar) {
                setLightboxImage(avatarSrc);
                setShowLightbox(true);
              }
            }}
            title={canOpenAvatar ? 'Click to enlarge' : ''}
            >
              {/* Show actual image if own profile, has access, or is admin */}
              {(canOpenAvatar && avatarSrc) ? (
                <img src={getAuthenticatedImageUrl(avatarSrc)} alt={user.firstName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : user.images?.[0] ? (
                /* Show blurred image if user has photos but viewer has no access */
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  <img 
                    src={getAuthenticatedImageUrl(user.images[0])} 
                    alt={user.firstName} 
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      objectFit: 'cover',
                      filter: 'blur(15px)',
                      transform: 'scale(1.1)'
                    }} 
                  />
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: '24px',
                    textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                  }}>
                    🔒
                  </div>
                </div>
              ) : (
                /* Show initials if no photos */
                <span>{user.firstName?.[0]}{user.lastName?.[0]}</span>
              )}
            </div>
              );
            })()}
          </div>
          
          {/* Profile Info */}
          <div className="profile-title-section" style={{ flex: 1, minWidth: '250px' }}>
            <h2>
              {user.firstName} {user.lastName}
              {!isOwnProfile && (
                <span className={`status-bulb-profile ${isOnline ? 'online' : 'offline'}`} title={isOnline ? 'Online Now' : 'Offline'}>
                  {isOnline ? '🟢' : '⚪'}
                </span>
              )}
              {/* Profile Creator Badge */}
              {user.profileCreatedBy && (
                <ProfileCreatorBadge 
                  creatorType={user.profileCreatedBy}
                  size="medium"
                  showLabel={true}
                  showIcon={true}
                />
              )}
              {/* Pause Status Badge */}
              {!isOwnProfile && user.accountStatus === 'paused' && (
                <span className="pause-badge-profile" title="User is taking a break">
                  ⏸️ PAUSED
                </span>
              )}
            </h2>
            
            {/* Last Activity Status - Only show for other users' profiles */}
            {!isOwnProfile && user.status?.last_seen && (
              <div className="last-activity-badge" title={`Last seen: ${getRelativeActivityTime(user.status.last_seen)}`}>
                <span className="activity-icon" style={{ color: getActivityBadgeProps(user.status.last_seen).color }}>
                  {getActivityBadgeProps(user.status.last_seen).icon}
                </span>
                <span className="activity-text">
                  {getActivityBadgeProps(user.status.last_seen).label}
                </span>
              </div>
            )}
            {/* Username - visible to admin and profile owner only */}
            {(isAdmin || isOwnProfile) && user.username && (
              <p style={{ 
                fontSize: '14px', 
                color: '#6c757d', 
                margin: '5px 0 0 0',
                fontFamily: 'monospace',
                letterSpacing: '0.5px'
              }}>
                <strong>Username:</strong> <span style={{ 
                  backgroundColor: '#e3f2fd', 
                  padding: '3px 10px', 
                  borderRadius: '4px',
                  color: '#1976d2',
                  fontWeight: '500'
                }}>@{user.username}</span>
              </p>
            )}
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
          
          {/* Member View: Photo Gallery (5 slots) */}
          {!isOwnProfile && (
            <div className="member-photo-gallery">
              {/* Slot 1: Profile Picture (always shown if available) */}
              <div className="gallery-slot profile-pic-slot">
                {user.images?.[0] ? (
                  <img 
                    src={getAuthenticatedImageUrl(user.images[0])}
                    alt="Profile"
                    className="gallery-image"
                    onClick={() => {
                      // Profile pic is always clickable (it's in the profilePic bucket)
                      setLightboxImage(user.images[0]);
                      setShowLightbox(true);
                    }}
                  />
                ) : (
                  <div className="gallery-placeholder">
                    <span>👤</span>
                  </div>
                )}
                <span className="slot-label">Profile</span>
              </div>
              
              {/* Slots 2-5: Additional Photos (visible if in user.images array from backend) */}
              {[1, 2, 3, 4].map((index) => {
                // Backend already filters images based on 3-bucket visibility + PII access
                // If image exists in user.images, it's accessible
                const image = user.images?.[index];
                const hasAccess = !!image; // If backend returned it, user has access
                
                return (
                  <div key={index} className={`gallery-slot ${hasAccess ? 'accessible' : 'locked'}`}>
                    {hasAccess && image ? (
                      <img 
                        src={getAuthenticatedImageUrl(image)}
                        alt={`Photo ${index + 1}`}
                        className="gallery-image"
                        onClick={() => {
                          setLightboxImage(image);
                          setShowLightbox(true);
                        }}
                      />
                    ) : hasAccess && !image ? (
                      <div className="gallery-placeholder empty">
                        <span>📷</span>
                      </div>
                    ) : (
                      <div className="gallery-placeholder locked" title="Request photo access to view">
                        <span>🔒</span>
                      </div>
                    )}
                    <span className="slot-label">{hasAccess ? (image ? `Photo ${index + 1}` : 'Empty') : 'Locked'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      
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

      {/* About Me Narrative */}
      <div className="profile-section profile-narrative-section">
        <div className="section-header-with-edit">
          <h3>📝 About Me</h3>
          {isOwnProfile && !isEditingAboutMe && (
            <button 
              className="about-me-edit-btn"
              onClick={handleEditAboutMe}
              title="Edit About Me"
            >
              ✎
            </button>
          )}
          {isOwnProfile && isEditingAboutMe && (
            <div className="about-me-action-btns">
              <button 
                className="about-me-save-btn"
                onClick={handleSaveAboutMe}
                disabled={savingAboutMe}
                title="Save"
              >
                {savingAboutMe ? '⏳' : '✓'}
              </button>
              {user.customAboutMe && (
                <button 
                  className="about-me-reset-btn"
                  onClick={handleResetAboutMe}
                  disabled={savingAboutMe}
                  title="Reset to auto-generated"
                >
                  ↺
                </button>
              )}
              <button 
                className="about-me-cancel-btn"
                onClick={() => setIsEditingAboutMe(false)}
                disabled={savingAboutMe}
                title="Cancel"
              >
                ✕
              </button>
            </div>
          )}
        </div>
        
        {isEditingAboutMe ? (
          <div className="about-me-edit-container">
            <RichTextEditor
              value={editedAboutMe}
              onChange={setEditedAboutMe}
              placeholder="Write about yourself... Use the toolbar to add bold, colors, and more!"
              minHeight={200}
              simpleToolbar={true}
            />
            
            {/* AI Rephrase Section */}
            <div className="ai-rephrase-section">
              <div className="ai-rephrase-controls">
                <select 
                  value={aiProvider} 
                  onChange={(e) => setAiProvider(e.target.value)}
                  className="ai-provider-select"
                  disabled={isRephrasing}
                  title="Choose AI provider"
                >
                  <option value="groq">⚡ Groq (Recommended)</option>
                  <option value="gemini">🌐 Gemini</option>
                </select>
                <select 
                  value={rephraseStyle} 
                  onChange={(e) => setRephraseStyle(e.target.value)}
                  className="ai-style-select"
                  disabled={isRephrasing}
                >
                  <option value="concise">✂️ Concise & Sharp</option>
                  <option value="warm">🌟 Warm & Friendly</option>
                  <option value="professional">💼 Professional</option>
                  <option value="casual">😊 Casual</option>
                </select>
                <button 
                  className="btn-ai-rephrase"
                  onClick={handleRephraseWithAI}
                  disabled={isRephrasing || !editedAboutMe || editedAboutMe.trim().length < 20}
                  title="Rephrase your text using AI"
                >
                  {isRephrasing ? '✨ Rephrasing...' : '✨ Rephrase with AI'}
                </button>
              </div>
              <p className="ai-rephrase-hint">
                💡 AI will rephrase your text while keeping all facts intact
              </p>
            </div>
          </div>
        ) : (
          <div 
            className="profile-narrative-content"
            dangerouslySetInnerHTML={{ __html: user.customAboutMe || generateAboutMe(user) }}
          />
        )}
      </div>

      {/* What You're Looking For Narrative */}
      <div className="profile-section profile-narrative-section">
        <h3>💑 What You're Looking For</h3>
        <div 
          className="profile-narrative-content"
          dangerouslySetInnerHTML={{ __html: generatePartnerPreference(user) }}
        />
      </div>

      {/* Basic Info (Collapsible) */}
      <div className="profile-section">
        <div className="section-header-with-edit">
          <h3 onClick={() => toggleSection('basicInfo')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{collapsedSections.basicInfo ? '▶' : '▼'}</span>
            👤 Basic Information
          </h3>
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
        {!collapsedSections.basicInfo && (editingSection === 'basic' ? (
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
            {/* Working Status is auto-computed from work experience - see Qualifications tab */}
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
            {isOwnProfile && user.username && <p><strong>Username:</strong> {user.username}</p>}
            {(user.gender || user.sex) && <p><strong>Gender:</strong> {user.gender || user.sex}</p>}
            {age && <p><strong>Age:</strong> {age} years</p>}
            {(user.birthMonth && user.birthYear) && <p><strong>Date of Birth:</strong> {String(user.birthMonth).padStart(2, '0')}/{user.birthYear}</p>}
            {user.height && <p><strong>Height:</strong> {user.height}</p>}
            {user.profileCreatedBy && (
              <p>
                <strong>Profile Created By:</strong>{' '}
                {user.profileCreatedBy === 'me' && <span>👤 Self</span>}
                {user.profileCreatedBy === 'parent' && <span>👨‍👩‍👧 Parent/Guardian</span>}
                {user.profileCreatedBy === 'other' && <span>👥 Other (Relative/Friend)</span>}
              </p>
            )}
            {user.location && <p><strong>Location:</strong> {user.location}</p>}
            {user.religion && <p><strong>Religion:</strong> {user.religion}</p>}
            {user.relationshipStatus && <p><strong>Relationship Status:</strong> {user.relationshipStatus}</p>}
            {user.lookingFor && <p><strong>Looking For:</strong> {user.lookingFor}</p>}
            {getWorkingStatus(user) && <p><strong>Working Status:</strong> {getWorkingStatus(user)}</p>}
            {user.linkedinUrl && <p><strong>LinkedIn:</strong> <a href={user.linkedinUrl} target="_blank" rel="noopener noreferrer">{user.linkedinUrl}</a></p>}
            {user.citizenshipStatus && <p><strong>Citizenship Status:</strong> {user.citizenshipStatus}</p>}
          </div>
        ))}
      </div>

      {/* Regional & Cultural Information */}
      {(user.countryOfOrigin || user.countryOfResidence || user.state || user.languagesSpoken?.length > 0 || user.motherTongue || user.caste || user.familyType || user.familyValues || user.castePreference || user.eatingPreference) && (
        <div className="profile-section">
          <div className="section-header-with-edit">
            <h3 onClick={() => toggleSection('regionalCultural')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{collapsedSections.regionalCultural ? '▶' : '▼'}</span>
              🌍 Regional & Cultural
            </h3>
          </div>
          {!collapsedSections.regionalCultural && (
          <div className="profile-info">
            {user.countryOfOrigin && <p><strong>Country of Origin:</strong> {user.countryOfOrigin === 'IN' ? 'India' : user.countryOfOrigin === 'US' ? 'USA' : user.countryOfOrigin}</p>}
            {user.countryOfResidence && <p><strong>Residence:</strong> {user.countryOfResidence === 'IN' ? 'India' : user.countryOfResidence === 'US' ? 'USA' : user.countryOfResidence}</p>}
            {user.state && <p><strong>State:</strong> {user.state}</p>}
            {user.languagesSpoken && user.languagesSpoken.length > 0 && (
              <p><strong>Languages Spoken:</strong> {user.languagesSpoken.join(', ')}</p>
            )}
            {user.motherTongue && <p><strong>Mother Tongue:</strong> {user.motherTongue}</p>}
            {user.caste && <p><strong>Caste:</strong> {user.caste}</p>}
            {user.castePreference && <p><strong>Caste Details:</strong> {user.castePreference}</p>}
            {user.familyType && <p><strong>Family Type:</strong> {user.familyType}</p>}
            {user.familyValues && <p><strong>Family Values:</strong> {user.familyValues}</p>}
          </div>
          )}
        </div>
      )}

      {/* Personal & Lifestyle */}
      {(user.relationshipStatus || user.lookingFor || user.bodyType || user.drinking || user.smoking || user.eatingPreference || user.hasChildren || user.wantsChildren || user.pets || user.interests || user.languages) && (
        <div className="profile-section">
          <div className="section-header-with-edit">
            <h3 onClick={() => toggleSection('personalLifestyle')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{collapsedSections.personalLifestyle ? '▶' : '▼'}</span>
              💭 Personal & Lifestyle
            </h3>
          </div>
          {!collapsedSections.personalLifestyle && (
          <div className="profile-info">
            {user.relationshipStatus && <p><strong>Relationship Status:</strong> {user.relationshipStatus}</p>}
            {user.lookingFor && <p><strong>Looking For:</strong> {user.lookingFor}</p>}
            {user.bodyType && <p><strong>Body Type:</strong> {user.bodyType}</p>}
            {user.drinking && <p><strong>Drinking:</strong> {user.drinking}</p>}
            {user.smoking && <p><strong>Smoking:</strong> {user.smoking}</p>}
            {user.eatingPreference && <p><strong>Eating Preference:</strong> {user.eatingPreference}</p>}
            {user.hasChildren && <p><strong>Has Children:</strong> {user.hasChildren}</p>}
            {user.wantsChildren && <p><strong>Wants Children:</strong> {user.wantsChildren}</p>}
            {user.pets && <p><strong>Pets:</strong> {user.pets}</p>}
            {user.interests && <p><strong>Interests & Hobbies:</strong> {user.interests}</p>}
            {user.languages && <p><strong>Languages:</strong> {user.languages}</p>}
          </div>
          )}
        </div>
      )}

      {/* Education History */}
      {user.educationHistory && user.educationHistory.length > 0 && (
        <div className="profile-section">
          <div className="section-header-with-edit">
            <h3 onClick={() => toggleSection('educationHistory')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{collapsedSections.educationHistory ? '▶' : '▼'}</span>
              🎓 Education History
            </h3>
          </div>
          {!collapsedSections.educationHistory && (
          <div className="profile-info">
            {user.educationHistory.map((edu, idx) => (
              <div key={idx} style={{marginBottom: '15px', paddingBottom: '15px', borderBottom: idx < user.educationHistory.length - 1 ? '1px solid #eee' : 'none'}}>
                <p><strong>{edu.level ? `${edu.level} - ${edu.degree}` : edu.degree}</strong></p>
                <p style={{marginLeft: '10px', color: '#666'}}>{edu.institution}</p>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {/* Work Experience */}
      {user.workExperience && user.workExperience.length > 0 && (
        <div className="profile-section">
          <div className="section-header-with-edit">
            <h3 onClick={() => toggleSection('workExperience')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{collapsedSections.workExperience ? '▶' : '▼'}</span>
              💼 Work Experience
            </h3>
          </div>
          {!collapsedSections.workExperience && (
          <div className="profile-info">
            {user.workExperience.map((work, idx) => (
              <div key={idx} style={{marginBottom: '15px', paddingBottom: '15px', borderBottom: idx < user.workExperience.length - 1 ? '1px solid #eee' : 'none'}}>
                <p><strong>{work.status === 'current' ? '🟢 Current Position' : '⚪ Past Position'}</strong></p>
                <p style={{marginLeft: '10px', color: '#666', whiteSpace: 'pre-wrap'}}>{work.description}</p>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {/* Contact Information (PII Protected) */}
      <div className="profile-section">
        <div className="section-header-with-edit">
          <h3 onClick={() => toggleSection('contactInformation')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{collapsedSections.contactInformation ? '▶' : '▼'}</span>
            📧 Contact Information
          </h3>
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
        {!collapsedSections.contactInformation && (
        <>
        {/* Show contact info if: own profile, has PII access, OR contact fields are member-visible */}
        {isOwnProfile || piiAccess.contact_info || user.contactNumberVisible || user.contactEmailVisible || user.linkedinUrlVisible ? (
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
              {/* Show contact number if visible or has access */}
              {(user.contactNumberVisible || piiAccess.contact_number || isOwnProfile) && user.contactNumber && !user.contactNumberMasked ? (
                <p>
                  <strong>Contact Number:</strong> {user.contactNumber}
                  {user.contactNumberVisible && !isOwnProfile && <span className="member-visible-tag" style={{ marginLeft: '8px', fontSize: '11px', color: '#1e40af', background: '#dbeafe', padding: '2px 8px', borderRadius: '10px' }}>👁️ Member Visible</span>}
                </p>
              ) : user.contactNumber ? (
                <p>
                  <strong>Contact Number:</strong> <span className="pii-masked">🔒 Private</span>
                  <button 
                    className="btn-request-inline" 
                    onClick={() => setShowPIIRequestModal(true)}
                    style={{ marginLeft: '10px', fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: 'var(--primary-color, #667eea)', color: 'white', border: 'none', cursor: 'pointer' }}
                  >
                    Request Access
                  </button>
                </p>
              ) : null}
              {/* Show contact email if visible or has access */}
              {(user.contactEmailVisible || piiAccess.contact_email || isOwnProfile) && user.contactEmail && !user.contactEmailMasked ? (
                <p>
                  <strong>Contact Email:</strong> {user.contactEmail}
                  {user.contactEmailVisible && !isOwnProfile && <span className="member-visible-tag" style={{ marginLeft: '8px', fontSize: '11px', color: '#1e40af', background: '#dbeafe', padding: '2px 8px', borderRadius: '10px' }}>👁️ Member Visible</span>}
                </p>
              ) : user.contactEmail ? (
                <p>
                  <strong>Contact Email:</strong> <span className="pii-masked">🔒 Private</span>
                  <button 
                    className="btn-request-inline" 
                    onClick={() => setShowPIIRequestModal(true)}
                    style={{ marginLeft: '10px', fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: 'var(--primary-color, #667eea)', color: 'white', border: 'none', cursor: 'pointer' }}
                  >
                    Request Access
                  </button>
                </p>
              ) : null}
              {/* Show LinkedIn URL if visible or has access */}
              {user.linkedinUrl && (
                (user.linkedinUrlVisible || piiAccess.linkedin_url || isOwnProfile) && (!user.linkedinUrlMasked || piiAccess.linkedin_url) ? (
                  <p>
                    <strong>LinkedIn:</strong>{' '}
                    <a href={user.linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color, #667eea)' }}>
                      {user.linkedinUrl}
                    </a>
                    {user.linkedinUrlVisible && !isOwnProfile && <span className="member-visible-tag" style={{ marginLeft: '8px', fontSize: '11px', color: '#1e40af', background: '#dbeafe', padding: '2px 8px', borderRadius: '10px' }}>👁️ Member Visible</span>}
                  </p>
                ) : (
                  <p>
                    <strong>LinkedIn:</strong> <span className="pii-masked">🔒 Private</span>
                    <button 
                      className="btn-request-inline" 
                      onClick={() => setShowPIIRequestModal(true)}
                      style={{ marginLeft: '10px', fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: 'var(--primary-color, #667eea)', color: 'white', border: 'none', cursor: 'pointer' }}
                    >
                      Request Access
                    </button>
                  </p>
                )
              )}
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
        </>
        )}
      </div>

      {/* Preferences & Background (Collapsible) */}
      <div className="profile-section">
        <div className="section-header-with-edit">
          <h3 onClick={() => toggleSection('preferencesBackground')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{collapsedSections.preferencesBackground ? '▶' : '▼'}</span>
            💭 Preferences & Background
          </h3>
        </div>
        {!collapsedSections.preferencesBackground && (
        <div className="profile-info">
          {/* Removed duplicates: castePreference, eatingPreference, familyType, familyValues - already in Regional & Cultural */}
          {user.familyBackground && <p><strong>Family Background:</strong> {user.familyBackground}</p>}
          {(user.aboutMe || user.aboutYou) && <p><strong>About:</strong> {user.aboutMe || user.aboutYou}</p>}
          {user.partnerPreference && <p><strong>Partner Preference:</strong> {user.partnerPreference}</p>}
        </div>
        )}
      </div>

      {/* Partner Matching Criteria */}
      {user.partnerCriteria && Object.keys(user.partnerCriteria).length > 0 && (
        <div className="profile-section">
          <div className="section-header-with-edit">
            <h3 onClick={() => toggleSection('partnerCriteria')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{collapsedSections.partnerCriteria ? '▶' : '▼'}</span>
              🎯 Partner Matching Criteria
            </h3>
          </div>
          {!collapsedSections.partnerCriteria && (
          <div className="profile-info">
            {user.partnerCriteria.ageRangeRelative ? (
              <p>
                <strong>Preferred Age Range:</strong>{' '}
                {(() => {
                  const userAge = (() => {
                    // FIXED: Use birthMonth and birthYear instead of dateOfBirth
                    if (!user.birthMonth || !user.birthYear) return null;
                    const today = new Date();
                    let age = today.getFullYear() - user.birthYear;
                    // If current month hasn't reached birth month yet, subtract 1
                    if (today.getMonth() + 1 < user.birthMonth) {
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
            {user.partnerCriteria.location && (
              <p><strong>Preferred Locations:</strong> {
                Array.isArray(user.partnerCriteria.location) 
                  ? user.partnerCriteria.location.join(', ')
                  : user.partnerCriteria.location
              }</p>
            )}
            {user.partnerCriteria.languages && user.partnerCriteria.languages.length > 0 && (
              <p><strong>Preferred Languages:</strong> {user.partnerCriteria.languages.join(', ')}</p>
            )}
            {user.partnerCriteria.religion && user.partnerCriteria.religion.length > 0 && (
              <p><strong>Preferred Religion:</strong> {user.partnerCriteria.religion.join(', ')}</p>
            )}
            {user.partnerCriteria.caste && (
              <p><strong>Preferred Caste:</strong> {user.partnerCriteria.caste}</p>
            )}
            {user.partnerCriteria.eatingPreference && user.partnerCriteria.eatingPreference.length > 0 && (
              <p><strong>Preferred Eating:</strong> {user.partnerCriteria.eatingPreference.join(', ')}</p>
            )}
            {user.partnerCriteria.familyType && user.partnerCriteria.familyType.length > 0 && (
              <p><strong>Preferred Family Type:</strong> {user.partnerCriteria.familyType.join(', ')}</p>
            )}
            {user.partnerCriteria.familyValues && user.partnerCriteria.familyValues.length > 0 && (
              <p><strong>Preferred Family Values:</strong> {user.partnerCriteria.familyValues.join(', ')}</p>
            )}
            {user.partnerCriteria.relationshipStatus && user.partnerCriteria.relationshipStatus !== 'Any' && (
              <p><strong>Partner's Relationship Status:</strong> {user.partnerCriteria.relationshipStatus}</p>
            )}
            {user.partnerCriteria.lookingFor && user.partnerCriteria.lookingFor !== 'Any' && (
              <p><strong>Partner Looking For:</strong> {user.partnerCriteria.lookingFor}</p>
            )}
            {user.partnerCriteria.bodyType && user.partnerCriteria.bodyType !== 'Any' && (
              <p><strong>Partner's Body Type:</strong> {user.partnerCriteria.bodyType}</p>
            )}
            {user.partnerCriteria.pets && user.partnerCriteria.pets !== 'Any' && (
              <p><strong>Partner's Pets:</strong> {user.partnerCriteria.pets}</p>
            )}
            {user.partnerCriteria.drinking && user.partnerCriteria.drinking !== 'Any' && (
              <p><strong>Partner's Drinking:</strong> {user.partnerCriteria.drinking}</p>
            )}
            {user.partnerCriteria.smoking && user.partnerCriteria.smoking !== 'Any' && (
              <p><strong>Partner's Smoking:</strong> {user.partnerCriteria.smoking}</p>
            )}
            {user.partnerCriteria.hasChildren && user.partnerCriteria.hasChildren !== 'Any' && (
              <p><strong>Partner Has Children:</strong> {user.partnerCriteria.hasChildren}</p>
            )}
            {user.partnerCriteria.wantsChildren && user.partnerCriteria.wantsChildren !== 'Any' && (
              <p><strong>Partner Wants Children:</strong> {user.partnerCriteria.wantsChildren}</p>
            )}
          </div>
          )}
        </div>
      )}

      {/* Profile Images Section */}
      <div className="profile-section">
        <div className="section-header-with-edit">
          <h3>📷 Photos {user.publicImages?.length > 0 && !isOwnProfile && <span className="member-visible-tag" style={{ marginLeft: '8px', fontSize: '11px', color: '#1e40af', background: '#dbeafe', padding: '2px 8px', borderRadius: '10px' }}>👁️ Member Visible</span>}</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isOwnProfile && currentUsername && (
              <button
                onClick={async () => {
                  logger.debug('Manual refresh triggered');
                  try {
                    // Reload profile with requester param to get proper image filtering
                    const response = await api.get(`/profile/${username}?requester=${currentUsername}`);
                    if (response.data) {
                      setUser(response.data);
                      logger.debug('Profile refreshed, hasOnRequestImages:', response.data.hasOnRequestImages);
                    }
                    // Also refresh PII access status
                    await checkPIIAccess();
                    await loadAccessibleImages();
                  } catch (err) {
                    console.error('Error refreshing:', err);
                  }
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--card-background)',
                  color: 'var(--primary-color)',
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
        {/* Photo visibility logic:
            1. Own profile: show all images
            2. Has accessibleImages loaded: use per-image access status (respects one-time views)
            3. Else: show only publicImages + request access button for private ones
        */}
        {isOwnProfile ? (
          user.images?.length > 0 ? (
            <div className="images-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '16px',
              marginTop: '16px'
            }}>
              {user.images.map((img, idx) => (
                <div
                  key={`${img}-${idx}`}
                  style={{
                    position: 'relative',
                    aspectRatio: '1',
                    maxWidth: '400px',
                    cursor: 'pointer'
                  }}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setLightboxImage(img);
                    setShowLightbox(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setLightboxImage(img);
                      setShowLightbox(true);
                    }
                  }}
                  aria-label={`View photo ${idx + 1} in full size`}
                >
                  <img
                    src={getAuthenticatedImageUrl(img)}
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
                      background: 'linear-gradient(135deg, var(--warning-color), var(--warning-dark, #ff9800))',
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
        ) : accessibleImages.length > 0 ? (
          /* Use per-image access status - respects one-time views and expiry */
          <>
            {/* Debug: Show imageReasons and hasOnRequestImages from backend */}
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
              🔍 Debug: {user.images?.length || 0} images, reasons: [{user.imageReasons?.join(', ')}], 
              hasOnRequest: {String(user.hasOnRequestImages)}, count: {user.onRequestImageCount}
            </div>
            <div className="images-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '16px',
              marginTop: '16px'
            }}>
              {accessibleImages.filter(img => img.hasAccess).map((image, idx) => (
                <ProfileImage
                  key={image.imageId || idx}
                  image={image}
                  viewerUsername={currentUsername}
                  profileOwnerUsername={username}
                  isFavorited={isFavorited}
                  isShortlisted={isShortlisted}
                  onClick={(imageData) => {
                    const imageUrl = imageData?.url || imageData?.imageUrl || imageData;
                    if (imageUrl && typeof imageUrl === 'string') {
                      setLightboxImage(imageUrl);
                      setShowLightbox(true);
                    }
                  }}
                />
              ))}
            </div>
            {/* Show request access if user has onRequest images (regardless of accessibleImages status) */}
            {user.hasOnRequestImages && !piiAccess.images && (
              <div className="pii-locked" style={{ marginTop: '16px' }}>
                <div className="lock-icon">{piiRequestStatus.images === 'pending' ? '⏳' : '🔒'}</div>
                <p>
                  {piiRequestStatus.images === 'pending' 
                    ? 'Request pending approval' 
                    : `${user.onRequestImageCount || 'Some'} photo${(user.onRequestImageCount || 0) !== 1 ? 's' : ''} require${(user.onRequestImageCount || 0) === 1 ? 's' : ''} approval`
                  }
                </p>
                {piiRequestStatus.images !== 'pending' && (
                  <button
                    className="btn-request-small"
                    onClick={() => setShowPIIRequestModal(true)}
                  >
                    Request Access
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Debug: Show imageReasons and hasOnRequestImages from backend */}
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
              🔍 Debug: {user.images?.length || 0} images, reasons: [{user.imageReasons?.join(', ')}], 
              hasOnRequest: {String(user.hasOnRequestImages)}, count: {user.onRequestImageCount}
            </div>
            {publicImageObjects.length > 0 && (
              <div className="images-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: '16px',
                marginTop: '16px'
              }}>
                {publicImageObjects.map((image, idx) => (
                  <ProfileImage
                    key={image.imageId || idx}
                    image={image}
                    viewerUsername={currentUsername}
                    profileOwnerUsername={username}
                    isFavorited={isFavorited}
                    isShortlisted={isShortlisted}
                    onClick={(imageData) => {
                      const imageUrl = imageData?.url || imageData?.imageUrl || imageData;
                      if (imageUrl && typeof imageUrl === 'string') {
                        setLightboxImage(imageUrl);
                        setShowLightbox(true);
                      }
                    }}
                  />
                ))}
              </div>
            )}
            {/* Only show request access if user has onRequest images and no access yet */}
            {user.hasOnRequestImages && !piiAccess.images && (
              <div className="pii-locked">
                <div className="lock-icon">{piiRequestStatus.images === 'pending' ? '⏳' : '🔒'}</div>
                <p>
                  {piiRequestStatus.images === 'pending' 
                    ? 'Request pending approval' 
                    : `${user.onRequestImageCount || 'Some'} photo${(user.onRequestImageCount || 0) !== 1 ? 's' : ''} require${(user.onRequestImageCount || 0) === 1 ? 's' : ''} approval`
                  }
                </p>
                {piiRequestStatus.images !== 'pending' && (
                  <button
                    className="btn-request-small"
                    onClick={() => setShowPIIRequestModal(true)}
                  >
                    Request Access
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* L3V3L Matching Breakdown Table */}
      {l3v3lMatchData && !isOwnProfile && (
        <L3V3LMatchingTable matchingData={l3v3lMatchData} />
      )}

      {/* Edit Profile Button - Show only for own profile */}
      {isOwnProfile && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          padding: '30px 0',
          marginTop: '20px',
          borderTop: '1px solid var(--border-color)'
        }}>
          <button 
            className="btn-edit-profile"
            onClick={() => navigate('/edit-profile')}
            style={{
              padding: '12px 40px',
              fontSize: '16px',
              fontWeight: '600',
              background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
            }}
          >
            ✏️ Edit Profile
          </button>
        </div>
      )}

      {/* Pause Status Notice */}
      {!isOwnProfile && user.accountStatus === 'paused' && (
        <div className="profile-pause-notice">
          <span className="pause-notice-icon">⏸️</span>
          <div className="pause-notice-content">
            <strong>This user is taking a break</strong>
            <p>
              {user.pauseMessage || 'They have temporarily paused their account. Messaging is disabled, but you can still add them to your favorites or shortlist.'}
            </p>
            {user.pausedUntil && (
              <p className="pause-until">
                Scheduled to return: {new Date(user.pausedUntil).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Sticky Action Buttons - Desktop Only (right side) */}
      {!isOwnProfile && (
        <div className="profile-sticky-actions">
          {/* Message Button */}
          <button
            className="btn-sticky-action btn-action-message"
            onClick={() => setShowMessageModal(true)}
            disabled={user.accountStatus === 'paused'}
            title={user.accountStatus === 'paused' ? 'User is paused - messaging disabled' : 'Send Message'}
          >
            <span className="action-icon">{ACTION_ICONS.MESSAGE}</span>
          </button>

          {/* Favorite Button */}
          <button
            className={`btn-sticky-action btn-action-favorite ${isFavorited ? 'active' : ''}`}
            onClick={async () => {
              try {
                const currentUser = localStorage.getItem('username');
                if (isFavorited) {
                  await api.delete(`/favorites/${username}?username=${encodeURIComponent(currentUser)}`);
                  setIsFavorited(false);
                  setSuccessMessage('✅ Removed from favorites');
                } else {
                  await api.post(`/favorites/${username}?username=${encodeURIComponent(currentUser)}`);
                  setIsFavorited(true);
                  setSuccessMessage('✅ Added to favorites');
                }
                setTimeout(() => setSuccessMessage(''), 3000);
              } catch (err) {
                setError('Failed to update favorites');
              }
            }}
            title={isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
          >
            <span className="action-icon">{isFavorited ? ACTION_ICONS.UNFAVORITE : ACTION_ICONS.FAVORITE}</span>
          </button>

          {/* Shortlist Button */}
          <button
            className={`btn-sticky-action btn-action-shortlist ${isShortlisted ? 'active' : ''}`}
            onClick={async () => {
              try {
                const currentUser = localStorage.getItem('username');
                if (isShortlisted) {
                  await api.delete(`/shortlist/${username}?username=${encodeURIComponent(currentUser)}`);
                  setIsShortlisted(false);
                  setSuccessMessage('✅ Removed from shortlist');
                } else {
                  await api.post(`/shortlist/${username}?username=${encodeURIComponent(currentUser)}`);
                  setIsShortlisted(true);
                  setSuccessMessage('✅ Added to shortlist');
                }
                setTimeout(() => setSuccessMessage(''), 3000);
              } catch (err) {
                setError('Failed to update shortlist');
              }
            }}
            title={isShortlisted ? 'Remove from Shortlist' : 'Add to Shortlist'}
          >
            <span className="action-icon">{ACTION_ICONS.SHORTLIST}</span>
          </button>

          {/* PII Request Button */}
          <button
            className="btn-sticky-action btn-action-pii"
            onClick={async () => {
              logger.debug('Opening PII Request Modal');
              await checkPIIAccess();
              setShowPIIRequestModal(true);
            }}
            disabled={hasAllAccess}
            title={hasAllAccess ? 'You Have All Private Information Access' : 'Request Private Information Access'}
          >
            <span className="action-icon">{hasAllAccess ? ACTION_ICONS.UNBLOCK : ACTION_ICONS.REQUEST_CONTACT}</span>
          </button>

          {/* Exclude Button */}
          <button
            className={`btn-sticky-action btn-action-exclude ${isExcluded ? 'active' : ''}`}
            onClick={async () => {
              try {
                const currentUser = localStorage.getItem('username');
                if (isExcluded) {
                  await api.delete(`/exclusions/${username}?username=${encodeURIComponent(currentUser)}`);
                  setIsExcluded(false);
                  setSuccessMessage('✅ Removed from not interested');
                } else {
                  await api.post(`/exclusions/${username}?username=${encodeURIComponent(currentUser)}`);
                  setIsExcluded(true);
                  setSuccessMessage('✅ Marked as not interested');
                }
                setTimeout(() => setSuccessMessage(''), 3000);
              } catch (err) {
                setError('Failed to update not interested');
              }
            }}
            title={isExcluded ? 'Remove from Not Interested' : 'Mark as Not Interested'}
          >
            <span className="action-icon">{isExcluded ? ACTION_ICONS.UNBLOCK : ACTION_ICONS.NOT_INTERESTED}</span>
          </button>
        </div>
      )}

      {/* Action Buttons - Mobile Only (bottom bar) */}
      {!isOwnProfile && (
        <div className="profile-action-buttons">
          {/* Message Button */}
          <button
            className="btn-profile-action btn-action-message"
            onClick={() => setShowMessageModal(true)}
            disabled={user.accountStatus === 'paused'}
            title={user.accountStatus === 'paused' ? 'User is paused - messaging disabled' : 'Send Message'}
          >
            <span className="action-icon">{ACTION_ICONS.MESSAGE}</span>
            <span className="action-label">Message</span>
          </button>

          {/* Favorite Button */}
          <button
            className={`btn-profile-action btn-action-favorite ${isFavorited ? 'active' : ''}`}
            onClick={async () => {
              try {
                const currentUser = localStorage.getItem('username');
                if (isFavorited) {
                  await api.delete(`/favorites/${username}?username=${encodeURIComponent(currentUser)}`);
                  setIsFavorited(false);
                  setSuccessMessage('✅ Removed from favorites');
                } else {
                  await api.post(`/favorites/${username}?username=${encodeURIComponent(currentUser)}`);
                  setIsFavorited(true);
                  setSuccessMessage('✅ Added to favorites');
                }
                setTimeout(() => setSuccessMessage(''), 3000);
              } catch (err) {
                setError('Failed to update favorites');
              }
            }}
            title={isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
          >
            <span className="action-icon">{isFavorited ? ACTION_ICONS.UNFAVORITE : ACTION_ICONS.FAVORITE}</span>
            <span className="action-label">{isFavorited ? 'Favorited' : 'Favorite'}</span>
          </button>

          {/* Shortlist Button */}
          <button
            className={`btn-profile-action btn-action-shortlist ${isShortlisted ? 'active' : ''}`}
            onClick={async () => {
              try {
                const currentUser = localStorage.getItem('username');
                if (isShortlisted) {
                  await api.delete(`/shortlist/${username}?username=${encodeURIComponent(currentUser)}`);
                  setIsShortlisted(false);
                  setSuccessMessage('✅ Removed from shortlist');
                } else {
                  await api.post(`/shortlist/${username}?username=${encodeURIComponent(currentUser)}`);
                  setIsShortlisted(true);
                  setSuccessMessage('✅ Added to shortlist');
                }
                setTimeout(() => setSuccessMessage(''), 3000);
              } catch (err) {
                setError('Failed to update shortlist');
              }
            }}
            title={isShortlisted ? 'Remove from Shortlist' : 'Add to Shortlist'}
          >
            <span className="action-icon">{ACTION_ICONS.SHORTLIST}</span>
            <span className="action-label">{isShortlisted ? 'Shortlisted' : 'Shortlist'}</span>
          </button>

          {/* PII Request Button */}
          <button
            className="btn-profile-action btn-action-pii"
            onClick={async () => {
              logger.debug('Opening PII Request Modal');
              await checkPIIAccess();
              setShowPIIRequestModal(true);
            }}
            disabled={hasAllAccess}
            title={hasAllAccess ? 'You Have All Private Information Access' : 'Request Private Information Access'}
          >
            <span className="action-icon">{hasAllAccess ? ACTION_ICONS.UNBLOCK : ACTION_ICONS.REQUEST_CONTACT}</span>
            <span className="action-label">{hasAllAccess ? 'Full Access' : 'Request PII'}</span>
          </button>

          {/* Exclude Button */}
          <button
            className={`btn-profile-action btn-action-exclude ${isExcluded ? 'active' : ''}`}
            onClick={async () => {
              try {
                const currentUser = localStorage.getItem('username');
                if (isExcluded) {
                  await api.delete(`/exclusions/${username}?username=${encodeURIComponent(currentUser)}`);
                  setIsExcluded(false);
                  setSuccessMessage('✅ Removed from not interested');
                } else {
                  await api.post(`/exclusions/${username}?username=${encodeURIComponent(currentUser)}`);
                  setIsExcluded(true);
                  setSuccessMessage('✅ Marked as not interested');
                }
                setTimeout(() => setSuccessMessage(''), 3000);
              } catch (err) {
                setError('Failed to update not interested');
              }
            }}
            title={isExcluded ? 'Remove from Not Interested' : 'Mark as Not Interested'}
          >
            <span className="action-icon">{isExcluded ? ACTION_ICONS.UNBLOCK : ACTION_ICONS.NOT_INTERESTED}</span>
            <span className="action-label">{isExcluded ? 'Unblock' : 'Not Interested'}</span>
          </button>
        </div>
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

      {/* Message Modal */}
      {showMessageModal && (
        <MessageModal
          isOpen={showMessageModal}
          onClose={() => setShowMessageModal(false)}
          profile={user}
        />
      )}

      {/* PII Request Modal */}
      <PIIRequestModal
        isOpen={showPIIRequestModal}
        profileUsername={username}
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
        onRefresh={() => {
          logger.debug('PIIRequestModal refresh');
          checkPIIAccess(); // Refresh access status when modal opens
        }}
        onSuccess={() => {
          setSuccessMessage('Request sent successfully!');
          setTimeout(() => setSuccessMessage(''), 5000); // Auto-hide after 5 seconds
          checkPIIAccess(); // Refresh access status after submit
        }}
      />

      {/* Image Lightbox Modal */}
      {showLightbox && lightboxImage && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
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
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
              zIndex: 10000
            }}
            onClick={(e) => {
              e.stopPropagation();
              setShowLightbox(false);
              setLightboxImage(null);
            }}
            title="Close"
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
              borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default Profile;

