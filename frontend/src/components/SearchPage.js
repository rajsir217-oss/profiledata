import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './SearchPage.css';

const SearchPage = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage] = useState(20);
  const [totalResults, setTotalResults] = useState(0);

  // Search form state
  const [searchCriteria, setSearchCriteria] = useState({
    keyword: '',
    gender: '',
    ageMin: '',
    ageMax: '',
    heightMin: '',
    heightMax: '',
    location: '',
    education: '',
    occupation: '',
    religion: '',
    caste: '',
    eatingPreference: '',
    drinking: '',
    smoking: '',
    relationshipStatus: '',
    bodyType: '',
    newlyAdded: false,
    sortBy: 'newest',
    sortOrder: 'desc'
  });

  const [savedSearches, setSavedSearches] = useState([]);
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');

  // Dating field options
  const genderOptions = ['', 'Male', 'Female'];
  const educationOptions = ['', 'B.Tech in Computer Science', 'MBA from IIM', 'M.Tech in Engineering', 'B.Com', 'M.Com', 'BBA', 'MCA', 'B.Sc in Physics', 'M.Sc in Chemistry', 'MBBS', 'MD', 'CA', 'CS', 'B.A. in Economics', 'M.A. in English', 'Ph.D. in Mathematics', 'B.E. in Mechanical', 'Diploma in Engineering', 'B.Pharm', 'M.Pharm'];
  const occupationOptions = ['', 'Software Engineer', 'Data Scientist', 'Product Manager', 'Business Analyst', 'Consultant', 'Doctor', 'Chartered Accountant', 'Lawyer', 'Teacher', 'Professor', 'Architect', 'Designer', 'Marketing Manager', 'Sales Executive', 'HR Manager', 'Financial Analyst', 'Civil Engineer', 'Mechanical Engineer', 'Pharmacist', 'Nurse', 'Entrepreneur', 'Banker', 'Government Officer'];
  const religionOptions = ['', 'Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain'];
  const casteOptions = ['', 'Brahmin', 'Kshatriya', 'Vaishya', 'Shudra', 'Any', 'No Preference'];
  const eatingOptions = ['', 'Vegetarian', 'Eggetarian', 'Non-Veg'];
  const lifestyleOptions = ['', 'Never', 'Socially', 'Prefer not to say'];
  const relationshipOptions = ['', 'Single', 'Divorced', 'Widowed'];
  const bodyTypeOptions = ['', 'Slim', 'Athletic', 'Average', 'Curvy'];

  useEffect(() => {
    loadSavedSearches();
  }, []);

  const loadSavedSearches = async () => {
    try {
      const username = localStorage.getItem('username');
      if (username) {
        const response = await api.get(`/users/${username}/saved-searches`);
        setSavedSearches(response.data.savedSearches || []);
      }
    } catch (err) {
      console.error('Error loading saved searches:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSearchCriteria(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSearch = async (page = 1) => {
    try {
      setLoading(true);
      setError('');

      const params = {
        ...searchCriteria,
        page: page,
        limit: recordsPerPage
      };

      // Remove empty fields
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === false) {
          delete params[key];
        }
      });

      const response = await api.get('/search', { params });

      if (page === 1) {
        setUsers(response.data.users || []);
      } else {
        setUsers(prev => [...prev, ...(response.data.users || [])]);
      }

      setTotalResults(response.data.total || 0);
      setCurrentPage(page);

    } catch (err) {
      console.error('Error searching users:', err);
      setError('Failed to search users. ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    handleSearch(currentPage + 1);
  };

  const handleSaveSearch = async () => {
    if (!saveSearchName.trim()) {
      setError('Please enter a name for the saved search');
      return;
    }

    try {
      const username = localStorage.getItem('username');
      if (!username) {
        setError('Please login to save searches');
        return;
      }

      const searchData = {
        name: saveSearchName.trim(),
        criteria: searchCriteria,
        createdAt: new Date().toISOString()
      };

      await api.post(`/users/${username}/saved-searches`, searchData);

      setSaveSearchName('');
      setError('');
      loadSavedSearches();

    } catch (err) {
      console.error('Error saving search:', err);
      setError('Failed to save search. ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleLoadSavedSearch = (savedSearch) => {
    setSearchCriteria(savedSearch.criteria);
    setSaveSearchName(savedSearch.name);
    setShowSavedSearches(false);
  };

  const handleDeleteSavedSearch = async (searchId) => {
    try {
      const username = localStorage.getItem('username');
      await api.delete(`/users/${username}/saved-searches/${searchId}`);
      loadSavedSearches();
    } catch (err) {
      console.error('Error deleting saved search:', err);
      setError('Failed to delete saved search');
    }
  };

  const calculateAge = (dob) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  };

  const parseHeight = (height) => {
    if (!height) return null;
    const match = height.match(/(\d+)'(\d+)"/);
    if (match) {
      return parseInt(match[1]) * 12 + parseInt(match[2]); // Convert to inches
    }
    return null;
  };

  const filteredUsers = users.filter(user => {
    // Age filter
    if (searchCriteria.ageMin || searchCriteria.ageMax) {
      const age = calculateAge(user.dob);
      if (age === null) return false;

      if (searchCriteria.ageMin && age < parseInt(searchCriteria.ageMin)) return false;
      if (searchCriteria.ageMax && age > parseInt(searchCriteria.ageMax)) return false;
    }

    // Height filter
    if (searchCriteria.heightMin || searchCriteria.heightMax) {
      const heightInches = parseHeight(user.height);
      if (heightInches === null) return false;

      if (searchCriteria.heightMin && heightInches < parseInt(searchCriteria.heightMin)) return false;
      if (searchCriteria.heightMax && heightInches > parseInt(searchCriteria.heightMax)) return false;
    }

    // Keyword search
    if (searchCriteria.keyword) {
      const keyword = searchCriteria.keyword.toLowerCase();
      const searchableText = [
        user.firstName, user.lastName, user.username,
        user.location, user.education, user.occupation,
        user.aboutYou, user.bio, user.interests
      ].join(' ').toLowerCase();

      if (!searchableText.includes(keyword)) return false;
    }

    return true;
  });

  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredUsers.slice(indexOfFirstRecord, indexOfLastRecord);

  return (
    <div className="search-page">
      <div className="search-header">
        <h2>🔍 Advanced Search</h2>
        <p className="text-muted">Find your perfect match with detailed filters</p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="search-container">
        {/* Search Filters */}
        <div className="search-filters">
          <div className="filters-header">
            <h4>Search Filters</h4>
            <div className="filter-actions">
              <button
                className="btn btn-outline-primary btn-sm"
                onClick={() => setShowSavedSearches(!showSavedSearches)}
              >
                📋 Saved Searches ({savedSearches.length})
              </button>
            </div>
          </div>

          {showSavedSearches && (
            <div className="saved-searches mb-3">
              <h6>Saved Searches</h6>
              {savedSearches.length === 0 ? (
                <p className="text-muted">No saved searches yet</p>
              ) : (
                <div className="saved-searches-list">
                  {savedSearches.map(search => (
                    <div key={search.id} className="saved-search-item">
                      <span onClick={() => handleLoadSavedSearch(search)}>
                        {search.name}
                      </span>
                      <button
                        className="btn btn-sm btn-outline-danger ms-2"
                        onClick={() => handleDeleteSavedSearch(search.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleSearch(1); }}>
            {/* Basic Search */}
            <div className="filter-section">
              <h6>Basic Search</h6>
              <div className="row">
                <div className="col-md-12">
                  <div className="form-group">
                    <label>Keyword Search</label>
                    <input
                      type="text"
                      className="form-control"
                      name="keyword"
                      value={searchCriteria.keyword}
                      onChange={handleInputChange}
                      placeholder="Search in name, location, interests, bio..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Dating Fields */}
            <div className="filter-section">
              <h6>Dating Preferences</h6>
              <div className="row">
                <div className="col-md-6">
                  <div className="form-group">
                    <label>Gender</label>
                    <select
                      className="form-control"
                      name="gender"
                      value={searchCriteria.gender}
                      onChange={handleInputChange}
                    >
                      {genderOptions.map(option => (
                        <option key={option} value={option}>{option || 'Any'}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="form-group">
                    <label>Relationship Status</label>
                    <select
                      className="form-control"
                      name="relationshipStatus"
                      value={searchCriteria.relationshipStatus}
                      onChange={handleInputChange}
                    >
                      {relationshipOptions.map(option => (
                        <option key={option} value={option}>{option || 'Any'}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Age Range */}
            <div className="filter-section">
              <h6>Age Range</h6>
              <div className="row">
                <div className="col-md-6">
                  <div className="form-group">
                    <label>Minimum Age</label>
                    <input
                      type="number"
                      className="form-control"
                      name="ageMin"
                      value={searchCriteria.ageMin}
                      onChange={handleInputChange}
                      min="18"
                      max="80"
                      placeholder="18"
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="form-group">
                    <label>Maximum Age</label>
                    <input
                      type="number"
                      className="form-control"
                      name="ageMax"
                      value={searchCriteria.ageMax}
                      onChange={handleInputChange}
                      min="18"
                      max="80"
                      placeholder="80"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Height Range */}
            <div className="filter-section">
              <h6>Height Range</h6>
              <div className="row">
                <div className="col-md-6">
                  <div className="form-group">
                    <label>Minimum Height (inches)</label>
                    <input
                      type="number"
                      className="form-control"
                      name="heightMin"
                      value={searchCriteria.heightMin}
                      onChange={handleInputChange}
                      min="48"
                      max="84"
                      placeholder="48"
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="form-group">
                    <label>Maximum Height (inches)</label>
                    <input
                      type="number"
                      className="form-control"
                      name="heightMax"
                      value={searchCriteria.heightMax}
                      onChange={handleInputChange}
                      min="48"
                      max="84"
                      placeholder="84"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Location & Background */}
            <div className="filter-section">
              <h6>Location & Background</h6>
              <div className="row">
                <div className="col-md-6">
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
                <div className="col-md-6">
                  <div className="form-group">
                    <label>Religion</label>
                    <select
                      className="form-control"
                      name="religion"
                      value={searchCriteria.religion}
                      onChange={handleInputChange}
                    >
                      {religionOptions.map(option => (
                        <option key={option} value={option}>{option || 'Any'}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="row">
                <div className="col-md-6">
                  <div className="form-group">
                    <label>Education</label>
                    <select
                      className="form-control"
                      name="education"
                      value={searchCriteria.education}
                      onChange={handleInputChange}
                    >
                      {educationOptions.map(option => (
                        <option key={option} value={option}>{option || 'Any'}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="form-group">
                    <label>Occupation</label>
                    <select
                      className="form-control"
                      name="occupation"
                      value={searchCriteria.occupation}
                      onChange={handleInputChange}
                    >
                      {occupationOptions.map(option => (
                        <option key={option} value={option}>{option || 'Any'}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Lifestyle */}
            <div className="filter-section">
              <h6>Lifestyle</h6>
              <div className="row">
                <div className="col-md-4">
                  <div className="form-group">
                    <label>Eating Preference</label>
                    <select
                      className="form-control"
                      name="eatingPreference"
                      value={searchCriteria.eatingPreference}
                      onChange={handleInputChange}
                    >
                      {eatingOptions.map(option => (
                        <option key={option} value={option}>{option || 'Any'}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-group">
                    <label>Drinking</label>
                    <select
                      className="form-control"
                      name="drinking"
                      value={searchCriteria.drinking}
                      onChange={handleInputChange}
                    >
                      {lifestyleOptions.map(option => (
                        <option key={option} value={option}>{option || 'Any'}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-group">
                    <label>Smoking</label>
                    <select
                      className="form-control"
                      name="smoking"
                      value={searchCriteria.smoking}
                      onChange={handleInputChange}
                    >
                      {lifestyleOptions.map(option => (
                        <option key={option} value={option}>{option || 'Any'}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="row">
                <div className="col-md-6">
                  <div className="form-group">
                    <label>Body Type</label>
                    <select
                      className="form-control"
                      name="bodyType"
                      value={searchCriteria.bodyType}
                      onChange={handleInputChange}
                    >
                      {bodyTypeOptions.map(option => (
                        <option key={option} value={option}>{option || 'Any'}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Special Filters */}
            <div className="filter-section">
              <h6>Special Filters</h6>
              <div className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  name="newlyAdded"
                  checked={searchCriteria.newlyAdded}
                  onChange={handleInputChange}
                  id="newlyAdded"
                />
                <label className="form-check-label" htmlFor="newlyAdded">
                  Show only newly added profiles (last 7 days)
                </label>
              </div>
            </div>

            {/* Save Search */}
            <div className="filter-section">
              <h6>Save This Search</h6>
              <div className="input-group">
                <input
                  type="text"
                  className="form-control"
                  value={saveSearchName}
                  onChange={(e) => setSaveSearchName(e.target.value)}
                  placeholder="Enter search name..."
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveSearch}
                >
                  Save Search
                </button>
              </div>
            </div>

            {/* Search Button */}
            <div className="filter-actions">
              <button type="submit" className="btn btn-primary btn-lg">
                {loading ? 'Searching...' : 'Search Profiles'}
              </button>
            </div>
          </form>
        </div>

        {/* Search Results */}
        <div className="search-results">
          <div className="results-header">
            <h4>Search Results</h4>
            <div className="results-info">
              <span className="badge bg-primary">Total: {totalResults}</span>
              <span className="badge bg-success ms-2">Filtered: {filteredUsers.length}</span>
            </div>
          </div>

          {loading && (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          )}

          {!loading && filteredUsers.length === 0 && (
            <div className="no-results">
              <h5>No profiles found</h5>
              <p>Try adjusting your search criteria or use broader filters.</p>
            </div>
          )}

          <div className="results-grid">
            {currentRecords.map((user) => (
              <div key={user.username} className="result-card">
                <div className="card">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <h6 className="card-title mb-0">
                        {user.firstName} {user.lastName}
                      </h6>
                      <span className="badge bg-primary">{calculateAge(user.dob)} years</span>
                    </div>

                    <div className="user-details">
                      <p><strong>📍</strong> {user.location}</p>
                      <p><strong>🎓</strong> {user.education}</p>
                      <p><strong>💼</strong> {user.occupation}</p>
                      <p><strong>📏</strong> {user.height}</p>
                    </div>

                    <div className="user-badges">
                      {user.religion && <span className="badge bg-info">{user.religion}</span>}
                      {user.eatingPreference && <span className="badge bg-success">{user.eatingPreference}</span>}
                      {user.bodyType && <span className="badge bg-warning">{user.bodyType}</span>}
                    </div>

                    <div className="card-actions mt-3">
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => navigate(`/profile/${user.username}`)}
                      >
                        View Profile
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredUsers.length > currentRecords.length && (
            <div className="text-center mt-4">
              <button
                className="btn btn-outline-primary"
                onClick={handleLoadMore}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchPage;
