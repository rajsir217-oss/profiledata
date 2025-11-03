                {
                  id: 'search',
                  icon: '🔍',
                  label: 'Search',
                  badge: minMatchScore > 0 ? `${minMatchScore}%` : null,
                  content: (
                    <div className="unified-search-tab">
                      {/* 1. L3V3L COMPATIBILITY SLIDER */}
                      {(systemConfig.enable_l3v3l_for_all || isPremiumUser) && (
                        <div className="l3v3l-slider-section" style={{ marginBottom: '24px' }}>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            marginBottom: '16px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '20px' }}>🎯</span>
                              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-color)' }}>Minimum Compatibility Score</h4>
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
                            onChange={(e) => {
                              const newScore = Number(e.target.value);
                              logger.debug('L3V3L Slider changed:', minMatchScore, '→', newScore);
                              setMinMatchScore(newScore);
                              setTimeout(() => handleSearch(1), 600);
                            }}
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
                          
                          {minMatchScore === 0 && (
                            <div style={{ 
                              marginTop: '12px',
                              padding: '8px 12px',
                              background: 'var(--info-color-light, rgba(66, 153, 225, 0.1))',
                              borderRadius: '6px',
                              fontSize: '13px',
                              color: 'var(--text-color)',
                              textAlign: 'center'
                            }}>
                              ℹ️ Set to 0% to disable L3V3L filtering (show all matches)
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* 2. BASIC FILTERS - Always Visible */}
                      <div className="basic-filters-section" style={{ marginBottom: '20px' }}>
                        <div className="row filter-row-1">
                          <div className="col-keyword">
                            <div className="form-group">
                              <label>Keyword Search</label>
                              <input
                                type="text"
                                className="form-control"
                                name="keyword"
                                value={searchCriteria.keyword}
                                onChange={handleInputChange}
                                placeholder="Search any field..."
                              />
                            </div>
                          </div>
                          <div className="col-location">
                            <div className="form-group">
                              <label>Location</label>
                              <input
                                type="text"
                                className="form-control"
                                name="location"
                                value={searchCriteria.location}
                                onChange={handleInputChange}
                                placeholder="City, State..."
                              />
                            </div>
                          </div>
                          <div className="col-age-range">
                            <div className="form-group">
                              <label>Age Range</label>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                  type="number"
                                  className="form-control"
                                  name="ageMin"
                                  value={searchCriteria.ageMin}
                                  onChange={handleInputChange}
                                  min="18"
                                  max="80"
                                  placeholder="19"
                                  style={{ flex: 1 }}
                                />
                                <input
                                  type="number"
                                  className="form-control"
                                  name="ageMax"
                                  value={searchCriteria.ageMax}
                                  onChange={handleInputChange}
                                  min="18"
                                  max="80"
                                  placeholder="23"
                                  style={{ flex: 1 }}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="col-height-min">
                            <div className="form-group">
                              <label>Height (Min)</label>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <select
                                  className="form-control"
                                  name="heightMinFeet"
                                  value={searchCriteria.heightMinFeet}
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
                                  value={searchCriteria.heightMinInches}
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
                              <label>Height (Max)</label>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <select
                                  className="form-control"
                                  name="heightMaxFeet"
                                  value={searchCriteria.heightMaxFeet}
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
                                  value={searchCriteria.heightMaxInches}
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
                      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginBottom: '20px' }}>
                        <button
                          type="button"
                          onClick={() => setShowSaveModal(true)}
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
                          💾 Save Search
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSearch(1)}
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
                          🔍 Search
                        </button>
                      </div>
                      
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
                          onMouseOver={(e) => e.target.style.background = 'var(--hover-background)'}
                          onMouseOut={(e) => e.target.style.background = 'none'}
                        >
                          {showAdvancedFilters ? '▲ View Less' : '▼ View More'}
                        </button>
                      </div>
                      
                      {/* 5. ADVANCED FILTERS - Collapsible */}
                      {showAdvancedFilters && (
                        <>
                          <div className="advanced-filters-section" style={{ marginBottom: '20px' }}>
                            <div className="row filter-row-1">
                              <div className="col-gender">
                                <div className="form-group">
                                  <label>Gender</label>
                                  <select
                                    className="form-control"
                                    name="gender"
                                    value={searchCriteria.gender}
                                    onChange={handleInputChange}
                                    readOnly={currentUserProfile?.role?.toLowerCase() !== 'admin' && currentUserProfile?.role?.toLowerCase() !== 'moderator'}
                                    disabled={currentUserProfile?.role?.toLowerCase() !== 'admin' && currentUserProfile?.role?.toLowerCase() !== 'moderator'}
                                    style={{
                                      cursor: (currentUserProfile?.role?.toLowerCase() !== 'admin' && currentUserProfile?.role?.toLowerCase() !== 'moderator') ? 'not-allowed' : 'pointer',
                                      backgroundColor: (currentUserProfile?.role?.toLowerCase() !== 'admin' && currentUserProfile?.role?.toLowerCase() !== 'moderator') ? '#f0f0f0' : 'rgba(255, 255, 255, 0.9)'
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
                                  <label>Body Type</label>
                                  <select
                                    className="form-control"
                                    name="bodyType"
                                    value={searchCriteria.bodyType}
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
                                  <label>Occupation</label>
                                  <select
                                    className="form-control"
                                    name="occupation"
                                    value={searchCriteria.occupation}
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
                                  <label>Eating</label>
                                  <select
                                    className="form-control"
                                    name="eatingPreference"
                                    value={searchCriteria.eatingPreference}
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
                                  <label>Drinking</label>
                                  <select
                                    className="form-control"
                                    name="drinking"
                                    value={searchCriteria.drinking}
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
                                  <label>Smoking</label>
                                  <select
                                    className="form-control"
                                    name="smoking"
                                    value={searchCriteria.smoking}
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
                                  <label>Days Back</label>
                                  <input
                                    type="number"
                                    className="form-control"
                                    name="daysBack"
                                    value={searchCriteria.daysBack}
                                    onChange={handleInputChange}
                                    min="1"
                                    max="365"
                                    placeholder="e.g., 7, 30"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* 6. ACTION BUTTONS - Second appearance (after advanced filters) */}
                          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginBottom: '20px' }}>
                            <button
                              type="button"
                              onClick={() => setShowSaveModal(true)}
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
                              💾 Save Search
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSearch(1)}
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
                              🔍 Search
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                }
