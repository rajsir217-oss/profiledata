import React, { useState, useEffect } from 'react';
import { getScheduledTests, createSchedule, updateSchedule, deleteSchedule, runScheduleNow } from './testApi';
import toastService from '../services/toastService';

const TestScheduler = ({ testSuites, isAdmin = false }) => {
  const [schedules, setSchedules] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    testType: '',
    schedule: 'daily',
    time: '00:00',
    daysOfWeek: [],
    enabled: true,
    description: ''
  });

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const data = await getScheduledTests();
      setSchedules(data);
    } catch (error) {
      console.error('Failed to load schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (editingSchedule) {
        await updateSchedule(editingSchedule.id, formData);
      } else {
        await createSchedule(formData);
      }
      resetForm();
      await loadSchedules();
    } catch (error) {
      console.error('Failed to save schedule:', error);
      alert('Failed to save schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (schedule) => {
    setEditingSchedule(schedule);
    setFormData({
      name: schedule.name,
      testType: schedule.testType,
      schedule: schedule.schedule,
      time: schedule.time,
      daysOfWeek: schedule.daysOfWeek || [],
      enabled: schedule.enabled,
      description: schedule.description || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (scheduleId) => {
    try {
      setLoading(true);
      await deleteSchedule(scheduleId);
      await loadSchedules();
      toastService.success('Schedule deleted successfully');
    } catch (error) {
      console.error('Failed to delete schedule:', error);
      toastService.error('Failed to delete schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnabled = async (schedule) => {
    try {
      await updateSchedule(schedule.id, { ...schedule, enabled: !schedule.enabled });
      await loadSchedules();
    } catch (error) {
      console.error('Failed to update schedule:', error);
      toastService.error('Failed to update schedule');
    }
  };

  const handleRunNow = async (schedule) => {
    try {
      setLoading(true);
      const result = await runScheduleNow(schedule.id);
      toastService.success(result.message || `Test schedule "${schedule.name}" started successfully`);
      await loadSchedules();
    } catch (error) {
      console.error('Failed to run schedule:', error);
      toastService.error('Failed to run schedule');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      testType: '',
      schedule: 'daily',
      time: '00:00',
      daysOfWeek: [],
      enabled: true,
      description: ''
    });
    setEditingSchedule(null);
    setShowForm(false);
  };

  const handleDayToggle = (day) => {
    setFormData(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter(d => d !== day)
        : [...prev.daysOfWeek, day]
    }));
  };

  if (!isAdmin) {
    return (
      <div className="test-scheduler">
        <div className="scheduler-header">
          <h2>Test Scheduler</h2>
          <span className="admin-notice">Admin access required to manage schedules</span>
        </div>
        
        <div className="schedules-list">
          {loading && <div className="loading">Loading schedules...</div>}
          
          {!loading && schedules.length === 0 && (
            <div className="no-schedules">
              <p>No test schedules configured</p>
              <p>Contact an administrator to set up test schedules</p>
            </div>
          )}

          {!loading && schedules.length > 0 && (
            <div className="schedules-grid">
              {schedules.map(schedule => (
                <div key={schedule.id} className="schedule-card">
                  <div className="schedule-header">
                    <h4>{schedule.name}</h4>
                    <span className={`status-indicator ${schedule.enabled ? 'enabled' : 'disabled'}`}>
                      {schedule.enabled ? '✅ Enabled' : '⏸️ Disabled'}
                    </span>
                  </div>
                  
                  <div className="schedule-details">
                    <div className="detail">
                      <span className="label">Test Suite:</span>
                      <span className="value">{schedule.testType}</span>
                    </div>
                    <div className="detail">
                      <span className="label">Frequency:</span>
                      <span className="value">{schedule.schedule}</span>
                    </div>
                    <div className="detail">
                      <span className="label">Time:</span>
                      <span className="value">{schedule.time}</span>
                    </div>
                    {schedule.nextRun && (
                      <div className="detail">
                        <span className="label">Next Run:</span>
                        <span className="value">{new Date(schedule.nextRun).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="test-scheduler">
      <div className="scheduler-header">
        <h2>Test Scheduler</h2>
        <button 
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
          disabled={loading}
        >
          {showForm ? 'Cancel' : '+ New Schedule'}
        </button>
      </div>

      {showForm && (
        <div className="schedule-form-container">
          <form className="schedule-form" onSubmit={handleSubmit}>
            <h3>{editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}</h3>
            
            <div className="form-group">
              <label htmlFor="name">Schedule Name *</label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g., Daily Frontend Tests"
              />
            </div>

            <div className="form-group">
              <label htmlFor="testType">Test Suite *</label>
              <select
                id="testType"
                value={formData.testType}
                onChange={(e) => setFormData({ ...formData, testType: e.target.value })}
                required
              >
                <option value="">Select a test suite</option>
                {testSuites.map(suite => (
                  <option key={suite.type} value={suite.type}>
                    {suite.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="schedule">Frequency *</label>
              <select
                id="schedule"
                value={formData.schedule}
                onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="custom">Custom Days</option>
              </select>
            </div>

            {formData.schedule === 'custom' && (
              <div className="form-group">
                <label>Days of Week</label>
                <div className="days-selector">
                  {daysOfWeek.map(day => (
                    <label key={day} className="day-checkbox">
                      <input
                        type="checkbox"
                        checked={formData.daysOfWeek.includes(day)}
                        onChange={() => handleDayToggle(day)}
                      />
                      <span>{day.slice(0, 3)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="time">Time *</label>
              <input
                id="time"
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description for this schedule"
                rows="3"
              />
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                />
                <span>Enable this schedule</span>
              </label>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : (editingSchedule ? 'Update' : 'Create')}
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={resetForm}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="schedules-list">
        {loading && <div className="loading">Loading schedules...</div>}
        
        {!loading && schedules.length === 0 && (
          <div className="no-schedules">
            <p>No test schedules configured</p>
            <p>Create a schedule to automatically run tests at specified times</p>
          </div>
        )}

        {!loading && schedules.length > 0 && (
          <div className="schedules-grid">
            {schedules.map(schedule => (
              <div key={schedule.id} className="schedule-card">
                <div className="schedule-header">
                  <h4>{schedule.name}</h4>
                </div>
                
                <div className="schedule-details">
                  <div className="detail">
                    <span className="label">Test Suite:</span>
                    <span className="value">{schedule.testType}</span>
                  </div>
                  <div className="detail">
                    <span className="label">Frequency:</span>
                    <span className="value">{schedule.schedule}</span>
                  </div>
                  <div className="detail">
                    <span className="label">Time:</span>
                    <span className="value">{schedule.time}</span>
                  </div>
                  {schedule.daysOfWeek && schedule.daysOfWeek.length > 0 && (
                    <div className="detail">
                      <span className="label">Days:</span>
                      <span className="value">{schedule.daysOfWeek.join(', ')}</span>
                    </div>
                  )}
                  {schedule.description && (
                    <div className="detail">
                      <span className="label">Description:</span>
                      <span className="value">{schedule.description}</span>
                    </div>
                  )}
                  <div className="detail">
                    <span className="label">Status:</span>
                    <span className={`value status-${schedule.enabled ? 'enabled' : 'disabled'}`}>
                      {schedule.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  {schedule.lastRun && (
                    <div className="detail">
                      <span className="label">Last Run:</span>
                      <span className="value">{new Date(schedule.lastRun).toLocaleString()}</span>
                    </div>
                  )}
                  {schedule.nextRun && (
                    <div className="detail">
                      <span className="label">Next Run:</span>
                      <span className="value">{new Date(schedule.nextRun).toLocaleString()}</span>
                    </div>
                  )}
                </div>
                
                <div className="schedule-actions">
                  {schedule.enabled && (
                    <button
                      className="btn btn-run-now"
                      onClick={() => handleRunNow(schedule)}
                      disabled={loading}
                      title="Run this test now"
                    >
                      ▶️
                    </button>
                  )}
                  <button
                    className={`btn btn-toggle ${schedule.enabled ? 'enabled' : 'disabled'}`}
                    onClick={() => handleToggleEnabled(schedule)}
                    title={schedule.enabled ? 'Disable schedule' : 'Enable schedule'}
                  >
                    {schedule.enabled ? '✅' : '⏸️'}
                  </button>
                  <button
                    className="btn btn-edit"
                    onClick={() => handleEdit(schedule)}
                    title="Edit schedule"
                  >
                    ✏️
                  </button>
                  <button
                    className="btn btn-delete"
                    onClick={() => handleDelete(schedule.id)}
                    title="Delete schedule"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TestScheduler;
