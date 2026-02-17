/**
 * Optimized JobCreationModal Component
 * 
 * Phase 1 Optimizations:
 * - Centralized constants for initial data
 * - Memoized operations
 * - Shared keyboard shortcuts
 * - Error boundaries
 * - Performance monitoring
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './JobCreationModal.css';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';
import usePerformanceMonitor from '../hooks/usePerformanceMonitor';

// Constants moved outside component to prevent recreation
const INITIAL_FORM_DATA = {
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

const SCHEDULE_PRESETS = {
  hourly: { type: 'cron', expression: '0 * * * *' },
  daily: { type: 'cron', expression: '0 0 * * *' },
  weekly: { type: 'cron', expression: '0 0 * * 0' },
  monthly: { type: 'cron', expression: '0 0 1 * *' }
};

// Error Boundary Component
class JobCreationModalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('JobCreationModal Error:', error, errorInfo);
    this.setState({ error, hasError: true });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h3>Something went wrong</h3>
          <details>
            {this.state.error && this.state.error.toString()}
          </details>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const JobCreationModal = ({ templates, onClose, onSubmit, editJob = null }) => {
  const isEditMode = !!editJob;
  const { recordRender } = usePerformanceMonitor('JobCreationModal');
  
  // State management
  const [step, setStep] = useState(isEditMode ? 2 : 1);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [formData, setFormData] = useState(() => editJob || INITIAL_FORM_DATA);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [paramErrors, setParamErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [schedulePreset, setSchedulePreset] = useState('custom');
  const [scheduleDay, setScheduleDay] = useState('Monday');
  const [scheduleTime, setScheduleTime] = useState('09:00');

  // Performance tracking
  useEffect(() => {
    recordRender();
  }, [recordRender]);

  // Keyboard shortcuts
  const shortcuts = useMemo(() => [
    {
      keys: 'Escape',
      action: useCallback(() => {
        if (!submitting) {
          onClose();
        }
      }, [onClose, submitting])
    }
  ], [onClose, submitting]);

  useKeyboardShortcuts(shortcuts);

  // Memoized filtered templates
  const filteredTemplates = useMemo(() => {
    if (!templates.length) return [];
    
    if (categoryFilter === 'all') {
      return templates;
    }
    
    return templates.filter(template => 
      template.category === categoryFilter
    );
  }, [templates, categoryFilter]);

  // Memoized template categories
  const templateCategories = useMemo(() => {
    const categories = [...new Set(templates.map(t => t.category).filter(Boolean))];
    return ['all', ...categories.sort()];
  }, [templates]);

  // Memoized available categories
  const availableCategories = useMemo(() => {
    return templateCategories.map(cat => ({
      value: cat,
      label: cat.charAt(0).toUpperCase() + cat.slice(1)
    }));
  }, [templateCategories]);

  // Check for preselected template
  useEffect(() => {
    if (!isEditMode && templates.length > 0 && !formData.template_type) {
      const preselectedType = localStorage.getItem('preselectedTemplateType');
      if (preselectedType) {
        setFormData(prev => ({ ...prev, template_type: preselectedType }));
        setStep(2);
        localStorage.removeItem('preselectedTemplateType');
      }
    }
  }, [templates, isEditMode, formData.template_type]);

  // Load selected template
  useEffect(() => {
    if (formData.template_type) {
      const template = templates.find(t => t.type === formData.template_type);
      setSelectedTemplate(template);
      
      // Initialize parameters and job name with defaults ONLY in create mode
      if (!isEditMode && template) {
        const updates = {};
        
        // Set default parameters
        if (template.parameters_schema?.properties) {
          const defaultParams = {};
          Object.entries(template.parameters_schema.properties).forEach(([key, schema]) => {
            if (schema.default !== undefined) {
              defaultParams[key] = schema.default;
            }
          });
          updates.parameters = defaultParams;
        }
        
        // Auto-fill job name with template name
        if (template.name) {
          updates.name = `${template.name} - Job`;
        }
        
        setFormData(prev => ({ ...prev, ...updates }));
      }
    }
  }, [formData.template_type, templates, isEditMode]);

  // Memoized form validation
  const validateForm = useCallback(() => {
    const errors = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Job name is required';
    }
    
    if (!formData.template_type) {
      errors.template_type = 'Template is required';
    }
    
    if (formData.schedule.type === 'cron' && !formData.schedule.expression) {
      errors.expression = 'Cron expression is required';
    }
    
    if (formData.schedule.type === 'interval' && !formData.schedule.interval_seconds) {
      errors.interval_seconds = 'Interval is required';
    }
    
    // Validate template parameters
    if (selectedTemplate && selectedTemplate.parameters_schema) {
      const { properties, required = [] } = selectedTemplate.parameters_schema;
      
      required.forEach(field => {
        if (!formData.parameters[field]) {
          errors[`param_${field}`] = `${field} is required`;
        }
      });
      
      Object.entries(properties).forEach(([field, schema]) => {
        const value = formData.parameters[field];
        
        if (value !== undefined && value !== null) {
          // Type validation
          if (schema.type === 'number' && isNaN(Number(value))) {
            errors[`param_${field}`] = `${field} must be a number`;
          }
          
          if (schema.type === 'boolean' && typeof value !== 'boolean') {
            errors[`param_${field}`] = `${field} must be true or false`;
          }
          
          // Range validation
          if (schema.minimum !== undefined && Number(value) < schema.minimum) {
            errors[`param_${field}`] = `${field} must be at least ${schema.minimum}`;
          }
          
          if (schema.maximum !== undefined && Number(value) > schema.maximum) {
            errors[`param_${field}`] = `${field} must be at most ${schema.maximum}`;
          }
        }
      });
    }
    
    setParamErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, selectedTemplate]);

  // Event handlers
  const handleTemplateSelect = useCallback((template) => {
    setFormData(prev => ({ ...prev, template_type: template.type }));
    setSelectedTemplate(template);
    setStep(2);
  }, []);

  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear errors when field is updated
    if (paramErrors[field]) {
      setParamErrors(prev => ({ ...prev, [field]: null }));
    }
  }, [paramErrors]);

  const handleParameterChange = useCallback((param, value) => {
    setFormData(prev => ({
      ...prev,
      parameters: { ...prev.parameters, [param]: value }
    }));
    
    // Clear parameter errors
    if (paramErrors[`param_${param}`]) {
      setParamErrors(prev => ({ ...prev, [`param_${param}`]: null }));
    }
  }, [paramErrors]);

  const handleSchedulePreset = useCallback((preset) => {
    setSchedulePreset(preset);
    if (preset !== 'custom' && SCHEDULE_PRESETS[preset]) {
      handleInputChange('schedule', SCHEDULE_PRESETS[preset]);
    }
  }, [handleInputChange]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err.message || 'Failed to submit job');
    } finally {
      setSubmitting(false);
    }
  }, [formData, validateForm, onSubmit]);

  // Memoized step content
  const renderStep1 = useMemo(() => (
    <div className="step-content">
      <h2>📋 Select Template</h2>
      
      <div className="template-categories">
        {availableCategories.map(category => (
          <button
            key={category.value}
            className={`category-btn ${categoryFilter === category.value ? 'active' : ''}`}
            onClick={() => setCategoryFilter(category.value)}
          >
            {category.label}
          </button>
        ))}
      </div>
      
      <div className="template-grid">
        {filteredTemplates.map(template => (
          <div
            key={template.type}
            className={`template-card ${template.type === formData.template_type ? 'selected' : ''}`}
            onClick={() => handleTemplateSelect(template)}
          >
            <h3>{template.name}</h3>
            <p>{template.description}</p>
            <div className="template-meta">
              <span className="category">{template.category}</span>
              <span className="type">{template.type}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  ), [availableCategories, categoryFilter, filteredTemplates, formData.template_type, handleTemplateSelect]);

  const renderStep2 = useMemo(() => (
    <div className="step-content">
      <h2>⚙️ Configure Job</h2>
      
      <form onSubmit={handleSubmit} className="job-form">
        {/* Basic Information */}
        <div className="form-section">
          <h3>Basic Information</h3>
          
          <div className="form-group">
            <label>Job Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={paramErrors.name ? 'error' : ''}
              placeholder="Enter job name"
            />
            {paramErrors.name && <span className="error-message">{paramErrors.name}</span>}
          </div>
          
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Enter job description"
              rows={3}
            />
          </div>
        </div>

        {/* Template Parameters */}
        {selectedTemplate && selectedTemplate.parameters_schema && (
          <div className="form-section">
            <h3>Parameters</h3>
            
            {Object.entries(selectedTemplate.parameters_schema.properties).map(([field, schema]) => (
              <div key={field} className="form-group">
                <label>
                  {schema.title || field}
                  {schema.required && <span className="required">*</span>}
                </label>
                
                {schema.type === 'boolean' ? (
                  <select
                    value={formData.parameters[field] || false}
                    onChange={(e) => handleParameterChange(field, e.target.value === 'true')}
                    className={paramErrors[`param_${field}`] ? 'error' : ''}
                  >
                    <option value="false">False</option>
                    <option value="true">True</option>
                  </select>
                ) : schema.type === 'number' ? (
                  <input
                    type="number"
                    value={formData.parameters[field] || ''}
                    onChange={(e) => handleParameterChange(field, Number(e.target.value))}
                    className={paramErrors[`param_${field}`] ? 'error' : ''}
                    min={schema.minimum}
                    max={schema.maximum}
                  />
                ) : (
                  <input
                    type="text"
                    value={formData.parameters[field] || ''}
                    onChange={(e) => handleParameterChange(field, e.target.value)}
                    className={paramErrors[`param_${field}`] ? 'error' : ''}
                    placeholder={schema.description}
                  />
                )}
                
                {paramErrors[`param_${field}`] && (
                  <span className="error-message">{paramErrors[`param_${field}`]}</span>
                )}
                
                {schema.description && (
                  <small className="field-description">{schema.description}</small>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Schedule Configuration */}
        <div className="form-section">
          <h3>Schedule</h3>
          
          <div className="form-group">
            <label>Schedule Type</label>
            <select
              value={formData.schedule.type}
              onChange={(e) => handleInputChange('schedule', { ...formData.schedule, type: e.target.value })}
            >
              <option value="interval">Interval</option>
              <option value="cron">Cron Expression</option>
            </select>
          </div>
          
          {formData.schedule.type === 'interval' ? (
            <div className="form-group">
              <label>Interval (seconds)</label>
              <input
                type="number"
                value={formData.schedule.interval_seconds || ''}
                onChange={(e) => handleInputChange('schedule', { ...formData.schedule, interval_seconds: Number(e.target.value) })}
                min={60}
              />
            </div>
          ) : (
            <div className="form-group">
              <label>Cron Expression</label>
              <div className="cron-presets">
                {Object.entries(SCHEDULE_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    className={`preset-btn ${schedulePreset === key ? 'active' : ''}`}
                    onClick={() => handleSchedulePreset(key)}
                  >
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={formData.schedule.expression || ''}
                onChange={(e) => handleInputChange('schedule', { ...formData.schedule, expression: e.target.value })}
                placeholder="0 0 * * *"
                className={paramErrors.expression ? 'error' : ''}
              />
              {paramErrors.expression && <span className="error-message">{paramErrors.expression}</span>}
            </div>
          )}
        </div>

        {/* Advanced Options */}
        <div className="form-section">
          <h3>Advanced Options</h3>
          
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => handleInputChange('enabled', e.target.checked)}
              />
              Enabled
            </label>
          </div>
          
          <div className="form-group">
            <label>Timeout (seconds)</label>
            <input
              type="number"
              value={formData.timeout_seconds || ''}
              onChange={(e) => handleInputChange('timeout_seconds', Number(e.target.value))}
              min={60}
            />
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="error-display">
            <p>❌ {error}</p>
          </div>
        )}

        {/* Form Actions */}
        <div className="form-actions">
          <button type="button" onClick={onClose} className="btn btn-secondary" disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Submitting...' : (isEditMode ? 'Update Job' : 'Create Job')}
          </button>
        </div>
      </form>
    </div>
  ), [formData, selectedTemplate, paramErrors, handleInputChange, handleParameterChange, handleSchedulePreset, schedulePreset, handleSubmit, error, submitting, isEditMode, onClose]);

  return (
    <JobCreationModalErrorBoundary>
      <div className="modal-overlay">
        <div className="modal-content job-creation-modal">
          <div className="modal-header">
            <h2>{isEditMode ? '✏️ Edit Job' : '➕ Create New Job'}</h2>
            <button onClick={onClose} className="modal-close">✕</button>
          </div>
          
          <div className="modal-body">
            {/* Step Indicator */}
            <div className="step-indicator">
              <div className={`step ${step === 1 ? 'active' : 'completed'}`}>
                <span className="step-number">1</span>
                <span className="step-label">Template</span>
              </div>
              <div className={`step ${step === 2 ? 'active' : ''}`}>
                <span className="step-number">2</span>
                <span className="step-label">Configure</span>
              </div>
            </div>
            
            {/* Step Content */}
            {step === 1 && renderStep1}
            {step === 2 && renderStep2}
          </div>
        </div>
      </div>
    </JobCreationModalErrorBoundary>
  );
};

export default JobCreationModal;
