import { useState, useRef, useCallback } from 'react';

/**
 * Custom hook for detecting swipe gestures on cards
 * Supports touch (mobile) and mouse (desktop) events
 * 
 * @param {Object} options - Configuration options
 * @param {number} options.thresholdX - Horizontal threshold to commit swipe (default: 100px)
 * @param {number} options.thresholdY - Vertical threshold to commit swipe (default: 80px)
 * @param {Function} options.onSwipeRight - Callback when swiped right (favorite)
 * @param {Function} options.onSwipeLeft - Callback when swiped left (exclude)
 * @param {Function} options.onSwipeUp - Callback when swiped up (shortlist)
 * @param {Function} options.onSwipeComplete - Callback after any swipe action
 * @returns {Object} Gesture state and event handlers
 */
const useSwipeGesture = ({
  thresholdX = 100,
  thresholdY = 80,
  onSwipeRight,
  onSwipeLeft,
  onSwipeUp,
  onSwipeComplete
} = {}) => {
  // Use refs for position tracking (avoid re-renders during drag)
  const startPos = useRef({ x: 0, y: 0 });
  const currentPos = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  
  // State for UI updates (only update when needed)
  const [swipeState, setSwipeState] = useState({
    deltaX: 0,
    deltaY: 0,
    direction: null, // 'left' | 'right' | 'up' | null
    isDragging: false,
    isCommitted: false
  });

  // Determine swipe direction based on deltas
  const getDirection = useCallback((deltaX, deltaY) => {
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    
    // Vertical swipe takes priority if moving more vertically
    if (absY > absX && deltaY < -thresholdY / 2) {
      return 'up';
    }
    
    if (absX > absY) {
      if (deltaX > thresholdX / 2) return 'right';
      if (deltaX < -thresholdX / 2) return 'left';
    }
    
    return null;
  }, [thresholdX, thresholdY]);

  // Check if swipe has crossed commit threshold
  const isCommitted = useCallback((deltaX, deltaY) => {
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    
    // Up swipe committed
    if (deltaY < -thresholdY && absY > absX) return true;
    // Right swipe committed
    if (deltaX > thresholdX && absX > absY) return true;
    // Left swipe committed
    if (deltaX < -thresholdX && absX > absY) return true;
    
    return false;
  }, [thresholdX, thresholdY]);

  // Handle drag start (touch or mouse)
  const handleDragStart = useCallback((clientX, clientY) => {
    isDragging.current = true;
    startPos.current = { x: clientX, y: clientY };
    currentPos.current = { x: clientX, y: clientY };
    
    setSwipeState({
      deltaX: 0,
      deltaY: 0,
      direction: null,
      isDragging: true,
      isCommitted: false
    });
  }, []);

  // Handle drag move
  const handleDragMove = useCallback((clientX, clientY) => {
    if (!isDragging.current) return;
    
    currentPos.current = { x: clientX, y: clientY };
    const deltaX = clientX - startPos.current.x;
    const deltaY = clientY - startPos.current.y;
    
    const direction = getDirection(deltaX, deltaY);
    const committed = isCommitted(deltaX, deltaY);
    
    setSwipeState({
      deltaX,
      deltaY,
      direction,
      isDragging: true,
      isCommitted: committed
    });
  }, [getDirection, isCommitted]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    if (!isDragging.current) return;
    
    isDragging.current = false;
    const deltaX = currentPos.current.x - startPos.current.x;
    const deltaY = currentPos.current.y - startPos.current.y;
    
    const direction = getDirection(deltaX, deltaY);
    const committed = isCommitted(deltaX, deltaY);
    
    if (committed && direction) {
      // Execute swipe action
      if (direction === 'right' && onSwipeRight) {
        onSwipeRight();
      } else if (direction === 'left' && onSwipeLeft) {
        onSwipeLeft();
      } else if (direction === 'up' && onSwipeUp) {
        onSwipeUp();
      }
      
      if (onSwipeComplete) {
        onSwipeComplete(direction);
      }
      
      // Keep committed state for exit animation
      setSwipeState(prev => ({
        ...prev,
        isDragging: false,
        isCommitted: true
      }));
    } else {
      // Reset to center (spring back)
      setSwipeState({
        deltaX: 0,
        deltaY: 0,
        direction: null,
        isDragging: false,
        isCommitted: false
      });
    }
  }, [getDirection, isCommitted, onSwipeRight, onSwipeLeft, onSwipeUp, onSwipeComplete]);

  // Touch event handlers
  const onTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) return; // Single touch only
    const touch = e.touches[0];
    handleDragStart(touch.clientX, touch.clientY);
  }, [handleDragStart]);

  const onTouchMove = useCallback((e) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    handleDragMove(touch.clientX, touch.clientY);
  }, [handleDragMove]);

  const onTouchEnd = useCallback(() => {
    handleDragEnd();
  }, [handleDragEnd]);

  // Mouse event handlers
  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
    
    // Add window listeners for mouse move/up
    const handleMouseMove = (moveEvent) => {
      handleDragMove(moveEvent.clientX, moveEvent.clientY);
    };
    
    const handleMouseUp = () => {
      handleDragEnd();
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [handleDragStart, handleDragMove, handleDragEnd]);

  // Reset swipe state (for after animation completes)
  const resetSwipe = useCallback(() => {
    setSwipeState({
      deltaX: 0,
      deltaY: 0,
      direction: null,
      isDragging: false,
      isCommitted: false
    });
  }, []);

  return {
    swipeState,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onMouseDown
    },
    resetSwipe
  };
};

export default useSwipeGesture;
