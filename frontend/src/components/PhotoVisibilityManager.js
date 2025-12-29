import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { getImageUrl } from '../utils/urlHelper';
import api from '../api';
import './PhotoVisibilityManager.css';

/**
 * PhotoVisibilityManager - Unified Photo Management Component
 * 
 * Handles BOTH:
 * 1. Registration mode (!isEditMode): Collect files locally, return via getFilesForUpload()
 * 2. Edit mode (isEditMode): Manage visibility of existing images via API
 * 
 * Layout: [1] [2] [3] [4] [5] - 5 horizontal slots
 * 
 * Visibility options per photo:
 * - 👤 Profile Pic - Always visible to logged-in members (max 1)
 * - 👥 Member Visible - Visible to all logged-in members  
 * - 🔒 On Request - Requires PII access grant
 * 
 * Default behavior:
 * - 1st pic = Profile Pic (always visible)
 * - Remaining pics = Member Visible
 * - On Request = empty by default
 */
const PhotoVisibilityManager = ({ 
  existingImages = [],
  setExistingImages,
  newImages = [],
  setNewImages,
  onError, 
  username, 
  isEditMode = false,
  onVisibilityChange,
  getFilesForUploadRef
}) => {
  // Photos array with visibility info
  // Each item: { url: string, visibility: string, file?: File, isNew?: boolean }
  const [photos, setPhotos] = useState([]);
  
  // UI state
  const [lightboxImage, setLightboxImage] = useState(null);
  const [showLightbox, setShowLightbox] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState(null);
  const [localStatus, setLocalStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const showStatus = (type, message, duration = 4000) => {
    setLocalStatus({ type, message });
    setTimeout(() => setLocalStatus(null), duration);
  };

  // Expose method to get files for upload (used by Register2.js in registration mode)
  useEffect(() => {
    if (getFilesForUploadRef) {
      getFilesForUploadRef.current = () => {
        return photos.filter(p => p.isNew && p.file).map(p => p.file);
      };
    }
  }, [photos, getFilesForUploadRef]);

  // Load visibility settings from backend (edit mode only)
  const loadVisibility = useCallback(async () => {
    if (!username || !isEditMode) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await api.get(`/profile/${username}/image-visibility`);
      const data = response.data;
      
      const photosArray = [];
      
      if (data.profilePic) {
        photosArray.push({ url: data.profilePic, visibility: 'profilePic' });
      }
      
      (data.memberVisible || []).forEach(url => {
        photosArray.push({ url, visibility: 'memberVisible' });
      });
      
      (data.onRequest || []).forEach(url => {
        photosArray.push({ url, visibility: 'onRequest' });
      });
      
      setPhotos(photosArray);
    } catch (error) {
      // Fallback: compute from existingImages
      if (existingImages && existingImages.length > 0) {
        const photosArray = existingImages.map((url, idx) => ({
          url,
          visibility: idx === 0 ? 'profilePic' : 'memberVisible'
        }));
        setPhotos(photosArray);
      }
    } finally {
      setIsLoading(false);
    }
  }, [username, isEditMode, existingImages]);

  // Initialize photos from props (registration mode) or load from API (edit mode)
  useEffect(() => {
    if (isEditMode) {
      loadVisibility();
    } else {
      // Registration mode: build from existingImages + newImages
      const photosArray = [];
      
      existingImages.forEach((url, idx) => {
        photosArray.push({
          url,
          visibility: idx === 0 ? 'profilePic' : 'memberVisible',
          isNew: false
        });
      });
      
      newImages.forEach((file, idx) => {
        photosArray.push({
          url: URL.createObjectURL(file),
          visibility: photosArray.length === 0 ? 'profilePic' : 'memberVisible',
          file,
          isNew: true
        });
      });
      
      setPhotos(photosArray);
      setIsLoading(false);
    }
  }, [isEditMode, loadVisibility, existingImages, newImages]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      photos.forEach(p => {
        if (p.isNew && p.url.startsWith('blob:')) {
          URL.revokeObjectURL(p.url);
        }
      });
    };
  }, []);

  // Save visibility to backend (edit mode only)
  const saveVisibility = async (photosArray) => {
    if (!username || !isEditMode) return;
    
    const profilePic = photosArray.find(p => p.visibility === 'profilePic')?.url || null;
    const memberVisible = photosArray.filter(p => p.visibility === 'memberVisible').map(p => p.url);
    const onRequest = photosArray.filter(p => p.visibility === 'onRequest').map(p => p.url);
    
    setSaving(true);
    try {
      await api.put(`/profile/${username}/image-visibility`, {
        profilePic,
        memberVisible,
        onRequest
      });
      
      showStatus('success', '✅ Visibility updated!');
      
      if (onVisibilityChange) {
        onVisibilityChange({ profilePic, memberVisible, onRequest });
      }
    } catch (error) {
      showStatus('error', '❌ Failed to save: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  // Handle visibility change for a photo
  const handleVisibilityChange = async (index, newVisibility) => {
    const newPhotos = [...photos];
    const oldVisibility = newPhotos[index].visibility;
    
    // If changing TO profilePic, remove profilePic from any other photo
    if (newVisibility === 'profilePic') {
      newPhotos.forEach((p, i) => {
        if (p.visibility === 'profilePic' && i !== index) {
          p.visibility = 'memberVisible';
        }
      });
    }
    
    // If changing FROM profilePic, make first other photo profilePic
    if (oldVisibility === 'profilePic' && newVisibility !== 'profilePic') {
      const hasOtherProfilePic = newPhotos.some((p, i) => i !== index && p.visibility === 'profilePic');
      if (!hasOtherProfilePic && newPhotos.length > 1) {
        const firstOther = newPhotos.findIndex((p, i) => i !== index);
        if (firstOther !== -1) {
          newPhotos[firstOther].visibility = 'profilePic';
        }
      }
    }
    
    newPhotos[index].visibility = newVisibility;
    setPhotos(newPhotos);
    
    if (isEditMode) {
      await saveVisibility(newPhotos);
    }
  };

  // Handle drag start
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.5';
  };

  // Handle drag end
  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Handle drag over
  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  // Handle drop - reorder photos
  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    setDragOverIndex(null);
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }
    
    const newPhotos = [...photos];
    const [removed] = newPhotos.splice(draggedIndex, 1);
    newPhotos.splice(dropIndex, 0, removed);
    
    // If first photo changed, update visibility
    if (dropIndex === 0 || draggedIndex === 0) {
      newPhotos.forEach((p, i) => {
        if (i === 0) {
          p.visibility = 'profilePic';
        } else if (p.visibility === 'profilePic') {
          p.visibility = 'memberVisible';
        }
      });
    }
    
    setPhotos(newPhotos);
    setDraggedIndex(null);
    
    // Update parent state for registration mode
    if (!isEditMode && setNewImages) {
      const newFiles = newPhotos.filter(p => p.isNew && p.file).map(p => p.file);
      setNewImages(newFiles);
    }
    
    if (isEditMode) {
      await saveVisibility(newPhotos);
    }
  };

  // Handle delete photo
  const handleDeletePhoto = async (index) => {
    // 2-click delete pattern
    if (deleteConfirmIndex !== index) {
      setDeleteConfirmIndex(index);
      setTimeout(() => setDeleteConfirmIndex(null), 3000);
      return;
    }
    
    setDeleteConfirmIndex(null);
    const photoToDelete = photos[index];
    
    if (isEditMode) {
      // Edit mode: delete via API
      setSaving(true);
      try {
        const cleanImageUrl = photoToDelete.url.split('?')[0];
        const remainingPhotos = photos.filter((_, i) => i !== index);
        
        const response = await api.put(`/profile/${username}/delete-photo`, {
          imageToDelete: cleanImageUrl,
          remainingImages: remainingPhotos.map(p => p.url.split('?')[0])
        });
        
        const newVisibility = response.data.imageVisibility;
        if (newVisibility) {
          const updatedPhotos = [];
          if (newVisibility.profilePic) {
            updatedPhotos.push({ url: newVisibility.profilePic, visibility: 'profilePic' });
          }
          (newVisibility.memberVisible || []).forEach(url => {
            updatedPhotos.push({ url, visibility: 'memberVisible' });
          });
          (newVisibility.onRequest || []).forEach(url => {
            updatedPhotos.push({ url, visibility: 'onRequest' });
          });
          setPhotos(updatedPhotos);
          
          if (setExistingImages) {
            setExistingImages(updatedPhotos.map(p => p.url));
          }
        } else {
          if (photoToDelete.visibility === 'profilePic' && remainingPhotos.length > 0) {
            remainingPhotos[0].visibility = 'profilePic';
          }
          setPhotos(remainingPhotos);
          
          if (setExistingImages) {
            setExistingImages(remainingPhotos.map(p => p.url));
          }
        }
        
        showStatus('success', '✅ Photo deleted!');
      } catch (error) {
        showStatus('error', '❌ Failed to delete: ' + (error.response?.data?.detail || error.message));
      } finally {
        setSaving(false);
      }
    } else {
      // Registration mode: remove locally
      const remainingPhotos = photos.filter((_, i) => i !== index);
      
      // Revoke object URL if it's a new file
      if (photoToDelete.isNew && photoToDelete.url.startsWith('blob:')) {
        URL.revokeObjectURL(photoToDelete.url);
      }
      
      // Promote first remaining to profilePic if needed
      if (photoToDelete.visibility === 'profilePic' && remainingPhotos.length > 0) {
        remainingPhotos[0].visibility = 'profilePic';
      }
      
      setPhotos(remainingPhotos);
      
      // Update parent state
      if (setNewImages) {
        const newFiles = remainingPhotos.filter(p => p.isNew && p.file).map(p => p.file);
        setNewImages(newFiles);
      }
      
      showStatus('success', '✅ Photo removed!');
    }
  };

  // Handle file upload
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    
    if (photos.length + files.length > 5) {
      showStatus('error', '❌ Maximum 5 photos allowed');
      e.target.value = '';
      return;
    }
    
    for (let file of files) {
      if (file.size > 5 * 1024 * 1024) {
        showStatus('error', `❌ "${file.name}" is too large (max 5MB)`);
        e.target.value = '';
        return;
      }
    }
    
    if (isEditMode && username) {
      // Edit mode: upload immediately
      setUploading(true);
      try {
        const formData = new FormData();
        files.forEach(file => formData.append('images', file));
        
        const existingUrls = photos.map(p => p.url);
        formData.append('existingImages', JSON.stringify(existingUrls));
        
        const response = await api.post(`/profile/${username}/upload-photos`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        const newImageUrls = response.data.images.filter(img => !existingUrls.includes(img));
        const newPhotos = [...photos];
        
        newImageUrls.forEach(url => {
          const visibility = newPhotos.length === 0 ? 'profilePic' : 'memberVisible';
          newPhotos.push({ url, visibility });
        });
        
        setPhotos(newPhotos);
        
        if (setExistingImages) {
          setExistingImages(newPhotos.map(p => p.url));
        }
        
        await saveVisibility(newPhotos);
        showStatus('success', `✅ ${files.length} photo${files.length > 1 ? 's' : ''} uploaded!`);
      } catch (error) {
        showStatus('error', '❌ Upload failed: ' + (error.response?.data?.detail || error.message));
      } finally {
        setUploading(false);
        e.target.value = '';
      }
    } else {
      // Registration mode: collect files locally
      const newPhotos = [...photos];
      
      files.forEach(file => {
        newPhotos.push({
          url: URL.createObjectURL(file),
          visibility: newPhotos.length === 0 ? 'profilePic' : 'memberVisible',
          file,
          isNew: true
        });
      });
      
      setPhotos(newPhotos);
      
      // Update parent state
      if (setNewImages) {
        const allNewFiles = newPhotos.filter(p => p.isNew && p.file).map(p => p.file);
        setNewImages(allNewFiles);
      }
      
      showStatus('success', `✅ ${files.length} photo${files.length > 1 ? 's' : ''} added!`);
      e.target.value = '';
    }
  };

  // Get visibility icon and label
  const getVisibilityInfo = (visibility) => {
    switch (visibility) {
      case 'profilePic':
        return { icon: '👤', label: 'Profile Pic', color: 'var(--warning-color, #ffc107)' };
      case 'memberVisible':
        return { icon: '👥', label: 'Members', color: 'var(--success-color, #28a745)' };
      case 'onRequest':
        return { icon: '🔒', label: 'On Request', color: 'var(--primary-color, #6366f1)' };
      default:
        return { icon: '👥', label: 'Members', color: 'var(--success-color, #28a745)' };
    }
  };

  if (isLoading) {
    return (
      <div className="photo-visibility-manager loading">
        <div className="loading-spinner">Loading photos...</div>
      </div>
    );
  }

  return (
    <div className="photo-visibility-manager">
      <div className="manager-header">
        <h5>📸 Manage Your Photos</h5>
        <p className="tip">💡 Drag to reorder • Click visibility badge to change • First photo is your profile picture</p>
      </div>
      
      {/* Status Banners */}
      {uploading && (
        <div className="status-banner uploading">
          <span className="spinner"></span> Uploading...
        </div>
      )}
      {saving && (
        <div className="status-banner saving">
          <span className="spinner"></span> Saving...
        </div>
      )}
      {localStatus && (
        <div className={`status-banner ${localStatus.type}`}>
          {localStatus.message}
        </div>
      )}
      
      {/* 5-Slot Horizontal Grid */}
      <div className="photos-horizontal-grid">
        {/* Render existing photos */}
        {photos.map((photo, index) => {
          const displayUrl = photo.isNew ? photo.url : getImageUrl(photo.url);
          const visInfo = getVisibilityInfo(photo.visibility);
          const isConfirmDelete = deleteConfirmIndex === index;
          const isDragOver = dragOverIndex === index;
          
          return (
            <div
              key={photo.url}
              className={`photo-slot filled ${isConfirmDelete ? 'confirm-delete' : ''} ${isDragOver ? 'drag-over' : ''} ${photo.isNew ? 'new-upload' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
            >
              {/* Slot number */}
              <div className="slot-number">{index + 1}</div>
              
              {/* New badge */}
              {photo.isNew && <div className="new-badge">🆕</div>}
              
              {/* Photo */}
              <div 
                className="photo-preview"
                onClick={() => {
                  setLightboxImage(displayUrl);
                  setShowLightbox(true);
                }}
              >
                <img src={displayUrl} alt={`Photo ${index + 1}`} loading="lazy" />
              </div>
              
              {/* Visibility Badge/Dropdown */}
              <div className="visibility-control">
                <select
                  value={photo.visibility}
                  onChange={(e) => handleVisibilityChange(index, e.target.value)}
                  style={{ borderColor: visInfo.color }}
                  className={`visibility-select ${photo.visibility}`}
                >
                  <option value="profilePic">👤 Profile Pic</option>
                  <option value="memberVisible">👥 Members</option>
                  <option value="onRequest">🔒 On Request</option>
                </select>
              </div>
              
              {/* Delete Button */}
              <button
                type="button"
                className={`btn-delete ${isConfirmDelete ? 'confirm' : ''}`}
                onClick={() => handleDeletePhoto(index)}
                title={isConfirmDelete ? 'Click again to confirm' : 'Delete photo'}
              >
                {isConfirmDelete ? '⚠️' : '🗑️'}
              </button>
              
              {/* Drag Handle */}
              <div className="drag-handle">⋮⋮</div>
            </div>
          );
        })}
        
        {/* Empty slots with upload button */}
        {photos.length < 5 && (
          <label className="photo-slot empty" htmlFor="photo-upload">
            <div className="slot-number">{photos.length + 1}</div>
            <div className="upload-placeholder">
              <span className="upload-icon">➕</span>
              <span className="upload-text">Add Photo</span>
            </div>
            <input
              id="photo-upload"
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              disabled={photos.length >= 5 || uploading}
            />
          </label>
        )}
        
        {/* Remaining empty slots (visual only) */}
        {Array.from({ length: Math.max(0, 4 - photos.length) }).map((_, idx) => (
          <div key={`empty-${idx}`} className="photo-slot empty disabled">
            <div className="slot-number">{photos.length + 2 + idx}</div>
            <div className="empty-placeholder">
              <span>📷</span>
            </div>
          </div>
        ))}
      </div>
      
      {/* Legend */}
      <div className="visibility-legend">
        <div className="legend-item">
          <span className="legend-badge profilePic">👤</span>
          <span>Profile Pic - Always visible</span>
        </div>
        <div className="legend-item">
          <span className="legend-badge memberVisible">👥</span>
          <span>Members - All logged-in users</span>
        </div>
        <div className="legend-item">
          <span className="legend-badge onRequest">🔒</span>
          <span>On Request - Requires approval</span>
        </div>
      </div>
      
      {/* Lightbox */}
      {showLightbox && lightboxImage && ReactDOM.createPortal(
        <div 
          className="photo-lightbox-overlay"
          onClick={() => {
            setShowLightbox(false);
            setLightboxImage(null);
          }}
        >
          <button
            className="lightbox-close"
            onClick={(e) => {
              e.stopPropagation();
              setShowLightbox(false);
              setLightboxImage(null);
            }}
          >
            ✕
          </button>
          <img 
            src={lightboxImage} 
            alt="Enlarged view"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body
      )}
    </div>
  );
};

export default PhotoVisibilityManager;
