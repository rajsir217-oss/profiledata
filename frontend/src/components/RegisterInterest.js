import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getBackendUrl } from '../config/apiConfig';
import logger from '../utils/logger';
import './RegisterInterest.css';

const RegisterInterest = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    registeringFor: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    linkedInUrl: '',
    refFirstName: '',
    refLastName: '',
    refPhone: '',
    refEmail: '',
    residencyStatus: '',
    howDidYouHear: '',
    howDidYouHearOther: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Ref for auto-focusing the promo code input
  const howDidYouHearOtherRef = useRef(null);
  const firstNameRef = useRef(null);

  // Track if promo code is present to conditionally auto-focus
  const [hasPromoCode, setHasPromoCode] = useState(false);

  // US Vedika invitation params
  const [source, setSource] = useState(null);
  const [sourceConversationId, setSourceConversationId] = useState(null);
  const [invitedBy, setInvitedBy] = useState(null);

  // ESC key to go back
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') navigate('/');
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [navigate]);

  // Parse query params for US Vedika invitation and promo code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    const sourceParam = params.get('source');
    const cidParam = params.get('cid');
    const invitedByParam = params.get('invitedBy');
    const tokenParam = params.get('token'); // for future validation
    const promoCodeParam = params.get('promo') || params.get('promoCode');

    if (emailParam) {
      setFormData(prev => ({ ...prev, email: emailParam }));
    }

    // Pre-fill "How did you hear about us?" if promo code is present
    if (promoCodeParam) {
      setFormData(prev => ({
        ...prev,
        howDidYouHear: 'other',
        howDidYouHearOther: promoCodeParam
      }));
      setHasPromoCode(true);
      logger.info('Promo code detected in URL', { promoCode: promoCodeParam });
    } else {
      // No promo code - will focus firstName in separate effect
      setHasPromoCode(false);
    }

    if (sourceParam === 'us_vedika') {
      setSource(sourceParam);
      setSourceConversationId(cidParam);
      setInvitedBy(invitedByParam);
      logger.info('US Vedika invitation detected', { source: sourceParam, cid: cidParam, invitedBy: invitedByParam });
    }
  }, []);

  // Handle focus after state is set
  useEffect(() => {
    if (hasPromoCode && formData.howDidYouHear === 'other') {
      // Focus promo code field after it renders
      setTimeout(() => {
        if (howDidYouHearOtherRef.current) {
          howDidYouHearOtherRef.current.focus();
        }
      }, 200);
    } else if (!hasPromoCode && firstNameRef.current) {
      // Focus firstName when no promo code
      setTimeout(() => {
        if (firstNameRef.current) {
          firstNameRef.current.focus();
        }
      }, 100);
    }
  }, [hasPromoCode, formData.howDidYouHear]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Basic validation
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('First name and last name are required.');
      return;
    }
    if (!formData.email.trim()) {
      setError('Email is required.');
      return;
    }
    if (!formData.phone.trim()) {
      setError('Phone number is required.');
      return;
    }
    const phoneDigits = formData.phone.trim().replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }
    if (!formData.registeringFor) {
      setError('Please select who you are registering for.');
      return;
    }
    if (!formData.residencyStatus) {
      setError('Please select your residency status.');
      return;
    }
    // LinkedIn URL validation (optional but must be valid URL if provided)
    if (formData.linkedInUrl.trim()) {
      const urlPattern = /^https?:\/\/(www\.)?linkedin\.com\/.*/i;
      if (!urlPattern.test(formData.linkedInUrl.trim())) {
        setError('Please enter a valid LinkedIn URL (e.g., https://www.linkedin.com/in/username)');
        return;
      }
    }

    setSubmitting(true);
    try {
      // Also validate referrer phone if provided
      if (formData.refPhone.trim()) {
        const refPhoneDigits = formData.refPhone.trim().replace(/\D/g, '');
        if (refPhoneDigits.length < 10) {
          setError('Please enter a valid 10-digit referrer phone number.');
          setSubmitting(false);
          return;
        }
      }

      const payload = {
        registeringFor: formData.registeringFor,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        linkedInUrl: formData.linkedInUrl.trim() || null,
        residencyStatus: formData.residencyStatus,
        referredBy: (formData.refFirstName || formData.refLastName || formData.refPhone || formData.refEmail) ? {
          firstName: formData.refFirstName.trim(),
          lastName: formData.refLastName.trim(),
          phone: formData.refPhone.trim(),
          email: formData.refEmail.trim()
        } : null,
        howDidYouHear: formData.howDidYouHear === 'other'
          ? (formData.howDidYouHearOther.trim() || 'Other')
          : (formData.howDidYouHear || null),
        // US Vedika invitation params
        source: source || null,
        sourceConversationId: sourceConversationId || null,
        invitedBy: invitedBy || null,
      };

      await axios.post(`${getBackendUrl()}/api/registration-interest`, payload);
      setSubmitted(true);
      logger.info('Registration interest submitted successfully');
    } catch (err) {
      const detail = err.response?.data?.detail || 'Something went wrong. Please try again.';
      setError(detail);
      logger.error('Registration interest submission failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Success state
  if (submitted) {
    return (
      <div className="ri-page">
        <div className="ri-container">
          <div className="ri-success">
            <div className="ri-success-icon">✅</div>
            <h2>Thank You!</h2>
            <p>Your interest has been submitted. Our team will review your information and get back to you soon.</p>
            <p className="ri-success-note">You'll receive an email invitation once your submission is approved.</p>
            <button className="ri-btn ri-btn-secondary" onClick={() => navigate('/')}>
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ri-page">
      <div className="ri-container">
        {/* Header */}
        <div className="ri-header">
          <button className="ri-back-btn" onClick={() => navigate('/')} title="Back to Home">
            ← Back
          </button>
          <div className="ri-header-text">
            <h1>📋 Register Your Interest</h1>
            <p>Tell us about yourself. We'll review your submission and send you an invitation to create your profile.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="ri-form">
          {/* Eligibility Notice */}
          <div className="ri-notice">
            🇺🇸🇮🇳 This platform is exclusively for individuals of <strong>Indian origin</strong> who are <strong>US Citizens</strong> or <strong>Green Card (Permanent Resident) holders</strong>. By submitting this form, you confirm that you meet this requirement.
          </div>

          {/* How Did You Hear About Us */}
          <div className="ri-section">
            <h3 className="ri-section-title">How did you hear about us?</h3>
            <div className="ri-field">
              <select
                name="howDidYouHear"
                value={formData.howDidYouHear}
                onChange={handleChange}
                className="ri-select"
              >
                <option value="">Select an option</option>
                <option value="friend_family">Friend or Family Member</option>
                <option value="community_event">Community Event / Gathering</option>
                <option value="social_media">Social Media (Facebook, Instagram, etc.)</option>
                <option value="temple_organization">Temple / Cultural Organization</option>
                <option value="online_search">Online Search (Google, etc.)</option>
                <option value="word_of_mouth">Word of Mouth</option>
                <option value="other">Other</option>
              </select>
            </div>
            {formData.howDidYouHear === 'other' && (
              <div className="ri-field" style={{ marginTop: '10px' }}>
                <input
                  ref={howDidYouHearOtherRef}
                  name="howDidYouHearOther"
                  type="text"
                  value={formData.howDidYouHearOther}
                  onChange={handleChange}
                  placeholder="Please specify..."
                  maxLength={200}
                />
              </div>
            )}
          </div>

          {/* Who Are You Registering For */}
          <div className="ri-section">
            <h3 className="ri-section-title">I am registering for *</h3>
            <div className="ri-radio-group ri-radio-grid-4">
              <label className={`ri-radio-option ${formData.registeringFor === 'myself' ? 'ri-radio-selected' : ''}`}>
                <input
                  type="radio"
                  name="registeringFor"
                  value="myself"
                  checked={formData.registeringFor === 'myself'}
                  onChange={handleChange}
                />
                <span className="ri-radio-label">Myself</span>
              </label>
              <label className={`ri-radio-option ${formData.registeringFor === 'my_son' ? 'ri-radio-selected' : ''}`}>
                <input
                  type="radio"
                  name="registeringFor"
                  value="my_son"
                  checked={formData.registeringFor === 'my_son'}
                  onChange={handleChange}
                />
                <span className="ri-radio-label">Son</span>
              </label>
              <label className={`ri-radio-option ${formData.registeringFor === 'my_daughter' ? 'ri-radio-selected' : ''}`}>
                <input
                  type="radio"
                  name="registeringFor"
                  value="my_daughter"
                  checked={formData.registeringFor === 'my_daughter'}
                  onChange={handleChange}
                />
                <span className="ri-radio-label">Daughter</span>
              </label>
            </div>
          </div>

          {/* Residency Status */}
          <div className="ri-section">
            <h3 className="ri-section-title">Residency Status *</h3>
            <div className="ri-radio-group">
              <label className={`ri-radio-option ${formData.residencyStatus === 'us_citizen' ? 'ri-radio-selected' : ''}`}>
                <input
                  type="radio"
                  name="residencyStatus"
                  value="us_citizen"
                  checked={formData.residencyStatus === 'us_citizen'}
                  onChange={handleChange}
                />
                <span className="ri-radio-label">🇺🇸 US Citizen</span>
              </label>
              <label className={`ri-radio-option ${formData.residencyStatus === 'green_card' ? 'ri-radio-selected' : ''}`}>
                <input
                  type="radio"
                  name="residencyStatus"
                  value="green_card"
                  checked={formData.residencyStatus === 'green_card'}
                  onChange={handleChange}
                />
                <span className="ri-radio-label">🪪 Green Card Holder</span>
              </label>
            </div>
          </div>

          {/* Your Information */}
          <div className="ri-section">
            <h3 className="ri-section-title">Your Information</h3>
            <div className="ri-field-row ri-field-row-4">
              <div className="ri-field">
                <label htmlFor="firstName">First Name *</label>
                <input
                  ref={firstNameRef}
                  id="firstName"
                  name="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="First name"
                  required
                />
              </div>
              <div className="ri-field">
                <label htmlFor="lastName">Last Name *</label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Last name"
                  required
                />
              </div>
              <div className="ri-field">
                <label htmlFor="email">Email *</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="your@email.com"
                  required
                />
              </div>
              <div className="ri-field">
                <label htmlFor="phone">Phone *</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="(555) 123-4567"
                  required
                />
              </div>
            </div>
            <div className="ri-field">
              <label htmlFor="linkedInUrl">LinkedIn Profile URL</label>
              <input
                id="linkedInUrl"
                name="linkedInUrl"
                type="url"
                value={formData.linkedInUrl}
                onChange={handleChange}
                placeholder="https://www.linkedin.com/in/username"
              />
              <small className="ri-field-hint">Optional - Helps us verify your professional background</small>
            </div>
          </div>

          {/* Referred By */}
          <div className="ri-section">
            <h3 className="ri-section-title">
              Referred By
              <span className="ri-highly-recommended">Highly Recommended</span>
            </h3>
            <p className="ri-section-desc">
              This is a <strong>community-based platform</strong> built on trust. Providing referral information <strong style={{ color: 'var(--danger-color)' }}>significantly speeds up your verification </strong> and helps maintain the quality of our community.
            </p>
            <div className="ri-field-row ri-field-row-4">
              <div className="ri-field">
                <label htmlFor="refFirstName">Referrer First Name</label>
                <input
                  id="refFirstName"
                  name="refFirstName"
                  type="text"
                  value={formData.refFirstName}
                  onChange={handleChange}
                  placeholder="First name"
                />
              </div>
              <div className="ri-field">
                <label htmlFor="refLastName">Referrer Last Name</label>
                <input
                  id="refLastName"
                  name="refLastName"
                  type="text"
                  value={formData.refLastName}
                  onChange={handleChange}
                  placeholder="Last name"
                />
              </div>
              <div className="ri-field">
                <label htmlFor="refEmail">Referrer Email</label>
                <input
                  id="refEmail"
                  name="refEmail"
                  type="email"
                  value={formData.refEmail}
                  onChange={handleChange}
                  placeholder="referrer@email.com"
                />
              </div>
              <div className="ri-field">
                <label htmlFor="refPhone">Referrer Phone</label>
                <input
                  id="refPhone"
                  name="refPhone"
                  type="tel"
                  value={formData.refPhone}
                  onChange={handleChange}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="ri-error">
              {error}
            </div>
          )}

          {/* Verification Process Info */}
          <div className="ri-process-info">
            <h4 className="ri-process-info-title">📋 What Happens Next?</h4>
            <ul className="ri-process-info-list">
              <li>Once your interest is verified, you will receive an invitation from <strong>www.l3v3lmatches.com</strong></li>
              <li>Click on "Create Profile" or paste the URL in your browser</li>
              <li>Complete the profile creation process</li>
              <li>Our admin team will review your profile and activate it</li>
              <li>You will receive an email confirming your profile is active</li>
              <li>Then you can login, search profiles, and access all platform features</li>
            </ul>
          </div>

          {/* Submit */}
          <div className="ri-actions">
            <button
              type="submit"
              className="ri-btn ri-btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Interest'}
            </button>
          </div>

          {/* Security note */}
          <div className="ri-security-note">
            🔒 Your data is secure and encrypted. We never share your information with third parties.
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterInterest;
