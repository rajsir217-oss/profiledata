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
  const [reportType, setReportType] = useState('gender-by-age'); // 'gender-by-age', 'by-location', 'by-profession'
  const [reportData, setReportData] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [summary, setSummary] = useState(null);

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
      const params = genderFilter !== 'all' ? `?gender=${genderFilter}` : '';
      const response = await api.get(`/api/admin/reports/${reportType}${params}`);
      if (response.data.success) {
        setReportData(response.data);
      }
    } catch (err) {
      console.error('Error fetching report:', err);
      setError(err.response?.data?.detail || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [genderFilter, reportType]);

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
            </select>
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

            {/* Horizontal Bar Chart for all report types */}
            {chartType === 'bar' && (
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
                      {reportType === 'gender-by-age' ? 'Age' : reportType === 'by-location' ? 'Location' : 'Profession'}
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
              </>
            )}
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
                {reportType === 'by-location' && `📍 Members in ${selectedItem.location}`}
                {reportType === 'by-profession' && `💼 Members in ${selectedItem.profession}`}
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
