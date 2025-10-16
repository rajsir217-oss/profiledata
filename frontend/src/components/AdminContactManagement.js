import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './AdminContactManagement.css';

/**
 * AdminContactManagement - Admin CRUD interface for contact tickets
 * Inbox-style layout with reply functionality
 */
const AdminContactManagement = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  
  // Status notification
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success'|'error', text: '...' }
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'technical', label: '🔧 Technical Support' },
    { value: 'account', label: '👤 Account Issues' },
    { value: 'safety', label: '🛡️ Safety & Privacy' },
    { value: 'billing', label: '💳 Billing & Payments' },
    { value: 'feature', label: '✨ Feature Request' },
    { value: 'feedback', label: '💬 General Feedback' },
    { value: 'other', label: '📋 Other' }
  ];

  useEffect(() => {
    // Check admin role
    const currentUsername = localStorage.getItem('username');
    if (currentUsername !== 'admin') {
      navigate('/dashboard');
      return;
    }
    
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, statusFilter, categoryFilter, priorityFilter, searchQuery]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Scroll to bottom when selected ticket changes or messages update
    if (selectedTicket) {
      setTimeout(scrollToBottom, 100);
    }
  }, [selectedTicket]);

  // Helper to show status notification
  const showStatus = (type, text) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000); // Auto-hide after 4s
  };

  const loadTickets = async () => {
    try {
      setLoading(true);
      const response = await api.get('/contact/admin/all');
      setTickets(response.data);
    } catch (err) {
      console.error('Error loading tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshTicket = async (ticketId) => {
    try {
      // Fetch the updated ticket from backend
      const response = await api.get(`/contact/${ticketId}`);
      const updatedTicket = response.data;
      
      // Update in tickets list
      setTickets(tickets.map(t => t._id === ticketId ? updatedTicket : t));
      
      // Update selected ticket if it's the one being viewed
      if (selectedTicket?._id === ticketId) {
        setSelectedTicket(updatedTicket);
      }
    } catch (err) {
      console.error('Error refreshing ticket:', err);
    }
  };

  const handleSelectTicket = async (ticket) => {
    setSelectedTicket(ticket);
    // Refresh to get latest data including new user replies
    await refreshTicket(ticket._id);
  };

  const applyFilters = () => {
    let filtered = [...tickets];
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }
    
    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(t => t.category === categoryFilter);
    }
    
    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(t => t.priority === priorityFilter);
    }
    
    // Search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.subject.toLowerCase().includes(query) ||
        t.message.toLowerCase().includes(query) ||
        t.name.toLowerCase().includes(query) ||
        t.email.toLowerCase().includes(query)
      );
    }
    
    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    setFilteredTickets(filtered);
  };

  const updateTicketStatus = async (ticketId, newStatus) => {
    try {
      await api.put(`/contact/${ticketId}/status`, { status: newStatus });
      setTickets(tickets.map(t => t._id === ticketId ? { ...t, status: newStatus } : t));
      if (selectedTicket?._id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status: newStatus });
      }
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to update status';
      showStatus('error', 'Failed to update status: ' + (typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg)));
    }
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;
    
    try {
      setSending(true);
      await api.post(`/contact/${selectedTicket._id}/reply`, {
        adminReply: replyText,
        adminName: localStorage.getItem('username')
      });
      
      // Update local state
      const updatedTicket = {
        ...selectedTicket,
        adminReply: replyText,
        repliedAt: new Date().toISOString(),
        status: 'in_progress'
      };
      
      setTickets(tickets.map(t => t._id === selectedTicket._id ? updatedTicket : t));
      setSelectedTicket(updatedTicket);
      setReplyText('');
      
      showStatus('success', '✅ Reply sent successfully!');
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to send reply';
      showStatus('error', 'Failed to send reply: ' + (typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg)));
    } finally {
      setSending(false);
    }
  };

  const deleteTicket = async (ticketId) => {
    if (!window.confirm('Are you sure you want to delete this ticket? This action cannot be undone.')) {
      return;
    }
    
    try {
      await api.delete(`/contact/${ticketId}`);
      setTickets(tickets.filter(t => t._id !== ticketId));
      if (selectedTicket?._id === ticketId) {
        setSelectedTicket(null);
      }
      showStatus('success', '✅ Ticket deleted successfully!');
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to delete ticket';
      showStatus('error', 'Failed to delete ticket: ' + (typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg)));
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
      low: { icon: '🔵', label: 'Low', class: 'priority-low' },
      medium: { icon: '🟡', label: 'Medium', class: 'priority-medium' },
      high: { icon: '🟠', label: 'High', class: 'priority-high' },
      urgent: { icon: '🔴', label: 'Urgent', class: 'priority-urgent' }
    };
    return badges[priority] || badges.medium;
  };

  const getStats = () => {
    return {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'open').length,
      inProgress: tickets.filter(t => t.status === 'in_progress').length,
      resolved: tickets.filter(t => t.status === 'resolved').length,
      needsReply: tickets.filter(t => !t.adminReply && t.status !== 'closed').length
    };
  };

  const stats = getStats();

  return (
    <div className="admin-contact-page">
      {/* Status Bubble Notification */}
      {statusMessage && (
        <div className={`status-bubble ${statusMessage.type}`}>
          {statusMessage.type === 'success' ? '✅' : '❌'} {statusMessage.text}
        </div>
      )}

      <div className="admin-header">
        <h1>📨 Contact Support Management</h1>
        <p>Manage user support tickets and inquiries</p>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📨</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Tickets</div>
        </div>
        <div className="stat-card stat-open">
          <div className="stat-icon">🔵</div>
          <div className="stat-value">{stats.open}</div>
          <div className="stat-label">Open</div>
        </div>
        <div className="stat-card stat-progress">
          <div className="stat-icon">🟡</div>
          <div className="stat-value">{stats.inProgress}</div>
          <div className="stat-label">In Progress</div>
        </div>
        <div className="stat-card stat-resolved">
          <div className="stat-icon">🟢</div>
          <div className="stat-value">{stats.resolved}</div>
          <div className="stat-label">Resolved</div>
        </div>
        <div className="stat-card stat-urgent">
          <div className="stat-icon">⚠️</div>
          <div className="stat-value">{stats.needsReply}</div>
          <div className="stat-label">Needs Reply</div>
        </div>
      </div>

      <div className="inbox-layout">
        {/* Left: Ticket List */}
        <div className="tickets-panel">
          {/* Filters */}
          <div className="filters-bar">
            <input
              type="text"
              placeholder="🔍 Search tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Status</option>
              <option value="open">🔵 Open</option>
              <option value="in_progress">🟡 In Progress</option>
              <option value="resolved">🟢 Resolved</option>
              <option value="closed">⚫ Closed</option>
            </select>
            
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="filter-select"
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
            
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Priority</option>
              <option value="low">🔵 Low</option>
              <option value="medium">🟡 Medium</option>
              <option value="high">🟠 High</option>
              <option value="urgent">🔴 Urgent</option>
            </select>
          </div>

          {/* Ticket List */}
          <div className="ticket-list">
            {loading ? (
              <div className="loading-state">
                <div className="spinner-border"></div>
                <p>Loading tickets...</p>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <p>No tickets found</p>
                <small>Try adjusting your filters</small>
              </div>
            ) : (
              filteredTickets.map(ticket => {
                const statusBadge = getStatusBadge(ticket.status);
                const priorityBadge = getPriorityBadge(ticket.priority);
                const isSelected = selectedTicket?._id === ticket._id;
                
                return (
                  <div
                    key={ticket._id}
                    className={`ticket-item ${isSelected ? 'selected' : ''} ${!ticket.adminReply ? 'unread' : ''}`}
                    onClick={() => handleSelectTicket(ticket)}
                  >
                    <div className="ticket-item-header">
                      <span className={`ticket-status-badge ${statusBadge.class}`}>
                        {statusBadge.icon}
                      </span>
                      <span className={`ticket-priority-badge ${priorityBadge.class}`}>
                        {priorityBadge.icon}
                      </span>
                      {!ticket.adminReply && (
                        <span className="needs-reply-badge">⚠️</span>
                      )}
                    </div>
                    <h4 className="ticket-item-subject">{ticket.subject}</h4>
                    <p className="ticket-item-from">From: {ticket.name} ({ticket.username || 'Guest'})</p>
                    <p className="ticket-item-preview">{ticket.message.substring(0, 60)}...</p>
                    <div className="ticket-item-meta">
                      <span className="ticket-date">
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </span>
                      <span className="ticket-category-tag">
                        {categories.find(c => c.value === ticket.category)?.label || ticket.category}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Ticket Detail */}
        <div className="ticket-detail-panel">
          {!selectedTicket ? (
            <div className="no-selection">
              <div className="no-selection-icon">👈</div>
              <h3>Select a Ticket</h3>
              <p>Choose a ticket from the list to view details and reply</p>
            </div>
          ) : (
            <>
              {/* Ticket Header */}
              <div className="ticket-detail-header">
                <div className="ticket-detail-title">
                  <h2>{selectedTicket.subject}</h2>
                  <div className="ticket-badges">
                    <span className={`badge ${getStatusBadge(selectedTicket.status).class}`}>
                      {getStatusBadge(selectedTicket.status).icon} {getStatusBadge(selectedTicket.status).label}
                    </span>
                    <span className={`badge ${getPriorityBadge(selectedTicket.priority).class}`}>
                      {getPriorityBadge(selectedTicket.priority).icon} {getPriorityBadge(selectedTicket.priority).label}
                    </span>
                  </div>
                </div>
                
                <div className="ticket-actions">
                  <select
                    value={selectedTicket.status}
                    onChange={(e) => updateTicketStatus(selectedTicket._id, e.target.value)}
                    className="status-dropdown"
                  >
                    <option value="open">🔵 Open</option>
                    <option value="in_progress">🟡 In Progress</option>
                    <option value="resolved">🟢 Resolved</option>
                    <option value="closed">⚫ Closed</option>
                  </select>
                  
                  <button
                    onClick={() => deleteTicket(selectedTicket._id)}
                    className="btn btn-danger btn-sm"
                    title="Delete Ticket"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>

              {/* Ticket Info */}
              <div className="ticket-info-section">
                <div className="info-row">
                  <strong>From:</strong> {selectedTicket.name}
                </div>
                <div className="info-row">
                  <strong>Email:</strong> {selectedTicket.email}
                </div>
                <div className="info-row">
                  <strong>Username:</strong> {selectedTicket.username || 'Guest'}
                </div>
                <div className="info-row">
                  <strong>Category:</strong> {categories.find(c => c.value === selectedTicket.category)?.label}
                </div>
                <div className="info-row">
                  <strong>Created:</strong> {new Date(selectedTicket.createdAt).toLocaleString()}
                </div>
                <div className="info-row">
                  <strong>Ticket ID:</strong> <code>#{selectedTicket._id.slice(-8)}</code>
                </div>
              </div>

              {/* Conversation */}
              <div className="ticket-conversation">
                {(() => {
                  // Build all messages in chronological order
                  const messages = [];
                  
                  // Original user message
                  messages.push({
                    type: 'user',
                    sender: selectedTicket.name,
                    message: selectedTicket.message,
                    timestamp: new Date(selectedTicket.createdAt),
                    key: 'original'
                  });
                  
                  // Admin reply
                  if (selectedTicket.adminReply) {
                    messages.push({
                      type: 'admin',
                      sender: 'Admin Response',
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
                        sender: selectedTicket.name,
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
                    <div key={msg.key} className={`message-bubble ${msg.type}-message`}>
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
                              href={`http://localhost:8000/api/users/contact/download/${selectedTicket._id}/${att.stored_filename}`}
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

              {/* Reply Box */}
              <div className="reply-section">
                <h4>💬 Send Reply</h4>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your response here... (User will receive this via email)"
                  rows="6"
                  className="reply-textarea"
                />
                <div className="reply-actions">
                  <button
                    onClick={sendReply}
                    disabled={sending || !replyText.trim()}
                    className="btn btn-primary"
                  >
                    {sending ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Sending...
                      </>
                    ) : (
                      <>📤 Send Reply</>
                    )}
                  </button>
                  <button
                    onClick={() => setReplyText('')}
                    className="btn btn-outline-secondary"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminContactManagement;
