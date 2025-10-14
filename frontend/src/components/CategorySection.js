import React, { useState } from 'react';
import './CategorySection.css';

/**
 * CategorySection - Reusable collapsible section component
 * 
 * Used for Dashboard sections like "My Messages", "My Favorites", etc.
 * 
 * Features:
 * - Collapsible header
 * - Drag & drop support
 * - Card/Row view modes
 * - Empty state handling
 * - Customizable colors
 * 
 * Usage:
 * <CategorySection
 *   title="My Favorites"
 *   icon="⭐"
 *   color="#ff6b6b"
 *   data={favorites}
 *   onRender={(user, index) => <UserCard user={user} />}
 *   isDraggable={true}
 * />
 */
const CategorySection = ({
  title,
  icon,
  color = '#667eea',
  data = [],
  sectionKey,
  isExpanded = true,
  onToggle,
  onRender, // Function to render each item
  isDraggable = false,
  viewMode = 'cards', // 'cards' or 'rows'
  emptyMessage,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  draggedIndex,
  dragOverIndex
}) => {
  
  const [localDraggedIndex, setLocalDraggedIndex] = useState(null);
  const [localDragOverIndex, setLocalDragOverIndex] = useState(null);

  const handleToggle = () => {
    if (onToggle) {
      onToggle(sectionKey);
    }
  };

  const handleDragStart = (e, index) => {
    if (!isDraggable) return;
    setLocalDraggedIndex(index);
    if (onDragStart) {
      onDragStart(e, index, sectionKey);
    }
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setLocalDraggedIndex(null);
    setLocalDragOverIndex(null);
    if (onDragEnd) {
      onDragEnd(e);
    }
  };

  const handleDragOver = (e, index) => {
    if (!isDraggable) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if ((draggedIndex !== undefined ? draggedIndex : localDraggedIndex) !== index) {
      setLocalDragOverIndex(index);
      if (onDragOver) {
        onDragOver(e, index);
      }
    }
  };

  const handleDragLeave = () => {
    setLocalDragOverIndex(null);
  };

  const handleDrop = (e, index) => {
    if (!isDraggable) return;
    e.preventDefault();
    setLocalDragOverIndex(null);
    if (onDrop) {
      onDrop(e, index, sectionKey);
    }
  };

  const count = data.length;
  const currentDraggedIndex = draggedIndex !== undefined ? draggedIndex : localDraggedIndex;
  const currentDragOverIndex = dragOverIndex !== undefined ? dragOverIndex : localDragOverIndex;

  return (
    <div className="category-section">
      {/* Header */}
      <div 
        className="category-section-header"
        onClick={handleToggle}
        style={{ backgroundColor: color }}
      >
        <div className="category-section-title">
          <span className="category-icon">{icon}</span>
          <h3>{title}</h3>
          <span className="category-count">{count}</span>
          {isDraggable && viewMode === 'cards' && count > 1 && (
            <span className="drag-hint" title="Drag to reorder">⇅</span>
          )}
        </div>
        <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="category-section-content">
          {data.length > 0 ? (
            <div className={viewMode === 'cards' ? 'category-cards-grid' : 'category-cards-rows'}>
              {data.map((item, index) => {
                const isDragging = isDraggable && currentDraggedIndex === index;
                const isDragOver = isDraggable && currentDragOverIndex === index;
                
                return (
                  <div
                    key={typeof item === 'string' ? item : item.username || item.id || index}
                    draggable={isDraggable && viewMode === 'cards'}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`category-item-wrapper ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
                    style={{ cursor: isDraggable && viewMode === 'cards' ? 'move' : 'default' }}
                  >
                    {onRender ? onRender(item, index) : (
                      <div className="category-item-fallback">
                        {typeof item === 'string' ? item : JSON.stringify(item)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="category-empty-state">
              <p>{emptyMessage || `No ${title.toLowerCase()} yet`}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CategorySection;
