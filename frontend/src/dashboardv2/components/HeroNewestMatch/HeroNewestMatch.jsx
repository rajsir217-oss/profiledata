import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../api';
import useToast from '../../../hooks/useToast';
import { formatRelativeTime } from '../../../utils/timeFormatter';
import './HeroNewestMatch.css';

const getProfileImage = (profile) => {
  const img =
    profile?.profileImage ||
    (Array.isArray(profile?.publicImages) && profile.publicImages[0]) ||
    (Array.isArray(profile?.images) && profile.images[0]) ||
    null;
  return img || null;
};

const getDisplayName = (profile) => {
  if (!profile) return '';
  const first = profile.firstName || '';
  const lastInitial = profile.lastName ? `${profile.lastName[0]}.` : '';
  const combined = `${first} ${lastInitial}`.trim();
  return combined || profile.username || '';
};

const HeroNewestMatch = ({
  pick,
  loading,
  error,
  isEmpty,
  onSkip,
  onOpenSearch,
  favoritedUsernames,
  onRefresh,
  onRetry,
}) => {
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const profile = pick?.profile || null;
  const savedSearch = pick?.savedSearch || null;

  const isFavorited = useMemo(() => {
    if (!profile?.username) return false;
    if (!favoritedUsernames) return false;
    return favoritedUsernames.has(profile.username);
  }, [favoritedUsernames, profile?.username]);

  const joinedTime = profile?.createdAt ? formatRelativeTime(profile.createdAt) : null;
  const score = profile?.l3v3lScore || profile?.l3v3l_score || profile?.matchScore || null;

  const handleFavoriteToggle = async () => {
    if (!profile?.username) return;
    try {
      setBusy(true);
      if (isFavorited) {
        await api.delete(`/favorites/${profile.username}`);
        toast.info('Removed from favorites');
      } else {
        await api.post(`/favorites/${profile.username}`);
        toast.success('Added to favorites');
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to update favorites');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="dv2-hero-card dv2-hero-card-loading">
        <div className="dv2-hero-skeleton" />
        <div className="dv2-hero-skeleton" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="dv2-hero-card dv2-hero-empty">
        <div className="dv2-hero-empty-title">Could not load newest match</div>
        <div className="dv2-hero-empty-sub">
          Please try again in a moment.
        </div>
        <div className="dv2-hero-actions">
          <button
            className="dv2-btn dv2-btn-primary"
            type="button"
            onClick={() => onRetry?.()}
          >
            Retry
          </button>
          <button
            className="dv2-btn dv2-btn-link"
            type="button"
            onClick={() => onOpenSearch?.()}
          >
            Open search
          </button>
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="dv2-hero-card dv2-hero-empty">
        <div className="dv2-hero-empty-title">No new joiners right now</div>
        <div className="dv2-hero-empty-sub">
          Try running one of your saved searches to see all current matches.
        </div>
        <div className="dv2-hero-actions">
          <button
            className="dv2-btn dv2-btn-primary"
            type="button"
            onClick={() => onOpenSearch?.()}
          >
            Open search
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const photo = getProfileImage(profile);

  return (
    <div className="dv2-hero-card dv2-variant-secondary">
      <div className="dv2-hero-photo" aria-hidden="true">
        {photo ? (
          <img className="dv2-hero-img" src={photo} alt="" />
        ) : (
          <div className="dv2-hero-initials">
            {(profile.firstName?.[0] || profile.username?.[0] || '?').toUpperCase()}
          </div>
        )}
        <span className="dv2-hero-badge">Newest match</span>
      </div>

      <div className="dv2-hero-content">
        <div className="dv2-hero-top">
          <h2 className="dv2-hero-name">{getDisplayName(profile)}</h2>
          {score ? <span className="dv2-hero-score">💎 {Math.round(score)}% match</span> : null}
        </div>

        <div className="dv2-hero-attrs">
          {profile.location ? <span>📍 {profile.location}</span> : null}
          {profile.occupation ? <span>💼 {profile.occupation}</span> : null}
          {profile.height ? <span>🎓 {profile.height}</span> : null}
          {profile.eatingPreference ? <span>🌱 {profile.eatingPreference}</span> : null}
          {joinedTime ? <span>🗓 Joined {joinedTime}</span> : null}
        </div>

        {profile.aboutYou ? (
          <p className="dv2-hero-bio">“{String(profile.aboutYou).slice(0, 160)}”</p>
        ) : null}

        <div className="dv2-hero-why">
          <span className="dv2-hero-why-icon">✨</span>
          <span className="dv2-hero-why-text">
            <strong>Newest profile</strong>
            {savedSearch?.name ? (
              <>
                {' '}matching your saved search <em>“{savedSearch.name}”</em>
              </>
            ) : null}
            {joinedTime ? <> · joined {joinedTime}</> : null}
            {score ? <> · hits {Math.round(score / 10)} of 10 of your preferences</> : null}
          </span>
        </div>
      </div>

      <div className="dv2-hero-actions">
        <button
          className="dv2-btn dv2-btn-primary"
          type="button"
          onClick={() => navigate(`/profile/${encodeURIComponent(profile.username)}`)}
        >
          👁 View full profile
        </button>
        <button
          className="dv2-btn"
          type="button"
          onClick={handleFavoriteToggle}
          disabled={busy}
        >
          <span className="dv2-heart" aria-hidden="true">❤</span> {isFavorited ? 'Unfavorite' : 'Favorite'}
        </button>
        <button
          className="dv2-btn"
          type="button"
          onClick={() => navigate(`/messages?to=${encodeURIComponent(profile.username)}`)}
        >
          💬 Send message
        </button>
        <button className="dv2-btn dv2-btn-ghost" type="button" onClick={onSkip}>
          ⏭ Skip · show next newest
        </button>
        {savedSearch ? (
          <button className="dv2-btn dv2-btn-link" type="button" onClick={() => onOpenSearch(savedSearch)}>
            View all results
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default HeroNewestMatch;
