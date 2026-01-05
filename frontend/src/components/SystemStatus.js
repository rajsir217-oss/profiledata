import React, { useState, useEffect } from 'react';
import api from '../api';
import './SystemStatus.css';

const SystemStatus = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [frontendBuildInfo, setFrontendBuildInfo] = useState(null);
  const [storageStats, setStorageStats] = useState(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [showAllCollections, setShowAllCollections] = useState(false);

  // Check frontend Firebase configuration
  const frontendFirebaseConfigured = Boolean(
    process.env.REACT_APP_FIREBASE_API_KEY &&
    process.env.REACT_APP_FIREBASE_PROJECT_ID &&
    process.env.REACT_APP_FIREBASE_VAPID_KEY
  );

  useEffect(() => {
    loadSystemStatus();
    loadFrontendBuildInfo();
    loadStorageStats();
    // Refresh every 30 seconds
    const interval = setInterval(loadSystemStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadSystemStatus = async () => {
    try {
      setLoading(true);
      const response = await api.get('/system/health');
      setStatus(response.data);
      setError(null);
    } catch (err) {
      console.error('Error loading system status:', err);
      setError('Failed to load system status');
    } finally {
      setLoading(false);
    }
  };

  const loadFrontendBuildInfo = async () => {
    try {
      const response = await fetch('/build-info.json');
      const data = await response.json();
      setFrontendBuildInfo(data);
    } catch (err) {
      console.error('Error loading frontend build info:', err);
      // Fallback to default values
      setFrontendBuildInfo({
        buildTime: 'unknown',
        buildDate: 'unknown',
        version: '1.0.0'
      });
    }
  };

  const loadStorageStats = async () => {
    try {
      setStorageLoading(true);
      const response = await api.get('/system/health/storage');
      setStorageStats(response.data);
    } catch (err) {
      console.error('Error loading storage stats:', err);
    } finally {
      setStorageLoading(false);
    }
  };

  const getStorageStatusColor = (status) => {
    const colors = {
      healthy: 'var(--success-color, #10b981)',
      warning: 'var(--warning-color, #f59e0b)',
      critical: 'var(--warning-color, #f97316)',
      danger: 'var(--error-color, #ef4444)',
      error: 'var(--error-color, #ef4444)'
    };
    return colors[status] || colors.healthy;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      critical: '#ef4444',
      high: '#f97316',
      medium: '#f59e0b',
      warning: '#f59e0b',
      low: '#3b82f6'
    };
    return colors[priority] || '#6b7280';
  };

  const getStatusIcon = (isHealthy) => {
    return isHealthy ? '✅' : '❌';
  };

  const getStatusColor = (isHealthy) => {
    return isHealthy ? 'var(--success-color, #10b981)' : 'var(--error-color, #ef4444)';
  };

  const getEnvironmentBadge = (env) => {
    const badges = {
      local: { text: 'Local', color: '#3b82f6' },
      dev: { text: 'Development', color: '#f59e0b' },
      stage: { text: 'Staging', color: '#8b5cf6' },
      production: { text: 'Production', color: '#ef4444' }
    };
    const badge = badges[env] || badges.local;
    return (
      <span 
        className="env-badge" 
        style={{ 
          background: badge.color,
          color: 'white',
          padding: '4px 12px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: '600'
        }}
      >
        {badge.text}
      </span>
    );
  };

  if (loading && !status) {
    return (
      <div className="system-status-container">
        <div className="loading-spinner">Loading system status...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="system-status-container">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="system-status-container">
      <div className="status-header">
        <h3>🔧 Backend Services Status</h3>
        <button 
          className="btn-refresh" 
          onClick={loadSystemStatus}
          disabled={loading}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Environment Info */}
      <div className="status-section">
        <div className="status-item">
          <span className="status-label">🌍 Environment:</span>
          <span className="status-value">
            {getEnvironmentBadge(status?.environment)}
          </span>
        </div>
        <div className="status-item">
          <span className="status-label">🏢 Backend URL:</span>
          <span className="status-value" style={{ fontSize: '13px', opacity: 0.8 }}>
            {status?.backend_url || 'N/A'}
          </span>
        </div>
      </div>

      {/* Service Status */}
      <div className="status-section">
        <h4 style={{ marginBottom: '12px', fontSize: '16px' }}>Services</h4>
        
        {/* MongoDB */}
        <div className="service-status-item">
          <div className="service-info">
            <span className="service-icon">🗄️</span>
            <div className="service-details">
              <span className="service-name">MongoDB</span>
              <span className="service-description">
                {status?.services?.mongodb?.details || 'Database'}
              </span>
            </div>
          </div>
          <div className="service-status">
            <span 
              
              style={{ color: getStatusColor(status?.services?.mongodb?.healthy) }}
            >
              {getStatusIcon(status?.services?.mongodb?.healthy)} 
              {status?.services?.mongodb?.healthy ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Redis */}
        <div className="service-status-item">
          <div className="service-info">
            <span className="service-icon">🔴</span>
            <div className="service-details">
              <span className="service-name">Redis</span>
              <span className="service-description">
                {status?.services?.redis?.details || 'Cache & Sessions'}
              </span>
            </div>
          </div>
          <div className="service-status">
            <span 
              
              style={{ color: getStatusColor(status?.services?.redis?.healthy) }}
            >
              {getStatusIcon(status?.services?.redis?.healthy)} 
              {status?.services?.redis?.healthy ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Firebase Backend */}
        <div className="service-status-item">
          <div className="service-info">
            <span className="service-icon">🔥</span>
            <div className="service-details">
              <span className="service-name">Firebase (Backend)</span>
              <span className="service-description">
                Server-side Push Notifications
              </span>
            </div>
          </div>
          <div className="service-status">
            <span 
              
              style={{ 
                color: status?.services?.firebase?.configured 
                  ? 'var(--success-color, #10b981)' 
                  : 'var(--warning-color, #f59e0b)' 
              }}
            >
              {status?.services?.firebase?.configured ? '✅ Configured' : '⚠️ Not Configured'}
            </span>
          </div>
        </div>

        {/* Firebase Frontend */}
        <div className="service-status-item">
          <div className="service-info">
            <span className="service-icon">🌐</span>
            <div className="service-details">
              <span className="service-name">Firebase (Frontend)</span>
              <span className="service-description">
                Browser Push Notifications
              </span>
            </div>
          </div>
          <div className="service-status">
            <span 
              
              style={{ 
                color: frontendFirebaseConfigured 
                  ? 'var(--success-color, #10b981)' 
                  : 'var(--error-color, #ef4444)' 
              }}
            >
              {frontendFirebaseConfigured ? '✅ Configured' : '❌ Not Configured'}
            </span>
          </div>
        </div>

        {/* Storage */}
        <div className="service-status-item">
          <div className="service-info">
            <span className="service-icon">📦</span>
            <div className="service-details">
              <span className="service-name">Storage</span>
              <span className="service-description">
                {status?.services?.storage?.type === 'gcs' ? 'Google Cloud Storage' : 'Local File System'}
              </span>
            </div>
          </div>
          <div className="service-status">
            <span 
              
              style={{ color: 'var(--success-color, #10b981)' }}
            >
              ✅ {status?.services?.storage?.type === 'gcs' ? 'GCS' : 'Local'}
            </span>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="status-section">
        <h4 style={{ marginBottom: '12px', fontSize: '16px' }}>System Info</h4>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Uptime:</span>
            <span className="info-value">{status?.uptime || 'N/A'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Version:</span>
            <span className="info-value">{status?.version || '1.0.0'}</span>
          </div>
        </div>
      </div>

      {/* MongoDB Storage Stats */}
      <div className="status-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h4 style={{ fontSize: '16px', margin: 0 }}>💾 MongoDB Storage (Free Tier: 512 MB)</h4>
          <button 
            className="btn-refresh" 
            onClick={loadStorageStats}
            disabled={storageLoading}
            style={{ padding: '4px 10px', fontSize: '12px' }}
          >
            🔄 {storageLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        
        {storageStats ? (
          <>
            {/* Usage Progress Bar */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '14px', fontWeight: '600' }}>
                  {storageStats.totalSizeFormatted} / {storageStats.freeTierLimitFormatted}
                </span>
                <span style={{ 
                  fontSize: '14px', 
                  fontWeight: '600',
                  color: getStorageStatusColor(storageStats.status)
                }}>
                  {storageStats.usagePercent}% used
                </span>
              </div>
              <div style={{ 
                background: 'var(--surface-color, #e5e7eb)', 
                borderRadius: '8px', 
                height: '12px',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  background: getStorageStatusColor(storageStats.status),
                  width: `${Math.min(storageStats.usagePercent, 100)}%`,
                  height: '100%',
                  borderRadius: '8px',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '11px', opacity: 0.7 }}>
                <span>Data: {storageStats.dataSizeFormatted}</span>
                <span>Indexes: {storageStats.indexSizeFormatted}</span>
                <span>Documents: {storageStats.totalDocuments?.toLocaleString()}</span>
              </div>
            </div>

            {/* Collections Table */}
            <div style={{ 
              background: 'var(--surface-color, #f9fafb)', 
              borderRadius: '8px',
              overflow: 'hidden',
              marginBottom: '12px'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--hover-background, #f3f4f6)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '600' }}>Collection</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600' }}>Docs</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600' }}>Size</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600' }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllCollections ? storageStats.collections : storageStats.collections?.slice(0, 8))?.map((coll, idx) => (
                    <tr key={coll.name} style={{ 
                      borderTop: '1px solid var(--border-color, #e5e7eb)',
                      background: idx % 2 === 0 ? 'transparent' : 'var(--hover-background, #f9fafb)'
                    }}>
                      <td style={{ padding: '6px 12px' }}>
                        <span style={{ fontFamily: 'monospace' }}>{coll.name}</span>
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                        {coll.documents?.toLocaleString()}
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: '500' }}>
                        {coll.totalSizeFormatted}
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                        <span style={{ 
                          background: coll.percentOfTotal > 20 ? 'var(--warning-light, #fef3c7)' : 'var(--surface-color, #f3f4f6)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px'
                        }}>
                          {coll.percentOfTotal}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {storageStats.collections?.length > 8 && (
                <button
                  onClick={() => setShowAllCollections(!showAllCollections)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: 'var(--hover-background, #f3f4f6)',
                    border: 'none',
                    borderTop: '1px solid var(--border-color, #e5e7eb)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: 'var(--primary-color, #6366f1)'
                  }}
                >
                  {showAllCollections ? '▲ Show Less' : `▼ Show All ${storageStats.collections.length} Collections`}
                </button>
              )}
            </div>

            {/* Recommendations */}
            {storageStats.recommendations?.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <h5 style={{ fontSize: '13px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  💡 Optimization Recommendations
                </h5>
                {storageStats.recommendations.slice(0, 3).map((rec, idx) => (
                  <div key={idx} style={{ 
                    background: 'var(--surface-color, #f9fafb)',
                    border: `1px solid ${getPriorityColor(rec.priority)}20`,
                    borderLeft: `3px solid ${getPriorityColor(rec.priority)}`,
                    borderRadius: '6px',
                    padding: '10px 12px',
                    marginBottom: '8px',
                    fontSize: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '600' }}>{rec.collection}</span>
                      <span style={{ 
                        background: getPriorityColor(rec.priority),
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '10px',
                        textTransform: 'uppercase'
                      }}>
                        {rec.priority}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-secondary, #6b7280)', marginBottom: '4px' }}>{rec.issue}</div>
                    <div style={{ fontWeight: '500' }}>→ {rec.action}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : storageLoading ? (
          <div style={{ textAlign: 'center', padding: '20px', opacity: 0.6 }}>
            Loading storage stats...
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', opacity: 0.6 }}>
            Failed to load storage stats
          </div>
        )}
      </div>

      {/* Build Information */}
      <div className="status-section">
        <h4 style={{ marginBottom: '12px', fontSize: '16px' }}>📦 Build Information</h4>
        
        {/* Backend Build Info */}
        <div className="build-info-block" style={{ 
          background: 'var(--surface-color, #f9fafb)', 
          padding: '12px', 
          borderRadius: '8px',
          marginBottom: '12px'
        }}>
          <h5 style={{ fontSize: '14px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>⚙️</span> Backend
          </h5>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Build Date:</span>
              <span className="info-value" style={{ fontSize: '13px' }}>
                {status?.buildInfo?.buildDate || 'unknown'}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Version:</span>
              <span className="info-value">
                {status?.buildInfo?.version || '1.0.0'}
              </span>
            </div>
          </div>
        </div>

        {/* Frontend Build Info */}
        <div className="build-info-block" style={{ 
          background: 'var(--surface-color, #f9fafb)', 
          padding: '12px', 
          borderRadius: '8px'
        }}>
          <h5 style={{ fontSize: '14px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🌐</span> Frontend
          </h5>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Build Date:</span>
              <span className="info-value" style={{ fontSize: '13px' }}>
                {frontendBuildInfo?.buildDate || 'unknown'}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Version:</span>
              <span className="info-value">
                {frontendBuildInfo?.version || '1.0.0'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Last Updated */}
      <div className="status-footer">
        <span style={{ fontSize: '12px', opacity: 0.6 }}>
          Last updated: {new Date().toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
};

export default SystemStatus;
