import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBackendUrl } from '../config/apiConfig';
import toastService from '../services/toastService';
import DeleteButton from './DeleteButton';
import SEO from './SEO';
import './PromoCodeManager.css';

const PromoCodeManager = () => {
  const navigate = useNavigate();
  const [promoCodes, setPromoCodes] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCode, setEditingCode] = useState(null);
  const [editingIsSystemCode, setEditingIsSystemCode] = useState(false); // Track if editing system code
  const [codeError, setCodeError] = useState('');
  const [archiveCode, setArchiveCode] = useState(null); // For archive confirmation
  const [archivedCodes, setArchivedCodes] = useState([]);
  const [showArchived, setShowArchived] = useState(false); // Toggle archive view
  const [qrCodeModal, setQrCodeModal] = useState(null); // For QR code display
  const [showAnalytics, setShowAnalytics] = useState(false); // Toggle analytics view
  const [analytics, setAnalytics] = useState(null); // Analytics data
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  
  // Filter state
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');
  
  // Membership plans from site settings
  const [membershipPlans, setMembershipPlans] = useState([]);
  
  // Form state for new promo code
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'referral',
    description: '',
    discountType: 'none',
    discountValue: 0,
    applicablePlans: [],
    defaultPlan: 'premium',
    planPricing: {},
    validFrom: '',
    validUntil: '',
    maxUses: '',
    isActive: true,
    tags: ''
  });

  // Check admin access
  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin') {
      console.warn('⚠️ Unauthorized access attempt to PromoCodeManager');
      navigate('/dashboard');
    }
  }, [navigate]);

  // Load promo codes and membership plans
  useEffect(() => {
    loadPromoCodes();
    loadArchivedCodes();
    loadStats();
    loadMembershipPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ESC key handler
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        if (showAddModal) setShowAddModal(false);
        if (showEditModal) setShowEditModal(false);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [showAddModal, showEditModal]);

  const loadMembershipPlans = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/site-settings/membership`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.membership?.plans) {
          setMembershipPlans(data.membership.plans);
        }
      }
    } catch (err) {
      console.error('Error loading membership plans:', err);
    }
  };

  const loadPromoCodes = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        toastService.error('Not authenticated');
        setPromoCodes([]);
        return;
      }
      
      const params = new URLSearchParams();
      if (filterType !== 'all') params.append('type', filterType);
      if (filterStatus !== 'all') params.append('is_active', filterStatus === 'active');
      
      const response = await fetch(`${getBackendUrl()}/api/promo-codes?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        // API returns { promoCodes: [...], total: int }
        const codes = data.promoCodes || [];
        // Ensure we have an array
        setPromoCodes(Array.isArray(codes) ? codes : []);
      } else {
        const errorData = await response.json().catch(() => ({}));
        // Handle both string errors and validation error arrays
        let errorMsg = 'Failed to load promo codes';
        if (typeof errorData.detail === 'string') {
          errorMsg = errorData.detail;
        } else if (Array.isArray(errorData.detail)) {
          errorMsg = errorData.detail.map(e => e.msg || String(e)).join(', ');
        }
        console.error('API Error:', errorMsg);
        toastService.error(errorMsg);
        setPromoCodes([]);
      }
    } catch (err) {
      console.error('Error loading promo codes:', err);
      toastService.error('Error loading promo codes: ' + err.message);
      setPromoCodes([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/promo-codes/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📊 Stats API response:', data);
        // Ensure stats is a plain object with expected fields
        setStats({
          totalCodes: data.totalCodes || 0,
          activeCodes: data.activeCodes || 0,
          totalRegistrations: data.totalRegistrations || 0,
          totalConversions: data.totalConversions || 0
        });
      } else {
        console.error('Stats API error:', response.status);
        setStats(null);
      }
    } catch (err) {
      console.error('Error loading stats:', err);
      setStats(null);
    }
  };

  const loadArchivedCodes = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/promo-codes/archived/list`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setArchivedCodes(data.promoCodes || []);
      } else {
        setArchivedCodes([]);
      }
    } catch (err) {
      console.error('Error loading archived codes:', err);
      setArchivedCodes([]);
    }
  };

  const loadAnalytics = async () => {
    try {
      setLoadingAnalytics(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/promo-codes/analytics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      } else {
        console.error('Failed to load analytics');
      }
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const toggleAnalytics = () => {
    if (!showAnalytics && !analytics) {
      loadAnalytics();
    }
    setShowAnalytics(!showAnalytics);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      
      // Prepare data with proper date formatting
      const submitData = {
        code: formData.code.toUpperCase().replace(/\s+/g, '_'),
        name: formData.name,
        type: formData.type,
        description: formData.description || '',
        discountType: formData.discountType,
        discountValue: formData.discountType !== 'none' ? parseFloat(formData.discountValue) || 0 : 0,
        defaultPlan: formData.defaultPlan || 'premium',
        planPricing: Object.keys(formData.planPricing || {}).length > 0 ? formData.planPricing : null,
        maxUses: formData.maxUses ? parseInt(formData.maxUses) : null,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(t => t) : [],
        validFrom: formData.validFrom ? new Date(formData.validFrom).toISOString() : null,
        validUntil: formData.validUntil ? new Date(formData.validUntil).toISOString() : null,
        isActive: formData.isActive
      };

      const response = await fetch(`${getBackendUrl()}/api/promo-codes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(submitData)
      });

      if (response.ok) {
        toastService.success('Promo code created successfully!');
        setShowAddModal(false);
        resetForm();
        loadPromoCodes();
        loadStats();
      } else {
        const data = await response.json();
        // Handle both string errors and validation error arrays
        const errorMsg = typeof data.detail === 'string' 
          ? data.detail 
          : Array.isArray(data.detail) 
            ? data.detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ')
            : 'Failed to create promo code';
        toastService.error(errorMsg);
      }
    } catch (err) {
      toastService.error('Error creating promo code: ' + err.message);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingCode) return;

    try {
      const token = localStorage.getItem('token');
      
      // Build update data, only including fields that have values
      const updateData = {};
      
      if (formData.name) updateData.name = formData.name;
      if (formData.description) updateData.description = formData.description;
      if (formData.discountType) updateData.discountType = formData.discountType;
      if (formData.discountType && formData.discountType !== 'none') {
        updateData.discountValue = parseFloat(formData.discountValue) || 0;
      }
      if (formData.defaultPlan) {
        updateData.defaultPlan = formData.defaultPlan;
      }
      if (formData.planPricing && Object.keys(formData.planPricing).length > 0) {
        updateData.planPricing = formData.planPricing;
      }
      if (formData.validFrom) {
        updateData.validFrom = new Date(formData.validFrom).toISOString();
      }
      if (formData.validUntil) {
        updateData.validUntil = new Date(formData.validUntil).toISOString();
      }
      if (formData.maxUses) {
        updateData.maxUses = parseInt(formData.maxUses);
      }
      if (typeof formData.isActive === 'boolean') {
        updateData.isActive = formData.isActive;
      }
      if (formData.tags) {
        const tagsArray = formData.tags.split(',').map(t => t.trim()).filter(t => t);
        if (tagsArray.length > 0) updateData.tags = tagsArray;
      }

      const response = await fetch(`${getBackendUrl()}/api/promo-codes/${editingCode}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        toastService.success('Promo code updated successfully!');
        setShowEditModal(false);
        setEditingCode(null);
        resetForm();
        loadPromoCodes();
        loadStats();
      } else {
        const data = await response.json();
        // Handle both string errors and validation error arrays
        const errorMsg = typeof data.detail === 'string' 
          ? data.detail 
          : Array.isArray(data.detail) 
            ? data.detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ')
            : 'Failed to update promo code';
        toastService.error(errorMsg);
      }
    } catch (err) {
      toastService.error('Error updating promo code: ' + err.message);
    }
  };

  const handleDelete = async (code) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/promo-codes/${code}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        toastService.success('Promo code deleted successfully!');
        loadPromoCodes();
        loadStats();
      } else {
        const data = await response.json();
        toastService.error(data.detail || 'Failed to delete promo code');
      }
    } catch (err) {
      toastService.error('Error deleting promo code: ' + err.message);
    }
  };

  const handleArchive = async (code) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/promo-codes/${code}/archive`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        toastService.success('Promo code archived successfully!');
        loadPromoCodes();
        loadArchivedCodes();
        loadStats();
      } else {
        const data = await response.json();
        toastService.error(data.detail || 'Failed to archive promo code');
      }
    } catch (err) {
      toastService.error('Error archiving promo code: ' + err.message);
    }
  };

  const handleRestore = async (code) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/promo-codes/${code}/restore`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        toastService.success('Promo code restored successfully!');
        loadPromoCodes();
        loadArchivedCodes();
        loadStats();
      } else {
        const data = await response.json();
        toastService.error(data.detail || 'Failed to restore promo code');
      }
    } catch (err) {
      toastService.error('Error restoring promo code: ' + err.message);
    }
  };

  const handleDeleteArchived = async (code) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/promo-codes/${code}/permanent`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        toastService.success('Promo code permanently deleted!');
        loadArchivedCodes();
        loadStats();
      } else {
        const data = await response.json();
        toastService.error(data.detail || 'Failed to delete promo code');
      }
    } catch (err) {
      toastService.error('Error deleting promo code: ' + err.message);
    }
  };

  const handleEdit = (promoCode) => {
    setEditingCode(promoCode.code);
    setEditingIsSystemCode(promoCode.code === 'NOPROMOCODE' || promoCode.createdBy === 'system');
    setFormData({
      code: promoCode.code,
      name: promoCode.name || '',
      type: promoCode.type || 'referral',
      description: promoCode.description || '',
      discountType: promoCode.discountType || 'none',
      discountValue: promoCode.discountValue || 0,
      applicablePlans: promoCode.applicablePlans || [],
      defaultPlan: promoCode.defaultPlan || 'premium',
      planPricing: promoCode.planPricing || {},
      validFrom: promoCode.validFrom ? promoCode.validFrom.split('T')[0] : '',
      validUntil: promoCode.validUntil ? promoCode.validUntil.split('T')[0] : '',
      maxUses: promoCode.maxUses || '',
      isActive: promoCode.isActive !== false,
      tags: promoCode.tags ? promoCode.tags.join(', ') : ''
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      type: 'referral',
      description: '',
      discountType: 'none',
      discountValue: 0,
      applicablePlans: [],
      defaultPlan: 'premium',
      planPricing: {},
      validFrom: '',
      validUntil: '',
      maxUses: '',
      isActive: true,
      tags: ''
    });
  };

  // Calculate effective pricing (custom overrides default, then apply discount)
  const getEffectivePricing = (customPricing = {}, discountType = 'none', discountValue = 0) => {
    const defaultPlans = membershipPlans.length > 0 ? membershipPlans : [
      { id: 'basic', name: 'Basic', price: 49 },
      { id: 'premium', name: 'Premium', price: 99 },
      { id: 'lifetime', name: 'Lifetime', price: 199 }
    ];
    
    return defaultPlans.map(plan => {
      // Custom price wins over default
      const basePrice = customPricing?.[plan.id] ?? plan.price;
      
      // Apply discount
      let effectivePrice = basePrice;
      if (discountType === 'percentage' && discountValue > 0) {
        effectivePrice = basePrice * (1 - discountValue / 100);
      } else if (discountType === 'fixed' && discountValue > 0) {
        effectivePrice = Math.max(0, basePrice - discountValue);
      }
      
      return {
        id: plan.id,
        name: plan.name,
        basePrice: basePrice,
        effectivePrice: Math.round(effectivePrice * 100) / 100,
        isCustom: customPricing?.[plan.id] !== undefined,
        hasDiscount: discountType !== 'none' && discountValue > 0
      };
    });
  };

  // Generate invitation link for a promo code
  const getInvitationLink = (code) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/register?promo=${encodeURIComponent(code)}`;
  };

  // Generate QR code URL using a free QR code API
  const getQrCodeUrl = (code) => {
    const invitationLink = getInvitationLink(code);
    // Using QR Server API (free, no API key needed)
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(invitationLink)}`;
  };

  // Copy invitation link to clipboard
  const copyInvitationLink = (code) => {
    const link = getInvitationLink(code);
    navigator.clipboard.writeText(link).then(() => {
      toastService.success('Invitation link copied to clipboard!');
    }).catch(() => {
      toastService.error('Failed to copy link');
    });
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Filter and sort promo codes
  const getFilteredAndSortedCodes = () => {
    // Ensure promoCodes is an array
    if (!Array.isArray(promoCodes)) {
      return [];
    }
    let filtered = promoCodes.filter(code => {
      const matchesSearch = !searchTerm || 
        code.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        code.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || code.type === filterType;
      const matchesStatus = filterStatus === 'all' || 
        (filterStatus === 'active' && code.isActive) ||
        (filterStatus === 'inactive' && !code.isActive);
      return matchesSearch && matchesType && matchesStatus;
    });

    filtered.sort((a, b) => {
      let aVal = a[sortColumn] || '';
      let bVal = b[sortColumn] || '';
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  };

  const filteredCodes = getFilteredAndSortedCodes();

  const getTypeIcon = (type) => {
    const icons = {
      'referral': '👤',
      'community': '🏘️',
      'event': '🎉',
      'campaign': '📢'
    };
    return icons[type] || '🎫';
  };

  const getTypeBadgeClass = (type) => {
    const classes = {
      'referral': 'type-referral',
      'community': 'type-community',
      'event': 'type-event',
      'campaign': 'type-campaign'
    };
    return classes[type] || 'type-default';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="promo-code-manager">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading promo codes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="promo-code-manager">
      <SEO 
        title="Promo Code Manager"
        description="Manage promo codes, discounts, and referral campaigns"
      />

      {/* Action Bar */}
      <div className="promo-action-bar">
        <div className="action-buttons">
          <button 
            className="btn-analytics"
            onClick={toggleAnalytics}
          >
            📊 {showAnalytics ? 'Hide' : 'View'} Analytics
          </button>
          <button 
            className="btn-create"
            onClick={() => { resetForm(); setShowAddModal(true); }}
          >
            ➕ Create Promo Code
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.totalCodes || 0}</div>
              <div className="stat-label">Total Codes</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.activeCodes || 0}</div>
              <div className="stat-label">Active</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.totalRegistrations || 0}</div>
              <div className="stat-label">Registrations</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.totalConversions || 0}</div>
              <div className="stat-label">Conversions</div>
            </div>
          </div>
        )}

        {/* Analytics Dashboard */}
        {showAnalytics && (
          <div className="analytics-dashboard">
            <div className="analytics-header">
              <h3>📊 Analytics Dashboard</h3>
              <button className="btn-refresh-small" onClick={loadAnalytics} disabled={loadingAnalytics}>
                {loadingAnalytics ? '⏳' : '🔄'}
              </button>
            </div>
            
            {loadingAnalytics ? (
              <div className="analytics-loading">Loading analytics...</div>
            ) : analytics ? (
              <>
                {/* Summary Stats */}
                <div className="analytics-summary">
                  <div className="analytics-stat">
                    <span className="analytics-stat-value">{analytics.summary?.totalRegistrations || 0}</span>
                    <span className="analytics-stat-label">Total Registrations</span>
                  </div>
                  <div className="analytics-stat">
                    <span className="analytics-stat-value">{analytics.summary?.totalConversions || 0}</span>
                    <span className="analytics-stat-label">Total Conversions</span>
                  </div>
                  <div className="analytics-stat highlight">
                    <span className="analytics-stat-value">{analytics.summary?.overallConversionRate || 0}%</span>
                    <span className="analytics-stat-label">Conversion Rate</span>
                  </div>
                  <div className="analytics-stat">
                    <span className="analytics-stat-value">${(analytics.summary?.totalRevenue || 0).toFixed(2)}</span>
                    <span className="analytics-stat-label">Total Revenue</span>
                  </div>
                </div>

                {/* Per-Code Performance Table */}
                <div className="analytics-section">
                  <h4>📈 Performance by Promo Code</h4>
                  <div className="analytics-table-container">
                    <table className="analytics-table">
                      <thead>
                        <tr>
                          <th>CODE</th>
                          <th>TYPE</th>
                          <th>REGISTRATIONS</th>
                          <th>CONVERSIONS</th>
                          <th>CONV. RATE</th>
                          <th>REVENUE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.codeAnalytics?.map((code) => (
                          <tr key={code.code} className={!code.isActive ? 'inactive-row' : ''}>
                            <td>
                              <strong>{code.code}</strong>
                              <br />
                              <small className="code-name">{code.name}</small>
                            </td>
                            <td>
                              <span className={`type-badge ${code.type}`}>{code.type}</span>
                            </td>
                            <td className="number-cell">{code.registrations}</td>
                            <td className="number-cell">{code.conversions}</td>
                            <td className="number-cell">
                              <span className={`rate-badge ${code.conversionRate >= 50 ? 'high' : code.conversionRate >= 20 ? 'medium' : 'low'}`}>
                                {code.conversionRate}%
                              </span>
                            </td>
                            <td className="number-cell">${code.revenue.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Registration Trends */}
                {analytics.trends && analytics.trends.length > 0 && (
                  <div className="analytics-section">
                    <h4>📅 Registration Trends (Monthly)</h4>
                    <div className="trends-chart">
                      {analytics.trends.slice(-12).map((month) => (
                        <div key={month.month} className="trend-bar-container">
                          <div 
                            className="trend-bar" 
                            style={{ 
                              height: `${Math.min(100, (month.total / Math.max(...analytics.trends.map(t => t.total))) * 100)}%` 
                            }}
                            title={`${month.month}: ${month.total} registrations`}
                          >
                            <span className="trend-value">{month.total}</span>
                          </div>
                          <span className="trend-label">{month.month.slice(5)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="analytics-empty">No analytics data available</div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="filter-row">
          <input
            type="text"
            className="filter-input"
            placeholder="🔍 Search codes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="filter-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="referral">👤 Referral</option>
            <option value="community">🏘️ Community</option>
            <option value="event">🎉 Event</option>
            <option value="campaign">📢 Campaign</option>
          </select>
          <select
            className="filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">✅ Active</option>
            <option value="inactive">❌ Inactive</option>
          </select>
          <button className="btn-refresh" onClick={loadPromoCodes}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Promo Codes Table */}
      <div className="promo-table-container">
        <table className="promo-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('code')} className="sortable">
                CODE {sortColumn === 'code' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('name')} className="sortable">
                NAME {sortColumn === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('type')} className="sortable">
                TYPE {sortColumn === 'type' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th>DISCOUNT</th>
              <th>EFFECTIVE PRICING</th>
              <th onClick={() => handleSort('currentUses')} className="sortable">
                USES {sortColumn === 'currentUses' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th>VALIDITY</th>
              <th onClick={() => handleSort('isActive')} className="sortable">
                STATUS {sortColumn === 'isActive' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredCodes.length === 0 ? (
              <tr>
                <td colSpan="8" className="empty-message">
                  No promo codes found. Create your first promo code!
                </td>
              </tr>
            ) : (
              filteredCodes.map((code) => (
                <tr key={code.code} className={!code.isActive ? 'inactive-row' : ''}>
                  <td>
                    <strong className="code-text">{code.code}</strong>
                  </td>
                  <td>{code.name || '-'}</td>
                  <td>
                    <span className={`type-badge ${getTypeBadgeClass(code.type)}`}>
                      {getTypeIcon(code.type)} {code.type}
                    </span>
                  </td>
                  <td>
                    {code.discountType === 'none' ? (
                      <span className="no-discount">-</span>
                    ) : code.discountType === 'percentage' ? (
                      <span className="discount-badge">{code.discountValue}% OFF</span>
                    ) : (
                      <span className="discount-badge">${code.discountValue} OFF</span>
                    )}
                  </td>
                  <td>
                    <div className="effective-pricing-mini">
                      {getEffectivePricing(code.planPricing, code.discountType, code.discountValue).map(plan => (
                        <span 
                          key={plan.id} 
                          className={`mini-price ${code.defaultPlan === plan.id ? 'default' : ''} ${plan.isCustom ? 'custom' : ''}`}
                          title={`${plan.name}: ${plan.isCustom ? 'Custom' : 'Default'} price${plan.hasDiscount ? ' with discount' : ''}`}
                        >
                          {plan.name.charAt(0)}: ${plan.effectivePrice}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span className="usage-badge">
                      {code.currentUses || 0} / {code.maxUses || '∞'}
                    </span>
                  </td>
                  <td>
                    <div className="validity-info">
                      <small>From: {formatDate(code.validFrom)}</small>
                      <small>Until: {formatDate(code.validUntil)}</small>
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${code.isActive ? 'status-active' : 'status-inactive'}`}>
                      {code.isActive ? '✅ Active' : '❌ Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-action btn-qr"
                        onClick={() => setQrCodeModal(code)}
                        title="View QR Code & Invitation Link"
                      >
                        📱
                      </button>
                      <button
                        className="btn-action btn-edit"
                        onClick={() => handleEdit(code)}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      {(() => {
                        // System codes like NOPROMOCODE cannot be deleted or archived
                        const isSystemCode = code.code === 'NOPROMOCODE' || code.createdBy === 'system';
                        if (isSystemCode) {
                          return (
                            <button
                              className="btn-action btn-system"
                              disabled
                              title="System code - cannot be deleted"
                            >
                              🔒
                            </button>
                          );
                        }
                        
                        const hasUsage = (code.currentUses > 0 || code.registrations > 0);
                        const isExpired = code.validUntil && new Date(code.validUntil) < new Date();
                        const isActive = code.isActive;
                        // Safe to delete: no usage AND (expired OR inactive)
                        const safeToDelete = !hasUsage && (isExpired || !isActive);
                        
                        if (safeToDelete) {
                          return (
                            <DeleteButton
                              onDelete={() => handleDelete(code.code)}
                              itemName={code.code}
                              buttonClassName="btn-action btn-delete"
                            />
                          );
                        } else {
                          const reasons = [];
                          if (hasUsage) reasons.push(`${code.currentUses || 0} uses, ${code.registrations || 0} registrations`);
                          if (!isExpired && isActive) reasons.push('not expired and still active');
                          return (
                            <button
                              className="btn-action btn-archive"
                              onClick={() => setArchiveCode(code)}
                              title={`Protected: ${reasons.join('; ')} - Click to archive`}
                            >
                              📦
                            </button>
                          );
                        }
                      })()}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="promo-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>➕ Create Promo Code</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Code *</label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => {
                        const newCode = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '');
                        setFormData({ ...formData, code: newCode });
                        // Check if code already exists
                        if (newCode.length >= 3) {
                          const exists = promoCodes.some(p => p.code.toUpperCase() === newCode);
                          setCodeError(exists ? `Code "${newCode}" already exists` : '');
                        } else {
                          setCodeError('');
                        }
                      }}
                      placeholder="e.g., TELUGU_ASSOC_2025"
                      required
                      minLength={3}
                      maxLength={50}
                      className={codeError ? 'input-error' : ''}
                    />
                    {codeError ? (
                      <small className="error-text">⚠️ {codeError}</small>
                    ) : (
                      <small>3-50 chars, uppercase letters, numbers, underscores only</small>
                    )}
                  </div>
                  <div className="form-group">
                    <label>Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Telugu Association 2025"
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Type *</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    >
                      <option value="referral">👤 Referral</option>
                      <option value="community">🏘️ Community</option>
                      <option value="event">🎉 Event</option>
                      <option value="campaign">📢 Campaign</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Max Uses</label>
                    <input
                      type="number"
                      value={formData.maxUses}
                      onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                      placeholder="Leave empty for unlimited"
                      min="1"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description..."
                    rows="2"
                  />
                </div>

                <div className="form-section">
                  <h4>💰 Discount Settings</h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Discount Type</label>
                      <select
                        value={formData.discountType}
                        onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                      >
                        <option value="none">No Discount</option>
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed Amount ($)</option>
                      </select>
                    </div>
                    {formData.discountType !== 'none' && (
                      <div className="form-group">
                        <label>Discount Value {formData.discountType === 'percentage' ? '(%)' : '($)'}</label>
                        <input
                          type="number"
                          value={formData.discountValue}
                          onChange={(e) => {
                            let val = parseFloat(e.target.value) || 0;
                            if (formData.discountType === 'percentage' && val > 100) val = 100;
                            if (val < 0) val = 0;
                            setFormData({ ...formData, discountValue: val });
                          }}
                          min="0"
                          max={formData.discountType === 'percentage' ? '100' : undefined}
                          step={formData.discountType === 'percentage' ? '1' : '0.01'}
                        />
                        {formData.discountType === 'percentage' && (
                          <small>Max 100%</small>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-section">
                  <h4>💳 Default Membership Plan</h4>
                  <p className="section-hint">Select which plan users will be enrolled in when using this code</p>
                  <div className="plan-selector-grid">
                    {(membershipPlans.length > 0 ? membershipPlans : [
                      { id: 'basic', name: 'Basic', price: 49 },
                      { id: 'premium', name: 'Premium', price: 99 },
                      { id: 'lifetime', name: 'Lifetime', price: 199 }
                    ]).map(plan => (
                      <div 
                        key={plan.id}
                        className={`plan-selector-card ${formData.defaultPlan === plan.id ? 'selected' : ''}`}
                        onClick={() => setFormData({ ...formData, defaultPlan: plan.id })}
                      >
                        <div className="plan-selector-name">{plan.name}</div>
                        <div className="plan-selector-price">${plan.price}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-section">
                  <h4>💰 Custom Plan Pricing (Optional)</h4>
                  <p className="section-hint">Set custom prices for each plan. Leave empty to use global prices.</p>
                  <div className="plan-pricing-grid">
                    {membershipPlans.length > 0 ? (
                      membershipPlans.map(plan => (
                        <div key={plan.id} className="plan-price-input">
                          <label>{plan.name}</label>
                          <div className="input-with-prefix">
                            <span className="prefix">$</span>
                            <input
                              type="number"
                              placeholder={`Default: $${plan.price}`}
                              value={formData.planPricing?.[plan.id] ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  planPricing: {
                                    ...prev.planPricing,
                                    [plan.id]: val === '' ? undefined : parseFloat(val)
                                  }
                                }));
                              }}
                              min="0"
                              step="0.01"
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="plan-price-input">
                          <label>Basic</label>
                          <div className="input-with-prefix">
                            <span className="prefix">$</span>
                            <input
                              type="number"
                              placeholder="e.g., 49"
                              value={formData.planPricing?.basic ?? ''}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                planPricing: { ...prev.planPricing, basic: parseFloat(e.target.value) || undefined }
                              }))}
                              min="0"
                            />
                          </div>
                        </div>
                        <div className="plan-price-input">
                          <label>Premium</label>
                          <div className="input-with-prefix">
                            <span className="prefix">$</span>
                            <input
                              type="number"
                              placeholder="e.g., 99"
                              value={formData.planPricing?.premium ?? ''}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                planPricing: { ...prev.planPricing, premium: parseFloat(e.target.value) || undefined }
                              }))}
                              min="0"
                            />
                          </div>
                        </div>
                        <div className="plan-price-input">
                          <label>Lifetime</label>
                          <div className="input-with-prefix">
                            <span className="prefix">$</span>
                            <input
                              type="number"
                              placeholder="e.g., 199"
                              value={formData.planPricing?.lifetime ?? ''}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                planPricing: { ...prev.planPricing, lifetime: parseFloat(e.target.value) || undefined }
                              }))}
                              min="0"
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="form-section">
                  <h4>� Validity Period</h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Valid From</label>
                      <input
                        type="date"
                        value={formData.validFrom}
                        onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Valid Until</label>
                      <input
                        type="date"
                        value={formData.validUntil}
                        onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label>Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="e.g., community, telugu, 2025"
                  />
                </div>

                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    Active (can be used immediately)
                  </label>
                </div>

                {/* Effective Pricing Preview */}
                <div className="effective-pricing-preview">
                  <h4>💵 Effective Pricing Preview</h4>
                  <div className="effective-pricing-grid">
                    {getEffectivePricing(formData.planPricing, formData.discountType, formData.discountValue).map(plan => (
                      <div key={plan.id} className={`effective-price-card ${formData.defaultPlan === plan.id ? 'default' : ''}`}>
                        <div className="plan-name">
                          {plan.name}
                          {plan.isCustom && <span className="custom-badge">Custom</span>}
                        </div>
                        <div className="price-display">
                          {plan.hasDiscount ? (
                            <>
                              <span className="original-price">${plan.basePrice}</span>
                              <span className="effective-price">${plan.effectivePrice}</span>
                            </>
                          ) : (
                            <span className="effective-price">${plan.effectivePrice}</span>
                          )}
                        </div>
                        {formData.defaultPlan === plan.id && <span className="default-label">Default</span>}
                      </div>
                    ))}
                  </div>
                  {formData.discountType !== 'none' && formData.discountValue > 0 && (
                    <div className="discount-summary">
                      💰 Discount: {formData.discountType === 'percentage' ? `${formData.discountValue}% OFF` : `$${formData.discountValue} OFF`}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={!!codeError}>
                  Create Promo Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="promo-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ Edit Promo Code: {editingCode}</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="modal-body">
                {editingIsSystemCode && (
                  <div className="system-code-notice">
                    <span className="notice-icon">🔒</span>
                    <div className="notice-content">
                      <strong>System Default Code</strong>
                      <p>This is a system code used to track organic registrations. Expiry dates and usage limits cannot be set.</p>
                    </div>
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label>Code</label>
                    <input
                      type="text"
                      value={formData.code}
                      disabled
                      className="disabled-input"
                    />
                    <small>Code cannot be changed</small>
                  </div>
                  <div className="form-group">
                    <label>Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows="2"
                  />
                </div>

                <div className="form-section">
                  <h4>💰 Discount Settings</h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Discount Type</label>
                      <select
                        value={formData.discountType}
                        onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                      >
                        <option value="none">No Discount</option>
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed Amount ($)</option>
                      </select>
                    </div>
                    {formData.discountType !== 'none' && (
                      <div className="form-group">
                        <label>Discount Value {formData.discountType === 'percentage' ? '(%)' : '($)'}</label>
                        <input
                          type="number"
                          value={formData.discountValue}
                          onChange={(e) => {
                            let val = parseFloat(e.target.value) || 0;
                            if (formData.discountType === 'percentage' && val > 100) val = 100;
                            if (val < 0) val = 0;
                            setFormData({ ...formData, discountValue: val });
                          }}
                          min="0"
                          max={formData.discountType === 'percentage' ? '100' : undefined}
                          step={formData.discountType === 'percentage' ? '1' : '0.01'}
                        />
                        {formData.discountType === 'percentage' && (
                          <small>Max 100%</small>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-section">
                  <h4>💳 Default Membership Plan</h4>
                  <p className="section-hint">Select which plan users will be enrolled in when using this code</p>
                  <div className="plan-selector-grid">
                    {(membershipPlans.length > 0 ? membershipPlans : [
                      { id: 'basic', name: 'Basic', price: 49 },
                      { id: 'premium', name: 'Premium', price: 99 },
                      { id: 'lifetime', name: 'Lifetime', price: 199 }
                    ]).map(plan => (
                      <div 
                        key={plan.id}
                        className={`plan-selector-card ${formData.defaultPlan === plan.id ? 'selected' : ''}`}
                        onClick={() => setFormData({ ...formData, defaultPlan: plan.id })}
                      >
                        <div className="plan-selector-name">{plan.name}</div>
                        <div className="plan-selector-price">${plan.price}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-section">
                  <h4>💰 Custom Plan Pricing (Optional)</h4>
                  <p className="section-hint">Set custom prices for each plan. Leave empty to use global prices.</p>
                  <div className="plan-pricing-grid">
                    {membershipPlans.length > 0 ? (
                      membershipPlans.map(plan => (
                        <div key={plan.id} className="plan-price-input">
                          <label>{plan.name}</label>
                          <div className="input-with-prefix">
                            <span className="prefix">$</span>
                            <input
                              type="number"
                              placeholder={`Default: $${plan.price}`}
                              value={formData.planPricing?.[plan.id] ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  planPricing: {
                                    ...prev.planPricing,
                                    [plan.id]: val === '' ? undefined : parseFloat(val)
                                  }
                                }));
                              }}
                              min="0"
                              step="0.01"
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="plan-price-input">
                          <label>Basic</label>
                          <div className="input-with-prefix">
                            <span className="prefix">$</span>
                            <input
                              type="number"
                              placeholder="e.g., 49"
                              value={formData.planPricing?.basic ?? ''}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                planPricing: { ...prev.planPricing, basic: parseFloat(e.target.value) || undefined }
                              }))}
                              min="0"
                            />
                          </div>
                        </div>
                        <div className="plan-price-input">
                          <label>Premium</label>
                          <div className="input-with-prefix">
                            <span className="prefix">$</span>
                            <input
                              type="number"
                              placeholder="e.g., 99"
                              value={formData.planPricing?.premium ?? ''}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                planPricing: { ...prev.planPricing, premium: parseFloat(e.target.value) || undefined }
                              }))}
                              min="0"
                            />
                          </div>
                        </div>
                        <div className="plan-price-input">
                          <label>Lifetime</label>
                          <div className="input-with-prefix">
                            <span className="prefix">$</span>
                            <input
                              type="number"
                              placeholder="e.g., 199"
                              value={formData.planPricing?.lifetime ?? ''}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                planPricing: { ...prev.planPricing, lifetime: parseFloat(e.target.value) || undefined }
                              }))}
                              min="0"
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="form-section">
                  <h4>📅 Validity Period</h4>
                  {editingIsSystemCode ? (
                    <div className="disabled-section-notice">
                      <span>♾️ No expiry - System codes are always valid</span>
                    </div>
                  ) : (
                    <div className="form-row">
                      <div className="form-group">
                        <label>Valid From</label>
                        <input
                          type="date"
                          value={formData.validFrom}
                          onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Valid Until</label>
                        <input
                          type="date"
                          value={formData.validUntil}
                          onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Max Uses</label>
                    <input
                      type="number"
                      value={formData.maxUses}
                      onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                      placeholder="Leave empty for unlimited"
                      min="1"
                      disabled={editingIsSystemCode}
                    />
                    {editingIsSystemCode && <small>System codes have unlimited uses</small>}
                  </div>
                  <div className="form-group">
                    <label>Tags (comma-separated)</label>
                    <input
                      type="text"
                      value={formData.tags}
                      onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    Active
                  </label>
                </div>

                {/* Effective Pricing Preview */}
                <div className="effective-pricing-preview">
                  <h4>💵 Effective Pricing Preview</h4>
                  <div className="effective-pricing-grid">
                    {getEffectivePricing(formData.planPricing, formData.discountType, formData.discountValue).map(plan => (
                      <div key={plan.id} className={`effective-price-card ${formData.defaultPlan === plan.id ? 'default' : ''}`}>
                        <div className="plan-name">
                          {plan.name}
                          {plan.isCustom && <span className="custom-badge">Custom</span>}
                        </div>
                        <div className="price-display">
                          {plan.hasDiscount ? (
                            <>
                              <span className="original-price">${plan.basePrice}</span>
                              <span className="effective-price">${plan.effectivePrice}</span>
                            </>
                          ) : (
                            <span className="effective-price">${plan.effectivePrice}</span>
                          )}
                        </div>
                        {formData.defaultPlan === plan.id && <span className="default-label">Default</span>}
                      </div>
                    ))}
                  </div>
                  {formData.discountType !== 'none' && formData.discountValue > 0 && (
                    <div className="discount-summary">
                      💰 Discount: {formData.discountType === 'percentage' ? `${formData.discountValue}% OFF` : `$${formData.discountValue} OFF`}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {archiveCode && (
        <div className="modal-overlay" onClick={() => setArchiveCode(null)}>
          <div className="promo-modal archive-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header archive-header">
              <h3>📦 Archive Promo Code</h3>
              <button className="modal-close" onClick={() => setArchiveCode(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="info-box">
                <p><strong>Archive this promo code?</strong></p>
                <p>Archiving will deactivate the code but preserve all tracking data. You can restore it later.</p>
                <div className="usage-stats">
                  <div className="stat-item">
                    <span className="stat-label">Code:</span>
                    <span className="stat-value">{archiveCode.code}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Status:</span>
                    <span className="stat-value">{archiveCode.isActive ? '✅ Active' : '❌ Inactive'}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Current Uses:</span>
                    <span className="stat-value">{archiveCode.currentUses || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Registrations:</span>
                    <span className="stat-value">{archiveCode.registrations || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Conversions:</span>
                    <span className="stat-value">{archiveCode.conversions || 0}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setArchiveCode(null)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-archive-action"
                onClick={() => {
                  handleArchive(archiveCode.code);
                  setArchiveCode(null);
                }}
              >
                📦 Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archived Codes Section */}
      {archivedCodes.length > 0 && (
        <div className="archived-section">
          <div className="archived-header" onClick={() => setShowArchived(!showArchived)}>
            <h3>📦 Archived Codes ({archivedCodes.length})</h3>
            <span className="toggle-icon">{showArchived ? '▼' : '▶'}</span>
          </div>
          {showArchived && (
            <div className="archived-table-container">
              <table className="promo-table archived-table">
                <thead>
                  <tr>
                    <th>CODE</th>
                    <th>NAME</th>
                    <th>TYPE</th>
                    <th>USES</th>
                    <th>ARCHIVED</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedCodes.map((code) => (
                    <tr key={code.code} className="archived-row">
                      <td><strong className="code-text">{code.code}</strong></td>
                      <td>{code.name || '-'}</td>
                      <td>
                        <span className={`type-badge ${code.type}`}>
                          {code.type}
                        </span>
                      </td>
                      <td>{code.currentUses || 0} / {code.registrations || 0}</td>
                      <td>{code.archivedAt ? new Date(code.archivedAt).toLocaleDateString() : '-'}</td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn-action btn-restore"
                            onClick={() => handleRestore(code.code)}
                            title="Restore this promo code"
                          >
                            ♻️
                          </button>
                          <DeleteButton
                            onDelete={() => handleDeleteArchived(code.code)}
                            itemName={code.code}
                            buttonClassName="btn-action btn-delete"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* QR Code Modal */}
      {qrCodeModal && (
        <div className="modal-overlay" onClick={() => setQrCodeModal(null)}>
          <div className="promo-modal qr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📱 QR Code & Invitation Link</h3>
              <button className="modal-close" onClick={() => setQrCodeModal(null)}>✕</button>
            </div>
            <div className="modal-body qr-modal-body">
              <div className="qr-code-container">
                <img 
                  src={getQrCodeUrl(qrCodeModal.code)} 
                  alt={`QR Code for ${qrCodeModal.code}`}
                  className="qr-code-image"
                />
              </div>
              <div className="qr-info">
                <div className="qr-code-name">
                  <strong>{qrCodeModal.name || qrCodeModal.code}</strong>
                </div>
                <div className="qr-code-type">
                  <span className={`type-badge ${qrCodeModal.type}`}>{qrCodeModal.type}</span>
                  {qrCodeModal.discountType !== 'none' && (
                    <span className="discount-info">
                      {qrCodeModal.discountType === 'percentage' 
                        ? `${qrCodeModal.discountValue}% off` 
                        : `$${qrCodeModal.discountValue} off`}
                    </span>
                  )}
                </div>
                <div className="invitation-link-section">
                  <label>Invitation Link:</label>
                  <div className="link-input-group">
                    <input 
                      type="text" 
                      value={getInvitationLink(qrCodeModal.code)} 
                      readOnly 
                      className="invitation-link-input"
                    />
                    <button 
                      className="btn-copy"
                      onClick={() => copyInvitationLink(qrCodeModal.code)}
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
                <p className="qr-instructions">
                  Scan this QR code or share the link to invite users to register with this promo code.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                type="button" 
                className="btn-secondary"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = getQrCodeUrl(qrCodeModal.code);
                  link.download = `QR_${qrCodeModal.code}.png`;
                  link.click();
                  toastService.success('QR code downloaded!');
                }}
              >
                ⬇️ Download QR
              </button>
              <button 
                type="button" 
                className="btn-primary"
                onClick={() => setQrCodeModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromoCodeManager;
