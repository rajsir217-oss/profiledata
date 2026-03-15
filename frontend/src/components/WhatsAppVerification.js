import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { getBackendUrl } from '../config/apiConfig';
import './WhatsAppVerification.css';

const WhatsAppVerification = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Check admin access
  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin') {
      console.warn('⚠️ Unauthorized access attempt to WhatsApp Verification');
      navigate('/dashboard');
      return;
    }
    loadStats();
  }, [navigate]);

  const loadStats = async () => {
    try {
      const response = await api.get(`${getBackendUrl()}/api/whatsapp/verification-stats`);
      setStats(response.data);
    } catch (err) {
      console.error('Failed to load stats:', err);
      setError('Failed to load statistics');
    }
  };

  const handleExport = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await api.get(`${getBackendUrl()}/api/whatsapp/export-registered`, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'registered_numbers.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setSuccess('✅ Registered numbers exported successfully!');
    } catch (err) {
      console.error('Export failed:', err);
      setError('Failed to export registered numbers');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
        setError('Please select a CSV or TXT file');
        return;
      }
      setSelectedFile(file);
      setError('');
      setSuccess('');
      setComparisonResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('group_file', selectedFile);

    try {
      const response = await api.post(`${getBackendUrl()}/api/whatsapp/compare-group`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setComparisonResult(response.data);
      setSuccess('✅ Comparison completed successfully!');
    } catch (err) {
      console.error('Comparison failed:', err);
      setError(err.response?.data?.detail || 'Failed to compare group data');
    } finally {
      setUploading(false);
    }
  };

  const formatDate = () => {
    return new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="whatsapp-verification">
      <div className="page-header">
        <h1>📱 WhatsApp Group Verification</h1>
        <p>Verify WhatsApp group members against registered users</p>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      {/* Statistics Section */}
      {stats && (
        <div className="stats-section">
          <h2>📊 Database Statistics</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-number">{stats.total_registered_users}</div>
              <div className="stat-label">Total Registered Users</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{stats.users_with_phone}</div>
              <div className="stat-label">Users with Phone Numbers</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{stats.active_users}</div>
              <div className="stat-label">Active Users</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{stats.phone_coverage}%</div>
              <div className="stat-label">Phone Coverage</div>
            </div>
          </div>
        </div>
      )}

      {/* Export Section */}
      <div className="export-section">
        <h2>📤 Export Registered Numbers</h2>
        <p>Download all registered user phone numbers for comparison</p>
        <button 
          className="btn btn-primary"
          onClick={handleExport}
          disabled={loading}
        >
          {loading ? '⏳ Exporting...' : '📥 Export Registered Numbers'}
        </button>
      </div>

      {/* Upload Section */}
      <div className="upload-section">
        <h2>📤 Upload WhatsApp Group Data</h2>
        <p>Upload your WhatsApp group export (CSV format)</p>
        
        <div className="upload-area">
          <input
            type="file"
            accept=".csv,.txt"
            onChange={handleFileSelect}
            className="file-input"
            id="group-file"
          />
          <label htmlFor="group-file" className="file-label">
            {selectedFile ? `📄 ${selectedFile.name}` : '📁 Choose CSV file...'}
          </label>
          
          {selectedFile && (
            <button
              className="btn btn-success"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? '⏳ Comparing...' : '🔍 Compare with Database'}
            </button>
          )}
        </div>

        <div className="format-info">
          <h4>Expected CSV Format:</h4>
          <ul>
            <li>Column names: Name, Phone (or Contact/Number)</li>
            <li>Phone numbers in any format (will be normalized)</li>
            <li>Export from WhatsApp: Group Info {'>'} Members {'>'} Export</li>
          </ul>
        </div>
      </div>

      {/* Comparison Results */}
      {comparisonResult && (
        <div className="results-section">
          <h2>📊 Comparison Results</h2>
          <div className="results-summary">
            <div className="summary-cards">
              <div className="summary-card verified">
                <div className="card-number">{comparisonResult.summary.verified_count}</div>
                <div className="card-label">✅ Verified Members</div>
              </div>
              <div className="summary-card unauthorized">
                <div className="card-number">{comparisonResult.summary.unauthorized_count}</div>
                <div className="card-label">⚠️ Unauthorized Members</div>
              </div>
              <div className="summary-card missing">
                <div className="card-number">{comparisonResult.summary.not_in_group_count}</div>
                <div className="card-label">❓ Not in Group</div>
              </div>
              <div className="summary-card rate">
                <div className="card-number">{comparisonResult.summary.verification_rate}%</div>
                <div className="card-label">📈 Verification Rate</div>
              </div>
            </div>
          </div>

          {/* Unauthorized Members */}
          {comparisonResult.unauthorized_members.length > 0 && (
            <div className="unauthorized-section">
              <h3>⚠️ Unauthorized Members ({comparisonResult.unauthorized_members.length})</h3>
              <div className="members-list">
                {comparisonResult.unauthorized_members.map((member, index) => (
                  <div key={index} className="member-item unauthorized">
                    <div className="member-info">
                      <div className="member-name">{member.name}</div>
                      <div className="member-phone">{member.phone}</div>
                    </div>
                    <div className="member-status">❌ Not Registered</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verified Members */}
          {comparisonResult.verified_members.length > 0 && (
            <div className="verified-section">
              <h3>✅ Verified Members ({comparisonResult.verified_members.length})</h3>
              <div className="members-list">
                {comparisonResult.verified_members.map((member, index) => (
                  <div key={index} className="member-item verified">
                    <div className="member-info">
                      <div className="member-name">{member.name}</div>
                      <div className="member-phone">{member.phone}</div>
                      <div className="member-registered">
                        {'→'} {member.registered_user.full_name} ({member.registered_user.username})
                      </div>
                    </div>
                    <div className="member-status">✅ Verified</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Registered Not in Group */}
          {comparisonResult.registered_not_in_group.length > 0 && (
            <div className="missing-section">
              <h3>❓ Registered Users Not in Group ({comparisonResult.registered_not_in_group.length})</h3>
              <div className="members-list">
                {comparisonResult.registered_not_in_group.map((user, index) => (
                  <div key={index} className="member-item missing">
                    <div className="member-info">
                      <div className="member-name">{user.full_name}</div>
                      <div className="member-username">@{user.username}</div>
                      <div className="member-phone">{user.original_phone}</div>
                    </div>
                    <div className="member-status">❓ Not in Group</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="last-updated">
            Last updated: {formatDate()}
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppVerification;
