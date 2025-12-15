import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './ChangeAdminPassword.css';

const ChangeAdminPassword = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  // Security check - only admin can access
  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin') {
      navigate('/');
    }
  }, [navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords({
      ...showPasswords,
      [field]: !showPasswords[field]
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (formData.newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }

    if (formData.currentPassword === formData.newPassword) {
      setError('New password must be different from current password');
      return;
    }

    setLoading(true);

    try {
      const data = new FormData();
      data.append('current_password', formData.currentPassword);
      data.append('new_password', formData.newPassword);

      const response = await api.post('/admin/change-password', data);
      
      // Show success and warning (if present) in success message
      const successMsg = response.data.warning 
        ? `✅ ${response.data.message}\n\n⚠️ ${response.data.warning}`
        : `✅ ${response.data.message}`;
      setSuccess(successMsg);
      
      // Clear form
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      // Redirect after delay
      setTimeout(() => {
        navigate('/admin');
      }, 3000);
    } catch (err) {
      console.error('Error changing password:', err);
      setError(err.response?.data?.detail || '❌ Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/admin');
  };

  return (
    <div className="change-password-container">
      <div className="card p-4 shadow">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h3>🔐 Change Admin Password</h3>
          <button className="btn btn-outline-secondary" onClick={handleCancel}>
            ← Back to Dashboard
          </button>
        </div>

        <div className="alert alert-info">
          <strong>Current Credentials:</strong><br />
          Username: <code>admin</code><br />
          Password: <code>admin</code>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          {/* Current Password */}
          <div className="mb-3">
            <label className="form-label">Current Password</label>
            <div className="input-group">
              <input
                type={showPasswords.current ? 'text' : 'password'}
                className="form-control"
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleChange}
                required
                placeholder="Enter current password"
              />
              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={() => togglePasswordVisibility('current')}
              >
                {showPasswords.current ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="mb-3">
            <label className="form-label">New Password</label>
            <div className="input-group">
              <input
                type={showPasswords.new ? 'text' : 'password'}
                className="form-control"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                required
                placeholder="Enter new password (min 6 characters)"
              />
              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={() => togglePasswordVisibility('new')}
              >
                {showPasswords.new ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            <small className="text-muted">Minimum 6 characters</small>
          </div>

          {/* Confirm Password */}
          <div className="mb-3">
            <label className="form-label">Confirm New Password</label>
            <div className="input-group">
              <input
                type={showPasswords.confirm ? 'text' : 'password'}
                className="form-control"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                placeholder="Confirm new password"
              />
              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={() => togglePasswordVisibility('confirm')}
              >
                {showPasswords.confirm ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {/* Password Strength Indicator */}
          {formData.newPassword && (
            <div className="mb-3">
              <small className="text-muted">Password Strength:</small>
              <div className="progress" style={{ height: '5px' }}>
                <div
                  className={`progress-bar ${
                    formData.newPassword.length < 6
                      ? 'bg-danger'
                      : formData.newPassword.length < 8
                      ? 'bg-warning'
                      : 'bg-success'
                  }`}
                  style={{
                    width: `${Math.min((formData.newPassword.length / 12) * 100, 100)}%`
                  }}
                ></div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="d-flex justify-content-between mt-4">
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
            >
              {loading ? 'Changing Password...' : '🔒 Change Password'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>

        {/* Security Note */}
        <div className="alert alert-warning mt-4">
          <strong>⚠️ Security Note:</strong><br />
          This is a demo implementation. In production:
          <ul className="mb-0 mt-2">
            <li>Passwords should be hashed</li>
            <li>Store in secure database or secrets manager</li>
            <li>Implement password complexity requirements</li>
            <li>Add rate limiting for password changes</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ChangeAdminPassword;
