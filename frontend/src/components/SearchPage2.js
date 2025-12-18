import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../utils/urlHelper';
import api, { setDefaultSavedSearch, getDefaultSavedSearch } from '../api';
import SearchResultCard from './SearchResultCard';
import MessageModal from './MessageModal';
import SaveSearchModal from './SaveSearchModal';
import PIIRequestModal from './PIIRequestModal';
import PageHeader from './PageHeader';
import OnlineStatusBadge from './OnlineStatusBadge';
import UniversalTabContainer from './UniversalTabContainer';
import SearchFilters from './SearchFilters';
import LoadMore from './LoadMore';
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
  // const [totalResults, setTotalResults] = useState(0); // Unused - kept for future pagination
  // currentPage removed - using LoadMore incremental loading instead

  // L3V3L specific state
  const [minMatchScore, setMinMatchScore] = useState(0); // L3V3L match score filter
  const [isPremiumUser, setIsPremiumUser] = useState(false); // Premium status for L3V3L filtering
  const [systemConfig, setSystemConfig] = useState({ enable_l3v3l_for_all: true }); // System configuration

  // User interaction state
  const [users, setUsers] = useState([]);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [searchCriteria, setSearchCriteria] = useState({
    keyword: '',
    profileId: '', // Direct Profile ID lookup
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
  
  // Advanced filters collapse state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Saved searches state
  // eslint-disable-next-line no-unused-vars
  const [saveSearchName, setSaveSearchName] = useState('');
  const [savedSearches, setSavedSearches] = useState([]);
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [selectedSearch, setSelectedSearch] = useState(null);
  const [editingScheduleFor, setEditingScheduleFor] = useState(null); // Track which search is being edited for schedule

  // PII access state
  const [piiRequests, setPiiRequests] = useState({});

  // Message modal state
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedUserForMessage, setSelectedUserForMessage] = useState(null);

  // PII Request modal state
  const [showPIIRequestModal, setShowPIIRequestModal] = useState(false);
  const [selectedUserForPII, setSelectedUserForPII] = useState(null);
  const [currentPIIAccess, setCurrentPIIAccess] = useState({});

  // Ref to track if default search has been auto-executed
  const hasAutoExecutedRef = useRef(false);

  // Load more state (for incremental loading instead of pagination)
  const [displayedCount, setDisplayedCount] = useState(20);
  const [loadingMore, setLoadingMore] = useState(false);

  // Sort state
  const [sortBy, setSortBy] = useState('age'); // matchScore, age, height, location, occupation, newest
  const [sortOrder, setSortOrder] = useState('asc'); // desc or asc (asc = youngest first for age)

  // Collapse state for filters panel
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);

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
        
        // Calculate user's age from birthMonth and birthYear
        let userAge = null;
        if (response.data.birthMonth && response.data.birthYear) {
          const today = new Date();
          userAge = today.getFullYear() - response.data.birthYear;
          if (today.getMonth() + 1 < response.data.birthMonth) {
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
        
        // Set default age range from partnerCriteria (user's saved preferences)
        let defaultAgeMin = '';
        let defaultAgeMax = '';
        const partnerCriteria = response.data.partnerCriteria;
        
        // Debug: Log the full partnerCriteria object
        console.log('🔍 DEBUG partnerCriteria:', JSON.stringify(partnerCriteria, null, 2));
        console.log('🔍 DEBUG userAge:', userAge, 'userHeight:', userHeightTotalInches);
        
        if (partnerCriteria?.ageRangeRelative && userAge) {
          // Use relative age offsets from partner criteria
          const minOffset = partnerCriteria.ageRangeRelative.minOffset || 0;
          const maxOffset = partnerCriteria.ageRangeRelative.maxOffset || 5;
          defaultAgeMin = Math.max(19, userAge + minOffset).toString();
          defaultAgeMax = Math.min(100, userAge + maxOffset).toString();
          console.log('🎯 Using partnerCriteria.ageRangeRelative:', { minOffset, maxOffset, defaultAgeMin, defaultAgeMax });
        } else if (partnerCriteria?.ageRange?.min && partnerCriteria?.ageRange?.max) {
          // Fallback to absolute age range if set
          defaultAgeMin = partnerCriteria.ageRange.min.toString();
          defaultAgeMax = partnerCriteria.ageRange.max.toString();
          console.log('🎯 Using partnerCriteria.ageRange (absolute):', { defaultAgeMin, defaultAgeMax });
        } else if (userAge && userGender) {
          // Final fallback: gender-based defaults
          if (userGender === 'male') {
            // Male: looking for younger (age - 5) to slightly older (age + 1)
            defaultAgeMin = Math.max(19, userAge - 5).toString();
            defaultAgeMax = Math.min(100, userAge + 1).toString();
          } else if (userGender === 'female') {
            // Female: looking for slightly younger (age - 1) to older (age + 5)
            defaultAgeMin = Math.max(19, userAge - 1).toString();
            defaultAgeMax = Math.min(100, userAge + 5).toString();
          }
          console.log('🎯 Using gender-based age defaults:', { defaultAgeMin, defaultAgeMax });
        }
        
        // Set default height range from partnerCriteria (user's saved preferences)
        let defaultHeightMinFeet = '';
        let defaultHeightMinInches = '';
        let defaultHeightMaxFeet = '';
        let defaultHeightMaxInches = '';
        
        if (partnerCriteria?.heightRangeRelative && userHeightTotalInches) {
          // Use relative height offsets from partner criteria
          const minInchesOffset = partnerCriteria.heightRangeRelative.minInches || 0;
          const maxInchesOffset = partnerCriteria.heightRangeRelative.maxInches || 6;
          const minTotalInches = userHeightTotalInches + minInchesOffset;
          const maxTotalInches = userHeightTotalInches + maxInchesOffset;
          
          defaultHeightMinFeet = Math.floor(minTotalInches / 12).toString();
          defaultHeightMinInches = (minTotalInches % 12).toString();
          defaultHeightMaxFeet = Math.floor(maxTotalInches / 12).toString();
          defaultHeightMaxInches = (maxTotalInches % 12).toString();
          console.log('🎯 Using partnerCriteria.heightRangeRelative:', { minInchesOffset, maxInchesOffset, minTotalInches, maxTotalInches });
        } else if (partnerCriteria?.heightRange?.minFeet) {
          // Fallback to absolute height range if set
          defaultHeightMinFeet = partnerCriteria.heightRange.minFeet?.toString() || '';
          defaultHeightMinInches = partnerCriteria.heightRange.minInches?.toString() || '';
          defaultHeightMaxFeet = partnerCriteria.heightRange.maxFeet?.toString() || '';
          defaultHeightMaxInches = partnerCriteria.heightRange.maxInches?.toString() || '';
          console.log('🎯 Using partnerCriteria.heightRange (absolute):', { defaultHeightMinFeet, defaultHeightMinInches, defaultHeightMaxFeet, defaultHeightMaxInches });
        } else if (userHeightTotalInches && userGender) {
          // Final fallback: gender-based defaults
          if (userGender === 'male') {
            // Male: looking for shorter (height - 6") to same height
            const minTotalInches = userHeightTotalInches - 6;
            const maxTotalInches = userHeightTotalInches;
            defaultHeightMinFeet = Math.floor(minTotalInches / 12).toString();
            defaultHeightMinInches = (minTotalInches % 12).toString();
            defaultHeightMaxFeet = Math.floor(maxTotalInches / 12).toString();
            defaultHeightMaxInches = (maxTotalInches % 12).toString();
          } else if (userGender === 'female') {
            // Female: looking for taller (height + 1") to much taller (height + 6")
            const minTotalInches = userHeightTotalInches + 1;
            const maxTotalInches = userHeightTotalInches + 6;
            defaultHeightMinFeet = Math.floor(minTotalInches / 12).toString();
            defaultHeightMinInches = (minTotalInches % 12).toString();
            defaultHeightMaxFeet = Math.floor(maxTotalInches / 12).toString();
            defaultHeightMaxInches = (maxTotalInches % 12).toString();
          }
          console.log('🎯 Using gender-based height defaults');
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
      console.log('🔧 Loading system config...');
      try {
        const response = await api.get('/system-settings');
        console.log('🔧 System config API response:', response.data);
        setSystemConfig(response.data);
        console.log('🔧 System config state updated:', response.data);
      } catch (error) {
        console.error('❌ Error loading system config:', error);
        console.error('❌ Using default config: enable_l3v3l_for_all=true');
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

  // Trigger initial search after user profile is loaded - check for default saved search first
  useEffect(() => {
    const loadAndExecuteDefaultSearch = async () => {
      if (!currentUserProfile) {
        console.log('⚠️ currentUserProfile is null/undefined, waiting...');
        return;
      }

      // Prevent multiple auto-executions
      if (hasAutoExecutedRef.current) {
        console.log('⏭️ Already auto-executed default search, skipping');
        return;
      }

      try {
        // Check if there's a default saved search
        const defaultSearch = await getDefaultSavedSearch();
        
        if (defaultSearch && defaultSearch.criteria) {
          console.log('⭐ Found default saved search:', defaultSearch.name);
          
          // Check if we have saved searches (which will open Saved tab)
          if (savedSearches.length > 0) {
            console.log('✅ Saved searches exist - auto-executing default search');
            console.log('📋 Default search criteria:', defaultSearch.criteria);
            
            // Extract minMatchScore from saved search (same as handleLoadSavedSearch)
            const loadedMinScore = defaultSearch.minMatchScore !== undefined ? defaultSearch.minMatchScore : 0;
            console.log('🎯 Min match score:', loadedMinScore);
            
            // Load criteria and show banner (user will see what's being searched)
            setSearchCriteria(defaultSearch.criteria);
            setMinMatchScore(loadedMinScore);
            setSelectedSearch(defaultSearch);
            
            // Mark as executed
            hasAutoExecutedRef.current = true;
            
            // Execute the search with explicit criteria AND minMatchScore
            setTimeout(() => {
              console.log('🔍 Auto-executing default saved search');
              console.log('   - Criteria:', defaultSearch.criteria);
              console.log('   - Min match score:', loadedMinScore);
              handleSearch(1, loadedMinScore, defaultSearch.criteria);  // Pass BOTH!
            }, 500);
          } else {
            // No saved searches yet, load criteria silently (no execution, no banner)
            console.log('📋 Loading criteria silently (no saved searches list yet)');
            setSearchCriteria(defaultSearch.criteria);
          }
        } else {
          // No default saved search - just show empty search page
          console.log('🔍 No default search - waiting for user to initiate search');
        }
      } catch (err) {
        console.error('Error loading default saved search:', err);
      }
    };

    loadAndExecuteDefaultSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserProfile, savedSearches.length]);
  
  // ❌ DISABLED: No auto-search on gender change
  // User must manually click "Search" button
  // useEffect(() => {
  //   if (currentUserProfile && searchCriteria.gender && users.length === 0) {
  //     console.log('🔄 Gender changed, triggering search:', searchCriteria.gender);
  //     handleSearch(1);
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [searchCriteria.gender]);

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
    
    // Check if user has any images to display (profile picture always visible when enabled)
    const hasVisibleImages = user.images && user.images.length > 0;
    
    // Check if profile picture is visible due to global setting (backend sets profilePicVisible: true)
    const profilePicVisibleGlobal = user.profilePicVisible === true;

    // If no access to images AND no visible images AND no global profile pic visibility, show masked version
    if (!hasImageAccess && !hasVisibleImages && !profilePicVisibleGlobal) {
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
                <span className="badge bg-warning text-dark">📨 Request Pics Sent</span>
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

  // Calculate default search criteria from user profile
  const getDefaultSearchCriteria = () => {
    let defaultGender = '';
    let defaultAgeMin = '';
    let defaultAgeMax = '';
    let defaultHeightMinFeet = '';
    let defaultHeightMinInches = '';
    let defaultHeightMaxFeet = '';
    let defaultHeightMaxInches = '';

    if (currentUserProfile) {
      // Calculate opposite gender
      const userGender = currentUserProfile.gender?.toLowerCase();
      if (userGender === 'male') {
        defaultGender = 'female';
      } else if (userGender === 'female') {
        defaultGender = 'male';
      }

      // Calculate user's age
      let userAge = null;
      if (currentUserProfile.birthMonth && currentUserProfile.birthYear) {
        const today = new Date();
        userAge = today.getFullYear() - currentUserProfile.birthYear;
        if (today.getMonth() + 1 < currentUserProfile.birthMonth) {
          userAge--;
        }
      }

      // Set default age range based on gender
      if (userAge && userGender) {
        if (userGender === 'male') {
          defaultAgeMin = (userAge - 3).toString();
          defaultAgeMax = (userAge + 1).toString();
        } else if (userGender === 'female') {
          defaultAgeMin = (userAge - 1).toString();
          defaultAgeMax = (userAge + 3).toString();
        }
      }

      // Parse user's height
      let userHeightTotalInches = null;
      if (currentUserProfile.height) {
        const heightMatch = currentUserProfile.height.match(/(\d+)'(\d+)"/);
        if (heightMatch) {
          const userHeightFeet = parseInt(heightMatch[1]);
          const userHeightInches = parseInt(heightMatch[2]);
          userHeightTotalInches = userHeightFeet * 12 + userHeightInches;
        }
      }

      // Set default height range based on gender
      if (userHeightTotalInches && userGender) {
        if (userGender === 'male') {
          const minTotalInches = userHeightTotalInches - 3;
          const maxTotalInches = userHeightTotalInches;
          defaultHeightMinFeet = Math.floor(minTotalInches / 12).toString();
          defaultHeightMinInches = (minTotalInches % 12).toString();
          defaultHeightMaxFeet = Math.floor(maxTotalInches / 12).toString();
          defaultHeightMaxInches = (maxTotalInches % 12).toString();
        } else if (userGender === 'female') {
          const minTotalInches = userHeightTotalInches;
          const maxTotalInches = userHeightTotalInches + 3;
          defaultHeightMinFeet = Math.floor(minTotalInches / 12).toString();
          defaultHeightMinInches = (minTotalInches % 12).toString();
          defaultHeightMaxFeet = Math.floor(maxTotalInches / 12).toString();
          defaultHeightMaxInches = (maxTotalInches % 12).toString();
        }
      }
    }

    return {
      gender: defaultGender,
      ageMin: defaultAgeMin,
      ageMax: defaultAgeMax,
      heightMinFeet: defaultHeightMinFeet,
      heightMinInches: defaultHeightMinInches,
      heightMaxFeet: defaultHeightMaxFeet,
      heightMaxInches: defaultHeightMaxInches
    };
  };

  // Wrapper for minMatchScore changes to reset display count
  const handleMinMatchScoreChange = (newScore) => {
    setMinMatchScore(newScore);
    setDisplayedCount(20); // Reset to show first 20 of filtered results
  };

  // Handle sort changes
  const handleSortChange = (e) => {
    const newSortBy = e.target.value;
    setSortBy(newSortBy);
    setDisplayedCount(20); // Reset to show first 20 of sorted results
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Toggle sort order
  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    setDisplayedCount(20); // Reset to show first 20
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearFilters = () => {
    // Minimal global defaults - Gender only (widest search)
    const defaults = getDefaultSearchCriteria();
    
    setSearchCriteria({
      keyword: '',
      profileId: '', // Clear Profile ID search
      gender: defaults.gender, // Opposite gender only
      ageMin: '', // Empty - search all ages
      ageMax: '',
      heightMin: '',
      heightMax: '',
      heightMinFeet: '', // Empty - search all heights
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
      sortBy: 'age',
      sortOrder: 'asc'
    });
    setUsers([]);
    // setTotalResults(0);
    setSaveSearchName('');
    setMinMatchScore(0); // Reset L3V3L compatibility score
    setSelectedSearch(null); // Clear selected search badge
    setDisplayedCount(20); // Reset to initial display count
    setFiltersCollapsed(false); // Expand filters when clearing
  };

  const handleSearch = async (page = 1, overrideMinMatchScore = null, overrideCriteria = null) => {
    const currentUser = localStorage.getItem('username');
    
    try {
      setLoading(true);
      setError('');
      setDisplayedCount(20); // Reset to show first 20 results

      // STEP 1: Apply traditional search filters
      // Use overrideCriteria if provided (for immediate load), otherwise use state
      const criteriaToUse = overrideCriteria !== null ? overrideCriteria : searchCriteria;
      
      // Log profileId for debugging
      console.log('🔍 Profile ID in criteria:', criteriaToUse.profileId);
      
      // If profileId is provided, ONLY send profileId (bypass all other filters)
      let params;
      if (criteriaToUse.profileId?.trim()) {
        params = {
          profileId: criteriaToUse.profileId.trim(),
          page: page,
          limit: 500
        };
        console.log('🔍 Profile ID search - bypassing other filters');
      } else {
        params = {
          ...criteriaToUse,
          status: 'active',  // Only search for active users
          page: page,
          limit: 500  // Get more results from backend
        };
      }
      
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
      console.log('🔍 profileId in params:', params.profileId);
      console.log('🔍 Full params object:', JSON.stringify(params, null, 2));

      const response = await api.get('/search', { params });
      console.log('🔍 API URL called:', `/search?${new URLSearchParams(params).toString()}`);
      
      console.log('🔍 Raw API response:', response);
      console.log('🔍 response.data:', response.data);
      console.log('🔍 response.data.users:', response.data.users);
      console.log('🔍 response.data.users length:', response.data.users?.length);
      
      // Filter out own profile, admin, and moderators (unless doing Profile ID search)
      const isProfileIdSearch = criteriaToUse.profileId?.trim();
      let filteredUsers = (response.data.users || []).filter(user => {
        // Don't filter out own profile when doing Profile ID search (admin lookup)
        if (!isProfileIdSearch && user.username === currentUser) return false;
        // Don't filter out admin/moderator when doing direct Profile ID lookup
        if (!isProfileIdSearch) {
          const userRole = user.role?.toLowerCase();
          if (userRole === 'admin' || userRole === 'moderator') return false;
        }
        return true;
      });

      // STEP 2: Fetch and attach L3V3L match scores (if enabled)
      // Always fetch scores so they're available for client-side filtering
      console.log(`🔍 L3V3L Check: systemConfig=${JSON.stringify(systemConfig)}, isPremiumUser=${isPremiumUser}`);
      const canUseL3V3L = systemConfig.enable_l3v3l_for_all || isPremiumUser;
      console.log(`🔍 canUseL3V3L=${canUseL3V3L}`);
      if (canUseL3V3L) {
        console.log(`🦋 L3V3L enabled: Fetching compatibility scores`);
        
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
          
          // Attach scores to all users (don't filter here - let client-side handle it)
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
            .sort((a, b) => b.matchScore - a.matchScore); // Sort by score desc
          
          console.log(`✅ Attached L3V3L scores to ${filteredUsers.length} users`);
          console.log(`🎯 Sample user with score:`, filteredUsers[0]);
        } catch (err) {
          console.error('❌ Error fetching L3V3L scores:', err);
          // Continue without L3V3L filtering if API fails
        }
      }

      if (page === 1) {
        setUsers(filteredUsers);
          } else {
        setUsers(prev => [...prev, ...filteredUsers]);
      }

      // setTotalResults(filteredUsers.length);

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
      // Auto-collapse filters after search to show more results
      if (page === 1) {
        setFiltersCollapsed(true);
      }
    }
  };

  // Handle load more for incremental loading
  const handleLoadMore = () => {
    setLoadingMore(true);
    // Simulate a small delay for better UX (can be removed if not needed)
    setTimeout(() => {
      setDisplayedCount(prev => prev + 20); // Let render clamp to actual length
      setLoadingMore(false);
      // Smooth scroll to show newly loaded items
      window.scrollTo({ 
        top: document.documentElement.scrollHeight - 800, 
        behavior: 'smooth' 
      });
    }, 300);
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

  const handleSaveSearch = async (saveData) => {
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

      // Handle both old format (string) and new format (object with notifications)
      const searchName = typeof saveData === 'string' ? saveData : saveData.name;
      const notifications = typeof saveData === 'object' ? saveData.notifications : null;

      const searchData = {
        name: searchName.trim(),
        description: description,
        criteria: searchCriteria,
        minMatchScore: minMatchScore, // Save L3V3L match score
        created_at: new Date().toISOString(),
        ...(notifications && { notifications }) // Add notifications if provided
      };
      
      console.log('💾 Search data to save:', searchData);

      await api.post(`/${username}/saved-searches`, searchData);

      const notificationMsg = notifications?.enabled 
        ? ` with ${notifications.frequency} notifications`
        : '';
      setStatusMessage(`✅ Search saved: "${searchName}"${notificationMsg}`);
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

  // Handler to open modal for editing notification schedule
  const handleEditSchedule = (search) => {
    setEditingScheduleFor(search);
    setShowSaveModal(true);
  };

  const handleLoadSavedSearch = (savedSearch) => {
    // Restore L3V3L match score if saved
    const loadedMinScore = savedSearch.minMatchScore !== undefined ? savedSearch.minMatchScore : 0;
    const loadedCriteria = savedSearch.criteria;
    
    // Update state for UI display
    setSearchCriteria(loadedCriteria);
    setMinMatchScore(loadedMinScore);
    setSelectedSearch(savedSearch);
    setShowSavedSearches(false);
    setFiltersCollapsed(false); // Expand filters to show loaded search
    
    // Automatically perform search with loaded criteria
    // Pass both criteria and minMatchScore directly to avoid React state timing issues
    handleSearch(1, loadedMinScore, loadedCriteria);
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

  const handleSetDefaultSearch = async (searchId, searchName) => {
    console.log('⭐ Setting default search:', searchId, searchName);
    
    if (!searchId) {
      console.error('❌ No search ID provided');
      setError('Cannot set default: Invalid search ID');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    try {
      await setDefaultSavedSearch(searchId);
      setStatusMessage(`⭐ "${searchName}" set as default search`);
      setTimeout(() => setStatusMessage(''), 3000);
      loadSavedSearches(); // Reload to update UI
    } catch (err) {
      console.error('❌ Error setting default search:', err);
      setError('Failed to set default search. Please try again.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleClearSelectedSearch = async () => {
    setSelectedSearch(null);
    setDisplayedCount(20); // Reset to initial display count
    
    // Get default search criteria from user profile
    const defaults = getDefaultSearchCriteria();
    
    const clearedCriteria = {
      keyword: '',
      gender: defaults.gender,
      ageMin: defaults.ageMin,
      ageMax: defaults.ageMax,
      heightMin: '',
      heightMax: '',
      heightMinFeet: defaults.heightMinFeet,
      heightMinInches: defaults.heightMinInches,
      heightMaxFeet: defaults.heightMaxFeet,
      heightMaxInches: defaults.heightMaxInches,
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
      sortBy: 'age',
      sortOrder: 'asc'
    };
    
    // Update criteria and clear results
    setSearchCriteria(clearedCriteria);
    setMinMatchScore(0); // Reset L3V3L compatibility score
    setUsers([]);
    // setTotalResults(0);
    setStatusMessage('✅ Returning to default search criteria');
    setTimeout(() => setStatusMessage(''), 3000);
    
    // Perform search directly with cleared criteria instead of relying on state update
    try {
      setLoading(true);
      setError('');

      // Build params object
      const params = {
        gender: defaults.gender,
        ageMin: defaults.ageMin,
        ageMax: defaults.ageMax,
        status: 'active',
        page: 1,
        limit: 500
      };

      // Convert height feet+inches to total inches (like handleSearch does)
      if (defaults.heightMinFeet && defaults.heightMinInches) {
        const feet = parseInt(defaults.heightMinFeet);
        const inches = parseInt(defaults.heightMinInches);
        if (!isNaN(feet) && !isNaN(inches)) {
          params.heightMin = feet * 12 + inches;
        }
      }

      if (defaults.heightMaxFeet && defaults.heightMaxInches) {
        const feet = parseInt(defaults.heightMaxFeet);
        const inches = parseInt(defaults.heightMaxInches);
        if (!isNaN(feet) && !isNaN(inches)) {
          params.heightMax = feet * 12 + inches;
        }
      }

      // Clean up empty strings
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null || params[key] === undefined) {
          delete params[key];
        }
      });

      // Ensure integer fields are numbers
      ['ageMin', 'ageMax', 'heightMin', 'heightMax'].forEach(field => {
        if (params[field] !== undefined) {
          const num = parseInt(params[field]);
          if (!isNaN(num)) {
            params[field] = num;
          } else {
            delete params[field];
          }
        }
      });

      console.log('🔍 Clear saved search params:', params);

      const response = await api.get('/search', { params });
      const fetchedUsers = response.data.users || [];
      
      setUsers(fetchedUsers);
      // setTotalResults(fetchedUsers.length);
      setFiltersCollapsed(true); // Auto-collapse filters after search
      
      console.log(`✅ Retrieved ${fetchedUsers.length} profiles with default criteria`);
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

  const calculateAge = (birthMonth, birthYear) => {
    if (!birthMonth || !birthYear) return null;
    const today = new Date();
    let age = today.getFullYear() - birthYear;
    
    if (today.getMonth() + 1 < birthMonth) {
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
              setStatusMessage('✅ Removed from not interested');
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
              
              setStatusMessage('✅ Marked as not interested');
              setTimeout(() => setStatusMessage(''), 3000);
            }
            setError(''); // Clear any previous errors
          } catch (err) {
            console.error(`Error ${isCurrentlyExcluded ? 'removing from' : 'adding to'} exclusions:`, err);
            const errorMsg = `Failed to ${isCurrentlyExcluded ? 'remove from' : 'mark as'} not interested. ` + (err.response?.data?.detail || err.message);
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

  console.log(`🔍 Starting client-side filter with ${users.length} users from backend`);
  console.log(`🎯 Current minMatchScore STATE value: ${minMatchScore}`);
  console.log(`📋 First 3 users:`, users.slice(0, 3).map(u => ({ username: u.username, age: u.age, height: u.height, matchScore: u.matchScore })));
  
  const filteredUsers = users.filter(user => {
    // Exclude users who have been excluded by current user
    if (excludedUsers.has(user.username)) {
      console.log(`🚫 Filtered out ${user.username} - excluded`);
      return false;
    }

    // Filter by minimum compatibility score (L3V3L)
    if (minMatchScore > 0) {
      // If user has no match score (0 or undefined), hide them when filter is active
      const userScore = user.matchScore || 0;
      if (userScore < minMatchScore) {
        console.log(`🚫 Filtered out ${user.username} - score ${userScore} < ${minMatchScore}`);
        return false;
      }
    }

    if (searchCriteria.ageMin || searchCriteria.ageMax) {
      const age = user.age || calculateAge(user.birthMonth, user.birthYear);
      console.log(`👤 ${user.username}: age=${age}, ageMin=${searchCriteria.ageMin}, ageMax=${searchCriteria.ageMax}`);
      
      // Only apply age filter if user has valid age data
      // Users without age data will be included in results
      if (age !== null) {
        if (searchCriteria.ageMin && age < parseInt(searchCriteria.ageMin)) {
          console.log(`🚫 Filtered out ${user.username} - age ${age} < ${searchCriteria.ageMin}`);
          return false;
        }
        if (searchCriteria.ageMax && age > parseInt(searchCriteria.ageMax)) {
          console.log(`🚫 Filtered out ${user.username} - age ${age} > ${searchCriteria.ageMax}`);
          return false;
        }
      } else {
        console.log(`⚠️ ${user.username} has no age data - including in results`);
      }
    }

    if (searchCriteria.heightMin || searchCriteria.heightMax) {
      const heightInches = parseHeight(user.height);
      console.log(`👤 ${user.username}: height=${heightInches}, heightMin=${searchCriteria.heightMin}, heightMax=${searchCriteria.heightMax}`);
      
      // Only apply height filter if user has valid height data
      // Users without height data will be included in results
      if (heightInches !== null) {
        if (searchCriteria.heightMin && heightInches < parseInt(searchCriteria.heightMin)) {
          console.log(`🚫 Filtered out ${user.username} - height ${heightInches}" < ${searchCriteria.heightMin}"`);
          return false;
        }
        if (searchCriteria.heightMax && heightInches > parseInt(searchCriteria.heightMax)) {
          console.log(`🚫 Filtered out ${user.username} - height ${heightInches}" > ${searchCriteria.heightMax}"`);
          return false;
        }
      } else {
        console.log(`⚠️ ${user.username} has no height data - including in results`);
      }
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

    console.log(`✅ ${user.username} passed all filters`);
    return true;
  });
  
  console.log(`📊 Filter Results: ${users.length} users → ${filteredUsers.length} after filtering`);

  // Apply sorting to filtered users
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    let compareValue = 0;

    switch (sortBy) {
      case 'matchScore':
        compareValue = (b.matchScore || 0) - (a.matchScore || 0);
        break;
      
      case 'age':
        const ageA = a.age || calculateAge(a.birthMonth, a.birthYear) || 999;
        const ageB = b.age || calculateAge(b.birthMonth, b.birthYear) || 999;
        compareValue = ageA - ageB;
        break;
      
      case 'height':
        const heightA = parseHeight(a.height) || 0;
        const heightB = parseHeight(b.height) || 0;
        compareValue = heightB - heightA; // Taller first by default
        break;
      
      case 'location':
        const locA = (a.location || '').toLowerCase();
        const locB = (b.location || '').toLowerCase();
        compareValue = locA.localeCompare(locB);
        break;
      
      case 'occupation':
        const occA = (a.occupation || '').toLowerCase();
        const occB = (b.occupation || '').toLowerCase();
        compareValue = occA.localeCompare(occB);
        break;
      
      case 'newest':
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        compareValue = dateB - dateA; // Newest first
        break;
      
      default:
        compareValue = 0;
    }

    // Apply sort order
    return sortOrder === 'asc' ? compareValue : -compareValue;
  });

  // Use displayedCount for incremental loading instead of pagination
  const currentRecords = sortedUsers.slice(0, displayedCount);

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
              <span className="selected-search-name">{selectedSearch.name}</span>
              <button 
                className="btn-clear-x"
                onClick={handleClearSelectedSearch}
                title="Clear selected search"
              >
                ✕
              </button>
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleSearch(1); }}>

            {/* Collapsible Filters Container */}
            <div className={`filters-container ${filtersCollapsed ? 'collapsed' : 'expanded'}`}>
              
              {/* Collapsed Header - Minimal Tab Bar */}
              {filtersCollapsed && (
                <div className="filters-collapsed-header" style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: 'var(--surface-color)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '16px',
                  cursor: 'pointer'
                }} onClick={() => setFiltersCollapsed(false)}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-color)' }}>
                      🔍 Search
                    </span>
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>|</span>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-color)' }}>
                      💾 Saved {savedSearches.length > 0 && `(${savedSearches.length})`}
                    </span>
                    {minMatchScore > 0 && (
                      <span className="badge bg-primary" style={{ fontSize: '11px' }}>
                        {minMatchScore}%
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFiltersCollapsed(false);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <span>▼ Show Filters</span>
                  </button>
                </div>
              )}

              {/* Expanded Content - Full Tabs */}
              {!filtersCollapsed && (
                <>
                  {/* Collapse Button at Top Right */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'flex-end', 
                    marginBottom: '8px' 
                  }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => setFiltersCollapsed(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <span>▲ Hide Filters</span>
                    </button>
                  </div>

                  {/* Search Tabs */}
                  <UniversalTabContainer
                    key={`search-tabs-${savedSearches.length}`}
                    variant="underlined"
                    defaultTab={savedSearches.length > 0 ? "saved" : "search"}
                    tabs={[
                {
                  id: 'search',
                  icon: '🔍',
                  label: 'Search',
                  badge: minMatchScore > 0 ? `${minMatchScore}%` : null,
                  content: (
                    <SearchFilters
                      searchCriteria={searchCriteria}
                      minMatchScore={minMatchScore}
                      setMinMatchScore={handleMinMatchScoreChange}
                      handleInputChange={handleInputChange}
                      showAdvancedFilters={showAdvancedFilters}
                      setShowAdvancedFilters={setShowAdvancedFilters}
                      onSearch={() => handleSearch(1)}
                      onClear={handleClearFilters}
                      onSave={() => setShowSaveModal(true)}
                      systemConfig={systemConfig}
                      isPremiumUser={isPremiumUser}
                      currentUserProfile={currentUserProfile}
                      bodyTypeOptions={bodyTypeOptions}
                      occupationOptions={occupationOptions}
                      eatingOptions={eatingOptions}
                      lifestyleOptions={lifestyleOptions}
                    />
                  )
                },
                {
                  id: 'saved',
                  icon: '💾',
                  label: 'Saved',
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
                            <div key={search.id} className={`saved-search-card ${search.isDefault ? 'is-default' : ''}`}>
                              <div className="saved-search-header">
                                <h5 className="saved-search-name">
                                  {search.isDefault && <span className="default-badge" title="Default Search">⭐ </span>}
                                  {search.name}
                                </h5>
                                <div className="saved-search-actions">
                                  <button
                                    type="button"
                                    className="btn-schedule-saved"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleEditSchedule(search);
                                    }}
                                    title="Edit notification schedule"
                                  >
                                    ⏰
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-delete-saved"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleDeleteSavedSearch(search.id);
                                    }}
                                    title="Delete this saved search"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                              
                              <div className="saved-search-description">
                                <p>{search.description || generateSearchDescription(search.criteria, search.minMatchScore)}</p>
                              </div>

                              <div className="saved-search-footer">
                                <button
                                  type="button"
                                  className="btn-load-saved"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleLoadSavedSearch(search);
                                  }}
                                >
                                  📂 Load Search
                                </button>
                                {!search.isDefault && (
                                  <button
                                    type="button"
                                    className="btn-set-default"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleSetDefaultSearch(search.id, search.name);
                                    }}
                                    title="Set as default search"
                                  >
                                    ⭐ Default
                                  </button>
                                )}
                                {search.isDefault && (
                                  <span className="default-indicator" title="This search runs automatically on page load">
                                    ⭐ Default
                                  </span>
                                )}
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
                }
              ]}
            />
                </>
              )}
            </div>

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

          {/* Sort Controls - Before Results */}
          {sortedUsers.length > 0 && (
            <div className="sort-controls-top">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Sort by:
                </span>
                <select
                  value={sortBy}
                  onChange={handleSortChange}
                  className="form-select form-select-sm"
                  style={{
                    width: 'auto',
                    fontSize: '14px',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-color)',
                    cursor: 'pointer'
                  }}
                >
                  <option value="matchScore">🎯 Compatibility Score</option>
                  <option value="age">📅 Age</option>
                  <option value="height">📏 Height</option>
                  <option value="location">📍 Location</option>
                  <option value="occupation">💼 Profession</option>
                  <option value="newest">🆕 Newest Members</option>
                </select>
                <button
                  onClick={toggleSortOrder}
                  className="btn btn-sm btn-outline-secondary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    fontSize: '14px',
                    borderRadius: 'var(--radius-sm)'
                  }}
                  title={`Sort order: ${sortOrder === 'desc' ? 'Descending' : 'Ascending'}`}
                >
                  {sortOrder === 'desc' ? '↓' : '↑'}
                  <span>{sortOrder === 'desc' ? 'High to Low' : 'Low to High'}</span>
                </button>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 600 }}>Profiles:</span>
                <span 
                  style={{ 
                    background: 'var(--primary-color)', 
                    color: 'white', 
                    padding: '2px 8px', 
                    borderRadius: '12px',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'help'
                  }}
                  title="Total matches found by search"
                >
                  {users.length}
                </span>
                <span>|</span>
                <span 
                  style={{ 
                    background: 'var(--success-color)', 
                    color: 'white', 
                    padding: '2px 8px', 
                    borderRadius: '12px',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'help'
                  }}
                  title="Profiles currently displayed (after filtering)"
                >
                  {sortedUsers.length}
                </span>
                <span>|</span>
                <span 
                  style={{ 
                    background: 'var(--danger-color)', 
                    color: 'white', 
                    padding: '2px 8px', 
                    borderRadius: '12px',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'help'
                  }}
                  title="Profiles hidden (users you've excluded/blocked)"
                >
                  {users.length - filteredUsers.length}
                </span>
              </div>
            </div>
          )}

          <div 
            className={`${viewMode === 'cards' ? 'results-grid results-cards' : viewMode === 'compact' ? 'results-rows results-compact' : 'results-rows'}`}
            style={viewMode === 'cards' ? { gridTemplateColumns: `repeat(${cardsPerRow}, 1fr)` } : {}}
          >
            {currentRecords.map((user, index) => {
              return (
                <SearchResultCard
                  key={user.username}
                  user={user}
                  currentUsername={localStorage.getItem('username')}
                  // Context for kebab menu
                  context="search-results"
                  // Kebab menu handlers
                  onToggleFavorite={(u) => handleProfileAction(null, u.username, 'favorite')}
                  onToggleShortlist={(u) => handleProfileAction(null, u.username, 'shortlist')}
                  onBlock={(u) => handleProfileAction(null, u.username, 'exclude')}
                  onMessage={handleMessage}
                  onRequestPII={(u) => openPIIRequestModal(u.username)}
                  // Legacy handlers (for backward compatibility)
                  onFavorite={(u) => handleProfileAction(null, u.username, 'favorite')}
                  onShortlist={(u) => handleProfileAction(null, u.username, 'shortlist')}
                  onExclude={(u) => handleProfileAction(null, u.username, 'exclude')}
                  onPIIRequest={(u) => openPIIRequestModal(u.username)}
                  // State
                  isFavorited={favoritedUsers.has(user.username)}
                  isShortlisted={shortlistedUsers.has(user.username)}
                  isExcluded={excludedUsers.has(user.username)}
                  isBlocked={excludedUsers.has(user.username)}
                  hasPiiAccess={hasPiiAccess(user.username, 'contact_info')}
                  hasImageAccess={hasPiiAccess(user.username, 'images')}
                  isPiiRequestPending={isPiiRequestPending(user.username, 'contact_info')}
                  isImageRequestPending={isPiiRequestPending(user.username, 'images')}
                  piiRequestStatus={getPIIRequestStatus(user.username)}
                  piiAccess={{
                    contact: hasPiiAccess(user.username, 'contact_info'),
                    email: hasPiiAccess(user.username, 'email'),
                    phone: hasPiiAccess(user.username, 'phone'),
                    photos: hasPiiAccess(user.username, 'images')
                  }}
                  viewMode={viewMode}
                  // Legacy display flags
                  showFavoriteButton={true}
                  showShortlistButton={true}
                  showExcludeButton={true}
                  showMessageButton={true}
                  searchResults={currentRecords}
                  currentIndex={index}
                />
              );
            })}
          </div>

          {/* LoadMore at Top */}
          {sortedUsers.length > 0 && (
            <LoadMore
              currentCount={Math.min(displayedCount, sortedUsers.length)}
              totalCount={sortedUsers.length}
              onLoadMore={handleLoadMore}
              loading={loadingMore}
              itemsPerLoad={20}
              itemLabel="profiles"
              buttonText="View more"
            />
          )}

          {/* Consolidated Bottom Navigation Bar */}
          {sortedUsers.length > 0 && (
            <div className="results-controls-bottom">
              {/* Cards Per Row + View Toggle */}
              <div className="center-controls">
                {/* Cards Per Row (only show in card view) */}
                {viewMode === 'cards' && (
                  <div className="cards-per-row-selector">
                    <span className="selector-label">Cards:</span>
                    {[2, 3].map(num => (
                      <button
                        key={num}
                        className={`cards-btn ${cardsPerRow === num ? 'active' : ''}`}
                        onClick={() => {
                          setCardsPerRow(num);
                          localStorage.setItem('searchCardsPerRow', num.toString());
                        }}
                        title={`${num} cards per row`}  
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: View Toggle Buttons */}
              <div className="view-toggle-selector">
                <button
                  className={`view-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
                  onClick={() => setViewMode('cards')}
                  title="Card view"
                >
                  ▦
                </button>
                <button
                  className={`view-toggle-btn ${viewMode === 'rows' ? 'active' : ''}`}
                  onClick={() => setViewMode('rows')}
                  title="Row view"
                >
                  ☰
                </button>
              </div>
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
        onClose={() => {
          setShowSaveModal(false);
          setEditingScheduleFor(null);
        }}
        onSave={handleSaveSearch}
        savedSearches={savedSearches}
        onUpdate={handleUpdateSavedSearch}
        onDelete={handleDeleteSavedSearch}
        currentCriteria={searchCriteria}
        minMatchScore={minMatchScore}
        editingScheduleFor={editingScheduleFor}
      />

      {/* PII Request Modal */}
      {selectedUserForPII && (
        <PIIRequestModal
          isOpen={showPIIRequestModal}
          profileUsername={selectedUserForPII.username}
          profileName={`${selectedUserForPII.firstName || selectedUserForPII.username}`}
          currentAccess={currentPIIAccess}
          requestStatus={getPIIRequestStatus(selectedUserForPII.username)}
          visibilitySettings={{
            contactNumberVisible: selectedUserForPII.contactNumberVisible,
            contactEmailVisible: selectedUserForPII.contactEmailVisible,
            linkedinUrlVisible: selectedUserForPII.linkedinUrlVisible
          }}
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
