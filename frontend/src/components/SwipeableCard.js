import React, { useMemo } from 'react';
import useSwipeGesture from '../hooks/useSwipeGesture';
import './SwipeableCard.css';

/**
 * SwipeableCard - Wrapper component that adds swipe gesture capabilities
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Card content to wrap
 * @param {Function} props.onSwipeRight - Callback for right swipe (favorite)
 * @param {Function} props.onSwipeLeft - Callback for left swipe (exclude)
 * @param {Function} props.onSwipeUp - Callback for up swipe (shortlist)
 * @param {Function} props.onSwipeDown - Callback for down swipe (skip/next)
 * @param {Function} props.onSwipeComplete - Callback after swipe action
 * @param {boolean} props.disabled - Disable swipe gestures
 * @param {string} props.className - Additional CSS classes
 */
const SwipeableCard = ({
  children,
  onSwipeRight,
  onSwipeLeft,
  onSwipeUp,
  onSwipeDown,
  onSwipeComplete,
  disabled = false,
  className = ''
}) => {
  const { swipeState, handlers, resetSwipe } = useSwipeGesture({
    thresholdX: 100,
    thresholdY: 80,
    onSwipeRight,
    onSwipeLeft,
    onSwipeUp,
    onSwipeDown,
    onSwipeComplete: (direction) => {
      if (onSwipeComplete) {
        onSwipeComplete(direction);
      }
      // Reset after animation
      setTimeout(resetSwipe, 300);
    }
  });

  const { deltaX, deltaY, direction, isDragging, isCommitted } = swipeState;

  // Calculate transform styles
  const cardStyle = useMemo(() => {
    if (isCommitted) {
      // Exit animation - fly off screen
      const exitX = direction === 'right' ? 500 : direction === 'left' ? -500 : 0;
      const exitY = direction === 'up' ? -500 : direction === 'down' ? 500 : 0;
      const exitRotation = direction === 'right' ? 30 : direction === 'left' ? -30 : 0;
      
      return {
        transform: `translateX(${exitX}px) translateY(${exitY}px) rotate(${exitRotation}deg)`,
        opacity: 0,
        transition: 'transform 0.3s ease-out, opacity 0.3s ease-out'
      };
    }
    
    if (!isDragging) {
      // Return to center with spring animation
      return {
        transform: 'translateX(0) translateY(0) rotate(0deg)',
        transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
      };
    }
    
    // During drag - follow finger/mouse
    const rotation = Math.min(Math.max(deltaX / 15, -15), 15);
    const scale = Math.max(1 - Math.abs(deltaX) / 1000, 0.95);
    
    return {
      transform: `translateX(${deltaX}px) translateY(${deltaY}px) rotate(${rotation}deg) scale(${scale})`,
      transition: 'none',
      cursor: 'grabbing'
    };
  }, [deltaX, deltaY, direction, isDragging, isCommitted]);

  // Calculate overlay opacity based on swipe distance
  const getOverlayOpacity = (targetDirection) => {
    if (!isDragging || direction !== targetDirection) return 0;
    
    const threshold = (targetDirection === 'up' || targetDirection === 'down') ? 80 : 100;
    const distance = (targetDirection === 'up' || targetDirection === 'down') ? Math.abs(deltaY) : Math.abs(deltaX);
    
    return Math.min(distance / threshold, 1) * 0.8;
  };

  // Determine which overlay to show
  const rightOpacity = getOverlayOpacity('right');
  const leftOpacity = getOverlayOpacity('left');
  const upOpacity = getOverlayOpacity('up');
  const downOpacity = getOverlayOpacity('down');

  if (disabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div 
      className={`swipeable-card-wrapper ${className} ${isDragging ? 'is-dragging' : ''}`}
      {...handlers}
      style={{ touchAction: 'none' }}
    >
      <div 
        className="swipeable-card"
        style={cardStyle}
      >
        {/* Swipe Overlays */}
        <div 
          className="swipe-overlay swipe-overlay-right"
          style={{ opacity: rightOpacity }}
        >
          <span className="swipe-overlay-icon">⭐</span>
          <span className="swipe-overlay-text">Favorite</span>
        </div>
        
        <div 
          className="swipe-overlay swipe-overlay-left"
          style={{ opacity: leftOpacity }}
        >
          <span className="swipe-overlay-icon">🚫</span>
          <span className="swipe-overlay-text">Pass</span>
        </div>
        
        <div 
          className="swipe-overlay swipe-overlay-up"
          style={{ opacity: upOpacity }}
        >
          <span className="swipe-overlay-icon">📋</span>
          <span className="swipe-overlay-text">Shortlist</span>
        </div>
        
        <div 
          className="swipe-overlay swipe-overlay-down"
          style={{ opacity: downOpacity }}
        >
          <span className="swipe-overlay-icon">⏭️</span>
          <span className="swipe-overlay-text">Skip</span>
        </div>

        {/* Card Content */}
        <div className="swipeable-card-content">
          {children}
        </div>
      </div>

      {/* Swipe Hint Indicators (shown when not dragging) */}
      {!isDragging && !isCommitted && (
        <div className="swipe-hints">
          <div className="swipe-hint swipe-hint-left">
            <span>←</span>
          </div>
          <div className="swipe-hint swipe-hint-right">
            <span>→</span>
          </div>
          <div className="swipe-hint swipe-hint-up">
            <span>↑</span>
          </div>
          <div className="swipe-hint swipe-hint-down">
            <span>↓</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SwipeableCard;
