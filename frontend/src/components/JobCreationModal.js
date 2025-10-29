import React, { useState, useEffect } from 'react';
import './JobCreationModal.css';

const JobCreationModal = ({ templates, onClose, onSubmit, editJob = null }) => {
  const isEditMode = !!editJob;
  const [step, setStep] = useState(isEditMode ? 2 : 1); // Skip template selection in edit mode
  const [formData, setFormData] = useState(() => {
    const initialData = editJob || {
      name: '',
      description: '',
      template_type: '',
      parameters: {},
      schedule: {
        type: 'interval',
        interval_seconds: 3600,
        expression: '0 * * * *',
        timezone: 'UTC'
      },
      enabled: true,
      timeout_seconds: 3600,
      retry_policy: {
        max_retries: 3,
        retry_delay_seconds: 300
      },
      notifications: {
        on_success: [],
        on_failure: []
      }
    };
    
    if (editJob) {
      console.log('🔧 Modal initialized with editJob:', editJob);
      console.log('📋 Form data initialized:', initialData);
    }
    
    return initialData;
  });
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [paramErrors, setParamErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [schedulePreset, setSchedulePreset] = useState('custom');
  const [scheduleDay, setScheduleDay] = useState('Monday');
  const [scheduleTime, setScheduleTime] = useState('09:00');

  // Check for preselected template from Template Manager
  useEffect(() => {
    if (!isEditMode && templates.length > 0 && !formData.template_type) {
      const preselectedType = localStorage.getItem('preselectedTemplateType');
      if (preselectedType) {
        console.log('🎯 Auto-selecting template:', preselectedType);
        setFormData(prev => ({ ...prev, template_type: preselectedType }));
        // Move to step 2 automatically
        setStep(2);
        // Clear the flag
        localStorage.removeItem('preselectedTemplateType');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, isEditMode]);

  // Load selected template
  useEffect(() => {
    if (formData.template_type) {
      const template = templates.find(t => t.type === formData.template_type);
      setSelectedTemplate(template);
      
      // Initialize parameters with defaults ONLY in create mode
      if (!isEditMode && template?.parameters_schema?.properties) {
        const defaultParams = {};
        Object.entries(template.parameters_schema.properties).forEach(([key, schema]) => {
          if (schema.default !== undefined) {
            defaultParams[key] = schema.default;
          }
        });
        setFormData(prev => ({ ...prev, parameters: defaultParams }));
      }
      
      // Auto-fill job name with template name in create mode (if name is empty)
      if (!isEditMode && template?.name && !formData.name) {
        setFormData(prev => ({ ...prev, name: template.name }));
      }
    }
  }, [formData.template_type, templates, isEditMode]);

  const handleNext = () => {
    if (step === 1 && !formData.template_type) {
      setError('Please select a template');
      return;
    }
    if (step === 2) {
      // Validate job name
      if (!formData.name || formData.name.trim() === '') {
        setError('Job name is required');
        return;
      }
      // Validate template parameters
      if (!validateParameters()) {
        return;
      }
    }
    setStep(prev => prev + 1);
    setError(null);
  };

  const handleBack = () => {
    setStep(prev => prev - 1);
    setError(null);
  };

  const validateParameters = () => {
    if (!selectedTemplate) return true;
    
    const schema = selectedTemplate.parameters_schema;
    const errors = {};
    const required = schema.required || [];
    
    // Check required fields
    required.forEach(field => {
      const value = formData.parameters[field];
      // Check for missing or empty values (but allow 0, false, etc.)
      if (value === undefined || value === null || value === '') {
        errors[field] = 'This field is required';
      }
    });
    
    setParamErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    // Validate job name
    if (!formData.name || formData.name.trim() === '') {
      setError('Job name is required');
      return;
    }
    
    // Validate template parameters
    if (!validateParameters()) {
      setError('Please fix the validation errors');
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create job');
    } finally {
      setSubmitting(false);
    }
  };

  const handleParameterChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [key]: value
      }
    }));
    // Clear error for this field
    if (paramErrors[key]) {
      setParamErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  const renderParameterInput = (key, schema) => {
    const value = formData.parameters[key];
    const hasError = paramErrors[key];
    
    if (schema.enum) {
      return (
        <select
          value={value || ''}
          onChange={(e) => handleParameterChange(key, e.target.value)}
          className={hasError ? 'error' : ''}
        >
          <option value="">Select...</option>
          {schema.enum.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );
    }
    
    if (schema.type === 'boolean') {
      return (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={value || false}
            onChange={(e) => handleParameterChange(key, e.target.checked)}
          />
          <span>{schema.description || key}</span>
        </label>
      );
    }
    
    if (schema.type === 'integer' || schema.type === 'number') {
      return (
        <input
          type="number"
          value={value !== undefined && value !== null ? value : ''}
          min={schema.minimum}
          max={schema.maximum}
          onChange={(e) => {
            const val = e.target.value;
            if (val === '') {
              handleParameterChange(key, undefined);
            } else {
              const parsed = parseInt(val, 10);
              handleParameterChange(key, isNaN(parsed) ? undefined : parsed);
            }
          }}
          className={hasError ? 'error' : ''}
        />
      );
    }
    
    if (schema.type === 'array') {
      return (
        <textarea
          value={Array.isArray(value) ? value.join(', ') : ''}
          onChange={(e) => handleParameterChange(key, e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
          placeholder="Enter comma-separated values"
          className={hasError ? 'error' : ''}
        />
      );
    }
    
    if (schema.type === 'object') {
      return (
        <textarea
          value={typeof value === 'object' ? JSON.stringify(value, null, 2) : ''}
          onChange={(e) => {
            try {
              handleParameterChange(key, JSON.parse(e.target.value));
            } catch {
              // Invalid JSON, keep as string for now
            }
          }}
          placeholder='{"key": "value"}'
          rows={4}
          className={hasError ? 'error' : ''}
        />
      );
    }
    
    return (
      <input
        type="text"
        value={value || ''}
        onChange={(e) => handleParameterChange(key, e.target.value)}
        maxLength={schema.maxLength}
        className={hasError ? 'error' : ''}
      />
    );
  };

  const renderStep1 = () => (
    <div className="modal-step">
      <h3>Step 1: Choose Template</h3>
      <p className="step-description">Select a job template to get started</p>
      
      <div className="template-grid">
        {templates.map((template, index) => (
          <div
            key={template.type}
            className={`template-card ${formData.template_type === template.type ? 'selected' : ''}`}
            onClick={() => setFormData(prev => ({ ...prev, template_type: template.type }))}
          >
            <div className="template-number">{index + 1}</div>
            <div className="template-icon-container">
              <div className="template-icon">{template.icon}</div>
            </div>
            <div className="template-info">
              <h4>{template.name}</h4>
              <p>{template.description}</p>
              <div className="template-meta">
                <span className="meta-badge">{template.category}</span>
                <span className="meta-badge">{template.resource_usage} usage</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="modal-step">
      <h3>Step 2: Configure Parameters</h3>
      <p className="step-description">Set parameters for {selectedTemplate?.name}</p>
      
      <div className="form-group">
        <label>Job Name *</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="e.g., Weekly User Cleanup"
        />
      </div>
      
      <div className="form-group">
        <label>Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Optional description of what this job does"
          rows={2}
        />
      </div>
      
      {selectedTemplate?.parameters_schema?.properties && (
        <>
          <h4>Template Parameters</h4>
          {Object.entries(selectedTemplate.parameters_schema.properties).map(([key, schema]) => (
            <div key={key} className="form-group">
              <label>
                {schema.description || key}
                {selectedTemplate.parameters_schema.required?.includes(key) && ' *'}
              </label>
              {renderParameterInput(key, schema)}
              {paramErrors[key] && <span className="error-message">{paramErrors[key]}</span>}
            </div>
          ))}
        </>
      )}
    </div>
  );

  const applySchedulePreset = (preset) => {
    setSchedulePreset(preset);
    let cronExpression = '';
    
    switch (preset) {
      case 'hourly':
        cronExpression = '0 * * * *'; // Every hour
        break;
      case 'daily':
        const [dailyHour, dailyMinute] = scheduleTime.split(':');
        cronExpression = `${dailyMinute} ${dailyHour} * * *`;
        break;
      case 'weekly':
        const [weeklyHour, weeklyMinute] = scheduleTime.split(':');
        const dayMap = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
        cronExpression = `${weeklyMinute} ${weeklyHour} * * ${dayMap[scheduleDay]}`;
        break;
      case 'monthly':
        const [monthlyHour, monthlyMinute] = scheduleTime.split(':');
        cronExpression = `${monthlyMinute} ${monthlyHour} 1 * *`; // 1st of month
        break;
      case 'custom':
        cronExpression = formData.schedule.expression;
        break;
      default:
        cronExpression = '0 * * * *';
    }
    
    setFormData(prev => ({
      ...prev,
      schedule: { ...prev.schedule, type: 'cron', expression: cronExpression }
    }));
  };

  const renderStep3 = () => (
    <div className="modal-step">
      <h3>Step 3: Set Schedule</h3>
      <p className="step-description">Define when this job should run</p>
      
      {/* Quick Presets */}
      <div className="form-group">
        <label>Schedule Preset</label>
        <div className="schedule-presets">
          <button
            type="button"
            className={`preset-btn ${schedulePreset === 'hourly' ? 'active' : ''}`}
            onClick={() => applySchedulePreset('hourly')}
          >
            ⏰ Hourly
          </button>
          <button
            type="button"
            className={`preset-btn ${schedulePreset === 'daily' ? 'active' : ''}`}
            onClick={() => applySchedulePreset('daily')}
          >
            📅 Daily
          </button>
          <button
            type="button"
            className={`preset-btn ${schedulePreset === 'weekly' ? 'active' : ''}`}
            onClick={() => applySchedulePreset('weekly')}
          >
            📆 Weekly
          </button>
          <button
            type="button"
            className={`preset-btn ${schedulePreset === 'monthly' ? 'active' : ''}`}
            onClick={() => applySchedulePreset('monthly')}
          >
            🗓️ Monthly
          </button>
          <button
            type="button"
            className={`preset-btn ${schedulePreset === 'custom' ? 'active' : ''}`}
            onClick={() => setSchedulePreset('custom')}
          >
            ⚙️ Custom
          </button>
        </div>
      </div>
      
      {/* Day/Time Pickers for Weekly/Monthly */}
      {schedulePreset === 'weekly' && (
        <div className="form-group">
          <label>Day of Week</label>
          <select
            value={scheduleDay}
            onChange={(e) => {
              setScheduleDay(e.target.value);
              setTimeout(() => applySchedulePreset('weekly'), 0);
            }}
          >
            <option value="Monday">Monday</option>
            <option value="Tuesday">Tuesday</option>
            <option value="Wednesday">Wednesday</option>
            <option value="Thursday">Thursday</option>
            <option value="Friday">Friday</option>
            <option value="Saturday">Saturday</option>
            <option value="Sunday">Sunday</option>
          </select>
        </div>
      )}
      
      {(schedulePreset === 'daily' || schedulePreset === 'weekly' || schedulePreset === 'monthly') && (
        <div className="form-group">
          <label>Time of Day</label>
          <input
            type="time"
            value={scheduleTime}
            onChange={(e) => {
              setScheduleTime(e.target.value);
              setTimeout(() => applySchedulePreset(schedulePreset), 0);
            }}
          />
          <small>
            {schedulePreset === 'daily' && `Runs every day at ${scheduleTime}`}
            {schedulePreset === 'weekly' && `Runs every ${scheduleDay} at ${scheduleTime}`}
            {schedulePreset === 'monthly' && `Runs on the 1st of each month at ${scheduleTime}`}
          </small>
        </div>
      )}
      
      {/* Custom Cron Expression */}
      {schedulePreset === 'custom' && (
        <>
          <div className="form-group">
            <label>Schedule Type</label>
            <select
              value={formData.schedule.type}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                schedule: { ...prev.schedule, type: e.target.value }
              }))}
            >
              <option value="interval">Interval (Every X seconds)</option>
              <option value="cron">Cron Expression</option>
            </select>
          </div>
          
          {formData.schedule.type === 'interval' ? (
            <div className="form-group">
              <label>Interval (seconds)</label>
              <input
                type="number"
                value={formData.schedule.interval_seconds}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  schedule: { ...prev.schedule, interval_seconds: parseInt(e.target.value, 10) }
                }))}
                min="60"
              />
              <small>Common values: 3600 (1 hour), 86400 (1 day)</small>
            </div>
          ) : (
            <div className="form-group">
              <label>Cron Expression</label>
              <input
                type="text"
                value={formData.schedule.expression}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  schedule: { ...prev.schedule, expression: e.target.value }
                }))}
                placeholder="0 * * * *"
              />
              <small>Format: minute hour day month weekday</small>
            </div>
          )}
        </>
      )}
      
      {/* Cron Expression Preview */}
      {formData.schedule.type === 'cron' && (
        <div className="cron-preview">
          <strong>📋 Cron Expression:</strong>
          <code>{formData.schedule.expression}</code>
        </div>
      )}
      
      <div className="form-group">
        <label>Timezone</label>
        <select
          value={formData.schedule.timezone}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            schedule: { ...prev.schedule, timezone: e.target.value }
          }))}
        >
          <option value="UTC">UTC</option>
          <option value="America/Los_Angeles">Pacific Time (Los Angeles)</option>
          <option value="America/Denver">Mountain Time (Denver)</option>
          <option value="America/Chicago">Central Time (Chicago)</option>
          <option value="America/New_York">Eastern Time (New York)</option>
          <option value="Asia/Kolkata">India (Kolkata)</option>
          <option value="Europe/London">London</option>
        </select>
      </div>
      
      <div className="form-group">
        <label>Timeout (seconds)</label>
        <input
          type="number"
          value={formData.timeout_seconds}
          onChange={(e) => setFormData(prev => ({ ...prev, timeout_seconds: parseInt(e.target.value, 10) }))}
          min="60"
          max="86400"
        />
        <small>Maximum time the job can run before timing out</small>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="modal-step">
      <h3>Step 4: Review & Create</h3>
      <p className="step-description">Review your job configuration</p>
      
      <div className="review-section">
        <h4>Basic Information</h4>
        <div className="review-item">
          <strong>Name:</strong> {formData.name}
        </div>
        <div className="review-item">
          <strong>Template:</strong> {selectedTemplate?.icon} {selectedTemplate?.name}
        </div>
        {formData.description && (
          <div className="review-item">
            <strong>Description:</strong> {formData.description}
          </div>
        )}
      </div>
      
      <div className="review-section">
        <h4>Schedule</h4>
        <div className="review-item">
          {formData.schedule.type === 'interval' ? (
            <span>Every {formData.schedule.interval_seconds} seconds</span>
          ) : (
            <span>Cron: {formData.schedule.expression}</span>
          )}
        </div>
      </div>
      
      <div className="review-section">
        <h4>Parameters</h4>
        {Object.entries(formData.parameters).map(([key, value]) => (
          <div key={key} className="review-item">
            <strong>{key}:</strong> {JSON.stringify(value)}
          </div>
        ))}
      </div>
      
      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={formData.enabled}
            onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
          />
          <span>Enable job immediately</span>
        </label>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditMode ? '✏️ Edit Job' : 'Create New Job'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        
        {!isEditMode && (
          <div className="modal-progress">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className={`progress-step ${s <= step ? 'active' : ''} ${s < step ? 'completed' : ''}`}>
                {s < step ? '✓' : s}
              </div>
            ))}
          </div>
        )}
        
        <div className="modal-body">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          
          {error && (
            <div className="error-banner">
              ❌ {error}
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          {step > (isEditMode ? 2 : 1) && (
            <button className="btn btn-secondary" onClick={handleBack}>
              ← Back
            </button>
          )}
          <div style={{ flex: 1 }}></div>
          {step < 4 ? (
            <button className="btn btn-primary" onClick={handleNext}>
              Next →
            </button>
          ) : (
            <button 
              className="btn btn-primary" 
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting 
                ? (isEditMode ? 'Updating...' : 'Creating...') 
                : (isEditMode ? '✓ Update Job' : '✓ Create Job')
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobCreationModal;
