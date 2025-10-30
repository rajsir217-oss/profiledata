import React, { useState } from 'react';
import './UniversalTabContainer.css';

/**
 * Universal Tab Container Component
 * 
 * Supports multiple tab variants:
 * - 'underlined' (default) - Simple underlined tabs
 * - 'pills' - Rounded pill-style tabs
 * - 'bordered' - Full bordered tabs
 * 
 * Features:
 * - Theme-aware styling
 * - Optional badges/counts
 * - Icon support
 * - Flexible and minimal
 * 
 * @param {Object} props
 * @param {Array} tabs - Array of tab objects: { id, label, icon?, badge?, content }
 * @param {string} variant - Tab style: 'underlined' | 'pills' | 'bordered' (default: 'underlined')
 * @param {string} defaultTab - Initial active tab ID
 * @param {Function} onTabChange - Callback when tab changes (tabId)
 * @param {string} className - Additional CSS class
 */
const UniversalTabContainer = ({
  tabs = [],
  variant = 'underlined',
  defaultTab,
  onTabChange,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const handleTabClick = (tabId) => {
    if (tabId === activeTab) return;
    setActiveTab(tabId);
    if (onTabChange) {
      onTabChange(tabId);
    }
  };

  const activeTabData = tabs.find(tab => tab.id === activeTab);

  return (
    <div className={`universal-tab-container variant-${variant} ${className}`}>
      {/* Tab Navigation */}
      <div className="tab-nav" role="tablist">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === activeTab}
            aria-controls={`panel-${tab.id}`}
            className={`tab-button ${tab.id === activeTab ? 'active' : ''}`}
            onClick={() => handleTabClick(tab.id)}
          >
            {tab.icon && <span className="tab-icon">{tab.icon}</span>}
            <span className="tab-label">{tab.label}</span>
            {tab.badge !== undefined && tab.badge !== null && (
              <span className="tab-badge">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content-area">
        {tabs.map(tab => (
          <div
            key={tab.id}
            id={`panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`tab-${tab.id}`}
            className={`tab-panel ${tab.id === activeTab ? 'active' : ''}`}
            hidden={tab.id !== activeTab}
          >
            {tab.id === activeTab && tab.content}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UniversalTabContainer;
