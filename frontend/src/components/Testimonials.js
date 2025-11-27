import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import useToast from '../hooks/useToast';
import './Testimonials.css';

const Testimonials = () => {
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    content: '',
    rating: 5,
    isAnonymous: false
  });
  const [submitting, setSubmitting] = useState(false);
  const currentUsername = localStorage.getItem('username');
  const userRole = localStorage.getItem('userRole');
  const isAdmin = userRole === 'admin';
  const toast = useToast();

  const loadTestimonials = useCallback(async () => {
    try {
      // Admin sees all testimonials, regular users see only approved
      const status = isAdmin ? 'all' : 'approved';
      const response = await api.get(`/testimonials?status=${status}`);
      setTestimonials(response.data.testimonials || []);
    } catch (error) {
      console.error('Error loading testimonials:', error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadTestimonials();
  }, [loadTestimonials]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.content.trim()) return;

    setSubmitting(true);
    try {
      await api.post(`/testimonials?username=${currentUsername}`, formData);
      toast.success('✅ Thank you! Your testimonial has been submitted and will be visible after admin approval.');
      setFormData({ content: '', rating: 5, isAnonymous: false });
      setShowForm(false);
      loadTestimonials(); // Reload to show new testimonial
    } catch (error) {
      toast.error('❌ Error submitting testimonial: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (testimonialId) => {
    try {
      await api.patch(`/testimonials/${testimonialId}/status?status=approved&username=${currentUsername}`);
      loadTestimonials();
    } catch (error) {
      toast.error('❌ Error: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleReject = async (testimonialId) => {
    try {
      await api.patch(`/testimonials/${testimonialId}/status?status=rejected&username=${currentUsername}`);
      loadTestimonials();
    } catch (error) {
      toast.error('❌ Error: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDelete = async (testimonialId) => {
    try {
      await api.delete(`/testimonials/${testimonialId}?username=${currentUsername}`);
      loadTestimonials();
    } catch (error) {
      toast.error('❌ Error: ' + (error.response?.data?.detail || error.message));
    }
  };

  const renderStars = (rating) => {
    return [...Array(5)].map((_, i) => (
      <span key={i} className={`star ${i < rating ? 'filled' : ''}`}>
        ★
      </span>
    ));
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="testimonials-container">
        <div className="testimonials-header">
          <h1>💬 Testimonials</h1>
          <p>What our users are saying about L3V3L</p>
        </div>
        <div className="loading-spinner">Loading testimonials...</div>
      </div>
    );
  }

  return (
    <div className="testimonials-container">
      {/* Header */}
      <div className="testimonials-header">
        <div className="header-content">
          <h1>💬 Testimonials</h1>
          <p>What our users are saying about L3V3L</p>
        </div>
        <button className="btn-write-testimonial" onClick={() => setShowForm(!showForm)}>
          ✍️ Write Testimonial
        </button>
      </div>

      {/* Submission Form */}
      {showForm && (
        <div className="testimonial-form-card">
          <div className="form-header">
            <h3>Share Your Experience</h3>
            <button className="btn-close" onClick={() => setShowForm(false)}>×</button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Your Feedback</label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Share your experience with L3V3L matchmaking..."
                rows="4"
                minLength="10"
                maxLength="500"
                required
              />
              <small>{formData.content.length}/500 characters</small>
            </div>

            <div className="form-group">
              <label>Rating</label>
              <div className="rating-selector">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={`star-btn ${star <= formData.rating ? 'active' : ''}`}
                    onClick={() => setFormData({ ...formData, rating: star })}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.isAnonymous}
                  onChange={(e) => setFormData({ ...formData, isAnonymous: e.target.checked })}
                />
                Submit anonymously
              </label>
            </div>

            <div className="form-actions">
              <button type="button" className="btn-cancel" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-submit" disabled={submitting || !formData.content.trim()}>
                {submitting ? 'Submitting...' : 'Submit Testimonial'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Testimonials Grid */}
      <div className="testimonials-grid">
        {testimonials.length === 0 ? (
          <div className="no-testimonials">
            <div className="empty-icon">💭</div>
            <h3>No Testimonials Yet</h3>
            <p>Be the first to share your experience!</p>
            <button className="btn-first-testimonial" onClick={() => setShowForm(true)}>
              Write First Testimonial
            </button>
          </div>
        ) : (
          testimonials.map((testimonial) => (
            <div key={testimonial.id} className={`testimonial-card status-${testimonial.status}`}>
              {/* Status Badge (Admin Only) */}
              {isAdmin && (
                <div className={`status-badge status-${testimonial.status}`}>
                  {testimonial.status === 'pending' && '⏳ Pending'}
                  {testimonial.status === 'approved' && '✅ Approved'}
                  {testimonial.status === 'rejected' && '❌ Rejected'}
                </div>
              )}

              <div className="card-header">
                <div className="user-info">
                  {testimonial.avatar ? (
                    <img src={testimonial.avatar} alt={testimonial.displayName} className="avatar" />
                  ) : (
                    <div className="avatar-placeholder">
                      {testimonial.displayName[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="user-details">
                    <div className="display-name">{testimonial.displayName}</div>
                    {!testimonial.isAnonymous && (
                      <div className="username">@{testimonial.username}</div>
                    )}
                  </div>
                </div>
                <div className="logo-mark">𝕃3𝕍3𝕃</div>
              </div>

              <div className="card-content">
                <p className="testimonial-text">{testimonial.content}</p>
              </div>

              <div className="card-footer">
                <div className="rating">{renderStars(testimonial.rating)}</div>
                <div className="timestamp">{formatDate(testimonial.createdAt)}</div>
              </div>

              {/* Admin Actions */}
              {isAdmin && (
                <div className="admin-actions">
                  {testimonial.status === 'pending' && (
                    <>
                      <button 
                        className="btn-approve" 
                        onClick={() => handleApprove(testimonial.id)}
                        title="Approve testimonial"
                      >
                        ✅ Approve
                      </button>
                      <button 
                        className="btn-reject" 
                        onClick={() => handleReject(testimonial.id)}
                        title="Reject testimonial"
                      >
                        ❌ Reject
                      </button>
                    </>
                  )}
                  {testimonial.status === 'rejected' && (
                    <button 
                      className="btn-approve" 
                      onClick={() => handleApprove(testimonial.id)}
                      title="Approve testimonial"
                    >
                      ✅ Approve
                    </button>
                  )}
                  <button 
                    className="btn-delete" 
                    onClick={() => handleDelete(testimonial.id)}
                    title="Delete permanently"
                  >
                    🗑️ Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Testimonials;
