import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatRelativeTime } from '../../../utils/timeFormatter';
import api from '../../../api';
import socketService from '../../../services/socketService';
import ChatWindow from '../../../components/ChatWindow';
import './RecentConversations.css';

const getAvatarUrl = (userProfile) => {
  if (!userProfile) return null;
  const img =
    userProfile.profileImage ||
    (Array.isArray(userProfile.images) && userProfile.images[0]) ||
    (Array.isArray(userProfile.publicImages) && userProfile.publicImages[0]) ||
    null;
  return img || null;
};

const getInitials = (userProfile, username) => {
  const first = userProfile?.firstName?.[0] || '';
  const last = userProfile?.lastName?.[0] || '';
  if (first || last) return `${first}${last}`.toUpperCase();
  return (username || '?').slice(0, 2).toUpperCase();
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
      setLoadingConversation(true);
      setConversationError(null);
      try {
        const response = await api.get(
          `/messages/conversation/${encodeURIComponent(activeUsername)}?username=${encodeURIComponent(currentUsername)}`
        );
        if (cancelled) return;
        setMessages(response.data?.messages || []);
      } catch (err) {
        if (cancelled) return;
        setConversationError(
          err?.response?.data?.detail || err?.message || 'Failed to load conversation'
        );
      } finally {
        if (cancelled) return;
        setLoadingConversation(false);
      }
    };

    loadConversation();
    return () => {
      cancelled = true;
    };
  }, [activeUsername, currentUsername]);

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

  return (
    <section className="dv2-conversations">
      <div className="dv2-conv-header">
        <h2 className="dv2-section-title">Recent conversations</h2>
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
            return (
              <React.Fragment key={other}>
                <button
                  className={`dv2-conv-row ${activeUsername === other ? 'is-active' : ''}`}
                  onClick={() => openConversation(c)}
                  type="button"
                >
                  <div className="dv2-conv-avatar">
                    {avatarUrl ? (
                      <img className="dv2-conv-img" src={avatarUrl} alt={other} />
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
                      <span className="dv2-conv-time">{time}</span>
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
