import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import useMessengerStore from '@messenger/stores/messengerStore';
import useAuthStore from '@messenger/stores/authStore';
import { API_BASE_URL } from '@messenger/config/api';
import ChatScreen from './ChatScreen';

export default function ConversationListScreen({ onChatOpen, onNewChat, onLogout }) {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState('messages');
  const [error, setError] = useState(null);
  const [allConversations, setAllConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState({ groups: true, direct: true });
  const [messagesExpanded, setMessagesExpanded] = useState(true);
  const [selectedChat, setSelectedChat] = useState(null);
  const [portalGroup, setPortalGroup] = useState(null);
  const [usVedikaGroup, setUsVedikaGroup] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  const {
    conversations,
    isLoadingConversations,
    fetchConversations,
  } = useMessengerStore();

  const { user } = useAuthStore();

  // Fetch conversations on mount and when tab changes
  useEffect(() => {
    loadAllConversations();
    loadUserProfile();
  }, []);

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
      const api = useAuthStore.getState().getApi();

      // Fetch L3V3L Messenger conversations (groups + new direct chats)
      console.log('📬 Fetching L3V3L Messenger conversations...');
      let messengerConvs = [];
      try {
        const res = await api.get('/api/messenger/conversations');
        messengerConvs = res.data?.conversations || res.data || [];
        // Normalize: ensure id field
        messengerConvs = messengerConvs.map(c => ({ ...c, id: c.id || c._id }));
        console.log('✅ Messenger conversations:', messengerConvs.length);
      } catch (e) {
        console.warn('⚠️ Failed to load messenger conversations:', e.message);
      }

      // Fetch main app 1:1 conversations (legacy direct messages)
      console.log('📬 Fetching main app 1:1 conversations...');
      let directConvs = [];
      try {
        const res = await api.get('/api/users/messages/conversations');
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
          } catch (e) {
            // Ignore per-user profile fetch failures
          }
        }));
        console.log('✅ Enriched direct conversations with profile metadata');
      } catch (e) {
        console.warn('⚠️ Failed to load main app conversations:', e.message);
      }

      // Fetch Portal Members group (auto-create if needed)
      console.log('🌐 Fetching Portal Members group...');
      let portalGroupResp = null;
      try {
        const res = await api.get('/api/messenger/portal-members-group');
        portalGroupResp = res.data?.conversation;
        if (portalGroupResp) {
          portalGroupResp.id = portalGroupResp.id || portalGroupResp._id;
        }
        console.log('✅ Portal Members group:', portalGroupResp?.id);
        setPortalGroup(portalGroupResp);
      } catch (e) {
        console.warn('⚠️ Failed to load Portal Members group:', e.message);
      }

      // Fetch US Vedika group (auto-create if needed)
      console.log('🇺🇸 Fetching US Vedika group...');
      let usVedikaGroupResp = null;
      try {
        const res = await api.get('/api/messenger/us-vedika/group');
        usVedikaGroupResp = res.data?.conversation;
        if (usVedikaGroupResp) {
          usVedikaGroupResp.id = usVedikaGroupResp.id || usVedikaGroupResp._id;
        }
        console.log('✅ US Vedika group:', usVedikaGroupResp?.id);
        setUsVedikaGroup(usVedikaGroupResp);
      } catch (e) {
        console.warn('⚠️ Failed to load US Vedika group:', e.message);
        console.warn('⚠️ Error details:', e.response?.data || e.response);
        // US Vedika might not exist yet or user doesn't have permission
        // This is OK - the menu item will be disabled or show a message
      }

      // Combine: exclude portal group (it has its own top-level menu item)
      const combinedMap = new Map();
      messengerConvs.forEach(c => {
        // Skip Portal Members group (shown separately)
        if (c.type === 'group' && c.groupName === 'Portal Members') return;
        combinedMap.set(c.id, c);
      });
      directConvs.forEach(c => combinedMap.set(c.id, c));

      const combined = Array.from(combinedMap.values());
      console.log('✅ My Messages conversations:', combined.length);
      setAllConversations(combined);
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

  // Helper: get display name for a conversation (L3V3L Messenger structure)
  const getConvDisplay = (conv) => {
    // Group chat
    if (conv.type === 'group' && conv.groupName) {
      return { name: conv.groupName, isGroup: true };
    }
    // Legacy direct chat
    if (conv.type === 'direct_legacy') {
      return { name: conv.otherUsername || 'Unknown', isGroup: false };
    }
    // Direct chat - find other participant
    const other = conv.participants?.find(p => p.username !== user?.username);
    const name = other?.username || 'Unknown';
    return { name, isGroup: false };
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
  const menuItems = [
    { id: 'profile', label: displayName, subLabel: user?.username || 'Your profile', icon: '👤', isProfile: true },
    { id: 'us_vedika', label: 'US Vedika', subLabel: 'Group chat', icon: '👥' },
    { id: 'portal_members', label: 'Portal Members', subLabel: 'All active members', icon: '🦋' },
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
      return;
    }
    if (id === 'us_vedika') {
      console.log('🇺🇸 US Vedika clicked, group:', usVedikaGroup);
      if (usVedikaGroup) {
        setSelectedChat({
          id: usVedikaGroup.id,
          name: usVedikaGroup.groupName,
          isGroup: true,
          isLegacy: false,
        });
      } else {
        console.warn('⚠️ US Vedika group not loaded yet - check console for API error');
        // Try to fetch the group again
        loadAllConversations();
      }
      return;
    }
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
                        <TouchableOpacity key={key} style={styles.conversationItem} onPress={() => setSelectedChat({ id: key, name: display.name, isGroup: display.isGroup, isLegacy })}>
                          <View style={styles.convAvatar}>
                            <Text style={styles.convAvatarText}>{display.name.charAt(0).toUpperCase()}</Text>
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>L3V3L Matches Messenger</Text>
      </View>

      {/* Main Content */}
      <View style={styles.main}>
        {/* Sidebar - expanded or collapsed icon strip */}
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
                      <Text style={[styles.menuLabel, activeTab === item.id && styles.menuLabelActive]}>
                        {item.label}
                      </Text>
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
                      return (
                        <TouchableOpacity
                          key={key}
                          style={styles.subMenuItem}
                          onPress={() => setSelectedChat({ id: key, name: display.name, isGroup: display.isGroup, isLegacy, profile: conv.profile })}
                        >
                          <Text style={styles.subMenuIcon}>{display.isGroup ? '🦋' : '👤'}</Text>
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

        {/* Content Area */}
        <View style={styles.content}>
          {selectedChat ? (
            <ChatScreen
              key={selectedChat.id}
              {...selectedChat}
              onBack={() => setSelectedChat(null)}
            />
          ) : (
            renderContent()
          )}
        </View>
      </View>

      {/* Bottom Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>L3V3L Matches Messenger</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: '100vh', backgroundColor: '#1a1a2e' },

  // Header
  header: {
    backgroundColor: '#16213e',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
    height: 56,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#e94560',
    letterSpacing: 0.5,
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
    paddingTop: 8,
    flexDirection: 'column',
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
  subMenuIcon: {
    fontSize: 14,
    marginRight: 8,
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
});
