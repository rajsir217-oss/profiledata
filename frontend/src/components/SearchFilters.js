import React from 'react';
import logger from '../utils/logger';
import Tooltip from './Tooltip';
import './SearchFilters.css';

/**
 * Reusable Search Filters Component
 * Used in both SearchPage2 (main search) and EditSavedSearchModal
 * 
 * @param {Object} searchCriteria - Current search criteria values
 * @param {Number} minMatchScore - L3V3L compatibility score (0-100)
 * @param {Function} setMinMatchScore - Updates the L3V3L score
 * @param {Function} handleInputChange - Handles input field changes
 * @param {Boolean} showAdvancedFilters - Controls advanced filters visibility
 * @param {Function} setShowAdvancedFilters - Toggles advanced filters
 * @param {Function} onSearch - Callback when Search button clicked
 * @param {Function} onClear - Callback when Clear Search button clicked
 * @param {Function} onSave - Callback when Save Search button clicked
 * @param {Object} systemConfig - System configuration (for L3V3L enable check)
 * @param {Boolean} isPremiumUser - Whether user has premium access
 * @param {Object} currentUserProfile - Current user's profile data
 * @param {Array} bodyTypeOptions - Available body type options
 * @param {Array} occupationOptions - Available occupation options
 * @param {Array} eatingOptions - Available eating preference options
 * @param {Array} lifestyleOptions - Available lifestyle options (drinking, smoking)
 * @param {Boolean} hideActionButtons - Optional: hide Save/Search buttons (for modal use)
 * @param {String} searchButtonText - Optional: custom text for search button (default: "🔍 Search")
 * @param {String} saveButtonText - Optional: custom text for save button (default: "💾 Save Search")
 */
const SearchFilters = ({
  searchCriteria,
  minMatchScore,
  setMinMatchScore,
  handleInputChange,
  showAdvancedFilters,
  setShowAdvancedFilters,
  onSearch,
  onClear,
  onSave,
  systemConfig,
  isPremiumUser,
  currentUserProfile,
  bodyTypeOptions = [],
  occupationOptions = [],
  eatingOptions = [],
  lifestyleOptions = [],
  hideActionButtons = false,
  searchButtonText = '🔍 Search',
  saveButtonText = '💾 Save Search'
}) => {
  
  const handleSliderChange = (e) => {
    const newScore = Number(e.target.value);
    logger.debug('L3V3L Slider changed:', minMatchScore, '→', newScore);
    setMinMatchScore(newScore);
    // Instant client-side filtering - no need to trigger search
    // The filteredUsers in SearchPage2 will automatically re-compute
  };

  // Handle Profile ID search
  const handleProfileIdSearch = () => {
    console.log('🔍 Profile ID Search clicked, profileId:', searchCriteria.profileId);
    if (searchCriteria.profileId?.trim()) {
      console.log('🔍 Calling onSearch with profileId:', searchCriteria.profileId);
      onSearch();
    } else {
      console.log('🔍 Profile ID is empty, not searching');
    }
  };

  // Handle Profile ID clear
  const handleProfileIdClear = () => {
    handleInputChange({ target: { name: 'profileId', value: '' } });
  };

  return (
    <div className="unified-search-filters">
      {/* 0. PROFILE ID DIRECT SEARCH - Separate Section */}
      <div className="profile-id-search-section">
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            Profile ID
            <Tooltip 
              text="Enter an exact Profile ID to find a specific user directly. This bypasses all other filters."
              position="top"
              icon 
            />
          </label>
          <div className="profile-id-search-row">
            <input
              type="text"
              className="form-control"
              name="profileId"
              value={searchCriteria.profileId || ''}
              onChange={handleInputChange}
              placeholder="e.g., STHa9Lor"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleProfileIdSearch();
                }
              }}
            />
            <button 
              type="button" 
              className="btn btn-primary btn-profile-id-search"
              onClick={handleProfileIdSearch}
              disabled={!searchCriteria.profileId?.trim()}
            >
              🔍 Search
            </button>
            <button 
              type="button" 
              className="btn btn-danger btn-profile-id-clear"
              onClick={handleProfileIdClear}
              disabled={!searchCriteria.profileId?.trim()}
            >
              🗑️ Clear
            </button>
          </div>
        </div>
      </div>

      {/* 1. L3V3L COMPATIBILITY SLIDER */}
      {(systemConfig?.enable_l3v3l_for_all || isPremiumUser) && (
        <div className="l3v3l-slider-section" style={{ marginBottom: '24px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>🎯</span>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Minimum Compatibility Score
                <Tooltip 
                  text="Filter matches by L3V3L compatibility score. Higher scores indicate better alignment with your values, preferences, and personality traits."
                  position="top"
                  icon 
                />
              </h4>
            </div>
            <span style={{ 
              fontSize: '20px', 
              fontWeight: 700,
              color: 'var(--primary-color)'
            }}>
              {minMatchScore}%
            </span>
          </div>
          
          <input
            id="matchScoreSlider"
            type="range"
            min="0"
            max="100"
            step="5"
            value={minMatchScore}
            onChange={handleSliderChange}
            className="match-score-slider"
            style={{ width: '100%', height: '8px', cursor: 'pointer', marginBottom: '12px' }}
          />
          
          <div className="slider-labels" style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            fontSize: '13px', 
            color: 'var(--text-secondary)',
            fontWeight: '500'
          }}>
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </div>
      )}
      
      {/* 2. BASIC FILTERS - Always Visible */}
      <div className="basic-filters-section">
        {/* Row 1: Keyword Search (Full Width) */}
        <div className="col-keyword">
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Keyword Search
              <Tooltip 
                text="Search across all profile fields including bio, interests, occupation, and more. Leave empty to see all matches."
                position="top"
                icon 
              />
            </label>
            <input
              type="text"
              className="form-control"
              name="keyword"
              value={searchCriteria.keyword || ''}
              onChange={handleInputChange}
              placeholder="Search any field..."
            />
          </div>
        </div>
        
        {/* Row 2: Location and Age Range */}
        <div className="filter-row-location-age">
          <div className="col-location">
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                Location
                <Tooltip 
                  text="Filter by city, state, or region. Partial matches work too (e.g., 'CA' for California)."
                  position="top"
                  icon 
                />
              </label>
              <input
                type="text"
                className="form-control"
                name="location"
                value={searchCriteria.location || ''}
                onChange={handleInputChange}
                placeholder="City, State..."
              />
            </div>
          </div>
          <div className="col-age-range">
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                Age Range
                <Tooltip 
                  text="Set minimum and maximum age for matches. Leave blank for no age restriction. Minimum allowed: 19, Maximum: 100."
                  position="top"
                  icon 
                />
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number"
                  className="form-control"
                  name="ageMin"
                  value={searchCriteria.ageMin || ''}
                  onChange={handleInputChange}
                  onBlur={(e) => {
                    const value = parseInt(e.target.value);
                    if (e.target.value && value < 19) {
                      e.target.value = 19;
                      handleInputChange(e);
                    } else if (e.target.value && value > 100) {
                      e.target.value = 100;
                      handleInputChange(e);
                    }
                  }}
                  min="19"
                  max="100"
                  placeholder="Min"
                  style={{ flex: 1 }}
                  title="Minimum age: 19 | Maximum age: 100"
                />
                <input
                  type="number"
                  className="form-control"
                  name="ageMax"
                  value={searchCriteria.ageMax || ''}
                  onChange={handleInputChange}
                  onBlur={(e) => {
                    const value = parseInt(e.target.value);
                    if (e.target.value && value < 19) {
                      e.target.value = 19;
                      handleInputChange(e);
                    } else if (e.target.value && value > 100) {
                      e.target.value = 100;
                      handleInputChange(e);
                    }
                  }}
                  min="19"
                  max="100"
                  placeholder="Max"
                  style={{ flex: 1 }}
                  title="Minimum age: 19 | Maximum age: 100"
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Row 3: Height Min and Height Max */}
        <div className="filter-row-height">
          <div className="col-height-min">
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                Height (Min)
                <Tooltip 
                  text="Minimum height preference. Matches will be at least this tall."
                  position="top"
                  icon 
                />
              </label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <select
                  className="form-control"
                  name="heightMinFeet"
                  value={searchCriteria.heightMinFeet || ''}
                  onChange={handleInputChange}
                  style={{ fontSize: '13px', padding: '6px 8px', flex: 1 }}
                >
                  <option value="">Feet</option>
                  <option value="4">4 ft</option>
                  <option value="5">5 ft</option>
                  <option value="6">6 ft</option>
                  <option value="7">7 ft</option>
                </select>
                <select
                  className="form-control"
                  name="heightMinInches"
                  value={searchCriteria.heightMinInches || ''}
                  onChange={handleInputChange}
                  style={{ fontSize: '13px', padding: '6px 8px', flex: 1 }}
                >
                  <option value="">Inch</option>
                  {[...Array(12)].map((_, i) => (
                    <option key={i} value={i}>{i} in</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="col-height-max">
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                Height (Max)
                <Tooltip 
                  text="Maximum height preference. Matches will be at most this tall."
                  position="top"
                  icon 
                />
              </label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <select
                  className="form-control"
                  name="heightMaxFeet"
                  value={searchCriteria.heightMaxFeet || ''}
                  onChange={handleInputChange}
                  style={{ fontSize: '13px', padding: '6px 8px', flex: 1 }}
                >
                  <option value="">Feet</option>
                  <option value="4">4 ft</option>
                  <option value="5">5 ft</option>
                  <option value="6">6 ft</option>
                  <option value="7">7 ft</option>
                </select>
                <select
                  className="form-control"
                  name="heightMaxInches"
                  value={searchCriteria.heightMaxInches || ''}
                  onChange={handleInputChange}
                  style={{ fontSize: '13px', padding: '6px 8px', flex: 1 }}
                >
                  <option value="">Inch</option>
                  {[...Array(12)].map((_, i) => (
                    <option key={i} value={i}>{i} in</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* 3. ACTION BUTTONS - First appearance (after basic filters) */}
      {!hideActionButtons && (
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginBottom: '20px' }}>
          {onSearch && (
            <button
              type="button"
              onClick={onSearch}
              className="btn btn-primary"
              style={{
                padding: '10px 32px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--primary-color)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px'
              }}
            >
              {searchButtonText}
            </button>
          )}
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="btn btn-clear"
              style={{
                padding: '10px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#d84315',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => e.target.style.background = '#bf360c'}
              onMouseLeave={(e) => e.target.style.background = '#d84315'}
            >
              🗑️ Clear
            </button>
          )}
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              className="btn btn-secondary"
              style={{
                padding: '10px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--surface-color)',
                color: 'var(--text-color)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px'
              }}
            >
              {saveButtonText}
            </button>
          )}
        </div>
      )}
      
      {/* 4. VIEW MORE/LESS TOGGLE BUTTON */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--primary-color)',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            padding: '8px 16px',
            borderRadius: '6px',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.target.style.background = 'var(--hover-background, rgba(0,0,0,0.05))'}
          onMouseOut={(e) => e.target.style.background = 'none'}
        >
          {showAdvancedFilters ? '▲ View Less' : '▼ View More'}
        </button>
      </div>
      
      {/* 5. ADVANCED FILTERS - Collapsible */}
      {showAdvancedFilters && (
        <>
          <div className="advanced-filters-section">
              <div className="col-gender">
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Gender
                    <Tooltip 
                      text="Filter by gender preference. Default is set to opposite gender for most users. Admins can search all genders."
                      position="top"
                      icon 
                    />
                  </label>
                  <select
                    className="form-control"
                    name="gender"
                    value={searchCriteria.gender || ''}
                    onChange={handleInputChange}
                    readOnly={currentUserProfile?.role?.toLowerCase() !== 'admin' && currentUserProfile?.role?.toLowerCase() !== 'moderator'}
                    disabled={currentUserProfile?.role?.toLowerCase() !== 'admin' && currentUserProfile?.role?.toLowerCase() !== 'moderator'}
                    style={{
                      cursor: (currentUserProfile?.role?.toLowerCase() !== 'admin' && currentUserProfile?.role?.toLowerCase() !== 'moderator') ? 'not-allowed' : 'pointer',
                      backgroundColor: (currentUserProfile?.role?.toLowerCase() !== 'admin' && currentUserProfile?.role?.toLowerCase() !== 'moderator') ? 'var(--disabled-bg, #f0f0f0)' : 'var(--input-bg, rgba(255, 255, 255, 0.9))'
                    }}
                    title={(currentUserProfile?.role?.toLowerCase() !== 'admin' && currentUserProfile?.role?.toLowerCase() !== 'moderator') ? 'Gender filter is locked to opposite gender' : ''}
                  >
                    <option value="">All</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="col-body-type">
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Body Type
                    <Tooltip 
                      text="Filter by body type preference if specified by the user."
                      position="top"
                      icon 
                    />
                  </label>
                  <select
                    className="form-control"
                    name="bodyType"
                    value={searchCriteria.bodyType || ''}
                    onChange={handleInputChange}
                  >
                    <option value="">Any</option>
                    {bodyTypeOptions.map(option => option && (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="col-occupation">
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Occupation
                    <Tooltip 
                      text="Filter by profession or career field."
                      position="top"
                      icon 
                    />
                  </label>
                  <select
                    className="form-control"
                    name="occupation"
                    value={searchCriteria.occupation || ''}
                    onChange={handleInputChange}
                  >
                    <option value="">Any</option>
                    {occupationOptions.map(option => option && (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="col-eating">
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Eating
                    <Tooltip 
                      text="Filter by eating preference (vegetarian, non-vegetarian, vegan, etc.)."
                      position="top"
                      icon 
                    />
                  </label>
                  <select
                    className="form-control"
                    name="eatingPreference"
                    value={searchCriteria.eatingPreference || ''}
                    onChange={handleInputChange}
                  >
                    <option value="">Any</option>
                    {eatingOptions.map(option => option && (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="col-drinking">
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Drinking
                    <Tooltip 
                      text="Filter by alcohol consumption habits (never, socially, regularly, etc.)."
                      position="top"
                      icon 
                    />
                  </label>
                  <select
                    className="form-control"
                    name="drinking"
                    value={searchCriteria.drinking || ''}
                    onChange={handleInputChange}
                  >
                    <option value="">Any</option>
                    {lifestyleOptions.map(option => option && (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="col-smoking">
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Smoking
                    <Tooltip 
                      text="Filter by smoking habits (never, occasionally, regularly, etc.)."
                      position="top"
                      icon 
                    />
                  </label>
                  <select
                    className="form-control"
                    name="smoking"
                    value={searchCriteria.smoking || ''}
                    onChange={handleInputChange}
                  >
                    <option value="">Any</option>
                    {lifestyleOptions.map(option => option && (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="col-days-back">
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Days Back
                    <Tooltip 
                      text="Show only profiles created within the last X days. Useful for finding new members."
                      position="top"
                      icon 
                    />
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    name="daysBack"
                    value={searchCriteria.daysBack || ''}
                    onChange={handleInputChange}
                    min="1"
                    max="365"
                    placeholder="e.g., 7, 30"
                  />
                </div>
              </div>
          </div>
          
          {/* 6. ACTION BUTTONS - Second appearance (after advanced filters) */}
          {!hideActionButtons && (
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginBottom: '20px' }}>
              {onSearch && (
                <button
                  type="button"
                  onClick={onSearch}
                  className="btn btn-primary"
                  style={{
                    padding: '10px 32px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'var(--primary-color)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '14px'
                  }}
                >
                  {searchButtonText}
                </button>
              )}
              {onClear && (
                <button
                  type="button"
                  onClick={onClear}
                  className="btn btn-clear"
                  style={{
                    padding: '10px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#d84315',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '14px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#bf360c'}
                  onMouseLeave={(e) => e.target.style.background = '#d84315'}
                >
                  🗑️ Clear
                </button>
              )}
              {onSave && (
                <button
                  type="button"
                  onClick={onSave}
                  className="btn btn-secondary"
                  style={{
                    padding: '10px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'var(--surface-color)',
                    color: 'var(--text-color)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '14px'
                  }}
                >
                  {saveButtonText}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SearchFilters;
