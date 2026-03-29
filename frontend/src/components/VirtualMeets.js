import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createApiInstance } from '../api';
import { getBackendUrl } from '../config/apiConfig';
import Toast from './Toast';
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

  // Admin state
  const isAdmin = localStorage.getItem('userRole') === 'admin';
  const [adminView, setAdminView] = useState(false);
  const [adminOverview, setAdminOverview] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [pairUserA, setPairUserA] = useState('');
  const [pairUserB, setPairUserB] = useState('');

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

  const handlePayment = async (event, method = 'paypal') => {
    try {
      setPaymentLoading(true);
      const response = await vmApi.post(`/api/virtual-meets/${event.poll_id}/pay`, {
        payment_method: method
      });

      if (method === 'paypal' && response.data.approval_url) {
        window.location.href = response.data.approval_url;
      } else if (method === 'clover' && response.data.checkout_url) {
        window.location.href = response.data.checkout_url;
      } else {
        setToast({ message: 'Payment initiated. Please complete the checkout.', type: 'info' });
      }
    } catch (err) {
      setToast({ message: err.response?.data?.detail || 'Payment failed', type: 'error' });
    } finally {
      setPaymentLoading(false);
    }
  };

  // ─── Admin Functions ──────────────────────────────────────────────────

  const loadAdminOverview = async (pollId) => {
    try {
      setAdminLoading(true);
      const response = await vmApi.get(`/api/virtual-meets/${pollId}/admin/overview`);
      setAdminOverview(response.data);
    } catch (err) {
      setToast({ message: err.response?.data?.detail || 'Failed to load admin overview', type: 'error' });
    } finally {
      setAdminLoading(false);
    }
  };

  const handleAdminPair = async () => {
    if (!selectedEvent || !pairUserA.trim() || !pairUserB.trim()) {
      setToast({ message: 'Enter both usernames to pair', type: 'error' });
      return;
    }
    try {
      const response = await vmApi.post(`/api/virtual-meets/${selectedEvent.poll_id}/admin/pair`, {
        user_a: pairUserA.trim(),
        user_b: pairUserB.trim()
      });
      setToast({ message: response.data.message || 'Users paired!', type: 'success' });
      setPairUserA('');
      setPairUserB('');
      loadAdminOverview(selectedEvent.poll_id);
    } catch (err) {
      setToast({ message: err.response?.data?.detail || 'Failed to pair users', type: 'error' });
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
          <div key={event.poll_id} className={`vm-event-card ${event.is_locked ? 'vm-locked' : ''}`}>
            <div className="vm-event-header">
              <h3 className="vm-event-title">{event.title}</h3>
              {event.event_type && (
                <span className={`vm-event-type-badge vm-type-${event.event_type}`}>
                  {event.event_type === 'zoom-call' ? 'Zoom Call' : 
                   event.event_type === 'in-person' ? 'In Person' :
                   event.event_type === 'virtual' ? 'Virtual' : 'Hybrid'}
                </span>
              )}
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

            {event.is_locked && (
              <div className="vm-locked-banner">
                🔒 Event is in progress. Room requests are locked.
              </div>
            )}

            <div className="vm-event-actions">
              {event.payment_required && !event.access_unlocked ? (
                <div className="vm-payment-section">
                  <div className="vm-payment-info">
                    <span className="vm-payment-icon">💳</span>
                    <span>Pay ${event.payment_amount?.toFixed(2) || '5.00'} to unlock</span>
                  </div>
                  <div className="vm-payment-buttons">
                    <button
                      className="vm-btn vm-btn-paypal"
                      onClick={() => handlePayment(event, 'paypal')}
                      disabled={paymentLoading}
                    >
                      {paymentLoading ? 'Processing...' : 'Pay with PayPal'}
                    </button>
                    <button
                      className="vm-btn vm-btn-clover"
                      onClick={() => handlePayment(event, 'clover')}
                      disabled={paymentLoading}
                    >
                      {paymentLoading ? 'Processing...' : 'Pay with Card'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="vm-btn vm-btn-primary"
                  onClick={() => handleViewMatches(event)}
                >
                  View Matches →
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
          {matchData.is_locked && (
            <span className="vm-locked-badge">🔒 Locked</span>
          )}
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
                  <div className="vm-match-avatar">
                    <img
                      src={`${getBackendUrl()}/profile-pic/${req.from_username}`}
                      alt={req.full_name}
                      className="vm-avatar-img"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                  <div className="vm-match-info">
                    <div className="vm-match-name">{req.full_name}</div>
                    <div className="vm-match-meta">
                      {req.age && <span>{req.age} yrs</span>}
                      {req.location && <span> · {req.location}</span>}
                    </div>
                    {req.profession && (
                      <div className="vm-match-profession">{req.profession}</div>
                    )}
                  </div>
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
                  <div className="vm-room-partner">
                    <img
                      src={`${getBackendUrl()}/profile-pic/${room.partner_username}`}
                      alt={room.partner_name}
                      className="vm-avatar-img vm-avatar-sm"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <span>{room.partner_name}</span>
                  </div>
                  <div className={`vm-room-status vm-status-${room.status}`}>
                    {room.status === 'confirmed' ? '✅ Confirmed' :
                     room.status === 'active' ? '🟢 Active' : room.status}
                  </div>
                  {room.zoom_link && (
                    <a href={room.zoom_link} target="_blank" rel="noopener noreferrer" className="vm-btn vm-btn-zoom">
                      Join Zoom
                    </a>
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
                  <div className="vm-match-avatar">
                    <img
                      src={`${getBackendUrl()}/profile-pic/${match.username}`}
                      alt={match.full_name}
                      className="vm-avatar-img"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                  <div className="vm-match-info">
                    <div className="vm-match-name">{match.full_name}</div>
                    <div className="vm-match-meta">
                      {match.age && <span>{match.age} yrs</span>}
                      {match.location && <span> · {match.location}</span>}
                    </div>
                    {match.profession && (
                      <div className="vm-match-profession">{match.profession}</div>
                    )}
                  </div>
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
                        ✅ Room Confirmed
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

          {/* Manual Pair */}
          <div className="vm-admin-pair">
            <h4>Force Pair Users</h4>
            <div className="vm-admin-pair-inputs">
              <input
                type="text"
                placeholder="Username A"
                value={pairUserA}
                onChange={(e) => setPairUserA(e.target.value)}
                className="vm-input"
              />
              <span className="vm-pair-arrow">↔</span>
              <input
                type="text"
                placeholder="Username B"
                value={pairUserB}
                onChange={(e) => setPairUserB(e.target.value)}
                className="vm-input"
              />
              <button className="vm-btn vm-btn-primary" onClick={handleAdminPair}>
                Pair
              </button>
            </div>
          </div>

          {/* Expire Rooms */}
          <div className="vm-admin-action-row">
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
                    <th>#</th>
                    <th>User A</th>
                    <th>User B</th>
                    <th>Status</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {ov.rooms.map(room => (
                    <tr key={room._id}>
                      <td>{room.room_number}</td>
                      <td>{room.user_a}</td>
                      <td>{room.user_b}</td>
                      <td><span className={`vm-status-badge vm-badge-${room.status === 'confirmed' ? 'accepted' : room.status === 'active' ? 'accepted' : 'declined'}`}>{room.status}</span></td>
                      <td>{room.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Participants List */}
        {ov.participants && ov.participants.length > 0 && (
          <div className="vm-section">
            <h3 className="vm-section-title">👥 Participants ({ov.participants.length})</h3>
            <div className="vm-admin-table-wrapper">
              <table className="vm-admin-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Gender</th>
                    <th>Payment</th>
                    <th>Access</th>
                  </tr>
                </thead>
                <tbody>
                  {ov.participants.map(p => (
                    <tr key={p._id}>
                      <td>{p.username}</td>
                      <td>{p.gender}</td>
                      <td><span className={`vm-status-badge vm-badge-${p.payment_status === 'completed' ? 'accepted' : p.payment_status === 'not_required' ? 'accepted' : 'pending'}`}>{p.payment_status}</span></td>
                      <td>{p.access_unlocked ? '✅' : '🔒'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Main Render ─────────────────────────────────────────────────────

  return (
    <div className="vm-container">
      <div className="vm-page-header">
        <h1 className="vm-page-title">🎥 Virtual Meets</h1>
        <p className="vm-page-subtitle">Match with participants and connect in 1:1 virtual rooms</p>
      </div>

      {adminView ? renderAdminOverview() : selectedEvent ? renderMatchList() : renderEventsList()}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default VirtualMeets;
