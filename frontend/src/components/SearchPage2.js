import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../utils/urlHelper';
import api from '../api';
import SearchResultCard from './SearchResultCard';
import MessageModal from './MessageModal';
import SaveSearchModal from './SaveSearchModal';
import PIIRequestModal from './PIIRequestModal';
import PageHeader from './PageHeader';
import OnlineStatusBadge from './OnlineStatusBadge';
import UniversalTabContainer from './UniversalTabContainer';
import socketService from '../services/socketService';
import { onPIIAccessChange } from '../utils/piiAccessEvents';
import logger from '../utils/logger';
import './SearchPage.css';

const SearchPage2 = () => {
  // HYBRID SEARCH: Traditional filters + L3V3L match score (premium feature)
  // State for image indices per user
  const [imageIndices, setImageIndices] = useState({});
  const [imageErrors, setImageErrors] = useState({});
  // eslint-disable-next-line no-unused-vars
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  // Main application state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(20);

  // L3V3L specific state
  const [minMatchScore, setMinMatchScore] = useState(0); // L3V3L match score filter
  const [isPremiumUser, setIsPremiumUser] = useState(false); // Premium status for L3V3L filtering
  const [systemConfig, setSystemConfig] = useState({ enable_l3v3l_for_all: true }); // System configuration

  // User interaction state
  const [users, setUsers] = useState([]);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [searchCriteria, setSearchCriteria] = useState({
    keyword: '',
    gender: '', // Will be set to opposite gender after loading user profile
    ageMin: '',
    ageMax: '',
    heightMinFeet: '',
    heightMinInches: '',
    heightMaxFeet: '',
    heightMaxInches: '',
    heightMin: '', // Kept for backward compatibility
    heightMax: '', // Kept for backward compatibility
    location: '',
    education: '',
    occupation: '',
    religion: '',
    caste: '',
    drinking: '',
    smoking: '',
    relationshipStatus: '',
    newlyAdded: false,
    daysBack: '', // Number of days to look back for profile creation
  });
  const [favoritedUsers, setFavoritedUsers] = useState(new Set());
  const [shortlistedUsers, setShortlistedUsers] = useState(new Set());
  const [excludedUsers, setExcludedUsers] = useState(new Set());
  const [statusMessage, setStatusMessage] = useState('');
  
  // View mode state
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'rows'
  const [cardsPerRow, setCardsPerRow] = useState(() => {
    const saved = localStorage.getItem('searchCardsPerRow');
    return saved ? parseInt(saved) : 3;
  });

  // Saved searches state
  // eslint-disable-next-line no-unused-vars
  const [saveSearchName, setSaveSearchName] = useState('');
  const [savedSearches, setSavedSearches] = useState([]);
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [selectedSearch, setSelectedSearch] = useState(null);

  // PII access state
  const [piiRequests, setPiiRequests] = useState({});

  // Message modal state
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedUserForMessage, setSelectedUserForMessage] = useState(null);

  // PII Request modal state
  const [showPIIRequestModal, setShowPIIRequestModal] = useState(false);
  const [selectedUserForPII, setSelectedUserForPII] = useState(null);
  const [currentPIIAccess, setCurrentPIIAccess] = useState({});

  const navigate = useNavigate();

  useEffect(() => {
    const username = localStorage.getItem('username');
    if (!username) {
      navigate('/login');
      return;
    }
    
    // Load current user's profile to get gender and set default search
    const loadCurrentUserProfile = async () => {
      try {
        const response = await api.get(`/profile/${username}?requester=${username}`);
        setCurrentUserProfile(response.data);
        
        // Check if user is premium (has subscription)
        const userRole = response.data.role?.toLowerCase();
        const hasPremium = userRole === 'premium' || userRole === 'admin';
        setIsPremiumUser(hasPremium);
        
        // Set default gender to opposite gender
        const userGender = response.data.gender?.toLowerCase();
        let oppositeGender = '';
        if (userGender === 'male') {
          oppositeGender = 'female';
        } else if (userGender === 'female') {
          oppositeGender = 'male';
        }
        
        console.log('🎯 User gender:', userGender, '→ Default search gender:', oppositeGender);
        
        // Calculate user's age from date of birth
        let userAge = null;
        if (response.data.dateOfBirth) {
          const birthDate = new Date(response.data.dateOfBirth);
          const today = new Date();
          userAge = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            userAge--;
          }
        }
        
        // Parse user's height from format "5'8"" into feet and inches
        let userHeightFeet = null;
        let userHeightInches = null;
        let userHeightTotalInches = null;
        if (response.data.height) {
          const heightMatch = response.data.height.match(/(\d+)'(\d+)"/);
          if (heightMatch) {
            userHeightFeet = parseInt(heightMatch[1]);
            userHeightInches = parseInt(heightMatch[2]);
            userHeightTotalInches = userHeightFeet * 12 + userHeightInches;
          }
        }
        
        // Set default age range based on gender
        let defaultAgeMin = '';
        let defaultAgeMax = '';
        if (userAge && userGender) {
          if (userGender === 'male') {
            // For male profile: Min = age - 3, Max = age + 1
            defaultAgeMin = (userAge - 3).toString();
            defaultAgeMax = (userAge + 1).toString();
          } else if (userGender === 'female') {
            // For female profile: Min = age - 1, Max = age + 3
            defaultAgeMin = (userAge - 1).toString();
            defaultAgeMax = (userAge + 3).toString();
          }
        }
        
        // Set default height range based on gender
        let defaultHeightMinFeet = '';
        let defaultHeightMinInches = '';
        let defaultHeightMaxFeet = '';
        let defaultHeightMaxInches = '';
        
        if (userHeightTotalInches && userGender) {
          if (userGender === 'male') {
            // For male profile: Min = user height - 3 inches, Max = user height
            const minTotalInches = userHeightTotalInches - 3;
            const maxTotalInches = userHeightTotalInches;
            
            defaultHeightMinFeet = Math.floor(minTotalInches / 12).toString();
            defaultHeightMinInches = (minTotalInches % 12).toString();
            defaultHeightMaxFeet = Math.floor(maxTotalInches / 12).toString();
            defaultHeightMaxInches = (maxTotalInches % 12).toString();
          } else if (userGender === 'female') {
            // For female profile: Min = user height, Max = user height + 3 inches
            const minTotalInches = userHeightTotalInches;
            const maxTotalInches = userHeightTotalInches + 3;
            
            defaultHeightMinFeet = Math.floor(minTotalInches / 12).toString();
            defaultHeightMinInches = (minTotalInches % 12).toString();
            defaultHeightMaxFeet = Math.floor(maxTotalInches / 12).toString();
            defaultHeightMaxInches = (maxTotalInches % 12).toString();
          }
        }
        
        console.log('📊 Default search criteria:', {
          age: userAge,
          ageMin: defaultAgeMin,
          ageMax: defaultAgeMax,
          heightMinFeet: defaultHeightMinFeet,
          heightMinInches: defaultHeightMinInches,
          heightMaxFeet: defaultHeightMaxFeet,
          heightMaxInches: defaultHeightMaxInches
        });
        
        // Set default search criteria with smart age/height defaults
        setSearchCriteria(prev => ({
          ...prev,
          gender: oppositeGender,
          ageMin: defaultAgeMin,
          ageMax: defaultAgeMax,
          heightMinFeet: defaultHeightMinFeet,
          heightMinInches: defaultHeightMinInches,
          heightMaxFeet: defaultHeightMaxFeet,
          heightMaxInches: defaultHeightMaxInches
        }));
      } catch (err) {
        console.error('❌ Error loading current user profile:', err);
        // Set profile anyway to trigger search
        setCurrentUserProfile({});
      }
    };
    
    // Load user's favorites, shortlist, and exclusions
    const loadUserData = async () => {
      try {
        const [favResponse, shortlistResponse, exclusionsResponse] = await Promise.all([
          api.get(`/favorites/${username}`),
          api.get(`/shortlist/${username}`),
          api.get(`/exclusions/${username}`)
        ]);
        
        // Extract usernames from user objects (backend returns full user objects)
        const favoriteUsernames = (favResponse.data.favorites || []).map(u => u.username);
        const shortlistUsernames = (shortlistResponse.data.shortlist || []).map(u => u.username);
        const exclusionUsernames = (exclusionsResponse.data.exclusions || []).map(u => u.username);
        
        setFavoritedUsers(new Set(favoriteUsernames));
        setShortlistedUsers(new Set(shortlistUsernames));
        setExcludedUsers(new Set(exclusionUsernames));
        
        console.log('✅ Loaded user interactions:', {
          favorites: favoriteUsernames.length,
          shortlist: shortlistUsernames.length,
          exclusions: exclusionUsernames.length
        });
      } catch (err) {
        console.error('Error loading user data:', err);
      }
    };
    
    // Load initial online users
    const loadOnlineUsers = async () => {
      try {
        const response = await api.get('/online-status/users');
        logger.debug('Loaded online users:', response.data.onlineUsers);
        const onlineSet = new Set(response.data.onlineUsers || []);
        logger.debug('Online users Set:', onlineSet);
        setOnlineUsers(onlineSet);
      } catch (err) {
        logger.error('Error loading online users:', err);
      }
    };

    // Load system configuration
    const loadSystemConfig = async () => {
      try {
        const response = await api.get('/system-settings');
        setSystemConfig(response.data);
        console.log('🔧 System config loaded:', response.data);
      } catch (error) {
        console.error('Error loading system config:', error);
        // Keep default values if loading fails
      }
    };
    
    loadCurrentUserProfile();
    loadUserData();
    loadSavedSearches();
    loadPiiRequests();
    loadSystemConfig();
    
    // Setup socket listeners users initially with a small delay to let polling service mark user online
    setTimeout(() => {
      loadOnlineUsers();
    }, 1000);
    
    // Refresh online users every 10 seconds
    const onlineUsersInterval = setInterval(() => {
      loadOnlineUsers();
    }, 10000);
    
    // Listen for online status updates
    const handleUserOnline = (data) => {
      logger.debug('User came online:', data.username);
      setOnlineUsers(prev => new Set([...prev, data.username]));
    };
    
    const handleUserOffline = (data) => {
      console.log('User went offline:', data.username);
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.username);
        return newSet;
      });
    };
    
    socketService.on('user_online', handleUserOnline);
    socketService.on('user_offline', handleUserOffline);
    
    // Load initial search results after profile is loaded
    // This will be triggered by useEffect dependency on currentUserProfile
    
    return () => {
      socketService.off('user_online', handleUserOnline);
      socketService.off('user_offline', handleUserOffline);
      
      // Clear online users refresh interval
      if (onlineUsersInterval) {
        clearInterval(onlineUsersInterval);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trigger initial search after user profile is loaded
  useEffect(() => {
    if (currentUserProfile) {
      // Perform initial search with default criteria (opposite gender if available)
      console.log('🔍 Auto-triggering search with gender:', searchCriteria.gender || 'all');
      console.log('📋 Current search criteria:', searchCriteria);
      setTimeout(() => {
        console.log('⏰ Timeout fired - calling handleSearch');
        handleSearch(1);
      }, 800); // Slightly longer delay to ensure all state is updated
    } else {
      console.log('⚠️ currentUserProfile is null/undefined, waiting...');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserProfile]);
  
  // Additional trigger when searchCriteria.gender changes
  useEffect(() => {
    if (currentUserProfile && searchCriteria.gender && users.length === 0) {
      console.log('🔄 Gender changed, triggering search:', searchCriteria.gender);
      handleSearch(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchCriteria.gender]);

  const loadPiiRequests = async () => {
    const currentUser = localStorage.getItem('username');
    if (!currentUser) return;

    try {
      // Load both outgoing requests AND received access grants
      const [requestsResponse, accessResponse] = await Promise.all([
        api.get(`/pii-requests/${currentUser}/outgoing`),
        api.get(`/pii-access/${currentUser}/received`)
      ]);

      const requests = requestsResponse.data.requests || [];
      const receivedAccess = accessResponse.data.receivedAccess || [];
      const requestStatus = {};
      
      console.log('🔍 PII API Responses:');
      console.log('  Requests:', requests);
      console.log('  Received Access:', receivedAccess);

      // First, add ONLY pending requests (not approved ones - those must be in receivedAccess)
      requests.forEach(req => {
        // Handle different response formats
        const targetUsername = req.profileUsername || req.requestedUsername || req.profileOwner?.username;
        if (targetUsername && req.requestType && req.status === 'pending') {
          requestStatus[`${targetUsername}_${req.requestType}`] = 'pending';
        }
      });

      // Then, add all received ACTIVE access (these are truly approved grants)
      receivedAccess.forEach(access => {
        const targetUsername = access?.userProfile?.username;
        if (targetUsername && access?.accessTypes) {
          // Mark all access types as 'approved' ONLY if in receivedAccess (isActive: true)
          access.accessTypes.forEach(accessType => {
            requestStatus[`${targetUsername}_${accessType}`] = 'approved';
          });
        }
      });

      console.log('📊 PII Access Status:', requestStatus);
      setPiiRequests(requestStatus);
    } catch (err) {
      console.error('Error loading PII requests:', err);
    }
  };

  // Listen for PII access changes (grant/revoke)
  useEffect(() => {
    const cleanup = onPIIAccessChange((detail) => {
      console.log('🔔 PII Access changed in search page:', detail);
      // Reload PII requests to update badges
      loadPiiRequests();
    });
    
    return cleanup;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePrevImage = (username, e) => {
    e.stopPropagation();
    setImageIndices(prev => ({
      ...prev,
      [username]: prev[username] === undefined ? 0 : prev[username] > 0 ? prev[username] - 1 : 0
    }));
  };

  const handleNextImage = (username, e, usersData) => {
    e.stopPropagation();
    setImageIndices(prev => {
      const currentIndex = prev[username] || 0;
      const maxIndex = (usersData.find(u => u.username === username)?.images?.length || 1) - 1;
      return {
        ...prev,
        [username]: currentIndex < maxIndex ? currentIndex + 1 : maxIndex
      };
    });
  };

  // eslint-disable-next-line no-unused-vars
  const renderProfileImage = (user) => {
    const currentIndex = imageIndices[user.username] || 0;
    const currentImage = user.images && user.images.length > currentIndex ? user.images[currentIndex] : null;
    const hasError = imageErrors[user.username] || false;

    const hasImageAccess = hasPiiAccess(user.username, 'images');

    // If no access to images, show masked version
    if (!hasImageAccess) {
      return (
        <div className="profile-image-container">
          <div className="profile-thumbnail-placeholder">
            <span className="no-image-icon">🔒</span>
          </div>
          <div className="image-access-overlay">
            <p className="text-muted small">Images Locked</p>
            <button
              className="btn btn-sm btn-primary"
              onClick={(e) => {
                e.stopPropagation();
                openPIIRequestModal(user.username);
              }}
              disabled={isPiiRequestPending(user.username, 'images')}
            >
              {isPiiRequestPending(user.username, 'images') ? (
                <span className="badge bg-warning text-dark">📨 Request Sent</span>
              ) : 'Request Access'}
            </button>
          </div>
          {/* Online Status Badge */}
          <div className="status-badge-absolute">
            <OnlineStatusBadge username={user.username} size="medium" />
          </div>
        </div>
      );
    }

    // Check if image is already a full URL (from search results) or relative path (from profile view)
    const imageSrc = currentImage && currentImage.startsWith('http') ? currentImage : getImageUrl(currentImage);
    return (
      <div className="profile-image-container">
        {currentImage && !hasError ? (
          <img
            key={`${user.username}-${currentIndex}`}
            src={`${imageSrc}?t=${Date.now()}`}
            alt={`${user.firstName}'s profile`}
            className="profile-thumbnail"
            onError={(e) => {
              console.error(`Failed to load image: ${currentImage}`, e);
              setImageErrors(prev => ({ ...prev, [user.username]: true }));
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
            onLoad={(e) => {
              console.log(`Successfully loaded image: ${currentImage}`);
              setImageErrors(prev => ({ ...prev, [user.username]: false }));
              e.target.style.display = 'block';
              e.target.nextSibling.style.display = 'none';
            }}
            crossOrigin="anonymous"
            loading="lazy"
          />
        ) : (
          <div className="profile-thumbnail-placeholder">
            <span className="no-image-icon">👤</span>
          </div>
        )}
        <div className="no-image-icon-overlay" style={{display: hasError || !currentImage ? 'flex' : 'none'}}>👤</div>

        {user.images.length > 1 && (
          <>
            <button
              className="image-nav-btn prev-btn"
              onClick={(e) => handlePrevImage(user.username, e)}
              disabled={currentIndex === 0}
              style={{ padding: 0, minWidth: '28px', maxWidth: '28px', width: '28px', height: '28px' }}
            >
              {'<'}
            </button>
            <button
              className="image-nav-btn next-btn"
              onClick={(e) => handleNextImage(user.username, e, users)}
              disabled={currentIndex === user.images.length - 1}
              style={{ padding: 0, minWidth: '28px', maxWidth: '28px', width: '28px', height: '28px' }}
            >
              {'>'}
            </button>
            <div className="image-counter">
              {currentIndex + 1}/{user.images.length}
            </div>
          </>
        )}
        
        {/* Online Status Badge */}
        <div className="status-badge-absolute">
          <OnlineStatusBadge username={user.username} size="medium" />
        </div>
      </div>
    );
  };

  // Dating field options
  const genderOptions = ['', 'Male', 'Female'];
  const occupationOptions = ['', 'Software Engineer', 'Data Scientist', 'Product Manager', 'Business Analyst', 'Consultant', 'Doctor', 'Chartered Accountant', 'Lawyer', 'Teacher', 'Professor', 'Architect', 'Designer', 'Marketing Manager', 'Sales Executive', 'HR Manager', 'Financial Analyst', 'Civil Engineer', 'Mechanical Engineer', 'Pharmacist', 'Nurse', 'Entrepreneur', 'Banker', 'Government Officer'];
  const religionOptions = ['', 'Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain'];
  const eatingOptions = ['', 'Vegetarian', 'Eggetarian', 'Non-Veg'];
  const lifestyleOptions = ['', 'Never', 'Socially', 'Prefer not to say'];
  const relationshipOptions = ['', 'Single', 'Divorced', 'Widowed'];
  const bodyTypeOptions = ['', 'Slim', 'Athletic', 'Average', 'Curvy'];

  // eslint-disable-next-line no-unused-vars
  const loadUserFavorites = async () => {
    try {
      const username = localStorage.getItem('username');
      if (!username) {
        setFavoritedUsers(new Set());
        return;
      }

      const response = await api.get(`/favorites/${username}`);
      const favorites = response.data.favorites || [];
      const favoritedUsernames = new Set(favorites.map(fav => fav.username));
      setFavoritedUsers(favoritedUsernames);
      console.log('Loaded favorites:', favoritedUsernames);
    } catch (err) {
      // Silently handle error - favorites might not exist yet for new users
      console.debug('No favorites found or error loading favorites:', err);
      setFavoritedUsers(new Set());
    }
  };

  // eslint-disable-next-line no-unused-vars
  const loadUserShortlist = async () => {
    try {
      const username = localStorage.getItem('username');
      if (!username) {
        setShortlistedUsers(new Set());
        return;
      }

      const response = await api.get(`/shortlist/${username}`);
      const shortlist = response.data.shortlist || [];
      const shortlistedUsernames = new Set(shortlist.map(item => item.username));
      setShortlistedUsers(shortlistedUsernames);
      console.log('Loaded shortlist:', shortlistedUsernames);
    } catch (err) {
      // Silently handle error - shortlist might not exist yet for new users
      console.debug('No shortlist found or error loading shortlist:', err);
      setShortlistedUsers(new Set());
    }
  };

  // eslint-disable-next-line no-unused-vars
  const loadUserExclusions = async () => {
    try {
      const username = localStorage.getItem('username');
      if (!username) {
        setExcludedUsers(new Set());
        return;
      }

      console.log(`Loading exclusions for user: ${username}`);
      const response = await api.get(`/exclusions/${username}`);
      const exclusions = response.data.exclusions || [];
      const excludedUsernames = new Set(exclusions);
      setExcludedUsers(excludedUsernames);
      console.log('Loaded exclusions:', excludedUsernames);
    } catch (err) {
      // Silently handle error - exclusions might not exist yet for new users
      console.debug('No exclusions found or error loading exclusions:', err);
      setExcludedUsers(new Set());
    }
  };

  const loadSavedSearches = async () => {
    try {
      const username = localStorage.getItem('username');
      if (username) {
        const response = await api.get(`/${username}/saved-searches`);
        setSavedSearches(response.data.savedSearches || []);
      }
    } catch (err) {
      if (err.response?.status === 404 || err.response?.data?.savedSearches?.length === 0) {
        console.info('No saved searches found for user (this is normal for new users)');
        setSavedSearches([]);
      } else {
        console.error('Error loading saved searches:', err);
        setSavedSearches([]);
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    console.log(`🔧 Input changed: ${name} = ${value}`);
    setSearchCriteria(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleClearFilters = () => {
    // Preserve gender (opposite sex) when clearing filters
    const preservedGender = searchCriteria.gender;
    
    setSearchCriteria({
      keyword: '',
      gender: preservedGender, // Keep opposite gender
      ageMin: '',
      ageMax: '',
      heightMin: '',
      heightMax: '',
      heightMinFeet: '',
      heightMinInches: '',
      heightMaxFeet: '',
      heightMaxInches: '',
      location: '',
      education: '',
      occupation: '',
      religion: '',
      caste: '',
      eatingPreference: '',
      drinking: '',
      smoking: '',
      relationshipStatus: '',
      bodyType: '',
      newlyAdded: false,
      sortBy: 'newest',
      sortOrder: 'desc'
    });
    setCurrentPage(1);
    setUsers([]);
    setTotalResults(0);
    setSaveSearchName('');
    setMinMatchScore(0); // Reset L3V3L compatibility score
    setSelectedSearch(null); // Clear selected search badge
  };

  // Check if any filters are active and count them
  const hasActiveFilters = () => {
    return countActiveFilters() > 0;
  };

  const countActiveFilters = () => {
    let count = 0;
    if (searchCriteria.keyword !== '') count++;
    // Gender is not counted as it's a default (opposite sex)
    if (searchCriteria.ageMin !== '') count++;
    if (searchCriteria.ageMax !== '') count++;
    if (searchCriteria.heightMinFeet !== '' || searchCriteria.heightMinInches !== '') count++;
    if (searchCriteria.heightMaxFeet !== '' || searchCriteria.heightMaxInches !== '') count++;
    if (searchCriteria.location !== '') count++;
    if (searchCriteria.education !== '') count++;
    if (searchCriteria.occupation !== '') count++;
    if (searchCriteria.religion !== '') count++;
    if (searchCriteria.caste !== '') count++;
    if (searchCriteria.eatingPreference !== '') count++;
    if (searchCriteria.drinking !== '') count++;
    if (searchCriteria.smoking !== '') count++;
    if (searchCriteria.relationshipStatus !== '') count++;
    if (searchCriteria.bodyType !== '') count++;
    if (searchCriteria.newlyAdded === true) count++;
    return count;
  };

  const handleSearch = async (page = 1, overrideMinMatchScore = null) => {
    const currentUser = localStorage.getItem('username');
    
    try {
      setLoading(true);
      setError('');

      // STEP 1: Apply traditional search filters
      const params = {
        ...searchCriteria,
        status: 'active',  // Only search for active users
        page: page,
        limit: 500  // Get more results from backend
      };
      
      // Convert feet/inches to total inches for height range
      // Only set heightMin if BOTH feet and inches are provided
      if (params.heightMinFeet && params.heightMinFeet !== '' && 
          params.heightMinInches && params.heightMinInches !== '') {
        const feet = parseInt(params.heightMinFeet);
        const inches = parseInt(params.heightMinInches);
        if (!isNaN(feet) && !isNaN(inches)) {
          params.heightMin = feet * 12 + inches;
        }
      }
      
      // Only set heightMax if BOTH feet and inches are provided
      if (params.heightMaxFeet && params.heightMaxFeet !== '' && 
          params.heightMaxInches && params.heightMaxInches !== '') {
        const feet = parseInt(params.heightMaxFeet);
        const inches = parseInt(params.heightMaxInches);
        if (!isNaN(feet) && !isNaN(inches)) {
          params.heightMax = feet * 12 + inches;
        }
      }
      
      // Remove feet/inches fields from params (not needed by API)
      delete params.heightMinFeet;
      delete params.heightMinInches;
      delete params.heightMaxFeet;
      delete params.heightMaxInches;

      // Clean up empty strings, false values, null, and undefined
      Object.keys(params).forEach(key => {
        const value = params[key];
        if (value === '' || value === false || value === null || value === undefined) {
          delete params[key];
        }
      });
      
      // Additional validation: ensure integer fields are valid numbers
      const integerFields = ['ageMin', 'ageMax', 'heightMin', 'heightMax', 'daysBack'];
      integerFields.forEach(field => {
        if (params[field] !== undefined) {
          const num = parseInt(params[field]);
          if (isNaN(num)) {
            delete params[field]; // Remove if not a valid number
          } else {
            params[field] = num; // Ensure it's a number, not a string
          }
        }
      });
      
      console.log('🔍 Search params after validation:', params);

      const response = await api.get('/search', { params });
      
      // Filter out own profile, admin, and moderators
      let filteredUsers = (response.data.users || []).filter(user => {
        if (user.username === currentUser) return false;
        const userRole = user.role?.toLowerCase();
        if (userRole === 'admin' || userRole === 'moderator') return false;
        return true;
      });

      // STEP 2: Apply L3V3L match score filtering (if enabled and score > 0)
      const canUseL3V3L = systemConfig.enable_l3v3l_for_all || isPremiumUser;
      const effectiveMinScore = overrideMinMatchScore !== null ? overrideMinMatchScore : minMatchScore;
      if (canUseL3V3L && effectiveMinScore > 0) {
        console.log(`🦋 L3V3L enabled: Applying L3V3L score filter (min: ${effectiveMinScore}%)`);
        
        // Get L3V3L scores for filtered users
        try {
          const l3v3lResponse = await api.get(`/l3v3l-matches/${currentUser}`, {
            params: {
              limit: 500,
              min_score: 0  // Get all scores, we'll filter client-side
            }
          });
          
          const matchesWithScores = l3v3lResponse.data.matches || [];
          const scoresMap = {};
          
          // Create a map of username -> match score
          matchesWithScores.forEach(match => {
            scoresMap[match.username] = match.matchScore;
          });
          
          console.log(`🦋 L3V3L API returned ${matchesWithScores.length} matches`);
          console.log(`🗺️ ScoresMap sample:`, Object.fromEntries(Object.entries(scoresMap).slice(0, 3)));
          console.log(`👥 FilteredUsers count before L3V3L: ${filteredUsers.length}`);
          
          // Filter users by min match score and attach scores
          filteredUsers = filteredUsers
            .map(user => {
              const score = scoresMap[user.username];
              if (score !== undefined) {
                console.log(`✅ Mapped ${user.username} → ${score}%`);
              } else {
                console.log(`❌ No score for ${user.username}`);
              }
              return {
                ...user,
                matchScore: score || 0,
                compatibilityLevel: matchesWithScores.find(m => m.username === user.username)?.compatibilityLevel
              };
            })
            .filter(user => user.matchScore >= effectiveMinScore)
            .sort((a, b) => b.matchScore - a.matchScore); // Sort by score desc
          
          console.log(`✅ Found ${filteredUsers.length} users matching criteria with L3V3L score ≥${effectiveMinScore}%`);
          console.log(`🎯 Sample user with score:`, filteredUsers[0]);
        } catch (err) {
          console.error('❌ Error fetching L3V3L scores:', err);
          // Continue without L3V3L filtering if API fails
        }
      }

      if (page === 1) {
        setUsers(filteredUsers);
        setCurrentPage(1);
      } else {
        setUsers(prev => [...prev, ...filteredUsers]);
      }

      setTotalResults(filteredUsers.length);
      setCurrentPage(page);

    } catch (err) {
      console.error('Error searching users:', err);
      const errorDetail = err.response?.data?.detail;
      let errorMsg = 'Failed to search users.';
      
      if (typeof errorDetail === 'string') {
        errorMsg += ' ' + errorDetail;
      } else if (Array.isArray(errorDetail)) {
        errorMsg += ' ' + errorDetail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ');
      } else if (errorDetail) {
        errorMsg += ' ' + JSON.stringify(errorDetail);
      } else {
        errorMsg += ' ' + err.message;
      }
      
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };


  const handlePageChange = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const renderPaginationButtons = () => {
    const buttons = [];
    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    
    if (endPage - startPage + 1 < maxButtons) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    // Previous button
    buttons.push(
      <button
        key="prev"
        className="btn btn-outline-primary"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        Previous
      </button>
    );

    // First page
    if (startPage > 1) {
      buttons.push(
        <button
          key={1}
          className="btn btn-outline-primary"
          onClick={() => handlePageChange(1)}
        >
          1
        </button>
      );
      if (startPage > 2) {
        buttons.push(<span key="dots1" className="pagination-dots">...</span>);
      }
    }

    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <button
          key={i}
          className={`btn ${i === currentPage ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => handlePageChange(i)}
        >
          {i}
        </button>
      );
    }

    // Last page
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        buttons.push(<span key="dots2" className="pagination-dots">...</span>);
      }
      buttons.push(
        <button
          key={totalPages}
          className="btn btn-outline-primary"
          onClick={() => handlePageChange(totalPages)}
        >
          {totalPages}
        </button>
      );
    }

    // Next button
    buttons.push(
      <button
        key="next"
        className="btn btn-outline-primary"
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Next
      </button>
    );

    return buttons;
  };

  // Generate human-readable description from search criteria
  const generateSearchDescription = (criteria, matchScore = null) => {
    const parts = [];
    
    // Start with "I'm looking for"
    let intro = "I'm looking for";
    
    // Gender
    if (criteria.gender) {
      const genderMap = {
        'male': 'a guy',
        'female': 'a girl',
        'other': 'someone'
      };
      intro += ` ${genderMap[criteria.gender.toLowerCase()] || 'someone'}`;
    } else {
      intro += ' someone';
    }
    
    parts.push(intro);
    
    // Age range
    if (criteria.ageMin || criteria.ageMax) {
      const ageMin = criteria.ageMin || '?';
      const ageMax = criteria.ageMax || '?';
      parts.push(`age ranges from ${ageMin} to ${ageMax} years old`);
    }
    
    // Height range
    if (criteria.heightMinFeet || criteria.heightMaxFeet) {
      const heightMin = criteria.heightMinFeet 
        ? `${criteria.heightMinFeet}ft${criteria.heightMinInches ? ' ' + criteria.heightMinInches + 'in' : ''}`
        : '?';
      const heightMax = criteria.heightMaxFeet 
        ? `${criteria.heightMaxFeet}ft${criteria.heightMaxInches ? ' ' + criteria.heightMaxInches + 'in' : ''}`
        : '?';
      parts.push(`height from ${heightMin} to ${heightMax}`);
    }
    
    // Location
    if (criteria.location) {
      parts.push(`living around ${criteria.location}`);
    }
    
    // Religion
    if (criteria.religion && criteria.religion !== '') {
      parts.push(`religion ${criteria.religion}`);
    }
    
    // Education
    if (criteria.education && criteria.education !== '') {
      parts.push(`education ${criteria.education}`);
    }
    
    // Occupation
    if (criteria.occupation && criteria.occupation !== '') {
      parts.push(`working as ${criteria.occupation}`);
    }
    
    // Body Type
    if (criteria.bodyType && criteria.bodyType !== '') {
      parts.push(`body type ${criteria.bodyType.toLowerCase()}`);
    }
    
    // Eating Preference
    if (criteria.eatingPreference && criteria.eatingPreference !== '') {
      parts.push(`eating preference ${criteria.eatingPreference.toLowerCase()}`);
    }
    
    // L3V3L Match Score
    const effectiveScore = matchScore !== null ? matchScore : minMatchScore;
    console.log('🦋 L3V3L Score check - matchScore:', matchScore, 'minMatchScore:', minMatchScore, 'effectiveScore:', effectiveScore);
    if (effectiveScore > 0) {
      parts.push(`L3V3L match score ≥${effectiveScore}%`);
      console.log('✅ Added L3V3L to description');
    } else {
      console.log('❌ L3V3L score is 0, skipping');
    }
    
    // Keyword
    if (criteria.keyword) {
      parts.push(`with keywords "${criteria.keyword}"`);
    }
    
    // Join all parts with commas and "and" before the last item
    if (parts.length === 0) {
      return "Search with no specific criteria";
    }
    
    if (parts.length === 1) {
      return parts[0];
    }
    
    // Join with commas and add "and" before last item
    const lastPart = parts.pop();
    return parts.join(', ') + ' and ' + lastPart;
  };

  const handleSaveSearch = async (searchName) => {
    try {
      const username = localStorage.getItem('username');
      if (!username) {
        setError('Please login to save searches');
        return;
      }

      // Generate human-readable description (pass minMatchScore)
      console.log('🔍 Saving search with minMatchScore:', minMatchScore);
      const description = generateSearchDescription(searchCriteria, minMatchScore);
      console.log('📝 Generated description:', description);

      const searchData = {
        name: searchName.trim(),
        description: description,
        criteria: searchCriteria,
        minMatchScore: minMatchScore, // Save L3V3L match score
        created_at: new Date().toISOString()
      };
      
      console.log('💾 Search data to save:', searchData);

      await api.post(`/${username}/saved-searches`, searchData);

      setStatusMessage(`✅ Search saved: "${searchName}"`);
      setTimeout(() => setStatusMessage(''), 3000);
      loadSavedSearches();
    } catch (err) {
      console.error('Error saving search:', err);
      setError('Failed to save search. ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleUpdateSavedSearch = async (searchId, newName) => {
    try {
      const username = localStorage.getItem('username');
      await api.put(`/${username}/saved-searches/${searchId}`, { name: newName });
      setStatusMessage(`✅ Search renamed to: "${newName}"`);
      setTimeout(() => setStatusMessage(''), 3000);
      loadSavedSearches();
    } catch (err) {
      console.error('Error updating saved search:', err);
      setError('Failed to update saved search');
    }
  };

  const handleLoadSavedSearch = (savedSearch) => {
    setSearchCriteria(savedSearch.criteria);
    // Restore L3V3L match score if saved
    const loadedMinScore = savedSearch.minMatchScore !== undefined ? savedSearch.minMatchScore : 0;
    setMinMatchScore(loadedMinScore);
    setSelectedSearch(savedSearch);
    setShowSavedSearches(false);
    setStatusMessage(`✅ Loaded saved search: "${savedSearch.name}"`);
    // Automatically perform search with loaded criteria
    // Pass the minMatchScore directly to avoid React state timing issues
    setTimeout(() => {
      handleSearch(1, loadedMinScore);
    }, 100);
    setTimeout(() => setStatusMessage(''), 3000);
  };

  const handleDeleteSavedSearch = async (searchId) => {
    console.log('🗑️ Deleting search with ID:', searchId);
    
    if (!searchId) {
      console.error('❌ No search ID provided');
      setError('Cannot delete: Invalid search ID');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    try {
      const username = localStorage.getItem('username');
      await api.delete(`/${username}/saved-searches/${searchId}`);
      setStatusMessage('✅ Search deleted successfully');
      setTimeout(() => setStatusMessage(''), 3000);
      loadSavedSearches();
      // Clear selected search if it was deleted
      if (selectedSearch && selectedSearch.id === searchId) {
        setSelectedSearch(null);
      }
    } catch (err) {
      console.error('❌ Error deleting saved search:', err);
      setError('Failed to delete saved search. Please try again.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleClearSelectedSearch = async () => {
    setSelectedSearch(null);
    const clearedCriteria = {
      keyword: '',
      gender: '',
      ageMin: '',
      ageMax: '',
      heightMin: '',
      heightMax: '',
      location: '',
      education: '',
      occupation: '',
      religion: '',
      caste: '',
      drinking: '',
      smoking: '',
      relationshipStatus: '',
      newlyAdded: false,
    };
    
    // Update criteria and clear results
    setSearchCriteria(clearedCriteria);
    setMinMatchScore(0); // Reset L3V3L compatibility score
    setUsers([]);
    setTotalResults(0);
    setCurrentPage(1);
    setStatusMessage('✅ Search cleared - showing all active users');
    setTimeout(() => setStatusMessage(''), 3000);
    
    // Perform search directly with cleared criteria instead of relying on state update
    try {
      setLoading(true);
      setError('');

      const params = {
        status: 'active',  // Only search for active users
        page: 1,
        limit: 500
      };

      const response = await api.get('/search', { params });
      setUsers(response.data.users || []);
      setTotalResults(response.data.total || 0);
      setCurrentPage(1);
    } catch (err) {
      console.error('Error searching users:', err);
      const errorDetail = err.response?.data?.detail;
      let errorMsg = 'Failed to search users.';
      
      if (typeof errorDetail === 'string') {
        errorMsg += ' ' + errorDetail;
      } else if (Array.isArray(errorDetail)) {
        errorMsg += ' ' + errorDetail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ');
      } else if (errorDetail) {
        errorMsg += ' ' + JSON.stringify(errorDetail);
      } else {
        errorMsg += ' ' + err.message;
      }
      
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const parseHeight = (height) => {
    if (!height) return null;
    const match = height.match(/(\d+)'(\d+)"/);
    if (match) {
      return parseInt(match[1]) * 12 + parseInt(match[2]);
    }
    return null;
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

  const openPIIRequestModal = (targetUsername) => {
    const user = users.find(u => u.username === targetUsername);
    if (!user) return;

    // Set current PII access status - pass actual status values
    setCurrentPIIAccess({
      images: piiRequests[`${targetUsername}_images`] === 'approved',
      contact_info: piiRequests[`${targetUsername}_contact_info`] === 'approved',
      date_of_birth: piiRequests[`${targetUsername}_date_of_birth`] === 'approved',
      linkedin_url: piiRequests[`${targetUsername}_linkedin_url`] === 'approved'
    });

    setSelectedUserForPII(user);
    setShowPIIRequestModal(true);
  };

  const handlePIIRequestSuccess = async () => {
    // Reload PII requests to get updated status
    await loadPiiRequests();
  };

  const hasPiiAccess = (targetUsername, requestType) => {
    return piiRequests[`${targetUsername}_${requestType}`] === 'approved';
  };

  const isPiiRequestPending = (targetUsername, requestType) => {
    return piiRequests[`${targetUsername}_${requestType}`] === 'pending';
  };

  // Get PII request status for all types
  const getPIIRequestStatus = (targetUsername) => {
    return {
      images: piiRequests[`${targetUsername}_images`],
      contact_info: piiRequests[`${targetUsername}_contact_info`],
      date_of_birth: piiRequests[`${targetUsername}_date_of_birth`],
      linkedin_url: piiRequests[`${targetUsername}_linkedin_url`]
    };
  };

  const handleProfileAction = async (e, targetUsername, action) => {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }

    const currentUser = localStorage.getItem('username');
    if (!currentUser) {
      setError('Please login to perform this action');
      return;
    }

    try {
      switch (action) {
        case 'favorite':
          const isCurrentlyFavorited = favoritedUsers.has(targetUsername);

          try {
            if (isCurrentlyFavorited) {
              // Remove from favorites
              await api.delete(`/favorites/${targetUsername}?username=${encodeURIComponent(currentUser)}`);
              setFavoritedUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(targetUsername);
                return newSet;
              });
              setStatusMessage('✅ Removed from favorites');
              setTimeout(() => setStatusMessage(''), 3000);
            } else {
              // Add to favorites
              await api.post(`/favorites/${targetUsername}?username=${encodeURIComponent(currentUser)}`);
              setFavoritedUsers(prev => new Set([...prev, targetUsername]));
              setStatusMessage('✅ Added to favorites');
              setTimeout(() => setStatusMessage(''), 3000);
            }
            setError(''); // Clear any previous errors
          } catch (err) {
            console.error(`Error ${isCurrentlyFavorited ? 'removing from' : 'adding to'} favorites:`, err);
            
            // Handle 409 Conflict (already exists)
            if (err.response?.status === 409) {
              setFavoritedUsers(prev => new Set([...prev, targetUsername]));
              setStatusMessage('ℹ️ Already in favorites');
              setTimeout(() => setStatusMessage(''), 3000);
            } else {
              const errorMsg = `Failed to ${isCurrentlyFavorited ? 'remove from' : 'add to'} favorites. ` + (err.response?.data?.detail || err.message);
              setError(errorMsg);
              setStatusMessage(`❌ ${errorMsg}`);
              setTimeout(() => setStatusMessage(''), 3000);
            }
          }
          break;

        case 'shortlist':
          const isCurrentlyShortlisted = shortlistedUsers.has(targetUsername);

          try {
            if (isCurrentlyShortlisted) {
              // Remove from shortlist
              await api.delete(`/shortlist/${targetUsername}?username=${encodeURIComponent(currentUser)}`);
              setShortlistedUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(targetUsername);
                return newSet;
              });
              setStatusMessage('✅ Removed from shortlist');
              setTimeout(() => setStatusMessage(''), 3000);
            } else {
              // Add to shortlist
              await api.post(`/shortlist/${targetUsername}?username=${encodeURIComponent(currentUser)}`);
              setShortlistedUsers(prev => new Set([...prev, targetUsername]));
              setStatusMessage('✅ Added to shortlist');
              setTimeout(() => setStatusMessage(''), 3000);
            }
            setError(''); // Clear any previous errors
          } catch (err) {
            console.error(`Error ${isCurrentlyShortlisted ? 'removing from' : 'adding to'} shortlist:`, err);
            
            // Handle 409 Conflict (already exists)
            if (err.response?.status === 409) {
              setShortlistedUsers(prev => new Set([...prev, targetUsername]));
              setStatusMessage('ℹ️ Already in shortlist');
              setTimeout(() => setStatusMessage(''), 3000);
            } else {
              const errorMsg = `Failed to ${isCurrentlyShortlisted ? 'remove from' : 'add to'} shortlist. ` + (err.response?.data?.detail || err.message);
              setError(errorMsg);
              setStatusMessage(`❌ ${errorMsg}`);
              setTimeout(() => setStatusMessage(''), 3000);
            }
          }
          break;

        case 'exclude':
          const isCurrentlyExcluded = excludedUsers.has(targetUsername);

          try {
            const currentUser = localStorage.getItem('username');
            if (!currentUser) {
              setError('Please login to perform this action');
              return;
            }

            console.log(`Attempting to ${isCurrentlyExcluded ? 'remove from' : 'add to'} exclusions for user: ${targetUsername} by: ${currentUser}`);

            if (isCurrentlyExcluded) {
              // Remove from exclusions
              console.log(`DELETE /exclusions/${targetUsername}?username=${encodeURIComponent(currentUser)}`);
              await api.delete(`/exclusions/${targetUsername}?username=${encodeURIComponent(currentUser)}`);
              setExcludedUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(targetUsername);
                return newSet;
              });
              setStatusMessage('✅ Removed from exclusions');
              setTimeout(() => setStatusMessage(''), 3000);
            } else {
              // Add to exclusions
              console.log(`POST /exclusions/${targetUsername}?username=${encodeURIComponent(currentUser)}`);
              await api.post(`/exclusions/${targetUsername}?username=${encodeURIComponent(currentUser)}`);
              setExcludedUsers(prev => new Set([...prev, targetUsername]));
              
              // Auto-remove from favorites and shortlist when excluding
              const wasInFavorites = favoritedUsers.has(targetUsername);
              const wasInShortlist = shortlistedUsers.has(targetUsername);
              
              if (wasInFavorites) {
                try {
                  await api.delete(`/favorites/${targetUsername}?username=${encodeURIComponent(currentUser)}`);
                  setFavoritedUsers(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(targetUsername);
                    return newSet;
                  });
                  console.log(`Auto-removed ${targetUsername} from favorites when excluding`);
                } catch (err) {
                  console.error('Error removing from favorites during exclude:', err);
                }
              }
              
              if (wasInShortlist) {
                try {
                  await api.delete(`/shortlist/${targetUsername}?username=${encodeURIComponent(currentUser)}`);
                  setShortlistedUsers(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(targetUsername);
                    return newSet;
                  });
                  console.log(`Auto-removed ${targetUsername} from shortlist when excluding`);
                } catch (err) {
                  console.error('Error removing from shortlist during exclude:', err);
                }
              }
              
              setStatusMessage('✅ Added to exclusions');
              setTimeout(() => setStatusMessage(''), 3000);
            }
            setError(''); // Clear any previous errors
          } catch (err) {
            console.error(`Error ${isCurrentlyExcluded ? 'removing from' : 'adding to'} exclusions:`, err);
            const errorMsg = `Failed to ${isCurrentlyExcluded ? 'remove from' : 'add to'} exclusions. ` + (err.response?.data?.detail || err.message);
            setError(errorMsg);
            setStatusMessage(`❌ ${errorMsg}`);
            setTimeout(() => setStatusMessage(''), 3000);
          }
          break;

        case 'message':
          // Open message modal instead of navigating
          const userToMessage = users.find(u => u.username === targetUsername);
          setSelectedUserForMessage(userToMessage);
          setShowMessageModal(true);
          break;

        default:
          console.warn('Unknown action:', action);
      }
    } catch (err) {
      console.error(`Error performing ${action}:`, err);
      const errorMsg = `Failed to ${action}. ` + (err.response?.data?.detail || err.message);
      setError(errorMsg);
      setStatusMessage(`❌ ${errorMsg}`);
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  // Handle message button click
  const handleMessage = async (user) => {
    const currentUser = localStorage.getItem('username');
    // If user object doesn't have full profile data, fetch it
    if (!user.firstName && !user.location && user.username) {
      try {
        const response = await api.get(`/profile/${user.username}?requester=${currentUser}`);
        setSelectedUserForMessage(response.data);
      } catch (err) {
        console.error('Error loading user profile:', err);
        // Fallback to existing user object
        setSelectedUserForMessage(user);
      }
    } else {
      setSelectedUserForMessage(user);
    }
    setShowMessageModal(true);
  };

  const filteredUsers = users.filter(user => {
    // Exclude users who have been excluded by current user
    if (excludedUsers.has(user.username)) {
      return false;
    }

    if (searchCriteria.ageMin || searchCriteria.ageMax) {
      const age = calculateAge(user.dateOfBirth);
      if (age === null) return false;

      if (searchCriteria.ageMin && age < parseInt(searchCriteria.ageMin)) return false;
      if (searchCriteria.ageMax && age > parseInt(searchCriteria.ageMax)) return false;
    }

    if (searchCriteria.heightMin || searchCriteria.heightMax) {
      const heightInches = parseHeight(user.height);
      if (heightInches === null) return false;

      if (searchCriteria.heightMin && heightInches < parseInt(searchCriteria.heightMin)) return false;
      if (searchCriteria.heightMax && heightInches > parseInt(searchCriteria.heightMax)) return false;
    }

    if (searchCriteria.keyword) {
      const keyword = searchCriteria.keyword.toLowerCase();
      const searchableText = [
        user.firstName, user.lastName, user.username,
        user.location, user.education, user.occupation,
        user.aboutYou, user.bio, user.interests
      ].join(' ').toLowerCase();

      if (!searchableText.includes(keyword)) return false;
    }

    return true;
  });

  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredUsers.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(filteredUsers.length / recordsPerPage);

  return (
    <div className="search-page">
      <PageHeader
        icon="🔍"
        title="Advanced Search"
        subtitle="Find your perfect match with detailed filters + optional L3V3L compatibility scoring"
        variant="gradient"
      />

      {error && (
        <div style={{ maxWidth: '600px', margin: '10px auto' }}>
          <div className="alert alert-danger">{error}</div>
        </div>
      )}

      {statusMessage && (
        <div style={{ maxWidth: '600px', margin: '10px auto' }}>
          <div className={`alert ${statusMessage.includes('❌') ? 'alert-danger' : 'alert-success'} alert-dismissible fade show`} role="alert">
            {statusMessage}
            <button type="button" className="btn-close" onClick={() => setStatusMessage('')}></button>
          </div>
        </div>
      )}

      <div className="search-container">
        {/* Search Filters - Always visible */}
        <div className="search-filters">
          {showSavedSearches && (
            <div className="saved-searches mb-3">
              <h6>Saved Searches</h6>
              {savedSearches.length === 0 ? (
                <p className="text-muted">No saved searches yet</p>
              ) : (
                <div className="saved-searches-list">
                  {savedSearches.map(search => (
                    <div key={search.id} className="saved-search-item">
                      <span onClick={() => handleLoadSavedSearch(search)}>
                        {search.name}
                      </span>
                      <button
                        className="btn btn-sm btn-outline-danger ms-2"
                        onClick={() => handleDeleteSavedSearch(search.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Selected Search Display */}
          {selectedSearch && (
            <div className="selected-search-banner">
              <div className="selected-search-info">
                <span className="selected-label">📌 Selected Search:</span>
                <span className="selected-name">{selectedSearch.name}</span>
              </div>
              <button 
                className="btn btn-sm btn-outline-danger"
                onClick={handleClearSelectedSearch}
                title="Clear selected search"
              >
                ✕ Clear
              </button>
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleSearch(1); }}>
            {/* Action Buttons - Above Tabs */}
            <div className="search-action-buttons">
              <button
                type="button"
                className="header-icon-btn primary"
                onClick={(e) => { e.stopPropagation(); handleSearch(1); }}
                disabled={loading}
                title="Search"
              >
                {loading ? '⟳' : '🔍'}
              </button>
              <button
                type="button"
                className={`header-icon-btn ${hasActiveFilters() ? 'has-filters' : ''}`}
                onClick={(e) => { e.stopPropagation(); handleClearFilters(); }}
                disabled={loading || !hasActiveFilters()}
                title={`Clear Filters${hasActiveFilters() ? ` (${countActiveFilters()})` : ''}`}
              >
                ✕
                {hasActiveFilters() && (
                  <span className="filter-count-badge">{countActiveFilters()}</span>
                )}
              </button>
              <button
                type="button"
                className="header-icon-btn"
                onClick={(e) => { e.stopPropagation(); setShowSaveModal(true); }}
                title="Save Current Search"
              >
                💾
              </button>
              <button
                type="button"
                className="header-icon-btn"
                onClick={(e) => { e.stopPropagation(); setShowSavedSearches(!showSavedSearches); }}
                title={`Saved Searches${savedSearches.length > 0 ? ` (${savedSearches.length})` : ''}`}
              >
                📋
                {savedSearches.length > 0 && (
                  <span className="filter-count-badge">{savedSearches.length}</span>
                )}
              </button>
            </div>

            {/* Search Tabs */}
            <UniversalTabContainer
              variant="underlined"
              defaultTab="basic"
              tabs={[
                {
                  id: 'saved',
                  label: 'Saved Searches',
                  badge: savedSearches.length > 0 ? savedSearches.length : null,
                  content: (
                    <div className="saved-searches-tab">
                      {savedSearches.length === 0 ? (
                        <div className="empty-saved-searches">
                          <div className="empty-icon">📋</div>
                          <h4>No Saved Searches Yet</h4>
                          <p>Save your search criteria to quickly access them later.</p>
                          <p className="text-muted">
                            Use the "💾 Save" button above to save your current search filters.
                          </p>
                        </div>
                      ) : (
                        <div className="saved-searches-grid">
                          {savedSearches.map(search => (
                            <div key={search.id} className="saved-search-card">
                              <div className="saved-search-header">
                                <h5 className="saved-search-name">{search.name}</h5>
                                <button
                                  className="btn-delete-saved"
                                  onClick={() => handleDeleteSavedSearch(search.id)}
                                  title="Delete this saved search"
                                >
                                  🗑️
                                </button>
                              </div>
                              
                              <div className="saved-search-description">
                                <p>{search.description || generateSearchDescription(search.criteria, search.minMatchScore)}</p>
                              </div>

                              <div className="saved-search-footer">
                                <button
                                  className="btn-load-saved"
                                  onClick={() => handleLoadSavedSearch(search)}
                                >
                                  📂 Load Search
                                </button>
                                <span className="saved-date">
                                  {search.createdAt ? new Date(search.createdAt).toLocaleDateString() : ''}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                },
                {
                  id: 'basic',
                  label: 'Basic Search',
                  content: (
              <div className="filter-section">
                <div className="row filter-row-1">
                  <div className="col-keyword">
                    <div className="form-group">
                      <label>Keyword Search</label>
                      <input
                        type="text"
                        className="form-control"
                        name="keyword"
                        value={searchCriteria.keyword}
                        onChange={handleInputChange}
                        placeholder="Search any field..."
                      />
                    </div>
                  </div>
                  <div className="col-location">
                    <div className="form-group">
                      <label>Location</label>
                      <input
                        type="text"
                        className="form-control"
                        name="location"
                        value={searchCriteria.location}
                        onChange={handleInputChange}
                        placeholder="City, State..."
                      />
                    </div>
                  </div>
                  <div className="col-age-range">
                    <div className="form-group">
                      <label>Age Range</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="number"
                          className="form-control"
                          name="ageMin"
                          value={searchCriteria.ageMin}
                          onChange={handleInputChange}
                          min="18"
                          max="80"
                          placeholder="Min"
                          style={{ flex: 1 }}
                        />
                        <input
                          type="number"
                          className="form-control"
                          name="ageMax"
                          value={searchCriteria.ageMax}
                          onChange={handleInputChange}
                          min="18"
                          max="80"
                          placeholder="Max"
                          style={{ flex: 1 }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="col-height-min">
                    <div className="form-group">
                      <label>Height (Min)</label>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <select
                          className="form-control"
                          name="heightMinFeet"
                          value={searchCriteria.heightMinFeet}
                          onChange={handleInputChange}
                          style={{ fontSize: '13px', padding: '6px 8px', flex: 1 }}
                        >
                          <option value="">Feet</option>
                          <option value="4">4 ft</option>
                          <option value="5">5 ft</option>
                          <option value="6">6 ft</option>
                          <option value="7">7 ft</option>
                        </select>
                        <select
                          className="form-control"
                          name="heightMinInches"
                          value={searchCriteria.heightMinInches}
                          onChange={handleInputChange}
                          style={{ fontSize: '13px', padding: '6px 8px', flex: 1 }}
                        >
                          <option value="">Inch</option>
                          <option value="0">0 in</option>
                          <option value="1">1 in</option>
                          <option value="2">2 in</option>
                          <option value="3">3 in</option>
                          <option value="4">4 in</option>
                          <option value="5">5 in</option>
                          <option value="6">6 in</option>
                          <option value="7">7 in</option>
                          <option value="8">8 in</option>
                          <option value="9">9 in</option>
                          <option value="10">10 in</option>
                          <option value="11">11 in</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="col-height-max">
                    <div className="form-group">
                      <label>Height (Max)</label>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <select
                          className="form-control"
                          name="heightMaxFeet"
                          value={searchCriteria.heightMaxFeet}
                          onChange={handleInputChange}
                          style={{ fontSize: '13px', padding: '6px 8px', flex: 1 }}
                        >
                          <option value="">Feet</option>
                          <option value="4">4 ft</option>
                          <option value="5">5 ft</option>
                          <option value="6">6 ft</option>
                          <option value="7">7 ft</option>
                        </select>
                        <select
                          className="form-control"
                          name="heightMaxInches"
                          value={searchCriteria.heightMaxInches}
                          onChange={handleInputChange}
                          style={{ fontSize: '13px', padding: '6px 8px', flex: 1 }}
                        >
                          <option value="">Inch</option>
                          <option value="0">0 in</option>
                          <option value="1">1 in</option>
                          <option value="2">2 in</option>
                          <option value="3">3 in</option>
                          <option value="4">4 in</option>
                          <option value="5">5 in</option>
                          <option value="6">6 in</option>
                          <option value="7">7 in</option>
                          <option value="8">8 in</option>
                          <option value="9">9 in</option>
                          <option value="10">10 in</option>
                          <option value="11">11 in</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
                  )
                },
                {
                  id: 'advanced',
                  label: 'Advanced Search',
                  content: (
              <div className="filter-section">
                <div className="row filter-row-1">
                  <div className="col-gender">
                    <div className="form-group">
                      <label>Gender</label>
                      <select
                        className="form-control"
                        name="gender"
                        value={searchCriteria.gender}
                        onChange={handleInputChange}
                        readOnly={currentUserProfile?.role?.toLowerCase() !== 'admin' && currentUserProfile?.role?.toLowerCase() !== 'moderator'}
                        disabled={currentUserProfile?.role?.toLowerCase() !== 'admin' && currentUserProfile?.role?.toLowerCase() !== 'moderator'}
                        style={{
                          cursor: (currentUserProfile?.role?.toLowerCase() !== 'admin' && currentUserProfile?.role?.toLowerCase() !== 'moderator') ? 'not-allowed' : 'pointer',
                          backgroundColor: (currentUserProfile?.role?.toLowerCase() !== 'admin' && currentUserProfile?.role?.toLowerCase() !== 'moderator') ? '#f0f0f0' : 'rgba(255, 255, 255, 0.9)'
                        }}
                        title={(currentUserProfile?.role?.toLowerCase() !== 'admin' && currentUserProfile?.role?.toLowerCase() !== 'moderator') ? 'Gender filter is locked to opposite gender' : ''}
                      >
                        <option value="">All</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="col-body-type">
                    <div className="form-group">
                      <label>Body Type</label>
                      <select
                        className="form-control"
                        name="bodyType"
                        value={searchCriteria.bodyType}
                        onChange={handleInputChange}
                      >
                        {bodyTypeOptions.map(option => (
                          <option key={option} value={option}>{option || 'Any'}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="col-occupation">
                    <div className="form-group">
                      <label>Occupation</label>
                      <select
                        className="form-control"
                        name="occupation"
                        value={searchCriteria.occupation}
                        onChange={handleInputChange}
                      >
                        {occupationOptions.map(option => (
                          <option key={option} value={option}>{option || 'Any'}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="col-eating">
                    <div className="form-group">
                      <label>Eating</label>
                      <select
                        className="form-control"
                        name="eatingPreference"
                        value={searchCriteria.eatingPreference}
                        onChange={handleInputChange}
                      >
                        {eatingOptions.map(option => (
                          <option key={option} value={option}>{option || 'Any'}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="col-drinking">
                    <div className="form-group">
                      <label>Drinking</label>
                      <select
                        className="form-control"
                        name="drinking"
                        value={searchCriteria.drinking}
                        onChange={handleInputChange}
                      >
                        {lifestyleOptions.map(option => (
                          <option key={option} value={option}>{option || 'Any'}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="col-smoking">
                    <div className="form-group">
                      <label>Smoking</label>
                      <select
                        className="form-control"
                        name="smoking"
                        value={searchCriteria.smoking}
                        onChange={handleInputChange}
                      >
                        {lifestyleOptions.map(option => (
                          <option key={option} value={option}>{option || 'Any'}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="col-days-back">
                    <div className="form-group">
                      <label>Days Back</label>
                      <input
                        type="number"
                        className="form-control"
                        name="daysBack"
                        value={searchCriteria.daysBack}
                        onChange={handleInputChange}
                        min="1"
                        max="365"
                        placeholder="e.g., 7, 30"
                      />
                    </div>
                  </div>
                </div>
              </div>
                  )
                },
                {
                  id: 'l3v3l',
                  icon: '🦋',
                  label: 'L3V3L Filter',
                  badge: minMatchScore > 0 ? `${minMatchScore}%` : (systemConfig.enable_l3v3l_for_all && !isPremiumUser ? 'BETA' : null),
                  content: (
              <div className="l3v3l-filter-tab" style={{ padding: '30px', maxWidth: '800px', margin: '0 auto' }}>
                {(systemConfig.enable_l3v3l_for_all || isPremiumUser) ? (
                  <div className="l3v3l-content">
                    <div className="score-selector" style={{ 
                      background: 'var(--surface-color)', 
                      padding: '30px', 
                      borderRadius: '12px', 
                      border: '2px solid var(--border-color)',
                      marginBottom: '20px'
                    }}>
                      <label htmlFor="matchScoreSlider" style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '15px', 
                        marginBottom: '20px',
                        fontSize: '18px',
                        fontWeight: '600'
                      }}>
                        <span style={{ fontSize: '32px' }}>🎯</span>
                        <span style={{ flex: 1 }}>Minimum Compatibility Score</span>
                        <span style={{ 
                          fontWeight: '700', 
                          color: 'var(--primary-color)', 
                          fontSize: '24px',
                          minWidth: '60px',
                          textAlign: 'right'
                        }}>
                          {minMatchScore}%
                        </span>
                      </label>
                      
                      <input
                        id="matchScoreSlider"
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={minMatchScore}
                        onChange={(e) => {
                          const newScore = Number(e.target.value);
                          console.log('🎚️ L3V3L Slider changed:', minMatchScore, '→', newScore);
                          setMinMatchScore(newScore);
                          // Auto-refresh results when slider changes
                          setTimeout(() => handleSearch(1), 300);
                        }}
                        className="match-score-slider"
                        style={{ width: '100%', height: '8px', cursor: 'pointer' }}
                      />
                      
                      <div className="slider-labels" style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        fontSize: '14px', 
                        color: 'var(--text-secondary)', 
                        marginTop: '10px',
                        fontWeight: '500'
                      }}>
                        <span>0%</span>
                        <span>25%</span>
                        <span>50%</span>
                        <span>75%</span>
                        <span>100%</span>
                      </div>
                      
                      <div className="filter-info" style={{ 
                        marginTop: '20px', 
                        padding: '15px', 
                        background: minMatchScore > 0 ? 'rgba(102, 126, 234, 0.1)' : 'var(--card-background)',
                        borderRadius: '8px',
                        textAlign: 'center',
                        fontSize: '15px',
                        color: 'var(--text-color)'
                      }}>
                        {minMatchScore > 0 
                          ? `✅ Showing profiles with compatibility ≥ ${minMatchScore}%` 
                          : 'ℹ️ Set to 0% to disable L3V3L filtering (show all matches)'}
                      </div>
                    </div>


                  </div>
                ) : (
                  <div className="premium-gate" style={{ 
                    textAlign: 'center', 
                    padding: '60px 30px',
                    background: 'var(--surface-color)',
                    borderRadius: '12px',
                    border: '2px solid var(--border-color)'
                  }}>
                    <div style={{ fontSize: '64px', marginBottom: '20px' }}>🔒</div>
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '24px' }}>Premium Feature</h3>
                    <p style={{ 
                      margin: '0 0 30px 0', 
                      fontSize: '16px', 
                      color: 'var(--text-secondary)',
                      maxWidth: '500px',
                      marginLeft: 'auto',
                      marginRight: 'auto'
                    }}>
                      Filter by L3V3L Compatibility Score to find matches based on deep personality and lifestyle compatibility
                    </p>
                    <button 
                      className="btn btn-premium"
                      disabled
                      title="Premium feature coming soon"
                      style={{ 
                        padding: '12px 30px',
                        fontSize: '16px',
                        background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'not-allowed',
                        opacity: '0.6'
                      }}
                    >
                      ⭐ Upgrade to Premium
                    </button>
                  </div>
                )}
              </div>
                  )
                }
              ]}
            />

            {/* Additional filters (hidden) */}
            <div className="filter-section" style={{display: 'none'}}>
              <div className="row">
                <div className="col-md-6">
                  <div className="form-group">
                    <label>Gender</label>
                    <select
                      className="form-control"
                      name="gender"
                      value={searchCriteria.gender}
                      onChange={handleInputChange}
                    >
                      {genderOptions.map(option => (
                        <option key={option} value={option}>{option || 'Any'}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="form-group">
                    <label>Religion</label>
                    <select
                      className="form-control"
                      name="religion"
                      value={searchCriteria.religion}
                      onChange={handleInputChange}
                    >
                      {religionOptions.map(option => (
                        <option key={option} value={option}>{option || 'Any'}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="form-group">
                    <label>Relationship Status</label>
                    <select
                      className="form-control"
                      name="relationshipStatus"
                      value={searchCriteria.relationshipStatus}
                      onChange={handleInputChange}
                    >
                      {relationshipOptions.map(option => (
                        <option key={option} value={option}>{option || 'Any'}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

          </form>
        </div>

        <div className="search-results">
          <div className="results-header">
            <div className="results-title-section">
              <h4>Results:</h4>
              <div className="results-info">
                {users.length > 0 ? (
                  <>
                    <span className="badge bg-primary">Profiles: {totalResults} | Showing: {filteredUsers.length}</span>
                    {users.length !== filteredUsers.length && (
                      <span className="badge bg-warning ms-2">
                        {users.length - filteredUsers.length} hidden
                      </span>
                    )}
                  </>
                ) : (
                  <span className="badge bg-secondary">No search performed yet</span>
                )}
              </div>
            </div>
            <div className="results-controls">
              {/* View Toggle + Refresh */}
              <div className="view-toggle-group">
                <button
                  className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setViewMode('cards')}
                  title="Card view"
                >
                  ▦
                </button>
                <button
                  className={`btn btn-sm ${viewMode === 'rows' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setViewMode('rows')}
                  title="Row view"
                >
                  ☰
                </button>
                <button 
                  className="btn btn-sm btn-warning"
                  onClick={() => handleSearch(1)}
                  disabled={loading}
                  title="Refresh results"
                >
                  🔄
                </button>
              </div>

              {/* Cards Per Row (only show in card view) */}
              {viewMode === 'cards' && (
                <div className="cards-per-row-selector">
                  <span className="selector-label">Row Cards:</span>
                  {[2, 3, 4, 5].map(num => (
                    <button
                      key={num}
                      className={`btn btn-sm ${cardsPerRow === num ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => {
                        setCardsPerRow(num);
                        localStorage.setItem('searchCardsPerRow', num.toString());
                      }}
                      title={`${num} ROW CARDS`}  
                    >
                      {num}
                    </button>
                  ))}
                </div>
              )}
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>Show:</span>
                <select 
                  id="perPage"
                  className="form-select form-select-sm per-page-select"
                  value={recordsPerPage}
                  onChange={(e) => {
                    setRecordsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  style={{ width: 'auto', minWidth: '130px' }}
                >
                  <option value="10">10 per page</option>
                  <option value="20">20 per page</option>
                  <option value="50">50 per page</option>
                  <option value="100">100 per page</option>
                </select>
              </div>
            </div>
          </div>

          {loading && (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          )}

          {!loading && filteredUsers.length === 0 && (
            <div className="no-results">
              <h5>No profiles found</h5>
              <p>Try adjusting your search criteria or use broader filters.</p>
            </div>
          )}

          <div 
            className={`${viewMode === 'cards' ? 'results-grid results-cards' : viewMode === 'compact' ? 'results-rows results-compact' : 'results-rows'}`}
            style={viewMode === 'cards' ? { gridTemplateColumns: `repeat(${cardsPerRow}, 1fr)` } : {}}
          >
            {currentRecords.map((user) => {
              return (
                <SearchResultCard
                  key={user.username}
                  user={user}
                  currentUsername={localStorage.getItem('username')}
                  onFavorite={(u) => handleProfileAction(null, u.username, 'favorite')}
                  onShortlist={(u) => handleProfileAction(null, u.username, 'shortlist')}
                  onExclude={(u) => handleProfileAction(null, u.username, 'exclude')}
                  onMessage={handleMessage}
                  onPIIRequest={(u) => openPIIRequestModal(u.username)}
                  isFavorited={favoritedUsers.has(user.username)}
                  isShortlisted={shortlistedUsers.has(user.username)}
                  isExcluded={excludedUsers.has(user.username)}
                  hasPiiAccess={hasPiiAccess(user.username, 'contact_info')}
                  hasImageAccess={hasPiiAccess(user.username, 'images')}
                  isPiiRequestPending={isPiiRequestPending(user.username, 'contact_info')}
                  isImageRequestPending={isPiiRequestPending(user.username, 'images')}
                  piiRequestStatus={getPIIRequestStatus(user.username)}
                  viewMode={viewMode}
                  showFavoriteButton={true}
                  showShortlistButton={true}
                  showExcludeButton={true}
                  showMessageButton={true}
                />
              );
            })}
          </div>

          {filteredUsers.length > 0 && (
            <div className="pagination-container">
              <div className="pagination-info">
                Showing {indexOfFirstRecord + 1}-{Math.min(indexOfLastRecord, filteredUsers.length)} of {filteredUsers.length} filtered results
                {totalResults > 0 && totalResults !== filteredUsers.length && (
                  <span className="text-muted ms-2">
                    ({totalResults} total in database)
                  </span>
                )}
              </div>
              {totalPages > 1 && (
                <div className="pagination-controls">
                  {renderPaginationButtons()}
                </div>
              )}
            </div>
          )}
        </div> {/* Close search-results */}
      </div> {/* Close search-container */}

      {/* Message Modal */}
      <MessageModal
        isOpen={showMessageModal}
        profile={selectedUserForMessage}
        onClose={() => {
          setShowMessageModal(false);
          setSelectedUserForMessage(null);
        }}
      />

      {/* Save Search Modal */}
      <SaveSearchModal
        show={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveSearch}
        savedSearches={savedSearches}
        onUpdate={handleUpdateSavedSearch}
        onDelete={handleDeleteSavedSearch}
        currentCriteria={searchCriteria}
        minMatchScore={minMatchScore}
      />

      {/* PII Request Modal */}
      {selectedUserForPII && (
        <PIIRequestModal
          isOpen={showPIIRequestModal}
          profileUsername={selectedUserForPII.username}
          profileName={`${selectedUserForPII.firstName || selectedUserForPII.username}`}
          currentAccess={currentPIIAccess}
          requestStatus={getPIIRequestStatus(selectedUserForPII.username)}
          onClose={() => {
            setShowPIIRequestModal(false);
            setSelectedUserForPII(null);
          }}
          onRefresh={() => {
            console.log('🔄 PIIRequestModal requested refresh in SearchPage');
            loadPiiRequests(); // Refresh PII status when modal opens
          }}
          onSuccess={handlePIIRequestSuccess}
        />
      )}
    </div>
  );
};

export default SearchPage2;
