import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import MessageModal from './MessageModal';
import SaveSearchModal from './SaveSearchModal';
import OnlineStatusBadge from './OnlineStatusBadge';
import socketService from '../services/socketService';
import { getDisplayName } from '../utils/userDisplay';
import './SearchPage.css';

const SearchPage = () => {
  // State for image indices per user
  const [imageIndices, setImageIndices] = useState({});
  const [imageErrors, setImageErrors] = useState({});
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  // Main application state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(20);

  // User interaction state
  const [users, setUsers] = useState([]);
  const [searchCriteria, setSearchCriteria] = useState({
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

  // Saved searches state
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

  const navigate = useNavigate();

  useEffect(() => {
    const username = localStorage.getItem('username');
    if (!username) {
      navigate('/login');
      return;
    }
    
    // Load user's favorites, shortlist, and exclusions
    const loadUserData = async () => {
      try {
        const [favResponse, shortlistResponse, exclusionsResponse] = await Promise.all([
          api.get(`/favorites/${username}`),
          api.get(`/shortlist/${username}`),
          api.get(`/exclusions/${username}`)
        ]);
        
        setFavoritedUsers(new Set(favResponse.data.favorites || []));
        setShortlistedUsers(new Set(shortlistResponse.data.shortlist || []));
        setExcludedUsers(new Set(exclusionsResponse.data.exclusions || []));
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
    
    // Load initial search results (all profiles) after component mounts
    // Only if user is logged in
    const currentUser = localStorage.getItem('username');
    if (currentUser) {
      handleSearch(1);
    }
    
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

  const loadPiiRequests = async () => {
    const currentUser = localStorage.getItem('username');
    if (!currentUser) return;

    try {
      const response = await api.get(`/pii-requests/${currentUser}?type=sent`);
      const requests = response.data.requests || [];
      const requestStatus = {};
      requests.forEach(req => {
        requestStatus[`${req.requestedUsername}_${req.requestType}`] = req.status;
      });

      setPiiRequests(requestStatus);
    } catch (err) {
      console.error('Error loading PII requests:', err);
    }
  };

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
                requestPiiAccess(user.username, 'images');
              }}
              disabled={isPiiRequestPending(user.username, 'images')}
            >
              {isPiiRequestPending(user.username, 'images') ? 'Pending' : 'Request Access'}
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
    const imageSrc = currentImage && currentImage.startsWith('http') ? currentImage : `http://localhost:8000${currentImage}`;
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
            >
              ‹
            </button>
            <button
              className="image-nav-btn next-btn"
              onClick={(e) => handleNextImage(user.username, e, users)}
              disabled={currentIndex === user.images.length - 1}
            >
              ›
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
    if (searchCriteria.heightMin !== '') count++;
    if (searchCriteria.heightMax !== '') count++;
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

      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === false) {
          delete params[key];
        }
      });

      const response = await api.get('/search', { params });

      if (page === 1) {
        setUsers(response.data.users || []);
        setCurrentPage(1); // Reset to first page on new search
      } else {
        setUsers(prev => [...prev, ...(response.data.users || [])]);
      }

      setTotalResults(response.data.total || 0);
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

  const requestPiiAccess = async (targetUsername, requestType) => {
    const currentUser = localStorage.getItem('username');
    if (!currentUser) {
      setError('Please login to request PII access');
      return;
    }

    try {
      await api.post('/pii-request', {
        requester: currentUser,
        requested_user: targetUsername,
        request_type: requestType,
        message: `Request to view ${requestType === 'contact_info' ? 'contact information' : 'profile images'}`
      });

      setPiiRequests(prev => ({
        ...prev,
        [`${targetUsername}_${requestType}`]: 'pending'
      }));

      alert(`${requestType === 'contact_info' ? 'Contact information' : 'Profile images'} request sent!`);
    } catch (err) {
      console.error('Error requesting PII access:', err);
      if (err.response?.status === 409) {
        setError('Request already pending');
      } else {
        setError('Failed to send request');
      }
    }
  };

  const hasPiiAccess = (targetUsername, requestType) => {
    return piiRequests[`${targetUsername}_${requestType}`] === 'approved';
  };

  const isPiiRequestPending = (targetUsername, requestType) => {
    return piiRequests[`${targetUsername}_${requestType}`] === 'pending';
  };

  const handleProfileAction = async (e, targetUsername, action) => {
    e.stopPropagation();

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
            const errorMsg = `Failed to ${isCurrentlyFavorited ? 'remove from' : 'add to'} favorites. ` + (err.response?.data?.detail || err.message);
            setError(errorMsg);
            setStatusMessage(`❌ ${errorMsg}`);
            setTimeout(() => setStatusMessage(''), 3000);
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
            const errorMsg = `Failed to ${isCurrentlyShortlisted ? 'remove from' : 'add to'} shortlist. ` + (err.response?.data?.detail || err.message);
            setError(errorMsg);
            setStatusMessage(`❌ ${errorMsg}`);
            setTimeout(() => setStatusMessage(''), 3000);
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
          <div className="filters-header">
            <div className="filters-header-left">
              <h4>
                Search Filters
                {hasActiveFilters() && (
                  <span className="filters-count badge bg-info ms-2">
                    {countActiveFilters()} active
                  </span>
                )}
              </h4>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => handleSearch(1)}
                disabled={loading}
                title="Search"
              >
                <span style={{ fontSize: '18px' }}>{loading ? '⟳' : '🔍'}</span>
              </button>
              <button
                type="button"
                className={`btn btn-sm ${hasActiveFilters() ? 'btn-warning' : 'btn-outline-secondary'}`}
                onClick={handleClearFilters}
                disabled={loading || !hasActiveFilters()}
                title="Clear Filters"
              >
                <span style={{ fontSize: '16px', fontWeight: 'bold' }}>✕</span>
                {hasActiveFilters() && (
                  <small className="badge bg-danger ms-1">{countActiveFilters()}</small>
                )}
              </button>
            </div>
            <div className="filter-actions">
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setFiltersCollapsed(!filtersCollapsed)}
                title={filtersCollapsed ? "Show filters" : "Hide filters"}
              >
                {filtersCollapsed ? '▼ Show' : '▲ Hide'}
              </button>
              <button
                className="btn btn-outline-primary btn-sm saved-search-btn"
                onClick={() => setShowSavedSearches(!showSavedSearches)}
                title={savedSearches.length > 0 ? `${savedSearches.length} saved searches` : 'No saved searches'}
              >
                {savedSearches.length > 0 ? (
                  <span className="icon-overlay">
                    <span className="icon-base">📋</span>
                    <span className="icon-top">🔍</span>
                  </span>
                ) : '🔍'}
                {savedSearches.length > 0 && ` (${savedSearches.length})`}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowSaveModal(true)}
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
            {/* Row 1: Keyword | Age Range | Height Range | Body Type */}
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
                    <label>Height Range</label>
                    <input
                      type="number"
                      className="form-control"
                      name="heightMin"
                      value={searchCriteria.heightMin}
                      onChange={handleInputChange}
                      min="48"
                      max="84"
                      placeholder="Min"
                    />
                  </div>
                </div>
                <div className="col-height-max">
                  <div className="form-group">
                    <label>&nbsp;</label>
                    <input
                      type="number"
                      className="form-control"
                      name="heightMax"
                      value={searchCriteria.heightMax}
                      onChange={handleInputChange}
                      min="48"
                      max="84"
                      placeholder="Max"
                    />
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

            {/* Row 2: Education | Occupation | Eating | Drinking | Smoking */}
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
              </div>
            </div>

            {/* Row 3: Location | Days Back */}
            <div className="filter-section">
              <div className="row filter-row-3">
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
              
              <label htmlFor="perPage" className="per-page-label">Show:</label>
              <select 
                id="perPage"
                className="form-select form-select-sm per-page-select"
                value={recordsPerPage}
                onChange={(e) => {
                  setRecordsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value="10">10 per page</option>
                <option value="20">20 per page</option>
                <option value="50">50 per page</option>
                <option value="100">100 per page</option>
              </select>
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

          <div className={`${viewMode === 'cards' ? 'results-grid' : 'results-rows'} ${showGridLines ? 'with-grid-lines' : ''}`}>
            {currentRecords.map((user) => {
              const isOnline = onlineUsers.has(user.username);
              
              // Row View
              if (viewMode === 'rows') {
                return (
                  <div key={user.username} className="result-row">
                    <div className="row-content" onClick={() => navigate(`/profile/${user.username}`)}>
                      <div className="row-image">
                        {renderProfileImage(user)}
                      </div>
                      <div className="row-info">
                        <div className="row-header">
                          <h5 className="row-name">{getDisplayName(user)}</h5>
                          <div className="row-badges">
                            {isOnline && <OnlineStatusBadge username={user.username} size="small" />}
                            {user.dob && <span className="age-badge">{calculateAge(user.dob)} years</span>}
                          </div>
                        </div>
                        <div className="row-details">
                          <span><strong>📍</strong> {user.location}</span>
                          <span><strong>🎓</strong> {user.education}</span>
                          <span><strong>💼</strong> {user.occupation}</span>
                          <span><strong>📏</strong> {user.height}</span>
                        </div>
                      </div>
                      <div className="row-actions">
                        <button
                          className={`btn btn-sm ${favoritedUsers.has(user.username) ? 'btn-warning' : 'btn-outline-warning'}`}
                          onClick={(e) => handleProfileAction(e, user.username, 'favorite')}
                          title={favoritedUsers.has(user.username) ? 'Remove from Favorites' : 'Add to Favorites'}
                        >
                          {favoritedUsers.has(user.username) ? '⭐' : '☆'}
                        </button>
                        <button
                          className={`btn btn-sm ${shortlistedUsers.has(user.username) ? 'btn-info' : 'btn-outline-info'}`}
                          onClick={(e) => handleProfileAction(e, user.username, 'shortlist')}
                          title={shortlistedUsers.has(user.username) ? 'Remove from Shortlist' : 'Add to Shortlist'}
                        >
                          📋
                        </button>
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={(e) => handleProfileAction(e, user.username, 'message')}
                          title="Send Message"
                        >
                          💬
                        </button>
                        <button
                          className={`btn btn-sm ${excludedUsers.has(user.username) ? 'btn-danger' : 'btn-outline-danger'}`}
                          onClick={(e) => handleProfileAction(e, user.username, 'exclude')}
                          title={excludedUsers.has(user.username) ? 'Remove from Exclusions' : 'Exclude from Search'}
                        >
                          {excludedUsers.has(user.username) ? '🚫' : '❌'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }
              
              // Card View (existing)
              return (
              <div key={user.username} className="result-card">
                <div className="card">
                  {/* Card Title Section with Purple Gradient */}
                  <div className="card-title-section">
                    <h6 className="card-title">
                      {getDisplayName(user)}
                    </h6>
                    <span className="age-badge">{calculateAge(user.dob)} years</span>
                  </div>

                  <div className="card-body">
                    <div className="d-flex gap-3 mb-3">
                      <div className="profile-image-left">
                        {renderProfileImage(user)}
                      </div>

                      <div className="user-details-right flex-grow-1">
                        <div className="user-details">
                          <p><strong>📍</strong> {user.location}</p>
                          <p><strong>🎓</strong> {user.education}</p>
                          <p><strong>💼</strong> {user.occupation}</p>
                          <p><strong>📏</strong> {user.height}</p>

                          <div className="pii-section">
                            <p><strong>📧</strong> Email:
                              {hasPiiAccess(user.username, 'contact_info') ? (
                                <span className="pii-data"> {user.contactEmail}</span>
                              ) : (
                                <span className="pii-masked"> [Request Access] </span>
                              )}
                              {!hasPiiAccess(user.username, 'contact_info') && (
                                <button
                                  className="btn btn-sm btn-link pii-request-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    requestPiiAccess(user.username, 'contact_info');
                                  }}
                                  disabled={isPiiRequestPending(user.username, 'contact_info')}
                                >
                                  {isPiiRequestPending(user.username, 'contact_info') ? 'Pending' : 'Request'}
                                </button>
                              )}
                            </p>
                            <p><strong>📱</strong> Phone:
                              {hasPiiAccess(user.username, 'contact_info') ? (
                                <span className="pii-data"> {user.contactNumber}</span>
                              ) : (
                                <span className="pii-masked"> [Request Access] </span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="user-badges">
                          {user.religion && <span className="badge bg-info">{user.religion}</span>}
                          {user.eatingPreference && <span className="badge bg-success">{user.eatingPreference}</span>}
                          {user.bodyType && <span className="badge bg-warning">{user.bodyType}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="card-actions mt-3">
                      <button
                        className={`btn btn-sm ${favoritedUsers.has(user.username) ? 'btn-warning' : 'btn-outline-warning'} action-btn`}
                        onClick={(e) => handleProfileAction(e, user.username, 'favorite')}
                        title={favoritedUsers.has(user.username) ? 'Remove from Favorites' : 'Add to Favorites'}
                      >
                        {favoritedUsers.has(user.username) ? '⭐' : '☆'}
                      </button>
                      <button
                        className={`btn btn-sm ${shortlistedUsers.has(user.username) ? 'btn-info' : 'btn-outline-info'} action-btn`}
                        onClick={(e) => handleProfileAction(e, user.username, 'shortlist')}
                        title={shortlistedUsers.has(user.username) ? 'Remove from Shortlist' : 'Add to Shortlist'}
                      >
                        {shortlistedUsers.has(user.username) ? '📋' : '📋'}
                      </button>
                      <button
                        className="btn btn-sm btn-outline-primary action-btn"
                        onClick={(e) => handleProfileAction(e, user.username, 'message')}
                        title="Send Message"
                      >
                        💬
                      </button>
                      <button
                        className={`btn btn-sm ${excludedUsers.has(user.username) ? 'btn-danger' : 'btn-outline-danger'} action-btn`}
                        onClick={(e) => handleProfileAction(e, user.username, 'exclude')}
                        title={excludedUsers.has(user.username) ? 'Remove from Exclusions' : 'Exclude from Search'}
                      >
                        {excludedUsers.has(user.username) ? '🚫' : '❌'}
                      </button>
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => navigate(`/profile/${user.username}`)}
                      >
                        View Profile
                      </button>
                    </div>
                  </div>
                </div>
              </div>
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
    </div>
  );
};

export default SearchPage;
