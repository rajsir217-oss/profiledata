import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import api from '../../../api';
import { getBackendUrl } from '../../../config/apiConfig';
import logger from '../../../utils/logger';
import './DashboardBanners.css';

const getUsername = () => localStorage.getItem('username');

const isNonEmptyValue = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
};

const hasAnyPhoto = (profile) => {
  if (!profile) return false;
  if (isNonEmptyValue(profile.profileImage)) return true;
  if (Array.isArray(profile.images) && profile.images.some(isNonEmptyValue)) return true;
  if (Array.isArray(profile.publicImages) && profile.publicImages.some(isNonEmptyValue)) return true;
  return false;
};

const DashboardBanners = ({
  userProfile,
  onRefreshProfile,
  onRefreshExclusions,
  enabled = true,
  deferMs = 0,
}) => {
  const navigate = useNavigate();

  const noPhotoLoginRemaining = useMemo(() => {
    if (!userProfile) return null;
    const roleRaw = String(userProfile?.role_name || userProfile?.role || '').toLowerCase();
    const isPrivileged = roleRaw === 'admin' || roleRaw === 'moderator' || userProfile?.username === 'admin';
    if (isPrivileged) return null;

    const rawCount =
      userProfile?.noPhotoLoginCount ??
      userProfile?.metaFields?.noPhotoLoginCount ??
      userProfile?.security?.noPhotoLoginCount ??
      null;

    const count = Number(rawCount);
    if (!Number.isFinite(count)) return null;
    return Math.max(10 - count, 0);
  }, [userProfile]);

  const [mfaWarning, setMfaWarning] = useState(null);
  const [showMfaNotification, setShowMfaNotification] = useState(false);

  const [photoReminderDismissed, setPhotoReminderDismissed] = useState(() => {
    const current = getUsername();
    if (!current) return false;
    return sessionStorage.getItem(`photoReminderDismissed:${current}`) === 'true';
  });

  const [showInviteFriendsBanner, setShowInviteFriendsBanner] = useState(false);
  const [inviteFriendsRemaining, setInviteFriendsRemaining] = useState(null);

  const [pauseStatus, setPauseStatus] = useState(null);

  const [reconnectRequests, setReconnectRequests] = useState([]);
  const [respondingToReconnectId, setRespondingToReconnectId] = useState(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('mfa_warning');
    if (!raw) return;
    try {
      setMfaWarning(JSON.parse(raw));
    } catch (err) {
      logger.error('Failed to parse mfa_warning from sessionStorage:', err);
    } finally {
      sessionStorage.removeItem('mfa_warning');
    }
  }, []);

  const authHeaders = useCallback(() => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  }), []);

  const checkMfaStatus = useCallback(async () => {
    const current = getUsername();
    if (!current) return { showMfa: false };

    const dismissedKey = `mfaNotificationDismissed:${current}`;
    const dismissed = sessionStorage.getItem(dismissedKey);
    if (dismissed === 'true') return { showMfa: false };

    try {
      const { data } = await axios.get(`${getBackendUrl()}/api/auth/mfa/status`, {
        headers: authHeaders(),
      });
      return { showMfa: !data?.mfa_enabled };
    } catch (err) {
      logger.error('Error checking MFA status:', err);
      return { showMfa: false };
    }
  }, [authHeaders]);

  const loadInviteFriendsStats = useCallback(async () => {
    const current = getUsername();
    if (!current) return { remaining: null, show: false };

    const dismissedKey = `inviteFriendsBannerDismissed:${current}`;
    const dismissed = sessionStorage.getItem(dismissedKey);
    if (dismissed === 'true') return { remaining: null, show: false };

    try {
      const { data } = await axios.get(`${getBackendUrl()}/api/user-invitations/stats`, {
        headers: authHeaders(),
      });
      const remaining = data?.remaining;
      const remainingInt = Number.isFinite(remaining) ? remaining : parseInt(remaining, 10);
      const safeRemaining = Number.isFinite(remainingInt) ? remainingInt : 0;
      return { remaining: safeRemaining, show: safeRemaining > 0 };
    } catch (err) {
      logger.debug('Invite friends stats unavailable:', err);
      return { remaining: null, show: false };
    }
  }, [authHeaders]);

  const loadPauseStatus = useCallback(async () => {
    try {
      const { data } = await axios.get(`${getBackendUrl()}/api/account/pause-status`, {
        headers: authHeaders(),
      });
      return data;
    } catch (err) {
      logger.error('Error loading pause status:', err);
      return null;
    }
  }, [authHeaders]);

  const loadReconnectRequests = useCallback(async () => {
    try {
      const { data } = await api.get('/exclusions/reconnect-requests/pending');
      return data?.requests || [];
    } catch (err) {
      logger.debug('Reconnect requests unavailable:', err);
      return [];
    }
  }, []);

  // Batch all 4 banner-data fetches into one render transition to avoid
  // banner area growing/shrinking multiple times as each request resolves.
  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;
    const delay = Number.isFinite(deferMs) ? Math.max(0, deferMs) : 0;

    (async () => {
      if (delay > 0) {
        await new Promise((resolve) => {
          setTimeout(resolve, delay);
        });
        if (cancelled) return;
      }

      const [mfaRes, inviteRes, pauseRes, reconnectRes] = await Promise.all([
        checkMfaStatus(),
        loadInviteFriendsStats(),
        loadPauseStatus(),
        loadReconnectRequests(),
      ]);
      if (cancelled) return;
      // Single batched state update so banners appear atomically.
      setShowMfaNotification(!!mfaRes?.showMfa);
      setInviteFriendsRemaining(inviteRes?.remaining ?? null);
      setShowInviteFriendsBanner(!!inviteRes?.show);
      setPauseStatus(pauseRes || null);
      setReconnectRequests(reconnectRes || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    checkMfaStatus,
    deferMs,
    enabled,
    loadInviteFriendsStats,
    loadPauseStatus,
    loadReconnectRequests,
  ]);

  // Derived synchronously to avoid an extra render where userProfile is
  // present but the photo-reminder state hasn't been recomputed yet.
  const showPhotoReminder =
    !photoReminderDismissed && !!userProfile && !hasAnyPhoto(userProfile);

  const handleDismissMfaNotification = useCallback(() => {
    setShowMfaNotification(false);
    const current = getUsername();
    if (!current) return;
    const dismissedKey = `mfaNotificationDismissed:${current}`;
    sessionStorage.setItem(dismissedKey, 'true');
  }, []);

  const handleEnableMfa = useCallback(() => {
    navigate('/preferences?tab=security');
    setShowMfaNotification(false);
  }, [navigate]);

  const handleDismissPhotoReminder = useCallback(() => {
    setPhotoReminderDismissed(true);
    const current = getUsername();
    if (!current) return;
    const dismissedKey = `photoReminderDismissed:${current}`;
    sessionStorage.setItem(dismissedKey, 'true');
  }, []);

  const handleUploadPhotos = useCallback(() => {
    navigate('/edit-profile');
    setPhotoReminderDismissed(true);
  }, [navigate]);

  const handleInviteFriends = useCallback(() => {
    setShowInviteFriendsBanner(false);
    navigate('/invite-friends', { state: { openModal: true } });
  }, [navigate]);

  const handleRemindInviteFriendsLater = useCallback(() => {
    setShowInviteFriendsBanner(false);
    const current = getUsername();
    if (!current) return;
    const dismissedKey = `inviteFriendsBannerDismissed:${current}`;
    sessionStorage.setItem(dismissedKey, 'true');
  }, []);

  const handleUnpause = useCallback(async () => {
    try {
      await axios.post(
        `${getBackendUrl()}/api/account/unpause`,
        {},
        { headers: authHeaders() }
      );
      const fresh = await loadPauseStatus();
      setPauseStatus(fresh || null);
      if (onRefreshProfile) await onRefreshProfile();
    } catch (err) {
      logger.error('Error unpausing account:', err);
    }
  }, [authHeaders, loadPauseStatus, onRefreshProfile]);

  const handleReconnectResponse = useCallback(async (requestId, action) => {
    setRespondingToReconnectId(requestId);
    try {
      await api.post(`/exclusions/reconnect-requests/${requestId}/respond?action=${action}`);
      setReconnectRequests((prev) => prev.filter((r) => r._id !== requestId));
      if (onRefreshExclusions) await onRefreshExclusions();
    } catch (err) {
      logger.error('Failed to respond to reconnect request:', err);
    } finally {
      setRespondingToReconnectId(null);
    }
  }, [onRefreshExclusions]);

  const remainingInvitesText =
    inviteFriendsRemaining === null
      ? ''
      : `${inviteFriendsRemaining} invitation${inviteFriendsRemaining === 1 ? '' : 's'}`;

  const showAny =
    reconnectRequests.length > 0 ||
    !!mfaWarning ||
    pauseStatus?.isPaused ||
    showMfaNotification ||
    (showInviteFriendsBanner && inviteFriendsRemaining !== null && inviteFriendsRemaining > 0) ||
    showPhotoReminder;

  if (!showAny) return null;

  return (
    <div className="dv2-banners">
      {reconnectRequests.length > 0 ? (
        <div className="dv2-banner dv2-banner--reconnect">
          <div className="dv2-banner-left">
            <div className="dv2-banner-icon">🔔</div>
            <div className="dv2-banner-text">
              <div className="dv2-banner-title">Reconnect requests ({reconnectRequests.length})</div>
              <div className="dv2-banner-subtitle">Someone you excluded wants to reconnect with you.</div>
            </div>
          </div>

          <div className="dv2-banner-body">
            {reconnectRequests.map((r) => (
              <div key={r._id} className="dv2-reconnect-row">
                <div className="dv2-reconnect-meta">
                  <strong>{r.fromName || r.fromUsername}</strong>
                  {r.createdAt ? (
                    <div className="dv2-reconnect-date">{new Date(r.createdAt).toLocaleDateString()}</div>
                  ) : null}
                </div>
                <div className="dv2-reconnect-actions">
                  <button
                    type="button"
                    className="dv2-banner-btn dv2-banner-btn--success"
                    disabled={respondingToReconnectId === r._id}
                    onClick={() => handleReconnectResponse(r._id, 'accept')}
                  >
                    {respondingToReconnectId === r._id ? '…' : '✓ Unblock'}
                  </button>
                  <button
                    type="button"
                    className="dv2-banner-btn dv2-banner-btn--ghost"
                    disabled={respondingToReconnectId === r._id}
                    onClick={() => handleReconnectResponse(r._id, 'decline')}
                  >
                    {respondingToReconnectId === r._id ? '…' : '✕ Decline'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {mfaWarning ? (
        <div className="dv2-banner dv2-banner--warning">
          <div className="dv2-banner-left">
            <div className="dv2-banner-icon">⚠️</div>
            <div className="dv2-banner-text">
              <div className="dv2-banner-title">MFA configuration incomplete</div>
              <div className="dv2-banner-subtitle">{mfaWarning.message}</div>
            </div>
          </div>
          <div className="dv2-banner-actions">
            <button
              type="button"
              className="dv2-banner-btn dv2-banner-btn--primary"
              onClick={() => {
                navigate('/edit-profile');
                setMfaWarning(null);
              }}
            >
              📝 Update profile
            </button>
            <button type="button" className="dv2-banner-btn dv2-banner-btn--ghost" onClick={() => setMfaWarning(null)}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {pauseStatus?.isPaused ? (
        <div className="dv2-banner dv2-banner--pause">
          <div className="dv2-banner-left">
            <div className="dv2-banner-icon">⏸️</div>
            <div className="dv2-banner-text">
              <div className="dv2-banner-title">Your profile is paused</div>
              <div className="dv2-banner-subtitle">
                {pauseStatus.pausedUntil
                  ? `Your profile will automatically unpause on ${new Date(pauseStatus.pausedUntil).toLocaleDateString()}.`
                  : "You're taking a break. Ready to return?"}
              </div>
            </div>
          </div>
          <div className="dv2-banner-actions">
            <button type="button" className="dv2-banner-btn dv2-banner-btn--primary" onClick={handleUnpause}>
              ▶️ Un-pause now
            </button>
          </div>
        </div>
      ) : null}

      {showMfaNotification ? (
        <div className="dv2-banner dv2-banner--mfa">
          <div className="dv2-banner-left">
            <div className="dv2-banner-icon">🔐</div>
            <div className="dv2-banner-text">
              <div className="dv2-banner-title">Secure your account with Multi-Factor Authentication</div>
              <div className="dv2-banner-subtitle">Add an extra layer of security by enabling MFA. It only takes a minute!</div>
            </div>
          </div>
          <div className="dv2-banner-actions">
            <button type="button" className="dv2-banner-btn dv2-banner-btn--inverse" onClick={handleEnableMfa}>
              Enable MFA
            </button>
            <button
              type="button"
              className="dv2-banner-close"
              onClick={handleDismissMfaNotification}
              title="Don't show this again"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}

      {showInviteFriendsBanner && inviteFriendsRemaining !== null && inviteFriendsRemaining > 0 ? (
        <div className="dv2-banner dv2-banner--invite">
          <div className="dv2-banner-left">
            <div className="dv2-banner-icon">🎟️</div>
            <div className="dv2-banner-text">
              <div className="dv2-banner-title">You have {remainingInvitesText} to send</div>
              <div className="dv2-banner-subtitle">Invite your friends or family to create a profile.</div>
            </div>
          </div>
          <div className="dv2-banner-actions">
            <button type="button" className="dv2-banner-btn dv2-banner-btn--primary" onClick={handleInviteFriends}>
              Invite friends
            </button>
            <button type="button" className="dv2-banner-btn dv2-banner-btn--ghost" onClick={handleRemindInviteFriendsLater}>
              Remind me later
            </button>
          </div>
        </div>
      ) : null}

      {showPhotoReminder ? (
        <div className="dv2-banner dv2-banner--photo">
          <div className="dv2-banner-left">
            <div className="dv2-banner-icon">📸</div>
            <div className="dv2-banner-text">
              <div className="dv2-banner-title">Your profile is hidden from most search results</div>
              <div className="dv2-banner-subtitle">
                Upload at least one photo to appear in search results and get more views.
              </div>
              {noPhotoLoginRemaining !== null ? (
                <div className="dv2-banner-subtitle dv2-banner-subtitle--alert">
                  ⚠️ Warning: Your profile will be deactivated after {noPhotoLoginRemaining} more login{noPhotoLoginRemaining === 1 ? '' : 's'} without a photo.
                </div>
              ) : null}
            </div>
          </div>
          <div className="dv2-banner-actions">
            <button type="button" className="dv2-banner-btn dv2-banner-btn--inverse" onClick={handleUploadPhotos}>
              Upload photos
            </button>
            <button
              type="button"
              className="dv2-banner-close"
              onClick={handleDismissPhotoReminder}
              title="Don't show this again"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DashboardBanners;
