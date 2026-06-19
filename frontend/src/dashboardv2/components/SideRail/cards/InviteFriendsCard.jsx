import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { getBackendUrl } from '../../../../config/apiConfig';
import './InviteFriendsCard.css';

const DEFAULT_SUBJECT = "You're Invited to Join USVedika for US Citizens & GC Holders";

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  channel: 'email',
  emailSubject: DEFAULT_SUBJECT,
  customMessage: '',
  sendImmediately: true,
};

const InviteFriendsCard = () => {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [userPromoCode, setUserPromoCode] = useState('USVEDIKA');

  useEffect(() => {
    const fetchPromoCode = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${getBackendUrl()}/api/promo-codes/my-code`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.code) setUserPromoCode(data.code);
        }
      } catch (_) {}
    };
    fetchPromoCode();
  }, []);

  const handleOpen = () => {
    setForm(EMPTY_FORM);
    setError('');
    setSuccess(false);
    setShowModal(true);
  };

  const handleClose = () => setShowModal(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and Email are required.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        ...form,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        emailSubject: form.emailSubject.trim() || DEFAULT_SUBJECT,
        customMessage: form.customMessage.trim() || undefined,
        promoCode: userPromoCode,
      };
      const response = await fetch(`${getBackendUrl()}/api/user-invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        setSuccess(true);
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data?.detail || 'Failed to send invitation. Please try again.');
      }
    } catch (_) {
      setError('Failed to send invitation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const modal = showModal && ReactDOM.createPortal(
    <div className="dv2-invite-overlay" onClick={handleClose}>
      <div className="dv2-invite-modal" onClick={e => e.stopPropagation()}>
        <div className="dv2-invite-modal-header">
          <span>🤝 Invite Someone</span>
          <button className="dv2-invite-close" type="button" onClick={handleClose}>✕</button>
        </div>

        {success ? (
          <div className="dv2-invite-success">
            <p>✅ Invitation sent successfully!</p>
            <button className="dv2-invite-cta primary" type="button" onClick={() => { setSuccess(false); setForm(EMPTY_FORM); }}>
              Invite Another
            </button>
            <button className="dv2-invite-cta" type="button" onClick={handleClose} style={{ marginTop: '8px' }}>
              Close
            </button>
          </div>
        ) : (
          <form className="dv2-invite-form" onSubmit={handleSubmit}>
            <div className="dv2-invite-field">
              <label>Name <span className="dv2-invite-req">*</span></label>
              <input name="name" type="text" placeholder="Friend's name" value={form.name} onChange={handleChange} required />
            </div>
            <div className="dv2-invite-field">
              <label>Email <span className="dv2-invite-req">*</span></label>
              <input name="email" type="email" placeholder="friend@example.com" value={form.email} onChange={handleChange} required />
            </div>
            <div className="dv2-invite-field">
              <label>Phone <span className="dv2-invite-optional">(Optional)</span></label>
              <input name="phone" type="tel" placeholder="+1 234 567 8900" value={form.phone} onChange={handleChange} />
            </div>
            <div className="dv2-invite-field">
              <label>Email Subject <span className="dv2-invite-req">*</span></label>
              <input name="emailSubject" type="text" value={form.emailSubject} onChange={handleChange} required />
            </div>
            <div className="dv2-invite-field">
              <label>Personal Message <span className="dv2-invite-optional">(Optional)</span></label>
              <textarea name="customMessage" rows={3} placeholder="Add a personal note to your invitation..." value={form.customMessage} onChange={handleChange} />
              <small className="dv2-invite-tip">💡 Tip: Add a personal touch to encourage them to join!</small>
            </div>

            {error && <p className="dv2-invite-error">{error}</p>}

            <div className="dv2-invite-modal-actions">
              <button type="button" className="dv2-invite-cta" onClick={handleClose}>Cancel</button>
              <button type="submit" className="dv2-invite-cta primary" disabled={submitting}>
                {submitting ? 'Sending…' : '� Send Invitation'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );

  return (
    <>
      <div className="dv2-rail-card">
        <div className="dv2-rail-title">
          <span className="dv2-rail-title-left">🤝 Invite Friends</span>
        </div>
        <p className="dv2-invite-body">
          Know someone looking for a match? Invite them to join the platform!
        </p>
        <div className="dv2-invite-actions">
          <button className="dv2-invite-cta primary" type="button" onClick={handleOpen}>
            📨 Send Invite
          </button>
        </div>
      </div>
      {modal}
    </>
  );
};

export default InviteFriendsCard;
