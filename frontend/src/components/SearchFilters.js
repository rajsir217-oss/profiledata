import React, { useState } from 'react';
import logger from '../utils/logger';
import Tooltip from './Tooltip';
import OccupationMultiSelect from './OccupationMultiSelect';
import LocationMultiSelect from './LocationMultiSelect';
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
 * @param {Array} locationOptions - Available location options
 * @param {Array} eatingOptions - Available eating preference options
 * @param {Array} lifestyleOptions - Available lifestyle options (drinking, smoking)
 * @param {Boolean} hideActionButtons - Optional: hide Save/Search buttons (for modal use)
 * @param {String} searchButtonText - Optional: custom text for search button (default: "🔍 Search")
 * @param {String} saveButtonText - Optional: custom text for save button (default: "💾 Save Search")
 * @param {Boolean} isAdmin - Whether user is admin (affects Clear vs Reset button label)
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
  locationOptions = [],
  eatingOptions = [],
  lifestyleOptions = [],
  hideActionButtons = false,
  searchButtonText = 'Search',
  saveButtonText = 'Save Search',
  isAdmin = false
}) => {
  // Validation error state
  const [validationError, setValidationError] = useState('');
  
  const handleSliderChange = (e) => {
    const newScore = Number(e.target.value);
    logger.debug('L3V3L Slider changed:', minMatchScore, '→', newScore);
    setMinMatchScore(newScore);
    // Instant client-side filtering - no need to trigger search
    // The filteredUsers in SearchPage2 will automatically re-compute
  };

  // Handle Profile ID search - independent direct lookup (ignores other filters on backend)
  const handleProfileIdSearch = () => {
    console.log('🔍 Profile ID Search clicked, profileId:', searchCriteria.profileId);
    if (searchCriteria.profileId?.trim()) {
      // Profile ID search is handled specially by backend - ignores other filters
      console.log('🔍 Direct Profile ID lookup:', searchCriteria.profileId);
      onSearch();
    } else {
      console.log('🔍 Profile ID is empty, not searching');
    }
  };

  // Validate main search criteria (requires at least age range for non-admin users)
  const validateMainSearch = () => {
    // Admin users can bypass all validation for troubleshooting
    if (isAdmin) {
      return { valid: true };
    }
    
    const ageMin = Number(searchCriteria.ageMin) || 0;
    const ageMax = Number(searchCriteria.ageMax) || 0;
    
    // Main search requires at least age range for non-admin users
    if (!ageMin || !ageMax) {
      return {
        valid: false,
        message: 'Please specify Age Range (Min and Max) to search'
      };
    }
    
    // Age range sanity: min must not exceed max
    if (ageMin > ageMax) {
      return {
        valid: false,
        message: `Age Min (${ageMin}) cannot be greater than Age Max (${ageMax})`
      };
    }
    
    // Height range sanity: min must not exceed max
    const hMinFeet = Number(searchCriteria.heightMinFeet) || 0;
    const hMinInches = Number(searchCriteria.heightMinInches) || 0;
    const hMaxFeet = Number(searchCriteria.heightMaxFeet) || 0;
    const hMaxInches = Number(searchCriteria.heightMaxInches) || 0;
    
    if (hMinFeet || hMinInches || hMaxFeet || hMaxInches) {
      const heightMinTotal = hMinFeet * 12 + hMinInches;
      const heightMaxTotal = hMaxFeet * 12 + hMaxInches;
      if (heightMinTotal > 0 && heightMaxTotal > 0 && heightMinTotal > heightMaxTotal) {
        return {
          valid: false,
          message: `Height Min (${hMinFeet}'${hMinInches}") cannot be greater than Height Max (${hMaxFeet}'${hMaxInches}")`
        };
      }
    }
    
    return { valid: true };
  };

  // Handle main search with validation - clears profileId to use filter criteria
  const handleMainSearch = () => {
    const validation = validateMainSearch();
    if (!validation.valid) {
      setValidationError(validation.message);
      // Auto-clear error after 5 seconds
      setTimeout(() => setValidationError(''), 5000);
      return;
    }
    setValidationError(''); // Clear any previous error
    
    // Clear profileId so main search uses filter criteria, not profileId
    if (searchCriteria.profileId?.trim()) {
      handleInputChange({ target: { name: 'profileId', value: '' } });
    }
    
    onSearch();
  };

  // Handle Profile ID clear
  const handleProfileIdClear = () => {
    handleInputChange({ target: { name: 'profileId', value: '' } });
  };

  const daysBackRawValue = searchCriteria.daysBack ?? '';
  const allowedDaysBackValues = new Set(['45', '60', '90', '365', '0', '']);
  const daysBackSelectValue = daysBackRawValue === null || daysBackRawValue === undefined ? '' : String(daysBackRawValue);
  const showCustomDaysBackOption = daysBackSelectValue !== '' && !allowedDaysBackValues.has(daysBackSelectValue);

  return (
    <div className="unified-search-filters">
      {/* 0. PROFILE ID DIRECT SEARCH - Separate Section */}
      <div className="profile-id-search-section">
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            Profile ID / Username
            <Tooltip 
              text="Enter a Profile ID or Username to find a specific user directly. This bypasses all other filters."
              position="top"
              icon 
            />
          </label>
          <div className="profile-id-search-row">
            <input
              type="text"
              className="form-control"
              name="profileId"
              id="profileId-input"
              value={searchCriteria.profileId || ''}
              onChange={handleInputChange}
              placeholder="e.g., STHa9Lor or john_doe"
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
              aria-label="Search"
            >
              <span className="btn-icon" aria-hidden="true">🔍</span>
              <span className="btn-label">Search</span>
            </button>
            <button 
              type="button" 
              className="btn btn-danger btn-profile-id-clear"
              onClick={handleProfileIdClear}
              disabled={!searchCriteria.profileId?.trim()}
              aria-label="Clear"
            >
              <span className="btn-icon" aria-hidden="true">🗑️</span>
              <span className="btn-label">Clear</span>
            </button>
          </div>
        </div>
      </div>

      
      {/* 2. BASIC FILTERS - Always Visible */}
      <div className="basic-filters-section">
        {/* Row 1: Keyword Search */}
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
            <div className="age-range-inputs">
              <input
                type="number"
                className="form-control age-range-input"
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
                title="Minimum age: 19 | Maximum age: 100"
              />
              <input
                type="number"
                className="form-control age-range-input"
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
                title="Minimum age: 19 | Maximum age: 100"
              />
            </div>
          </div>
        </div>
        
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
            <div className="height-inputs">
              <select
                className="form-control height-select"
                name="heightMinFeet"
                value={searchCriteria.heightMinFeet || ''}
                onChange={handleInputChange}
              >
                <option value="">ft</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
                <option value="7">7</option>
              </select>
              <select
                className="form-control height-select"
                name="heightMinInches"
                value={searchCriteria.heightMinInches || ''}
                onChange={handleInputChange}
              >
                <option value="">in</option>
                {[...Array(12)].map((_, i) => (
                  <option key={i} value={i}>{i}</option>
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
            <div className="height-inputs">
              <select
                className="form-control height-select"
                name="heightMaxFeet"
                value={searchCriteria.heightMaxFeet || ''}
                onChange={handleInputChange}
              >
                <option value="">ft</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
                <option value="7">7</option>
              </select>
              <select
                className="form-control height-select"
                name="heightMaxInches"
                value={searchCriteria.heightMaxInches || ''}
                onChange={handleInputChange}
              >
                <option value="">in</option>
                {[...Array(12)].map((_, i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
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
            <select
              className="form-control"
              name="daysBack"
              value={daysBackSelectValue}
              onChange={handleInputChange}
            >
              {showCustomDaysBackOption && (
                <option value={daysBackSelectValue}>{`${daysBackSelectValue} (Custom)`}</option>
              )}
              <option value="45">45</option>
              <option value="60">60</option>
              <option value="90">90</option>
              <option value="365">365</option>
              <option value="0">ALL</option>
            </select>
          </div>
        </div>
        <div className="col-has-photo">
          <label className="has-photo-toggle-label">
            <input
              type="checkbox"
              name="hasPhoto"
              checked={searchCriteria.hasPhoto || false}
              onChange={handleInputChange}
              className="has-photo-checkbox"
            />
            <span className="has-photo-toggle-text">
              📸 Has Photo Only
            </span>
            <Tooltip 
              text="Only show profiles that have at least one photo. Profiles without photos are always deprioritized in results."
              position="top"
              icon 
            />
          </label>
        </div>

        <div className="col-occupation-basic">
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Occupation
              <Tooltip 
                text="Filter by profession or career field. Select multiple options."
                position="top"
                icon 
              />
            </label>
            <OccupationMultiSelect
              options={occupationOptions}
              selected={searchCriteria.occupations || []}
              onChange={(selected) => handleInputChange({ target: { name: 'occupations', value: selected } })}
              placeholder="Select professions..."
            />
          </div>
        </div>
        <div className="col-location">
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Location
              <Tooltip 
                text="Filter by city or state. Select multiple locations to expand your search."
                position="top"
                icon 
              />
            </label>
            <LocationMultiSelect
              options={locationOptions}
              selected={searchCriteria.locations || []}
              onChange={(selectedLocations) => {
                // Update search criteria with selected locations
                handleInputChange({
                  target: {
                    name: 'locations',
                    value: selectedLocations
                  }
                });
              }}
              placeholder="Select locations..."
              maxVisible={3}
            />
          </div>
        </div>

        {/* 3. ACTION BUTTONS - First appearance (after basic filters) */}
        {!hideActionButtons && !showAdvancedFilters && (
          <div className="search-action-buttons search-action-buttons-inline">
            {onSearch && (
              <button
                type="button"
                onClick={handleMainSearch}
                className="btn btn-primary"
                aria-label={searchButtonText}
              >
                <span className="btn-icon" aria-hidden="true">🔍</span>
                <span className="btn-label">{searchButtonText}</span>
              </button>
            )}
            {onClear && (
              <button
                type="button"
                onClick={onClear}
                className="btn btn-clear"
                title={isAdmin ? 'Clear all filters (widest search)' : 'Reset to your partner preference defaults'}
                aria-label={isAdmin ? 'Clear' : 'Reset'}
              >
                <span className="btn-icon" aria-hidden="true">{isAdmin ? '🗑️' : '🔄'}</span>
                <span className="btn-label">{isAdmin ? 'Clear' : 'Reset'}</span>
              </button>
            )}
            {onSave && (
              <button
                type="button"
                onClick={onSave}
                className="btn btn-secondary"
                aria-label={saveButtonText}
              >
                <span className="btn-icon" aria-hidden="true">💾</span>
                <span className="btn-label">{saveButtonText}</span>
              </button>
            )}
          </div>
        )}
        {/* HIDDEN: L3V3L COMPATIBILITY SLIDER 
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
      */}
      
      </div>
      
      {/* Validation Error Message */}
      {validationError && (
        <div className="search-validation-error" style={{
          background: 'rgba(231, 76, 60, 0.1)',
          border: '1px solid var(--danger-color)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: 'var(--danger-color)',
          fontWeight: 500
        }}>
          <span>⚠️</span>
          <span>{validationError}</span>
          <button 
            onClick={() => setValidationError('')}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: 'var(--danger-color)',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >✕</button>
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
          <div className={`advanced-filters-section ${!hideActionButtons ? 'has-actions' : ''}`}>
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

              {!hideActionButtons && (
                <div className="col-advanced-actions">
                  {onSearch && (
                    <button
                      type="button"
                      onClick={handleMainSearch}
                      className="btn btn-primary"
                      aria-label={searchButtonText}
                    >
                      <span className="btn-icon" aria-hidden="true">🔍</span>
                      <span className="btn-label">{searchButtonText}</span>
                    </button>
                  )}
                  {onClear && (
                    <button
                      type="button"
                      onClick={onClear}
                      className={isAdmin ? 'btn btn-clear' : 'btn btn-primary'}
                      title={isAdmin ? 'Clear all filters (widest search)' : 'Reset to your partner preference defaults'}
                      aria-label={isAdmin ? 'Clear' : 'Reset'}
                    >
                      <span className="btn-icon" aria-hidden="true">{isAdmin ? '🗑️' : '🔄'}</span>
                      <span className="btn-label">{isAdmin ? 'Clear' : 'Reset'}</span>
                    </button>
                  )}
                  {onSave && (
                    <button
                      type="button"
                      onClick={onSave}
                      className="btn btn-secondary"
                      aria-label={saveButtonText}
                    >
                      <span className="btn-icon" aria-hidden="true">💾</span>
                      <span className="btn-label">{saveButtonText}</span>
                    </button>
                  )}
                </div>
              )}
          </div>
        </>
      )}
    </div>
  );
};

export default SearchFilters;
