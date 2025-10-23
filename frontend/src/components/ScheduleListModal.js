import React, { useState, useEffect, useCallback } from 'react';
import './ScheduleListModal.css';

const ScheduleListModal = ({ template, onClose, onUpdate }) => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // ID of schedule being deleted

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/notifications/scheduled', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const templateSchedules = data.filter(s => s.templateId === template._id).map(schedule => ({
          ...schedule,
          id: schedule.id || schedule._id // Ensure id field exists
        }));
        setSchedules(templateSchedules);
      } else {
        throw new Error('Failed to load schedules');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [template._id]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const handleDeleteClick = (scheduleId) => {
    if (deleteConfirm === scheduleId) {
      // Second click - actually delete
      handleDelete(scheduleId);
    } else {
      // First click - arm the delete
      setDeleteConfirm(scheduleId);
      // Auto-reset after 3 seconds
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const handleDelete = async (scheduleId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/api/notifications/scheduled/${scheduleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setSchedules(schedules.filter(s => s.id !== scheduleId));
        setDeleteConfirm(null);
        onUpdate(); // Refresh parent
      } else {
        throw new Error('Failed to delete schedule');
      }
    } catch (err) {
      setError(err.message);
      setDeleteConfirm(null);
    }
  };

  const handleToggleEnabled = async (schedule) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/api/notifications/scheduled/${schedule.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ enabled: !schedule.enabled })
      });

      if (response.ok) {
        loadSchedules();
        onUpdate();
      } else {
        throw new Error('Failed to update schedule');
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const formatSchedule = (schedule) => {
    if (schedule.scheduleType === 'one_time') {
      return `One-time: ${new Date(schedule.scheduledFor).toLocaleString()}`;
    } else {
      return `${schedule.recurrencePattern} at ${new Date(schedule.nextRun).toLocaleTimeString()}`;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content schedule-list-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📅 Manage Schedules</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="template-info-box">
            <strong>Template:</strong> {template.subject || template.trigger}
          </div>

          {loading ? (
            <div className="loading-state">Loading schedules...</div>
          ) : error ? (
            <div className="error-state">❌ {error}</div>
          ) : schedules.length === 0 ? (
            <div className="empty-state">
              <p>No schedules configured for this template</p>
            </div>
          ) : (
            <div className="schedules-list">
              {schedules.map(schedule => (
                <div key={schedule.id} className={`schedule-item ${!schedule.enabled ? 'disabled' : ''}`}>
                  <div className="schedule-info">
                    <div className="schedule-type">
                      {schedule.scheduleType === 'one_time' ? '📅' : '🔄'} {formatSchedule(schedule)}
                    </div>
                    <div className="schedule-details">
                      <span className="detail-item">
                        👥 {schedule.recipientType.replace('_', ' ')}
                      </span>
                      <span className="detail-item">
                        🌍 {schedule.timezone}
                      </span>
                      <span className="detail-item">
                        🎯 Max: {schedule.maxRecipients === 0 ? 'Unlimited' : schedule.maxRecipients}
                      </span>
                    </div>
                    {schedule.nextRun && (
                      <div className="schedule-next-run">
                        Next run: {new Date(schedule.nextRun).toLocaleString()}
                      </div>
                    )}
                    {schedule.lastRun && (
                      <div className="schedule-last-run">
                        Last run: {new Date(schedule.lastRun).toLocaleString()} 
                        <span className="run-count"> ({schedule.runCount || 0} times)</span>
                      </div>
                    )}
                  </div>
                  <div className="schedule-actions">
                    <button
                      className={`btn-toggle ${schedule.enabled ? 'enabled' : 'disabled'}`}
                      onClick={() => handleToggleEnabled(schedule)}
                      title={schedule.enabled ? 'Disable' : 'Enable'}
                    >
                      {schedule.enabled ? '⏸️' : '▶️'}
                    </button>
                    <button
                      className={`btn-delete ${deleteConfirm === schedule.id ? 'confirm' : ''}`}
                      onClick={() => handleDeleteClick(schedule.id)}
                      title={deleteConfirm === schedule.id ? 'Click again to confirm' : 'Delete schedule'}
                    >
                      {deleteConfirm === schedule.id ? '✓ Confirm?' : '🗑️'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleListModal;
