import React, { useState } from 'react';

/**
 * Reusable Education History Manager
 * Handles dynamic array of education entries
 * Used in both Register and EditProfile
 */
const EducationHistory = ({
  educationHistory,
  setEducationHistory,
  isRequired = false,
  showValidation = false,
  errorMsg = '',
  setErrorMsg = () => {}
}) => {
  const [editingIndex, setEditingIndex] = useState(null);
  const [newEducation, setNewEducation] = useState({
    level: '',
    degree: '',
    institution: ''
  });

  const handleEducationChange = (e) => {
    const { name, value } = e.target;
    setNewEducation(prev => ({ ...prev, [name]: value }));
  };

  const handleAddEducation = () => {
    // Validation
    if (!newEducation.level) {
      setErrorMsg("❌ Please select education level");
      return;
    }
    if (!newEducation.degree) {
      setErrorMsg("❌ Please enter degree type (e.g., BS, MS, PHD)");
      return;
    }
    if (!newEducation.institution) {
      setErrorMsg("❌ Please enter institution name");
      return;
    }

    // Add or update
    const educationEntry = {
      level: newEducation.level,
      degree: newEducation.degree,
      institution: newEducation.institution
    };

    if (editingIndex !== null) {
      // Update existing
      const updated = [...educationHistory];
      updated[editingIndex] = educationEntry;
      setEducationHistory(updated);
      setEditingIndex(null);
    } else {
      // Add new
      setEducationHistory([...educationHistory, educationEntry]);
    }

    // Reset form
    setNewEducation({
      level: '',
      degree: '',
      institution: ''
    });
    setErrorMsg('');
  };

  const handleEditEducation = (index) => {
    setNewEducation(educationHistory[index]);
    setEditingIndex(index);
  };

  const handleDeleteEducation = (index) => {
    setEducationHistory(educationHistory.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setNewEducation({
        level: '',
        degree: '',
        institution: ''
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setNewEducation({
      level: '',
      degree: '',
      institution: ''
    });
  };

  return (
    <div className="mb-4">
      <h5 className="mt-4 mb-3 text-primary">
        📚 Education History {isRequired && <span className="text-danger">*</span>}
      </h5>

      {/* Saved Education Entries */}
      {educationHistory.length > 0 && (
        <div className="mb-3">
          <table className="table table-bordered" style={{ backgroundColor: 'var(--surface-color, #fff)', borderColor: 'var(--border-color, #dee2e6)' }}>
            <thead style={{ backgroundColor: 'var(--hover-background, #f8f9fa)', borderColor: 'var(--border-color, #dee2e6)' }}>
              <tr>
                <th style={{ backgroundColor: 'var(--hover-background, #f8f9fa)', color: 'var(--text-color, #333)', borderColor: 'var(--border-color, #dee2e6)' }}>Level</th>
                <th style={{ backgroundColor: 'var(--hover-background, #f8f9fa)', color: 'var(--text-color, #333)', borderColor: 'var(--border-color, #dee2e6)' }}>Degree</th>
                <th style={{ backgroundColor: 'var(--hover-background, #f8f9fa)', color: 'var(--text-color, #333)', borderColor: 'var(--border-color, #dee2e6)' }}>Institution</th>
                <th style={{ backgroundColor: 'var(--hover-background, #f8f9fa)', color: 'var(--text-color, #333)', borderColor: 'var(--border-color, #dee2e6)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {educationHistory.map((edu, index) => (
                <tr key={index}>
                  <td style={{ backgroundColor: 'var(--surface-color, #fff)', color: 'var(--text-color, #333)', borderColor: 'var(--border-color, #dee2e6)' }}>{edu.level}</td>
                  <td style={{ backgroundColor: 'var(--surface-color, #fff)', color: 'var(--text-color, #333)', borderColor: 'var(--border-color, #dee2e6)' }}>{edu.degree}</td>
                  <td style={{ backgroundColor: 'var(--surface-color, #fff)', color: 'var(--text-color, #333)', borderColor: 'var(--border-color, #dee2e6)' }}>{edu.institution}</td>
                  <td style={{ backgroundColor: 'var(--surface-color, #fff)', color: 'var(--text-color, #333)', borderColor: 'var(--border-color, #dee2e6)' }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-warning me-2"
                      onClick={() => handleEditEducation(index)}
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDeleteEducation(index)}
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

      {/* Add/Edit Education Form */}
      <div className="card p-3 mb-3" style={{ backgroundColor: 'var(--surface-color, #f8f9fa)' }}>
        <h6 className="mb-3">{editingIndex !== null ? 'Edit' : 'Add'} Education Entry</h6>

        <div className="row mb-3">
          <div className="col-md-4">
            <label className="form-label">Education Level <span className="text-danger">*</span></label>
            <select
              className="form-control"
              name="level"
              value={newEducation.level}
              onChange={handleEducationChange}
            >
              <option value="">Select Level</option>
              <option value="Under Graduation">Under Graduation</option>
              <option value="Graduation">Graduation</option>
              <option value="Post Graduation">Post Graduation</option>
              <option value="PHD">PHD</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="col-md-3">
            <label className="form-label">Degree Type <span className="text-danger">*</span></label>
            <input
              type="text"
              className="form-control"
              name="degree"
              value={newEducation.degree}
              onChange={handleEducationChange}
              placeholder="e.g., BS, MS, PHD"
            />
          </div>

          <div className="col-md-3">
            <label className="form-label">Institution Name <span className="text-danger">*</span></label>
            <input
              type="text"
              className="form-control"
              name="institution"
              value={newEducation.institution}
              onChange={handleEducationChange}
              placeholder="e.g., Georgia Tech, MIT, Stanford"
            />
          </div>

          <div className="col-md-2 d-flex align-items-end">
            <button
              type="button"
              className={`btn btn-primary w-100 ${editingIndex === null ? 'btn-add-entry' : ''}`}
              onClick={handleAddEducation}
              // style={{ minWidth: '44px', whiteSpace: 'nowrap' }}
            >
              <span style={{ fontSize: '16px' }}>{editingIndex !== null ? '✓' : '+'}</span>
              <span className="d-none d-lg-inline">{editingIndex !== null ? ' Update' : 'Add'}</span>
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

      {showValidation && isRequired && educationHistory.length === 0 && (
        <small className="text-danger d-block mb-2">
          ⚠️ Please add at least one education entry
        </small>
      )}
    </div>
  );
};

export default EducationHistory;
