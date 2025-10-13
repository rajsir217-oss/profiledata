import React, { useState } from 'react';

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
    description: ''
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
      description: newWorkExperience.description.trim()
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
      description: ''
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
        description: ''
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setNewWorkExperience({
      status: '',
      description: ''
    });
  };

  return (
    <div className="mb-4">
      <h5 className="mt-4 mb-3 text-primary">
        💼 Work Experience {isRequired && <span className="text-danger">*</span>}
      </h5>

      {/* Saved Work Experience Entries */}
      {workExperience.length > 0 && (
        <div className="mb-3">
          <table className="table table-bordered">
            <thead className="table-light">
              <tr>
                <th>Status</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {workExperience.map((work, index) => (
                <tr key={index}>
                  <td>
                    <span className={`badge ${work.status === 'current' ? 'bg-success' : 'bg-secondary'}`}>
                      {work.status}
                    </span>
                  </td>
                  <td>{work.description}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm btn-warning me-2"
                      onClick={() => handleEditWorkExperience(index)}
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDeleteWorkExperience(index)}
                      title="Delete"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Work Experience Form */}
      <div className="card p-3 mb-3" style={{ backgroundColor: '#f8f9fa' }}>
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

          <div className="col-md-7">
            <label className="form-label">Description (Type of work and industry) <span className="text-danger">*</span></label>
            <input
              type="text"
              className="form-control"
              name="description"
              value={newWorkExperience.description}
              onChange={handleWorkExperienceChange}
              placeholder="e.g., Software Engineer in Tech Industry, Marketing Manager in Healthcare"
            />
          </div>

          <div className="col-md-2 d-flex align-items-end">
            <button
              type="button"
              className="btn btn-primary w-100"
              onClick={handleAddWorkExperience}
            >
              {editingIndex !== null ? '✓ Update' : '+ Add'}
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
