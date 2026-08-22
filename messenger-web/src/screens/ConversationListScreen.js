import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Image, Linking } from 'react-native';
import useMessengerStore from '@messenger/stores/messengerStore';
import useAuthStore from '@messenger/stores/authStore';
import { API_BASE_URL } from '@messenger/config/api';
import ChatScreen from './ChatScreen';
import OnlineDot from '../components/OnlineDot';
import useOnlinePresence from '../hooks/useOnlinePresence';
import { getMainAppUrl as getMainAppUrlFromConfig } from '../config/apiConfig';
import { openExternalUrl } from '../utils/openExternalUrl';

// Messenger-web app version (shown in the About section of the profile panel)
const APP_VERSION = '0.1.0';

// Main matrimonial app URL — profile editing lives there, not in messenger-web.
const getMainAppUrl = () => {
  return getMainAppUrlFromConfig();
};

export default function ConversationListScreen({ onChatOpen, onNewChat, onLogout }) {
  const [activeTab, setActiveTab] = useState('messages');
  const [error, setError] = useState(null);
  const [allConversations, setAllConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState({ groups: true, direct: true });
  const [selectedChat, setSelectedChat] = useState(null);
  const [portalGroup, setPortalGroup] = useState(null);
  const [l3v3lAgentConv, setL3v3lAgentConv] = useState(null);
  const [pendingOpenAllTopic, setPendingOpenAllTopic] = useState(null); // 'portal' | 'agent' | null
  // US Vedika group is hidden in messenger-web (L3V3L Members is the canonical
  // @{email}-invite group now). Backend endpoints remain live for analytics and
  // existing invitations. See routes /api/messenger/us-vedika/*.
  const [userProfile, setUserProfile] = useState(null);
  // Blocked users (shown on profile tab)
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [blockedError, setBlockedError] = useState(null);
  const [unblockingUser, setUnblockingUser] = useState(null); // username currently being unblocked
  // Active members count for L3V3L Members menu item badge
  const [activeMembersCount, setActiveMembersCount] = useState(null);
  const [myMessagesCount, setMyMessagesCount] = useState(0);
  const [l3v3lAgentCount, setL3v3lAgentCount] = useState(0);
  // Lazy notification system state
  const [notifications, setNotifications] = useState(null);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [showNotificationBanner, setShowNotificationBanner] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [searchDescription, setSearchDescription] = useState('');
  // Notification preferences (for Settings section)
  const [notifPrefs, setNotifPrefs] = useState({
    newMatches: { enabled: true, fields: { name: true, age: true, height: true, location: true, education: true, profession: true }, lookbackDays: 7 },
    pendingMessages: { enabled: true },
    tips: { enabled: true },
    pollExpiration: { enabled: true },
    profileCardWeeklyPost: { enabled: true },
  });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsToast, setPrefsToast] = useState(null); // { message, type }
  const [profileSubTab, setProfileSubTab] = useState('profile'); // 'profile' | 'apps'
  const [timerInputSeconds, setTimerInputSeconds] = useState('60');
  const [timerRemainingSeconds, setTimerRemainingSeconds] = useState(60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [beeperSecondsInput, setBeeperSecondsInput] = useState('5');
  const [beeperRunning, setBeeperRunning] = useState(false);

  const {
    conversations,
    isLoadingConversations,
    fetchConversations,
  } = useMessengerStore();

  const { user } = useAuthStore();

  const openMainAppWithSso = async (redirectPath = '/dashboard') => {
    const mainAppUrl = getMainAppUrl();
    const redirect = typeof redirectPath === 'string' && redirectPath.startsWith('/') ? redirectPath : '/dashboard';
    const fallbackUrl = `${mainAppUrl}/login?redirect=${encodeURIComponent(redirect)}`;

    try {
      const api = useAuthStore.getState().getApi();
      const res = await api.post('/api/auth/sso/issue');
      const code = res.data?.code;

      const params = new URLSearchParams();
      if (code) params.set('sso_code', code);
      params.set('redirect', redirect);
      const url = `${mainAppUrl}/login?${params.toString()}`;
      openExternalUrl(url, 'l3v3l_main_app');
    } catch (e) {
      openExternalUrl(fallbackUrl, 'l3v3l_main_app');
    }
  };

  const loadPortalMembersGroup = async () => {
    try {
      const api = useAuthStore.getState().getApi();
      const res = await api.get('/api/messenger/portal-members-group');
      const portalGroupResp = res.data?.conversation;
      if (!portalGroupResp) return;
      portalGroupResp.id = portalGroupResp.id || portalGroupResp._id;
      // Force canonical display name so any code using groupName shows the new label.
      portalGroupResp.groupName = 'L3V3L Members';
      console.log('✅ L3V3L Members group:', portalGroupResp?.id);
      setPortalGroup(portalGroupResp);
    } catch (e) {
      console.warn('⚠️ Failed to load L3V3L Members group:', e.message);
    }
  };

  // Real-time-ish online presence (polled every 30s). Used to render
  // small green/gray dots on user avatars across the messenger UI.
  const { isOnline, onlineSet } = useOnlinePresence();

  // Fetch lazy notifications on mount
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user?.username) return;

      setNotificationLoading(true);
      try {
        const api = useAuthStore.getState().getApi();
        const response = await api.get(`/api/notifications/${user.username}`);
        const { source, data } = response.data;

        setNotifications(data);

        if (source === 'fresh') {
          console.log('🔄 Fresh notification data loaded from backend');
        } else {
          console.log('✅ Cached notification data loaded');
        }

        // Show agent nudge only when fresh data was just dispatched to L3V3L Agent
        if (source === 'fresh') {
          setShowNotificationBanner(true);
          setTimeout(() => setShowNotificationBanner(false), 6000);
        }
      } catch (e) {
        console.error('Failed to fetch notifications:', e);
      } finally {
        setNotificationLoading(false);
      }
    };

    fetchNotifications();
  }, [user?.username]);

  // Load notification preferences on mount
  useEffect(() => {
    const loadNotifPrefs = async () => {
      if (!user?.username) return;
      try {
        const api = useAuthStore.getState().getApi();
        const res = await api.get('/api/notifications/user-prefs');
        setNotifPrefs(prev => ({ ...prev, ...res.data }));
      } catch (e) {
        // Silently fail — defaults are fine
      }
    };
    loadNotifPrefs();
  }, [user?.username]);

  const saveNotifPrefs = async (updatedPrefs) => {
    setSavingPrefs(true);
    try {
      const api = useAuthStore.getState().getApi();
      await api.put('/api/notifications/user-prefs', updatedPrefs);
      setNotifPrefs(updatedPrefs);
      setPrefsToast({ message: 'Settings saved!', type: 'success' });
    } catch (e) {
      setPrefsToast({ message: 'Failed to save settings', type: 'error' });
    } finally {
      setSavingPrefs(false);
      setTimeout(() => setPrefsToast(null), 3000);
    }
  };

  const togglePref = (key) => {
    const updated = {
      ...notifPrefs,
      [key]: { ...notifPrefs[key], enabled: !notifPrefs[key].enabled },
    };
    saveNotifPrefs(updated);
  };

  const playBeep = () => {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const oscillator = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);

      oscillator.connect(gain);
      gain.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.25);
    } catch (e) {
      // Ignore browser audio restrictions until the user interacts.
    }
  };

  useEffect(() => {
    if (!timerRunning) return undefined;
    const timerId = setInterval(() => {
      setTimerRemainingSeconds((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          playBeep();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerId);
  }, [timerRunning]);

  useEffect(() => {
    if (!beeperRunning) return undefined;
    const n = parseInt(beeperSecondsInput, 10);
    if (!Number.isFinite(n) || n < 1) return undefined;
    const beeperId = setInterval(() => {
      playBeep();
    }, n * 1000);
    return () => clearInterval(beeperId);
  }, [beeperRunning, beeperSecondsInput]);

  const isL3V3LAgentConversation = (conv) => {
    if (!conv) return false;
    if (conv.isSystemBot) return true;
    const participants = Array.isArray(conv.participants) ? conv.participants : [];
    return participants.some((p) => (p?.username || '').toLowerCase() === 'l3v3lagent');
  };

  useEffect(() => {
    if (allConversations && allConversations.length > 0) {
      let myMessagesUnread = 0;
      let l3v3lAgentUnread = 0;

      allConversations.forEach(conv => {
        const isBotConv = isL3V3LAgentConversation(conv);
        const unread = conv.unreadCount || 0;
        const hasContent = Boolean(String(conv.lastMessagePreview || '').trim()) || Boolean(conv.lastMessageAt) || unread > 0;

        if (isBotConv) {
          l3v3lAgentUnread += unread;
        } else if (hasContent) {
          myMessagesUnread += unread;
        }
      });

      setMyMessagesCount(myMessagesUnread);
      setL3v3lAgentCount(l3v3lAgentUnread);
    } else {
      setMyMessagesCount(0);
      setL3v3lAgentCount(0);
    }
  }, [allConversations]);

  // Fetch conversations on mount and when tab changes
  useEffect(() => {
    loadPortalMembersGroup();
    loadAllConversations();
    loadUserProfile();
    loadActiveMembersCount();
    loadL3V3LAgentConv();
  }, []);

  // Default landing: auto-select L3V3L Members group as soon as it's loaded.
  // We only auto-select once (when nothing is selected yet) so navigating away
  // and back doesn't override the user's explicit choice.
  // Also never override if the user explicitly chose the "ALL" (unified) view.
  const [didAutoSelectPortal, setDidAutoSelectPortal] = useState(false);
  useEffect(() => {
    if (didAutoSelectPortal) return;
    if (selectedChat) return;
    if (!portalGroup?.id) return;
    // Do not auto-open a specific topic if the user is on the unified ALL list.
    if (activeTab === 'all') return;
    setSelectedChat({
      id: portalGroup.id,
      name: 'L3V3L Members',
      isGroup: true,
      isLegacy: false,
    });
    // Highlight the L3V3L Members entry in the top navigation.
    setActiveTab('portal_members');
    setDidAutoSelectPortal(true);
  }, [portalGroup, selectedChat, didAutoSelectPortal, activeTab]);

  // When user clicked a placeholder in ALL and the real data loads, open it
  useEffect(() => {
    if (!pendingOpenAllTopic) return;
    if (pendingOpenAllTopic === 'portal' && portalGroup && (portalGroup.id || portalGroup._id)) {
      const id = portalGroup.id || portalGroup._id;
      setSelectedChat({ id, name: 'L3V3L Members', isGroup: true, isLegacy: false });
      setPendingOpenAllTopic(null);
    }
    if (pendingOpenAllTopic === 'agent' && l3v3lAgentConv && (l3v3lAgentConv.id || l3v3lAgentConv._id)) {
      const id = l3v3lAgentConv.id || l3v3lAgentConv._id;
      setSelectedChat({ id, name: 'L3V3L Agent', isGroup: false, isSystemBot: true });
      setPendingOpenAllTopic(null);
    }
  }, [pendingOpenAllTopic, portalGroup, l3v3lAgentConv]);

  // Load active members count for L3V3L Members badge
  const loadActiveMembersCount = async () => {
    try {
      const api = useAuthStore.getState().getApi();
      const res = await api.get('/api/users/active-members/count');
      const count = res.data?.activeCount || 0;
      setActiveMembersCount(count);
    } catch (e) {
      console.warn('⚠️ Failed to load active members count:', e?.message);
      // Silently fail — badge just won't show
    }
  };

  const loadUserProfile = async () => {
    if (!user?.username) return;
    try {
      const api = useAuthStore.getState().getApi();
      const res = await api.get(`/api/users/profile/${user.username}?requester=${user.username}`);
      const profile = res.data?.user || res.data;
      console.log('👤 User profile loaded:', profile?.username, 'images:', profile?.images?.length);
      setUserProfile(profile);
    } catch (e) {
      console.warn('⚠️ Failed to load user profile:', e.message);
    }
  };

  // Load the current user's blocked/excluded users (shown on the profile tab)
  const loadBlockedUsers = async () => {
    if (!user?.username) return;
    setBlockedLoading(true);
    setBlockedError(null);
    try {
      const api = useAuthStore.getState().getApi();
      const res = await api.get(`/api/users/exclusions/${user.username}`);
      setBlockedUsers(res.data?.exclusions || []);
    } catch (e) {
      console.warn('⚠️ Failed to load blocked users:', e.message);
      setBlockedError('Failed to load blocked users');
      setBlockedUsers([]);
    } finally {
      setBlockedLoading(false);
    }
  };

  // Remove an exclusion (unblock)
  const handleUnblock = async (targetUsername) => {
    if (!user?.username || !targetUsername) return;
    setUnblockingUser(targetUsername);
    try {
      const api = useAuthStore.getState().getApi();
      await api.delete(
        `/api/users/exclusions/${encodeURIComponent(targetUsername)}?username=${encodeURIComponent(user.username)}`
      );
      setBlockedUsers((prev) => prev.filter((u) => u.username !== targetUsername));
    } catch (e) {
      console.warn('⚠️ Failed to unblock user:', e.message);
      setBlockedError(`Failed to unblock ${targetUsername}`);
    } finally {
      setUnblockingUser(null);
    }
  };

  // Load blocked users the first time the profile tab is opened
  useEffect(() => {
    if (activeTab === 'profile' && !selectedChat && blockedUsers.length === 0 && !blockedLoading) {
      loadBlockedUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedChat]);

  // Helper: calc age from dob string (YYYY-MM-DD or similar)
  const calcAge = (dob) => {
    if (!dob) return null;
    try {
      const birth = new Date(dob);
      if (isNaN(birth.getTime())) return null;
      const diff = Date.now() - birth.getTime();
      const age = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
      return age > 0 && age < 150 ? age : null;
    } catch {
      return null;
    }
  };

  // Helper: build profile pic URL with auth token
  const getProfilePicUrl = (profile) => {
    if (!profile) return null;

    const rawPath = profile.imageVisibility?.profilePic || profile.images?.[0] || profile.profileImage;
    if (!rawPath || typeof rawPath !== 'string') return null;

    let normalizedPath = rawPath.trim();
    if (!normalizedPath) return null;

    if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
      try {
        normalizedPath = new URL(normalizedPath).pathname || normalizedPath;
      } catch (_) {
        // keep raw string if URL parsing fails
      }
    }

    if (normalizedPath.includes('/api/users/media/')) {
      const marker = '/api/users/media/';
      const idx = normalizedPath.indexOf(marker);
      normalizedPath = normalizedPath.slice(idx);
      if (!normalizedPath.startsWith('/')) {
        normalizedPath = `/${normalizedPath}`;
      }
    } else if (normalizedPath.startsWith('/uploads/') || normalizedPath.startsWith('uploads/')) {
      const filename = normalizedPath.split('/').pop();
      if (!filename) return null;
      normalizedPath = `/api/users/media/${filename}`;
    } else if (!normalizedPath.startsWith('/')) {
      const filename = normalizedPath.split('/').pop();
      if (!filename) return null;
      normalizedPath = `/api/users/media/${filename}`;
    }

    const token = useAuthStore.getState().token;
    let fullUrl = normalizedPath.startsWith('http') ? normalizedPath : `${API_BASE_URL}${normalizedPath}`;
    if (fullUrl.includes('token=')) {
      fullUrl = fullUrl
        .replace(/([?&])token=[^&]*&?/, '$1')
        .replace(/[?&]$/, '');
    }
    if (token && !fullUrl.includes('token=')) {
      const sep = fullUrl.includes('?') ? '&' : '?';
      return `${fullUrl}${sep}token=${encodeURIComponent(token)}`;
    }
    return fullUrl;
  };

  const loadL3V3LAgentConversation = async () => {
    try {
      const api = useAuthStore.getState().getApi();
      // Find the l3v3lagent conversation for the current user
      const res = await api.get('/api/messenger/conversations');
      const conversations = res.data?.conversations || res.data || [];
      let l3v3lagentConv = conversations.find(conv => {
        const participants = conv.participants || [];
        return participants.some(p => p.username === 'l3v3lagent');
      });

      if (l3v3lagentConv) {
        const agentId = l3v3lagentConv._id || l3v3lagentConv.id;
        setL3v3lAgentConv({ id: agentId, ...l3v3lagentConv });
        setSelectedChat({
          id: agentId,
          name: 'L3V3L Agent',
          isGroup: false,
          isBot: true,
        });
      } else {
        // Create a new l3v3lagent conversation
        const createRes = await api.post('/api/messenger/conversations', {
          type: 'direct',
          participantUsernames: ['l3v3lagent'],
          isSystemBot: true,
          botName: 'L3V3L Agent',
        });
        if (createRes.data?.conversation) {
          const created = createRes.data.conversation;
          const agentId = created._id || created.id;
          setL3v3lAgentConv({ id: agentId, ...created });
          setSelectedChat({
            id: agentId,
            name: 'L3V3L Agent',
            isGroup: false,
            isBot: true,
          });
        }
      }
    } catch (e) {
      console.error('Failed to load L3V3L Agent conversation:', e);
    }
  };

  const loadL3V3LAgentConv = async () => {
    try {
      const api = useAuthStore.getState().getApi();
      const res = await api.get('/api/messenger/conversations');
      const conversations = res.data?.conversations || res.data || [];
      const found = conversations.find(conv => {
        const participants = conv.participants || [];
        return participants.some(p => p.username === 'l3v3lagent');
      });
      if (found) {
        setL3v3lAgentConv({ id: found._id || found.id, ...found });
      } else {
        setL3v3lAgentConv(null);
      }
    } catch (e) {
      console.warn('Failed to load L3V3L Agent conv for list:', e.message);
    }
  };

  const loadAllConversations = async () => {
    setError(null);
    setIsLoading(true);

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const cacheKey = `conversation_list:${user?.username || 'unknown'}`;
        const cached = window.localStorage.getItem(cacheKey);
        if (cached) {
          const { conversations, timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;
          if (age < 5 * 60 * 1000) {
            console.log('✅ Loaded conversations from localStorage cache (age:', Math.round(age/1000), 's)');
            setAllConversations(conversations);
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ Failed to load from localStorage:', e.message);
    }

    try {
      const api = useAuthStore.getState().getApi();

      const [messengerRes, legacyRes] = await Promise.allSettled([
        api.get('/api/messenger/conversations'),
        api.get('/api/users/messages/conversations'),
      ]);

      // Fetch L3V3L Messenger conversations (groups + new direct chats)
      console.log('📬 Fetching L3V3L Messenger conversations...');
      let messengerConvs = [];
      if (messengerRes.status === 'fulfilled') {
        const res = messengerRes.value;
        const raw = res.data?.conversations ?? res.data;
        messengerConvs = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.conversations)
            ? raw.conversations
            : Array.isArray(raw?.items)
              ? raw.items
              : [];
        if (!Array.isArray(messengerConvs)) {
          console.warn('⚠️ Messenger conversations response is not an array');
          messengerConvs = [];
        }
        messengerConvs = messengerConvs.map(c => ({ ...c, id: c.id || c._id }));
        console.log('✅ Messenger conversations:', messengerConvs.length);
      } else {
        console.warn('⚠️ Failed to load messenger conversations:', messengerRes.reason?.message);
      }

      // Enrich modern direct conversations with profile gender so pending-status
      // borders can be colored correctly (pink for female sender, blue for male).
      try {
        const usernamesToFetch = messengerConvs
          .filter((c) => c && c.type !== 'group' && !c.isSystemBot)
          .map((c) => c.participants?.find((p) => p?.username !== user?.username)?.username)
          .filter(Boolean);
        if (usernamesToFetch.length > 0) {
          const bulkRes = await api.post('/api/users/profiles/bulk', {
            usernames: Array.from(new Set(usernamesToFetch)),
          });
          const profiles = bulkRes.data?.profiles || {};
          messengerConvs = messengerConvs.map((conv) => {
            if (!conv || conv.type === 'group' || conv.isSystemBot) return conv;
            const otherUsername = conv.participants?.find((p) => p?.username !== user?.username)?.username;
            if (!otherUsername) return conv;
            const p = profiles[otherUsername];
            if (!p) return conv;
            const enrichedParticipants = (conv.participants || []).map((participant) => (
              participant?.username === otherUsername
                ? { ...participant, gender: participant.gender || participant.sex || p.gender || p.sex }
                : participant
            ));
            return {
              ...conv,
              participants: enrichedParticipants,
              profile: {
                ...(conv.profile || {}),
                gender: (conv.profile && (conv.profile.gender || conv.profile.sex)) || p.gender || p.sex,
              },
              otherGender: conv.otherGender || p.gender || p.sex,
            };
          });
        }
      } catch (e) {
        console.warn('⚠️ Failed to enrich messenger conversation genders:', e.message);
      }

      // Fetch main app 1:1 conversations (legacy direct messages)
      console.log('📬 Fetching main app 1:1 conversations...');
      let directConvs = [];
      try {
        if (legacyRes.status !== 'fulfilled') {
          throw legacyRes.reason;
        }
        const res = legacyRes.value;
        const raw = Array.isArray(res.data) ? res.data : res.data?.conversations || [];
        // Normalize main app conversations to the L3V3L shape
        directConvs = raw.map(c => ({
          id: `direct:${c.otherUsername || c.username}`,
          type: 'direct_legacy',
          otherUsername: c.otherUsername || c.username,
          participants: [
            { username: user?.username },
            { username: c.otherUsername || c.username },
          ],
          lastMessageAt: c.timestamp || c.lastMessageAt,
          lastMessagePreview: c.lastMessage || c.message || c.lastMessagePreview,
          unreadCount: c.unreadCount || 0,
        }));
        console.log('✅ Main app 1:1 conversations:', directConvs.length);

        // Enrich each direct conversation with the other user's profile metadata
        // Use the bulk endpoint to fetch all profiles in a single round-trip
        // (was N sequential requests = slow on large conversation lists).
        try {
          const usernamesToFetch = directConvs
            .map((c) => c.otherUsername)
            .filter(Boolean);
          if (usernamesToFetch.length > 0) {
            const bulkRes = await api.post('/api/users/profiles/bulk', {
              usernames: usernamesToFetch,
            });
            const profiles = bulkRes.data?.profiles || {};
            directConvs.forEach((conv) => {
              const p = profiles[conv.otherUsername];
              if (!p) return;
              conv.profile = {
                firstName: p.firstName,
                lastName: p.lastName,
                age: p.age,
                height: p.height,
                gender: p.gender || p.sex,
                profession: p.profession || p.occupation,
                location: p.location,
                imageVisibility: p.imageVisibility,
                images: p.images,
                profileImage: p.profileImage,
              };
            });
            console.log(`✅ Bulk-enriched ${Object.keys(profiles).length}/${usernamesToFetch.length} direct conversations`);
          }
        } catch (e) {
          // Fall back to per-user fetches if bulk endpoint isn't deployed yet.
          console.warn('⚠️ Bulk profile fetch failed, falling back to per-user:', e.message);
          await Promise.all(directConvs.map(async (conv) => {
            try {
              const profileRes = await api.get(`/api/users/profile/${conv.otherUsername}?requester=${user?.username}`);
              const p = profileRes.data?.user || profileRes.data || {};
              conv.profile = {
                firstName: p.firstName,
                lastName: p.lastName,
                age: p.age || calcAge(p.dob),
                height: p.height,
                gender: p.gender || p.sex,
                profession: p.profession || p.occupation,
                location: p.location || [p.city, p.state, p.country].filter(Boolean).join(', '),
                imageVisibility: p.imageVisibility,
                images: p.images,
                profileImage: p.profileImage,
              };
            } catch (err) {
              // Ignore per-user profile fetch failures
            }
          }));
        }
      } catch (e) {
        console.warn('⚠️ Failed to load main app conversations:', e.message);
      }

      // US Vedika fetch removed: group is hidden in messenger-web. Backend
      // still exposes /api/messenger/us-vedika/* for analytics + legacy data.

      // Combine: exclude L3V3L Members group (shown separately) AND any US Vedika
      // public_group that might come through the messenger conversations list.
      const combinedMap = new Map();
      messengerConvs.forEach(c => {
        // Skip L3V3L Members group (shown separately)
        if (c.type === 'group') {
          const gn = String(c.groupName || '').trim().toLowerCase();
          if (gn === 'portal members' || gn === 'l3v3l members') return;
        }
        // Skip US Vedika — hidden in this app
        if (c.type === 'public_group' || c.groupName === 'US Vedika') return;
        combinedMap.set(c.id, c);
      });
      directConvs.forEach(c => combinedMap.set(c.id, c));

      const combined = Array.from(combinedMap.values());
      console.log('✅ My Messages conversations:', combined.length);
      setAllConversations(combined);
      
      // Cache the result in localStorage
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const cacheKey = `conversation_list:${user?.username || 'unknown'}`;
          window.localStorage.setItem(cacheKey, JSON.stringify({
            conversations: combined,
            timestamp: Date.now(),
          }));
          console.log('💾 Cached conversation list in localStorage');
        }
      } catch (e) {
        console.warn('⚠️ Failed to cache conversation list:', e.message);
      }
    } catch (e) {
      console.error('❌ Failed to load conversations:', e);
      setError('Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const hasConversationContent = (conv) => {
    if (!conv) return false;
    const preview = String(conv.lastMessagePreview || '').trim();
    const unread = Number(conv.unreadCount || 0);
    return Boolean(preview) || Boolean(conv.lastMessageAt) || unread > 0;
  };

  // Group conversations
  const groupConversations = allConversations.filter(c => c.type === 'group');
  const directConversations = allConversations.filter(
    (c) => c.type !== 'group' && !isL3V3LAgentConversation(c) && hasConversationContent(c)
  );
  const myMessageConversations = allConversations.filter(
    (c) => !isL3V3LAgentConversation(c) && hasConversationContent(c)
  );

  // Unified list for the "ALL" view: regular convos + L3V3L Members + L3V3L Agent (system topic)
  // Always surface the known topics (L3V3L Members + L3V3L Agent) like a typical messaging app "all chats" list.
  const allViewItems = useMemo(() => {
    const items = [];
    // L3V3L Members (special group topic)
    if (portalGroup && (portalGroup.id || portalGroup._id)) {
      items.push({
        id: portalGroup.id || portalGroup._id,
        type: 'group',
        groupName: 'L3V3L Members',
        participants: portalGroup.participants || [],
        lastMessageAt: portalGroup.lastMessageAt,
        lastMessagePreview: portalGroup.lastMessagePreview,
        unreadCount: portalGroup.unreadCount || 0,
        __isPortal: true,
      });
    } else {
      // If we don't have it yet, still show a placeholder row so "L3V3L Members" appears in ALL
      items.push({
        id: 'portal-members-placeholder',
        type: 'group',
        groupName: 'L3V3L Members',
        __isPortal: true,
        __placeholder: true,
      });
    }

    // L3V3L Agent (system bot topic) — always include so system topics are visible
    if (l3v3lAgentConv && (l3v3lAgentConv.id || l3v3lAgentConv._id)) {
      const aid = l3v3lAgentConv.id || l3v3lAgentConv._id;
      items.push({
        id: aid,
        type: 'direct',
        isSystemBot: true,
        participants: l3v3lAgentConv.participants || [{ username: 'l3v3lagent' }],
        lastMessageAt: l3v3lAgentConv.lastMessageAt,
        lastMessagePreview: l3v3lAgentConv.lastMessagePreview || l3v3lAgentConv.lastMessage,
        unreadCount: l3v3lAgentConv.unreadCount || 0,
        __isAgent: true,
      });
    } else {
      // Placeholder so the system topic always shows in the unified ALL list
      items.push({
        id: 'l3v3l-agent-placeholder',
        type: 'direct',
        isSystemBot: true,
        __isAgent: true,
        __placeholder: true,
      });
    }

    // Add the rest, skipping dups of the special topics above
    allConversations.forEach((c) => {
      const cid = c.id || c._id;
      const pId = portalGroup ? (portalGroup.id || portalGroup._id) : null;
      const aId = l3v3lAgentConv ? (l3v3lAgentConv.id || l3v3lAgentConv._id) : null;
      if (pId && cid === pId) return;
      if (aId && cid === aId) return;
      // also skip placeholder ids if any slipped in
      if (cid === 'portal-members-placeholder' || cid === 'l3v3l-agent-placeholder') return;
      items.push(c);
    });
    return items;
  }, [portalGroup, l3v3lAgentConv, allConversations]);

  // Helper: get display name for a conversation (L3V3L Messenger structure).
  // Returns `username` for direct chats so callers can do online-presence lookups.
  const getConvDisplay = (conv) => {
    const toDisplayName = (obj) => {
      if (!obj) return '';
      const firstName = obj.firstName || obj.first_name || '';
      const lastName = obj.lastName || obj.last_name || '';
      return `${firstName} ${lastName}`.trim();
    };

    // L3V3L Agent (system bot topic)
    if (conv.isSystemBot || (conv.participants || []).some(p => p.username === 'l3v3lagent')) {
      return { name: 'L3V3L Agent', isGroup: false, username: 'l3v3lagent', icon: '🤖' };
    }
    // Group chat
    if (conv.type === 'group' && conv.groupName) {
      const gn = conv.groupName;
      const gnl = String(gn).trim().toLowerCase();
      const isPortal = gnl === 'portal members' || gnl === 'l3v3l members';
      return { name: isPortal ? 'L3V3L Members' : gn, isGroup: true, username: null, icon: '🦋' };
    }
    // Legacy direct chat
    if (conv.type === 'direct_legacy') {
      const profileName = toDisplayName(conv.profile);
      const directName = profileName || conv.otherFullName || conv.otherDisplayName || conv.otherUsername || 'Unknown';
      return {
        name: directName,
        isGroup: false,
        username: conv.otherUsername || null,
        icon: null,
      };
    }
    // Direct chat - find other participant
    const other = conv.participants?.find(p => p.username !== user?.username);
    const participantName = toDisplayName(other);
    const profileName = toDisplayName(conv.profile);
    const name = participantName || profileName || other?.displayName || other?.fullName || other?.username || 'Unknown';
    return { name, isGroup: false, username: other?.username || null, icon: null };
  };

  // Helper: get other participant's normalized gender for direct chats
  const getOtherGender = (conv) => {
    if (!conv || conv.type === 'group' || conv.isSystemBot) return null;
    if (conv.type === 'direct_legacy') {
      const g = conv.profile?.gender || conv.profile?.sex || conv.otherGender || conv.otherSex;
      return g ? String(g).trim().toLowerCase() : null;
    }
    const other = conv.participants?.find((p) => p?.username !== user?.username);
    const g = other?.gender || other?.sex;
    return g ? String(g).trim().toLowerCase() : null;
  };

  const normalizeGender = (g) => {
    if (!g) return '';
    const s = String(g).trim().toLowerCase();
    if (['male', 'm', 'man'].includes(s)) return 'male';
    if (['female', 'f', 'woman'].includes(s)) return 'female';
    return '';
  };

  const getPendingBorderStyle = (conv) => {
    if (!conv || conv.type === 'group' || conv.isSystemBot) return null;
    const isPending = (conv.unreadCount || 0) > 0;
    if (!isPending) return null;
    const otherGender = normalizeGender(getOtherGender(conv));
    if (otherGender === 'female') return { borderWidth: 2, borderColor: '#ec4899' };
    if (otherGender === 'male') return { borderWidth: 2, borderColor: '#3b82f6' };
    return null;
  };

  // Search-stamp status:
  // - Blue glow: you sent the last message and are awaiting their reply.
  // - Pink glow: they sent the last message and you have unread messages.
  const getSearchStampStatusStyle = (result) => {
    const targetUsername = result?.username;
    if (!targetUsername) return null;
    const conv = allConversations.find((c) => {
      if (targetUsername && c?.otherUsername === targetUsername) return true;
      const other = c?.participants?.find((p) => p?.username !== user?.username);
      if (targetUsername && other?.username === targetUsername) return true;
      return false;
    });
    if (!conv) return null;
    const hasConversationHistory = Boolean(conv.lastMessageAt) || Boolean(String(conv.lastMessagePreview || '').trim()) || Number(conv.unreadCount || 0) > 0;
    if (!hasConversationHistory) return null;
    const unread = Number(conv.unreadCount || 0);
    if (unread > 0) return styles.stampCardNeedsReplyPink;
    return styles.stampCardAwaitingReplyBlue;
  };

  const matchesSearch = (conv) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const display = getConvDisplay(conv);
    const preview = String(conv.lastMessagePreview || '').toLowerCase();
    return display.name.toLowerCase().includes(q) || preview.includes(q);
  };

  // Helper: format timestamp
  const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString();
  };

  // Build display name from profile
  const displayName = userProfile
    ? `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.username
    : (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user?.username || 'Profile'));
  const profilePicUrl = getProfilePicUrl(userProfile);

  // Menu items - messenger specific
  // L3V3L Members is the canonical @{email}-invite group.
  const menuItems = [
    { id: 'profile', label: displayName, subLabel: user?.username || 'Your profile', icon: '👤', isProfile: true },
    { id: 'portal_members', label: 'L3V3L Members', subLabel: 'All active members', icon: '🦋', count: activeMembersCount },
    { id: 'messages', label: 'My Messages', subLabel: 'Direct conversations', icon: '💬', count: myMessagesCount },
    { id: 'l3v3lagent', label: 'L3V3L Agent', subLabel: 'System messages & notifications', icon: '🤖', count: l3v3lAgentCount },
    { id: 'main_app', label: 'Main App', subLabel: 'Open USVedika dashboard', icon: '🏠' },
  ];

  const parseHeightToInches = (height) => {
    if (!height) return null;
    if (typeof height === 'number') return height;
    const match = String(height).match(/(\d+)'(\d+)"/);
    if (match) {
      return parseInt(match[1], 10) * 12 + parseInt(match[2], 10);
    }
    const total = parseInt(String(height).replace(/[^0-9]/g, ''), 10);
    return Number.isNaN(total) ? null : total;
  };

  const buildDefaultCriteria = (profile) => {
    if (!profile) return {};
    const userGender = normalizeGender(profile.gender || profile.sex);
    const pc = profile.partnerCriteria || {};
    const userAge = profile.age || calcAge(profile.dob) || null;
    const userHeight = parseHeightToInches(profile.height);
    const oppositeGender = userGender === 'male' ? 'Female' : userGender === 'female' ? 'Male' : '';

    let ageMin = '';
    let ageMax = '';
    if (userAge && pc.ageRangeRelative) {
      const minOffset = Number(pc.ageRangeRelative.minOffset) || 0;
      const maxOffset = Number(pc.ageRangeRelative.maxOffset) || 0;
      ageMin = String(Math.max(19, userAge + minOffset));
      ageMax = String(Math.min(100, userAge + maxOffset));
    } else if (pc.ageRange?.min && pc.ageRange?.max) {
      ageMin = String(pc.ageRange.min);
      ageMax = String(pc.ageRange.max);
    } else if (userAge && userGender) {
      if (userGender === 'male') {
        ageMin = String(Math.max(19, userAge - 5));
        ageMax = String(Math.min(100, userAge + 1));
      } else {
        ageMin = String(Math.max(19, userAge - 1));
        ageMax = String(Math.min(100, userAge + 5));
      }
    }

    let heightMin = '';
    let heightMax = '';
    if (userHeight && pc.heightRangeRelative) {
      const minOffset = Number(pc.heightRangeRelative.minInches) || 0;
      const maxOffset = Number(pc.heightRangeRelative.maxInches) || 0;
      heightMin = String(userHeight + minOffset);
      heightMax = String(userHeight + maxOffset);
    } else if (pc.heightRange?.minFeet || pc.heightRange?.minFeet === 0) {
      const minFt = Number(pc.heightRange.minFeet) || 0;
      const minInch = Number(pc.heightRange.minInches) || 0;
      const maxFt = Number(pc.heightRange.maxFeet) || 0;
      const maxInch = Number(pc.heightRange.maxInches) || 0;
      heightMin = String(minFt * 12 + minInch);
      heightMax = String(maxFt * 12 + maxInch);
    }

    const criteria = {
      gender: oppositeGender,
      ageMin,
      ageMax,
      heightMin,
      heightMax,
      hasPhoto: true,
      daysBack: 0,
    };

    const arrValue = (v) => (Array.isArray(v) ? v : [v]).filter(Boolean);
    const isNoPreference = (v) => {
      const s = String(v).toLowerCase().trim();
      return s.startsWith('any') || s === 'no preference';
    };
    const skipAny = (arr) => arr.filter((v) => v && !isNoPreference(v));

    const locations = skipAny(arrValue(pc.location));
    if (locations.length > 0) criteria.locations = locations;

    const professions = skipAny(arrValue(pc.profession));
    if (professions.length > 0) criteria.occupations = professions;

    const religions = skipAny(arrValue(pc.religion));
    if (religions.length > 0) criteria.religion = String(religions[0]).capitalize?.() || religions[0];

    const castes = skipAny(arrValue(pc.caste));
    if (castes.length > 0) criteria.caste = String(castes[0]);

    const eating = skipAny(arrValue(pc.eatingPreference));
    if (eating.length > 0) criteria.eatingPreference = String(eating[0]);

    return criteria;
  };

  const normalizeCriteria = (criteria) => {
    const out = { ...criteria };
    if (out.heightMinFeet && out.heightMinInches !== undefined) {
      const feet = parseInt(out.heightMinFeet, 10) || 0;
      const inches = parseInt(out.heightMinInches, 10) || 0;
      out.heightMin = feet * 12 + inches;
    }
    if (out.heightMaxFeet && out.heightMaxInches !== undefined) {
      const feet = parseInt(out.heightMaxFeet, 10) || 0;
      const inches = parseInt(out.heightMaxInches, 10) || 0;
      out.heightMax = feet * 12 + inches;
    }
    delete out.heightMinFeet;
    delete out.heightMinInches;
    delete out.heightMaxFeet;
    delete out.heightMaxInches;
    delete out.sortBy;
    delete out.sortOrder;
    if (Array.isArray(out.locations) && out.locations.length > 0) {
      delete out.location;
    }
    return out;
  };

  const buildSearchParams = (criteria) => {
    const params = new URLSearchParams();
    const normalized = normalizeCriteria(criteria || {});
    Object.entries(normalized).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined) return;
      if (Array.isArray(value)) {
        value.forEach((v) => {
          if (v !== '' && v !== null && v !== undefined) params.append(key, v);
        });
      } else {
        params.append(key, value);
      }
    });
    params.append('page', '1');
    params.append('limit', '24');
    params.append('sortBy', 'newest');
    params.append('sortOrder', 'desc');
    return params;
  };

  const openChatFromSearch = (result) => {
    if (!result?.username) return;
    const username = result.username;
    const existing = allConversations.find((c) => {
      if (c.otherUsername === username) return true;
      const other = c.participants?.find((p) => p?.username !== user?.username);
      return other?.username === username;
    });
    if (existing) {
      const display = getConvDisplay(existing);
      const key = existing._id || existing.id;
      setSelectedChat({
        id: key,
        name: display.name,
        isGroup: display.isGroup,
        isLegacy: existing.type === 'direct_legacy',
        username: display.username,
        isSystemBot: !!existing.isSystemBot,
      });
      return;
    }
    const displayName = `${result.firstName || ''} ${result.lastName || ''}`.trim() || username;
    setSelectedChat({
      id: `direct:${username}`,
      name: displayName,
      isGroup: false,
      isLegacy: true,
      username,
    });
  };

  const inchesToHeight = (inches) => {
    if (!inches || Number.isNaN(Number(inches))) return null;
    const total = Number(inches);
    const ft = Math.floor(total / 12);
    const ins = total % 12;
    return `${ft}'${ins}"`;
  };

  const describeCriteria = (criteria) => {
    const parts = [];
    if (criteria.gender) parts.push(criteria.gender);
    if (criteria.ageMin || criteria.ageMax) {
      const min = criteria.ageMin || 'any';
      const max = criteria.ageMax || 'any';
      parts.push(`${min}-${max} yrs`);
    }
    if (criteria.heightMin || criteria.heightMax) {
      const min = inchesToHeight(criteria.heightMin) || 'any';
      const max = inchesToHeight(criteria.heightMax) || 'any';
      parts.push(`${min} - ${max}`);
    }
    if (criteria.locations?.length > 0) parts.push(criteria.locations.join(', '));
    if (criteria.occupations?.length > 0) parts.push(criteria.occupations.join(', '));
    if (criteria.religion) parts.push(criteria.religion);
    if (criteria.caste) parts.push(criteria.caste);
    if (criteria.eatingPreference) parts.push(criteria.eatingPreference);
    return parts.join(' · ');
  };

  const runSearch = async () => {
    if (!user?.username) return;
    setSearchLoading(true);
    setSearchError(null);
    setSearchDescription('');
    try {
      const api = useAuthStore.getState().getApi();
      let criteria = null;
      let source = 'Partner criteria';
      try {
        const defaultRes = await api.get(`/api/users/${user.username}/saved-searches/default`);
        if (defaultRes.data?.criteria) {
          criteria = defaultRes.data.criteria;
          source = 'Saved search';
        }
      } catch (e) {
        // no default saved search
      }
      if (!criteria) {
        criteria = buildDefaultCriteria(userProfile);
      }
      const desc = describeCriteria(normalizeCriteria(criteria));
      setSearchDescription(`${source}: ${desc}`);
      const params = buildSearchParams(criteria);
      const searchRes = await api.get(`/api/users/search?${params.toString()}`);
      const users = searchRes.data?.users || [];
      setSearchResults(users.slice(0, 50));
    } catch (e) {
      console.error('❌ Search failed:', e);
      setSearchError(e?.response?.data?.detail || 'Search failed. Please try again.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleMenuClick = (id) => {
    if (id === 'portal_members') {
      if (portalGroup) {
        setSelectedChat({
          id: portalGroup.id,
          name: 'L3V3L Members',
          isGroup: true,
          isLegacy: false,
        });
      }
      setActiveTab('portal_members');
      return;
    }
    if (id === 'l3v3lagent') {
      loadL3V3LAgentConversation();
      setActiveTab('l3v3lagent');
      return;
    }
    if (id === 'main_app') {
      openMainAppWithSso('/dashboard');
      return;
    }
    if (id === 'search') {
      setSelectedChat(null);
      setActiveTab('search');
      runSearch();
      return;
    }
    // US Vedika handler removed (menu item hidden).
    // Clear any open chat so the right panel shows the menu item's content
    setSelectedChat(null);
    setActiveTab(id);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'all':
        return (
          <ScrollView style={styles.messagesContainer}>
            <Text style={styles.contentTitle}>All Conversations</Text>

            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#e94560" />
                <Text style={styles.loadingText}>Loading conversations...</Text>
              </View>
            )}

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={loadAllConversations}>
                  <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {!isLoading && !error && allViewItems.filter(matchesSearch).length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No conversations yet</Text>
                <Text style={styles.emptySubText}>Start a new chat to begin messaging</Text>
              </View>
            )}

            {!isLoading && (
              <>
                {allViewItems.filter(matchesSearch).map((conv, index) => {
                  const display = getConvDisplay(conv);
                  const key = conv._id || conv.id || index;
                  const isLegacy = conv.type === 'direct_legacy';
                  const avatarText = display.icon || (display.isGroup ? '🦋' : (display.name || '?').charAt(0).toUpperCase());
                  return (
                    <TouchableOpacity key={key} style={[styles.conversationItem, getPendingBorderStyle(conv)]} onPress={() => {
                      // Handle placeholder rows for L3V3L Members / L3V3L Agent in the unified ALL list
                      if (conv.__placeholder && conv.__isPortal) {
                        setSelectedChat(null);
                        setActiveTab('all');
                        setPendingOpenAllTopic('portal');
                        if (!portalGroup) loadPortalMembersGroup();
                        return;
                      }
                      if (conv.__placeholder && conv.__isAgent) {
                        setSelectedChat(null);
                        setActiveTab('all');
                        setPendingOpenAllTopic('agent');
                        if (!l3v3lAgentConv) loadL3V3LAgentConv();
                        return;
                      }
                      // Real row
                      setSelectedChat({ id: key, name: display.name, isGroup: display.isGroup, isLegacy, username: display.username, isSystemBot: !!conv.isSystemBot });
                    }}>
                      <View style={styles.convAvatar}>
                        <Text style={styles.convAvatarText}>{avatarText}</Text>
                        {display.username && <OnlineDot online={isOnline(display.username)} />}
                      </View>
                      <View style={styles.convInfo}>
                        <View style={styles.convHeader}>
                          <Text style={styles.convName}>{display.name}</Text>
                          <Text style={styles.convTime}>{formatTime(conv.lastMessageAt)}</Text>
                        </View>
                        <View style={styles.convHeader}>
                          <Text style={styles.convMessage} numberOfLines={1}>
                            {conv.lastMessagePreview || 'No messages yet'}
                          </Text>
                          {conv.type === 'group' && (
                            <Text style={styles.memberCount}>{conv.participants?.length || 0} members</Text>
                          )}
                          {(conv.unreadCount || 0) > 0 && (
                            <View style={styles.unreadBadge}>
                              <Text style={styles.unreadText}>{conv.unreadCount}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </ScrollView>
        );

      case 'messages':
        return (
          <ScrollView style={styles.messagesContainer}>
            <Text style={styles.contentTitle}>My Messages</Text>

            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#e94560" />
                <Text style={styles.loadingText}>Loading conversations...</Text>
              </View>
            )}

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={loadAllConversations}>
                  <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {!isLoading && !error && allConversations.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No conversations yet</Text>
                <Text style={styles.emptySubText}>Start a new chat to begin messaging</Text>
              </View>
            )}

            {!isLoading && (
              <>
                {/* Group Chats Section */}
                {groupConversations.length > 0 && (
                  <View style={styles.section}>
                    <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('groups')}>
                      <Text style={styles.sectionTitle}>Group Chats ({groupConversations.length})</Text>
                      <Text style={styles.sectionToggle}>{expandedSections.groups ? '▼' : '▶'}</Text>
                    </TouchableOpacity>
                    {expandedSections.groups && groupConversations.map((conv, index) => {
                      const display = getConvDisplay(conv);
                      const key = conv._id || conv.id || index;
                      const isLegacy = conv.type === 'direct_legacy';
                      return (
                        <TouchableOpacity key={key} style={[styles.conversationItem, getPendingBorderStyle(conv)]} onPress={() => setSelectedChat({ id: key, name: display.name, isGroup: display.isGroup, isLegacy })}>
                          <View style={styles.convAvatar}>
                            <Text style={styles.convAvatarText}>{display.isGroup ? '🦋' : display.name.charAt(0).toUpperCase()}</Text>
                          </View>
                          <View style={styles.convInfo}>
                            <View style={styles.convHeader}>
                              <Text style={styles.convName}>{display.name}</Text>
                              <Text style={styles.convTime}>{formatTime(conv.lastMessageAt)}</Text>
                            </View>
                            <View style={styles.convHeader}>
                              <Text style={styles.convMessage} numberOfLines={1}>
                                {conv.lastMessagePreview || 'No messages yet'}
                              </Text>
                              {conv.type === 'group' && (
                                <Text style={styles.memberCount}>{conv.participants?.length || 0} members</Text>
                              )}
                              {(conv.unreadCount || 0) > 0 && (
                                <View style={styles.unreadBadge}>
                                  <Text style={styles.unreadText}>{conv.unreadCount}</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* Direct Messages Section */}
                {directConversations.length > 0 && (
                  <View style={styles.section}>
                    <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('direct')}>
                      <Text style={styles.sectionTitle}>Direct Messages ({directConversations.length})</Text>
                      <Text style={styles.sectionToggle}>{expandedSections.direct ? '▼' : '▶'}</Text>
                    </TouchableOpacity>
                    {expandedSections.direct && directConversations.map((conv, index) => {
                      const display = getConvDisplay(conv);
                      const key = conv._id || conv.id || index;
                      const isLegacy = conv.type === 'direct_legacy';
                      return (
                        <TouchableOpacity key={key} style={[styles.conversationItem, getPendingBorderStyle(conv)]} onPress={() => setSelectedChat({ id: key, name: display.name, isGroup: display.isGroup, isLegacy, username: display.username })}>
                          <View style={styles.convAvatar}>
                            <Text style={styles.convAvatarText}>{display.name.charAt(0).toUpperCase()}</Text>
                            {/* Online presence dot — direct chats only */}
                            {display.username && <OnlineDot online={isOnline(display.username)} />}
                          </View>
                          <View style={styles.convInfo}>
                            <View style={styles.convHeader}>
                              <Text style={styles.convName}>{display.name}</Text>
                              <Text style={styles.convTime}>{formatTime(conv.lastMessageAt)}</Text>
                            </View>
                            <View style={styles.convHeader}>
                              <Text style={styles.convMessage} numberOfLines={1}>
                                {conv.lastMessagePreview || 'No messages yet'}
                              </Text>
                              {(conv.unreadCount || 0) > 0 && (
                                <View style={styles.unreadBadge}>
                                  <Text style={styles.unreadText}>{conv.unreadCount}</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        );

      case 'profile': {
        const mainAppUrl = getMainAppUrl();
        const helpUrl = `${mainAppUrl}/help`;
        const contactUrl = `${mainAppUrl}/contact`;
        const editProfileUrl = `${mainAppUrl}/edit-profile`;
        const openLink = (url) => {
          openExternalUrl(url);
        };
        const displayName = userProfile
          ? `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.username
          : (user?.username || 'Your profile');
        return (
          <ScrollView style={styles.profileContainer} contentContainerStyle={styles.profileContent}>
            {/* ---- Header ---- */}
            <View style={styles.profileHeader}>
              {profilePicUrl ? (
                <Image source={{ uri: profilePicUrl }} style={styles.profileAvatar} />
              ) : (
                <View style={[styles.profileAvatar, styles.profileAvatarFallback]}>
                  <Text style={styles.profileAvatarInitial}>
                    {(displayName?.[0] || '?').toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.profileHeaderText}>
                <Text style={styles.profileName}>{displayName}</Text>
                <Text style={styles.profileUsername}>@{user?.username}</Text>
              </View>
            </View>

            <View style={styles.profileTabs}>
              <TouchableOpacity
                style={[styles.profileTabBtn, profileSubTab === 'profile' && styles.profileTabBtnActive]}
                onPress={() => setProfileSubTab('profile')}
              >
                <Text style={[styles.profileTabText, profileSubTab === 'profile' && styles.profileTabTextActive]}>Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.profileTabBtn, profileSubTab === 'apps' && styles.profileTabBtnActive]}
                onPress={() => setProfileSubTab('apps')}
              >
                <Text style={[styles.profileTabText, profileSubTab === 'apps' && styles.profileTabTextActive]}>Apps</Text>
              </TouchableOpacity>
            </View>

            {profileSubTab === 'profile' ? (
              <>
                {/* ---- Edit profile ---- */}
                <TouchableOpacity
                  style={[styles.profileActionRow, styles.profilePrimaryAction]}
                  onPress={() => openMainAppWithSso('/edit-profile')}
                >
                  <Text style={styles.profileActionIcon}>✏️</Text>
                  <Text style={styles.profileActionLabel}>Edit profile</Text>
                  <Text style={styles.profileActionHint}>↗</Text>
                </TouchableOpacity>
                <Text style={styles.profileActionHintSubtle}>
                  Opens the main app in a new tab
                </Text>

                {/* ---- Settings ---- */}
                <View style={styles.profileSection}>
                  <Text style={styles.profileSectionTitle}>⚙️  Notification Settings</Text>
                  <Text style={styles.settingsHint}>Choose what to see when you log in</Text>

                  {prefsToast && (
                    <View style={[styles.settingsToast, prefsToast.type === 'success' ? styles.settingsToastSuccess : styles.settingsToastError]}>
                      <Text style={styles.settingsToastText}>{prefsToast.message}</Text>
                    </View>
                  )}

                  {[
                    { key: 'newMatches',           icon: '🔍', label: 'New Matches',         sub: 'Profiles matching your saved searches' },
                    { key: 'pendingMessages',       icon: '💬', label: 'Pending Messages',    sub: 'Conversations awaiting your reply' },
                    { key: 'tips',                  icon: '💡', label: 'Tips',                sub: 'Helpful tips to improve your profile' },
                    { key: 'pollExpiration',        icon: '📊', label: 'Poll Expirations',    sub: 'Polls expiring in the next 7 days' },
                    { key: 'profileCardWeeklyPost', icon: '📌', label: 'Post Profile Card',  sub: 'Share profile card to L3V3L Members weekly' },
                  ].map(({ key, icon, label, sub }) => (
                    <TouchableOpacity
                      key={key}
                      style={styles.settingsRow}
                      onPress={() => togglePref(key)}
                      disabled={savingPrefs}
                    >
                      <Text style={styles.settingsRowIcon}>{icon}</Text>
                      <View style={styles.settingsRowText}>
                        <Text style={styles.settingsRowLabel}>{label}</Text>
                        <Text style={styles.settingsRowSub}>{sub}</Text>
                      </View>
                      <View style={[styles.settingsToggle, notifPrefs[key]?.enabled ? styles.settingsToggleOn : styles.settingsToggleOff]}>
                        <Text style={styles.settingsToggleText}>{notifPrefs[key]?.enabled ? 'ON' : 'OFF'}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* ---- Blocked users ---- */}
                <View style={styles.profileSection}>
                  <Text style={styles.profileSectionTitle}>
                    Blocked users{blockedUsers.length > 0 ? ` (${blockedUsers.length})` : ''}
                  </Text>

                  {blockedLoading && (
                    <View style={styles.profileInlineLoader}>
                      <ActivityIndicator size="small" color="#e94560" />
                      <Text style={styles.profileLoaderText}>Loading…</Text>
                    </View>
                  )}

                  {!blockedLoading && blockedError && (
                    <View style={styles.profileErrorBox}>
                      <Text style={styles.profileErrorText}>{blockedError}</Text>
                      <TouchableOpacity onPress={loadBlockedUsers}>
                        <Text style={styles.profileRetryLink}>Retry</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {!blockedLoading && !blockedError && blockedUsers.length === 0 && (
                    <Text style={styles.profileEmptyText}>
                      You haven’t blocked anyone.
                    </Text>
                  )}

                  {!blockedLoading && blockedUsers.length > 0 && (
                    <ScrollView style={styles.blockedGrid} nestedScrollEnabled showsVerticalScrollIndicator>
                      <View style={styles.blockedGridInner}>
                        {blockedUsers.map((u) => {
                          const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username;
                          const avatarUrl = getProfilePicUrl(u);
                          const isBusy = unblockingUser === u.username;
                          return (
                            <View key={u.username} style={styles.blockedCard}>
                              <View style={styles.blockedCardAvatarWrap}>
                                {avatarUrl ? (
                                  <Image source={{ uri: avatarUrl }} style={styles.blockedCardAvatar} />
                                ) : (
                                  <View style={[styles.blockedCardAvatar, styles.blockedAvatarFallback]}>
                                    <Text style={styles.blockedAvatarInitial}>
                                      {(name?.[0] || '?').toUpperCase()}
                                    </Text>
                                  </View>
                                )}
                                <OnlineDot online={isOnline(u.username)} size={9} />
                              </View>
                              <Text style={styles.blockedCardName} numberOfLines={1}>{name}</Text>
                              <Text style={styles.blockedCardUsername} numberOfLines={1}>@{u.username}</Text>
                              <TouchableOpacity
                                style={[styles.blockedCardUnblockBtn, isBusy && styles.unblockButtonBusy]}
                                onPress={() => handleUnblock(u.username)}
                                disabled={isBusy}
                              >
                                <Text style={styles.unblockButtonText}>
                                  {isBusy ? '…' : 'Unblock'}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                      </View>
                    </ScrollView>
                  )}
                </View>

                {/* ---- About ---- */}
                <View style={styles.profileSection}>
                  <Text style={styles.profileSectionTitle}>About</Text>
                  <View style={styles.aboutRow}>
                    <Text style={styles.aboutLabel}>Version</Text>
                    <Text style={styles.aboutValue}>{APP_VERSION}</Text>
                  </View>
                  <TouchableOpacity style={styles.aboutRow} onPress={() => openLink(helpUrl)}>
                    <Text style={styles.aboutLabel}>Help</Text>
                    <Text style={styles.aboutLink}>Open ↗</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.aboutRow} onPress={() => openLink(contactUrl)}>
                    <Text style={styles.aboutLabel}>Contact</Text>
                    <Text style={styles.aboutLink}>Open ↗</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.profileSection}>
                <Text style={styles.profileSectionTitle}>Apps</Text>

                <View style={styles.appCard}>
                  <Text style={styles.appTitle}>⏱️ Timer App</Text>
                  <Text style={styles.appSubText}>Start a countdown in seconds.</Text>
                  <View style={styles.appInputRow}>
                    <TextInput
                      style={styles.appNumberInput}
                      value={timerInputSeconds}
                      onChangeText={setTimerInputSeconds}
                      keyboardType="numeric"
                      placeholder="Seconds"
                      placeholderTextColor="#6b7490"
                    />
                  </View>
                  <View style={styles.appActionsRow}>
                    <TouchableOpacity
                      style={[styles.appBtn, styles.appBtnEqual]}
                      onPress={() => {
                        const n = parseInt(timerInputSeconds, 10);
                        if (!Number.isFinite(n) || n < 1) return;
                        setTimerRemainingSeconds(n);
                        setTimerRunning(true);
                      }}
                    >
                      <Text style={styles.appBtnText}>Start</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.appBtn, styles.appBtnGhost, styles.appBtnEqual]}
                      onPress={() => setTimerRunning((v) => !v)}
                    >
                      <Text style={styles.appBtnText}>{timerRunning ? 'Pause' : 'Resume'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.appBtn, styles.appBtnGhost, styles.appBtnEqual]}
                      onPress={() => {
                        setTimerRunning(false);
                        setTimerRemainingSeconds(parseInt(timerInputSeconds, 10) || 0);
                      }}
                    >
                      <Text style={styles.appBtnText}>Reset</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.appTimerCountdown}>
                    Remaining: {Math.floor(timerRemainingSeconds / 60)}:{String(timerRemainingSeconds % 60).padStart(2, '0')}
                  </Text>
                </View>

                <View style={styles.appCard}>
                  <Text style={styles.appTitle}>🔔 Beeper App</Text>
                  <Text style={styles.appSubText}>Play a short beep every N seconds.</Text>
                  <View style={styles.appInputRow}>
                    <TextInput
                      style={styles.appNumberInput}
                      value={beeperSecondsInput}
                      onChangeText={setBeeperSecondsInput}
                      keyboardType="numeric"
                      placeholder="N seconds"
                      placeholderTextColor="#6b7490"
                    />
                  </View>
                  <View style={styles.appActionsRow}>
                    <TouchableOpacity
                      style={[styles.appBtn, styles.appBtnEqual]}
                      onPress={() => {
                        const n = parseInt(beeperSecondsInput, 10);
                        if (!Number.isFinite(n) || n < 1) return;
                        setBeeperRunning(true);
                      }}
                    >
                      <Text style={styles.appBtnText}>Start</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.appBtn, styles.appBtnGhost, styles.appBtnEqual]}
                      onPress={() => setBeeperRunning(false)}
                    >
                      <Text style={styles.appBtnText}>Stop</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.appBtn, styles.appBtnGhost, styles.appBtnEqual]} onPress={playBeep}>
                      <Text style={styles.appBtnText}>Test Beep</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.appStatusText}>
                    Status: {beeperRunning ? `Beeping every ${beeperSecondsInput}s` : 'Stopped'}
                  </Text>
                </View>
              </View>
            )}

            {/* ---- Sign out ---- */}
            <TouchableOpacity style={styles.signOutButton} onPress={onLogout}>
              <Text style={styles.signOutButtonText}>🚪  Sign out</Text>
            </TouchableOpacity>
          </ScrollView>
        );
      }

      case 'search':
        return (
          <ScrollView style={styles.messagesContainer} contentContainerStyle={styles.searchContent}>
            <View style={styles.searchHeader}>
              <Text style={styles.contentTitle}>Search Results</Text>
              <TouchableOpacity onPress={() => handleMenuClick('all')} style={styles.searchCloseBtn} activeOpacity={0.7}>
                <Text style={styles.searchCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {searchDescription ? (
              <Text style={styles.searchDescription}>{searchDescription}</Text>
            ) : null}

            {searchLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#e94560" />
                <Text style={styles.loadingText}>Searching profiles...</Text>
              </View>
            )}

            {searchError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{searchError}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={runSearch}>
                  <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {!searchLoading && !searchError && searchResults.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No matches found</Text>
              </View>
            )}

            {!searchLoading && searchResults.length > 0 && (
              <View style={styles.stampGrid}>
                {searchResults.map((result) => {
                  const name = `${result.firstName || ''} ${result.lastName || ''}`.trim() || result.username;
                  const avatarUrl = getProfilePicUrl(result);
                  return (
                    <TouchableOpacity
                      key={result.username || result._id || result.profileId}
                      style={[styles.stampCard, getSearchStampStatusStyle(result)]}
                      onPress={() => openChatFromSearch(result)}
                      activeOpacity={0.7}
                    >
                      {avatarUrl ? (
                        <Image source={{ uri: avatarUrl }} style={styles.stampBgImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.stampBgFallback}>
                          <View style={styles.stampAvatarFallbackBadge}>
                            <Text style={styles.stampAvatarInitial}>{(name[0] || '?').toUpperCase()}</Text>
                          </View>
                        </View>
                      )}
                      <View style={styles.stampOverlay}>
                        <Text style={styles.stampName} numberOfLines={1}>{name}</Text>
                        <Text style={styles.stampMeta} numberOfLines={1}>
                          {[
                            result.age ? `${result.age} yrs` : '',
                            result.location || '',
                          ].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
        );

      default:
        return (
          <View style={styles.contentPlaceholder}>
            <Text style={styles.contentTitle}>{menuItems.find(i => i.id === activeTab)?.label || 'Dashboard'}</Text>
            <Text style={styles.placeholderText}>Content will appear here</Text>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Navigation Bar */}
      <View style={styles.topNavBar}>
        <TouchableOpacity
          style={styles.topNavItem}
          onPress={() => handleMenuClick('main_app')}
          activeOpacity={0.7}
        >
          <Image source={{ uri: '/L3V3L_MATCHES_master_transparent.png' }} style={styles.topNavBrandLogo} resizeMode="contain" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.topNavItem}
          onPress={() => handleMenuClick('profile')}
          activeOpacity={0.7}
        >
          {profilePicUrl ? (
            <Image source={{ uri: profilePicUrl }} style={styles.topNavProfilePic} />
          ) : (
            <Text style={styles.topNavIcon}>{'\uD83D\uDC64'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.topNavItem, activeTab === 'search' && styles.topNavItemActive]}
          onPress={() => handleMenuClick('search')}
          activeOpacity={0.7}
        >
          <Text style={styles.topNavIcon}>🔍</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.topNavItem, activeTab === 'portal_members' && styles.topNavItemActive]}
          onPress={() => handleMenuClick('portal_members')}
          activeOpacity={0.7}
        >
          <Text style={styles.topNavIcon}>🦋</Text>
          {activeMembersCount > 0 && (
            <View style={styles.topNavBadge}>
              <Text style={styles.topNavBadgeText}>{activeMembersCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.topNavItem, activeTab === 'messages' && styles.topNavItemActive]}
          onPress={() => handleMenuClick('messages')}
          activeOpacity={0.7}
        >
          <Text style={styles.topNavIcon}>💬</Text>
          {myMessagesCount > 0 && (
            <View style={styles.topNavBadge}>
              <Text style={styles.topNavBadgeText}>{myMessagesCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.topNavItem, activeTab === 'l3v3lagent' && styles.topNavItemActive]}
          onPress={() => handleMenuClick('l3v3lagent')}
          activeOpacity={0.7}
        >
          <Text style={styles.topNavIcon}>🤖</Text>
          {l3v3lAgentCount > 0 && (
            <View style={styles.topNavBadge}>
              <Text style={styles.topNavBadgeText}>{l3v3lAgentCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.topNavItem, styles.topNavAllButton, activeTab === 'all' && styles.topNavItemActive]}
          onPress={() => {
            setDidAutoSelectPortal(true); // lock explicit user choice; do not let initial landing auto-select override
            setSelectedChat(null);
            setActiveTab('all');
            // Ensure special topics (Portal + L3V3L Agent) are loaded for the unified ALL view
            if (!portalGroup) loadPortalMembersGroup();
            if (!l3v3lAgentConv) loadL3V3LAgentConv();
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.topNavAllText}>ALL</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.topNavItem, styles.topNavExitButton]}
          onPress={onLogout}
          activeOpacity={0.7}
        >
          <Text style={[styles.topNavIcon, styles.topNavExitIcon]}>🚪</Text>
        </TouchableOpacity>
      </View>

      {/* Right column: header + content + footer below the top nav bar. */}
      <View style={styles.rightColumn}>
        {searchActive && (
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search conversations..."
              placeholderTextColor="#666"
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                <Text style={styles.searchClear}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Agent notification nudge — shows briefly after fresh data is loaded */}
        {showNotificationBanner && (
          <TouchableOpacity
            style={styles.agentNudge}
            onPress={() => { setShowNotificationBanner(false); handleMenuClick('l3v3lagent'); }}
          >
            <Text style={styles.agentNudgeText}>🤖 Notifications sent to L3V3L Agent ↗</Text>
            <TouchableOpacity onPress={() => setShowNotificationBanner(false)}>
              <Text style={styles.agentNudgeClose}>✕</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}

        {/* Content Area */}
        <View style={styles.content}>
          {selectedChat ? (
            <ChatScreen
              key={selectedChat.id}
              {...selectedChat}
              isOnline={isOnline}
              onBack={() => setSelectedChat(null)}
              onOpenDirectChat={(uname) => {
                // Open a legacy 1:1 chat with the tapped username. Mirrors the
                // shape used by the direct-conversations list (line ~191):
                //   id: 'direct:<username>', isLegacy: true.
                if (!uname) return;
                setSelectedChat({
                  id: `direct:${uname}`,
                  name: uname,
                  isGroup: false,
                  isLegacy: true,
                  username: uname,
                });
              }}
            />
          ) : (
            renderContent()
          )}
        </View>

        {/* Bottom Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>🦋 L3V3L Matches Messenger</Text>
          <Text style={styles.footerOnlineText}>{`${onlineSet?.size || 0} online`}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: '100dvh',
    minHeight: '100dvh',
    maxHeight: '100dvh',
    backgroundColor: '#1a1a2e',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  rightColumn: {
    flex: 1,
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
  },

  // Top Navigation Bar
  topNavBar: {
    height: 48,
    backgroundColor: '#0f0f23',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a3e',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  searchBar: {
    height: 44,
    backgroundColor: '#0f0f23',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a3e',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  searchIcon: {
    fontSize: 14,
    color: '#888',
    width: 22,
    textAlign: 'center',
  },
  searchInput: {
    flex: 1,
    height: 32,
    backgroundColor: '#16213e',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  searchClear: {
    fontSize: 16,
    color: '#888',
    paddingHorizontal: 6,
  },
  topNavItem: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  topNavItemActive: {
    backgroundColor: 'rgba(233, 69, 96, 0.15)',
  },
  topNavIcon: {
    width: 22,
    height: 22,
    fontSize: 20,
    lineHeight: 22,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  topNavProfilePic: {
    width: 22,
    height: 22,
    borderRadius: 6,
  },
  topNavBrandLogo: {
    width: 24,
    height: 24,
  },
  topNavBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#e94560',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  topNavBadgeText: {
    color: '#fff',
    fontSize: 7.5,
    fontWeight: 'bold',
    letterSpacing: 0.2,
  },
  topNavAllButton: {
    backgroundColor: '#1a1a3e',
    borderRadius: 8,
  },
  topNavAllText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  topNavExitButton: {
    marginLeft: 'auto',
  },
  topNavExitIcon: {
    fontSize: 20,
  },

  // Content area
  content: {
    flex: 1,
    minHeight: 0,
    flexShrink: 1,
    backgroundColor: '#1a1a2e',
  },
  contentPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  contentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#888',
    textTransform: 'uppercase',
  },
  sectionToggle: {
    fontSize: 12,
    color: '#888',
  },
  placeholderText: {
    fontSize: 15,
    color: '#888',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#888',
    fontSize: 14,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    color: '#e94560',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: 'rgba(233, 69, 96, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e94560',
  },
  retryBtnText: {
    color: '#e94560',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubText: {
    color: '#888',
    fontSize: 14,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  memberCount: {
    fontSize: 12,
    color: '#888',
    marginLeft: 8,
  },
  convAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e94560',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative', // anchor for absolutely positioned <OnlineDot />
  },
  convAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  convInfo: {
    flex: 1,
  },
  convHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  convName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  convTime: {
    fontSize: 12,
    color: '#888',
  },
  convMessage: {
    fontSize: 14,
    color: '#aaa',
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: '#e94560',
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 6,
  },

  // Footer
  footer: {
    backgroundColor: '#16213e',
    paddingVertical: 4,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#0f3460',
    flexShrink: 0,
  },
  footerText: {
    fontSize: 9,
    lineHeight: 11,
    color: '#666',
  },
  footerOnlineText: {
    fontSize: 9,
    lineHeight: 11,
    color: '#22c55e',
    marginLeft: 6,
    fontWeight: '400',
  },

  // ---- Profile panel (right side when "Your profile" is active) ----
  profileContainer: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  profileContent: {
    padding: 24,
    paddingBottom: 48,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#16213e',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1f2a4d',
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#e94560',
  },
  profileAvatarFallback: {
    backgroundColor: '#0f3460',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarInitial: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  profileHeaderText: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  profileUsername: {
    color: '#8892b0',
    fontSize: 13,
    marginTop: 2,
  },
  profileTabs: {
    flexDirection: 'row',
    marginBottom: 14,
    backgroundColor: '#121b34',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: '#1f2a4d',
  },
  profileTabBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  profileTabBtnActive: {
    backgroundColor: '#1f2a4d',
  },
  profileTabText: {
    color: '#8892b0',
    fontSize: 13,
    fontWeight: '600',
  },
  profileTabTextActive: {
    color: '#fff',
  },

  profileActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#16213e',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f2a4d',
  },
  profilePrimaryAction: {
    marginBottom: 4,
  },
  profileActionIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  profileActionLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  profileActionHint: {
    color: '#8892b0',
    fontSize: 14,
  },
  profileActionHintSubtle: {
    color: '#6b7490',
    fontSize: 12,
    marginLeft: 16,
    marginBottom: 20,
  },

  profileSection: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1f2a4d',
  },
  profileSectionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  appCard: {
    backgroundColor: '#0f1b36',
    borderWidth: 1,
    borderColor: '#2a3a61',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  appTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  appSubText: {
    color: '#8892b0',
    fontSize: 12,
    marginBottom: 10,
  },
  appInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  appActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appNumberInput: {
    backgroundColor: '#121b34',
    borderWidth: 1,
    borderColor: '#2a3a61',
    borderRadius: 8,
    color: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: '100%',
  },
  appBtn: {
    backgroundColor: '#1f2a4d',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  appBtnEqual: {
    flex: 1,
    alignItems: 'center',
  },
  appBtnGhost: {
    borderColor: '#4b5f91',
  },
  appBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  appStatusText: {
    color: '#c7d2fe',
    fontSize: 12,
    marginTop: 4,
  },
  appTimerCountdown: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 8,
  },
  profileEmptyText: {
    color: '#8892b0',
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  profileInlineLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  profileLoaderText: {
    color: '#8892b0',
    fontSize: 13,
    marginLeft: 8,
  },
  profileErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  profileErrorText: {
    color: '#f87171',
    fontSize: 13,
  },
  profileRetryLink: {
    color: '#e94560',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 12,
  },

  // Blocked-user grid
  blockedGrid: {
    maxHeight: 430, // ~3.3 rows × 130px — shows ≈10 cards; scroll for more
  },
  blockedGridInner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  blockedCard: {
    width: '31%',
    margin: '1%',
    backgroundColor: '#0f3460',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f2a4d',
  },
  blockedCardAvatarWrap: {
    position: 'relative',
    width: 46,
    height: 46,
    marginBottom: 8,
  },
  blockedCardAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  blockedAvatarFallback: {
    backgroundColor: '#16213e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedAvatarInitial: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  blockedCardName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
    width: '100%',
  },
  blockedCardUsername: {
    color: '#8892b0',
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 10,
    width: '100%',
  },
  blockedCardUnblockBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e94560',
  },
  unblockButtonBusy: {
    opacity: 0.5,
  },
  unblockButtonText: {
    color: '#e94560',
    fontSize: 11,
    fontWeight: '600',
  },

  // About rows
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2a4d',
  },
  aboutLabel: {
    color: '#cbd5e1',
    fontSize: 14,
  },
  aboutValue: {
    color: '#8892b0',
    fontSize: 13,
  },
  aboutLink: {
    color: '#e94560',
    fontSize: 13,
    fontWeight: '600',
  },

  // Sign-out button
  signOutButton: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#dc2626',
    alignItems: 'center',
  },
  signOutButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Settings Section
  settingsHint: {
    color: '#8892b0',
    fontSize: 12,
    marginBottom: 14,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2a4d',
  },
  settingsRowIcon: {
    fontSize: 18,
    width: 32,
  },
  settingsRowText: {
    flex: 1,
    marginRight: 12,
  },
  settingsRowLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  settingsRowSub: {
    color: '#8892b0',
    fontSize: 12,
    marginTop: 2,
  },
  settingsToggle: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    minWidth: 42,
    alignItems: 'center',
  },
  settingsToggleOn: {
    backgroundColor: '#0f3460',
    borderWidth: 1,
    borderColor: '#e94560',
  },
  settingsToggleOff: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2d2d5a',
  },
  settingsToggleText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  settingsToast: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  settingsToastSuccess: {
    backgroundColor: '#0f3d1e',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  settingsToastError: {
    backgroundColor: '#3d0f0f',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  settingsToastText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  // Agent nudge (replaces banner — messages go directly to L3V3L Agent chat)
  agentNudge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f3460',
    borderBottomWidth: 1,
    borderBottomColor: '#e94560',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  agentNudgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  agentNudgeClose: {
    color: '#8892b0',
    fontSize: 16,
    paddingLeft: 12,
  },

  // Search results (postal-stamp cards)
  searchContent: {
    paddingBottom: 24,
  },
  searchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#16213e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchCloseText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  searchDescription: {
    color: '#8892b0',
    fontSize: 13,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  stampGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 4,
  },
  stampCard: {
    width: '31%',
    margin: '1%',
    backgroundColor: '#16213e',
    borderRadius: 12,
    minHeight: 132,
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderColor: '#1f2a4d',
    overflow: 'hidden',
    position: 'relative',
  },
  stampCardAwaitingReplyBlue: {
    borderWidth: 3,
    borderColor: '#60a5fa',
    backgroundColor: '#1a2b4f',
    boxShadow: '0 0 14px rgba(96, 165, 250, 0.75)',
    shadowColor: '#3b82f6',
    shadowOpacity: 0.7,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  stampCardNeedsReplyPink: {
    borderWidth: 3,
    borderColor: '#f472b6',
    backgroundColor: '#3a1d33',
    boxShadow: '0 0 14px rgba(244, 114, 182, 0.75)',
    shadowColor: '#ec4899',
    shadowOpacity: 0.65,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  stampBgImage: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
  },
  stampBgFallback: {
    position: 'absolute',
    inset: 0,
    backgroundColor: '#0f3460',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stampAvatarFallbackBadge: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#18457f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stampOverlay: {
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(6, 10, 20, 0.68)',
  },
  stampAvatarInitial: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  stampName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'left',
    width: '100%',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  stampMeta: {
    color: '#d1d9ee',
    fontSize: 11,
    textAlign: 'left',
    width: '100%',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
