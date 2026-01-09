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
  const [reportData, setReportData] = useState(null);
  const [selectedAge, setSelectedAge] = useState(null);
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
      const response = await api.get(`/api/admin/reports/gender-by-age${params}`);
      if (response.data.success) {
        setReportData(response.data);
      }
    } catch (err) {
      console.error('Error fetching report:', err);
      setError(err.response?.data?.detail || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [genderFilter]);

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
  const handleDataPointClick = (ageData) => {
    setSelectedAge(ageData);
    setShowModal(true);
  };

  // Open profile in new tab
  const openProfile = (username) => {
    window.open(`/profile/${username}`, '_blank');
  };

  // Calculate chart dimensions
  const chartWidth = 800;
  const chartHeight = 400;
  const padding = { top: 40, right: 40, bottom: 60, left: 60 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  // Get chart data
  const data = reportData?.data || [];
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const minAge = Math.min(...data.map(d => d.age), 18);
  const maxAge = Math.max(...data.map(d => d.age), 60);

  // Scale functions
  const xScale = (age) => padding.left + ((age - minAge) / (maxAge - minAge)) * innerWidth;
  const yScale = (count) => padding.top + innerHeight - (count / maxCount) * innerHeight;

  // Generate path for line chart
  const linePath = data.length > 0
    ? data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(d.age)} ${yScale(d.count)}`).join(' ')
    : '';

  // Generate Y-axis ticks
  const yTicks = [];
  const tickCount = 5;
  for (let i = 0; i <= tickCount; i++) {
    const value = Math.round((maxCount / tickCount) * i);
    yTicks.push(value);
  }

  // Generate X-axis ticks (every 5 years)
  const xTicks = [];
  for (let age = Math.ceil(minAge / 5) * 5; age <= maxAge; age += 5) {
    xTicks.push(age);
  }

  return (
    <div className="admin-reports-page">
      <div className="admin-reports-header">
        <h1>📊 Admin Reports</h1>
        <p className="subtitle">User analytics and statistics</p>
      </div>

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

      {/* Gender by Age Report */}
      <div className="report-section">
        <div className="report-header">
          <h2>👤 Members by Age Distribution</h2>
          <div className="filter-controls">
            <label>Chart:</label>
            <select 
              value={chartType} 
              onChange={(e) => setChartType(e.target.value)}
              className="chart-type-select"
            >
              <option value="bar">📊 Bar</option>
              <option value="pie">🥧 Pie</option>
            </select>
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
            {chartType === 'pie' && summary && (
              <div className="pie-chart-container">
                <svg viewBox="0 0 400 300" className="pie-chart">
                  {(() => {
                    const total = summary.maleCount + summary.femaleCount;
                    const malePercent = total > 0 ? (summary.maleCount / total) * 100 : 0;
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
            )}

            {/* Bar/Line Chart */}
            {chartType === 'bar' && (
            <>
            <svg 
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="line-chart"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Grid lines */}
              {yTicks.map((tick, i) => (
                <line
                  key={`grid-${i}`}
                  x1={padding.left}
                  y1={yScale(tick)}
                  x2={chartWidth - padding.right}
                  y2={yScale(tick)}
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

              {/* Y-axis labels */}
              {yTicks.map((tick, i) => (
                <text
                  key={`y-label-${i}`}
                  x={padding.left - 10}
                  y={yScale(tick)}
                  className="axis-label y-label"
                >
                  {tick}
                </text>
              ))}

              {/* X-axis labels */}
              {xTicks.map((tick, i) => (
                <text
                  key={`x-label-${i}`}
                  x={xScale(tick)}
                  y={chartHeight - padding.bottom + 25}
                  className="axis-label x-label"
                >
                  {tick}
                </text>
              ))}

              {/* Axis titles */}
              <text
                x={chartWidth / 2}
                y={chartHeight - 10}
                className="axis-title"
              >
                Age
              </text>
              <text
                x={-chartHeight / 2}
                y={20}
                className="axis-title"
                transform="rotate(-90)"
              >
                Count
              </text>

              {/* Bar chart - Male (blue) and Female (pink) */}
              {data.map((d, i) => {
                const barWidth = Math.max(6, innerWidth / (data.length * 4));
                const barX = xScale(d.age);
                const barBottom = chartHeight - padding.bottom;
                
                // Use yScale for proper positioning (same as line chart)
                const maleBarTop = yScale(d.maleCount || 0);
                const femaleBarTop = yScale(d.femaleCount || 0);
                const maleHeight = barBottom - maleBarTop;
                const femaleHeight = barBottom - femaleBarTop;
                
                return (
                  <g key={`bars-${i}`} className="bar-group">
                    {/* Male bar (blue) - left side */}
                    {(d.maleCount || 0) > 0 && (
                      <rect
                        x={barX - barWidth - 2}
                        y={maleBarTop}
                        width={barWidth}
                        height={maleHeight}
                        className="bar-male"
                        onClick={() => handleDataPointClick(d)}
                      />
                    )}
                    {/* Female bar (pink) - right side */}
                    {(d.femaleCount || 0) > 0 && (
                      <rect
                        x={barX + 2}
                        y={femaleBarTop}
                        width={barWidth}
                        height={femaleHeight}
                        className="bar-female"
                        onClick={() => handleDataPointClick(d)}
                      />
                    )}
                  </g>
                );
              })}

              {/* Line path */}
              {linePath && (
                <path
                  d={linePath}
                  className="chart-line"
                  fill="none"
                />
              )}

              {/* Data points */}
              {data.map((d, i) => (
                <g key={i} className="data-point-group">
                  <circle
                    cx={xScale(d.age)}
                    cy={yScale(d.count)}
                    r={8}
                    className="data-point"
                    onClick={() => handleDataPointClick(d)}
                  />
                  <text
                    x={xScale(d.age)}
                    y={yScale(d.count) - 15}
                    className="data-label"
                  >
                    {d.count}
                  </text>
                </g>
              ))}
            </svg>

            {/* Legend */}
            <div className="chart-legend">
              <div className="legend-item">
                <span className="legend-color male"></span>
                <span>Male</span>
              </div>
              <div className="legend-item">
                <span className="legend-color female"></span>
                <span>Female</span>
              </div>
            </div>

            <p className="chart-hint">
              💡 Click on any data point or bar to see the list of members at that age
            </p>
            </>
            )}
          </div>
        )}
      </div>

      {/* Modal for user list */}
      {showModal && selectedAge && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                👥 Members Age {selectedAge.age}
                <span className="user-count">({selectedAge.count} members)</span>
              </h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="user-list">
                {selectedAge.users.map((user, i) => (
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
