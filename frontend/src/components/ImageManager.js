import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { getImageUrl } from '../utils/urlHelper';
import api from '../api';
import './ImageManager.css';

const ImageManager = ({ existingImages, setExistingImages, imagesToDelete, setImagesToDelete, newImages, setNewImages, onError, username, isEditMode }) => {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [allImages, setAllImages] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [showLightbox, setShowLightbox] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState(null); // Track which image is in delete-confirm state
  
  // Merge existing and new images for unified display
  useEffect(() => {
    const combined = [
      ...existingImages.map(url => ({ type: 'existing', url })),
      ...newImages.map((file, idx) => ({ type: 'new', file, preview: URL.createObjectURL(file), id: `new-${idx}` }))
    ];
    setAllImages(combined);
    
    // Reset unsaved changes flag when new images are cleared (after successful save)
    if (newImages.length === 0 && hasUnsavedChanges) {
      setHasUnsavedChanges(false);
    }
    
    // Cleanup preview URLs on unmount
    return () => {
      newImages.forEach(file => {
        if (file.preview) URL.revokeObjectURL(file.preview);
      });
    };
  }, [existingImages, newImages, hasUnsavedChanges]);

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

  // Handle drag leave
  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  // Handle drop
  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDragOverIndex(null);
      return;
    }

    // Reorder allImages and split back into existing and new
    const reordered = [...allImages];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(dropIndex, 0, removed);
    
    // Split back into existing and new
    const existing = reordered.filter(img => img.type === 'existing').map(img => img.url);
    const newFiles = reordered.filter(img => img.type === 'new').map(img => img.file);
    
    setExistingImages(existing);
    setNewImages(newFiles);
    setDragOverIndex(null);
    setHasUnsavedChanges(true); // Mark as unsaved
  };

  // Handle remove image with 2-click delete pattern
  const handleRemove = async (image, index) => {
    if (image.type === 'existing') {
      // Auto-delete if in edit mode with 2-click pattern
      if (isEditMode && username) {
        // First click: Set to confirm state
        if (deleteConfirmIndex !== index) {
          setDeleteConfirmIndex(index);
          // Auto-reset after 3 seconds
          setTimeout(() => {
            setDeleteConfirmIndex(null);
          }, 3000);
          return;
        }
        
        // Second click: Actually delete
        setDeleteConfirmIndex(null);
        setSaving(true);
        
        try {
          // Remove from local array first for immediate UI feedback
          const remainingImages = existingImages.filter(img => img !== image.url);
          
          // Call API to delete
          await api.put(`/profile/${username}/delete-photo`, {
            imageToDelete: image.url,
            remainingImages: remainingImages
          });
          
          // Update state after successful deletion
          setExistingImages(remainingImages);
          setHasUnsavedChanges(false);
          
          if (onError) {
            onError('✅ Photo deleted successfully!');
          }
          console.log('✅ Photo auto-deleted from server');
        } catch (error) {
          console.error('❌ Failed to delete photo:', error);
          if (onError) {
            onError('❌ Failed to delete photo. Please try again.');
          }
        } finally {
          setSaving(false);
        }
      } else {
        // Not in edit mode, just mark for deletion
        setImagesToDelete(prev => [...prev, image.url]);
        setExistingImages(prev => prev.filter(img => img !== image.url));
        setHasUnsavedChanges(true);
      }
    } else {
      // Remove from new images (not yet saved)
      setNewImages(prev => prev.filter(file => file !== image.file));
    }
  };

  // Move image (for mobile/accessibility)
  const moveImage = (index, direction) => {
    const newIndex = direction === 'left' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= allImages.length) return;

    const reordered = [...allImages];
    const [removed] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, removed);
    
    // Split back into existing and new
    const existing = reordered.filter(img => img.type === 'existing').map(img => img.url);
    const newFiles = reordered.filter(img => img.type === 'new').map(img => img.file);
    
    setExistingImages(existing);
    setNewImages(newFiles);
    setHasUnsavedChanges(true); // Mark as unsaved
  };

  // Set as profile picture (move to first position) with auto-save
  const setAsProfilePic = async (index) => {
    console.log('🌟 setAsProfilePic called with index:', index);
    
    if (index === 0) {
      console.log('⚠️ Image is already profile picture');
      if (onError) {
        onError('ℹ️ This image is already your profile picture!');
      }
      return; // Already profile pic
    }
    
    const reordered = [...allImages];
    console.log('📸 Total images before reorder:', reordered.length);
    
    const [removed] = reordered.splice(index, 1);
    reordered.unshift(removed);
    console.log('✅ Reordered images, moved index', index, 'to position 0');
    
    // Split back into existing and new
    const existing = reordered.filter(img => img.type === 'existing').map(img => img.url);
    const newFiles = reordered.filter(img => img.type === 'new').map(img => img.file);
    
    console.log('📊 After split - Existing:', existing.length, 'New:', newFiles.length);
    console.log('🎯 New profile picture:', existing[0]);
    
    // Auto-save if in edit mode
    if (isEditMode && username && existing.length > 0) {
      setSaving(true);
      try {
        await api.put(`/profile/${username}/reorder-photos`, {
          imageOrder: existing
        });
        
        setExistingImages(existing);
        setNewImages(newFiles);
        setHasUnsavedChanges(false);
        
        if (onError) {
          onError('✅ Profile picture updated successfully!');
        }
        console.log('✅ Profile picture auto-saved to server');
      } catch (error) {
        console.error('❌ Failed to save profile picture:', error);
        if (onError) {
          onError('❌ Failed to save profile picture. Please try again.');
        }
      } finally {
        setSaving(false);
      }
    } else {
      // Not in edit mode, just reorder locally
      setExistingImages(existing);
      setNewImages(newFiles);
      setHasUnsavedChanges(true);
      
      if (onError) {
        onError('✅ Profile picture changed! Click "💾 Save Changes" button below to save.');
      }
    }
  };
  
  // Handle new image upload with auto-save
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    const totalImages = allImages.length + files.length;
    
    if (totalImages > 5) {
      if (onError) onError('❌ Maximum 5 photos allowed. Please remove some photos first.');
      return;
    }
    
    // Validate file sizes (5MB each)
    for (let file of files) {
      if (file.size > 5 * 1024 * 1024) {
        if (onError) onError(`❌ File "${file.name}" is too large. Maximum 5MB per photo.`);
        e.target.value = '';
        return;
      }
    }
    
    // Auto-upload if in edit mode
    if (isEditMode && username) {
      setUploading(true);
      try {
        const formData = new FormData();
        files.forEach(file => formData.append('images', file));
        
        // Include existing images to maintain order
        formData.append('existingImages', JSON.stringify(existingImages));
        
        console.log('📤 Auto-uploading', files.length, 'photos...');
        const response = await api.post(`/profile/${username}/upload-photos`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        // Update with new image URLs from server
        setExistingImages(response.data.images);
        setNewImages([]); // Clear new images since they're now saved
        setHasUnsavedChanges(false);
        
        if (onError) {
          onError(`✅ ${files.length} photo${files.length > 1 ? 's' : ''} uploaded successfully!`);
        }
        console.log('✅ Photos auto-uploaded:', response.data.images.length);
      } catch (error) {
        console.error('❌ Auto-upload failed:', error);
        if (onError) {
          onError('❌ Upload failed: ' + (error.response?.data?.detail || error.message));
        }
      } finally {
        setUploading(false);
      }
    } else {
      // Not in edit mode, add to newImages for later upload
      setNewImages(prev => [...prev, ...files]);
      setHasUnsavedChanges(true);
      
      if (onError) {
        onError(`📸 ${files.length} photo${files.length > 1 ? 's' : ''} selected. Click "Save Changes" to upload.`);
      }
    }
    
    e.target.value = ''; // Reset input
  };

  return (
    <div className="image-manager">
      <div className="image-manager-header">
        <h5>📸 Manage Your Photos</h5>
        <p className="text-muted">
          <small>
            💡 <strong>Tip:</strong> Drag to reorder • First photo = Profile picture • Click star to set as profile pic
          </small>
        </p>
      </div>
      
      {/* Upload/Save Status Banner */}
      {uploading && (
        <div className="upload-status-banner uploading">
          <span className="spinner"></span> Uploading photos...
        </div>
      )}
      {saving && (
        <div className="upload-status-banner saving">
          <span className="spinner"></span> Saving changes...
        </div>
      )}
      {hasUnsavedChanges && !uploading && !saving && !isEditMode && (
        <div className="unsaved-changes-banner">
          ⚠️ You have unsaved changes! Click "Save Changes" button below to update your photos.
        </div>
      )}

      {/* File Upload Section */}
      <div className="upload-section">
        <label htmlFor="image-upload" className="upload-button">
          <span className="upload-icon">📤</span>
          <span>Upload New Photos</span>
          <small>({allImages.length}/5)</small>
        </label>
        <input
          id="image-upload"
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          disabled={allImages.length >= 5 || uploading}
        />
      </div>

      {allImages.length === 0 ? (
        <div className="no-images-message">
          <span className="no-images-icon">🖼️</span>
          <p>No images uploaded yet</p>
          <small className="text-muted">Click "Upload New Photos" above to get started</small>
        </div>
      ) : (
        <div className="image-grid">
          {allImages.map((img, index) => {
            const imageUrl = img.type === 'existing' ? getImageUrl(img.url) : img.preview;
            const isNew = img.type === 'new';
            
            return (
              <div
                key={img.type === 'existing' ? img.url : img.id}
                className={`image-card ${index === 0 ? 'profile-pic' : ''} ${dragOverIndex === index ? 'drag-over' : ''} ${isNew ? 'new-upload' : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
              >
                {/* Image Preview */}
                <div 
                  className="image-preview"
                  onClick={(e) => {
                    // Only open lightbox if not clicking on control buttons
                    if (!e.target.closest('.image-controls')) {
                      e.stopPropagation();
                      setLightboxImage(imageUrl);
                      setShowLightbox(true);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                  title="Click to enlarge"
                >
                  <img
                    src={imageUrl}
                    alt={`${index + 1}`}
                    loading="lazy"
                  />
                  
                  {/* New Upload Badge */}
                  {isNew && (
                    <div className="new-badge">
                      🆕 New
                    </div>
                  )}
                  
                  {/* Profile Pic Badge */}
                  {index === 0 && (
                    <div className="profile-pic-badge">
                      ⭐ Profile Picture
                    </div>
                  )}
                  
                  {/* Photo Number */}
                  <div className="photo-number">
                    {index + 1}
                  </div>
                </div>

                {/* Controls */}
                <div 
                  className="image-controls"
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Set as Profile Pic Button */}
                  {index !== 0 && (
                    <button
                      type="button"
                      className="btn-control btn-profile-pic"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('⭐ Profile pic button clicked for index:', index);
                        setAsProfilePic(index);
                      }}
                      title="Set as profile picture"
                      draggable={false}
                    >
                      ⭐
                    </button>
                  )}
                  
                  {/* Move Left Button */}
                  {index > 0 && (
                    <button
                      type="button"
                      className="btn-control btn-move"
                      onClick={() => moveImage(index, 'left')}
                      title="Move left"
                    >
                      ◀
                    </button>
                  )}
                  
                  {/* Move Right Button */}
                  {index < allImages.length - 1 && (
                    <button
                      type="button"
                      className="btn-control btn-move"
                      onClick={() => moveImage(index, 'right')}
                      title="Move right"
                    >
                      ▶
                    </button>
                  )}
                  
                  {/* Delete Button */}
                  <button
                    type="button"
                    className="btn-control btn-delete"
                    onClick={() => handleRemove(img)}
                    title="Delete photo"
                  >
                    🗑️
                  </button>
                </div>

                {/* Drag Handle Hint */}
                <div className="drag-handle">
                  ⋮⋮
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Photo Tips */}
      <div className="photo-tips">
        <h6>📋 Photo Guidelines:</h6>
        <ul>
          <li>✅ <strong>First photo</strong> appears as your profile picture in search results</li>
          <li>✅ Upload <strong>clear, well-lit</strong> photos showing your face</li>
          <li>✅ Include variety: close-up, full body, hobbies, lifestyle</li>
          <li>✅ <strong>Maximum 5 photos</strong> - quality over quantity!</li>
          <li>❌ Avoid group photos, heavy filters, or unclear images</li>
        </ul>
      </div>

      {/* Image Lightbox Modal - Rendered at document body level using Portal */}
      {showLightbox && lightboxImage && ReactDOM.createPortal(
        <div 
          className="image-lightbox-overlay"
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
            cursor: 'pointer',
            padding: '20px'
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
            src={lightboxImage} 
            alt="Enlarged view"
            className="lightbox-image"
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              transform: 'none !important',
              top: 'auto !important',
              left: 'auto !important',
              right: 'auto !important',
              bottom: 'auto !important'
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body
      )}
    </div>
  );
};

export default ImageManager;
