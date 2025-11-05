import React, { useState } from 'react';
import './SharedComponents.css';

/**
 * Reusable Work Experience Manager
 * Handles dynamic array of work experience entries
 * Used in both Register and EditProfile
 */
const WorkExperience = ({
  workExperience,
  setWorkExperience,
  isRequired = false,
  showValidation = false,
  errorMsg = '',
  setErrorMsg = () => {}
}) => {
  const [editingIndex, setEditingIndex] = useState(null);
  const [newWorkExperience, setNewWorkExperience] = useState({
    status: '',
    description: '',
    location: ''
  });

  const handleWorkExperienceChange = (e) => {
    const { name, value } = e.target;
    setNewWorkExperience(prev => ({ ...prev, [name]: value }));
  };

  const handleAddWorkExperience = () => {
    // Validation
    if (!newWorkExperience.status) {
      setErrorMsg("❌ Please select work status");
      return;
    }
    if (!newWorkExperience.description || newWorkExperience.description.trim().length < 5) {
      setErrorMsg("❌ Please enter work description (at least 5 characters)");
      return;
    }

    // Add or update
    const workEntry = {
      status: newWorkExperience.status,
      description: newWorkExperience.description.trim(),
      location: newWorkExperience.location?.trim() || ''
    };

    if (editingIndex !== null) {
      // Update existing
      const updated = [...workExperience];
      updated[editingIndex] = workEntry;
      setWorkExperience(updated);
      setEditingIndex(null);
    } else {
      // Add new
      setWorkExperience([...workExperience, workEntry]);
    }

    // Reset form
    setNewWorkExperience({
      status: '',
      description: '',
      location: ''
    });
    setErrorMsg('');
  };

  const handleEditWorkExperience = (index) => {
    setNewWorkExperience(workExperience[index]);
    setEditingIndex(index);
  };

  const handleDeleteWorkExperience = (index) => {
    setWorkExperience(workExperience.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setNewWorkExperience({
        status: '',
        description: '',
        location: ''
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setNewWorkExperience({
      status: '',
      description: '',
      location: ''
    });
  };

  return (
    <div className="mb-4">
      <h5 className="mt-4 mb-3 text-primary">
        💼 Work Experience {isRequired && <span className="text-danger">*</span>}
      </h5>

      {/* Saved Work Experience Entries */}
      {workExperience.length > 0 && (
        <div className="mb-3 table-container-scroll">
          <table className="table table-bordered table-stacked" style={{ backgroundColor: 'var(--surface-color, #fff)', borderColor: 'var(--border-color, #dee2e6)' }}>
            <thead style={{ backgroundColor: 'var(--hover-background, #f8f9fa)', borderColor: 'var(--border-color, #dee2e6)' }}>
              <tr>
                <th style={{ backgroundColor: 'var(--hover-background, #f8f9fa)', color: 'var(--text-color, #333)', borderColor: 'var(--border-color, #dee2e6)' }}>Status</th>
                <th style={{ backgroundColor: 'var(--hover-background, #f8f9fa)', color: 'var(--text-color, #333)', borderColor: 'var(--border-color, #dee2e6)' }}>Description</th>
                <th style={{ backgroundColor: 'var(--hover-background, #f8f9fa)', color: 'var(--text-color, #333)', borderColor: 'var(--border-color, #dee2e6)' }}>Location</th>
                <th style={{ backgroundColor: 'var(--hover-background, #f8f9fa)', color: 'var(--text-color, #333)', borderColor: 'var(--border-color, #dee2e6)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {workExperience.map((work, index) => (
                <tr key={index}>
                  <td data-label="Status" style={{ backgroundColor: 'var(--surface-color, #fff)', color: 'var(--text-color, #333)', borderColor: 'var(--border-color, #dee2e6)' }}>
                    <span className={`badge ${work.status === 'current' ? 'bg-success' : 'bg-secondary'}`}>
                      {work.status}
                    </span>
                  </td>
                  <td data-label="Description" style={{ backgroundColor: 'var(--surface-color, #fff)', color: 'var(--text-color, #333)', borderColor: 'var(--border-color, #dee2e6)' }}>{work.description}</td>
                  <td data-label="Location" style={{ backgroundColor: 'var(--surface-color, #fff)', color: 'var(--text-color, #333)', borderColor: 'var(--border-color, #dee2e6)' }}>{work.location || '-'}</td>
                  <td data-label="Actions" style={{ backgroundColor: 'var(--surface-color, #fff)', color: 'var(--text-color, #333)', borderColor: 'var(--border-color, #dee2e6)' }} className="actions-cell">
                    <button
                      type="button"
                      className="btn btn-sm btn-warning me-2"
                      onClick={() => handleEditWorkExperience(index)}
                      title="Edit"
                    >
                      <span className="btn-icon">✏️</span>
                      <span className="btn-text">Edit</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDeleteWorkExperience(index)}
                      title="Delete"
                    >
                      <span className="btn-icon">🗑️</span>
                      <span className="btn-text">Delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Work Experience Form */}
      <div className="card p-3 mb-3" style={{ backgroundColor: 'var(--surface-color, #f8f9fa)' }}>
        <h6 className="mb-3">{editingIndex !== null ? 'Edit' : 'Add'} Work Experience Entry</h6>

        <div className="row mb-3">
          <div className="col-md-3">
            <label className="form-label">Work Status <span className="text-danger">*</span></label>
            <select
              className="form-control"
              name="status"
              value={newWorkExperience.status}
              onChange={handleWorkExperienceChange}
            >
              <option value="">Select Status</option>
              <option value="current">Current</option>
              <option value="past">Past</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="col-md-4">
            <label className="form-label">Type of work & Industry <span className="text-danger">*</span></label>
            <input
              type="text"
              className="form-control"
              name="description"
              value={newWorkExperience.description}
              onChange={handleWorkExperienceChange}
              placeholder="e.g., Software Engineer in Tech Industry, Marketing Manager in Healthcare"
            />
          </div>

          <div className="col-md-3">
            <label className="form-label">Work Location</label>
            <input
              type="text"
              className="form-control"
              name="location"
              value={newWorkExperience.location}
              onChange={handleWorkExperienceChange}
              placeholder="e.g., Bangalore, San Francisco"
            />
          </div>

          <div className="col-md-2 d-flex align-items-end justify-content-center">
            <button
              type="button"
              className={`btn btn-primary btn-square-action ${editingIndex === null ? 'btn-add-entry' : ''}`}
              onClick={handleAddWorkExperience}
            >
              <span className="btn-icon" style={{ fontSize: '24px' }}>{editingIndex !== null ? '✓' : '+'}</span>
            </button>
          </div>
        </div>

        {editingIndex !== null && (
          <div className="mt-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCancelEdit}
            >
              Cancel Edit
            </button>
          </div>
        )}
      </div>

      {showValidation && isRequired && workExperience.length === 0 && (
        <small className="text-danger d-block mb-2">
          ⚠️ Please add at least one work experience entry
        </small>
      )}
    </div>
  );
};

export default WorkExperience;
