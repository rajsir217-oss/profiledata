import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatRelativeTime } from '../../../utils/timeFormatter';
import api from '../../../api';
import socketService from '../../../services/socketService';
import ChatWindow from '../../../components/ChatWindow';
import { getImageUrl } from '../../../utils/urlHelper';
import './RecentConversations.css';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const getAvatarUrl = (userProfile) => {
  if (!userProfile) return null;
  const img =
    userProfile.profileImage ||
    (Array.isArray(userProfile.images) && userProfile.images[0]) ||
    (Array.isArray(userProfile.publicImages) && userProfile.publicImages[0]) ||
    null;
  return img ? getImageUrl(img) : null;
};

const getInitials = (userProfile, username) => {
  const first = userProfile?.firstName?.[0] || '';
  const last = userProfile?.lastName?.[0] || '';
  if (first || last) return `${first}${last}`.toUpperCase();
  return (username || '?').slice(0, 2).toUpperCase();
};

const toEpochMs = (value) => {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const getConversationChip = (conversation, unattendedByUsername) => {
  const unreadCount = conversation?.unreadCount ?? 0;
  const username = conversation?.username;
  const lastMessageEpoch = toEpochMs(conversation?.lastMessageTime);
  const isNewUnread = unreadCount > 0 && lastMessageEpoch > 0 && (Date.now() - lastMessageEpoch) <= ONE_DAY_MS;

  if (isNewUnread) {
    return { label: 'NEW', className: 'is-new' };
  }

  if (username && unattendedByUsername[username]) {
    return { label: 'PENDING REPLY', className: 'is-pending' };
  }

  if (unreadCount > 0) {
    return { label: 'UNREAD', className: 'is-unread' };
  }

  return null;
};

const RecentConversations = ({ conversations }) => {
  const navigate = useNavigate();

  const currentUsername = useMemo(
    () => localStorage.getItem('username') || '',
    []
  );

  const [activeProfile, setActiveProfile] = useState(null);
  const [activeUsername, setActiveUsername] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [conversationError, setConversationError] = useState(null);
  const [failedAvatars, setFailedAvatars] = useState({});
  const [unattendedByUsername, setUnattendedByUsername] = useState({});

  const loadConversationMessages = useCallback(
    async (username) => {
      if (!username || !currentUsername) return;

      setLoadingConversation(true);
      setConversationError(null);
      try {
        const response = await api.get(
          `/messages/conversation/${encodeURIComponent(username)}?username=${encodeURIComponent(currentUsername)}`
        );
        setMessages(response.data?.messages || []);
      } catch (err) {
        setConversationError(
          err?.response?.data?.detail || err?.message || 'Failed to load conversation'
        );
      } finally {
        setLoadingConversation(false);
      }
    },
    [currentUsername]
  );

  const rows = useMemo(() => {
    const list = Array.isArray(conversations) ? conversations : [];
    return list.slice(0, 6);
  }, [conversations]);

  const closeConversation = useCallback(() => {
    setActiveUsername(null);
    setActiveProfile(null);
    setMessages([]);
    setConversationError(null);
    setLoadingConversation(false);
  }, []);

  const openConversation = useCallback(
    (c) => {
      const other = c?.username;
      if (!other) return;

      if (other === activeUsername) {
        closeConversation();
        return;
      }

      setActiveUsername(other);
      setActiveProfile({ ...(c.userProfile || {}), username: other });
      setMessages([]);
      setConversationError(null);
    },
    [activeUsername, closeConversation]
  );

  useEffect(() => {
    if (!activeUsername || !currentUsername) return;

    let cancelled = false;

    const loadConversation = async () => {
      await loadConversationMessages(activeUsername);
      if (cancelled) return;
    };

    loadConversation();
    return () => {
      cancelled = true;
    };
  }, [activeUsername, currentUsername, loadConversationMessages]);

  useEffect(() => {
    if (!currentUsername) {
      setUnattendedByUsername({});
      return;
    }

    let cancelled = false;

    const loadUnattendedConversations = async () => {
      try {
        const response = await api.get('/messages/unattended');
        const unattendedConversations = response.data?.conversations || [];
        const nextMap = unattendedConversations.reduce((acc, item) => {
          const username = item?.sender?.username;
          if (username) {
            acc[username] = item;
          }
          return acc;
        }, {});

        if (!cancelled) {
          setUnattendedByUsername(nextMap);
        }
      } catch (_) {
        if (!cancelled) {
          setUnattendedByUsername({});
        }
      }
    };

    loadUnattendedConversations();
    const pollInterval = setInterval(loadUnattendedConversations, 60000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [currentUsername]);

  useEffect(() => {
    if (!activeUsername || !currentUsername) return;

    const handleNewMessage = (data) => {
      const from = data?.from;
      const to = data?.to;

      const isFromThem = from === activeUsername && (to === currentUsername || !to);
      const isFromUs = from === currentUsername && to === activeUsername;

      if (!isFromThem && !isFromUs) return;

      setMessages((prev) => {
        const next = [...prev];
        next.push({
          from_username: from,
          to_username: to,
          message: data?.message,
          timestamp: data?.timestamp,
          is_read: false,
        });
        return next;
      });
    };

    socketService.on('new_message', handleNewMessage);
    return () => socketService.off('new_message', handleNewMessage);
  }, [activeUsername, currentUsername]);

  const handleSendMessage = useCallback(
    async (content) => {
      if (!activeUsername || !currentUsername) return;
      if (!content || !content.trim()) return;

      const trimmed = content.trim();
      try {
        const response = await api.post(
          `/messages/send?username=${encodeURIComponent(currentUsername)}`,
          {
            toUsername: activeUsername,
            content: trimmed,
          }
        );

        const newMsg = response.data?.data;
        if (newMsg) {
          setMessages((prev) => [...prev, newMsg]);
        }

        try {
          if (socketService.isConnected()) {
            await socketService.sendMessage(activeUsername, trimmed);
          }
        } catch (_) {
          // ignore websocket send failures; message is already saved via API
        }
      } catch (err) {
        setConversationError(
          err?.response?.data?.detail || err?.message || 'Failed to send message'
        );
      }
    },
    [activeUsername, currentUsername]
  );

  const handleMessageDeleted = useCallback(
    async (messageId) => {
      const deletedId = String(messageId);
      setMessages((prev) =>
        prev.filter((msg) => String(msg?._id || msg?.id || '') !== deletedId)
      );

      if (activeUsername) {
        await loadConversationMessages(activeUsername);
      }
    },
    [activeUsername, loadConversationMessages]
  );

  const handleArchiveConversation = useCallback(
    async (username) => {
      if (!username) return;
      await api.post(`/messages/conversation/${encodeURIComponent(username)}/archive`);
      closeConversation();
    },
    [closeConversation]
  );

  return (
    <section className="dv2-conversations">
      <div className="dv2-conv-header">
        <div className="dv2-conv-title-wrap">
          <h2 className="dv2-section-title">Recent conversations</h2>
          <div className="dv2-chip-help">
            <button
              className="dv2-chip-help-btn"
              type="button"
              aria-label="Message status legend"
            >
              i
            </button>
            <div className="dv2-chip-help-tooltip" role="tooltip">
              <div className="dv2-chip-help-row">
                <span className="dv2-conv-chip is-new">NEW</span>
                <span>Unread in last 24h</span>
              </div>
              <div className="dv2-chip-help-row">
                <span className="dv2-conv-chip is-unread">UNREAD</span>
                <span>Unread older message</span>
              </div>
              <div className="dv2-chip-help-row">
                <span className="dv2-conv-chip is-pending">PENDING REPLY</span>
                <span>Waiting for your response</span>
              </div>
            </div>
          </div>
        </div>
        <button className="dv2-link" type="button" onClick={() => navigate('/messages')}>
          Open inbox
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="dv2-empty">No conversations yet.</div>
      ) : (
        <div className="dv2-conv-list">
          {rows.map((c) => {
            const other = c.username;
            const avatarUrl = getAvatarUrl(c.userProfile);
            const initials = getInitials(c.userProfile, other);
            const time = c.lastMessageTime ? formatRelativeTime(c.lastMessageTime) : '';
            const showAvatar = Boolean(avatarUrl) && !failedAvatars?.[other];
            const chip = getConversationChip(c, unattendedByUsername);
            return (
              <React.Fragment key={other}>
                <button
                  className={`dv2-conv-row ${activeUsername === other ? 'is-active' : ''}`}
                  onClick={() => openConversation(c)}
                  type="button"
                >
                  <div className="dv2-conv-avatar">
                    {showAvatar ? (
                      <img
                        className="dv2-conv-img"
                        src={avatarUrl}
                        alt={other}
                        onError={() => setFailedAvatars((prev) => ({ ...(prev || {}), [other]: true }))}
                      />
                    ) : (
                      <div className="dv2-conv-initials">{initials}</div>
                    )}
                  </div>
                  <div className="dv2-conv-body">
                    <div className="dv2-conv-top">
                      <span className="dv2-conv-name">
                        {c.userProfile?.firstName
                          ? `${c.userProfile.firstName} ${c.userProfile?.lastName || ''}`.trim()
                          : other}
                      </span>
                      <div className="dv2-conv-meta">
                        {chip ? (
                          <span className={`dv2-conv-chip ${chip.className}`}>{chip.label}</span>
                        ) : null}
                        <span className="dv2-conv-time">{time}</span>
                      </div>
                    </div>
                    <div className="dv2-conv-bottom">
                      <span className="dv2-conv-snippet">{c.lastMessage || ''}</span>
                      {(c.unreadCount ?? 0) > 0 ? (
                        <span className="dv2-conv-unread">{c.unreadCount}</span>
                      ) : null}
                    </div>
                  </div>
                </button>

                <div className={`dv2-conv-drawer ${activeUsername === other ? 'is-open' : ''}`}>
                  <div className="dv2-conv-drawer-inner">
                    <div className="dv2-conv-drawer-header">
                      <div className="dv2-conv-drawer-title">
                        {activeUsername === other
                          ? activeProfile?.firstName
                            ? `${activeProfile.firstName} ${activeProfile?.lastName || ''}`.trim()
                            : activeUsername
                          : ''}
                      </div>
                      <button
                        className="dv2-conv-drawer-close"
                        type="button"
                        onClick={closeConversation}
                        aria-label="Close conversation"
                      >
                        ×
                      </button>
                    </div>

                    <div className="dv2-conv-drawer-body">
                      {activeUsername === other ? (
                        loadingConversation ? (
                          <div className="dv2-conv-drawer-loading">Loading messages…</div>
                        ) : conversationError ? (
                          <div className="dv2-conv-drawer-error">{conversationError}</div>
                        ) : (
                          <ChatWindow
                            messages={messages}
                            currentUsername={currentUsername}
                            otherUser={activeProfile}
                            onSendMessage={handleSendMessage}
                            onMessageDeleted={handleMessageDeleted}
                            onArchiveConversation={handleArchiveConversation}
                          />
                        )
                      ) : null}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default RecentConversations;
