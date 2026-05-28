import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import useAuthStore from '@messenger/stores/authStore';
import useMessengerStore from '@messenger/stores/messengerStore';
import messengerSocket from '@messenger/services/socketService';
import { API_BASE_URL } from '@messenger/config/api';
import { getMainAppUrl } from '../config/apiConfig';

// Quick Messages catalog. Only "introduction" is shipped today; future
// categories (interest, more-info, next-steps, follow-up, decline) will be
// added back here once their behaviors are designed.
const QUICK_MESSAGE_CATEGORIES = [
  { id: 'introduction', label: 'Introduction', icon: '🙋', enabled: true },
];

// Helper: calc age from a dob string OR a (year, month) pair. The main app
// stores birth as separate `birthMonth` / `birthYear` fields (no day), so we
// approximate the age from year+month (1st of month).
const calcAge = (dob, birthYear, birthMonth) => {
  let d = null;
  if (dob) {
    const parsed = new Date(dob);
    if (!Number.isNaN(parsed.getTime())) d = parsed;
  } else if (birthYear) {
    const m = Number(birthMonth) || 1;
    const y = Number(birthYear);
    if (y > 1900 && y < 2200) d = new Date(Date.UTC(y, m - 1, 1));
  }
  if (!d) return null;
  const diff = Date.now() - d.getTime();
  const age = new Date(diff).getUTCFullYear() - 1970;
  return age > 0 && age < 130 ? age : null;
};

// Build an authenticated URL for a profile image path. Mirrors the helper in
// ConversationListScreen so the card renders the same picture as the sidebar.
const buildImageUrl = (path) => {
  if (!path) return null;
  if (typeof path !== 'string') return null;
  const normalized = !path.startsWith('http') && !path.startsWith('/') ? `/${path}` : path;
  const token = useAuthStore.getState().token;
  let fullUrl = normalized.startsWith('http') ? normalized : `${API_BASE_URL}${normalized}`;
  // Strip any pre-baked token so we always inject the CURRENT one. Legacy
  // snapshots persisted the JWT in the URL → it would expire ~30 min later.
  if (fullUrl.includes('token=')) {
    fullUrl = fullUrl
      .replace(/([?&])token=[^&]*&?/, '$1')
      .replace(/[?&]$/, '');
  }
  if (token) {
    const sep = fullUrl.includes('?') ? '&' : '?';
    return `${fullUrl}${sep}token=${encodeURIComponent(token)}`;
  }
  return fullUrl;
};

// Rich profile-card renderer for contentType="profile_card" messages.
// Mirrors the layout in Image 1 of the spec: avatar at top, name + meta pills,
// then Education History, Work Experience, and a free-form "looking for" blurb.
// `card` is the immutable snapshot persisted on the message document.
function ProfileCard({ card, isOwn, onUsernameClick, onMenuOpen, isFavorited, currentUserGender }) {
  if (!card) return null;
  const avatarUri = card.avatarUrl ? buildImageUrl(String(card.avatarUrl)) : null;
  // Pills mirror the main-app card: age · DOB (MM/YYYY) · height. Prefer the
  // pre-formatted `dobLabel` (built from birthMonth/birthYear) and only fall
  // back to a runtime format if an ISO `dob` string is present.
  let dobPill = null;
  if (card.dobLabel) {
    dobPill = `📅 ${card.dobLabel}`;
  } else if (card.dob) {
    const parsed = new Date(card.dob);
    if (!Number.isNaN(parsed.getTime())) {
      dobPill = `📅 ${parsed.toLocaleDateString('en-US', { month: '2-digit', year: 'numeric' })}`;
    }
  }
  const genderPill = (card.sex || card.gender) ? (
    ['male', 'm', 'man', 'Male', 'M', 'Man'].includes(String(card.sex || card.gender).trim())
      ? '👨 Male'
      : ['female', 'f', 'woman', 'Female', 'F', 'Woman'].includes(String(card.sex || card.gender).trim())
      ? '👩 Female'
      : `⚧ ${card.sex || card.gender}`
  ) : '❓ Unknown';
  const pills = [
    card.age ? `👋 ${card.age} yrs` : null,
    dobPill,
    card.height ? `📏 ${card.height}` : null,
    genderPill,
  ].filter(Boolean);
  // Subline shows just the user's location (city) — `education` / `occupation`
  // would duplicate what's already in the Education History / Work Experience
  // sections below, and the underlying profile schema doesn't have flat
  // top-level versions of those fields anyway.
  const subline = card.location || '';
  return (
    <View style={[cardStyles.card, isOwn && cardStyles.cardOwn]}>
      <View style={cardStyles.headerRow}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={cardStyles.avatar} />
        ) : (
          <View style={[cardStyles.avatar, cardStyles.avatarFallback]}>
            <Text style={cardStyles.avatarFallbackText}>
              {(card.fullName || card.username || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={cardStyles.headerText}>
          <TouchableOpacity
            onPress={() => card.username && onUsernameClick && onUsernameClick(card.username)}
            activeOpacity={card.username ? 0.7 : 1}
          >
            <Text style={cardStyles.name}>{card.fullName || card.username}</Text>
          </TouchableOpacity>
          {pills.length > 0 && (
            <View style={cardStyles.pillRow}>
              {pills.map((p, i) => (
                <View key={i} style={cardStyles.pill}>
                  <Text style={cardStyles.pillText}>{p}</Text>
                </View>
              ))}
            </View>
          )}
          {subline ? (
            <View style={cardStyles.subPill}>
              <Text style={cardStyles.subPillText}>{subline}</Text>
            </View>
          ) : null}
        </View>
        <View style={cardStyles.headerActions}>
          {isFavorited && <Text style={cardStyles.heartEmoji}>❤️</Text>}
          {!isOwn && onMenuOpen && (() => {
            const normalizeGender = (g) => g ? String(g).trim().toLowerCase() : '';
            const currentG = normalizeGender(currentUserGender);
            const cardG = normalizeGender(card.gender || card.sex);
            const isMale = ['male', 'm', 'man'].includes(currentG);
            const cardIsMale = ['male', 'm', 'man'].includes(cardG);
            const isFemale = ['female', 'f', 'woman'].includes(currentG);
            const cardIsFemale = ['female', 'f', 'woman'].includes(cardG);
            // Show menu if either gender is missing OR if genders are opposite
            return !currentG || !cardG || (isMale && cardIsFemale) || (isFemale && cardIsMale);
          })() && (
            <TouchableOpacity
              style={cardStyles.menuButton}
              onPress={() => onMenuOpen(card)}
              activeOpacity={0.7}
            >
              <Text style={cardStyles.menuButtonText}>⋮</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {Array.isArray(card.educationHistory) && card.educationHistory.length > 0 && (
        <View style={cardStyles.section}>
          <Text style={cardStyles.sectionTitle}>🎓 Education History</Text>
          {card.educationHistory.map((e, i) => {
            // Schema (Register2/EducationHistory.js): { level, degree, institution }
            // Display matches main app Profile.js: "Level - Degree" with institution below.
            const title = e.level && e.degree
              ? `${e.level} – ${e.degree}`
              : (e.level || e.degree || e.qualification || '');
            const where = e.institution || e.school || (Array.isArray(e.schools) ? e.schools.join(' & ') : '');
            return (
              <View key={i} style={cardStyles.row}>
                {title ? <Text style={cardStyles.rowTitle}>{title}</Text> : null}
                {where ? <Text style={cardStyles.rowText}>{where}</Text> : null}
              </View>
            );
          })}
        </View>
      )}

      {Array.isArray(card.workExperience) && card.workExperience.length > 0 && (
        <View style={cardStyles.section}>
          <Text style={cardStyles.sectionTitle}>💼 Work Experience</Text>
          {card.workExperience.map((w, i) => {
            // Schema (Register2/WorkExperience.js): { status: 'current'|'past'|'other',
            //   workType, description, location }
            // Display matches main app Profile.js exactly.
            const isCurrent = w.status === 'current' || w.current === true || w.isCurrent === true;
            const isPast = w.status === 'past';
            const heading = isCurrent
              ? '🟢 Current Position'
              : isPast
                ? '⚪ Past Position'
                : (w.role || w.title || w.position || 'Position');
            const desc = w.description || w.role || w.title || w.company || '';
            const loc = w.location || '';
            return (
              <View key={i} style={cardStyles.row}>
                <Text style={cardStyles.rowTitle}>{heading}</Text>
                {desc ? <Text style={cardStyles.rowText}>{desc}</Text> : null}
                {loc ? <Text style={cardStyles.rowText}>📍 {loc}</Text> : null}
              </View>
            );
          })}
        </View>
      )}

      {card.message ? (
        <Text style={cardStyles.message}>{card.message}</Text>
      ) : null}
    </View>
  );
}

// Status pill metadata for invited public-email recipients (US Vedika).
// `status` values come from the backend's publicParticipants[].status field
// and are enriched onto each message's publicEmailsSent[] in messenger_service.
const PUBLIC_EMAIL_STATUS_META = {
  invited:    { label: 'Pending activation', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  interested: { label: 'Interested',         color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  replied:    { label: 'Replied',            color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
  opted_out:  { label: 'Unsubscribed',       color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.15)' },
};
const getPublicEmailStatusMeta = (status) =>
  PUBLIC_EMAIL_STATUS_META[status] || PUBLIC_EMAIL_STATUS_META.invited;

// Short, human-readable relative time (e.g. "3d ago", "just now") used in the
// recipient-status bubbles. Falls back to an empty string for invalid input.
const formatRelative = (when) => {
  if (!when) return '';
  const t = typeof when === 'string' ? Date.parse(when) : (when instanceof Date ? when.getTime() : when);
  if (!t || Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  if (diff < 0) return 'just now';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
};

const EMPTY_MESSAGES = [];

export default function ChatScreen({ id, name, isGroup, isLegacy, profile, username, isOnline, onBack, onOpenDirectChat }) {
  const { user } = useAuthStore();
  const storeMessages = useMessengerStore((state) => (id ? (state.messages[id] ?? EMPTY_MESSAGES) : EMPTY_MESSAGES));
  const fetchStoreMessages = useMessengerStore((state) => state.fetchMessages);
  const sendStoreMessage = useMessengerStore((state) => state.sendMessage);
  const onStoreNewMessage = useMessengerStore((state) => state.onNewMessage);
  const deleteStoreMessage = useMessengerStore((state) => state.deleteMessage);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  // Send errors are kept separate from load errors so they don't blow away
  // the chat view. They appear as an inline banner above the composer.
  const [sendError, setSendError] = useState(null);
  // US Vedika public group states
  const [showPublicRecipientModal, setShowPublicRecipientModal] = useState(false);
  const [publicRecipients, setPublicRecipients] = useState([]);
  const [includeInvitation, setIncludeInvitation] = useState(true);
  // Pre-flight check results for @{email} recipients. Populated by
  // /api/messenger/conversations/{id}/check-recipients when the modal opens.
  //   recipientChecks: { [email]: { isMember, memberUsername, hasActiveInvitation,
  //     invitationStatus, invitationSentAt, alreadyInConversation, lastSentAt } }
  //   senderCanInvite: false → disable Send + Invite and show a banner.
  const [recipientChecks, setRecipientChecks] = useState({});
  const [senderCanInvite, setSenderCanInvite] = useState(true);
  const [checkingRecipients, setCheckingRecipients] = useState(false);
  // Per-conversation message retention (TTL). null = off. Backend hard-deletes
  // messages whose expireAt has passed via a TTL index on messenger_messages.
  // Only app-level admins/moderators can change this.
  const [retentionHours, setRetentionHours] = useState(null);
  const [showRetentionModal, setShowRetentionModal] = useState(false);
  const [savingRetention, setSavingRetention] = useState(false);
  // Derived from the reactive `user` from useAuthStore so role changes
  // (re-login, role promotion) flip the UI without a full reload.
  const isAdminOrModerator = user?.role === 'admin' || user?.role === 'moderator';
  // Clear chat
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);
  // Username action modal — opened when a user taps a sender's name in a group
  // chat bubble. Offers View Profile (main app) and Direct Message (1:1 chat).
  const [usernameModalTarget, setUsernameModalTarget] = useState(null);
  // Profile card actions menu
  const [profileCardMenuTarget, setProfileCardMenuTarget] = useState(null);
  // Track favorited usernames to show heart emoji on profile cards
  const [favoritedUsernames, setFavoritedUsernames] = useState(new Set());
  // ScrollView ref for scrolling to bottom
  const scrollViewRef = useRef(null);
  // Quick Messages popup (⚡ button next to composer). Only "Introduction" is
  // wired up; the other categories are visible-but-disabled placeholders.
  const [showQuickMessages, setShowQuickMessages] = useState(false);
  const [sendingProfileCard, setSendingProfileCard] = useState(false);
  const [sending, setSending] = useState(false);
  const [armedDeleteId, setArmedDeleteId] = useState(null);
  const [socketConnected, setSocketConnected] = useState(true);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // For non-legacy conversations, render directly from the store to avoid
  // an extra commit per real-time update. For legacy chats, keep the local
  // messages state populated by the REST endpoint.
  const displayMessages = isLegacy ? messages : storeMessages;

  useEffect(() => {
    if (!id || isLegacy) return;
    messengerSocket.joinConversation(id);
    return () => messengerSocket.leaveConversation(id);
  }, [id, isLegacy]);

  useEffect(() => {
    const unsub = messengerSocket.onStatusChange((connected) => {
      setSocketConnected(connected);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!armedDeleteId) return;
    const t = setTimeout(() => setArmedDeleteId(null), 3000);
    return () => clearTimeout(t);
  }, [armedDeleteId]);

  // Load user's favorites on mount to populate favoritedUsernames state
  useEffect(() => {
    const loadFavorites = async () => {
      if (!user?.username) return;
      try {
        const api = useAuthStore.getState().getApi();
        const res = await api.get(`/api/users/favorites/${user.username}`);
        const favorites = res.data?.favorites || [];
        const usernameSet = new Set(favorites.map(f => f.username));
        setFavoritedUsernames(usernameSet);
      } catch (e) {
        console.error('Failed to load favorites:', e);
      }
    };
    loadFavorites();
  }, [user?.username]);

  // Scroll to bottom when messages load or new messages arrive
  const firstMessageIdRef = useRef(null);
  const lastMessageIdRef = useRef(null);
  const hasLoadedOnceRef = useRef(false);
  useEffect(() => {
    // Reset scroll tracking when switching conversations
    firstMessageIdRef.current = null;
    lastMessageIdRef.current = null;
    hasLoadedOnceRef.current = false;
  }, [id]);

  useEffect(() => {
    if (!scrollViewRef.current) return;
    if (!Array.isArray(displayMessages) || displayMessages.length === 0) return;

    const firstMsg = displayMessages[0] || {};
    const lastMsg = displayMessages[displayMessages.length - 1] || {};

    const firstId = firstMsg.id || firstMsg._id || firstMsg.tempId || firstMsg.createdAt || null;
    const lastId = lastMsg.id || lastMsg._id || lastMsg.tempId || lastMsg.createdAt || null;

    const prevFirstId = firstMessageIdRef.current;
    const prevLastId = lastMessageIdRef.current;

    // Scroll when:
    // - first render of a conversation (initial load)
    // - the last message changes (append OR optimistic temp->real replacement)
    // Do NOT scroll when only older history is prepended (first changes, last stays the same).
    const shouldScroll =
      !hasLoadedOnceRef.current ||
      (!!lastId && prevLastId !== lastId);

    if (shouldScroll) {
      // Defer so layout has committed before we try to scroll.
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 0);
      hasLoadedOnceRef.current = true;
    }

    firstMessageIdRef.current = firstId;
    lastMessageIdRef.current = lastId;
  }, [displayMessages]);

  // Build a profile_card snapshot from the current user's profile and POST it
  // as a rich message into the active conversation. Legacy (main app) 1:1
  // chats don't support rich types, so we gate the ⚡ button on !isLegacy.
  const sendProfileCard = async () => {
    if (!user?.username || isLegacy) return;
    setShowQuickMessages(false);
    setSendingProfileCard(true);
    setSendError(null);
    try {
      const store = useAuthStore.getState();
      const api = store.getApi();
      let snapshot = await store.prefetchIntroCard({ force: true });
      if (snapshot && !(snapshot.gender || snapshot.sex)) {
        try {
          const profRes = await api.get(`/api/users/profile/${user.username}?requester=${user.username}`);
          const p = profRes.data?.user || profRes.data || {};
          const genderValue = p.sex || p.gender || null;
          if (genderValue) {
            snapshot = {
              ...snapshot,
              gender: genderValue,
              sex: genderValue,
            };
          }
        } catch (_) {
          // Best-effort enrichment — continue with existing snapshot
        }
      }
      if (!snapshot) {
        // Fetch the freshest profile so the snapshot reflects the latest edits.
        const profRes = await api.get(`/api/users/profile/${user.username}?requester=${user.username}`);
        const p = profRes.data?.user || profRes.data || {};
        const fullName = `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.username || user.username;
        // Use gender from profile data (sex field in DB), fallback to current user's gender
        const gender = p.sex || p.gender || user.gender || user.sex || null;
        // The main app uses birthMonth / birthYear (no day). Synthesize a label
        // like "11/1995" for the card pill, plus an ISO-ish dob fallback for
        // anything that wants a real date.
        const rawDob = p.dob || p.dateOfBirth || null;
        const age = calcAge(rawDob, p.birthYear, p.birthMonth);
        let dobLabel = null;
        if (rawDob) {
          const parsed = new Date(rawDob);
          if (!Number.isNaN(parsed.getTime())) {
            dobLabel = parsed.toLocaleDateString('en-US', { month: '2-digit', year: 'numeric' });
          }
        } else if (p.birthMonth && p.birthYear) {
          dobLabel = `${String(p.birthMonth).padStart(2, '0')}/${p.birthYear}`;
        }
        const avatarPath = p.imageVisibility?.profilePic || p.images?.[0] || p.profileImage || null;
        // Height is stored in one of three shapes across the codebase:
        //   1. p.height           — already-formatted string ("5'8\"")
        //   2. p.heightFeet + p.heightInches (inches 0-11) — Register form shape
        //   3. p.heightInches alone — total inches int (search results)
        let heightLabel = null;
        if (p.height && String(p.height).trim()) {
          heightLabel = String(p.height).trim();
        } else if (p.heightFeet) {
          const inches = Number(p.heightInches) || 0;
          heightLabel = `${p.heightFeet}'${inches}"`;
        } else if (p.heightInches && Number(p.heightInches) > 11) {
          const total = Number(p.heightInches);
          heightLabel = `${Math.floor(total / 12)}'${total % 12}"`;
        }
        // Profile schema (see fastapi_backend/models/user_models.py + Register2.js):
        //   educationHistory: [{ level, degree, institution }]
        //   workExperience:   [{ status: 'current'|'past', workType, description, location }]
        //   partnerPreference: free-text "what I'm looking for" blurb
        //   customPartnerPreference: admin/user override (preferred when present)
        snapshot = {
          username: p.username || user.username,
          fullName,
          // Persist the raw path / token-less URL. buildImageUrl() injects
          // the CURRENT JWT at render time. Baking the token into the
          // snapshot would expire it ~30 min later → 401 → empty avatar.
          avatarUrl: avatarPath,
          age,
          dob: rawDob,
          dobLabel,
          height: heightLabel,
          gender,
          sex: gender,
          // Just the city — Education / Work are shown in their own sections.
          location: p.location || p.currentLocation || null,
          // Persist arrays exactly as stored — the renderer knows the schema.
          educationHistory: Array.isArray(p.educationHistory) ? p.educationHistory : [],
          workExperience: Array.isArray(p.workExperience) ? p.workExperience : [],
          // Static blurb at the bottom of the Introduction card. The wording is
          // gendered against the profile holder so it reads correctly to the
          // recipient: a male profile is "looking for a bride for our son",
          // a female profile is "looking for a groom for our daughter".
          // Falls back to a neutral phrasing if gender is missing/unknown.
          message: (() => {
            const g = String(gender || '').trim().toLowerCase();
            if (g === 'male' || g === 'm' || g === 'man') {
              return 'Looking for a suitable bride for our son — please review the profile for details and Contact me. Thanks';
            }
            if (g === 'female' || g === 'f' || g === 'woman') {
              return 'Looking for a suitable groom for our daughter — please review the profile for details and Contact me. Thanks';
            }
            return 'Looking for a suitable match — please review the profile for details and Contact me. Thanks';
          })(),
        };
      }
      const res = await api.post(`/api/messenger/conversations/${id}/messages`, {
        conversationId: id,
        contentType: 'profile_card',
        content: snapshot.message || '',
        cardSnapshot: snapshot,
      });

      const created = res?.data?.message;
      if (created) {
        // Legacy chats render from local `messages` state; non-legacy chats
        // render from the messenger store. Update whichever is in use so the
        // card shows immediately without waiting for a refresh / socket echo.
        if (isLegacy) {
          setMessages((prev) => {
            const next = Array.isArray(prev) ? [...prev] : [];
            next.push(created);
            return next;
          });
        } else {
          onStoreNewMessage(id, created);
        }
      } else {
        await loadMessages();
      }
    } catch (e) {
      console.error('❌ Failed to send profile card:', e);
      const detail = e?.response?.data?.detail;
      setSendError(typeof detail === 'string' && detail ? detail : 'Failed to send profile card');
    } finally {
      setSendingProfileCard(false);
    }
  };

  const handleUsernameClick = (uname) => {
    if (!uname || uname === user.username) return; // ignore own name / empty
    setUsernameModalTarget(uname);
  };

  const handleViewProfile = () => {
    const uname = usernameModalTarget;
    setUsernameModalTarget(null);
    if (!uname) return;
    const url = `${getMainAppUrl()}/profile/${encodeURIComponent(uname)}`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDirectMessage = () => {
    const uname = usernameModalTarget;
    setUsernameModalTarget(null);
    if (!uname) return;
    if (typeof onOpenDirectChat === 'function') {
      onOpenDirectChat(uname);
    }
  };

  // Profile card action handlers
  const handleAddToFavorites = async (card) => {
    setProfileCardMenuTarget(null);
    const username = card.username;
    if (!username) return;
    try {
      const api = useAuthStore.getState().getApi();
      await api.post(`/api/users/favorites/${username}`);
      setFavoritedUsernames(prev => new Set([...prev, username]));
    } catch (e) {
      console.error('Failed to add to favorites:', e);
    }
  };

  const handleRemoveFromFavorites = async (card) => {
    setProfileCardMenuTarget(null);
    const username = card.username;
    if (!username) return;
    try {
      const api = useAuthStore.getState().getApi();
      await api.delete(`/api/users/favorites/${username}`);
      setFavoritedUsernames(prev => {
        const newSet = new Set(prev);
        newSet.delete(username);
        return newSet;
      });
    } catch (e) {
      console.error('Failed to remove from favorites:', e);
    }
  };

  const handleDirectMessageFromCard = (card) => {
    setProfileCardMenuTarget(null);
    const username = card.username;
    if (!username) return;
    if (typeof onOpenDirectChat === 'function') {
      onOpenDirectChat(username);
    }
  };

  const handleViewProfileFromCard = (card) => {
    setProfileCardMenuTarget(null);
    const username = card.username;
    if (!username) return;
    const url = `${getMainAppUrl()}/profile/${encodeURIComponent(username)}`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleClearChat = async () => {
    setClearingChat(true);
    try {
      const api = useAuthStore.getState().getApi();
      if (isLegacy) {
        await api.post(`/api/users/messages/conversation/${name}/clear`);
      } else {
        await api.post(`/api/messenger/conversations/${id}/clear`);
      }
      setShowClearConfirm(false);
      if (isLegacy) {
        setMessages([]);
        await loadMessages();
      } else {
        useMessengerStore.setState((state) => ({
          messages: { ...(state.messages || {}), [id]: [] },
        }));
        await fetchStoreMessages(id);
      }
      console.log('🧹 Chat cleared from view');
    } catch (e) {
      console.error('❌ Failed to clear chat:', e);
      setError(e?.response?.data?.detail || 'Failed to clear chat');
    } finally {
      setClearingChat(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadMessages();
      // Fetch the conversation doc once to read messageRetentionHours so the
      // ⏱️ clock button shows the current value. Cheap GET; non-fatal on error.
      if (!isLegacy) {
        (async () => {
          try {
            const api = useAuthStore.getState().getApi();
            const res = await api.get(`/api/messenger/conversations/${id}?lite=true&include_unread_count=false`);
            const r = res?.data?.conversation?.messageRetentionHours;
            setRetentionHours(typeof r === 'number' && r > 0 ? r : null);
          } catch (e) {
            console.warn('⚠️ Failed to load conversation retention:', e?.message);
          }
        })();
      }
    }
  }, [id, isLegacy]);

  // Persist a new retention setting (admin/moderator only). `hours` may be
  // null to turn TTL off, or a positive integer to enable auto-delete.
  const saveRetention = async (hours) => {
    if (!isAdminOrModerator || isLegacy) return;
    setSavingRetention(true);
    try {
      const api = useAuthStore.getState().getApi();
      const res = await api.put(`/api/messenger/conversations/${id}/retention`, {
        retentionHours: hours,
      });
      setRetentionHours(res?.data?.retentionHours ?? null);
      setShowRetentionModal(false);
    } catch (e) {
      console.error('❌ Failed to save retention:', e);
      const detail = e?.response?.data?.detail;
      setSendError(typeof detail === 'string' ? detail : 'Failed to update retention');
      setShowRetentionModal(false);
    } finally {
      setSavingRetention(false);
    }
  };

  const loadMessages = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('📬 Loading messages for conversation:', id, 'isLegacy:', isLegacy);
      const api = useAuthStore.getState().getApi();
      let res;
      if (isLegacy) {
        // Legacy 1:1 main app messages
        res = await api.get(`/api/users/messages/conversation/${name}?username=${user.username}`);
      } else {
        await fetchStoreMessages(id);
        setMessages(useMessengerStore.getState().messages[id] ?? EMPTY_MESSAGES);
        return;
      }
      console.log('✅ API Response:', res.data);

      // Handle different response structures
      const msgs = Array.isArray(res.data) ? res.data : res.data.messages || [];
      console.log('✅ Messages loaded:', msgs.length);
      setMessages(msgs);
    } catch (e) {
      console.error('❌ Failed to load messages:', e);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  // Parse @{email} mentions from message content
  // Supports both @{email} and @email formats
  const parsePublicRecipients = (text) => {
    const recipients = [];

    // Try @{email} format first
    const curlyBraceRegex = /@\{([^}]+)\}/g;
    let match;
    while ((match = curlyBraceRegex.exec(text)) !== null) {
      const content = match[1];
      // Parse "Name <email>" or just "email"
      const emailMatch = content.match(/(?:([^<]+)<)?([^>]+)>?/);
      if (emailMatch) {
        const displayName = emailMatch[1]?.trim();
        const email = emailMatch[2]?.trim();
        if (email && email.includes('@')) {
          recipients.push({
            email,
            displayName: displayName || email,
          });
        }
      }
    }

    // Also support simple @email format (without curly braces)
    const simpleEmailRegex = /@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    while ((match = simpleEmailRegex.exec(text)) !== null) {
      const email = match[1];
      recipients.push({
        email,
        displayName: email.split('@')[0],
      });
    }

    return recipients;
  };

  // Run the pre-flight check that powers the status bubbles in the modal.
  // Tolerant to backend errors: we still open the modal so the user can decide,
  // but bubbles won't render. The actual send is still server-enforced.
  const runRecipientCheck = async (recipients) => {
    setRecipientChecks({});
    setCheckingRecipients(true);
    try {
      const api = useAuthStore.getState().getApi();
      const res = await api.post(
        `/api/messenger/conversations/${id}/check-recipients`,
        { emails: recipients.map((r) => r.email) },
      );
      const byEmail = {};
      for (const r of (res.data?.recipients || [])) {
        byEmail[(r.email || '').toLowerCase()] = r;
      }
      setRecipientChecks(byEmail);
      // Trust the server's role evaluation rather than re-deriving from local
      // auth state — keeps the UI consistent with the backend gate.
      setSenderCanInvite(res.data?.senderCanInvite !== false);
    } catch (e) {
      console.warn('⚠️ check-recipients failed, modal will render without bubbles:', e?.message);
      // Fail-open on bubbles but fail-closed on role if the user has no role.
      const localRole = useAuthStore.getState().user?.role;
      setSenderCanInvite(localRole === 'admin' || localRole === 'moderator');
    } finally {
      setCheckingRecipients(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    // Check for public recipients (US Vedika / Portal Members @{email} flow).
    // Only admins/moderators can invite via @{email}; for everyone else the
    // token is treated as plain text — no modal, no parsing, no actionable
    // recipient. The backend also enforces the role gate (defense in depth);
    // this client-side check is a UX cleanup so non-privileged users don't see
    // a modal that would just be blocked anyway.
    const role = useAuthStore.getState().user?.role;
    const canInvite = role === 'admin' || role === 'moderator';

    if (canInvite && !isLegacy) {
      const recipients = parsePublicRecipients(newMessage);
      if (recipients.length > 0) {
        // Show modal for public recipients + kick off pre-flight in parallel
        setPublicRecipients(recipients);
        setShowPublicRecipientModal(true);
        runRecipientCheck(recipients); // fire-and-forget; updates state when done
        return;
      }
    }

    setSending(true);
    try {
      console.log('📤 Sending message:', isLegacy ? 'legacy' : 'messenger', id);
      const api = useAuthStore.getState().getApi();
      let res;
      if (isLegacy) {
        res = await api.post('/api/users/messages/send', {
          toUsername: name,
          content: newMessage.trim(),
        });
      } else {
        const msg = await sendStoreMessage(id, newMessage.trim(), 'text');
        if (!msg) {
          throw new Error('Failed to send message');
        }
        res = { data: { success: true, message: msg } };
      }
      console.log('✅ Message sent successfully:', res.data);
      setNewMessage('');
      if (isLegacy) {
        await loadMessages();
      }
    } catch (e) {
      console.error('❌ Failed to send message:', e);
      console.error('❌ Error response:', e.response?.data);
      // Surface the backend's detail string so users (and you) can see WHY
      // a 403/400 was raised — e.g. paused account, exclusion, profanity.
      const detail = e?.response?.data?.detail;
      setSendError(typeof detail === 'string' && detail ? detail : 'Failed to send message');
      // Keep `newMessage` populated so the user can tap Send again to retry.
    } finally {
      setSending(false);
    }
  };

  const sendWithPublicRecipients = async (deliveryMode) => {
    setShowPublicRecipientModal(false);
    setRecipientChecks({});
    setSending(true);
    try {
      console.log('📤 Sending message with public recipients:', publicRecipients);
      const api = useAuthStore.getState().getApi();
      const res = await api.post(`/api/messenger/conversations/${id}/messages`, {
        conversationId: id,
        contentType: 'text',
        content: newMessage.trim(),
        publicRecipients,
        deliveryMode,
        includeInvitation,
      });
      console.log('✅ Message sent successfully:', res.data);
      setNewMessage('');
      setPublicRecipients([]);
      if (res?.data?.message) {
        onStoreNewMessage(id, res.data.message);
      }
    } catch (e) {
      console.error('❌ Failed to send message:', e);
      console.error('❌ Error response:', e.response?.data);
      const detail = e?.response?.data?.detail;
      setSendError(typeof detail === 'string' && detail ? detail : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {profile && (profile.firstName || profile.lastName)
              ? `${profile.firstName} ${profile.lastName}`.trim()
              : name}
          </Text>
          {isGroup ? (
            <Text style={styles.headerSubtitle}>Group Chat</Text>
          ) : username && typeof isOnline === 'function' ? (
            <View style={styles.headerStatusRow}>
              <View
                style={[
                  styles.headerStatusInlineDot,
                  isOnline(username) && styles.headerStatusInlineDotOnline,
                ]}
              />
              <Text
                style={[
                  styles.headerSubtitle,
                  isOnline(username) && styles.headerSubtitleOnline,
                ]}
              >
                {isOnline(username) ? 'Online' : 'Offline'}
              </Text>
            </View>
          ) : null}
        </View>
        {/* ⏱️ Retention button — shows current TTL (e.g. "24h"); opens picker.
            Admin/moderator only. Hidden on legacy main-app chats since retention
            is a messenger-only feature. */}
        {!isLegacy && isAdminOrModerator && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setShowRetentionModal(true)}
            disabled={savingRetention}
          >
            <Text style={styles.iconButtonText}>⏱️</Text>
            {retentionHours ? (
              <Text style={styles.iconButtonBadge}>
                {retentionHours >= 24 && retentionHours % 24 === 0
                  ? `${retentionHours / 24}d`
                  : `${retentionHours}h`}
              </Text>
            ) : null}
          </TouchableOpacity>
        )}
        {/* Clear Chat — admin/moderator only (destructive action) */}
        {isAdminOrModerator && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setShowClearConfirm(true)}
          >
            <Text style={styles.iconButtonText}>🗑️</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Messages and Input container */}
      <View style={{ flex: 1 }}>
        {/* Messages */}
        {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e94560" />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadMessages}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
        >
          {!socketConnected && (
            <View style={styles.reconnectBanner}>
              <Text style={styles.reconnectBannerText}>
                Reconnecting… new messages will appear once you're back online.
              </Text>
            </View>
          )}
          {displayMessages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubText}>Start the conversation!</Text>
            </View>
          ) : (
            displayMessages.map((msg) => {
              const isOwn = msg.senderUsername === user.username || msg.fromUsername === user.username;
              const isPublicEmail = msg.senderType === 'public_email';
              const canDelete = !isLegacy && isOwn && !msg.isDeleted && Boolean(msg.id) && !msg.isOptimistic;
              const isActivationIntro =
                msg.senderUsername === 'L3V3LMatchAgent' &&
                msg.contentType === 'profile_card' &&
                msg.cardSnapshot &&
                (msg.cardSnapshot.systemTag === 'newly_activated' || msg.cardSnapshot.systemTag === 'reactivated');
              const senderName = isGroup && !isOwn ? (msg.senderUsername || msg.fromUsername || 'Unknown') : null;
              const publicEmailsSent = Array.isArray(msg.publicEmailsSent) ? msg.publicEmailsSent : [];
              return (
                <View key={msg.id} style={[styles.messageRow, isOwn && styles.messageRowOwn]}>
                  <View style={[
                    styles.messageBubble,
                    isOwn && styles.messageBubbleOwn,
                    isPublicEmail && styles.messageBubblePublic,
                    msg.contentType === 'profile_card' && styles.messageBubbleCard,
                  ]}>
                    {isPublicEmail ? (
                      <Text style={styles.publicEmailBadge}>📧 {msg.publicEmail || msg.senderUsername}</Text>
                    ) : isActivationIntro ? (
                      <View style={styles.systemIntroHeader}>
                        <Text style={styles.systemSender}>{msg.senderUsername}</Text>
                        <View style={styles.systemBadge}>
                          <Text style={styles.systemBadgeText}>
                            {msg.cardSnapshot.systemLabel || 'Newly activated'}
                          </Text>
                        </View>
                      </View>
                    ) : isGroup && senderName && !isOwn && (
                      <TouchableOpacity onPress={() => handleUsernameClick(senderName)}>
                        <Text style={styles.senderName}>{senderName}</Text>
                      </TouchableOpacity>
                    )}
                    {msg.isDeleted ? (
                      <Text style={[styles.messageText, isOwn && styles.messageTextOwn]}>Message deleted</Text>
                    ) : msg.contentType === 'profile_card' && msg.cardSnapshot ? (
                      <ProfileCard
                        card={msg.cardSnapshot}
                        isOwn={isOwn}
                        isFavorited={favoritedUsernames.has(msg.cardSnapshot.username)}
                        currentUserGender={user?.gender}
                        onMenuOpen={(card) => setProfileCardMenuTarget(card)}
                        onUsernameClick={(uname) => {
                          // Tapping the profile name on the card jumps straight
                          // to the main app's /profile/:username page in a new
                          // tab. Skips the View-Profile/Direct-Message chooser
                          // modal that group-chat sender names use, since on a
                          // profile card the intent is unambiguous.
                          if (!uname) return;
                          const url = `${getMainAppUrl()}/profile/${encodeURIComponent(uname)}`;
                          if (typeof window !== 'undefined') {
                            window.open(url, '_blank', 'noopener,noreferrer');
                          }
                        }}
                      />
                    ) : msg.content ? (
                      <Text style={[styles.messageText, isOwn && styles.messageTextOwn]}>
                        {msg.content}
                      </Text>
                    ) : null}

                    {/* US Vedika invitation recipients — show current activation
                        status for each @{email} that was invited via this message. */}
                    {publicEmailsSent.length > 0 && (
                      <View style={styles.recipientsList}>
                        <Text style={styles.recipientsListTitle}>
                          Invited recipient{publicEmailsSent.length > 1 ? 's' : ''}
                        </Text>
                        {publicEmailsSent.map((r, idx) => {
                          const meta = getPublicEmailStatusMeta(r.status);
                          return (
                            <View
                              key={`${r.email}-${idx}`}
                              style={styles.recipientRow}
                            >
                              <Text style={styles.recipientEmail} numberOfLines={1}>
                                📧 {r.displayName && r.displayName !== r.email
                                  ? `${r.displayName} <${r.email}>`
                                  : r.email}
                              </Text>
                              <View
                                style={[
                                  styles.recipientStatusPill,
                                  { backgroundColor: meta.bg, borderColor: meta.color },
                                ]}
                              >
                                <Text style={[styles.recipientStatusText, { color: meta.color }]}>
                                  {meta.label}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}

                    <View style={styles.messageMetaRow}>
                      <Text style={styles.messageTime}>
                        {msg.status === 'sending' ? 'Sending…'
                          : msg.status === 'failed' ? 'Failed — tap Send to retry'
                          : (() => {
                              const d = new Date(msg.createdAt);
                              if (Number.isNaN(d.getTime())) return '';
                              const date = d.toLocaleDateString([], { month: '2-digit', day: '2-digit' });
                              const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                              return `${date} ${time}`;
                            })()}
                      </Text>
                      {canDelete && (
                        <TouchableOpacity
                          onPress={async () => {
                            if (armedDeleteId !== msg.id) {
                              setArmedDeleteId(msg.id);
                              return;
                            }
                            setArmedDeleteId(null);
                            const ok = await deleteStoreMessage(msg.id, id);
                            if (!ok) setSendError('Failed to delete message');
                          }}
                          style={styles.messageActionBtn}
                        >
                          <Text style={[styles.messageTime, styles.messageActionIcon]}>
                            {armedDeleteId === msg.id ? '✓' : '🗑️'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'position'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Inline send-error banner — shown when the most recent send failed.
            Keeps the chat view intact and lets the user fix or retry without
            losing what they typed. Tap "Dismiss" to clear; editing the input
            also clears the banner so a fresh attempt feels clean. */}
        {sendError && (
          <View style={styles.sendErrorBanner}>
            <Text style={styles.sendErrorText} numberOfLines={3}>{sendError}</Text>
            <TouchableOpacity onPress={() => setSendError(null)} style={styles.sendErrorDismiss}>
              <Text style={styles.sendErrorDismissText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputContainer}>
          {/* ⚡ Quick Messages — hidden for legacy 1:1 chats since they don't
              support rich content types like profile_card. */}
          {!isLegacy && name === 'Portal Members' && (
            <TouchableOpacity
              style={[styles.quickBtn, isMobile && styles.quickBtnMobile]}
              onPress={() => setShowQuickMessages(true)}
              disabled={sendingProfileCard}
            >
              {sendingProfileCard
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.quickBtnText}>⚡</Text>}
            </TouchableOpacity>
          )}
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={(t) => { setNewMessage(t); if (sendError) setSendError(null); }}
            placeholder="Type a message..."
            placeholderTextColor="#888"
            multiline
            onKeyPress={({ nativeEvent }) => {
              if (nativeEvent.key === 'Enter' && (nativeEvent.ctrlKey || nativeEvent.metaKey)) {
                sendMessage();
              }
            }}
          />
          <TouchableOpacity
            style={[styles.sendButton, isMobile && styles.sendButtonMobile, !newMessage.trim() && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={sending || !newMessage.trim()}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.sendButtonText}>{isMobile ? '➤' : 'Send'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      </View>

      {/* Quick Messages picker — opens from the ⚡ button. Only "Introduction"
          is wired up to a real action (sends a profile_card). The others are
          visible placeholders so users see the planned set. */}
      {showQuickMessages && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>⚡ Quick Messages</Text>
            <View style={styles.quickGrid}>
              {QUICK_MESSAGE_CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.quickChip, !c.enabled && styles.quickChipDisabled]}
                  onPress={() => {
                    if (!c.enabled) return;
                    if (c.id === 'introduction') sendProfileCard();
                  }}
                  disabled={!c.enabled}
                  activeOpacity={c.enabled ? 0.7 : 1}
                >
                  <Text style={styles.quickChipText}>
                    {c.icon} {c.label}{!c.enabled ? '  ·  soon' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.modalButtonCancel}
              onPress={() => setShowQuickMessages(false)}
            >
              <Text style={styles.modalButtonTextCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Retention picker — Off / 24h / 48h / 7d. Hits PUT /retention which
          is gated on admin/moderator server-side; the UI is also gated above. */}
      {showRetentionModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>⏱️ Message Retention</Text>
            <Text style={styles.modalText}>
              New messages will auto-delete after the chosen window. Existing
              messages keep their original lifetime.
            </Text>
            <View style={styles.quickGrid}>
              {[
                { label: 'Off',     value: null },
                { label: '24 hours', value: 24 },
                { label: '48 hours', value: 48 },
                { label: '7 days',   value: 24 * 7 },
              ].map((opt) => {
                const selected = (retentionHours || null) === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.label}
                    style={[styles.quickChip, selected && styles.quickChipSelected]}
                    onPress={() => saveRetention(opt.value)}
                    disabled={savingRetention}
                  >
                    <Text style={styles.quickChipText}>
                      {selected ? '✓ ' : ''}{opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={styles.modalButtonCancel}
              onPress={() => setShowRetentionModal(false)}
              disabled={savingRetention}
            >
              <Text style={styles.modalButtonTextCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Clear Chat Confirmation Modal */}
      {showClearConfirm && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>🧹 Clear Chat?</Text>
            <Text style={styles.modalText}>
              This will hide all current messages from your view only.
              {isGroup ? ' Other participants will still see them.' : ' The other person will still see the messages on their side.'}
            </Text>
            <Text style={styles.modalText}>
              New messages will continue to appear normally.
            </Text>

            <TouchableOpacity
              style={styles.modalButtonPrimary}
              onPress={handleClearChat}
              disabled={clearingChat}
            >
              <Text style={styles.modalButtonTextPrimary}>
                {clearingChat ? 'Clearing...' : 'Yes, Clear Chat'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalButtonCancel}
              onPress={() => setShowClearConfirm(false)}
              disabled={clearingChat}
            >
              <Text style={styles.modalButtonTextCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Profile Card Actions Modal — appears when user taps ⋮ on a profile card */}
      {profileCardMenuTarget && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>👤 {profileCardMenuTarget.fullName || profileCardMenuTarget.username}</Text>
            <Text style={styles.modalText}>What would you like to do?</Text>

            {(() => {
              const normalizeGender = (g) => g ? String(g).trim().toLowerCase() : '';
              const currentG = normalizeGender(user?.gender);
              const cardG = normalizeGender(profileCardMenuTarget.gender || profileCardMenuTarget.sex);
              const isMale = ['male', 'm', 'man'].includes(currentG);
              const cardIsMale = ['male', 'm', 'man'].includes(cardG);
              const isFemale = ['female', 'f', 'woman'].includes(currentG);
              const cardIsFemale = ['female', 'f', 'woman'].includes(cardG);
              // Show actions if either gender is missing OR if genders are opposite
              return !currentG || !cardG || (isMale && cardIsFemale) || (isFemale && cardIsMale);
            })() && (
              <>
                <TouchableOpacity
                  style={styles.modalButtonPrimary}
                  onPress={() => favoritedUsernames.has(profileCardMenuTarget.username)
                    ? handleRemoveFromFavorites(profileCardMenuTarget)
                    : handleAddToFavorites(profileCardMenuTarget)
                  }
                >
                  <Text style={styles.modalButtonTextPrimary}>
                    {favoritedUsernames.has(profileCardMenuTarget.username) ? '💔 Remove from Favorites' : '⭐ Add to Favorites'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalButtonPrimary}
                  onPress={() => handleDirectMessageFromCard(profileCardMenuTarget)}
                >
                  <Text style={styles.modalButtonTextPrimary}>💬 Direct Message</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={styles.modalButtonPrimary}
              onPress={() => handleViewProfileFromCard(profileCardMenuTarget)}
            >
              <Text style={styles.modalButtonTextPrimary}>👁 View Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalButtonCancel}
              onPress={() => setProfileCardMenuTarget(null)}
            >
              <Text style={styles.modalButtonTextCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Username Action Modal — appears when a sender's name is tapped in
          a group chat bubble. Offers View Profile (opens main app /profile/:username
          in a new tab) and Direct Message (opens a 1:1 chat with that user). */}
      {usernameModalTarget && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>👤 @{usernameModalTarget}</Text>
            <Text style={styles.modalText}>What would you like to do?</Text>

            <TouchableOpacity
              style={styles.modalButtonPrimary}
              onPress={handleViewProfile}
            >
              <Text style={styles.modalButtonTextPrimary}>👁  View Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalButtonPrimary}
              onPress={handleDirectMessage}
            >
              <Text style={styles.modalButtonTextPrimary}>💬  Direct Message</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalButtonCancel}
              onPress={() => setUsernameModalTarget(null)}
            >
              <Text style={styles.modalButtonTextCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Public Recipient Modal */}
      {showPublicRecipientModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>📧 Messaging Non-Members</Text>

            {/* Role-based block banner (only admins/moderators can invite) */}
            {!senderCanInvite && (
              <View style={styles.modalRoleBanner}>
                <Text style={styles.modalRoleBannerText}>
                  🚫 Only administrators or moderators can invite external participants by email.
                </Text>
              </View>
            )}

            <Text style={styles.modalText}>
              This message will be delivered by email to:
            </Text>

            {/* Recipient list with status bubbles per email */}
            {publicRecipients.map((recipient, index) => {
              const check = recipientChecks[recipient.email.toLowerCase()];
              const invCount = check?.invitationCount || 0;
              // Throttle: 2+ existing invitations means the admin should manage
              // the recipient via the main-app invitation queue, not re-invite.
              const isThrottled = invCount >= 2;
              return (
                <View key={index} style={styles.recipientRow}>
                  <Text style={styles.recipientText}>
                    • {recipient.displayName} ({recipient.email})
                  </Text>
                  {/* Status bubbles — only render once the pre-flight has resolved. */}
                  {check && (
                    <View style={styles.bubbleRow}>
                      {check.isMember && (
                        <View style={[styles.statusBubble, styles.bubbleMember]}>
                          <Text style={styles.statusBubbleText}>
                            ✅ Existing member{check.memberUsername ? `: @${check.memberUsername}` : ''}
                          </Text>
                        </View>
                      )}
                      {check.alreadyInConversation && (
                        <View style={[styles.statusBubble, styles.bubbleAlreadySent]}>
                          <Text style={styles.statusBubbleText}>
                            📨 Already in this conversation{check.lastSentAt ? ` · ${formatRelative(check.lastSentAt)}` : ''}
                          </Text>
                        </View>
                      )}
                      {check.hasActiveInvitation && (
                        <View style={[styles.statusBubble, styles.bubbleInvited]}>
                          <Text style={styles.statusBubbleText}>
                            ✉️ Invited{invCount > 1 ? ` · ${invCount}×` : ''}{check.invitationStatus ? ` (${check.invitationStatus})` : ''}{check.invitationSentAt ? ` · ${formatRelative(check.invitationSentAt)}` : ''}
                          </Text>
                        </View>
                      )}
                      {isThrottled && (
                        <View style={[styles.statusBubble, styles.bubbleThrottled]}>
                          <Text style={styles.statusBubbleText}>
                            ⛔ Throttled — manage in invitation queue
                          </Text>
                        </View>
                      )}
                      {!check.isMember && !check.alreadyInConversation && !check.hasActiveInvitation && (
                        <View style={[styles.statusBubble, styles.bubbleNew]}>
                          <Text style={styles.statusBubbleText}>🆕 New recipient</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}

            {checkingRecipients && (
              <Text style={styles.checkingText}>Checking recipients…</Text>
            )}

            {/* Throttle banner — shown when ANY recipient has 2+ prior invitations.
                Hard-blocks Send + Invite and routes the admin to the main app's
                invitation queue where they can resend / archive / convert. */}
            {(() => {
              const throttled = publicRecipients.filter((r) => {
                const c = recipientChecks[r.email.toLowerCase()];
                return c && (c.invitationCount || 0) >= 2;
              });
              if (throttled.length === 0) return null;
              return (
                <View style={styles.modalRoleBanner}>
                  <Text style={styles.modalRoleBannerText}>
                    ⛔ {throttled.length === 1
                      ? `${throttled[0].email} has already been invited 2+ times.`
                      : `${throttled.length} recipients have already been invited 2+ times.`}{' '}
                    Please check the Invitation Queue in the main app to resend,
                    archive, or convert the existing invitation.
                  </Text>
                  <TouchableOpacity
                    style={styles.inviteQueueLinkBtn}
                    onPress={() => {
                      if (typeof window !== 'undefined') {
                        window.open(`${getMainAppUrl()}/invitations`, '_blank', 'noopener,noreferrer');
                      }
                    }}
                  >
                    <Text style={styles.inviteQueueLinkText}>Open Invitation Queue ↗</Text>
                  </TouchableOpacity>
                </View>
              );
            })()}

            <Text style={styles.modalSubtext}>Choose how to send:</Text>

            {/* Send + Invite Button — disabled if:
                  • sender lacks the admin/moderator role, OR
                  • any recipient has 2+ prior invitations (throttle). */}
            {(() => {
              const anyThrottled = publicRecipients.some((r) => {
                const c = recipientChecks[r.email.toLowerCase()];
                return c && (c.invitationCount || 0) >= 2;
              });
              const canSend = senderCanInvite && !anyThrottled;
              return (
                <TouchableOpacity
                  style={[
                    styles.modalButtonPrimary,
                    !canSend && styles.modalButtonDisabled,
                  ]}
                  onPress={() => canSend && sendWithPublicRecipients('both')}
                  disabled={!canSend}
                  activeOpacity={canSend ? 0.7 : 1}
                >
                  <Text style={styles.modalButtonTextPrimary}>
                    ✉️ Send + Invite
                  </Text>
                  <Text style={styles.modalButtonSubtext}>
                    {!senderCanInvite
                      ? 'Requires admin or moderator role'
                      : anyThrottled
                        ? 'Blocked — manage existing invitation in main app'
                        : 'Email includes "Join L3V3L" button'}
                  </Text>
                </TouchableOpacity>
              );
            })()}

            {/* Send Only Button — DISABLED.
                We require every external recipient to be onboarded via the
                "Send + Invite" path so the funnel/lineage stays intact.
                Keeping the button visible (greyed) explains the constraint
                rather than silently removing the option. */}
            <TouchableOpacity
              style={[styles.modalButtonSecondary, styles.modalButtonDisabled]}
              disabled={true}
              activeOpacity={1}
            >
              <Text style={styles.modalButtonTextSecondary}>
                📨 Send Message Only
              </Text>
              <Text style={styles.modalButtonSubtext}>
                Disabled — please use "Send + Invite"
              </Text>
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.modalButtonCancel}
              onPress={() => {
                setShowPublicRecipientModal(false);
                setPublicRecipients([]);
                setRecipientChecks({});
              }}
            >
              <Text style={styles.modalButtonTextCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#16213e',
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  backButton: { padding: 8, marginRight: 8 },
  backButtonText: { fontSize: 20, color: '#e94560' },
  headerInfo: { flex: 1, flexDirection: 'column' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  headerMeta: { fontSize: 11, color: '#888', marginTop: 2 },
  headerSubtitle: { fontSize: 11, color: '#888' },
  headerSubtitleOnline: { color: '#22c55e' },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  headerStatusInlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6b7280',
    marginRight: 6,
  },
  headerStatusInlineDotOnline: {
    backgroundColor: '#22c55e',
  },

  // Invited-recipient list (US Vedika @{email} status)
  recipientsList: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
  },
  recipientsListTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#a3a3c2',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  recipientEmail: {
    flex: 1,
    fontSize: 12,
    color: '#cbd5e1',
    marginRight: 8,
  },
  recipientStatusPill: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  recipientStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  messagesContainer: { flex: 1 },
  messagesContent: { padding: 16, flexGrow: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { color: '#888', marginTop: 12, fontSize: 14 },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: { color: '#e94560', fontSize: 14, marginBottom: 16, textAlign: 'center' },
  retryBtn: {
    backgroundColor: 'rgba(233, 69, 96, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e94560',
  },
  retryBtnText: { color: '#e94560', fontSize: 14, fontWeight: '600' },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: { color: '#fff', fontSize: 18, marginBottom: 8 },
  emptySubText: { color: '#888', fontSize: 14 },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  messageRowOwn: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    backgroundColor: '#16213e',
    padding: 12,
    borderRadius: 12,
    maxWidth: '75%',
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  messageBubbleOwn: {
    backgroundColor: '#e94560',
    borderColor: '#e94560',
  },
  messageText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextOwn: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
    textAlign: 'right',
  },
  messageMetaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  messageActionBtn: {
    marginLeft: 8,
  },
  messageActionIcon: {
    marginTop: 0,
    fontSize: 10,
    textAlign: 'left',
  },
  reconnectBanner: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderColor: 'rgba(234, 179, 8, 0.4)',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
    alignSelf: 'center',
  },
  reconnectBannerText: {
    color: '#facc15',
    fontSize: 12,
    fontWeight: '600',
  },
  senderName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#e94560',
    marginBottom: 4,
  },
  systemIntroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  systemSender: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e94560',
    marginRight: 8,
  },
  systemBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  systemBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34d399',
  },
  publicEmailBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6366f1',
    marginBottom: 4,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  messageBubblePublic: {
    backgroundColor: '#1e1e3f',
    borderColor: '#6366f1',
  },
  // Profile-card bubbles get a wider, responsive width so the card content
  // (avatar + sections) has room to breathe and scales with the viewport.
  messageBubbleCard: {
    width: '85%',
    maxWidth: 520,
  },
  sendErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  sendErrorText: {
    flex: 1,
    color: '#fca5a5',
    fontSize: 13,
    lineHeight: 18,
  },
  sendErrorDismiss: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sendErrorDismissText: {
    color: '#fca5a5',
    fontSize: 14,
    fontWeight: '700',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#16213e',
    borderTopWidth: 1,
    borderTopColor: '#0f3460',
  },
  input: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    color: '#fff',
    padding: 12,
    borderRadius: 20,
    maxHeight: 100,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#0f3460',
    marginRight: 8,
    height: 44,
  },
  sendButton: {
    backgroundColor: '#e94560',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    minWidth: 70,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonMobile: {
    paddingHorizontal: 0,
    minWidth: 36,
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  sendButtonDisabled: {
    backgroundColor: '#333',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  // Modal styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContainer: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 14,
    color: '#e0e0e0',
    marginBottom: 12,
    lineHeight: 20,
  },
  recipientText: {
    fontSize: 14,
    color: '#e94560',
    marginLeft: 12,
  },
  recipientRow: {
    marginBottom: 8,
  },
  bubbleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: 18,
    marginTop: 4,
  },
  statusBubble: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 6,
    marginBottom: 4,
    borderWidth: 1,
  },
  statusBubbleText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  // Green — recipient is already a registered member
  bubbleMember: {
    backgroundColor: 'rgba(34, 197, 94, 0.18)',
    borderColor: 'rgba(34, 197, 94, 0.55)',
  },
  // Amber — duplicate in this conversation
  bubbleAlreadySent: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderColor: 'rgba(245, 158, 11, 0.55)',
  },
  // Blue — invitation already in flight
  bubbleInvited: {
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    borderColor: 'rgba(59, 130, 246, 0.55)',
  },
  // Neutral — net-new recipient
  bubbleNew: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    borderColor: 'rgba(148, 163, 184, 0.45)',
  },
  // Red — recipient has 2+ prior invitations; admin must use main app queue
  bubbleThrottled: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderColor: 'rgba(239, 68, 68, 0.55)',
  },
  // Link-style button inside the throttle banner that opens the main app
  // /invitations page in a new tab.
  inviteQueueLinkBtn: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.55)',
    alignSelf: 'flex-start',
  },
  inviteQueueLinkText: {
    color: '#fca5a5',
    fontSize: 13,
    fontWeight: '600',
  },
  checkingText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginLeft: 18,
    marginTop: 4,
    fontStyle: 'italic',
  },
  modalRoleBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.5)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    marginBottom: 12,
  },
  modalRoleBannerText: {
    color: '#fca5a5',
    fontSize: 13,
    fontWeight: '600',
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'column',
    marginLeft: 12,
  },
  // Shared tiny header icon button (⏱️ retention, 🗑️ clear chat).
  // Kept small so the chat header stays compact on narrow screens.
  iconButton: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginLeft: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButtonText: {
    fontSize: 13,
    lineHeight: 16,
  },
  iconButtonBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#bfdbfe',
    marginLeft: 4,
  },
  modalSubtext: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 12,
  },
  modalButtonPrimary: {
    backgroundColor: '#10b981',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalButtonTextPrimary: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modalButtonSecondary: {
    backgroundColor: '#6366f1',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalButtonDisabled: {
    opacity: 0.45,
    backgroundColor: '#4b5563',
  },
  modalButtonTextSecondary: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modalButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  modalButtonCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6b7280',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonTextCancel: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  // ⚡ Quick Messages button on the composer.
  quickBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0f3460',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#1e3a5f',
  },
  quickBtnMobile: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 6,
  },
  quickBtnText: {
    fontSize: 18,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 16,
  },
  quickChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.55)',
    marginRight: 8,
    marginBottom: 8,
  },
  quickChipDisabled: {
    backgroundColor: 'rgba(148, 163, 184, 0.10)',
    borderColor: 'rgba(148, 163, 184, 0.35)',
    opacity: 0.6,
  },
  quickChipSelected: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderColor: 'rgba(16, 185, 129, 0.7)',
  },
  quickChipText: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
  },
});

// Profile-card styles. Kept separate from the main `styles` sheet so the card
// is self-contained and easy to extract into its own component later.
const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#0f1a33',
    borderWidth: 1,
    borderColor: '#1e3a5f',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    alignSelf: 'stretch',
    width: '100%',
  },
  cardOwn: {
    backgroundColor: '#102043',
    borderColor: '#1e3a5f',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: '#1e3a5f',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  headerText: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heartEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  menuButton: {
    padding: 8,
    marginLeft: 8,
    alignSelf: 'flex-start',
  },
  menuButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 20,
  },
  name: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  pill: {
    backgroundColor: 'rgba(59, 130, 246, 0.20)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.45)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    marginRight: 3,
    marginBottom: 3,
  },
  pillText: {
    color: '#bfdbfe',
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 13,
  },
  subPill: {
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.45)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  subPillText: {
    color: '#c7d2fe',
    fontSize: 10,
    lineHeight: 13,
  },
  section: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    lineHeight: 13,
  },
  row: {
    marginTop: 4,
  },
  rowTitle: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
  rowText: {
    color: '#cbd5e1',
    fontSize: 11,
    marginTop: 1,
    lineHeight: 14,
  },
  message: {
    marginTop: 12,
    color: '#e5e7eb',
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
