// frontend/src/dashboardv2/DashboardV2Page.jsx
//
// Business Requirements:
// - /dashboardv2 is an action-first dashboard; every attention card must surface a concrete user action.
// - Avoid duplicate conversation cards; only one message/reply card is needed.
// - "People who shortlisted you" must show the count of users who added this user to their shortlist.
// - Clicking that card opens a modal to inspect those users and reach out to them.
//
// Checkpoint: 2026-08-17 - Replaced "Follow up on chats" attention card with "People who shortlisted you".
//
// Top-level page for the new "action-first" dashboard (Mockup A).
//
// This file is the ROUTE HANDLER for /dashboardv2. It composes the page
// from individual section components — none of which touch the existing
// /dashboard route, components/Dashboard2.js, or any of its imports.
//
// Layout (Mockup A):
//   ┌─────────────────────────────────────────────────────────────┐
//   │  HERO:  "Newest match in [your default saved search]"       │
//   ├─────────────────────────────────────────────────────────────┤
//   │  WHAT NEEDS YOUR ATTENTION  (3×2 action card grid)          │
//   ├──────────────────────────────────────┬──────────────────────┤
//   │  YOUR ACTIVITY  (7 stat tiles)       │  SIDE RAIL           │
//   │                                       │  • Profile compl.    │
//   │  RECENT CONVERSATIONS                 │  • Saved searches    │
//   │                                       │  • Active polls      │
//   └──────────────────────────────────────┴──────────────────────┘
//
// In this commit, each section is a PLACEHOLDER block — the page is
// renderable end-to-end and shows the layout. The actual section
// components (HeroNewestMatch, AttentionGrid, StatsStrip, etc.) are
// added in the next commit.

import React, { useMemo, useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatShortDateTime } from '../utils/timeFormatter';
import logger from '../utils/logger';
import { useDashboardData } from './hooks/useDashboardData';
import { useNewestMatch } from './hooks/useNewestMatch';
import HeroNewestMatch from './components/HeroNewestMatch/HeroNewestMatch';
import DashboardBanners from './components/DashboardBanners/DashboardBanners';
import AttentionGrid from './components/AttentionGrid/AttentionGrid';
import StatsStrip from './components/StatsStrip/StatsStrip';
import RecentConversations from './components/RecentConversations/RecentConversations';
import SideRail from './components/SideRail/SideRail';
import './DashboardV2.css';

// Interaction-only components — loaded lazily so the dashboard's initial
// bundle doesn't pull in modal + payment + chat code until first use.
const ProfileViewsModal = lazy(() => import('../components/ProfileViewsModal'));
const FavoritedByModal = lazy(() => import('../components/FavoritedByModal'));
const ShortlistedByModal = lazy(() => import('../components/ShortlistedByModal'));
const ProfileNotes = lazy(() => import('../components/ProfileNotes'));
const PollWidget = lazy(() => import('../components/PollWidget'));

const DashboardV2Page = () => {
  const navigate = useNavigate();
  const {
    data,
    loading,
    criticalLoading,
    error,
    refetch,
    fetchBreakdown,
    refreshActivePolls,
    refreshUserProfile,
    refreshExclusions,
    refreshFavorites,
    refreshConversations,
    setFavoriteOptimistic,
  } = useDashboardData();
  const newestMatch = useNewestMatch(data.savedSearches, data.userProfile);

  const [showProfileViews, setShowProfileViews] = useState(false);
  const [showFavoritedBy, setShowFavoritedBy] = useState(false);
  const [showShortlistedBy, setShowShortlistedBy] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const currentUsername = localStorage.getItem('username');

  useEffect(() => {
    if (!currentUsername) {
      logger.warn('No username found in localStorage, redirecting to login');
      navigate('/login');
    }
  }, [currentUsername, navigate]);
  const lastLoginAt = data.userProfile?.security?.last_login_at;

  const getConversationUnreadCount = (conversation) => {
    const rawUnread =
      conversation?.unreadCount ??
      conversation?.unread_count ??
      conversation?.unread ??
      0;
    const parsed = Number(rawUnread);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const heroBusy =
    criticalLoading ||
    newestMatch.loading ||
    (Boolean(data.userProfile) && !newestMatch.pick && !newestMatch.isEmpty && !newestMatch.error);

  const favoritedUsernames = useMemo(() => {
    const set = new Set();
    (data.favorites || []).forEach((f) => {
      const u = f.favoriteUsername || f.targetUsername || f.username;
      if (u) set.add(u);
    });
    return set;
  }, [data.favorites]);

  // Fetch breakdown using hero's actual criteria — deferred to browser idle so
  // the extra aggregation doesn't compete with the hero/attention first paint.
  useEffect(() => {
    const criteria = newestMatch.pick?.savedSearch?.criteria;
    if (!criteria) return undefined;

    let cancelled = false;
    const run = () => {
      if (!cancelled) fetchBreakdown(criteria);
    };

    const hasIdle = typeof window !== 'undefined' && 'requestIdleCallback' in window;
    const handle = hasIdle
      ? window.requestIdleCallback(run, { timeout: 2000 })
      : setTimeout(run, 500);

    return () => {
      cancelled = true;
      if (hasIdle) {
        window.cancelIdleCallback(handle);
      } else {
        clearTimeout(handle);
      }
    };
  }, [newestMatch.pick, fetchBreakdown]);

  const openSavedSearch = (savedSearchOrEvent, sortBy = null) => {
    const isEventLike =
      !!savedSearchOrEvent &&
      typeof savedSearchOrEvent === 'object' &&
      (typeof savedSearchOrEvent.preventDefault === 'function' ||
        typeof savedSearchOrEvent.stopPropagation === 'function' ||
        'nativeEvent' in savedSearchOrEvent);

    const savedSearch = isEventLike ? null : savedSearchOrEvent;

    if (savedSearch && typeof savedSearch === 'object' && (savedSearch.criteria || savedSearch._id || savedSearch.id)) {
      sessionStorage.setItem(
        'pendingSearchAction',
        JSON.stringify({ type: 'loadSavedSearch', savedSearch, sortBy })
      );
    } else {
      sessionStorage.setItem(
        'pendingSearchAction',
        JSON.stringify({ type: 'openSavedSearches' })
      );
    }
    navigate('/search');
  };

  // Counts used by stat tiles + action cards
  const counts = {
    profileViews: data.profileViews?.uniqueViewers ?? data.profileViews?.viewers?.length ?? 0,
    conversations: data.conversations?.length ?? 0,
    favorites: data.favorites?.length ?? 0,
    savedSearches: data.savedSearches?.length ?? 0,
    shortlist: data.shortlist?.length ?? 0,
    notes: data.notes?.length ?? 0,
    exclusions: data.exclusions?.length ?? 0,
    favoritedYou: data.theirFavorites?.length ?? 0,
    shortlistedYou: data.theirShortlist?.length ?? 0,
    incomingPiiRequests: data.incomingPiiRequests?.length ?? 0,
    unreadConversations: (data.conversations || []).filter(
      (c) => getConversationUnreadCount(c) > 0
    ).length,
    openConversations: (data.conversations || []).filter(
      (c) => !c?.isArchived
    ).length,
    activePolls: data.activePolls?.length ?? 0,
    // Search criteria breakdown - unique values count
    locationUnique: data.searchCriteriaBreakdown?.breakdown?.location?.total ?? 0,
    educationUnique: data.searchCriteriaBreakdown?.breakdown?.education?.total ?? 0,
    professionUnique: data.searchCriteriaBreakdown?.breakdown?.profession?.total ?? 0,
  };

  if (error) {
    return (
      <div className="dv2-error">
        <p>Could not load dashboard.</p>
        <button onClick={refetch} className="dv2-retry-btn">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="dv2-container">
      <DashboardBanners
        userProfile={data.userProfile}
        onRefreshProfile={refreshUserProfile}
        onRefreshExclusions={refreshExclusions}
        enabled={!criticalLoading}
        deferMs={800}
      />
      {data.activePolls?.length > 0 ? (
        <div className="dv2-poll-popup-host">
          <Suspense fallback={null}>
            <PollWidget
              inline={true}
              autoPopup={true}
              initialPolls={data.activePolls}
              onPollResponded={refreshActivePolls}
              renderPlaceholder={() => null}
            />
          </Suspense>
        </div>
      ) : null}
      {/* ============ HERO ============ */}
      <section className="dv2-hero">
        <h1 className="dv2-hero-title">
          {data.userProfile?.firstName ? (
            <>
              Hi <span className="dv2-name">{data.userProfile.firstName}</span>
              {newestMatch.pick ? " — congrats! Here's the newest match." : ''}
            </>
          ) : (
            'Welcome back'
          )}
        </h1>

        <HeroNewestMatch
          pick={newestMatch.pick}
          peers={newestMatch.peers}
          hasMore={newestMatch.hasMore}
          position={newestMatch.position}
          loading={heroBusy}
          error={newestMatch.error}
          isEmpty={!heroBusy && newestMatch.isEmpty}
          onSkip={newestMatch.skipPick}
          onPrevious={newestMatch.previousPick}
          onSelectPeer={newestMatch.selectPeer}
          onOpenSearch={(s) => openSavedSearch(s)}
          favoritedUsernames={favoritedUsernames}
          onRefreshFavorites={refreshFavorites}
          onFavoriteOptimistic={setFavoriteOptimistic}
          onRetry={newestMatch.reload}
        />

        <div className="dv2-hero-footer">
          <div className="dv2-hero-meta">
            {lastLoginAt ? (
              <div className="dv2-hero-last-login" title={formatShortDateTime(lastLoginAt)}>
                Last login: {formatShortDateTime(lastLoginAt)}
              </div>
            ) : null}

            <button className="dv2-link" type="button" onClick={() => navigate('/dashboard-legacy')}>
              Legacy dashboard
            </button>
          </div>
        </div>
      </section>

      <AttentionGrid
        loading={loading}
        items={[
          {
            key: 'locationUnique',
            icon: '\uD83D\uDCCD',
            title: 'Matches by location',
            count: counts.locationUnique,
            variant: 'info',
            onClick: () => openSavedSearch(newestMatch.pick?.savedSearch, 'location'),
          },
          {
            key: 'educationUnique',
            icon: '🎓',
            title: 'Matches by education',
            count: counts.educationUnique,
            variant: 'primary',
            onClick: () => openSavedSearch(newestMatch.pick?.savedSearch, 'education'),
          },
          {
            key: 'professionUnique',
            icon: '💼',
            title: 'Matches by profession',
            count: counts.professionUnique,
            variant: 'success',
            onClick: () => openSavedSearch(newestMatch.pick?.savedSearch, 'profession'),
          },
          {
            key: 'searchMatches',
            icon: '\uD83D\uDD0D',
            title: 'Matches in your search',
            count: counts.savedSearches,
            variant: 'secondary',
            onClick: () => openSavedSearch(),
          },
          {
            key: 'views',
            icon: '👁',
            title: 'See who viewed you',
            count: counts.profileViews,
            variant: 'primary',
            onClick: () => setShowProfileViews(true),
          },
          {
            key: 'reply',
            icon: '\uD83D\uDCAC',
            title: 'Reply to messages',
            count: counts.unreadConversations,
            variant: 'info',
            onClick: () => navigate('/messages'),
          },
          {
            key: 'favoritedYou',
            icon: '❤',
            title: 'People who favorited you',
            count: counts.favoritedYou,
            variant: 'danger',
            onClick: () => setShowFavoritedBy(true),
          },
          {
            key: 'shortlistedYou',
            icon: '⭐',
            title: 'People who shortlisted you',
            count: counts.shortlistedYou,
            variant: 'success',
            onClick: () => setShowShortlistedBy(true),
          },
          {
            key: 'contactRequests',
            icon: '\uD83D\uDCE9',
            title: 'Contact requests',
            count: counts.incomingPiiRequests,
            variant: 'warning',
            onClick: () => navigate('/requests'),
          },
        ]}
      />

      {/* ============ MAIN COLUMN + SIDE RAIL ============ */}
      <div className="dv2-main-grid">
        <div className="dv2-main">
          <StatsStrip
            loading={loading}
            tiles={[
              {
                key: 'profileViews',
                num: counts.profileViews,
                label: 'Profile views',
                icon: '👁',
                variant: 'primary',
                onClick: () => setShowProfileViews(true),
                hasNew: false,
              },
              {
                key: 'conversations',
                num: counts.conversations,
                label: 'Conversations',
                icon: '💬',
                variant: 'info',
                onClick: () => navigate('/messages'),
                hasNew: counts.unreadConversations > 0,
              },
              {
                key: 'favorites',
                num: counts.favorites,
                label: 'My favorites',
                icon: '❤',
                variant: 'danger',
                onClick: () => navigate('/favorites'),
                hasNew: false,
              },
              {
                key: 'savedSearches',
                num: counts.savedSearches,
                label: 'Saved searches',
                icon: '🔍',
                variant: 'secondary',
                onClick: () => openSavedSearch(),
                hasNew: false,
              },
              {
                key: 'shortlist',
                num: counts.shortlist,
                label: 'Short lists',
                icon: '✅',
                variant: 'success',
                onClick: () => navigate('/shortlist'),
                hasNew: false,
              },
              {
                key: 'notes',
                num: counts.notes,
                label: 'My notes',
                icon: '📝',
                variant: 'warning',
                onClick: () => setShowNotes(true),
                hasNew: false,
              },
              {
                key: 'exclusions',
                num: counts.exclusions,
                label: 'Exclusions',
                icon: '🚫',
                variant: 'info',
                onClick: () => navigate('/exclusions'),
                hasNew: false,
              },
            ]}
          />

          <RecentConversations
            conversations={data.conversations}
            onConversationsChanged={refreshConversations}
          />
        </div>

        <SideRail
          userProfile={data.userProfile}
          savedSearches={data.savedSearches}
          activePolls={data.activePolls}
          onOpenSavedSearch={openSavedSearch}
          onPollResponded={refreshActivePolls}
        />
      </div>

      {showProfileViews ? (
        <Suspense fallback={null}>
          <ProfileViewsModal
            isOpen={showProfileViews}
            onClose={() => setShowProfileViews(false)}
            username={currentUsername}
          />
        </Suspense>
      ) : null}

      {showFavoritedBy ? (
        <Suspense fallback={null}>
          <FavoritedByModal
            isOpen={showFavoritedBy}
            onClose={() => setShowFavoritedBy(false)}
            username={currentUsername}
          />
        </Suspense>
      ) : null}

      {showShortlistedBy ? (
        <Suspense fallback={null}>
          <ShortlistedByModal
            isOpen={showShortlistedBy}
            onClose={() => setShowShortlistedBy(false)}
            username={currentUsername}
          />
        </Suspense>
      ) : null}

      {showNotes ? (
        <div className="dv2-modal-overlay" onClick={() => setShowNotes(false)}>
          <div className="dv2-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dv2-modal-header">
              <div className="dv2-modal-title">📝 My notes</div>
              <button className="dv2-modal-close" type="button" onClick={() => setShowNotes(false)}>
                ×
              </button>
            </div>
            <div className="dv2-modal-body">
              <Suspense fallback={null}>
                <ProfileNotes />
              </Suspense>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DashboardV2Page;
