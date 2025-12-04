import React, { useState, useRef, useEffect } from 'react';
import './Tooltip.css';

/**
 * Tooltip Component
 * 
 * Usage:
 * <Tooltip text="This is helpful information">
 *   <span>Hover me</span>
 * </Tooltip>
 * 
 * Or with icon:
 * <Tooltip text="This is helpful information" icon />
 * 
 * Props:
 * - text: Help text to display (required)
 * - position: 'top' | 'bottom' | 'left' | 'right' (default: 'top')
 * - icon: boolean - Show as info icon instead of wrapping children
 * - maxWidth: string - Max width of tooltip (default: '450px')
 * - children: React element to wrap (required if icon=false)
 */
const Tooltip = ({ 
  text, 
  children, 
  position = 'top',
  icon = false,
  maxWidth = '450px'
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState(null);
  const tooltipRef = useRef(null);

  // Handle click to toggle tooltip
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isVisible && tooltipRef.current) {
      // Calculate position when opening
      const rect = tooltipRef.current.getBoundingClientRect();
      const scrollY = window.scrollY || window.pageYOffset;
      const scrollX = window.scrollX || window.pageXOffset;
      
      setTooltipPosition({
        left: rect.left + scrollX + rect.width / 2,
        top: position === 'top' 
          ? rect.top + scrollY - 12 // Position above icon with 12px spacing
          : rect.bottom + scrollY + 12 // Position below icon with 12px spacing
      });
    }
    setIsVisible(!isVisible);
  };

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target)) {
        setIsVisible(false);
        setTooltipPosition(null); // Reset position
      }
    };
    
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsVisible(false);
        setTooltipPosition(null);
      }
    };

    if (isVisible) {
      // Use capture phase to ensure we catch the click before other handlers
      document.addEventListener('mousedown', handleClickOutside, true);
      document.addEventListener('touchstart', handleClickOutside, true);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('touchstart', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isVisible]);

  if (icon) {
    // Render as standalone info icon
    return (
      <span 
        ref={tooltipRef}
        className="tooltip-container tooltip-icon-wrapper"
        onClick={handleClick}
        onMouseDown={handleClick}
        onTouchStart={handleClick}
        tabIndex="0"
        role="button"
        aria-label="Help information"
        aria-expanded={isVisible}
        style={{ position: 'relative', zIndex: 1000 }}
      >
        <span className="tooltip-icon">ℹ️</span>
        {isVisible && tooltipPosition && (
          <div 
            className={`tooltip-bubble tooltip-${position} tooltip-fixed`}
            style={{ 
              maxWidth,
              left: `${tooltipPosition.left}px`,
              top: `${tooltipPosition.top}px`
            }}
            role="tooltip"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsVisible(false);
                setTooltipPosition(null);
              }}
              className="tooltip-close"
              aria-label="Close tooltip"
            >
              ✕
            </button>
            {text}
          </div>
        )}
      </span>
    );
  }

  // Wrap children with tooltip
  return (
    <span 
      ref={tooltipRef}
      className="tooltip-container"
      onClick={handleClick}
    >
      {children}
      {isVisible && (
        <span 
          className={`tooltip-bubble tooltip-${position}`}
          style={{ maxWidth }}
          role="tooltip"
        >
          {text}
        </span>
      )}
    </span>
  );
};

export default Tooltip;
