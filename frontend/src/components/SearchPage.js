import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../utils/urlHelper';
import api from '../api';
import SearchResultCard from './SearchResultCard';
import MessageModal from './MessageModal';
import SaveSearchModal from './SaveSearchModal';
import PIIRequestModal from './PIIRequestModal';
import OnlineStatusBadge from './OnlineStatusBadge';
import socketService from '../services/socketService';
import { onPIIAccessChange } from '../utils/piiAccessEvents';
import './SearchPage.css';

const SearchPage = () => {
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
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [showGridLines, setShowGridLines] = useState(false);
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
        console.log('👤 Current user profile loaded:', response.data);
        setCurrentUserProfile(response.data);
        
        // Set default gender to opposite gender
        const userGender = response.data.gender?.toLowerCase();
        let oppositeGender = '';
        if (userGender === 'male') {
          oppositeGender = 'female';
        } else if (userGender === 'female') {
          oppositeGender = 'male';
        }
        
        console.log('🎯 User gender:', userGender, '→ Default search gender:', oppositeGender);
        
        // Calculate user's age from DOB
        let userAge = null;
        if (response.data.dob) {
          const birthDate = new Date(response.data.dob);
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
        console.log('🟢 Loaded online users:', response.data.onlineUsers);
        const onlineSet = new Set(response.data.onlineUsers || []);
        console.log('🟢 Online users Set:', onlineSet);
        setOnlineUsers(onlineSet);
      } catch (err) {
        console.error('❌ Error loading online users:', err);
      }
    };
    
    loadCurrentUserProfile();
    loadUserData();
    loadSavedSearches();
    loadPiiRequests();
    
    // Load online users initially with a small delay to let polling service mark user online
    setTimeout(() => {
      loadOnlineUsers();
    }, 1000);
    
    // Refresh online users every 10 seconds
    const onlineUsersInterval = setInterval(() => {
      loadOnlineUsers();
    }, 10000);
    
    // Listen for online status updates
    const handleUserOnline = (data) => {
      console.log('User came online:', data.username);
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
  const educationOptions = ['', 'B.Tech in Computer Science', 'MBA from IIM', 'M.Tech in Engineering', 'B.Com', 'M.Com', 'BBA', 'MCA', 'B.Sc in Physics', 'M.Sc in Chemistry', 'MBBS', 'MD', 'CA', 'CS', 'B.A. in Economics', 'M.A. in English', 'Ph.D. in Mathematics', 'B.E. in Mechanical', 'Diploma in Engineering', 'B.Pharm', 'M.Pharm'];
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
    setSearchCriteria({
      keyword: '',
      gender: '',
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
  };

  // Check if any filters are active and count them
  const hasActiveFilters = () => {
    return countActiveFilters() > 0;
  };

  const countActiveFilters = () => {
    let count = 0;
    if (searchCriteria.keyword !== '') count++;
    if (searchCriteria.gender !== '') count++;
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

  const handleSearch = async (page = 1) => {
    try {
      setLoading(true);
      setError('');

      const params = {
        ...searchCriteria,
        status: 'active',  // Only search for active users
        page: page,
        limit: 500  // Get more results from backend to handle client-side filtering
      };
      
      // Convert feet/inches to total inches for height range
      if (params.heightMinFeet !== '' && params.heightMinInches !== '') {
        params.heightMin = parseInt(params.heightMinFeet) * 12 + parseInt(params.heightMinInches);
      }
      if (params.heightMaxFeet !== '' && params.heightMaxInches !== '') {
        params.heightMax = parseInt(params.heightMaxFeet) * 12 + parseInt(params.heightMaxInches);
      }
      
      // Remove feet/inches fields from params (not needed by API)
      delete params.heightMinFeet;
      delete params.heightMinInches;
      delete params.heightMaxFeet;
      delete params.heightMaxInches;

      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === false) {
          delete params[key];
        }
      });

      console.log('🔍 Search params being sent to backend:', params);

      const response = await api.get('/search', { params });
      console.log('📊 Raw backend response:', response.data);
      const currentUser = localStorage.getItem('username');
      
      console.log('📊 Search response - Total users from backend:', response.data.users?.length || 0);
      
      // Filter out:
      // 1. Own profile
      // 2. Admin profiles
      // 3. Moderator profiles
      const filteredUsers = (response.data.users || []).filter(user => {
        // Exclude own profile
        if (user.username === currentUser) {
          console.log('❌ Filtered out own profile:', currentUser);
          return false;
        }
        
        // Exclude admin and moderator roles
        const userRole = user.role?.toLowerCase();
        if (userRole === 'admin' || userRole === 'moderator') {
          console.log('❌ Filtered out admin/moderator:', user.username, userRole);
          return false;
        }
        
        return true;
      });
      
      console.log('✅ After filtering - Users to display:', filteredUsers.length);

      if (page === 1) {
        setUsers(filteredUsers);
        setCurrentPage(1); // Reset to first page on new search
      } else {
        setUsers(prev => [...prev, ...filteredUsers]);
      }

      setTotalResults(filteredUsers.length);
      setCurrentPage(page);

    } catch (err) {
      console.error('Error searching users:', err);
      setError('Failed to search users. ' + (err.response?.data?.detail || err.message));
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

  const handleSaveSearch = async (searchName) => {
    try {
      const username = localStorage.getItem('username');
      if (!username) {
        setError('Please login to save searches');
        return;
      }

      const searchData = {
        name: searchName.trim(),
        criteria: searchCriteria,
        created_at: new Date().toISOString()
      };

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
    setSelectedSearch(savedSearch);
    setShowSavedSearches(false);
    setStatusMessage(`✅ Loaded saved search: "${savedSearch.name}"`);
    // Automatically perform search with loaded criteria
    setTimeout(() => {
      handleSearch(1);
    }, 100);
    // Clear status message after 3 seconds
    setTimeout(() => setStatusMessage(''), 3000);
  };

  const handleDeleteSavedSearch = async (searchId) => {
    try {
      const username = localStorage.getItem('username');
      await api.delete(`/${username}/saved-searches/${searchId}`);
      setStatusMessage('✅ Search deleted');
      setTimeout(() => setStatusMessage(''), 3000);
      loadSavedSearches();
      // Clear selected search if it was deleted
      if (selectedSearch && selectedSearch._id === searchId) {
        setSelectedSearch(null);
      }
    } catch (err) {
      console.error('Error deleting saved search:', err);
      setError('Failed to delete saved search');
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
      setError('Failed to search users. ' + (err.response?.data?.detail || err.message));
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
      dob: piiRequests[`${targetUsername}_dob`] === 'approved',
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
      dob: piiRequests[`${targetUsername}_dob`],
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
      const age = calculateAge(user.dob);
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
      <div className="search-header">
        <h2>🔍 Advanced Search</h2>
        <p className="text-muted">Find your perfect match with detailed filters</p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {statusMessage && (
        <div className={`alert ${statusMessage.includes('❌') ? 'alert-danger' : 'alert-success'} alert-dismissible fade show`} role="alert">
          {statusMessage}
          <button type="button" className="btn-close" onClick={() => setStatusMessage('')}></button>
        </div>
      )}

      <div className="search-container">
        <div className={`search-filters ${filtersCollapsed ? 'collapsed' : ''}`}>
          <div 
            className="filters-header"
            onClick={(e) => {
              // Make entire header clickable for collapse/expand, except when clicking buttons
              if (e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
                setFiltersCollapsed(!filtersCollapsed);
              }
            }}
            style={{ cursor: 'pointer' }}
            title={filtersCollapsed ? "Click to show filters" : "Click to hide filters"}
          >
            <div className="filters-header-left">
              <h4>
                Search Filters
              </h4>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={(e) => { e.stopPropagation(); handleSearch(1); }}
                disabled={loading}
                title="Search"
              >
                <span style={{ fontSize: '18px' }}>{loading ? '⟳' : '🔍'}</span>
                <span style={{ marginLeft: '6px' }}>Search</span>
              </button>
              <button
                type="button"
                className={`btn btn-sm ${hasActiveFilters() ? 'btn-warning' : 'btn-outline-secondary'}`}
                onClick={(e) => { e.stopPropagation(); handleClearFilters(); }}
                disabled={loading || !hasActiveFilters()}
                title="Clear Filters"
              >
                <span style={{ fontSize: '16px', fontWeight: 'bold' }}>✕</span>
                <span style={{ marginLeft: '6px' }}>Clear Filters</span>
                {hasActiveFilters() && (
                  <small className="badge bg-danger ms-1">{countActiveFilters()}</small>
                )}
              </button>
            </div>
            <div className="filter-actions">
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={(e) => { e.stopPropagation(); setFiltersCollapsed(!filtersCollapsed); }}
                title={filtersCollapsed ? "Show filters" : "Hide filters"}
              >
                {filtersCollapsed ? '▼ Show' : '▲ Hide'}
              </button>
              <button
                className="btn btn-outline-primary btn-sm saved-search-btn"
                onClick={(e) => { e.stopPropagation(); setShowSavedSearches(!showSavedSearches); }}
                title={savedSearches.length > 0 ? `${savedSearches.length} saved searches` : 'No saved searches'}
              >
                {savedSearches.length > 0 ? (
                  <span className="icon-overlay">
                    <span className="icon-base">📋</span>
                    <span className="icon-top">🔍</span>
                  </span>
                ) : '🔍'}
                <span style={{ marginLeft: '6px' }}>Saved Searches</span>
                {savedSearches.length > 0 && ` (${savedSearches.length})`}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={(e) => { e.stopPropagation(); setShowSaveModal(true); }}
                title="Manage Saved Searches"
              >
                💾 Manage
              </button>
            </div>
          </div>

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
            {/* Row 1: Gender | Keyword | Age Range | Height Range | Body Type */}
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
                <div className="col-keyword">
                  <div className="form-group">
                    <label>Keyword Search</label>
                    <input
                      type="text"
                      className="form-control"
                      name="keyword"
                      value={searchCriteria.keyword}
                      onChange={handleInputChange}
                      placeholder="Search in name, location, interests, bio..."
                    />
                  </div>
                </div>
                <div className="col-age-min">
                  <div className="form-group">
                    <label>Age Range</label>
                    <input
                      type="number"
                      className="form-control"
                      name="ageMin"
                      value={searchCriteria.ageMin}
                      onChange={handleInputChange}
                      min="18"
                      max="80"
                      placeholder="Min"
                    />
                  </div>
                </div>
                <div className="col-age-max">
                  <div className="form-group">
                    <label>&nbsp;</label>
                    <input
                      type="number"
                      className="form-control"
                      name="ageMax"
                      value={searchCriteria.ageMax}
                      onChange={handleInputChange}
                      min="18"
                      max="80"
                      placeholder="Max"
                    />
                  </div>
                </div>
                <div className="col-height-min">
                  <div className="form-group">
                    <label>Height Range (Min)</label>
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
                    <label>Height Range (Max)</label>
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
              </div>
            </div>

            {/* Row 2: Education | Occupation | Eating | Drinking | Smoking | Location | Days Back */}
            <div className="filter-section">
              <div className="row filter-row-2">
                <div className="col-education">
                  <div className="form-group">
                    <label>Education</label>
                    <select
                      className="form-control"
                      name="education"
                      value={searchCriteria.education}
                      onChange={handleInputChange}
                    >
                      {educationOptions.map(option => (
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

            {/* Additional filters */}
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
              <h4>Search Results</h4>
              <div className="results-info">
                {users.length > 0 ? (
                  <>
                    <span className="badge bg-primary">Database: {totalResults} profiles</span>
                    <span className="badge bg-success ms-2">Showing: {filteredUsers.length}</span>
                    {users.length !== filteredUsers.length && (
                      <span className="badge bg-warning ms-2">
                        {users.length - filteredUsers.length} hidden (excluded)
                      </span>
                    )}
                  </>
                ) : (
                  <span className="badge bg-secondary">No search performed yet</span>
                )}
              </div>
            </div>
            <div className="results-controls">
              <button 
                className="btn btn-sm btn-outline-primary"
                onClick={() => handleSearch(1)}
                disabled={loading}
                title="Refresh results"
              >
                🔄
              </button>
              
              {/* View Toggle */}
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
              </div>

              {/* Cards Per Row (only show in card view) */}
              {viewMode === 'cards' && (
                <div className="cards-per-row-selector">
                  <span className="selector-label">Cards per row:</span>
                  {[2, 3, 4, 5].map(num => (
                    <button
                      key={num}
                      className={`btn btn-sm ${cardsPerRow === num ? 'btn-primary' : 'btn-outline-secondary'}`}
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
              
              {/* Grid Lines Toggle */}
              <div className="grid-lines-toggle">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={showGridLines}
                    onChange={(e) => setShowGridLines(e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <span className="toggle-label">Table grid lines</span>
              </div>
              
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

          {/* L3V3L Matches Promotion Banner */}
          <div className="cross-link-banner l3v3l-promo">
            <div className="banner-icon">🦋</div>
            <div className="banner-content">
              <h5>✨ Want AI-Powered Recommendations?</h5>
              <p>Let our intelligent L3V3L algorithm find your most compatible matches based on 8 key dimensions!</p>
            </div>
            <button 
              className="btn btn-primary banner-cta"
              onClick={() => navigate('/l3v3l-matches')}
            >
              Try L3V3L Matches →
            </button>
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
            className={`${viewMode === 'cards' ? 'results-grid results-cards' : 'results-rows'} ${showGridLines ? 'with-grid-lines' : ''}`}
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
        </div>
      </div>

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

export default SearchPage;
