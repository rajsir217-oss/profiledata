import React, { useState, useEffect, useRef } from 'react';
import { getBackendApiUrl } from '../utils/urlHelper';
import api from '../api';
import './ContactUs.css';

/**
 * ContactUs - Chat-style contact form
 * Modern conversational UI for user support requests
 */
const ContactUs = () => {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [userTickets, setUserTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null); // For viewing thread
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const messagesEndRef = useRef(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    category: '',
    priority: 'medium',
    message: ''
  });
  const [attachments, setAttachments] = useState([]); // Max 2 files

  const categories = [
    { value: 'technical', label: '🔧 Technical Support', desc: 'Bugs, errors, technical issues' },
    { value: 'account', label: '👤 Account Issues', desc: 'Login, profile, settings' },
    { value: 'safety', label: '🛡️ Safety & Privacy', desc: 'Report abuse, safety concerns' },
    { value: 'billing', label: '💳 Billing & Payments', desc: 'Subscription, refunds' },
    { value: 'feature', label: '✨ Feature Request', desc: 'Suggest new features' },
    { value: 'feedback', label: '💬 General Feedback', desc: 'Comments, suggestions' },
    { value: 'other', label: '📋 Other', desc: 'Anything else' }
  ];

  useEffect(() => {
    const username = localStorage.getItem('username');
    if (username) {
      setCurrentUser(username);
      loadUserTickets(username);
      
      // Pre-fill user info
      api.get(`/profile/${username}?requester=${username}`)
        .then(res => {
          const profile = res.data;
          setFormData(prev => ({
            ...prev,
            name: `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || username,
            email: profile.email || ''
          }));
        })
        .catch(err => console.error('Error loading profile:', err));
    }
  }, []);

  const loadUserTickets = async (username) => {
    try {
      const response = await api.get(`/contact/user/${username}`);
      setUserTickets(response.data);
    } catch (err) {
      console.error('Error loading user tickets:', err);
    }
  };

  const refreshTicket = async (ticketId) => {
    try {
      // Fetch the updated ticket from backend
      const response = await api.get(`/contact/${ticketId}`);
      const updatedTicket = response.data;
      
      // Update in tickets list
      setUserTickets(userTickets.map(t => t._id === ticketId ? updatedTicket : t));
      
      // Update selected ticket if it's the one being viewed
      if (selectedTicket?._id === ticketId) {
        setSelectedTicket(updatedTicket);
      }
    } catch (err) {
      console.error('Error refreshing ticket:', err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Scroll to bottom when selected ticket changes or messages update
    if (selectedTicket) {
      setTimeout(scrollToBottom, 100);
    }
  }, [selectedTicket]);

  const handleSelectTicket = async (ticket) => {
    setSelectedTicket(ticket);
    // Refresh to get latest data including new admin replies
    await refreshTicket(ticket._id);
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;

    try {
      setSendingReply(true);
      await api.post(`/contact/${selectedTicket._id}/user-reply`, {
        userReply: replyText
      });

      // Reload tickets to get updated data
      await loadUserTickets(currentUser);
      
      // Update selected ticket
      const updatedTickets = await api.get(`/contact/user/${currentUser}`);
      const updated = updatedTickets.data.find(t => t._id === selectedTicket._id);
      setSelectedTicket(updated);
      
      setReplyText('');
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    } catch (err) {
      console.error('Error sending reply:', err);
      setError('Failed to send reply. Please try again.');
    } finally {
      setSendingReply(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 2) {
      setError('Maximum 2 files allowed');
      return;
    }
    
    // Check file size (max 5MB per file)
    const maxSize = 5 * 1024 * 1024;
    const oversized = files.find(f => f.size > maxSize);
    if (oversized) {
      setError('File size must not exceed 5MB');
      return;
    }
    
    setAttachments(files);
    setError('');
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const formDataToSend = new FormData();
      
      // Add form fields
      Object.keys(formData).forEach(key => {
        formDataToSend.append(key, formData[key]);
      });
      formDataToSend.append('username', currentUser);
      formDataToSend.append('status', 'open');
      
      // Add attachments
      attachments.forEach((file) => {
        formDataToSend.append('attachments', file);
      });

      await api.post('/contact', formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setSubmitted(true);
      
      // Reload tickets
      if (currentUser) {
        loadUserTickets(currentUser);
      }

      // Reset form
      setFormData({
        name: formData.name,
        email: formData.email,
        subject: '',
        category: '',
        priority: 'medium',
        message: ''
      });
      setAttachments([]);

      // Auto-hide success message after 5 seconds
      setTimeout(() => setSubmitted(false), 5000);
    } catch (err) {
      console.error('Contact form error:', err);
      // Handle different error formats
      let errorMsg = 'Failed to submit. Please try again.';
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        // If detail is an array (validation errors), extract messages
        if (Array.isArray(detail)) {
          errorMsg = detail.map(e => e.msg || JSON.stringify(e)).join(', ');
        } else if (typeof detail === 'string') {
          errorMsg = detail;
        } else {
          errorMsg = JSON.stringify(detail);
        }
      } else if (err.message) {
        errorMsg = err.message;
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      open: { icon: '🔵', label: 'Open', class: 'status-open' },
      in_progress: { icon: '🟡', label: 'In Progress', class: 'status-progress' },
      resolved: { icon: '🟢', label: 'Resolved', class: 'status-resolved' },
      closed: { icon: '⚫', label: 'Closed', class: 'status-closed' }
    };
    return badges[status] || badges.open;
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      low: { icon: '🔵', label: 'Low' },
      medium: { icon: '🟡', label: 'Medium' },
      high: { icon: '🟠', label: 'High' },
      urgent: { icon: '🔴', label: 'Urgent' }
    };
    return badges[priority] || badges.medium;
  };

  return (
    <div className="contact-page">
      <div className="contact-container">
        {/* Header */}
        <div className="contact-header">
          <h1>📧 Contact Us</h1>
          <p>We're here to help! Send us a message and we'll respond within 24-48 hours.</p>
        </div>

        {/* Success Message */}
        {submitted && (
          <div className="alert alert-success chat-message">
            <div className="message-icon">✅</div>
            <div className="message-content">
              <strong>Message sent successfully!</strong>
              <p>We've received your message and will get back to you soon. Check your tickets below for updates.</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="alert alert-danger chat-message">
            <div className="message-icon">❌</div>
            <div className="message-content">
              <strong>Oops!</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        <div className="contact-layout">
          {/* Left: Chat-style form */}
          <div className="contact-form-section">
            <div className="chat-header">
              <div className="chat-avatar">💬</div>
              <div className="chat-title">
                <h3>Start a Conversation</h3>
                <p className="chat-status">
                  <span className="status-dot"></span> Usually replies within 24 hours
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="contact-form">
              {/* Name & Email (side by side) */}
              <div className="form-row">
                <div className="form-group">
                  <label>Your Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="John Doe"
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="john@example.com"
                    className="form-control"
                  />
                </div>
              </div>

              {/* Category Selection (visual cards) */}
              <div className="form-group">
                <label>What can we help you with? *</label>
                <div className="category-grid">
                  {categories.map(cat => (
                    <div
                      key={cat.value}
                      className={`category-card ${formData.category === cat.value ? 'selected' : ''}`}
                      onClick={() => setFormData(prev => ({ ...prev, category: cat.value }))}
                    >
                      <div className="category-label">{cat.label}</div>
                      <div className="category-desc">{cat.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div className="form-group">
                <label>Subject *</label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  placeholder="Brief summary of your issue"
                  className="form-control"
                />
              </div>

              {/* Priority */}
              <div className="form-group">
                <label>Priority Level</label>
                <div className="priority-selector">
                  {['low', 'medium', 'high', 'urgent'].map(p => (
                    <label key={p} className="priority-option">
                      <input
                        type="radio"
                        name="priority"
                        value={p}
                        checked={formData.priority === p}
                        onChange={handleChange}
                      />
                      <span className={`priority-badge priority-${p}`}>
                        {getPriorityBadge(p).icon} {getPriorityBadge(p).label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div className="form-group">
                <label>Your Message *</label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows="6"
                  placeholder="Tell us more about your issue or question..."
                  className="form-control"
                />
                <small className="form-hint">
                  Be as detailed as possible. Include screenshots or error messages if applicable.
                </small>
              </div>

              {/* File Attachments */}
              <div className="form-group">
                <label>Attachments (Optional)</label>
                <div className="file-upload-area">
                  <input
                    type="file"
                    id="file-upload"
                    onChange={handleFileChange}
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.txt"
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="file-upload" className="file-upload-label">
                    📎 Choose Files (Max 2, 5MB each)
                  </label>
                  {attachments.length > 0 && (
                    <div className="attachments-preview">
                      {attachments.map((file, index) => (
                        <div key={index} className="attachment-item">
                          <span className="attachment-name">📄 {file.name}</span>
                          <span className="attachment-size">
                            {(file.size / 1024).toFixed(1)} KB
                          </span>
                          <button
                            type="button"
                            className="btn-remove-attachment"
                            onClick={() => removeAttachment(index)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <small className="form-hint">
                  Accepted formats: Images, PDF, Word, Text files
                </small>
              </div>

              {/* Disclaimer */}
              <div className="disclaimer-box">
                <div className="disclaimer-icon">ℹ️</div>
                <div className="disclaimer-content">
                  <strong>Important Notice:</strong>
                  <p>
                    Admins and moderators have the authority to manage and delete conversations as needed. 
                    All conversations and attachments will be automatically deleted once your issue is marked as resolved. 
                    Please save any important information separately.
                  </p>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="btn btn-primary btn-submit"
                disabled={loading || !formData.category}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Sending...
                  </>
                ) : (
                  <>
                    <span>📤 Send Message</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right: Previous tickets */}
          <div className="tickets-section">
            <h3>📋 Your Tickets</h3>
            {userTickets.length === 0 ? (
              <div className="no-tickets">
                <div className="no-tickets-icon">💬</div>
                <p>No previous tickets</p>
                <small>Submit your first message to start a conversation!</small>
              </div>
            ) : (
              <div className="tickets-list">
                {userTickets.map(ticket => {
                  const statusBadge = getStatusBadge(ticket.status);
                  const priorityBadge = getPriorityBadge(ticket.priority);
                  
                  return (
                    <div 
                      key={ticket._id} 
                      className={`ticket-card ${selectedTicket?._id === ticket._id ? 'selected' : ''}`}
                      onClick={() => handleSelectTicket(ticket)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="ticket-header">
                        <span className={`ticket-status ${statusBadge.class}`}>
                          {statusBadge.icon} {statusBadge.label}
                        </span>
                        <span className="ticket-date">
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="ticket-subject">{ticket.subject}</h4>
                      <p className="ticket-category">
                        {categories.find(c => c.value === ticket.category)?.label || ticket.category}
                      </p>
                      <p className="ticket-message">{ticket.message.substring(0, 100)}...</p>
                      
                      {ticket.adminReply && (
                        <div className="admin-reply-preview">
                          <strong>📩 Admin replied:</strong>
                          <p>{ticket.adminReply.substring(0, 80)}...</p>
                        </div>
                      )}
                      
                      <div className="ticket-footer">
                        <span className={`ticket-priority priority-${ticket.priority}`}>
                          {priorityBadge.icon} {priorityBadge.label}
                        </span>
                        <span className="ticket-id">#{ticket._id.slice(-6)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Conversation Thread View */}
            {selectedTicket && (
              <div className="ticket-thread">
                <div className="thread-header">
                  <div>
                    <h3>{selectedTicket.subject}</h3>
                    <span className="thread-id">Ticket #{selectedTicket._id.slice(-6)}</span>
                  </div>
                  <button 
                    className="btn-close-thread" 
                    onClick={() => setSelectedTicket(null)}
                  >
                    ✕ Close
                  </button>
                </div>

                <div className="thread-messages">
                  {(() => {
                    // Build all messages in chronological order
                    const messages = [];
                    
                    // Original message
                    messages.push({
                      type: 'user',
                      sender: 'You',
                      message: selectedTicket.message,
                      timestamp: new Date(selectedTicket.createdAt),
                      key: 'original'
                    });
                    
                    // Admin reply
                    if (selectedTicket.adminReply) {
                      messages.push({
                        type: 'admin',
                        sender: '🛡️ Admin',
                        message: selectedTicket.adminReply,
                        timestamp: new Date(selectedTicket.repliedAt),
                        key: 'admin-reply'
                      });
                    }
                    
                    // User replies
                    if (selectedTicket.userReplies) {
                      selectedTicket.userReplies.forEach((reply, idx) => {
                        messages.push({
                          type: 'user',
                          sender: 'You',
                          message: reply.message,
                          timestamp: new Date(reply.timestamp),
                          key: `user-reply-${idx}`
                        });
                      });
                    }
                    
                    // Sort by timestamp (oldest to newest)
                    messages.sort((a, b) => a.timestamp - b.timestamp);
                    
                    // Render messages
                    return messages.map(msg => (
                      <div key={msg.key} className={`thread-message ${msg.type}-message`}>
                        <div className="message-header">
                          <strong>{msg.sender}</strong>
                          <span className="message-time">
                            {msg.timestamp.toLocaleString()}
                          </span>
                        </div>
                        <div className="message-body">{msg.message}</div>
                        
                        {/* Show attachments for original message */}
                        {msg.key === 'original' && selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                          <div className="message-attachments">
                            {selectedTicket.attachments.map((att, idx) => (
                              <a 
                                key={idx}
                                href={getBackendApiUrl(`/api/users/contact/download/${selectedTicket._id}/${att.stored_filename}`)}
                                download={att.filename}
                                className="attachment-link"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                📎 {att.filename} <span className="att-size">({(att.size / 1024).toFixed(1)} KB)</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ));
                  })()}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply Form */}
                {selectedTicket.status !== 'closed' && (
                  <form onSubmit={handleSendReply} className="thread-reply-form">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your reply here..."
                      rows="4"
                      className="reply-textarea"
                      required
                    />
                    <button 
                      type="submit" 
                      className="btn-send-reply"
                      disabled={sendingReply || !replyText.trim()}
                    >
                      {sendingReply ? '📤 Sending...' : '📤 Send Reply'}
                    </button>
                  </form>
                )}

                {selectedTicket.status === 'closed' && (
                  <div className="thread-closed-notice">
                    🔒 This ticket has been closed. Please create a new ticket if you need further assistance.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactUs;
