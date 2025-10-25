import React, { useState, useEffect } from 'react';
import { getImageUrl } from '../utils/urlHelper';
import './ImageManager.css';

const ImageManager = ({ existingImages, setExistingImages, imagesToDelete, setImagesToDelete, newImages, setNewImages, onError }) => {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [allImages, setAllImages] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
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

  // Handle remove image
  const handleRemove = (image) => {
    if (image.type === 'existing') {
      setImagesToDelete(prev => [...prev, image.url]);
      setExistingImages(prev => prev.filter(img => img !== image.url));
      setHasUnsavedChanges(true); // Mark as unsaved
    } else {
      // Remove from new images
      setNewImages(prev => prev.filter(file => file !== image.file));
      // Don't mark as unsaved if removing a new (not yet saved) image
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

  // Set as profile picture (move to first position)
  const setAsProfilePic = (index) => {
    if (index === 0) return; // Already profile pic
    
    const reordered = [...allImages];
    const [removed] = reordered.splice(index, 1);
    reordered.unshift(removed);
    
    // Split back into existing and new
    const existing = reordered.filter(img => img.type === 'existing').map(img => img.url);
    const newFiles = reordered.filter(img => img.type === 'new').map(img => img.file);
    
    setExistingImages(existing);
    setNewImages(newFiles);
    setHasUnsavedChanges(true); // Mark as unsaved
  };
  
  // Handle new image upload
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const totalImages = allImages.length + files.length;
    
    if (totalImages > 5) {
      if (onError) onError('❌ Maximum 5 photos allowed. Please remove some photos first.');
      return;
    }
    
    setNewImages(prev => [...prev, ...files]);
    setHasUnsavedChanges(true); // Mark as unsaved
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
      
      {/* Unsaved Changes Banner */}
      {hasUnsavedChanges && (
        <div className="unsaved-changes-banner">
          ⚠️ You have unsaved changes! Click "Save Changes" button below to update your profile picture.
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
          disabled={allImages.length >= 5}
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
                <div className="image-preview">
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
                <div className="image-controls">
                  {/* Set as Profile Pic Button */}
                  {index !== 0 && (
                    <button
                      type="button"
                      className="btn-control btn-profile-pic"
                      onClick={() => setAsProfilePic(index)}
                      title="Set as profile picture"
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
    </div>
  );
};

export default ImageManager;
