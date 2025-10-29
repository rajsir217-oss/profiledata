import React, { useState, useEffect } from 'react';
import './TabContainer.css';

/**
 * Reusable TabContainer Component
 * 
 * Features:
 * - Tab navigation with icons
 * - Progress tracking per tab (0-100%)
 * - Sticky tab bar (stays visible while scrolling)
 * - Auto-save on tab switch (optional)
 * - Validation per tab
 * - Theme-aware styling
 * 
 * @param {Object} props
 * @param {Array} tabs - Array of tab objects: { id, label, icon, content }
 * @param {Function} onTabChange - Callback when tab changes (oldTab, newTab)
 * @param {Function} calculateProgress - Function to calculate progress for a tab
 * @param {Function} validateTab - Function to validate a tab before switching
 * @param {Function} onAutoSave - Callback for auto-save on tab switch
 * @param {boolean} enableAutoSave - Enable auto-save on tab switch (default: true)
 * @param {string} activeTabId - Controlled active tab (optional)
 */
const TabContainer = ({
  tabs = [],
  onTabChange,
  calculateProgress,
  validateTab,
  onAutoSave,
  enableAutoSave = true,
  activeTabId: controlledActiveTabId,
  children
}) => {
  const [activeTab, setActiveTab] = useState(controlledActiveTabId || tabs[0]?.id);
  const [tabProgress, setTabProgress] = useState({});
  const [tabErrors, setTabErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Update active tab if controlled
  useEffect(() => {
    if (controlledActiveTabId && controlledActiveTabId !== activeTab) {
      setActiveTab(controlledActiveTabId);
    }
  }, [controlledActiveTabId, activeTab]);

  // Calculate progress for all tabs
  useEffect(() => {
    if (calculateProgress) {
      const progress = {};
      tabs.forEach(tab => {
        progress[tab.id] = calculateProgress(tab.id);
      });
      setTabProgress(progress);
    }
  }, [tabs, calculateProgress]);

  const handleTabClick = async (newTabId) => {
    if (newTabId === activeTab) return;

    const oldTab = activeTab;

    // Validate current tab before switching
    if (validateTab) {
      const errors = await validateTab(oldTab);
      if (errors && Object.keys(errors).length > 0) {
        setTabErrors({ ...tabErrors, [oldTab]: errors });
        // Don't switch if validation fails
        return;
      }
      // Clear errors if validation passes
      setTabErrors({ ...tabErrors, [oldTab]: {} });
    }

    // Auto-save on tab switch
    if (enableAutoSave && onAutoSave) {
      setIsSaving(true);
      try {
        await onAutoSave(oldTab);
      } catch (error) {
        console.error('Auto-save failed:', error);
      } finally {
        setIsSaving(false);
      }
    }

    // Switch tab
    setActiveTab(newTabId);

    // Notify parent
    if (onTabChange) {
      onTabChange(oldTab, newTabId);
    }

    // Scroll to top instantly
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const getProgressColor = (progress) => {
    if (progress >= 80) return 'var(--success-color)';
    if (progress >= 50) return 'var(--warning-color)';
    return 'var(--danger-color)';
  };

  const getProgressIcon = (progress) => {
    if (progress === 100) return '✓';
    if (progress >= 50) return '◐';
    return '○';
  };

  return (
    <div className="tab-container">
      {/* Sticky Tab Bar */}
      <div className="tab-bar">
        {tabs.map(tab => {
          const progress = tabProgress[tab.id] || 0;
          const hasErrors = tabErrors[tab.id] && Object.keys(tabErrors[tab.id]).length > 0;
          const isActive = tab.id === activeTab;

          return (
            <button
              key={tab.id}
              type="button"
              className={`tab-button ${isActive ? 'active' : ''} ${hasErrors ? 'has-errors' : ''}`}
              onClick={() => handleTabClick(tab.id)}
              disabled={isSaving}
            >
              <div className="tab-content">
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </div>
              <div className="tab-progress-indicator">
                <span 
                  className="progress-icon"
                  style={{ color: getProgressColor(progress) }}
                >
                  {getProgressIcon(progress)}
                </span>
                <span className="progress-percentage">{Math.round(progress)}%</span>
              </div>
              {hasErrors && (
                <span className="error-badge" title="This tab has validation errors">
                  !
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Saving Indicator */}
      {isSaving && (
        <div className="auto-save-indicator">
          <div className="spinner"></div>
          <span>Saving...</span>
        </div>
      )}

      {/* Tab Content */}
      <div className="tab-content-container">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab-panel ${tab.id === activeTab ? 'active' : ''}`}
            role="tabpanel"
            aria-hidden={tab.id !== activeTab}
          >
            {tab.id === activeTab && (
              <>
                {tab.content}
                {children}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Progress Summary */}
      <div className="progress-summary">
        <div className="overall-progress">
          <span className="progress-label">Overall Progress:</span>
          <div className="progress-bar-container">
            <div 
              className="progress-bar-fill"
              style={{ 
                width: `${Object.values(tabProgress).reduce((a, b) => a + b, 0) / tabs.length || 0}%`,
                background: getProgressColor(Object.values(tabProgress).reduce((a, b) => a + b, 0) / tabs.length || 0)
              }}
            />
          </div>
          <span className="progress-percentage">
            {Math.round(Object.values(tabProgress).reduce((a, b) => a + b, 0) / tabs.length || 0)}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default TabContainer;
