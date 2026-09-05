import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getBackendUrl, getFrontendUrl } from '../config/apiConfig';
import { getSilenceDays } from '../utils/contributionSilence';
import AddManualPayment from './AddManualPayment';
import './ContributionManagement.css';
import './ContributionThankYou.css';
import './LoadMore.css';

const FEE_FOR_OPTIONS = [
  { value: 'contribution', label: 'Contribution' },
  { value: 'membership', label: 'Membership' },
  { value: 'zoom_call', label: 'Zoom Call' },
  { value: 'event_rsvp', label: 'Event RSVP' },
  { value: 'manual_other', label: 'Manual Other' },
  { value: 'other', label: 'Other' },
];

const MONTH_OPTIONS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const ContributionManagement = () => {
  const navigate = useNavigate();
  const reminderContributionUrl = `${getFrontendUrl().replace(/\/$/, '')}/preferences?tab=contributions`;
  const [activeTab, setActiveTab] = useState('contributions'); // 'contributions' or 'activity'
  const [contributions, setContributions] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalAmount: 0,
    totalCount: 0,
    oneTimeCount: 0,
    recurringCount: 0
  });
  const [activityStats, setActivityStats] = useState({});
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });
  const [activityPagination, setActivityPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });
    const [hasMoreContributions, setHasMoreContributions] = useState(true);
  const [hasMoreActivities, setHasMoreActivities] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [filter, setFilter] = useState('all'); // all, one_time, recurring
  const [activityFilter, setActivityFilter] = useState('all'); // all, popup_shown, closed, remind_later, proceed_to_payment
  const [searchFilter, setSearchFilter] = useState(''); // combined search for username, first name, last name
  const [activitySearchFilter, setActivitySearchFilter] = useState(''); // combined search for activity log
  const [thankYouSending, setThankYouSending] = useState({});
  const [thankYouSent, setThankYouSent] = useState({});
  const [toast, setToast] = useState(null);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);

  // Unpaid Members state
  const [unpaidMembers, setUnpaidMembers] = useState([]);
  const [unpaidPagination, setUnpaidPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [unpaidSearchFilter, setUnpaidSearchFilter] = useState('');
  const [hasMoreUnpaid, setHasMoreUnpaid] = useState(true);
  const [unpaidSortBy, setUnpaidSortBy] = useState('joinedAt');
  const [unpaidSortOrder, setUnpaidSortOrder] = useState('desc');
  const [reminderModal, setReminderModal] = useState(null); // { user, channel }
  const [reminderSending, setReminderSending] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1));
  const [yearOptions, setYearOptions] = useState([]);
  const [closedYears, setClosedYears] = useState({});
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveForce, setArchiveForce] = useState(false);
  const [feeForUpdating, setFeeForUpdating] = useState({});
  const [feeEditModal, setFeeEditModal] = useState(null); // { contribution, nextFeeFor }
  const [feeEditReason, setFeeEditReason] = useState('');

  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin') {
      console.warn('⚠️ Unauthorized access attempt to Contribution Management');
      navigate('/dashboard');
      return;
    }
    if (activeTab === 'contributions') {
      loadContributions();
    } else if (activeTab === 'activity') {
      loadActivities();
    } else if (activeTab === 'unpaid') {
      loadUnpaidMembers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, filter, activeTab, activityFilter, searchFilter, activitySearchFilter, unpaidSearchFilter, unpaidSortBy, unpaidSortOrder, selectedYear, selectedMonth]);

  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    if (userRole === 'admin') {
      loadContributionYears();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadContributions = async (page = 1, append = false) => {
    try {
      if (!append) {
        setLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      const token = localStorage.getItem('token');
      
      let url = `${getBackendUrl()}/api/contributions/admin/contributions?page=${page}&limit=20`;
      if (selectedYear !== 'all') {
        url += `&year=${encodeURIComponent(selectedYear)}`;
        if (selectedMonth !== 'all') {
          url += `&month=${encodeURIComponent(selectedMonth)}`;
        }
      }
      if (filter !== 'all') {
        url += `&payment_type=${filter}`;
      }
      if (searchFilter && searchFilter.trim()) {
        url += `&search=${encodeURIComponent(searchFilter.trim())}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        if (append) {
          setContributions(prev => [...prev, ...response.data.contributions]);
        } else {
          setContributions(response.data.contributions);
          setStats(response.data.stats);
          const years = response.data.years || [];
          if (years.length > 0) {
            setYearOptions(years);
            const closed = {};
            years.forEach((y) => {
              if (y.closed) closed[String(y.year)] = true;
            });
            setClosedYears(closed);
          }
        }
        setPagination(response.data.pagination);
        
        // Check if there are more rows to load
        const currentPage = response.data.pagination.page;
        const totalPages = response.data.pagination.totalPages;
        setHasMoreContributions(currentPage < totalPages);
      }
    } catch (err) {
      console.error('Error loading contributions:', err);
      setError('Failed to load contributions');
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  };

  const loadContributionYears = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(
        `${getBackendUrl()}/api/contributions/admin/contribution-years`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        const years = res.data.years || [];
        setYearOptions(years);
        const closed = {};
        years.forEach((y) => {
          if (y.closed) closed[String(y.year)] = true;
        });
        setClosedYears(closed);
      }
    } catch (err) {
      console.error('Error loading contribution years:', err);
    }
  };

  const loadActivities = async (page = 1, append = false) => {
    try {
      if (!append) {
        setLoading(true);
        setActivities([]);
      } else {
        setIsLoadingMore(true);
      }

      const token = localStorage.getItem('token');
      
      let url = `${getBackendUrl()}/api/contributions/admin/contribution-activity?page=${page}&limit=20`;
      if (activityFilter !== 'all') {
        url += `&action_filter=${activityFilter}`;
      }
      if (activitySearchFilter && activitySearchFilter.trim()) {
        url += `&search=${encodeURIComponent(activitySearchFilter.trim())}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        const newActivities = response.data.activities || [];
        setActivities(prev => append ? [...prev, ...newActivities] : newActivities);
        setActivityPagination(response.data.pagination || {});
        setActivityStats(response.data.stats || {});
        setHasMoreActivities(
          (response.data.pagination?.page || 1) < (response.data.pagination?.totalPages || 1)
        );
      }
    } catch (err) {
      console.error('Error loading activities:', err);
      setError('Failed to load activity log');
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  };

  const loadUnpaidMembers = async (page = 1, append = false) => {
    try {
      if (!append) {
        setLoading(true);
        setUnpaidMembers([]);
      } else {
        setIsLoadingMore(true);
      }

      const token = localStorage.getItem('token');
      let url = `${getBackendUrl()}/api/contributions/admin/unpaid-members?page=${page}&limit=50`;
      if (unpaidSearchFilter && unpaidSearchFilter.trim()) {
        url += `&search=${encodeURIComponent(unpaidSearchFilter.trim())}`;
      }
      if (unpaidSortBy) {
        url += `&sort_by=${encodeURIComponent(unpaidSortBy)}&sort_order=${encodeURIComponent(unpaidSortOrder)}`;
      }

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        const newUsers = response.data.users || [];
        setUnpaidMembers(prev => append ? [...prev, ...newUsers] : newUsers);
        setUnpaidPagination(response.data.pagination || { page: 1, limit: 50, total: 0, totalPages: 1 });
        setHasMoreUnpaid(
          (response.data.pagination?.page || 1) < (response.data.pagination?.totalPages || 1)
        );
      }
    } catch (err) {
      console.error('Error loading unpaid members:', err);
      setError('Failed to load unpaid members');
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  };

  const getActionLabel = (action) => {
    const labels = {
      'popup_shown': '👁️ Popup Shown',
      'closed': '❌ Closed',
      'remind_later': '⏰ Remind Later',
      'proceed_to_payment': '💳 Proceeded to Payment',
      'contributed': '💝 Contributed'
    };
    return labels[action] || action;
  };

  const getActionClass = (action) => {
    const classes = {
      'popup_shown': 'action-shown',
      'closed': 'action-closed',
      'remind_later': 'action-remind',
      'proceed_to_payment': 'action-payment',
      'contributed': 'action-contributed'
    };
    return classes[action] || '';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Toggle sort column; clicking same column flips order, new column resets to 'desc'
  const toggleUnpaidSort = (field) => {
    if (unpaidSortBy === field) {
      setUnpaidSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setUnpaidSortBy(field);
      setUnpaidSortOrder('desc');
    }
  };

  const renderSortIndicator = (field) => {
    if (unpaidSortBy !== field) return <span style={{ opacity: 0.35, marginLeft: 4 }}>⇅</span>;
    return <span style={{ marginLeft: 4 }}>{unpaidSortOrder === 'desc' ? '▼' : '▲'}</span>;
  };

  const formatDaysElapsed = (dateString) => {
    if (!dateString) return '-';
    const now = new Date();
    const then = new Date(dateString);
    const diffMs = now - then;
    if (isNaN(diffMs) || diffMs < 0) return '-';
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  };

  /**
   * Days of popup/banner silence this specific contribution still buys.
   *   silenceDays = floor(amount)   (see utils/contributionSilence.js)
   *   remaining   = max(0, silenceDays - daysElapsed)
   * Returns a number (0 = expired) or '-' if data is missing.
   */
  const silenceDaysLeft = (dateString, amount) => {
    if (!dateString) return '-';
    const silenceDays = getSilenceDays(amount);
    if (silenceDays <= 0) return 0;
    const elapsed = formatDaysElapsed(dateString);
    if (elapsed === '-') return '-';
    return Math.max(0, silenceDays - elapsed);
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const sendThankYou = async (contribution) => {
    const id = contribution.id;
    setThankYouSending(prev => ({ ...prev, [id]: true }));
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${getBackendUrl()}/api/contributions/admin/contributions/${id}/thank-you`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        setThankYouSent(prev => ({ ...prev, [id]: response.data.sentAt }));
        const name = contribution.firstName || contribution.username;
        if (response.data.alreadySentBefore) {
          showToast(`Thank you email re-sent to ${name}!`, 'success');
        } else {
          showToast(`Thank you email sent to ${name}!`, 'success');
        }
      }
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to send thank you email';
      showToast(detail, 'error');
    } finally {
      setThankYouSending(prev => ({ ...prev, [id]: false }));
    }
  };

  const sendReminder = async (user, channel, customMessage = '') => {
    setReminderSending(true);
    try {
      const token = localStorage.getItem('token');
      const isBulk = reminderModal?.bulk;

      if (isBulk) {
        // Bulk send to all unpaid members
        const response = await axios.post(
          `${getBackendUrl()}/api/contributions/admin/send-bulk-reminder`,
          {
            channel: channel,
            message: customMessage
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.data.success) {
          showToast(`Bulk email sent to ${response.data.sentCount || 0} unpaid members!`, 'success');
          setReminderModal(null);
        } else {
          showToast(response.data.message || 'Failed to send bulk reminder', 'error');
        }
      } else {
        // Single user send
        const response = await axios.post(
          `${getBackendUrl()}/api/contributions/admin/send-reminder`,
          {
            username: user.username,
            channel: channel,
            message: customMessage
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.data.success) {
          const channelLabel = channel === 'sms' ? 'SMS' : 'email';
          showToast(`Reminder ${channelLabel} sent to ${user.fullName || user.username}!`, 'success');
          setReminderModal(null);
        } else {
          showToast(response.data.error || response.data.message || 'Failed to send reminder', 'error');
        }
      }
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to send reminder';
      showToast(detail, 'error');
    } finally {
      setReminderSending(false);
    }
  };

  const getThankYouState = (contribution) => {
    const id = contribution.id;
    if (thankYouSending[id]) return 'sending';
    if (thankYouSent[id] || contribution.thankYouEmailSentAt) return 'sent';
    return 'ready';
  };

  const handleManualPaymentSuccess = (data) => {
    setShowAddPaymentModal(false);
    const message = data.thankYouSent 
      ? `Payment recorded and thank you email sent!` 
      : `Payment recorded successfully!`;
    showToast(message, 'success');
    loadContributions();
  };

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      const token = localStorage.getItem('token');
      
      // Fetch ALL contributions (no pagination limit)
      let exportUrl = `${getBackendUrl()}/api/contributions/admin/export-csv`;
      if (selectedYear !== 'all') {
        exportUrl += `?year=${encodeURIComponent(selectedYear)}`;
        if (selectedMonth !== 'all') {
          exportUrl += `&month=${encodeURIComponent(selectedMonth)}`;
        }
      }
      const response = await axios.get(exportUrl, { headers: { Authorization: `Bearer ${token}` } });
      
      if (response.data.success) {
        const contributions = response.data.contributions;
        
        // CSV Headers
        const headers = [
          'Username',
          'Full Name',
          'Age',
          'Gender',
          'Contact Phone',
          'Contact Email',
          'Contributed Amount',
          'Contribution Date',
          'Last Logged In'
        ];
        
        // CSV Rows
        const rows = contributions.map(c => [
          c.username || '',
          c.fullName || '',
          c.age || '',
          c.gender || '',
          c.contactPhone || '',
          c.contactEmail || '',
          c.amount ? `$${(c.amount || 0).toFixed(2)}` : '',
          c.createdAt ? new Date(c.createdAt).toLocaleString() : '',
          c.lastLogin ? new Date(c.lastLogin).toLocaleString() : ''
        ]);
        
        // Build CSV content
        const csvContent = [
          headers.join(','),
          ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        
        // Create download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().split('T')[0];
        const yearSuffix = selectedYear === 'all'
          ? 'all-years'
          : (selectedMonth === 'all' ? selectedYear : `${selectedYear}-${selectedMonth.padStart(2, '0')}`);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `contributions_export_${yearSuffix}_${timestamp}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast(`Exported ${contributions.length} contributions to CSV`, 'success');
      }
    } catch (err) {
      console.error('Error exporting CSV:', err);
      showToast('Failed to export CSV', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleArchiveYear = async () => {
    if (selectedYear === 'all') {
      showToast('Select a specific year before closing books', 'error');
      return;
    }
    try {
      setIsArchiving(true);
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${getBackendUrl()}/api/contributions/admin/archive-year`,
        { year: Number(selectedYear), force: archiveForce },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        showToast(`✅ Closed books for ${selectedYear}. Archived ${res.data.archive?.rowCount || 0} rows.`, 'success');
        setShowArchiveConfirm(false);
        setArchiveForce(false);
        await loadContributionYears();
        await loadContributions();
      }
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to archive year';
      showToast(detail, 'error');
    } finally {
      setIsArchiving(false);
    }
  };

  const handleFeeForChange = async (contribution, nextFeeFor) => {
    if (!contribution?.id || !nextFeeFor || contribution.feeFor === nextFeeFor) return;
    setFeeEditReason('');
    setFeeEditModal({ contribution, nextFeeFor });
  };

  const submitFeeClassification = async () => {
    if (!feeEditModal?.contribution?.id || !feeEditModal?.nextFeeFor) return;
    const reason = feeEditReason.trim();
    if (reason.length < 3) {
      showToast('Reason is required (min 3 chars)', 'error');
      return;
    }
    const contribution = feeEditModal.contribution;
    const nextFeeFor = feeEditModal.nextFeeFor;
    try {
      setFeeForUpdating(prev => ({ ...prev, [contribution.id]: true }));
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${getBackendUrl()}/api/contributions/admin/contributions/${contribution.id}/classify-fee`,
        { feeFor: nextFeeFor, reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        setContributions(prev => prev.map((row) => (
          row.id === contribution.id ? { ...row, feeFor: nextFeeFor } : row
        )));
        showToast(`Fee classified as ${nextFeeFor.replace('_', ' ')}`, 'success');
        setFeeEditModal(null);
        setFeeEditReason('');
      }
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to update fee classification';
      showToast(detail, 'error');
    } finally {
      setFeeForUpdating(prev => ({ ...prev, [contribution.id]: false }));
    }
  };

  return (
    <div className="contribution-management">
      {toast && (
        <div className={`cm-toast cm-toast-${toast.type}`}>
          <span className="cm-toast-icon">
            {toast.type === 'success' && '✓'}
            {toast.type === 'error' && '✕'}
          </span>
          <span className="cm-toast-message">{toast.message}</span>
          <button className="cm-toast-close" onClick={() => setToast(null)}>×</button>
        </div>
      )}

      <div className="page-header">
        <div className="header-content">
          <h1>💝 Contribution Management</h1>
          <p>View and manage all contributions</p>
        </div>
        <div className="header-actions">
          <button
            className="add-payment-btn close-books-btn"
            type="button"
            onClick={() => setShowArchiveConfirm(true)}
            disabled={activeTab !== 'contributions' || selectedYear === 'all' || isArchiving}
            title={selectedYear === 'all' ? 'Select a year to close books' : `Close books for ${selectedYear}`}
          >
            <span className="btn-icon">{isArchiving ? '⏳' : '📚'}</span>
          </button>
          <button
            className="add-payment-btn"
            type="button"
            onClick={() => navigate('/admin/recurring-contributions')}
            style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)'
            }}
            title="Manage recurring contributions"
          >
            <span className="btn-icon">♻️</span>
          </button>
          <button
            className="add-payment-btn"
            type="button"
            onClick={handleExportCSV}
            disabled={isExporting}
            title={isExporting ? 'Exporting…' : 'Export contributions to CSV'}
            style={{
              background: isExporting ? 'var(--text-muted)' : 'var(--success-color)',
              cursor: isExporting ? 'not-allowed' : 'pointer'
            }}
          >
            <span className="btn-icon">{isExporting ? '⏳' : '📥'}</span>
          </button>
          <button
            className="add-payment-btn"
            type="button"
            onClick={() => setShowAddPaymentModal(true)}
            title="Add manual payment"
          >
            <span className="btn-icon">+</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card total">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-value">{formatAmount(stats.totalAmount)}</div>
            <div className="stat-label">Total</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalCount}</div>
            <div className="stat-label">Count</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💵</div>
          <div className="stat-content">
            <div className="stat-value">{stats.oneTimeCount}</div>
            <div className="stat-label">One-time</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🔄</div>
          <div className="stat-content">
            <div className="stat-value">{stats.recurringCount}</div>
            <div className="stat-label">Recurring</div>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="main-tabs">
        <button 
          className={`main-tab ${activeTab === 'contributions' ? 'active' : ''}`}
          onClick={() => setActiveTab('contributions')}
          title="Contributions"
          aria-label="Contributions"
        >
          <span className="tab-icon" aria-hidden="true">💝</span>
          <span className="tab-label">Contributions</span>
        </button>
        <button 
          className={`main-tab ${activeTab === 'unpaid' ? 'active' : ''}`}
          onClick={() => setActiveTab('unpaid')}
          title="Unpaid Members"
          aria-label="Unpaid Members"
        >
          <span className="tab-icon" aria-hidden="true">💸</span>
          <span className="tab-label">Unpaid Members</span>
        </button>
        <button 
          className={`main-tab ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
          title="Activity Log"
          aria-label="Activity Log"
        >
          <span className="tab-icon" aria-hidden="true">📋</span>
          <span className="tab-label">Activity Log</span>
        </button>
      </div>

      {/* User Filter - Only show for contributions tab */}
      {activeTab === 'contributions' && (
        <div className="user-filter-container">
          <div className="filter-row">
            <label htmlFor="search-filter" className="filter-label">Search:</label>
            <input
              id="search-filter"
              type="text"
              className="user-filter-input"
              placeholder="Search by username, first name, or last name..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
            {searchFilter && (
              <button 
                className="clear-filter-btn"
                onClick={() => setSearchFilter('')}
                title="Clear search filter"
              >
                ×
              </button>
            )}
            <label htmlFor="month-filter" className="filter-label">Month:</label>
            <select
              id="month-filter"
              className="year-filter-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              disabled={selectedYear === 'all'}
              title={selectedYear === 'all' ? 'Select a specific year to filter by month' : 'Filter by month'}
            >
              <option value="all">All months</option>
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <label htmlFor="year-filter" className="filter-label">Year:</label>
            <select
              id="year-filter"
              className="year-filter-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <option value="all">All years</option>
              {yearOptions.map((y) => (
                <option key={y.year} value={String(y.year)}>
                  {y.year}{y.closed ? ' • Closed' : ''}
                </option>
              ))}
            </select>
            {selectedYear !== 'all' && closedYears[selectedYear] ? (
              <span className="year-closed-pill" title="This year is archived and closed">Closed</span>
            ) : null}
          </div>
        </div>
      )}

      {/* Filter Tabs - Only show for contributions tab */}
      {activeTab === 'contributions' && (
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button 
            className={`filter-tab ${filter === 'one_time' ? 'active' : ''}`}
            onClick={() => setFilter('one_time')}
          >
            One-time
          </button>
          <button 
            className={`filter-tab ${filter === 'recurring' ? 'active' : ''}`}
            onClick={() => setFilter('recurring')}
          >
            Recurring
          </button>
        </div>
      )}

      {/* User Filter - Only show for activity tab */}
      {activeTab === 'activity' && (
        <div className="user-filter-container">
          <div className="filter-row">
            <label htmlFor="activity-search-filter" className="filter-label">Search:</label>
            <input
              id="activity-search-filter"
              type="text"
              className="user-filter-input"
              placeholder="Search by username, first name, or last name..."
              value={activitySearchFilter}
              onChange={(e) => setActivitySearchFilter(e.target.value)}
            />
            {activitySearchFilter && (
              <button 
                className="clear-filter-btn"
                onClick={() => setActivitySearchFilter('')}
                title="Clear search filter"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

      {/* Activity Filter Tabs */}
      {activeTab === 'activity' && (
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${activityFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActivityFilter('all')}
          >
            All ({activityStats.total || 0})
          </button>
          <button 
            className={`filter-tab ${activityFilter === 'popup_shown' ? 'active' : ''}`}
            onClick={() => setActivityFilter('popup_shown')}
          >
            👁️ Shown ({activityStats.popup_shown || 0})
          </button>
          <button 
            className={`filter-tab ${activityFilter === 'closed' ? 'active' : ''}`}
            onClick={() => setActivityFilter('closed')}
          >
            ❌ Closed ({activityStats.closed || 0})
          </button>
          <button 
            className={`filter-tab ${activityFilter === 'remind_later' ? 'active' : ''}`}
            onClick={() => setActivityFilter('remind_later')}
          >
            ⏰ Remind ({activityStats.remind_later || 0})
          </button>
          <button 
            className={`filter-tab ${activityFilter === 'proceed_to_payment' ? 'active' : ''}`}
            onClick={() => setActivityFilter('proceed_to_payment')}
          >
            💳 Payment ({activityStats.proceed_to_payment || 0})
          </button>
        </div>
      )}

      {/* Contributions Table */}
      {activeTab === 'contributions' && (
        <>
          <div className="table-container">
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading contributions...</p>
              </div>
            ) : contributions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💝</div>
                <h3>No contributions yet</h3>
                <p>Contributions will appear here once users start contributing.</p>
              </div>
            ) : (
              <table className="contributions-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Name</th>
                    <th>Amount</th>
                    <th>Type</th>
                    <th>Fee For</th>
                    <th>Status</th>
                    <th>Paid</th>
                    <th>Elapsed</th>
                    <th title="Remaining days the popup/banner is silenced for this user by this contribution. silence_days = floor(amount)">
                      Left
                    </th>
                    <th>Session ID</th>
                    <th>Actns</th>
                  </tr>
                </thead>
                <tbody>
                  {contributions.map((contribution) => (
                    <tr key={contribution.id}>
                      <td className="user-cell">
                        <a 
                          href={`/profile/${contribution.username}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="username-link"
                        >
                          {contribution.username}
                        </a>
                      </td>
                      <td className="name-cell">
                        {contribution.firstName || contribution.lastName ? 
                          `${contribution.firstName || ''} ${contribution.lastName || ''}`.trim() : 
                          '-'
                        }
                      </td>
                      <td className="amount-cell">
                        <span className="amount">{formatAmount(contribution.amount)}</span>
                      </td>
                      <td>
                        <span className={`type-badge ${contribution.paymentType}`}>
                          {contribution.paymentType === 'recurring' ? '🔄 Monthly' : '💵 One-time'}
                        </span>
                      </td>
                      <td className="fee-for-cell">
                        <select
                          className="fee-for-select"
                          value={contribution.feeFor || 'contribution'}
                          disabled={Boolean(feeForUpdating[contribution.id])}
                          onChange={(e) => handleFeeForChange(contribution, e.target.value)}
                          title="Classify what this fee was for"
                        >
                          {FEE_FOR_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {(() => {
                          const s = contribution.status || 'completed';
                          // Short 1-char labels for alternate/legacy statuses;
                          // full words for the canonical set.
                          const shortLabels = { succeeded: 'S', paid: 'P', refunded: 'R' };
                          const label = shortLabels[s] || s.charAt(0).toUpperCase() + s.slice(1);
                          return <span className={`status-badge ${s}`} title={s}>{label}</span>;
                        })()}
                      </td>
                      <td className="date-cell">
                        {formatDate(contribution.createdAt)}
                      </td>
                      <td className="days-elapsed-cell">
                        {formatDaysElapsed(contribution.createdAt)}
                      </td>
                      <td className="silence-left-cell">
                        {(() => {
                          const left = silenceDaysLeft(contribution.createdAt, contribution.amount);
                          if (left === '-') return '-';
                          const cls = left > 0 ? 'silence-pill active' : 'silence-pill expired';
                          return <span className={cls} title={left > 0 ? 'Popup silenced' : 'Silence expired'}>{left}</span>;
                        })()}
                      </td>
                      <td className="session-id-cell">
                        <span className="session-id" title={contribution.sessionId}>
                          {contribution.sessionId ? contribution.sessionId.slice(0, 20) + '...' : '-'}
                        </span>
                      </td>
                      <td className="actions-cell">
                        {(() => {
                          const state = getThankYouState(contribution);
                          if (state === 'sending') {
                            return (
                              <button className="thank-you-btn sending" disabled>
                                <span className="btn-spinner"></span> Sending...
                              </button>
                            );
                          }
                          if (state === 'sent') {
                            return (
                              <button
                                className="thank-you-btn sent"
                                onClick={() => sendThankYou(contribution)}
                                title={`Thanked${contribution.thankYouEmailSentAt ? ' on ' + formatDate(contribution.thankYouEmailSentAt) : ''} — click to re-send`}
                              >
                                ✓ Thanked
                              </button>
                            );
                          }
                          return (
                            <button
                              className="thank-you-btn ready"
                              onClick={() => sendThankYou(contribution)}
                            >
                              🙏 Thank You!
                            </button>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Load More */}
          {contributions.length > 0 && (
            <div className="load-more-container">
              <div className="load-more-content">
                <div className="load-more-count">
                  Showing {contributions.length} of {pagination.total} rows
                </div>
                {hasMoreContributions && (
                  <button 
                    className="load-more-button"
                    onClick={() => loadContributions(pagination.page + 1, true)}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? (
                      <>
                        <div className="load-more-spinner"></div>
                        Loading...
                      </>
                    ) : (
                      <>
                        Load {Math.min(20, pagination.total - contributions.length)} more [{contributions.length}/{pagination.total}]
                      </>
                    )}
                  </button>
                )}
                
                {!hasMoreContributions && contributions.length > 20 && (
                  <div className="load-more-complete">
                    ✓ All {pagination.total} records loaded
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Activity Log Table */}
      {activeTab === 'activity' && (
        <>
          <div className="table-container">
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading activity log...</p>
              </div>
            ) : activities.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>No activity yet</h3>
                <p>User interactions with the contribution popup will appear here.</p>
              </div>
            ) : (
              <table className="contributions-table activity-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Name</th>
                    <th>Action</th>
                    <th>Amount</th>
                    <th>Type</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((activity) => (
                    <tr key={activity.id}>
                      <td className="user-cell">
                        <a 
                          href={`/profile/${activity.username}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="username-link"
                        >
                          {activity.username}
                        </a>
                      </td>
                      <td className="name-cell">
                        {activity.firstName || activity.lastName ? 
                          `${activity.firstName || ''} ${activity.lastName || ''}`.trim() : 
                          '-'
                        }
                      </td>
                      <td>
                        <span className={`action-badge ${getActionClass(activity.action)}`}>
                          {getActionLabel(activity.action)}
                        </span>
                      </td>
                      <td className="amount-cell">
                        {activity.amount ? formatAmount(activity.amount) : '-'}
                      </td>
                      <td>
                        {activity.paymentType ? (
                          <span className="type-badge">
                            {activity.paymentType === 'monthly' ? '🔄 Monthly' : '💵 One-time'}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="date-cell">
                        {formatDate(activity.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Load More */}
          {activities.length > 0 && (
            <div className="load-more-container">
              <div className="load-more-content">
                {hasMoreActivities && (
                  <button 
                    className="load-more-button"
                    onClick={() => loadActivities(activityPagination.page + 1, true)}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? (
                      <>
                        <div className="load-more-spinner"></div>
                        Loading...
                      </>
                    ) : (
                      <>
                        Load {Math.min(20, activityPagination.total - activities.length)} more [{activities.length}/{activityPagination.total}]
                      </>
                    )}
                  </button>
                )}
                
                {!hasMoreActivities && activities.length > 20 && (
                  <div className="load-more-complete">
                    ✓ All {activityPagination.total} records loaded
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Unpaid Members Table */}
      {activeTab === 'unpaid' && (
        <>
          {/* Bulk Actions Bar */}
          {unpaidMembers.length > 0 && (
            <div className="bulk-actions-bar">
              <div className="bulk-actions-info">
                <span className="bulk-count">{unpaidPagination.total} unpaid members</span>
              </div>
              <div className="bulk-actions-buttons">
                <button
                  className="bulk-reminder-btn"
                  onClick={() => setReminderModal({ user: null, channel: 'email', bulk: true })}
                  title="Send email reminder to ALL unpaid members"
                >
                  📧 Send Bulk Email Reminder
                </button>
                <button
                  className="bulk-reminder-btn sms-bulk"
                  onClick={() => setReminderModal({ user: null, channel: 'sms', bulk: true })}
                  title="Send SMS reminder to ALL unpaid members"
                >
                  📱 Send Bulk SMS Reminder
                </button>
              </div>
            </div>
          )}

          {/* User Filter - Only show for unpaid tab */}
          <div className="user-filter-container">
            <div className="filter-row">
              <label htmlFor="unpaid-search-filter" className="filter-label">Search:</label>
              <input
                id="unpaid-search-filter"
                type="text"
                className="user-filter-input"
                placeholder="Search by username, first name, or last name..."
                value={unpaidSearchFilter}
                onChange={(e) => setUnpaidSearchFilter(e.target.value)}
              />
              {unpaidSearchFilter && (
                <button 
                  className="clear-filter-btn"
                  onClick={() => setUnpaidSearchFilter('')}
                  title="Clear search filter"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="table-container">
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading unpaid members...</p>
              </div>
            ) : unpaidMembers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💸</div>
                <h3>No unpaid members found</h3>
                <p>All users have made contributions. Great!</p>
              </div>
            ) : (
              <table className="contributions-table unpaid-table">
                <thead>
                  <tr>
                    <th onClick={() => toggleUnpaidSort('username')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      User{renderSortIndicator('username')}
                    </th>
                    <th onClick={() => toggleUnpaidSort('fullName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Name{renderSortIndicator('fullName')}
                    </th>
                    <th onClick={() => toggleUnpaidSort('age')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Age{renderSortIndicator('age')}
                    </th>
                    <th onClick={() => toggleUnpaidSort('gender')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Gender{renderSortIndicator('gender')}
                    </th>
                    <th onClick={() => toggleUnpaidSort('contactEmail')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Email{renderSortIndicator('contactEmail')}
                    </th>
                    <th onClick={() => toggleUnpaidSort('contactPhone')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Phone{renderSortIndicator('contactPhone')}
                    </th>
                    <th onClick={() => toggleUnpaidSort('joinedAt')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Joined{renderSortIndicator('joinedAt')}
                    </th>
                    <th title="Days since joined">
                      ActiveDays
                    </th>
                    <th onClick={() => toggleUnpaidSort('lastLogin')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Last Login{renderSortIndicator('lastLogin')}
                    </th>
                    <th onClick={() => toggleUnpaidSort('lastEmailReminderAt')} style={{ cursor: 'pointer', userSelect: 'none' }} title="Sort by last email reminder timestamp">
                      Status{renderSortIndicator('lastEmailReminderAt')}
                    </th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {unpaidMembers.map((user) => (
                    <tr key={user.username}>
                      <td className="user-cell">
                        <a 
                          href={`/profile/${user.username}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="username-link"
                        >
                          {user.username}
                        </a>
                      </td>
                      <td className="name-cell">{user.fullName || '-'}</td>
                      <td className="age-cell">{user.age || '-'}</td>
                      <td className="gender-cell">{user.gender || '-'}</td>
                      <td className="email-cell">
                        {user.contactEmail ? (
                          <span title={user.contactEmail}>{user.contactEmail}</span>
                        ) : '-'}
                      </td>
                      <td className="phone-cell">
                        {user.contactPhone ? (
                          <span title={user.contactPhone}>{user.contactPhone}</span>
                        ) : '-'}
                      </td>
                      <td className="date-cell">{formatDate(user.joinedAt)}</td>
                      <td title="Days since joined">{formatDaysElapsed(user.joinedAt)}</td>
                      <td className="date-cell">{formatDate(user.lastLogin)}</td>
                      <td className="status-cell" style={{ fontSize: '0.85em', lineHeight: 1.4 }}>
                        {user.lastEmailReminderAt && (
                          <div title={`Last email reminder: ${formatDate(user.lastEmailReminderAt)}`}>
                            📧 {formatDate(user.lastEmailReminderAt)}
                          </div>
                        )}
                        {user.lastSmsReminderAt && (
                          <div title={`Last SMS reminder: ${formatDate(user.lastSmsReminderAt)}`}>
                            📱 {formatDate(user.lastSmsReminderAt)}
                          </div>
                        )}
                        {!user.lastEmailReminderAt && !user.lastSmsReminderAt && (
                          <span style={{ opacity: 0.5 }}>Never</span>
                        )}
                      </td>
                      <td className="actions-cell">
                        <div className="unpaid-actions">
                          {user.contactEmail && (
                            <button
                              className="reminder-btn email"
                              onClick={() => setReminderModal({ user, channel: 'email', bulk: false })}
                              title="Send Email Reminder"
                            >
                              📧 Email
                            </button>
                          )}
                          <button
                            className="reminder-btn sms"
                            onClick={() => user.contactPhone && setReminderModal({ user, channel: 'sms', bulk: false })}
                            disabled={!user.contactPhone}
                            title={user.contactPhone ? "Send SMS Reminder" : "No phone number on file"}
                          >
                            📱 SMS
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Load More */}
          {unpaidMembers.length > 0 && (
            <div className="load-more-container">
              <div className="load-more-content">
                {hasMoreUnpaid && (
                  <button 
                    className="load-more-button"
                    onClick={() => loadUnpaidMembers(unpaidPagination.page + 1, true)}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? (
                      <>
                        <div className="load-more-spinner"></div>
                        Loading...
                      </>
                    ) : (
                      <>
                        Load {Math.min(50, unpaidPagination.total - unpaidMembers.length)} more [{unpaidMembers.length}/{unpaidPagination.total}]
                      </>
                    )}
                  </button>
                )}
                
                {!hasMoreUnpaid && unpaidMembers.length > 20 && (
                  <div className="load-more-complete">
                    ✓ All {unpaidPagination.total} records loaded
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {showAddPaymentModal && (
        <AddManualPayment 
          onClose={() => setShowAddPaymentModal(false)}
          onSuccess={handleManualPaymentSuccess}
        />
      )}

      {feeEditModal && (
        <div className="modal-overlay" onClick={() => setFeeEditModal(null)}>
          <div className="reminder-modal" onClick={(e) => e.stopPropagation()}>
            <div className="reminder-modal-header">
              <h3>Classify Fee Usage</h3>
              <button className="btn-close-modal" onClick={() => setFeeEditModal(null)}>×</button>
            </div>
            <div className="reminder-modal-body">
              <div className="recipient-info">
                <p><strong>User:</strong> {feeEditModal.contribution.username}</p>
                <p><strong>Amount:</strong> {formatAmount(feeEditModal.contribution.amount)}</p>
                <p><strong>New Class:</strong> {feeEditModal.nextFeeFor.replace('_', ' ')}</p>
              </div>
              <div className="archive-reason-wrap">
                <label htmlFor="fee-reason" className="filter-label">Reason (required)</label>
                <textarea
                  id="fee-reason"
                  className="fee-reason-input"
                  value={feeEditReason}
                  onChange={(e) => setFeeEditReason(e.target.value)}
                  placeholder="Why are you reclassifying this transaction?"
                  rows={3}
                />
              </div>
              <div className="reminder-actions">
                <button
                  className="btn-secondary"
                  onClick={() => setFeeEditModal(null)}
                  disabled={Boolean(feeForUpdating[feeEditModal.contribution.id])}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={submitFeeClassification}
                  disabled={Boolean(feeForUpdating[feeEditModal.contribution.id])}
                >
                  {feeForUpdating[feeEditModal.contribution.id] ? 'Saving...' : 'Save Classification'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showArchiveConfirm && (
        <div className="modal-overlay" onClick={() => setShowArchiveConfirm(false)}>
          <div className="reminder-modal" onClick={(e) => e.stopPropagation()}>
            <div className="reminder-modal-header">
              <h3>Close Books for {selectedYear}</h3>
              <button className="btn-close-modal" onClick={() => setShowArchiveConfirm(false)}>×</button>
            </div>
            <div className="reminder-modal-body">
              <div className="recipient-info bulk-info">
                <p><strong>Year:</strong> {selectedYear}</p>
                <p><strong>Action:</strong> Archive contribution rows and mark payment docs with archive metadata.</p>
                <div className="bulk-warning">
                  This does not delete payments. It creates a snapshot archive so the year can be considered closed.
                </div>
              </div>
              {closedYears[selectedYear] ? (
                <label className="archive-force-toggle">
                  <input
                    type="checkbox"
                    checked={archiveForce}
                    onChange={(e) => setArchiveForce(e.target.checked)}
                  />
                  Rebuild existing archive for this year (force overwrite)
                </label>
              ) : null}
              <div className="reminder-actions">
                <button
                  className="btn-secondary"
                  onClick={() => setShowArchiveConfirm(false)}
                  disabled={isArchiving}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={handleArchiveYear}
                  disabled={isArchiving || selectedYear === 'all'}
                >
                  {isArchiving ? (
                    <>
                      <span className="btn-spinner"></span> Closing...
                    </>
                  ) : (
                    <>📚 Close Year {selectedYear}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Reminder Modal */}
      {reminderModal && (
        <div className="modal-overlay" onClick={() => setReminderModal(null)}>
          <div className="reminder-modal" onClick={(e) => e.stopPropagation()}>
            <div className="reminder-modal-header">
              <h3>{reminderModal.bulk ? `Send Bulk ${reminderModal.channel === 'email' ? 'Email' : 'SMS'} Reminder` : 'Send Reminder'}</h3>
              <button className="btn-close-modal" onClick={() => setReminderModal(null)}>×</button>
            </div>
            <div className="reminder-modal-body">
              {reminderModal.bulk ? (
                <div className="recipient-info bulk-info">
                  <p><strong>To:</strong> All {unpaidPagination.total} unpaid members with {reminderModal.channel === 'email' ? 'email addresses' : 'phone numbers'}</p>
                  <p><strong>Channel:</strong> {reminderModal.channel === 'email' ? '📧 Email' : '📱 SMS'}</p>
                  <div className="bulk-warning">
                    ⚠️ This will send a {reminderModal.channel === 'email' ? 'email' : 'SMS'} reminder to every unpaid member who has a valid {reminderModal.channel === 'email' ? 'email address' : 'phone number'}.
                  </div>
                </div>
              ) : (
                <div className="recipient-info">
                  <p><strong>To:</strong> {reminderModal.user.fullName || reminderModal.user.username}</p>
                  <p><strong>Channel:</strong> {reminderModal.channel === 'email' ? '📧 Email' : '📱 SMS'}</p>
                  <p><strong>Recipient:</strong> {reminderModal.channel === 'email' ? reminderModal.user.contactEmail : reminderModal.user.contactPhone}</p>
                </div>
              )}

              <div className="message-preview">
                {reminderModal.channel === 'email' ? (
                  <div className="email-preview">
                    <p><strong>Subject:</strong> We miss you at L3V3L MATCHES 💝</p>
                    <div className="email-body-preview">
                      <p>Hi {reminderModal.bulk ? '<First Name>' : (reminderModal.user.fullName?.split(' ')[0] || 'Member')},</p>
                      <p>We noticed you haven't made a contribution yet. Your support helps us keep L3V3L MATCHES running and improving for everyone in the community.</p>
                      <p>Every contribution — big or small — directly supports:</p>
                      <ul>
                        <li>Server & infrastructure costs</li>
                        <li>Security & privacy enhancements</li>
                        <li>New matching features & improvements</li>
                      </ul>
                      <p><a href={reminderContributionUrl} style={{ color: 'var(--text-color)' }}>Make a Contribution →</a></p>
                      <p>— The L3V3L Team</p>
                    </div>
                  </div>
                ) : (
                  <div className="sms-preview">
                    <p>Hi {reminderModal.bulk ? '<First Name>' : (reminderModal.user.fullName?.split(' ')[0] || 'Member')}! Hope your partner-search journey is going beautifully. 💝<br/><br/>Thank you for being part of our community. Your contribution plays a big role in keeping L3V3L MATCHES growing and improving for everyone.<br/><br/>Support here: {reminderContributionUrl}<br/>— L3V3L Team</p>
                  </div>
                )}
              </div>

              <div className="reminder-actions">
                <button
                  className="btn-secondary"
                  onClick={() => setReminderModal(null)}
                  disabled={reminderSending}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={() => sendReminder(reminderModal.user, reminderModal.channel)}
                  disabled={reminderSending}
                >
                  {reminderSending ? (
                    <>
                      <span className="btn-spinner"></span> Sending...
                    </>
                  ) : (
                    <>{reminderModal.bulk ? `📤 Send Bulk ${reminderModal.channel === 'email' ? 'Email' : 'SMS'}` : `📤 Send ${reminderModal.channel === 'email' ? 'Email' : 'SMS'}`}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContributionManagement;
