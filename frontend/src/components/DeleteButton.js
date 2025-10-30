/**
 * DeleteButton Component
 * 
 * Reusable 2-click delete button with inline confirmation
 * NO browser modals - uses visual state transformation
 * 
 * Usage:
 *   <DeleteButton 
 *     onDelete={() => handleDelete(itemId)}
 *     itemName="notification"
 *   />
 */

import React, { useState, useEffect, useRef } from 'react';
import './DeleteButton.css';

const DeleteButton = ({
  onDelete,
  itemName = 'item',
  size = 'medium',
  icon = '🗑️',
  confirmIcon = '✓',
  confirmText = 'Confirm?',
  confirmMessage = null,  // New: custom confirmation message
  timeout = 3000,
  disabled = false,
  className = '',
  onConfirmStateChange = null
}) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    // Cleanup timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Notify parent of confirm state change
    if (onConfirmStateChange) {
      onConfirmStateChange(isConfirming);
    }
  }, [isConfirming, onConfirmStateChange]);

  const handleClick = async (e) => {
    e.stopPropagation(); // Prevent event bubbling

    if (disabled) return;

    // First click: Arm the delete
    if (!isConfirming) {
      setIsConfirming(true);

      // Auto-reset after timeout
      timeoutRef.current = setTimeout(() => {
        setIsConfirming(false);
      }, timeout);

      return;
    }

    // Second click: Execute delete
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setIsConfirming(false);

    // Execute the delete callback
    if (onDelete) {
      await onDelete();
    }
  };

  const sizeClass = `delete-btn-${size}`;
  const stateClass = isConfirming ? 'confirming' : '';
  const disabledClass = disabled ? 'disabled' : '';

  // Use inline confirmation dialog if confirmMessage is provided
  if (confirmMessage && isConfirming) {
    return (
      <div className={`delete-confirm-inline ${className}`}>
        <span className="confirm-message">{confirmMessage}</span>
        <div className="confirm-actions">
          <button
            className="btn-confirm-delete"
            onClick={handleClick}
            disabled={disabled}
          >
            Delete
          </button>
          <button
            className="btn-confirm-cancel"
            onClick={() => {
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
              setIsConfirming(false);
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      className={`delete-button ${sizeClass} ${stateClass} ${disabledClass} ${className}`}
      onClick={handleClick}
      disabled={disabled}
      title={
        isConfirming
          ? `Click again to delete ${itemName}`
          : `Delete ${itemName}`
      }
      aria-label={
        isConfirming
          ? `Confirm delete ${itemName}`
          : `Delete ${itemName}`
      }
    >
      {isConfirming ? (
        <span className="confirm-content">
          <span className="confirm-icon">{confirmIcon}</span>
          <span className="confirm-text">{confirmText}</span>
        </span>
      ) : (
        <span className="icon">{icon}</span>
      )}
    </button>
  );
};

export default DeleteButton;
