import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createApiInstance } from '../api';
import { getBackendUrl } from '../config/apiConfig';
import Toast from './Toast';
import VirtualMeetPaymentModal from './VirtualMeetPaymentModal';
import './VirtualMeets.css';

// Use backend URL directly — the router is at /api/virtual-meets, not /api/users/virtual-meets
const vmApi = createApiInstance();

const VirtualMeets = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [matchData, setMatchData] = useState(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentModalEvent, setPaymentModalEvent] = useState(null);

  // Admin state
  const isAdmin = localStorage.getItem('userRole') === 'admin';
  const [adminView, setAdminView] = useState(false);
  const [adminOverview, setAdminOverview] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [pairUserA, setPairUserA] = useState('');
  const [pairUserB, setPairUserB] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancelRoom, setConfirmCancelRoom] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [selectedMale, setSelectedMale] = useState(null);
  const [selectedFemale, setSelectedFemale] = useState(null);
  const [profileImageErrors, setProfileImageErrors] = useState({});

  // ─── Load Events ─────────────────────────────────────────────────────

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await vmApi.get('/api/virtual-meets/events');
      setEvents(response.data.events || []);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to load virtual meet events';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // ─── Load Match List ─────────────────────────────────────────────────

  const loadMatchList = async (pollId) => {
    try {
      setMatchLoading(true);
      const response = await vmApi.get(`/api/virtual-meets/${pollId}/matches`);
      setMatchData(response.data);
    } catch (err) {
      if (err.response?.status === 402) {
        setToast({ message: 'Payment required to access match list', type: 'warning' });
      } else {
        setToast({ message: err.response?.data?.detail || 'Failed to load matches', type: 'error' });
      }
    } finally {
      setMatchLoading(false);
    }
  };

  const handleViewMatches = (event) => {
    setSelectedEvent(event);
    loadMatchList(event.poll_id);
  };

  const handleBackToEvents = () => {
    setSelectedEvent(null);
    setMatchData(null);
    loadEvents();
  };

  // ─── Room Request ────────────────────────────────────────────────────

  const handleRequestRoom = async (targetUsername) => {
    if (!selectedEvent) return;
    try {
      const response = await vmApi.post(`/api/virtual-meets/${selectedEvent.poll_id}/request-room`, {
        target_username: targetUsername
      });
      setToast({ message: response.data.message || 'Room request sent!', type: 'success' });
      loadMatchList(selectedEvent.poll_id);
    } catch (err) {
      setToast({ message: err.response?.data?.detail || 'Failed to send request', type: 'error' });
    }
  };

  // ─── Respond to Request ──────────────────────────────────────────────

  const handleRespondRequest = async (requestId, action) => {
    if (!selectedEvent) return;
    try {
      const response = await vmApi.post(`/api/virtual-meets/${selectedEvent.poll_id}/respond-request`, {
        request_id: requestId,
        action: action
      });
      if (action === 'accept') {
        setToast({ message: `Room #${response.data.room?.room_number} created!`, type: 'success' });
      } else {
        setToast({ message: 'Request declined', type: 'info' });
      }
      loadMatchList(selectedEvent.poll_id);
    } catch (err) {
      setToast({ message: err.response?.data?.detail || 'Failed to respond', type: 'error' });
    }
  };

  // ─── Payment ─────────────────────────────────────────────────────────

  const handlePayment = (event) => {
    setPaymentModalEvent(event);
  };

  const handlePaymentSuccess = () => {
    setPaymentModalEvent(null);
    setToast({ message: 'Payment successful! Access unlocked.', type: 'success' });
    loadEvents();
  };

  // ─── Cancel Room ───────────────────────────────────────────────────

  const handleCancelRoom = async (roomId) => {
    if (confirmCancelRoom !== roomId) {
      setConfirmCancelRoom(roomId);
      setTimeout(() => setConfirmCancelRoom(null), 5000);
      return;
    }
    try {
      const response = await vmApi.post(`/api/virtual-meets/${selectedEvent.poll_id}/cancel-room`, {
        room_id: roomId
      });
      setToast({ message: response.data.message || 'Room cancelled', type: 'success' });
      setConfirmCancelRoom(null);
      loadMatchList(selectedEvent.poll_id);
    } catch (err) {
      setToast({ message: err.response?.data?.detail || 'Failed to cancel room', type: 'error' });
      setConfirmCancelRoom(null);
    }
  };

  // ─── Admin Functions ──────────────────────────────────────────────────

  const loadAdminOverview = async (pollId) => {
    try {
      setAdminLoading(true);
      const response = await vmApi.get(`/api/virtual-meets/${pollId}/admin/overview`);
      setAdminOverview(response.data);
      
      // Prepare analytics data
      const ov = response.data;
      const roomedUsers = new Set();
      ov.rooms?.forEach(room => {
        roomedUsers.add(room.user_a);
        roomedUsers.add(room.user_b);
      });
      
      const unroomedPaid = ov.participants?.filter(p => 
        p.payment_status === 'completed' && !roomedUsers.has(p.username)
      ) || [];
      
      setAnalyticsData({
        ...ov,
        unroomedPaid,
        roomedUsers: Array.from(roomedUsers)
      });
    } catch (err) {
      setToast({ message: err.response?.data?.detail || 'Failed to load admin overview', type: 'error' });
    } finally {
      setAdminLoading(false);
    }
  };

  const handleBulkPair = async () => {
    if (!pairUserA || !pairUserB) {
      setToast({ message: 'Please enter both usernames', type: 'error' });
      return;
    }
    
    if (pairUserA === pairUserB) {
      setToast({ message: 'Cannot pair a user with themselves', type: 'error' });
      return;
    }
    
    if (!selectedEvent) {
      setToast({ message: 'No event selected', type: 'error' });
      return;
    }
    
    try {
      const response = await vmApi.post(`/api/virtual-meets/${selectedEvent.poll_id}/admin/bulk-pair`, {
        user_a: pairUserA.trim(),
        user_b: pairUserB.trim()
      });
      
      setToast({ message: response.data.message || 'Users paired successfully', type: 'success' });
      setPairUserA('');
      setPairUserB('');
      
      // Reload admin overview to show new room
      if (adminView) {
        loadAdminOverview(selectedEvent.poll_id);
      }
    } catch (err) {
      setToast({ message: err.response?.data?.detail || 'Failed to pair users', type: 'error' });
    }
  };

  const handlePairSelected = async () => {
    if (!selectedMale || !selectedFemale) {
      setToast({ message: 'Please select one male and one female participant', type: 'error' });
      return;
    }
    
    if (!selectedEvent) {
      setToast({ message: 'No event selected', type: 'error' });
      return;
    }

    // Check if this pair already exists
    if (adminOverview?.rooms) {
      const alreadyPaired = adminOverview.rooms.some(room =>
        (room.status === 'confirmed' || room.status === 'active') &&
        ((room.user_a === selectedMale && room.user_b === selectedFemale) ||
         (room.user_a === selectedFemale && room.user_b === selectedMale))
      );
      if (alreadyPaired) {
        setToast({ message: `${selectedMale} and ${selectedFemale} are already paired together`, type: 'error' });
        return;
      }
    }
    
    try {
      const response = await vmApi.post(`/api/virtual-meets/${selectedEvent.poll_id}/admin/bulk-pair`, {
        user_a: selectedMale,
        user_b: selectedFemale
      });
      
      setToast({ message: response.data.message || 'Users paired successfully', type: 'success' });
      setSelectedMale(null);
      setSelectedFemale(null);
      
      // Reload admin overview to show new room
      if (adminView) {
        loadAdminOverview(selectedEvent.poll_id);
      }
    } catch (err) {
      setToast({ message: err.response?.data?.detail || 'Failed to pair users', type: 'error' });
    }
  };

  
  const handleAdminUnpair = async (roomId) => {
    if (!selectedEvent) return;
    try {
      const response = await vmApi.post(`/api/virtual-meets/${selectedEvent.poll_id}/admin/unpair`, {
        room_id: roomId
      });
      setToast({ message: response.data.message || 'Room unpaired successfully', type: 'success' });
      loadAdminOverview(selectedEvent.poll_id);
    } catch (err) {
      setToast({ message: err.response?.data?.detail || 'Failed to unpair room', type: 'error' });
    }
  };

  const handleBackfillSessions = async (pollId) => {
    setToast({ message: 'Backfilling sessions from Yes RSVPs...', type: 'info' });
    try {
      const response = await vmApi.post(`/api/virtual-meets/${pollId}/admin/backfill-sessions`);
      const r = response.data || {};
      setToast({
        message: `Backfill: ${r.created || 0} created, ${r.already_existed || 0} existed` +
          (r.skipped_no_gender ? `, ${r.skipped_no_gender} skipped (no gender)` : '') +
          (r.skipped_no_user ? `, ${r.skipped_no_user} skipped (no user)` : ''),
        type: 'success'
      });
      loadAdminOverview(pollId);
    } catch (err) {
      setToast({ message: err.response?.data?.detail || 'Failed to backfill sessions', type: 'error' });
    }
  };

  const handleExpireRooms = async (pollId) => {
    try {
      const response = await vmApi.post(`/api/virtual-meets/${pollId}/admin/expire-rooms`);
      setToast({
        message: `Expired ${response.data.expired_rooms || 0} rooms and ${response.data.expired_requests || 0} requests`,
        type: 'success'
      });
      loadAdminOverview(pollId);
    } catch (err) {
      setToast({ message: err.response?.data?.detail || 'Failed to expire rooms', type: 'error' });
    }
  };

  // ─── Delete Event (Admin) ──────────────────────────────────────────

  const handleDeleteEvent = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 5000);
      return;
    }
    try {
      await vmApi.delete(`/api/virtual-meets/${selectedEvent.poll_id}/admin/delete`);
      setToast({ message: 'Virtual meet data deleted successfully', type: 'success' });
      setAdminView(false);
      setSelectedEvent(null);
      setAdminOverview(null);
      setConfirmDelete(false);
      loadEvents();
    } catch (err) {
      setToast({ message: err.response?.data?.detail || 'Failed to delete', type: 'error' });
      setConfirmDelete(false);
    }
  };

  // ─── Export ─────────────────────────────────────────────────────────

  const exportAdminCSV = () => {
    if (!adminOverview || !selectedEvent) return;

    const rows = [];
    const headers = ['Section', 'Username', 'Name', 'Age', 'Location', 'Gender', 'Payment Status', 'Room #', 'Partner', 'Room Status', 'Request Status'];
    rows.push(headers.join(','));

    const esc = (val) => {
      if (val == null || val === '') return '';
      const s = String(val).replace(/"/g, '""');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
    };

    // Participants
    if (adminOverview.participants) {
      adminOverview.participants.forEach(p => {
        rows.push([
          'Participant',
          esc(p.username),
          esc(p.firstName + ' ' + p.lastName),
          esc(p.age),
          esc(p.location),
          esc(p.gender),
          esc(p.payment_status),
          '',
          '',
          '',
          ''
        ].join(','));
      });
    }

    // Rooms with partner details
    if (adminOverview.rooms) {
      adminOverview.rooms.forEach(room => {
        const partnerA = adminOverview.participants?.find(p => p.username === room.user_a);
        const partnerB = adminOverview.participants?.find(p => p.username === room.user_b);
        
        // Add room entry for both participants
        [partnerA, partnerB].forEach((partner, idx) => {
          const otherPartner = idx === 0 ? partnerB : partnerA;
          rows.push([
            'Room',
            esc(partner?.username || ''),
            esc(partner ? `${partner.firstName} ${partner.lastName}` : ''),
            esc(partner?.age || ''),
            esc(partner?.location || ''),
            esc(partner?.gender || ''),
            esc(partner?.payment_status || ''),
            esc(room.room_number || ''),
            esc(otherPartner ? `${otherPartner.firstName} ${otherPartner.lastName}` : ''),
            esc(room.status || ''),
            'accepted'
          ].join(','));
        });
      });
    }

    // Pending Requests
    if (adminOverview.participants) {
      // Find pending requests by checking participants who don't have rooms
      const roomedUsers = new Set();
      adminOverview.rooms?.forEach(room => {
        roomedUsers.add(room.user_a);
        roomedUsers.add(room.user_b);
      });
      
      adminOverview.participants.forEach(p => {
        if (!roomedUsers.has(p.username) && p.payment_status === 'completed') {
          rows.push([
            'Pending',
            esc(p.username),
            esc(p.firstName + ' ' + p.lastName),
            esc(p.age),
            esc(p.location),
            esc(p.gender),
            esc(p.payment_status),
            '',
            '',
            '',
            'pending'
          ].join(','));
        }
      });
    }

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `virtual-meet-${selectedEvent.poll_id}-admin-export.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportRoomsCSV = () => {
    if (!adminOverview || !selectedEvent) return;
    const rooms = adminOverview.rooms || [];
    if (rooms.length === 0) {
      setToast({ message: 'No rooms to export', type: 'warning' });
      return;
    }

    const esc = (val) => {
      if (val == null || val === '') return '';
      const s = String(val).replace(/"/g, '""');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
    };

    const rows = [];
    rows.push(['Room', 'User A', 'User B', 'Status'].join(','));

    rooms.forEach(room => {
      rows.push([
        esc(`Room-${room.room_number}`),
        esc(room.user_a),
        esc(room.user_b),
        esc(room.status)
      ].join(','));
    });

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `virtual-meet-${selectedEvent.poll_id}-rooms.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToast({ message: `Exported ${rooms.length} rooms`, type: 'success' });
  };

  const exportMatchListCSV = () => {
    if (!matchData || !selectedEvent) return;

    const rows = [];
    const headers = ['Section', 'Name', 'Username', 'Age', 'Location', 'Profession', 'Status', 'Room #'];
    rows.push(headers.join(','));

    const esc = (val) => {
      if (val == null || val === '') return '';
      const s = String(val).replace(/"/g, '""');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
    };

    // My Rooms
    if (matchData.my_rooms) {
      matchData.my_rooms.forEach(room => {
        rows.push([
          'My Rooms',
          esc(room.partner_name),
          esc(room.partner_username),
          '',
          '',
          '',
          esc(room.status),
          esc(room.room_number)
        ].join(','));
      });
    }

    // Incoming Requests
    if (matchData.my_requests_received) {
      matchData.my_requests_received.forEach(req => {
        rows.push([
          'Incoming Request',
          esc(req.full_name),
          esc(req.from_username),
          esc(req.age),
          esc(req.location),
          esc(req.profession),
          'pending',
          ''
        ].join(','));
      });
    }

    // Matches
    if (matchData.matches) {
      matchData.matches.forEach(match => {
        rows.push([
          'Match',
          esc(match.full_name),
          esc(match.username),
          esc(match.age),
          esc(match.location),
          esc(match.profession),
          esc(match.request_status || 'no request'),
          esc(match.room_number)
        ].join(','));
      });
    }

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const eventSlug = selectedEvent.title?.replace(/[^a-zA-Z0-9]+/g, '_') || 'virtual_meet';
    a.href = url;
    a.download = `${eventSlug}_matches.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setToast({ message: 'Match list exported!', type: 'success' });
  };

  // ─── Format Helpers ──────────────────────────────────────────────────

  const formatEventDate = (event) => {
    if (!event.event_date) return '';
    try {
      const date = new Date(event.event_date);
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      let str = date.toLocaleDateString('en-US', options);
      if (event.event_time) {
        const [h, m] = event.event_time.split(':');
        const hour = parseInt(h);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        str += ` at ${displayHour}:${m} ${ampm}`;
      }
      if (event.event_timezone) {
        const tzAbbr = getTimezoneAbbr(event.event_timezone);
        str += ` ${tzAbbr}`;
      }
      return str;
    } catch {
      return event.event_date;
    }
  };

  const getTimezoneAbbr = (tz) => {
    const map = {
      'America/Los_Angeles': 'PT',
      'America/Denver': 'MT',
      'America/Chicago': 'CT',
      'America/New_York': 'ET',
      'Pacific/Honolulu': 'HT',
      'America/Anchorage': 'AKT',
      'America/Phoenix': 'MST',
      'UTC': 'UTC'
    };
    return map[tz] || tz;
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'pending': return 'vm-badge-pending';
      case 'accepted': return 'vm-badge-accepted';
      case 'declined': return 'vm-badge-declined';
      default: return '';
    }
  };

  const getProfileHref = (username) => `/profile/${encodeURIComponent(username || '')}`;

  const getAvatarInitials = (fullName, username) => {
    const source = String(fullName || username || '?').trim();
    if (!source) return '?';
    const words = source.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
    }
    return (words[0][0] || '?').toUpperCase();
  };

  const getAvatarUrl = (profilePicUrl, username) => {
    if (profilePicUrl && /^https?:\/\//i.test(profilePicUrl)) {
      return profilePicUrl;
    }
    if (profilePicUrl) {
      return `${getBackendUrl()}${profilePicUrl}`;
    }
    return `${getBackendUrl()}/api/profile-pic/${username}`;
  };

  const onAvatarError = (imageKey) => {
    setProfileImageErrors((prev) => ({
      ...prev,
      [imageKey]: true,
    }));
  };

  const getMatchMeta = (person) => {
    const parts = [];
    if (person?.dob_mm_yyyy) parts.push(`DOB ${person.dob_mm_yyyy}`);
    if (person?.height) parts.push(`Height ${person.height}`);
    if (person?.age) parts.push(`${person.age} yrs`);
    if (person?.location) parts.push(person.location);
    return parts;
  };

  const getParticipantDisplayName = (person) => {
    const explicit = String(person?.full_name || '').trim();
    if (explicit) return explicit;

    const joined = `${person?.firstName || ''} ${person?.lastName || ''}`.trim();
    if (joined) return joined;

    return person?.username || 'Unknown';
  };

  const renderAvatar = ({ imageKey, profilePicUrl, username, fullName, small = false }) => {
    const hasError = !!profileImageErrors[imageKey];

    return (
      <div className={`vm-match-avatar ${small ? 'vm-match-avatar-sm' : ''}`}>
        {hasError ? (
          <div className={`vm-avatar-fallback ${small ? 'vm-avatar-fallback-sm' : ''}`}>
            {getAvatarInitials(fullName, username)}
          </div>
        ) : (
          <img
            src={getAvatarUrl(profilePicUrl, username)}
            alt={fullName || username}
            className={`vm-avatar-img ${small ? 'vm-avatar-sm' : ''}`}
            onError={() => onAvatarError(imageKey)}
          />
        )}
      </div>
    );
  };

  // ─── Render: Events List ─────────────────────────────────────────────

  const renderEventsList = () => {
    if (loading) {
      return <div className="vm-loading">Loading your virtual meet events...</div>;
    }

    if (error) {
      return (
        <div className="vm-error">
          <span className="vm-error-icon">!</span>
          <p>{error}</p>
          <button className="vm-btn vm-btn-primary" onClick={loadEvents}>Retry</button>
        </div>
      );
    }

    if (events.length === 0) {
      return (
        <div className="vm-empty">
          <div className="vm-empty-icon">🎥</div>
          <h3>No Virtual Meet Events</h3>
          <p>You haven't RSVPed "Yes" to any active polls yet. Check your dashboard for upcoming events!</p>
          <button className="vm-btn vm-btn-primary" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </button>
        </div>
      );
    }

    return (
      <div className="vm-events-list">
        {events.map(event => (
          <div key={event.poll_id} className={`vm-event-card ${event.is_locked ? 'vm-locked' : ''} ${event.is_closed ? 'vm-closed' : ''}`}>
            <div className="vm-event-header">
              <h3 className="vm-event-title">{event.title}</h3>
              {event.is_closed ? (
                <span className="vm-event-type-badge vm-type-closed">Closed</span>
              ) : event.event_type ? (
                <span className={`vm-event-type-badge vm-type-${event.event_type}`}>
                  {event.event_type === 'zoom-call' ? 'Zoom Call' : 
                   event.event_type === 'in-person' ? 'In Person' :
                   event.event_type === 'virtual' ? 'Virtual' : 'Hybrid'}
                </span>
              ) : null}
            </div>

            <div className="vm-event-details">
              {event.event_date && (
                <div className="vm-event-detail">
                  <span className="vm-detail-icon">📅</span>
                  <span>{formatEventDate(event)}</span>
                </div>
              )}
              {event.event_location && (
                <div className="vm-event-detail">
                  <span className="vm-detail-icon">📍</span>
                  <span>{event.event_location}</span>
                </div>
              )}
              <div className="vm-event-detail">
                <span className="vm-detail-icon">👥</span>
                <span>{event.match_count} matches available</span>
              </div>
              {event.room_count > 0 && (
                <div className="vm-event-detail">
                  <span className="vm-detail-icon">🏠</span>
                  <span>{event.room_count} room{event.room_count !== 1 ? 's' : ''} confirmed</span>
                </div>
              )}
              {event.pending_requests_received > 0 && (
                <div className="vm-event-detail vm-highlight">
                  <span className="vm-detail-icon">📥</span>
                  <span>{event.pending_requests_received} incoming request{event.pending_requests_received !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>

            {event.is_closed && (
              <div className="vm-closed-banner">
                This event has ended. Your matches and rooms are available for reference.
              </div>
            )}
            {event.is_locked && !event.is_closed && (
              <div className="vm-locked-banner">
                🔒 Event is in progress. Room requests are locked.
              </div>
            )}

            <div className="vm-event-actions">
              {event.is_closed && !event.access_unlocked ? (
                <span className="vm-closed-no-access">Event ended — no access</span>
              ) : event.payment_required && !event.access_unlocked ? (
                <div className="vm-payment-section">
                  <div className="vm-payment-info">
                    <span className="vm-payment-icon">💳</span>
                    <span>Pay ${event.payment_amount?.toFixed(2) || '5.00'} to unlock</span>
                  </div>
                  <div className="vm-payment-buttons">
                    <button
                      className="vm-btn vm-btn-primary"
                      onClick={() => handlePayment(event)}
                      disabled={event.is_closed}
                    >
                      💳 Pay to Unlock
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="vm-btn vm-btn-primary"
                  onClick={() => handleViewMatches(event)}
                >
                  {event.is_closed ? 'View Matches (Read-only)' : 'View Matches →'}
                </button>
              )}
              {isAdmin && (
                <button
                  className="vm-btn vm-btn-admin"
                  onClick={() => {
                    setSelectedEvent(event);
                    setAdminView(true);
                    loadAdminOverview(event.poll_id);
                  }}
                >
                  🔧 Admin
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ─── Render: Match List ──────────────────────────────────────────────

  const renderMatchList = () => {
    if (matchLoading) {
      return <div className="vm-loading">Loading matches...</div>;
    }

    if (!matchData) return null;

    return (
      <div className="vm-match-view">
        {/* Header */}
        <div className="vm-match-header">
          <button className="vm-btn vm-btn-back" onClick={handleBackToEvents}>
            ← Back
          </button>
          <h2 className="vm-match-title">{selectedEvent.title}</h2>
          {matchData.is_closed && (
            <span className="vm-closed-badge">Closed</span>
          )}
          {matchData.is_locked && !matchData.is_closed && (
            <span className="vm-locked-badge">🔒 Locked</span>
          )}
          <button className="vm-btn vm-btn-export" onClick={exportMatchListCSV} title="Export match list as CSV">
            📥 Export
          </button>
        </div>

        {/* Incoming Requests */}
        {matchData.my_requests_received && matchData.my_requests_received.length > 0 && (
          <div className="vm-section">
            <h3 className="vm-section-title">
              📥 Incoming Requests ({matchData.my_requests_received.length})
            </h3>
            <div className="vm-match-cards">
              {matchData.my_requests_received.map(req => (
                <div key={req.request_id} className="vm-match-card vm-incoming">
                  <a
                    className="vm-match-profile-link"
                    href={getProfileHref(req.from_username)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {renderAvatar({
                      imageKey: `incoming-${req.from_username}`,
                      profilePicUrl: req.profile_pic_url,
                      username: req.from_username,
                      fullName: req.full_name,
                    })}
                    <div className="vm-match-info">
                      <div className="vm-match-name">{req.full_name}</div>
                      <div className="vm-match-username">@{req.from_username}</div>
                      <div className="vm-match-meta">{getMatchMeta(req).join(' · ')}</div>
                      {req.profession && (
                        <div className="vm-match-profession">Profession: {req.profession}</div>
                      )}
                      {req.education && (
                        <div className="vm-match-education">Education: {req.education}</div>
                      )}
                      {req.bio_tag && (
                        <div className="vm-match-bio-tag">Bio Tag: {req.bio_tag}</div>
                      )}
                    </div>
                  </a>
                  {!matchData.is_locked && (
                    <div className="vm-match-actions">
                      <button
                        className="vm-btn vm-btn-accept"
                        onClick={() => handleRespondRequest(req.request_id, 'accept')}
                      >
                        Accept
                      </button>
                      <button
                        className="vm-btn vm-btn-decline"
                        onClick={() => handleRespondRequest(req.request_id, 'decline')}
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Rooms */}
        {matchData.my_rooms && matchData.my_rooms.length > 0 && (
          <div className="vm-section">
            <h3 className="vm-section-title">
              🏠 My Rooms ({matchData.my_rooms.length})
            </h3>
            <div className="vm-room-cards">
              {matchData.my_rooms.map(room => (
                <div key={room.room_id} className="vm-room-card">
                  <div className="vm-room-number">Room #{room.room_number}</div>
                  <a
                    className="vm-room-partner vm-profile-link"
                    href={getProfileHref(room.partner_username)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {renderAvatar({
                      imageKey: `room-${room.partner_username}`,
                      profilePicUrl: room.partner_pic_url,
                      username: room.partner_username,
                      fullName: room.partner_name,
                      small: true,
                    })}
                    <span>{room.partner_name}</span>
                  </a>
                  <div className={`vm-room-status vm-status-${room.status}`}>
                    {room.status === 'confirmed' ? '✅ Confirmed' :
                     room.status === 'active' ? '🟢 Active' : room.status}
                  </div>
                  {room.zoom_link && (
                    <a href={room.zoom_link} target="_blank" rel="noopener noreferrer" className="vm-btn vm-btn-zoom">
                      Join Zoom
                    </a>
                  )}
                  {!matchData.is_locked && !matchData.is_closed && (
                    <button
                      className={`vm-btn vm-btn-cancel-room ${confirmCancelRoom === room.room_id ? 'vm-btn-danger-confirm' : ''}`}
                      onClick={() => handleCancelRoom(room.room_id)}
                      title={confirmCancelRoom === room.room_id ? 'Click again to confirm' : 'Cancel this room'}
                    >
                      {confirmCancelRoom === room.room_id ? 'Confirm Cancel?' : '✕ Cancel Room'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Match List */}
        <div className="vm-section">
          <h3 className="vm-section-title">
            🎯 Your Matches ({matchData.matches?.length || 0})
          </h3>
          {matchData.matches && matchData.matches.length > 0 ? (
            <div className="vm-match-cards">
              {matchData.matches.map(match => (
                <div
                  key={match.username}
                  className={`vm-match-card ${match.request_status === 'declined' ? 'vm-declined' : ''}`}
                >
                  <a
                    className="vm-match-profile-link"
                    href={getProfileHref(match.username)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {renderAvatar({
                      imageKey: `match-${match.username}`,
                      profilePicUrl: match.profile_pic_url,
                      username: match.username,
                      fullName: match.full_name,
                    })}
                    <div className="vm-match-info">
                      <div className="vm-match-name">{match.full_name}</div>
                      <div className="vm-match-username">@{match.username}</div>
                      <div className="vm-match-meta">{getMatchMeta(match).join(' · ')}</div>
                      {match.profession && (
                        <div className="vm-match-profession">Profession: {match.profession}</div>
                      )}
                      {match.education && (
                        <div className="vm-match-education">Education: {match.education}</div>
                      )}
                      {match.bio_tag && (
                        <div className="vm-match-bio-tag">Bio Tag: {match.bio_tag}</div>
                      )}
                    </div>
                  </a>
                  <div className="vm-match-actions">
                    {!match.request_status && !matchData.is_locked && (
                      <button
                        className="vm-btn vm-btn-request"
                        onClick={() => handleRequestRoom(match.username)}
                      >
                        🎥 Request 1:1 Room
                      </button>
                    )}
                    {match.request_status === 'pending' && (
                      <span className={`vm-status-badge ${getStatusBadgeClass('pending')}`}>
                        ⏳ Request Pending
                      </span>
                    )}
                    {match.request_status === 'accepted' && (
                      <span className={`vm-status-badge ${getStatusBadgeClass('accepted')}`}>
                        ✅ Room #{match.room_number || '—'}
                      </span>
                    )}
                    {match.request_status === 'declined' && (
                      <span className={`vm-status-badge ${getStatusBadgeClass('declined')}`}>
                        Declined
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="vm-empty-matches">
              <p>No opposite-gender matches found for this event yet.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── Render: Admin Overview ────────────────────────────────────────────

  const renderAdminOverview = () => {
    if (adminLoading) {
      return <div className="vm-loading">Loading admin overview...</div>;
    }

    if (!adminOverview) return null;

    const ov = adminOverview;

    return (
      <div className="vm-admin-view">
        <div className="vm-match-header">
          <button className="vm-btn vm-btn-back" onClick={() => {
            setAdminView(false);
            setSelectedEvent(null);
            setAdminOverview(null);
          }}>
            ← Back
          </button>
          <h2 className="vm-match-title">🔧 Admin: {ov.title}</h2>
          <div className="vm-admin-actions">
            <button className="vm-btn vm-btn-export" onClick={exportAdminCSV} title="Export full admin data (participants, rooms, requests) as CSV">
              📥 Export
            </button>
            <button className="vm-btn vm-btn-export" onClick={exportRoomsCSV} title="Export rooms only (Room, User A, User B, Status) as CSV">
              🏠 Rooms
            </button>
            <button
              className={`vm-btn ${confirmDelete ? 'vm-btn-danger-confirm' : 'vm-btn-danger'}`}
              onClick={handleDeleteEvent}
              title={confirmDelete ? 'Click again to confirm deletion' : 'Delete all virtual meet data for this event'}
            >
              {confirmDelete ? '⚠️ Confirm Delete?' : '🗑️ Delete'}
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="vm-admin-stats">
          <div className="vm-stat-card">
            <div className="vm-stat-value">{ov.total_participants}</div>
            <div className="vm-stat-label">Participants</div>
          </div>
          <div className="vm-stat-card">
            <div className="vm-stat-value">{ov.male_count}</div>
            <div className="vm-stat-label">Male</div>
          </div>
          <div className="vm-stat-card">
            <div className="vm-stat-value">{ov.female_count}</div>
            <div className="vm-stat-label">Female</div>
          </div>
          <div className="vm-stat-card">
            <div className="vm-stat-value">{ov.paid_count}</div>
            <div className="vm-stat-label">Paid</div>
          </div>
          <div className="vm-stat-card">
            <div className="vm-stat-value">{ov.unpaid_count}</div>
            <div className="vm-stat-label">Unpaid</div>
          </div>
          <div className="vm-stat-card">
            <div className="vm-stat-value">{ov.exempt_count}</div>
            <div className="vm-stat-label">Exempt</div>
          </div>
          <div className="vm-stat-card">
            <div className="vm-stat-value">{ov.total_rooms}</div>
            <div className="vm-stat-label">Rooms</div>
          </div>
          <div className="vm-stat-card">
            <div className="vm-stat-value">{ov.total_requests}</div>
            <div className="vm-stat-label">Requests</div>
          </div>
        </div>

        {/* Request Breakdown */}
        <div className="vm-section">
          <h3 className="vm-section-title">Request Breakdown</h3>
          <div className="vm-admin-request-stats">
            <span className="vm-badge-accepted">✅ {ov.accepted_requests} Accepted</span>
            <span className="vm-badge-pending">⏳ {ov.pending_requests} Pending</span>
            <span className="vm-badge-declined">❌ {ov.declined_requests} Declined</span>
          </div>
        </div>

        {/* Admin Actions */}
        <div className="vm-section">
          <h3 className="vm-section-title">Admin Actions</h3>
          <div className="vm-admin-action-row">
            <button
              className="vm-btn vm-btn-primary"
              onClick={() => setShowAnalytics(!showAnalytics)}
            >
              📊 {showAnalytics ? 'Hide' : 'Show'} Analytics
            </button>
            <button
              className="vm-btn vm-btn-primary"
              onClick={() => handleBackfillSessions(selectedEvent.poll_id)}
              title="Create Virtual Meet sessions for every Yes-voter who hasn't opened the page yet"
            >
              👥 Backfill Sessions from Yes RSVPs
            </button>
            <button
              className="vm-btn vm-btn-decline"
              onClick={() => handleExpireRooms(selectedEvent.poll_id)}
            >
              Expire Unused Rooms & Pending Requests
            </button>
          </div>
        </div>

        {/* Rooms List */}
        {ov.rooms && ov.rooms.length > 0 && (
          <div className="vm-section">
            <h3 className="vm-section-title">🏠 Rooms ({ov.rooms.length})</h3>
            <div className="vm-admin-table-wrapper">
              <table className="vm-admin-table">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>User A</th>
                    <th>User B</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {ov.rooms.map(room => (
                    <tr key={room._id}>
                      <td><span className="vm-room-label">Room-{room.room_number}</span></td>
                      <td>{room.user_a}</td>
                      <td>{room.user_b}</td>
                      <td><span className={`vm-status-badge vm-badge-${room.status === 'confirmed' ? 'accepted' : room.status === 'active' ? 'accepted' : 'declined'}`}>{room.status}</span></td>
                      <td>
                        {(room.status === 'confirmed' || room.status === 'active') && (
                          <button
                            className="vm-btn vm-btn-unpair"
                            onClick={() => handleAdminUnpair(room._id)}
                          >
                            Unpair
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Participants List - Split by Gender */}
        {ov.participants && ov.participants.length > 0 && (
          <div className="vm-section">
            <div className="vm-participants-header">
              <h3 className="vm-section-title">👥 Participants ({ov.participants.length})</h3>
              {(selectedMale || selectedFemale) && (
                <button 
                  className="vm-btn vm-btn-primary vm-btn-pair-selected"
                  onClick={handlePairSelected}
                  disabled={!selectedMale || !selectedFemale}
                >
                  🔗 Pair Selected Match
                </button>
              )}
            </div>
            
            {(() => {
              const roomCounts = {};
              ov.rooms?.forEach(room => {
                if (room.status === 'confirmed' || room.status === 'active') {
                  roomCounts[room.user_a] = (roomCounts[room.user_a] || 0) + 1;
                  roomCounts[room.user_b] = (roomCounts[room.user_b] || 0) + 1;
                }
              });
              const males = ov.participants.filter(p => p.gender === 'Male');
              const females = ov.participants.filter(p => p.gender === 'Female');

              return (
                <div className="vm-participants-grid">
                  {/* Male Participants */}
                  <div className="vm-gender-section">
                    <h4 className="vm-gender-title">Male ({males.length})</h4>
                    <div className="vm-admin-table-wrapper">
                      <table className="vm-admin-table">
                        <thead>
                          <tr>
                            <th></th>
                            <th>Participant</th>
                            <th>Profile</th>
                            <th>Profession</th>
                            <th>Education</th>
                            <th>Bio Tag</th>
                            <th>Payment</th>
                            <th>Access</th>
                            <th>Rooms</th>
                          </tr>
                        </thead>
                        <tbody>
                          {males.map(p => {
                            const count = roomCounts[p.username] || 0;
                            const displayName = getParticipantDisplayName(p);
                            const profileMeta = getMatchMeta(p).join(' · ');
                            return (
                              <tr key={p._id} className={selectedMale === p.username ? 'vm-selected-row' : ''}>
                                <td>
                                  <input
                                    type="radio"
                                    name="selectedMale"
                                    checked={selectedMale === p.username}
                                    onChange={() => setSelectedMale(p.username)}
                                    className="vm-select-checkbox"
                                  />
                                </td>
                                <td>
                                  <a
                                    className="vm-admin-participant-link"
                                    href={getProfileHref(p.username)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {renderAvatar({
                                      imageKey: `admin-male-${p.username}`,
                                      profilePicUrl: p.profile_pic_url,
                                      username: p.username,
                                      fullName: displayName,
                                      small: true,
                                    })}
                                    <div className="vm-admin-participant-identity">
                                      <div className="vm-admin-participant-name">{displayName}</div>
                                      <div className="vm-admin-participant-username">@{p.username}</div>
                                    </div>
                                  </a>
                                </td>
                                <td className="vm-admin-participant-meta" title={profileMeta || '—'}>{profileMeta || '—'}</td>
                                <td className="vm-admin-participant-profession" title={p.profession || '—'}>{p.profession || '—'}</td>
                                <td className="vm-admin-participant-education" title={p.education || '—'}>{p.education || '—'}</td>
                                <td className="vm-admin-participant-bio" title={p.bio_tag || '—'}>{p.bio_tag || '—'}</td>
                                <td><span className={`vm-status-badge vm-badge-${p.payment_status === 'completed' ? 'accepted' : p.payment_status === 'not_required' ? 'accepted' : 'pending'}`}>{p.payment_status}</span></td>
                                <td>{p.access_unlocked ? '✅' : '🔒'}</td>
                                <td>{count > 0 ? <span className="vm-room-count">{count}</span> : '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Female Participants */}
                  <div className="vm-gender-section">
                    <h4 className="vm-gender-title">Female ({females.length})</h4>
                    <div className="vm-admin-table-wrapper">
                      <table className="vm-admin-table">
                        <thead>
                          <tr>
                            <th></th>
                            <th>Participant</th>
                            <th>Profile</th>
                            <th>Profession</th>
                            <th>Education</th>
                            <th>Bio Tag</th>
                            <th>Payment</th>
                            <th>Access</th>
                            <th>Rooms</th>
                          </tr>
                        </thead>
                        <tbody>
                          {females.map(p => {
                            const count = roomCounts[p.username] || 0;
                            const displayName = getParticipantDisplayName(p);
                            const profileMeta = getMatchMeta(p).join(' · ');
                            return (
                              <tr key={p._id} className={selectedFemale === p.username ? 'vm-selected-row' : ''}>
                                <td>
                                  <input
                                    type="radio"
                                    name="selectedFemale"
                                    checked={selectedFemale === p.username}
                                    onChange={() => setSelectedFemale(p.username)}
                                    className="vm-select-checkbox"
                                  />
                                </td>
                                <td>
                                  <a
                                    className="vm-admin-participant-link"
                                    href={getProfileHref(p.username)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {renderAvatar({
                                      imageKey: `admin-female-${p.username}`,
                                      profilePicUrl: p.profile_pic_url,
                                      username: p.username,
                                      fullName: displayName,
                                      small: true,
                                    })}
                                    <div className="vm-admin-participant-identity">
                                      <div className="vm-admin-participant-name">{displayName}</div>
                                      <div className="vm-admin-participant-username">@{p.username}</div>
                                    </div>
                                  </a>
                                </td>
                                <td className="vm-admin-participant-meta" title={profileMeta || '—'}>{profileMeta || '—'}</td>
                                <td className="vm-admin-participant-profession" title={p.profession || '—'}>{p.profession || '—'}</td>
                                <td className="vm-admin-participant-education" title={p.education || '—'}>{p.education || '—'}</td>
                                <td className="vm-admin-participant-bio" title={p.bio_tag || '—'}>{p.bio_tag || '—'}</td>
                                <td><span className={`vm-status-badge vm-badge-${p.payment_status === 'completed' ? 'accepted' : p.payment_status === 'not_required' ? 'accepted' : 'pending'}`}>{p.payment_status}</span></td>
                                <td>{p.access_unlocked ? '✅' : '🔒'}</td>
                                <td>{count > 0 ? <span className="vm-room-count">{count}</span> : '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    );
  };

  // ─── Render: Analytics Section ───────────────────────────────────────────

  const renderAnalytics = () => {
    if (!analyticsData) return null;

    const { unroomedPaid, roomedUsers } = analyticsData;

    return (
      <div className="vm-section vm-analytics-section">
        <h3 className="vm-section-title">📊 Analytics Report</h3>
        
        <div className="vm-analytics-grid">
          <div className="vm-analytics-card">
            <h4>Room Summary</h4>
            <div className="vm-analytics-stats">
              <div className="vm-stat">
                <span className="vm-stat-label">Total Rooms:</span>
                <span className="vm-stat-value">{analyticsData.total_rooms}</span>
              </div>
              <div className="vm-stat">
                <span className="vm-stat-label">Users in Rooms:</span>
                <span className="vm-stat-value">{roomedUsers.length}</span>
              </div>
              <div className="vm-stat">
                <span className="vm-stat-label">Paid Users Waiting:</span>
                <span className="vm-stat-value">{unroomedPaid.length}</span>
              </div>
            </div>
          </div>

          <div className="vm-analytics-card">
            <h4>Users by Room Count</h4>
            <div className="vm-room-user-list">
              {analyticsData.rooms?.map(room => (
                <div key={room._id} className="vm-room-user-item">
                  <span className="vm-room-number">Room #{room.room_number}</span>
                  <div className="vm-room-users">
                    <span className="vm-room-user">{room.user_a}</span>
                    <span className="vm-room-user">{room.user_b}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="vm-analytics-card">
            <h4>Unpaired Paid Users</h4>
            <div className="vm-unroomed-list">
              {unroomedPaid.length > 0 ? (
                unroomedPaid.map(p => (
                  <div key={p._id} className="vm-unroomed-user">
                    <span className="vm-username">{p.username}</span>
                    <span className="vm-gender">{p.gender}</span>
                  </div>
                ))
              ) : (
                <p className="vm-empty-message">All paid users are paired!</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Main Render ─────────────────────────────────────────────────────

  return (
    <div className="vm-container">
        {adminView ? renderAdminOverview() : selectedEvent ? renderMatchList() : renderEventsList()}

        {/* Analytics Section (shown when admin view and analytics toggle is on) */}
        {adminView && showAnalytics && renderAnalytics()}

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}

        <VirtualMeetPaymentModal
          isOpen={!!paymentModalEvent}
          onClose={() => setPaymentModalEvent(null)}
          onSuccess={handlePaymentSuccess}
          event={paymentModalEvent}
        />
    </div>
  );
};

export default VirtualMeets;
