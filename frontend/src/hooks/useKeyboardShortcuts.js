/**
 * Custom hook for keyboard shortcuts
 * Centralizes keyboard event handling across components
 */

import { useEffect, useCallback } from 'react';

const useKeyboardShortcuts = (shortcuts, dependencies = []) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      const { key, ctrlKey, shiftKey, altKey, metaKey } = event;
      
      // Find matching shortcut
      const matchingShortcut = shortcuts.find(shortcut => {
        const { keys, ctrl = false, shift = false, alt = false, meta = false } = shortcut;
        
        if (Array.isArray(keys)) {
          return keys.includes(key) && 
                 ctrlKey === ctrl && 
                 shiftKey === shift && 
                 altKey === alt && 
                 metaKey === meta;
        } else {
          return key === keys && 
                 ctrlKey === ctrl && 
                 shiftKey === shift && 
                 altKey === alt && 
                 metaKey === meta;
        }
      });

      if (matchingShortcut) {
        event.preventDefault();
        matchingShortcut.action(event);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts, ...dependencies]);
};

// Common keyboard shortcuts
export const COMMON_SHORTCUTS = {
  ESC: { keys: 'Escape', action: null },
  ENTER: { keys: 'Enter', action: null },
  SPACE: { keys: ' ', action: null },
  ARROW_UP: { keys: 'ArrowUp', action: null },
  ARROW_DOWN: { keys: 'ArrowDown', action: null },
  ARROW_LEFT: { keys: 'ArrowLeft', action: null },
  ARROW_RIGHT: { keys: 'ArrowRight', action: null },
  CTRL_S: { keys: 's', ctrl: true, action: null },
  CTRL_Z: { keys: 'z', ctrl: true, action: null },
  CTRL_Y: { keys: 'y', ctrl: true, action: null }
};

export default useKeyboardShortcuts;
