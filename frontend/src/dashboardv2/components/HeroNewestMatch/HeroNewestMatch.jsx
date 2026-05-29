import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../api';
import useToast from '../../../hooks/useToast';
import { formatRelativeTime } from '../../../utils/timeFormatter';
import { getImageUrl } from '../../../utils/urlHelper';
import './HeroNewestMatch.css';

const getProfileImage = (profile) => {
  const img =
    profile?.profileImage ||
    (Array.isArray(profile?.publicImages) && profile.publicImages[0]) ||
    (Array.isArray(profile?.images) && profile.images[0]) ||
    null;
  return img ? getImageUrl(img) : null;
};

const getDisplayName = (profile) => {
  if (!profile) return '';
  const first = profile.firstName || '';
  const lastInitial = profile.lastName ? `${profile.lastName[0]}.` : '';
  const combined = `${first} ${lastInitial}`.trim();
  return combined || profile.username || '';
};

const formatHeight = (profile) => {
  if (!profile) return null;
  if (profile.height) return String(profile.height);

  const heightInches = profile.heightInches;
  if (Number.isFinite(heightInches)) {
    const feet = Math.floor(heightInches / 12);
    const inches = heightInches % 12;
    return `${feet}'${inches}"`;
  }

  const feet = profile.heightFeet;
  const inches = profile.heightInches;
  if (Number.isFinite(feet) && Number.isFinite(inches)) {
    return `${feet}'${inches}"`;
  }

  return null;
};

const getDobMonthYear = (profile) => {
  if (!profile) return { dob: null, birthMonth: null, birthYear: null };

  if (profile.birthMonth && profile.birthYear) {
    const month = String(profile.birthMonth).padStart(2, '0');
    return {
      dob: `${month}/${profile.birthYear}`,
      birthMonth: Number(profile.birthMonth),
      birthYear: Number(profile.birthYear),
    };
  }

  if (profile.dateOfBirth) {
    try {
      const date = new Date(profile.dateOfBirth);
      if (Number.isNaN(date.getTime())) return { dob: null, birthMonth: null, birthYear: null };
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return {
        dob: `${month}/${date.getFullYear()}`,
        birthMonth: date.getMonth() + 1,
        birthYear: date.getFullYear(),
      };
    } catch {
      return { dob: null, birthMonth: null, birthYear: null };
    }
  }

  return { dob: null, birthMonth: null, birthYear: null };
};

const calculateAge = ({ birthMonth, birthYear }) => {
  if (!birthYear) return null;
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  let age = currentYear - birthYear;
  if (birthMonth && currentMonth < birthMonth) {
    age -= 1;
  }
  if (!Number.isFinite(age) || age <= 0) return null;
  return age;
};

const normalizeEducation = (profile) => {
  const list = Array.isArray(profile?.educationHistory) ? profile.educationHistory : [];
  const items = [];

  for (const edu of list) {
    const degree = (edu?.degree || '').trim();
    const institution = (edu?.institution || '').trim();
    const text = degree && institution ? `${degree}, ${institution}` : degree || institution;
    if (text) items.push(text);
    if (items.length >= 2) break;
  }

  return items;
};

const normalizeOccupation = (profile) => {
  const direct = (profile?.occupation || '').trim();
  if (direct) return direct;

  const list = Array.isArray(profile?.workExperience) ? profile.workExperience : [];
  const current = list.find(
    (job) => job?.isCurrent === true || String(job?.status || '').toLowerCase() === 'current'
  );
  const job = current || list[0] || null;
  const text = (job?.description || job?.position || job?.title || '').trim();
  return text || null;
};

const generateHeroLookingForSummary = (profile) => {
  if (!profile) return '';
  const criteria = profile.partnerCriteria || profile;
  const parts = [];

  if (criteria.educationLevel) {
    const eduArray = Array.isArray(criteria.educationLevel) ? criteria.educationLevel : [criteria.educationLevel];
    const first = eduArray.find((e) => String(e || '').trim());
    if (first) parts.push(String(first));
  }

  if (criteria.profession) {
    const profArray = Array.isArray(criteria.profession) ? criteria.profession : [criteria.profession];
    const first = profArray.find(
      (p) => String(p || '').trim() && !['any', 'no preference'].includes(String(p).trim().toLowerCase())
    );
    if (first) parts.push(String(first));
  }

  const loc = criteria.location || criteria.partnerLocation;
  if (loc) {
    const locArray = Array.isArray(loc) ? loc : [loc];
    const raw = locArray.find((l) => String(l || '').trim());
    if (raw) {
      const text = String(raw);
      if (['any', 'any location', 'no preference'].includes(text.trim().toLowerCase())) {
        parts.push('Any Location');
      } else {
        parts.push(text);
      }
    }
  }

  return parts.join(', ');
};

const HeroNewestMatch = ({
  pick,
  loading,
  error,
  isEmpty,
  onSkip,
  onOpenSearch,
  favoritedUsernames,
  onRefreshFavorites,
  onFavoriteOptimistic,
  onRetry,
}) => {
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);

  const profile = pick?.profile || null;
  const savedSearch = pick?.savedSearch || null;

  const photo = profile ? getProfileImage(profile) : null;

  useEffect(() => {
    setPhotoFailed(false);
  }, [photo]);

  const isFavorited = useMemo(() => {
    if (!profile?.username) return false;
    if (!favoritedUsernames) return false;
    return favoritedUsernames.has(profile.username);
  }, [favoritedUsernames, profile?.username]);

  const joinedTime = profile?.createdAt ? formatRelativeTime(profile.createdAt) : null;
  const score = profile?.l3v3lScore || profile?.l3v3l_score || profile?.matchScore || null;

  const heightText = formatHeight(profile);
  const { dob, birthMonth, birthYear } = getDobMonthYear(profile);
  const age = profile?.age || calculateAge({ birthMonth, birthYear });
  const religion = profile?.religion && profile.religion !== 'Prefer not to say' ? String(profile.religion) : null;
  const caste = profile?.caste && profile.caste !== 'Prefer not to say' ? String(profile.caste) : null;
  const locationText =
    profile?.location ||
    [profile?.city, profile?.state].filter(Boolean).join(', ') ||
    profile?.countryOfResidence ||
    null;
  const occupationText = normalizeOccupation(profile);
  const educationItems = normalizeEducation(profile);
  const lookingForSummary = generateHeroLookingForSummary(profile);

  const handleFavoriteToggle = async () => {
    if (!profile?.username) return;
    const nextFavorited = !isFavorited;

    if (onFavoriteOptimistic) {
      onFavoriteOptimistic(profile.username, nextFavorited);
    }

    try {
      setBusy(true);
      if (isFavorited) {
        await api.delete(`/favorites/${profile.username}`);
        toast.info('Removed from favorites');
      } else {
        await api.post(`/favorites/${profile.username}`);
        toast.success('Added to favorites');
      }
      if (onRefreshFavorites) await onRefreshFavorites();
    } catch (err) {
      if (onFavoriteOptimistic) {
        onFavoriteOptimistic(profile.username, isFavorited);
      }
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

  return (
    <div className="dv2-hero-card dv2-variant-primary">
      <div className="dv2-hero-photo" aria-hidden="true">
        {photo && !photoFailed ? (
          <img className="dv2-hero-img" src={photo} alt="" onError={() => setPhotoFailed(true)} />
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

        <div className="dv2-hero-pills" aria-label="Profile highlights">
          {heightText ? <span className="dv2-hero-pill">{heightText}</span> : null}
          {dob ? <span className="dv2-hero-pill">{dob}</span> : null}
          {religion ? <span className="dv2-hero-pill">{religion}</span> : null}
          {age ? <span className="dv2-hero-pill">{age}yrs</span> : null}
          {caste ? <span className="dv2-hero-pill">{caste}</span> : null}
        </div>

        <div className="dv2-hero-pills dv2-hero-pills-secondary" aria-label="Profile details">
          {locationText ? <span className="dv2-hero-pill dv2-hero-pill-soft">📍 {locationText}</span> : null}
          {occupationText ? <span className="dv2-hero-pill dv2-hero-pill-soft">💼 {occupationText}</span> : null}
          {educationItems.map((edu) => (
            <span key={edu} className="dv2-hero-pill dv2-hero-pill-soft">🎓 {edu}</span>
          ))}
        </div>

        {lookingForSummary ? (
          <div className="dv2-hero-looking-for" aria-label="Looking for">
            <span className="dv2-hero-looking-for-label">LOOKING FOR:</span>
            <span className="dv2-hero-looking-for-text">{lookingForSummary}</span>
          </div>
        ) : null}

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
