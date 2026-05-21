import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image, Linking } from 'react-native';
import useMessengerStore from '@messenger/stores/messengerStore';
import useAuthStore from '@messenger/stores/authStore';
import { API_BASE_URL } from '@messenger/config/api';
import ChatScreen from './ChatScreen';
import OnlineDot from '../components/OnlineDot';
import useOnlinePresence from '../hooks/useOnlinePresence';
import { getMainAppUrl as getMainAppUrlFromConfig } from '../config/apiConfig';

// Messenger-web app version (shown in the About section of the profile panel)
const APP_VERSION = '0.1.0';

// Main matrimonial app URL — profile editing lives there, not in messenger-web.
const getMainAppUrl = () => {
  return getMainAppUrlFromConfig();
};

export default function ConversationListScreen({ onChatOpen, onNewChat, onLogout }) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('messages');
  const [error, setError] = useState(null);
  const [allConversations, setAllConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState({ groups: true, direct: true });
  const [messagesExpanded, setMessagesExpanded] = useState(true);
  const [selectedChat, setSelectedChat] = useState(null);
  const [portalGroup, setPortalGroup] = useState(null);
  // US Vedika group is hidden in messenger-web (Portal Members is the canonical
  // @{email}-invite group now). Backend endpoints remain live for analytics and
  // existing invitations. See routes /api/messenger/us-vedika/*.
  const [userProfile, setUserProfile] = useState(null);
  // Blocked users (shown on profile tab)
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [blockedError, setBlockedError] = useState(null);
  const [unblockingUser, setUnblockingUser] = useState(null); // username currently being unblocked
  // Active members count for Portal Members menu item badge
  const [activeMembersCount, setActiveMembersCount] = useState(null);

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

      if (typeof window !== 'undefined' && window.open) {
        window.open(url, '_blank', 'noopener');
      } else {
        Linking.openURL(url).catch(() => {});
      }
    } catch (e) {
      if (typeof window !== 'undefined' && window.open) {
        window.open(fallbackUrl, '_blank', 'noopener');
      } else {
        Linking.openURL(fallbackUrl).catch(() => {});
      }
    }
  };

  // Real-time-ish online presence (polled every 30s). Used to render
  // small green/gray dots on user avatars across the messenger UI.
  const { isOnline, onlineSet } = useOnlinePresence();

  // Fetch conversations on mount and when tab changes
  useEffect(() => {
    loadAllConversations();
    loadUserProfile();
    loadActiveMembersCount();
  }, []);

  // Default landing: auto-select Portal Members group as soon as it's loaded.
  // We only auto-select once (when nothing is selected yet) so navigating away
  // and back doesn't override the user's explicit choice.
  const [didAutoSelectPortal, setDidAutoSelectPortal] = useState(false);
  useEffect(() => {
    if (didAutoSelectPortal) return;
    if (selectedChat) return;
    if (!portalGroup?.id) return;
    setSelectedChat({
      id: portalGroup.id,
      name: portalGroup.groupName || 'Portal Members',
      isGroup: true,
      isLegacy: false,
    });
    // Highlight the Portal Members entry in the left sidebar.
    setActiveTab('portal_members');
    setDidAutoSelectPortal(true);
  }, [portalGroup, selectedChat, didAutoSelectPortal]);

  // Load active members count for Portal Members badge
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
    const path = profile.imageVisibility?.profilePic || profile.images?.[0] || profile.profileImage;
    if (!path) return null;
    const token = useAuthStore.getState().token;
    const fullUrl = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
    if (token && !fullUrl.includes('token=')) {
      const sep = fullUrl.includes('?') ? '&' : '?';
      return `${fullUrl}${sep}token=${encodeURIComponent(token)}`;
    }
    return fullUrl;
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

      const [messengerRes, legacyRes, portalRes] = await Promise.allSettled([
        api.get('/api/messenger/conversations'),
        api.get('/api/users/messages/conversations'),
        api.get('/api/messenger/portal-members-group'),
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

      // Fetch Portal Members group (auto-create if needed)
      console.log('🌐 Fetching Portal Members group...');
      let portalGroupResp = null;
      try {
        if (portalRes.status !== 'fulfilled') {
          throw portalRes.reason;
        }
        const res = portalRes.value;
        portalGroupResp = res.data?.conversation;
        if (portalGroupResp) {
          portalGroupResp.id = portalGroupResp.id || portalGroupResp._id;
        }
        console.log('✅ Portal Members group:', portalGroupResp?.id);
        setPortalGroup(portalGroupResp);
      } catch (e) {
        console.warn('⚠️ Failed to load Portal Members group:', e.message);
      }

      // US Vedika fetch removed: group is hidden in messenger-web. Backend
      // still exposes /api/messenger/us-vedika/* for analytics + legacy data.

      // Combine: exclude portal group (shown separately) AND any US Vedika
      // public_group that might come through the messenger conversations list.
      const combinedMap = new Map();
      messengerConvs.forEach(c => {
        // Skip Portal Members group (shown separately)
        if (c.type === 'group' && c.groupName === 'Portal Members') return;
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

  // Group conversations
  const groupConversations = allConversations.filter(c => c.type === 'group');
  const directConversations = allConversations.filter(c => c.type !== 'group');

  // Helper: get display name for a conversation (L3V3L Messenger structure).
  // Returns `username` for direct chats so callers can do online-presence lookups.
  const getConvDisplay = (conv) => {
    // Group chat
    if (conv.type === 'group' && conv.groupName) {
      return { name: conv.groupName, isGroup: true, username: null };
    }
    // Legacy direct chat
    if (conv.type === 'direct_legacy') {
      return {
        name: conv.otherUsername || 'Unknown',
        isGroup: false,
        username: conv.otherUsername || null,
      };
    }
    // Direct chat - find other participant
    const other = conv.participants?.find(p => p.username !== user?.username);
    const name = other?.username || 'Unknown';
    return { name, isGroup: false, username: other?.username || null };
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
  // US Vedika removed: Portal Members is now the canonical @{email}-invite group.
  const menuItems = [
    { id: 'profile', label: displayName, subLabel: user?.username || 'Your profile', icon: '👤', isProfile: true },
    { id: 'portal_members', label: 'Portal Members', subLabel: 'All active members', icon: '🦋', count: activeMembersCount },
    { id: 'messages', label: 'My Messages', subLabel: 'Direct conversations', icon: '💬' },
  ];

  const handleMenuClick = (id) => {
    if (id === 'portal_members') {
      if (portalGroup) {
        setSelectedChat({
          id: portalGroup.id,
          name: portalGroup.groupName,
          isGroup: true,
          isLegacy: false,
        });
      }
      setActiveTab('portal_members');
      return;
    }
    // US Vedika handler removed (menu item hidden).
    // Clear any open chat so the right panel shows the menu item's content
    setSelectedChat(null);
    setActiveTab(id);
  };

  const renderContent = () => {
    switch (activeTab) {
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
                        <TouchableOpacity key={key} style={styles.conversationItem} onPress={() => setSelectedChat({ id: key, name: display.name, isGroup: display.isGroup, isLegacy })}>
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
                        <TouchableOpacity key={key} style={styles.conversationItem} onPress={() => setSelectedChat({ id: key, name: display.name, isGroup: display.isGroup, isLegacy, username: display.username })}>
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
          if (typeof window !== 'undefined' && window.open) {
            window.open(url, '_blank', 'noopener');
          } else {
            Linking.openURL(url).catch(() => {});
          }
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

              {!blockedLoading && blockedUsers.map((u) => {
                const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username;
                const avatarUrl = getProfilePicUrl(u);
                const isBusy = unblockingUser === u.username;
                return (
                  <View key={u.username} style={styles.blockedRow}>
                    <View style={styles.blockedAvatarWrap}>
                      {avatarUrl ? (
                        <Image source={{ uri: avatarUrl }} style={styles.blockedAvatar} />
                      ) : (
                        <View style={[styles.blockedAvatar, styles.blockedAvatarFallback]}>
                          <Text style={styles.blockedAvatarInitial}>
                            {(name?.[0] || '?').toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <OnlineDot online={isOnline(u.username)} size={11} />
                    </View>
                    <View style={styles.blockedInfo}>
                      <Text style={styles.blockedName} numberOfLines={1}>{name}</Text>
                      <Text style={styles.blockedUsername} numberOfLines={1}>@{u.username}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.unblockButton, isBusy && styles.unblockButtonBusy]}
                      onPress={() => handleUnblock(u.username)}
                      disabled={isBusy}
                    >
                      <Text style={styles.unblockButtonText}>
                        {isBusy ? 'Unblocking…' : 'Unblock'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
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

            {/* ---- Sign out ---- */}
            <TouchableOpacity style={styles.signOutButton} onPress={onLogout}>
              <Text style={styles.signOutButtonText}>🚪  Sign out</Text>
            </TouchableOpacity>
          </ScrollView>
        );
      }

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
      {/* Sidebar - full height (top to bottom). The header, content, and
          footer sit in a right-side column next to it. */}
      <View style={[styles.sidebar, sidebarExpanded ? styles.sidebarExpanded : styles.sidebarCollapsed]}>
          {/* Toggle header */}
          <TouchableOpacity
            onPress={() => setSidebarExpanded(!sidebarExpanded)}
            style={[styles.sidebarToggle, !sidebarExpanded && styles.sidebarToggleCollapsed]}
          >
            <Text style={styles.sidebarToggleText}>{sidebarExpanded ? '✕' : '☰'}</Text>
            {sidebarExpanded && <Text style={styles.sidebarToggleLabel}>Close sidebar</Text>}
          </TouchableOpacity>

          {/* Scrollable Menu */}
          <ScrollView style={styles.sidebarScroll} contentContainerStyle={styles.sidebarScrollContent}>
          {menuItems.map((item) => {
            const isMessages = item.id === 'messages';
            return (
              <View key={item.id}>
                <TouchableOpacity
                  style={[
                    styles.menuItem,
                    activeTab === item.id && styles.menuItemActive,
                    !sidebarExpanded && styles.menuItemCollapsed,
                  ]}
                  onPress={() => {
                    if (isMessages && sidebarExpanded) {
                      setMessagesExpanded(!messagesExpanded);
                    }
                    handleMenuClick(item.id);
                  }}
                >
                  {item.isProfile && profilePicUrl ? (
                    <Image
                      source={{ uri: profilePicUrl }}
                      style={[styles.menuProfilePic, !sidebarExpanded && styles.menuProfilePicCollapsed]}
                    />
                  ) : (
                    <Text style={[styles.menuIcon, !sidebarExpanded && styles.menuIconCollapsed]}>{item.icon}</Text>
                  )}
                  {sidebarExpanded && (
                    <View style={styles.menuTextContainer}>
                      <View style={styles.menuLabelRow}>
                        <Text style={[styles.menuLabel, activeTab === item.id && styles.menuLabelActive]}>
                          {item.label}
                        </Text>
                        {item.count !== null && item.count !== undefined && (
                          <View style={styles.menuCountBadge}>
                            <Text style={styles.menuCountText}>{item.count}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.menuSubLabel}>{item.subLabel}</Text>
                    </View>
                  )}
                  {isMessages && sidebarExpanded && (
                    <Text style={styles.sidebarChevron}>{messagesExpanded ? '▼' : '▶'}</Text>
                  )}
                </TouchableOpacity>

                {/* My Messages collapsible children */}
                {isMessages && sidebarExpanded && messagesExpanded && (
                  <View style={styles.subMenu}>
                    {isLoading && (
                      <Text style={styles.subMenuHint}>Loading...</Text>
                    )}
                    {!isLoading && allConversations.length === 0 && (
                      <Text style={styles.subMenuHint}>No conversations</Text>
                    )}
                    {!isLoading && allConversations.map((conv, index) => {
                      const display = getConvDisplay(conv);
                      const key = conv._id || conv.id || index;
                      const isLegacy = conv.type === 'direct_legacy';
                      const p = conv.profile || {};
                      const fullName = [p.firstName, p.lastName].filter(Boolean).join(' ');
                      const metaParts = [
                        p.age ? `${p.age}y` : null,
                        p.height || null,
                        p.profession || null,
                        p.location || null,
                      ].filter(Boolean);
                      const metaLine = metaParts.join(' · ');
                      const profilePicUrl = getProfilePicUrl(conv.profile);
                      return (
                        <TouchableOpacity
                          key={key}
                          style={styles.subMenuItem}
                          onPress={() => setSelectedChat({ id: key, name: display.name, isGroup: display.isGroup, isLegacy, profile: conv.profile, username: display.username })}
                        >
                          <View style={styles.subMenuIconWrap}>
                            {!display.isGroup && profilePicUrl ? (
                              <Image source={{ uri: profilePicUrl }} style={styles.subMenuProfilePic} />
                            ) : (
                              <Text style={styles.subMenuIcon}>{display.isGroup ? '🦋' : '👤'}</Text>
                            )}
                            {display.username && (
                              <OnlineDot online={isOnline(display.username)} size={9} />
                            )}
                          </View>
                          <View style={styles.subMenuTextWrap}>
                            <Text style={styles.subMenuLabel} numberOfLines={1}>
                              {fullName || display.name}
                            </Text>
                            {metaLine ? (
                              <Text style={styles.subMenuMeta} numberOfLines={1}>{metaLine}</Text>
                            ) : null}
                          </View>
                          {(conv.unreadCount || 0) > 0 && (
                            <View style={styles.unreadBadgeSmall}>
                              <Text style={styles.unreadTextSmall}>{conv.unreadCount}</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
          </ScrollView>

          {/* Divider */}
          {sidebarExpanded && <View style={styles.divider} />}

          {/* Logout (fixed at bottom) */}
          <TouchableOpacity
            style={[styles.menuItem, !sidebarExpanded && styles.menuItemCollapsed]}
            onPress={onLogout}
          >
            <Text style={[styles.menuIcon, !sidebarExpanded && styles.menuIconCollapsed]}>🚪</Text>
            {sidebarExpanded && (
              <View style={styles.menuTextContainer}>
                <Text style={[styles.menuLabel, { color: '#dc3545' }]}>Logout</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Footer - only in expanded mode */}
          {sidebarExpanded && (
            <View style={styles.sidebarFooter}>
              <Text style={styles.footerLink}>Help</Text>
              <Text style={styles.footerDot}>·</Text>
              <Text style={styles.footerLink}>About</Text>
              <Text style={styles.footerDot}>·</Text>
              <Text style={styles.footerLink}>Contact</Text>
            </View>
          )}
      </View>

      {/* Right column: header + content + footer all sit to the right of
          the sidebar, so the sidebar visually spans full height. */}
      <View style={styles.rightColumn}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>🦋 L3V3L Matches Messenger</Text>
            <Text style={styles.headerSubtitle}>
              {`${onlineSet?.size || 0} online`}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.headerMainAppBtn}
            onPress={() => openMainAppWithSso('/dashboard')}
          >
            <Text style={styles.headerMainAppText}>🏠 Main App</Text>
          </TouchableOpacity>
        </View>

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
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: '100vh',
    backgroundColor: '#1a1a2e',
    flexDirection: 'row',
  },
  rightColumn: {
    flex: 1,
    flexDirection: 'column',
    minHeight: '100vh',
  },

  // Header
  header: {
    backgroundColor: '#16213e',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
    minHeight: 56,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#e94560',
    letterSpacing: 0.5,
  },
  headerTitleWrap: {
    flex: 1,
    flexDirection: 'column',
  },
  headerSubtitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.85,
    marginTop: 2,
  },
  headerMainAppBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#0f3460',
    borderWidth: 1,
    borderColor: '#1a1a3e',
  },
  headerMainAppText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  headerTitleCenter: {
    textAlign: 'center',
  },
  headerToggleBtn: {
    padding: 8,
    marginRight: 12,
  },
  headerToggleText: {
    color: '#fff',
    fontSize: 20,
  },
  headerNewChatBtn: {
    padding: 8,
    marginLeft: 12,
  },
  headerNewChatText: {
    fontSize: 20,
  },

  // Main layout
  main: {
    flex: 1,
    flexDirection: 'row',
  },

  // Sidebar
  sidebar: {
    backgroundColor: '#0f0f23',
    borderRightWidth: 1,
    borderRightColor: '#1a1a3e',
    flexDirection: 'column',
    minHeight: '100vh',
  },
  sidebarExpanded: {
    width: 280,
  },
  sidebarCollapsed: {
    width: 60,
    alignItems: 'center',
  },
  sidebarScroll: {
    flex: 1,
  },
  sidebarScrollContent: {
    paddingBottom: 8,
  },

  // Sidebar toggle
  sidebarToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sidebarToggleCollapsed: {
    paddingHorizontal: 0,
    justifyContent: 'center',
    width: '100%',
  },
  sidebarToggleText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sidebarToggleLabel: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 10,
    fontWeight: '500',
  },

  // Menu items
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 8,
    marginBottom: 2,
    borderRadius: 8,
  },
  menuItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
    width: 44,
    height: 44,
    marginHorizontal: 0,
  },
  menuItemActive: {
    backgroundColor: 'rgba(233, 69, 96, 0.15)',
  },
  menuIcon: {
    fontSize: 22,
    marginRight: 14,
    width: 30,
    textAlign: 'center',
  },
  menuIconCollapsed: {
    marginRight: 0,
  },
  menuProfilePic: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 14,
    borderWidth: 2,
    borderColor: '#e94560',
  },
  menuProfilePicCollapsed: {
    marginRight: 0,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuLabel: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
    lineHeight: 22,
  },
  menuLabelActive: {
    color: '#e94560',
    fontWeight: '700',
  },
  menuCountBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#e94560',
  },
  menuCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  menuSubLabel: {
    fontSize: 12,
    color: '#888',
    lineHeight: 18,
  },
  sidebarChevron: {
    color: '#888',
    fontSize: 10,
    marginLeft: 8,
  },
  subMenu: {
    paddingLeft: 24,
    paddingRight: 8,
    paddingBottom: 4,
  },
  subMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  subMenuIconWrap: {
    position: 'relative', // anchor for absolutely positioned <OnlineDot />
    marginRight: 8,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subMenuIcon: {
    fontSize: 14,
  },
  subMenuProfilePic: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  subMenuTextWrap: {
    flex: 1,
    flexDirection: 'column',
  },
  subMenuLabel: {
    color: '#ccc',
    fontSize: 13,
  },
  subMenuMeta: {
    color: '#888',
    fontSize: 10,
    marginTop: 2,
  },
  subMenuHint: {
    color: '#666',
    fontSize: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontStyle: 'italic',
  },
  unreadBadgeSmall: {
    backgroundColor: '#e94560',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  unreadTextSmall: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: '#1a1a3e',
    marginVertical: 12,
    marginHorizontal: 16,
  },

  // Sidebar footer
  sidebarFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    marginTop: 'auto',
    paddingBottom: 20,
  },
  footerLink: {
    color: '#888',
    fontSize: 11,
  },
  footerDot: {
    color: '#555',
    fontSize: 11,
    marginHorizontal: 6,
  },

  // Content area
  content: {
    flex: 1,
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
    padding: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#0f3460',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
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

  // Blocked-user row
  blockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2a4d',
  },
  blockedAvatarWrap: {
    position: 'relative', // anchor for absolutely positioned <OnlineDot />
    width: 40,
    height: 40,
  },
  blockedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  blockedAvatarFallback: {
    backgroundColor: '#0f3460',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedAvatarInitial: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  blockedInfo: {
    flex: 1,
    marginLeft: 12,
  },
  blockedName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  blockedUsername: {
    color: '#8892b0',
    fontSize: 12,
    marginTop: 1,
  },
  unblockButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#e94560',
  },
  unblockButtonBusy: {
    opacity: 0.5,
  },
  unblockButtonText: {
    color: '#e94560',
    fontSize: 12,
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
});
