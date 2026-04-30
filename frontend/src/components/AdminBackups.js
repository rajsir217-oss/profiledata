import React, { useState, useEffect, useCallback } from 'react';
import { createApiInstance } from '../api';
import { getBackendUrl } from '../config/apiConfig';
import Toast from './Toast';
import './AdminBackups.css';

const backupApi = createApiInstance(getBackendUrl());

const AdminBackups = () => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [gcsConfigured, setGcsConfigured] = useState(false);
  const [toast, setToast] = useState(null);
  const [restoreCommand, setRestoreCommand] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchBackups = useCallback(async () => {
    try {
      setLoading(true);
      const response = await backupApi.get('/api/admin/backups');
      setBackups(response.data.backups || []);
      setGcsConfigured(response.data.gcs_configured || false);
    } catch (error) {
      showToast('Failed to load backups: ' + (error.response?.data?.detail || error.message), 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const handleTriggerBackup = async () => {
    setTriggerLoading(true);
    showToast('Starting backup...', 'info');
    try {
      const response = await backupApi.post('/api/admin/backups/trigger');
      if (response.data.success) {
        showToast(response.data.message, 'success');
        await fetchBackups();
      } else {
        showToast(response.data.message || 'Backup failed', 'error');
      }
    } catch (error) {
      showToast('Backup failed: ' + (error.response?.data?.detail || error.message), 'error');
    } finally {
      setTriggerLoading(false);
    }
  };

  const handleDownload = async (filename) => {
    try {
      const response = await backupApi.get(`/api/admin/backups/download/${filename}`, {
        responseType: 'blob'
      });

      if (response.headers['content-type']?.includes('application/json')) {
        const text = await response.data.text();
        const json = JSON.parse(text);
        showToast(json.message || 'File on GCS only', 'warning');
        return;
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast('Download started', 'success');
    } catch (error) {
      showToast('Download failed: ' + (error.response?.data?.detail || error.message), 'error');
    }
  };

  const handleDelete = async (filename) => {
    if (deleteConfirm !== filename) {
      setDeleteConfirm(filename);
      setTimeout(() => setDeleteConfirm(null), 5000);
      return;
    }
    setDeleteConfirm(null);
    try {
      await backupApi.delete(`/api/admin/backups/${filename}`);
      showToast(`Deleted: ${filename}`, 'success');
      await fetchBackups();
    } catch (error) {
      showToast('Delete failed: ' + (error.response?.data?.detail || error.message), 'error');
    }
  };

  const handleRestoreCommand = async (filename) => {
    try {
      const response = await backupApi.get(`/api/admin/backups/restore-command/${filename}`);
      setRestoreCommand(response.data);
    } catch (error) {
      showToast('Failed to get restore command', 'error');
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (ts) => {
    if (!ts) return '—';
    try {
      const d = new Date(ts);
      return d.toLocaleString();
    } catch {
      return String(ts);
    }
  };

  return (
    <div className="admin-backups-page">
      <div className="backups-header">
        <div className="backups-actions">
          <button
            className="btn-trigger-backup"
            onClick={handleTriggerBackup}
            disabled={triggerLoading}
          >
            {triggerLoading ? (
              <><span className="btn-spinner"></span> Backing up...</>
            ) : (
              <>💾 Run Backup Now</>
            )}
          </button>
          <button className="btn-refresh" onClick={fetchBackups} disabled={loading}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="backups-stats">
        <div className="stat-card">
          <span className="stat-value">{backups.length}</span>
          <span className="stat-label">Total Backups</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{backups.filter(b => b.local_exists).length}</span>
          <span className="stat-label">Local Files</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{backups.filter(b => b.gcs_url).length}</span>
          <span className="stat-label">On GCS</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">
            {formatSize(backups.reduce((sum, b) => sum + (b.size_bytes || 0), 0))}
          </span>
          <span className="stat-label">Total Size</span>
        </div>
      </div>

      {/* Backups Table */}
      {loading ? (
        <div className="backups-loading">Loading backups...</div>
      ) : backups.length === 0 ? (
        <div className="backups-empty">
          <span className="empty-icon">📁</span>
          <p>No backups found</p>
          <p className="text-muted">Click "Run Backup Now" to create your first backup</p>
        </div>
      ) : (
        <div className="backups-table-wrapper">
          <table className="backups-table">
            <thead>
              <tr>
                <th>Filename</th>
                <th>Date</th>
                <th>Size</th>
                <th>Method</th>
                <th>Storage</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((backup, idx) => (
                <tr key={backup.filename || idx}>
                  <td className="col-filename">
                    <span className="filename-icon">
                      {backup.filename?.endsWith('.archive.gz') ? '🗄️' : '📦'}
                    </span>
                    <span className="filename-text">{backup.filename}</span>
                  </td>
                  <td className="col-date">{formatDate(backup.timestamp)}</td>
                  <td className="col-size">{formatSize(backup.size_bytes)}</td>
                  <td className="col-method">
                    <span className={`method-badge ${backup.method}`}>
                      {backup.method === 'mongodump' ? 'mongodump' :
                       backup.method === 'python_json' ? 'JSON' : backup.method}
                    </span>
                  </td>
                  <td className="col-storage">
                    <div className="storage-badges">
                      {backup.local_exists && <span className="storage-badge local">Local</span>}
                      {backup.gcs_url && <span className="storage-badge gcs">GCS</span>}
                      {!backup.local_exists && !backup.gcs_url && <span className="storage-badge none">—</span>}
                    </div>
                  </td>
                  <td className="col-actions">
                    <div className="action-buttons">
                      <button
                        className="btn-action btn-download"
                        onClick={() => handleDownload(backup.filename)}
                        title="Download backup"
                      >
                        ⬇️
                      </button>
                      <button
                        className="btn-action btn-restore"
                        onClick={() => handleRestoreCommand(backup.filename)}
                        title="Show restore command"
                      >
                        🔧
                      </button>
                      <button
                        className={`btn-action btn-delete-backup ${deleteConfirm === backup.filename ? 'confirm' : ''}`}
                        onClick={() => handleDelete(backup.filename)}
                        title={deleteConfirm === backup.filename ? 'Click again to confirm delete' : 'Delete backup'}
                      >
                        {deleteConfirm === backup.filename ? '⚠️' : '🗑️'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Restore Command Modal */}
      {restoreCommand && (
        <div className="restore-overlay" onClick={() => setRestoreCommand(null)}>
          <div className="restore-modal" onClick={(e) => e.stopPropagation()}>
            <div className="restore-modal-header">
              <h3>🔧 Restore Command</h3>
              <button className="btn-close-modal" onClick={() => setRestoreCommand(null)}>✕</button>
            </div>
            <div className="restore-modal-body">
              <p className="restore-filename">File: <strong>{restoreCommand.filename}</strong></p>
              <p className="restore-type">Type: <strong>{restoreCommand.restore_type}</strong></p>

              <div className="restore-warning">
                ⚠️ {restoreCommand.warning}
              </div>

              <div className="restore-command-section">
                <h4>Production (server-side restore)</h4>
                <div className="restore-command-block">
                  <pre>{restoreCommand.command}</pre>
                  <button
                    className="btn-copy-command"
                    onClick={() => {
                      navigator.clipboard.writeText(restoreCommand.command);
                      showToast('Production command copied', 'success');
                    }}
                  >
                    📋 Copy
                  </button>
                </div>
              </div>

              {restoreCommand.dev_command && (
                <div className="restore-command-section">
                  <h4>Dev / Local (restore to your laptop)</h4>
                  <p className="restore-hint">Database: <code>{restoreCommand.dest_db}</code> &nbsp;|&nbsp; URI: <code>{restoreCommand.dest_uri}</code></p>
                  <div className="restore-command-block">
                    <pre>{restoreCommand.dev_command}</pre>
                    <button
                      className="btn-copy-command"
                      onClick={() => {
                        navigator.clipboard.writeText(restoreCommand.dev_command);
                        showToast('Dev command copied', 'success');
                      }}
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default AdminBackups;
