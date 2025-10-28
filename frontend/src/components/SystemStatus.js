import React, { useState, useEffect } from 'react';
import api from '../api';
import './SystemStatus.css';

const SystemStatus = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSystemStatus();
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
              className="status-badge"
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
              className="status-badge"
              style={{ color: getStatusColor(status?.services?.redis?.healthy) }}
            >
              {getStatusIcon(status?.services?.redis?.healthy)} 
              {status?.services?.redis?.healthy ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Firebase */}
        <div className="service-status-item">
          <div className="service-info">
            <span className="service-icon">🔥</span>
            <div className="service-details">
              <span className="service-name">Firebase</span>
              <span className="service-description">
                Push Notifications
              </span>
            </div>
          </div>
          <div className="service-status">
            <span 
              className="status-badge"
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
              className="status-badge"
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
