import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import SearchResultCard from './SearchResultCard';
import './SearchPage.css';
import './MyLists.css';

const MyLists = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get initial tab from URL or default to 'favorites'
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'favorites');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'rows'
  
  // Drag and drop states
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  
  // Data states
  const [favorites, setFavorites] = useState([]);
  const [shortlist, setShortlist] = useState([]);
  const [exclusions, setExclusions] = useState([]);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [piiRequests, setPiiRequests] = useState({});

  const currentUsername = localStorage.getItem('username');

  useEffect(() => {
    if (!currentUsername) {
      navigate('/login');
      return;
    }
    loadAllData();
    loadPiiRequests();
  }, []);

  // Update URL when tab changes
  useEffect(() => {
    setSearchParams({ tab: activeTab });
  }, [activeTab, setSearchParams]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [favResponse, shortlistResponse, exclusionsResponse] = await Promise.all([
        api.get(`/favorites/${currentUsername}`),
        api.get(`/shortlist/${currentUsername}`),
        api.get(`/exclusions/${currentUsername}`)
      ]);
      
      setFavorites(favResponse.data.favorites || []);
      setShortlist(shortlistResponse.data.shortlist || []);
      setExclusions(exclusionsResponse.data.exclusions || []);
    } catch (err) {
      console.error('Error loading lists:', err);
      setError('Failed to load lists');
    } finally {
      setLoading(false);
    }
  };

  const loadPiiRequests = async () => {
    if (!currentUsername) return;

    try {
      const [requestsResponse, accessResponse] = await Promise.all([
        api.get(`/pii-requests/${currentUsername}/outgoing`),
        api.get(`/pii-access/${currentUsername}/received`)
      ]);

      const requests = requestsResponse.data.requests || [];
      const receivedAccess = accessResponse.data.receivedAccess || [];
      const requestStatus = {};

      requests.forEach(req => {
        const targetUsername = req.profileUsername || req.requestedUsername;
        requestStatus[`${targetUsername}_${req.requestType}`] = req.status;
      });

      receivedAccess.forEach(access => {
        const targetUsername = access.userProfile.username;
        access.accessTypes.forEach(accessType => {
          requestStatus[`${targetUsername}_${accessType}`] = 'approved';
        });
      });

      setPiiRequests(requestStatus);
    } catch (err) {
      console.error('Error loading PII requests:', err);
    }
  };

  const hasPiiAccess = (targetUsername) => {
    return piiRequests[`${targetUsername}_contact_info`] === 'approved';
  };

  const hasImageAccess = (targetUsername) => {
    return piiRequests[`${targetUsername}_images`] === 'approved';
  };

  const isPiiRequestPending = (targetUsername) => {
    return piiRequests[`${targetUsername}_contact_info`] === 'pending';
  };

  const isImageRequestPending = (targetUsername) => {
    return piiRequests[`${targetUsername}_images`] === 'pending';
  };

  const handlePIIRequest = (user) => {
    navigate(`/profile/${user.username}`);
  };

  const handleMessage = (user) => {
    navigate(`/messages?user=${user.username}`);
  };

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    if (viewMode !== 'cards') return; // Only allow dragging in card view
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget);
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      return;
    }

    // Get the current list data based on active tab
    let currentData = [];
    let setCurrentData = null;

    switch (activeTab) {
      case 'favorites':
        currentData = [...favorites];
        setCurrentData = setFavorites;
        break;
      case 'shortlist':
        currentData = [...shortlist];
        setCurrentData = setShortlist;
        break;
      case 'exclusions':
        currentData = [...exclusions];
        setCurrentData = setExclusions;
        break;
      default:
        return;
    }

    // Reorder the array
    const draggedItem = currentData[draggedIndex];
    currentData.splice(draggedIndex, 1);
    currentData.splice(dropIndex, 0, draggedItem);

    // Update state
    setCurrentData(currentData);
    setDragOverIndex(null);
    setStatusMessage(`✅ Reordered successfully!`);
    setTimeout(() => setStatusMessage(''), 2000);
  };

  const removeFromFavorites = async (user) => {
    try {
      await api.delete(`/favorites/${user.username}?username=${encodeURIComponent(currentUsername)}`);
      setFavorites(favorites.filter(fav => fav.username !== user.username));
      setStatusMessage('✅ Removed from favorites!');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err) {
      console.error('Error removing from favorites:', err);
      setStatusMessage('❌ Failed to remove from favorites');
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  const removeFromShortlist = async (user) => {
    try {
      await api.delete(`/shortlist/${user.username}?username=${encodeURIComponent(currentUsername)}`);
      setShortlist(shortlist.filter(item => item.username !== user.username));
      setStatusMessage('✅ Removed from shortlist!');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err) {
      console.error('Error removing from shortlist:', err);
      setStatusMessage('❌ Failed to remove from shortlist');
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  const removeExclusion = async (user) => {
    try {
      const targetUsername = typeof user === 'string' ? user : user.username;
      await api.delete(`/exclusions/${targetUsername}?username=${encodeURIComponent(currentUsername)}`);
      
      setExclusions(prev => prev.filter(item => {
        const itemUsername = typeof item === 'string' ? item : item.username;
        return itemUsername !== targetUsername;
      }));
      
      setStatusMessage('✅ Removed from exclusions!');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err) {
      console.error('Error removing exclusion:', err);
      setStatusMessage('❌ Failed to remove exclusion');
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  const renderUserCard = (user, onRemove, removeIcon, removeLabel, isExcluded = false) => {
    return (
      <SearchResultCard
        key={user.username}
        user={user}
        currentUsername={currentUsername}
        onRemove={onRemove}
        onMessage={handleMessage}
        onPIIRequest={handlePIIRequest}
        isFavorited={activeTab === 'favorites'}
        isShortlisted={activeTab === 'shortlist'}
        isExcluded={isExcluded}
        hasPiiAccess={hasPiiAccess(user.username)}
        hasImageAccess={hasImageAccess(user.username)}
        isPiiRequestPending={isPiiRequestPending(user.username)}
        isImageRequestPending={isImageRequestPending(user.username)}
        showFavoriteButton={false}
        showShortlistButton={false}
        showExcludeButton={false}
        showRemoveButton={true}
        removeButtonLabel={removeLabel}
        removeButtonIcon={removeIcon}
        viewMode={viewMode}
      />
    );
  };

  const renderSimpleExclusionCard = (user) => {
    return (
      <div key={user.username} className="result-card">
        <div className="card">
          <div className="card-title-section">
            <h6 className="card-title">{user.username}</h6>
          </div>
          <div className="card-body">
            <p className="text-muted mb-3">This profile is excluded from search results</p>
            <div className="card-actions">
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={() => removeExclusion(user)}
              >
                Remove Exclusion
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
  };

  const renderContent = () => {
    let data = [];
    let onRemove = null;
    let removeIcon = '';
    let removeLabel = '';
    let emptyMessage = '';

    switch (activeTab) {
      case 'favorites':
        data = favorites;
        onRemove = removeFromFavorites;
        removeIcon = '⭐';
        removeLabel = 'Remove from Favorites';
        emptyMessage = 'No favorites yet. Start browsing and add profiles you like!';
        break;
      case 'shortlist':
        data = shortlist;
        onRemove = removeFromShortlist;
        removeIcon = '📋';
        removeLabel = 'Remove from Shortlist';
        emptyMessage = 'No profiles in shortlist yet. Add profiles you\'re considering!';
        break;
      case 'exclusions':
        data = exclusions;
        onRemove = removeExclusion;
        removeIcon = '🚫';
        removeLabel = 'Remove Exclusion';
        emptyMessage = 'No excluded profiles. These profiles will be hidden from your search results.';
        break;
      default:
        data = [];
    }

    if (loading) {
      return (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading...</p>
        </div>
      );
    }

    if (data.length === 0) {
      return (
        <div className="alert alert-info">
          <p className="mb-0">{emptyMessage}</p>
        </div>
      );
    }

    const containerClass = viewMode === 'cards' ? 'results-grid' : 'results-rows';

    return (
      <div className={containerClass}>
        {data.map((item, index) => {
          const user = typeof item === 'string' ? { username: item } : item;
          const isFullProfile = typeof item !== 'string';
          const isDragging = draggedIndex === index;
          const isDragOver = dragOverIndex === index;
          
          // For exclusions with only username
          if (activeTab === 'exclusions' && !isFullProfile) {
            return renderSimpleExclusionCard(user);
          }
          
          return (
            <div
              key={user.username}
              draggable={viewMode === 'cards'}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              className={`draggable-card ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
              style={{ cursor: viewMode === 'cards' ? 'move' : 'default' }}
            >
              {renderUserCard(user, onRemove, removeIcon, removeLabel, activeTab === 'exclusions')}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="search-page">
      <div className="container-fluid">
        {/* Header with Title and View Toggle */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="mb-0">📋 My Lists</h2>
          
          {/* View Mode Toggle */}
          <div className="view-mode-toggle">
            <button
              className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setViewMode('cards')}
              title="Card View"
            >
              ⊞ Cards
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'rows' ? 'btn-primary' : 'btn-outline-secondary'} ms-2`}
              onClick={() => setViewMode('rows')}
              title="Row View"
            >
              ☰ Rows
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {statusMessage && (
          <div className={`alert ${statusMessage.includes('❌') ? 'alert-danger' : 'alert-success'} alert-dismissible fade show`}>
            {statusMessage}
            <button type="button" className="btn-close" onClick={() => setStatusMessage('')}></button>
          </div>
        )}

        {error && <div className="alert alert-danger">{error}</div>}

        {/* Tabs */}
        <ul className="nav nav-tabs mb-4">
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'favorites' ? 'active' : ''}`}
              onClick={() => setActiveTab('favorites')}
            >
              ⭐ Favorites
              <span className="badge bg-primary ms-2">{favorites.length}</span>
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'shortlist' ? 'active' : ''}`}
              onClick={() => setActiveTab('shortlist')}
            >
              📋 Shortlist
              <span className="badge bg-info ms-2">{shortlist.length}</span>
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'exclusions' ? 'active' : ''}`}
              onClick={() => setActiveTab('exclusions')}
            >
              ❌ Exclusions
              <span className="badge bg-danger ms-2">{exclusions.length}</span>
            </button>
          </li>
        </ul>

        {/* Tab Content */}
        {renderContent()}
      </div>
    </div>
  );
};

export default MyLists;
