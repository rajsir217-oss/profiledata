/**
 * Virtual Scrolling Component for Large Datasets
 * Optimizes performance for rendering large lists
 */

import React, { useState, useEffect } from 'react';

const VirtualLogList = ({ 
  items = [], 
  itemHeight = 80, 
  containerHeight = 600, 
  renderItem,
  className = ''
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerRef, setContainerRef] = useState(null);
  
  // Calculate visible range
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    startIndex + Math.ceil(containerHeight / itemHeight) + 1,
    items.length
  );
  
  // Calculate visible items
  const visibleItems = items.slice(startIndex, endIndex);
  
  // Handle scroll
  const handleScroll = (e) => {
    setScrollTop(e.target.scrollTop);
  };
  
  // Set container ref
  useEffect(() => {
    setContainerRef(document.getElementById('virtual-scroll-container'));
  }, []);
  
  if (items.length === 0) {
    return (
      <div className={`virtual-scroll-empty ${className}`}>
        <p>No items to display</p>
      </div>
    );
  }
  
  return (
    <div 
      className={`virtual-scroll-container ${className}`}
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={handleScroll}
      id="virtual-scroll-container"
    >
      <div 
        className="virtual-scroll-spacer"
        style={{ height: items.length * itemHeight, position: 'relative' }}
      >
        {visibleItems.map((item, index) => (
          <div
            key={item.id || startIndex + index}
            className="virtual-scroll-item"
            style={{
              position: 'absolute',
              top: (startIndex + index) * itemHeight,
              height: itemHeight,
              width: '100%',
              boxSizing: 'border-box'
            }}
          >
            {renderItem(item, startIndex + index)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default VirtualLogList;
