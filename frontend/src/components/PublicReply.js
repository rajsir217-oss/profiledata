import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getBackendUrl } from '../config/apiConfig';
import logger from '../utils/logger';
import './PublicReply.css';

const PublicReply = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [context, setContext] = useState(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const loadContext = async () => {
      try {
        const res = await axios.get(
          `${getBackendUrl()}/api/messenger/public-reply/${encodeURIComponent(token)}`
        );
        setContext(res.data);
      } catch (err) {
        const detail = err?.response?.data?.detail || 'Could not load this reply link.';
        setError(detail);
        logger.error('Failed to load public reply context', err);
      } finally {
        setLoading(false);
      }
    };
    loadContext();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!content.trim()) {
      setError('Please enter a reply.');
      return;
    }
    if (content.length > 4000) {
      setError('Reply is too long (max 4000 characters).');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(
        `${getBackendUrl()}/api/messenger/public-reply/${encodeURIComponent(token)}`,
        { content: content.trim() }
      );
      setSuccess(true);
      setContent('');
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Failed to send reply.';
      setError(detail);
      logger.error('Public reply submit failed', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="public-reply-page">
        <div className="public-reply-card">
          <p>Loading reply link…</p>
        </div>
      </div>
    );
  }

  if (error && !context) {
    return (
      <div className="public-reply-page">
        <div className="public-reply-card">
          <h2>Link unavailable</h2>
          <p className="error">{error}</p>
          <button className="btn-secondary" onClick={() => navigate('/')}>Go to home</button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="public-reply-page">
        <div className="public-reply-card">
          <h2>✅ Reply sent</h2>
          <p>Thanks — your message has been delivered to the <strong>{context?.groupName || 'US Vedika'}</strong> group.</p>
          <p>Want to participate fully in future conversations?</p>
          <button
            className="btn-primary"
            onClick={() => navigate(`/register-interest?source=us_vedika&email=${encodeURIComponent(context?.publicEmail || '')}`)}
          >
            Create Free Profile
          </button>
          <button className="btn-secondary" onClick={() => setSuccess(false)}>
            Send another reply
          </button>
        </div>
      </div>
    );
  }

  const original = context?.originalMessage;
  return (
    <div className="public-reply-page">
      <div className="public-reply-card">
        <div className="header">
          <div className="flag">🇺🇸</div>
          <h1>Reply to {context?.groupName || 'US Vedika'}</h1>
          <p className="subtitle">Replying as <strong>{context?.publicEmail}</strong></p>
        </div>

        {original && (
          <div className="original-message">
            <div className="original-header">
              Original message from <strong>{original.senderName}</strong>
            </div>
            <div className="original-content">{original.content}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label htmlFor="reply-content">Your reply</label>
          <textarea
            id="reply-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type your reply…"
            rows={8}
            maxLength={4000}
            disabled={submitting}
          />
          <div className="char-count">{content.length} / 4000</div>

          {error && <p className="error">{error}</p>}

          <div className="actions">
            <button type="submit" className="btn-primary" disabled={submitting || !content.trim()}>
              {submitting ? 'Sending…' : 'Send Reply'}
            </button>
          </div>
        </form>

        <div className="cta-footer">
          <p>💡 Want to post directly without a reply link?</p>
          <button
            className="btn-secondary"
            onClick={() => navigate(`/register-interest?source=us_vedika&email=${encodeURIComponent(context?.publicEmail || '')}`)}
          >
            Create Free Profile
          </button>
        </div>

        <p className="footnote">
          This link expires {context?.expiresAt ? new Date(context.expiresAt).toLocaleDateString() : 'in 7 days'}.
          Uses remaining: {(context?.maxUses ?? 0) - (context?.usedCount ?? 0)}.
        </p>
      </div>
    </div>
  );
};

export default PublicReply;
