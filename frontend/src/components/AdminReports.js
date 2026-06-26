import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createApiInstance } from '../api';
import './AdminReports.css';

// Use global API factory for session handling
const api = createApiInstance();

const AdminReports = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [genderFilter, setGenderFilter] = useState('all');
  const [chartType, setChartType] = useState('bar'); // 'bar' or 'pie'
  const [reportType, setReportType] = useState('gender-by-age'); // 'gender-by-age', 'by-location', 'by-profession', 'member-acquisition'
  const [reportData, setReportData] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [summary, setSummary] = useState(null);
  const [yearFilter, setYearFilter] = useState('all');
  const [availableYears, setAvailableYears] = useState([]);
  const [showLocationTable, setShowLocationTable] = useState(false);
  const [expandedStates, setExpandedStates] = useState({});
  const [locationSortField, setLocationSortField] = useState('count');
  const [locationSortDir, setLocationSortDir] = useState('desc');

  // Check admin access
  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin') {
      console.warn('⚠️ Unauthorized access attempt to Admin Reports');
      navigate('/dashboard');
    }
  }, [navigate]);

  // Fetch report data
  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (genderFilter !== 'all') params.append('gender', genderFilter);
      if (reportType === 'member-acquisition' && yearFilter !== 'all') {
        params.append('year', yearFilter);
      }
      const qs = params.toString() ? `?${params.toString()}` : '';
      const response = await api.get(`/api/admin/reports/${reportType}${qs}`);
      if (response.data.success) {
        setReportData(response.data);
      }
    } catch (err) {
      console.error('Error fetching report:', err);
      setError(err.response?.data?.detail || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [genderFilter, reportType, yearFilter]);

  // Fetch available years for the Member Acquisition report
  const fetchAvailableYears = useCallback(async () => {
    try {
      const response = await api.get('/api/admin/reports/member-acquisition/years');
      if (response.data.success) {
        setAvailableYears(response.data.years || []);
      }
    } catch (err) {
      console.error('Error fetching available years:', err);
      setAvailableYears([]);
    }
  }, []);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    try {
      const response = await api.get('/api/admin/reports/summary');
      if (response.data.success) {
        setSummary(response.data.summary);
      }
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  }, []);

  useEffect(() => {
    fetchReport();
    fetchSummary();
  }, [fetchReport, fetchSummary]);

  // Load available years once the Member Acquisition report is selected
  useEffect(() => {
    if (reportType === 'member-acquisition' && availableYears.length === 0) {
      fetchAvailableYears();
    }
  }, [reportType, availableYears.length, fetchAvailableYears]);

  // ESC key binding to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showModal) {
        setShowModal(false);
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showModal]);

  // Handle data point click
  const handleDataPointClick = (itemData) => {
    setSelectedItem(itemData);
    setShowModal(true);
  };

  // Open profile in new tab
  const openProfile = (username) => {
    window.open(`/profile/${username}`, '_blank');
  };

  // ---- Location table helpers ----
  const CITY_STATE = {
    'San Francisco': 'CA', 'Los Angeles': 'CA', 'San Diego': 'CA', 'San Jose': 'CA',
    'Sacramento': 'CA', 'Fremont': 'CA', 'Sunnyvale': 'CA', 'Irvine': 'CA', 'Oakland': 'CA',
    'Fresno': 'CA', 'Long Beach': 'CA', 'Bakersfield': 'CA', 'Anaheim': 'CA', 'Riverside': 'CA',
    'Santa Ana': 'CA', 'Stockton': 'CA', 'Chula Vista': 'CA', 'Hayward': 'CA', 'Santa Clara': 'CA',
    'New York City': 'NY', 'New York': 'NY', 'Brooklyn': 'NY', 'Queens': 'NY', 'Buffalo': 'NY',
    'Rochester': 'NY', 'Albany': 'NY', 'Yonkers': 'NY', 'Bronx': 'NY', 'Staten Island': 'NY', 'Manhattan': 'NY',
    'Atlanta': 'GA', 'Augusta': 'GA', 'Savannah': 'GA', 'Athens': 'GA', 'Marietta': 'GA',
    'Dallas': 'TX', 'Houston': 'TX', 'Austin': 'TX', 'San Antonio': 'TX', 'Fort Worth': 'TX',
    'El Paso': 'TX', 'Arlington': 'TX', 'Corpus Christi': 'TX', 'Plano': 'TX', 'Irving': 'TX',
    'Garland': 'TX', 'Lubbock': 'TX', 'Frisco': 'TX', 'McKinney': 'TX', 'Carrollton': 'TX',
    'Chicago': 'IL', 'Aurora': 'IL', 'Naperville': 'IL', 'Joliet': 'IL', 'Rockford': 'IL', 'Schaumburg': 'IL',
    'Seattle': 'WA', 'Spokane': 'WA', 'Tacoma': 'WA', 'Bellevue': 'WA', 'Redmond': 'WA', 'Kirkland': 'WA',
    'Boston': 'MA', 'Worcester': 'MA', 'Cambridge': 'MA', 'Lowell': 'MA', 'Quincy': 'MA',
    'Phoenix': 'AZ', 'Tucson': 'AZ', 'Mesa': 'AZ', 'Chandler': 'AZ', 'Scottsdale': 'AZ', 'Glendale': 'AZ', 'Gilbert': 'AZ', 'Tempe': 'AZ',
    'Philadelphia': 'PA', 'Pittsburgh': 'PA', 'Allentown': 'PA', 'Erie': 'PA',
    'Denver': 'CO', 'Colorado Springs': 'CO', 'Fort Collins': 'CO', 'Boulder': 'CO',
    'Miami': 'FL', 'Jacksonville': 'FL', 'Tampa': 'FL', 'Orlando': 'FL', 'St. Petersburg': 'FL',
    'Hialeah': 'FL', 'Fort Lauderdale': 'FL', 'Tallahassee': 'FL',
    'Detroit': 'MI', 'Grand Rapids': 'MI', 'Warren': 'MI', 'Sterling Heights': 'MI', 'Ann Arbor': 'MI', 'Dearborn': 'MI',
    'Minneapolis': 'MN', 'St. Paul': 'MN', 'Rochester': 'MN',
    'Portland': 'OR', 'Eugene': 'OR', 'Salem': 'OR', 'Beaverton': 'OR',
    'Las Vegas': 'NV', 'Henderson': 'NV', 'Reno': 'NV',
    'Nashville': 'TN', 'Memphis': 'TN', 'Knoxville': 'TN', 'Chattanooga': 'TN',
    'Charlotte': 'NC', 'Raleigh': 'NC', 'Greensboro': 'NC', 'Durham': 'NC',
    'Baltimore': 'MD', 'Rockville': 'MD', 'Gaithersburg': 'MD', 'Silver Spring': 'MD',
    'Washington': 'DC', 'Washington DC': 'DC', 'Washington D.C.': 'DC',
    'Louisville': 'KY', 'Lexington': 'KY',
    'Indianapolis': 'IN', 'Fort Wayne': 'IN', 'Carmel': 'IN',
    'Milwaukee': 'WI', 'Madison': 'WI',
    'Albuquerque': 'NM', 'Santa Fe': 'NM',
    'Omaha': 'NE', 'Lincoln': 'NE',
    'Tulsa': 'OK', 'Oklahoma City': 'OK',
    'Kansas City': 'MO', 'St. Louis': 'MO',
    'Richmond': 'VA', 'Virginia Beach': 'VA', 'Norfolk': 'VA', 'Chesapeake': 'VA', 'Arlington': 'VA',
    'Salt Lake City': 'UT', 'Provo': 'UT', 'West Valley City': 'UT',
    'Cleveland': 'OH', 'Columbus': 'OH', 'Cincinnati': 'OH', 'Akron': 'OH', 'Toledo': 'OH',
    'New Orleans': 'LA', 'Baton Rouge': 'LA', 'Shreveport': 'LA',
    'Hartford': 'CT', 'New Haven': 'CT', 'Bridgeport': 'CT', 'Stamford': 'CT',
    'Newark': 'NJ', 'Jersey City': 'NJ', 'Paterson': 'NJ', 'Edison': 'NJ', 'Parsippany': 'NJ',
    'Birmingham': 'AL', 'Montgomery': 'AL', 'Huntsville': 'AL',
    'Honolulu': 'HI',
  };

  const extractState = (location) => {
    if (!location) return '??';
    const match = location.match(/,\s*([A-Z]{2})$/);
    if (match) return match[1];
    const commaIdx = location.lastIndexOf(',');
    if (commaIdx > -1) {
      const after = location.slice(commaIdx + 1).trim();
      if (after.length === 2 && after === after.toUpperCase()) return after;
    }
    return CITY_STATE[location.trim()] || '??';
  };

  const groupByState = (locationData) => {
    const stateMap = {};
    locationData.forEach(item => {
      const state = extractState(item.location);
      if (!stateMap[state]) {
        stateMap[state] = { state, count: 0, maleCount: 0, femaleCount: 0, cities: [] };
      }
      stateMap[state].count += item.count;
      stateMap[state].maleCount += (item.maleCount || 0);
      stateMap[state].femaleCount += (item.femaleCount || 0);
      stateMap[state].cities.push(item);
    });
    return Object.values(stateMap).sort((a, b) => b.count - a.count);
  };

  const toggleStateRow = (state) => {
    setExpandedStates(prev => ({ ...prev, [state]: !prev[state] }));
  };

  const handleGenderClick = (item, gender) => {
    const filteredUsers = (item.users || []).filter(u => (u.gender || '').toLowerCase() === gender);
    setSelectedItem({ ...item, users: filteredUsers, count: filteredUsers.length, _genderFilter: gender });
    setShowModal(true);
  };

  const handleTableSort = (field) => {
    if (locationSortField === field) {
      setLocationSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setLocationSortField(field);
      setLocationSortDir('desc');
    }
  };

  const sortedLocationData = [...(reportData?.data || [])].sort((a, b) => {
    const mul = locationSortDir === 'asc' ? 1 : -1;
    if (locationSortField === 'location') return mul * (a.location || '').localeCompare(b.location || '');
    if (locationSortField === 'maleCount') return mul * ((a.maleCount || 0) - (b.maleCount || 0));
    if (locationSortField === 'femaleCount') return mul * ((a.femaleCount || 0) - (b.femaleCount || 0));
    return mul * ((a.count || 0) - (b.count || 0));
  });

  // Get chart data first
  const data = reportData?.data || [];
  const maxCount = Math.max(...data.map(d => d.count), 1);

  // Calculate chart dimensions
  const chartWidth = 800;
  const chartHeight = Math.max(400, data.length * 35 + 100); // Dynamic height based on data
  const padding = { top: 40, right: 60, bottom: 60, left: 150 }; // More left padding for labels
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  // Scale function for horizontal bar chart X-axis (count)
  const xScale = (count) => padding.left + (count / maxCount) * innerWidth;

  
  // Generate Y-axis ticks
  const yTicks = [];
  const tickCount = 5;
  for (let i = 0; i <= tickCount; i++) {
    const value = Math.round((maxCount / tickCount) * i);
    yTicks.push(value);
  }

  
  return (
    <div className="admin-reports-page">
      {/* Summary Cards */}
      {summary && (
        <div className="summary-cards">
          <div className="summary-card">
            <div className="summary-icon">👥</div>
            <div className="summary-content">
              <div className="summary-value">{summary.totalActive}</div>
              <div className="summary-label">Active Users</div>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon">👨</div>
            <div className="summary-content">
              <div className="summary-value">{summary.maleCount}</div>
              <div className="summary-label">Male</div>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon">👩</div>
            <div className="summary-content">
              <div className="summary-value">{summary.femaleCount}</div>
              <div className="summary-label">Female</div>
            </div>
          </div>
          <div className="summary-card pending">
            <div className="summary-icon">⏳</div>
            <div className="summary-content">
              <div className="summary-value">{summary.totalPending}</div>
              <div className="summary-label">Pending Approval</div>
            </div>
          </div>
        </div>
      )}

      {/* Report Section */}
      <div className="report-section">
        <div className="report-header">
          <h2>
            {reportType === 'gender-by-age' && '👤 Members by Age Distribution'}
            {reportType === 'by-location' && '📍 Members by Location'}
            {reportType === 'by-profession' && '💼 Members by Profession'}
            {reportType === 'member-acquisition' && '📈 Members Added by Month'}
          </h2>
          <div className="filter-controls">
            <label>Report:</label>
            <select 
              value={reportType} 
              onChange={(e) => {
                setReportType(e.target.value);
                if (e.target.value !== 'gender-by-age') {
                  setChartType('bar');
                }
              }}
              className="report-type-select"
            >
              <option value="gender-by-age">👤 By Age</option>
              <option value="by-location">📍 By Location</option>
              <option value="by-profession">💼 By Profession</option>
              <option value="member-acquisition">📈 Members Added by Month</option>
            </select>
            {reportType === 'member-acquisition' && (
              <>
                <label>Year:</label>
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="year-select"
                >
                  <option value="all">All Time</option>
                  {availableYears.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </>
            )}
            {reportType === 'gender-by-age' && (
              <>
                <label>Chart:</label>
                <select 
                  value={chartType} 
                  onChange={(e) => setChartType(e.target.value)}
                  className="chart-type-select"
                >
                  <option value="bar">📊 Bar</option>
                  <option value="pie">🥧 Pie</option>
                </select>
              </>
            )}
            <label>Gender:</label>
            <select 
              value={genderFilter} 
              onChange={(e) => setGenderFilter(e.target.value)}
              className="gender-select"
            >
              <option value="all">All</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
        </div>

        {loading && (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading report...</p>
          </div>
        )}

        {error && (
          <div className="error-message">
            <span>❌</span> {error}
          </div>
        )}

        {!loading && !error && reportData && (
          <div className="chart-container">
            <div className="chart-info">
              <span className="total-count">
                Total: <strong>{reportData.totalCount}</strong> users
              </span>
              <span className="filter-info">
                Filter: <strong>{genderFilter === 'all' ? 'All Genders' : genderFilter.charAt(0).toUpperCase() + genderFilter.slice(1)}</strong>
              </span>
            </div>

            {/* Pie Chart */}
            {chartType === 'pie' && reportType === 'gender-by-age' && summary && summary.maleCount !== undefined ? (
              <div className="pie-chart-container">
                <svg viewBox="0 0 400 300" className="pie-chart">
                  {(() => {
                    const total = summary.maleCount + summary.femaleCount;
                    const malePercent = total > 0 ? (summary.maleCount / total) * 100 : 0;
                    // eslint-disable-next-line no-unused-vars
                    const femalePercent = total > 0 ? (summary.femaleCount / total) * 100 : 0;
                    const maleAngle = (malePercent / 100) * 360;
                    const centerX = 200;
                    const centerY = 130;
                    const radius = 100;
                    
                    // Calculate arc paths
                    const polarToCartesian = (cx, cy, r, angle) => {
                      const rad = (angle - 90) * Math.PI / 180;
                      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
                    };
                    
                    const describeArc = (cx, cy, r, startAngle, endAngle) => {
                      const start = polarToCartesian(cx, cy, r, endAngle);
                      const end = polarToCartesian(cx, cy, r, startAngle);
                      const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
                      return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
                    };
                    
                    return (
                      <>
                        {/* Male slice (blue) */}
                        {summary.maleCount > 0 && (
                          <path
                            d={describeArc(centerX, centerY, radius, 0, maleAngle)}
                            className="pie-slice-male"
                          />
                        )}
                        {/* Female slice (pink) */}
                        {summary.femaleCount > 0 && (
                          <path
                            d={describeArc(centerX, centerY, radius, maleAngle, 360)}
                            className="pie-slice-female"
                          />
                        )}
                        {/* Center labels */}
                        <text x={centerX} y={centerY - 10} className="pie-center-label">
                          {total}
                        </text>
                        <text x={centerX} y={centerY + 15} className="pie-center-sublabel">
                          Total
                        </text>
                      </>
                    );
                  })()}
                </svg>
                
                {/* Pie Legend with counts */}
                <div className="pie-legend">
                  <div className="pie-legend-item">
                    <span className="legend-color male"></span>
                    <span>Male: <strong>{summary.maleCount}</strong> ({((summary.maleCount / (summary.maleCount + summary.femaleCount)) * 100).toFixed(1)}%)</span>
                  </div>
                  <div className="pie-legend-item">
                    <span className="legend-color female"></span>
                    <span>Female: <strong>{summary.femaleCount}</strong> ({((summary.femaleCount / (summary.maleCount + summary.femaleCount)) * 100).toFixed(1)}%)</span>
                  </div>
                </div>
              </div>
            ) : chartType === 'pie' && reportType === 'gender-by-age' ? (
              <div className="pie-chart-container">
                <div className="loading-placeholder">
                  <span>📊 Loading gender distribution data...</span>
                </div>
              </div>
            ) : null}

            {/* Horizontal Bar Chart for all report types EXCEPT member-acquisition */}
            {chartType === 'bar' && reportType !== 'member-acquisition' && (
              <>
                <div className="horizontal-bar-chart">
                  <svg 
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className="horizontal-bar-chart-svg"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    {/* Vertical grid lines */}
                    {yTicks.map((tick, i) => (
                      <line
                        key={`grid-${i}`}
                        x1={xScale(tick)}
                        y1={padding.top}
                        x2={xScale(tick)}
                        y2={chartHeight - padding.bottom}
                        className="grid-line"
                      />
                    ))}

                    {/* Y-axis */}
                    <line
                      x1={padding.left}
                      y1={padding.top}
                      x2={padding.left}
                      y2={chartHeight - padding.bottom}
                      className="axis-line"
                    />

                    {/* X-axis */}
                    <line
                      x1={padding.left}
                      y1={chartHeight - padding.bottom}
                      x2={chartWidth - padding.right}
                      y2={chartHeight - padding.bottom}
                      className="axis-line"
                    />

                    {/* X-axis labels */}
                    {yTicks.map((tick, i) => (
                      <text
                        key={`x-label-${i}`}
                        x={xScale(tick)}
                        y={chartHeight - padding.bottom + 25}
                        className="axis-label x-label"
                        textAnchor="middle"
                      >
                        {tick}
                      </text>
                    ))}

                    {/* Y-axis labels */}
                    {data.map((d, i) => {
                      let label;
                      if (reportType === 'gender-by-age') {
                        label = d.ageRange || `Age ${d.ageGroup}`;
                      } else if (reportType === 'by-location') {
                        label = d.location;
                      } else if (reportType === 'member-acquisition') {
                        label = d.periodLabel;
                      } else {
                        label = d.profession;
                      }
                      
                      const itemHeight = innerHeight / data.length;
                      const y = padding.top + (i * itemHeight) + (itemHeight / 2);
                      return (
                        <text
                          key={`y-label-${i}`}
                          x={padding.left - 10}
                          y={y}
                          className="axis-label y-label"
                          textAnchor="end"
                          dominantBaseline="middle"
                        >
                          {label?.length > 25 ? `${label.substring(0, 25)}...` : label}
                        </text>
                      );
                    })}

                    {/* Axis titles */}
                    <text
                      x={chartWidth / 2}
                      y={chartHeight - 10}
                      className="axis-title"
                      textAnchor="middle"
                    >
                      Count
                    </text>
                    <text
                      x={20}
                      y={chartHeight / 2}
                      className="axis-title"
                      textAnchor="middle"
                      transform={`rotate(-90, 20, ${chartHeight / 2})`}
                    >
                      {reportType === 'gender-by-age' ? 'Age' : reportType === 'by-location' ? 'Location' : reportType === 'member-acquisition' ? 'Month' : 'Profession'}
                    </text>

                    {/* Horizontal bars */}
                    {data.map((d, i) => {
                      const itemHeight = innerHeight / data.length;
                      const barHeight = Math.max(4, itemHeight - 8);
                      const barY = padding.top + (i * itemHeight) + (itemHeight - barHeight) / 2;
                      const maxBarWidth = innerWidth - 10;
                      const barWidth = Math.min((d.count / maxCount) * maxBarWidth, maxBarWidth);
                      
                      return (
                        <g key={`bar-${i}`} className="horizontal-bar-group">
                          {/* Total bar */}
                          <rect
                            x={padding.left}
                            y={barY}
                            width={barWidth}
                            height={barHeight}
                            className="bar-total"
                            onClick={() => handleDataPointClick(d)}
                            style={{ cursor: 'pointer' }}
                          />
                          {/* Male portion */}
                          {(d.maleCount || 0) > 0 && (
                            <>
                              <rect
                                x={padding.left}
                                y={barY}
                                width={Math.min((d.maleCount / maxCount) * maxBarWidth, maxBarWidth)}
                                height={barHeight / 2 - 1}
                                className="bar-male"
                                onClick={() => handleDataPointClick(d)}
                                style={{ cursor: 'pointer' }}
                              />
                              {/* Male count label */}
                              <text
                                x={padding.left + Math.min((d.maleCount / maxCount) * maxBarWidth, maxBarWidth) - 5}
                                y={barY + (barHeight / 2 - 1) / 2}
                                className="data-label"
                                dominantBaseline="middle"
                                textAnchor="end"
                                style={{ fontSize: '10px', fill: '#fff' }}
                              >
                                {d.maleCount}
                              </text>
                            </>
                          )}
                          {/* Female portion */}
                          {(d.femaleCount || 0) > 0 && (
                            <>
                              <rect
                                x={padding.left}
                                y={barY + barHeight / 2 + 1}
                                width={Math.min((d.femaleCount / maxCount) * maxBarWidth, maxBarWidth)}
                                height={barHeight / 2 - 1}
                                className="bar-female"
                                onClick={() => handleDataPointClick(d)}
                                style={{ cursor: 'pointer' }}
                              />
                              {/* Female count label */}
                              <text
                                x={padding.left + Math.min((d.femaleCount / maxCount) * maxBarWidth, maxBarWidth) - 5}
                                y={barY + barHeight / 2 + 1 + (barHeight / 2 - 1) / 2}
                                className="data-label"
                                dominantBaseline="middle"
                                textAnchor="end"
                                style={{ fontSize: '10px', fill: '#fff' }}
                              >
                                {d.femaleCount}
                              </text>
                            </>
                          )}
                          {/* Total count label */}
                          <text
                            x={padding.left + barWidth + 8}
                            y={barY + barHeight / 2}
                            className="data-label"
                            dominantBaseline="middle"
                          >
                            {d.count}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                <div className="chart-legend">
                  <div className="legend-item">
                    <span className="legend-color male"></span>
                    <span>Male</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color female"></span>
                    <span>Female</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color total"></span>
                    <span>Total</span>
                  </div>
                </div>

                <p className="chart-hint">
                  💡 Click on any bar to see the list of members in that category
                </p>

                {/* Location Data Table */}
                {reportType === 'by-location' && (
                  <div className="location-table-section">
                    <button
                      className={`table-toggle-btn${showLocationTable ? ' active' : ''}`}
                      onClick={() => setShowLocationTable(v => !v)}
                    >
                      📋 {showLocationTable ? 'Hide Table' : 'Show Data Table'}
                    </button>

                    {showLocationTable && (
                      <div className="location-table-wrapper">
                        <table className="location-data-table">
                          <thead>
                            <tr>
                              <th className="sortable-th" onClick={() => handleTableSort('state')}>
                                State {locationSortField === 'state' ? (locationSortDir === 'asc' ? '↑' : '↓') : <span className="sort-hint">↕</span>}
                              </th>
                              <th className="sortable-th" onClick={() => handleTableSort('location')}>
                                Location {locationSortField === 'location' ? (locationSortDir === 'asc' ? '↑' : '↓') : <span className="sort-hint">↕</span>}
                              </th>
                              <th className="sortable-th" onClick={() => handleTableSort('maleCount')}>
                                Male {locationSortField === 'maleCount' ? (locationSortDir === 'asc' ? '↑' : '↓') : <span className="sort-hint">↕</span>}
                              </th>
                              <th className="sortable-th" onClick={() => handleTableSort('femaleCount')}>
                                Female {locationSortField === 'femaleCount' ? (locationSortDir === 'asc' ? '↑' : '↓') : <span className="sort-hint">↕</span>}
                              </th>
                              <th className="sortable-th" onClick={() => handleTableSort('count')}>
                                Total {locationSortField === 'count' ? (locationSortDir === 'asc' ? '↑' : '↓') : <span className="sort-hint">↕</span>}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupByState(sortedLocationData).map(stateGroup => (
                              <React.Fragment key={stateGroup.state}>
                                <tr className="state-row" onClick={() => toggleStateRow(stateGroup.state)}>
                                  <td>
                                    <span className="expand-icon">{expandedStates[stateGroup.state] ? '−' : '+'}</span>
                                    <strong>{stateGroup.state}</strong>
                                  </td>
                                  <td className="state-city-count">
                                    {stateGroup.cities.length} {stateGroup.cities.length === 1 ? 'city' : 'cities'}
                                  </td>
                                  <td>
                                    {stateGroup.maleCount > 0 ? (
                                      <button
                                        className="count-link male-count"
                                        onClick={e => { e.stopPropagation(); handleGenderClick({ location: stateGroup.state, users: stateGroup.cities.flatMap(c => c.users || []) }, 'male'); }}
                                      >
                                        +{stateGroup.maleCount}
                                      </button>
                                    ) : <span className="count-zero">0</span>}
                                  </td>
                                  <td>
                                    {stateGroup.femaleCount > 0 ? (
                                      <button
                                        className="count-link female-count"
                                        onClick={e => { e.stopPropagation(); handleGenderClick({ location: stateGroup.state, users: stateGroup.cities.flatMap(c => c.users || []) }, 'female'); }}
                                      >
                                        +{stateGroup.femaleCount}
                                      </button>
                                    ) : <span className="count-zero">0</span>}
                                  </td>
                                  <td>
                                    <button
                                      className="count-link total-count"
                                      onClick={e => { e.stopPropagation(); handleDataPointClick({ location: stateGroup.state, users: stateGroup.cities.flatMap(c => c.users || []), count: stateGroup.count, maleCount: stateGroup.maleCount, femaleCount: stateGroup.femaleCount }); }}
                                    >
                                      {stateGroup.count}
                                    </button>
                                  </td>
                                </tr>
                                {expandedStates[stateGroup.state] && stateGroup.cities.map(cityItem => (
                                  <tr key={cityItem.location} className="city-row">
                                    <td></td>
                                    <td className="city-name">↳ {cityItem.location}</td>
                                    <td>
                                      {(cityItem.maleCount || 0) > 0 ? (
                                        <button
                                          className="count-link male-count"
                                          onClick={() => handleGenderClick(cityItem, 'male')}
                                        >
                                          +{cityItem.maleCount}
                                        </button>
                                      ) : <span className="count-zero">0</span>}
                                    </td>
                                    <td>
                                      {(cityItem.femaleCount || 0) > 0 ? (
                                        <button
                                          className="count-link female-count"
                                          onClick={() => handleGenderClick(cityItem, 'female')}
                                        >
                                          +{cityItem.femaleCount}
                                        </button>
                                      ) : <span className="count-zero">0</span>}
                                    </td>
                                    <td>
                                      <button
                                        className="count-link total-count"
                                        onClick={() => handleDataPointClick(cityItem)}
                                      >
                                        {cityItem.count}
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Vertical Bar Chart for member-acquisition (Month on X, Count on Y) */}
            {chartType === 'bar' && reportType === 'member-acquisition' && (() => {
              const vPadding = { top: 30, right: 30, bottom: 80, left: 60 };
              const vChartHeight = 420;
              const vChartWidth = Math.max(800, data.length * 90 + vPadding.left + vPadding.right);
              const vInnerWidth = vChartWidth - vPadding.left - vPadding.right;
              const vInnerHeight = vChartHeight - vPadding.top - vPadding.bottom;
              // Y-axis max based on the largest value across all three bars per month
              // (total is usually the largest since total = male + female).
              const vMax = Math.max(
                ...data.map(d => Math.max(d.count || 0, d.maleCount || 0, d.femaleCount || 0)),
                1
              );
              const vTickCount = 5;
              const vTicks = [];
              for (let i = 0; i <= vTickCount; i++) {
                vTicks.push(Math.round((vMax / vTickCount) * i));
              }
              const yScale = (count) =>
                vPadding.top + vInnerHeight - (count / vMax) * vInnerHeight;
              const groupWidth = vInnerWidth / Math.max(data.length, 1);
              // Three bars per group: male, female, total
              const barWidth = Math.min(22, (groupWidth - 16) / 3);

              return (
                <>
                  <div className="horizontal-bar-chart">
                    <svg
                      viewBox={`0 0 ${vChartWidth} ${vChartHeight}`}
                      className="horizontal-bar-chart-svg"
                      preserveAspectRatio="xMidYMid meet"
                    >
                      {/* Horizontal grid lines */}
                      {vTicks.map((tick, i) => (
                        <line
                          key={`v-grid-${i}`}
                          x1={vPadding.left}
                          y1={yScale(tick)}
                          x2={vChartWidth - vPadding.right}
                          y2={yScale(tick)}
                          className="grid-line"
                        />
                      ))}

                      {/* Y-axis */}
                      <line
                        x1={vPadding.left}
                        y1={vPadding.top}
                        x2={vPadding.left}
                        y2={vChartHeight - vPadding.bottom}
                        className="axis-line"
                      />

                      {/* X-axis */}
                      <line
                        x1={vPadding.left}
                        y1={vChartHeight - vPadding.bottom}
                        x2={vChartWidth - vPadding.right}
                        y2={vChartHeight - vPadding.bottom}
                        className="axis-line"
                      />

                      {/* Y-axis tick labels */}
                      {vTicks.map((tick, i) => (
                        <text
                          key={`v-y-label-${i}`}
                          x={vPadding.left - 8}
                          y={yScale(tick)}
                          className="axis-label y-label"
                          textAnchor="end"
                          dominantBaseline="middle"
                        >
                          {tick}
                        </text>
                      ))}

                      {/* X-axis month labels */}
                      {data.map((d, i) => {
                        const cx = vPadding.left + groupWidth * i + groupWidth / 2;
                        const y = vChartHeight - vPadding.bottom + 20;
                        return (
                          <text
                            key={`v-x-label-${i}`}
                            x={cx}
                            y={y}
                            className="axis-label x-label"
                            textAnchor="end"
                            transform={`rotate(-35, ${cx}, ${y})`}
                          >
                            {d.periodLabel}
                          </text>
                        );
                      })}

                      {/* Axis titles */}
                      <text
                        x={vChartWidth / 2}
                        y={vChartHeight - 6}
                        className="axis-title"
                        textAnchor="middle"
                      >
                        Month
                      </text>
                      <text
                        x={18}
                        y={vChartHeight / 2}
                        className="axis-title"
                        textAnchor="middle"
                        transform={`rotate(-90, 18, ${vChartHeight / 2})`}
                      >
                        Count
                      </text>

                      {/* Triplet bars per month: male, female, total */}
                      {data.map((d, i) => {
                        const groupX = vPadding.left + groupWidth * i;
                        const centerX = groupX + groupWidth / 2;
                        // Three bars centered around the group center, 2px gap between them
                        const gap = 2;
                        const triWidth = barWidth * 3 + gap * 2;
                        const maleX = centerX - triWidth / 2;
                        const femaleX = maleX + barWidth + gap;
                        const totalX = femaleX + barWidth + gap;
                        const baseY = vChartHeight - vPadding.bottom;
                        const maleH = ((d.maleCount || 0) / vMax) * vInnerHeight;
                        const femaleH = ((d.femaleCount || 0) / vMax) * vInnerHeight;
                        const totalH = ((d.count || 0) / vMax) * vInnerHeight;

                        return (
                          <g key={`v-bar-${i}`} className="vertical-bar-group">
                            {/* Invisible click target for the whole group (rendered first so bars stay on top) */}
                            <rect
                              x={groupX}
                              y={vPadding.top}
                              width={groupWidth}
                              height={vInnerHeight}
                              fill="transparent"
                              onClick={() => handleDataPointClick(d)}
                              style={{ cursor: 'pointer' }}
                            />
                            {/* Male bar */}
                            {(d.maleCount || 0) > 0 && (
                              <>
                                <rect
                                  x={maleX}
                                  y={baseY - maleH}
                                  width={barWidth}
                                  height={maleH}
                                  className="bar-male"
                                  onClick={() => handleDataPointClick(d)}
                                  style={{ cursor: 'pointer' }}
                                />
                                <text
                                  x={maleX + barWidth / 2}
                                  y={baseY - maleH - 4}
                                  className="data-label"
                                  textAnchor="middle"
                                  style={{ fontSize: '11px' }}
                                >
                                  {d.maleCount}
                                </text>
                              </>
                            )}
                            {/* Female bar */}
                            {(d.femaleCount || 0) > 0 && (
                              <>
                                <rect
                                  x={femaleX}
                                  y={baseY - femaleH}
                                  width={barWidth}
                                  height={femaleH}
                                  className="bar-female"
                                  onClick={() => handleDataPointClick(d)}
                                  style={{ cursor: 'pointer' }}
                                />
                                <text
                                  x={femaleX + barWidth / 2}
                                  y={baseY - femaleH - 4}
                                  className="data-label"
                                  textAnchor="middle"
                                  style={{ fontSize: '11px' }}
                                >
                                  {d.femaleCount}
                                </text>
                              </>
                            )}
                            {/* Total bar */}
                            {(d.count || 0) > 0 && (
                              <>
                                <rect
                                  x={totalX}
                                  y={baseY - totalH}
                                  width={barWidth}
                                  height={totalH}
                                  className="bar-total"
                                  onClick={() => handleDataPointClick(d)}
                                  style={{ cursor: 'pointer' }}
                                />
                                <text
                                  x={totalX + barWidth / 2}
                                  y={baseY - totalH - 4}
                                  className="data-label"
                                  textAnchor="middle"
                                  style={{ fontSize: '11px', fontWeight: 600 }}
                                >
                                  {d.count}
                                </text>
                              </>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  <div className="chart-legend">
                    <div className="legend-item">
                      <span className="legend-color male"></span>
                      <span>Male</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color female"></span>
                      <span>Female</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color total"></span>
                      <span>Total</span>
                    </div>
                  </div>

                  <p className="chart-hint">
                    💡 Click on any bar to see the members who joined that month
                  </p>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Modal for user list */}
      {showModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {reportType === 'gender-by-age' && `👥 Members ${selectedItem.ageRange || `Age ${selectedItem.ageGroup}`}`}
                {reportType === 'by-location' && `📍 Members in ${selectedItem.location}${selectedItem._genderFilter ? ` — ${selectedItem._genderFilter.charAt(0).toUpperCase() + selectedItem._genderFilter.slice(1)} only` : ''}`}
                {reportType === 'by-profession' && `💼 Members in ${selectedItem.profession}`}
                {reportType === 'member-acquisition' && `📈 Members Joined ${selectedItem.periodLabel}`}
                <span className="user-count">({selectedItem.count} members)</span>
              </h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="user-list">
                {selectedItem.users.map((user, i) => (
                  <div 
                    key={i} 
                    className="user-item"
                    onClick={() => openProfile(user.username)}
                  >
                    <span className="profile-id">{user.profileId || user.username}</span>
                    <span className="user-name">
                      {user.firstName} {user.lastName}
                    </span>
                    <span className="user-gender">
                      {user.gender?.toLowerCase() === 'male' ? '👨' : '👩'}
                    </span>
                    <span className="open-link">↗</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReports;
