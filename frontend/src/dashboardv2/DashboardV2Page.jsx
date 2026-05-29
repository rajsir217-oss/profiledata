// frontend/src/dashboardv2/DashboardV2Page.jsx
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

import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ProfileViewsModal from '../components/ProfileViewsModal';
import ProfileNotes from '../components/ProfileNotes';
import PollWidget from '../components/PollWidget';
import { formatShortDateTime } from '../utils/timeFormatter';
import { useDashboardData } from './hooks/useDashboardData';
import { useNewestMatch } from './hooks/useNewestMatch';
import { useStaleMessages } from './hooks/useStaleMessages';
import HeroNewestMatch from './components/HeroNewestMatch/HeroNewestMatch';
import DashboardBanners from './components/DashboardBanners/DashboardBanners';
import AttentionGrid from './components/AttentionGrid/AttentionGrid';
import StatsStrip from './components/StatsStrip/StatsStrip';
import RecentConversations from './components/RecentConversations/RecentConversations';
import SideRail from './components/SideRail/SideRail';
import './DashboardV2.css';

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
    setFavoriteOptimistic,
  } = useDashboardData();
  const newestMatch = useNewestMatch(data.savedSearches, data.userProfile);
  const staleMessages = useStaleMessages(data.conversations);

  const [showProfileViews, setShowProfileViews] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const currentUsername = useMemo(() => localStorage.getItem('username'), []);
  const lastLoginAt = data.userProfile?.security?.last_login_at;

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

  // Fetch breakdown using hero's actual criteria
  useEffect(() => {
    if (newestMatch.pick?.savedSearch?.criteria) {
      fetchBreakdown(newestMatch.pick.savedSearch.criteria);
    }
  }, [newestMatch.pick, fetchBreakdown]);

  const openSavedSearch = (savedSearchOrEvent) => {
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
        JSON.stringify({ type: 'loadSavedSearch', savedSearch })
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
    incomingPiiRequests: data.incomingPiiRequests?.length ?? 0,
    unreadConversations: (data.conversations || []).filter(
      (c) => (c.unreadCount ?? 0) > 0
    ).length,
    staleMessages: staleMessages.length,
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
          <PollWidget
            inline={true}
            autoPopup={true}
            initialPolls={data.activePolls}
            onPollResponded={refreshActivePolls}
            renderPlaceholder={() => null}
          />
        </div>
      ) : null}
      {/* ============ HERO ============ */}
      <section className="dv2-hero">
        <div className="dv2-hero-header">
          <div className="dv2-hero-greeting">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}{' '}
            · Welcome back
          </div>

          <div className="dv2-hero-meta">
            {lastLoginAt ? (
              <div className="dv2-hero-last-login" title={formatShortDateTime(lastLoginAt)}>
                Last login: {formatShortDateTime(lastLoginAt)}
              </div>
            ) : null}

            <button className="dv2-link" type="button" onClick={() => navigate('/dashboard')}>
              Legacy dashboard
            </button>
          </div>
        </div>
        <h1 className="dv2-hero-title">
          {data.userProfile?.firstName ? (
            <>
              Hi <span className="dv2-name">{data.userProfile.firstName}</span>
              {newestMatch.pick?.savedSearch ? (
                <>
                  {' '}— newest match in{' '}
                  <span className="dv2-name">
                    "{newestMatch.pick.savedSearch.name}"
                  </span>
                </>
              ) : (
                ''
              )}
            </>
          ) : (
            'Welcome back'
          )}
        </h1>

        <HeroNewestMatch
          pick={newestMatch.pick}
          loading={heroBusy}
          error={newestMatch.error}
          isEmpty={!heroBusy && newestMatch.isEmpty}
          onSkip={newestMatch.skipPick}
          onOpenSearch={(s) => openSavedSearch(s)}
          favoritedUsernames={favoritedUsernames}
          onRefreshFavorites={refreshFavorites}
          onFavoriteOptimistic={setFavoriteOptimistic}
          onRetry={newestMatch.reload}
        />
      </section>

      <AttentionGrid
        loading={loading}
        items={[
          {
            key: 'contactRequests',
            icon: '🔐',
            title: 'Contact requests',
            count: counts.incomingPiiRequests,
            variant: 'warning',
            onClick: () => navigate('/requests'),
          },
          {
            key: 'reply',
            icon: '💬',
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
            onClick: () => navigate('/favorites'),
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
            key: 'followUp',
            icon: '⏭',
            title: 'Follow up on chats',
            count: counts.staleMessages,
            variant: 'success',
            onClick: () => navigate('/messages'),
          },
          {
            key: 'searchMatches',
            icon: '🔍',
            title: 'Matches in your search',
            count: counts.savedSearches,
            variant: 'secondary',
            onClick: () => openSavedSearch(),
          },
          {
            key: 'locationUnique',
            icon: '📍',
            title: 'Matches by location',
            count: counts.locationUnique,
            variant: 'info',
            onClick: () => openSavedSearch(),
          },
          {
            key: 'educationUnique',
            icon: '🎓',
            title: 'Matches by education',
            count: counts.educationUnique,
            variant: 'primary',
            onClick: () => openSavedSearch(),
          },
          {
            key: 'professionUnique',
            icon: '💼',
            title: 'Matches by profession',
            count: counts.professionUnique,
            variant: 'success',
            onClick: () => openSavedSearch(),
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

          <RecentConversations conversations={data.conversations} />
        </div>

        <SideRail
          userProfile={data.userProfile}
          savedSearches={data.savedSearches}
          activePolls={data.activePolls}
          onOpenSavedSearch={openSavedSearch}
          onPollResponded={refreshActivePolls}
        />
      </div>

      <ProfileViewsModal
        isOpen={showProfileViews}
        onClose={() => setShowProfileViews(false)}
        username={currentUsername}
      />

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
              <ProfileNotes />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DashboardV2Page;
