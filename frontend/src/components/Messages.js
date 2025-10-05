import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';

const Messages = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadConversations();

    // Check if we should open a specific conversation
    const urlParams = new URLSearchParams(location.search);
    const toUsername = urlParams.get('to');
    if (toUsername) {
      // Find or create conversation with this user
      startNewConversation(toUsername);
    }
  }, [location]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      const username = localStorage.getItem('username');
      if (!username) {
        navigate('/login');
        return;
      }

      const response = await api.get(`/api/users/conversations/${username}`);
      setConversations(response.data.conversations || []);
    } catch (err) {
      console.error('Error loading conversations:', err);
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const startNewConversation = async (toUsername) => {
    // Check if conversation already exists
    const existing = conversations.find(conv => conv._id === toUsername);
    if (existing) {
      selectConversation(existing);
      return;
    }

    // Create a new conversation object
    try {
      const userResponse = await api.get(`/api/users/profile/${toUsername}`);
      const user = userResponse.data;

      const newConversation = {
        _id: toUsername,
        otherUser: user,
        lastMessage: null,
        unreadCount: 0
      };

      setConversations(prev => [newConversation, ...prev]);
      selectConversation(newConversation);
    } catch (err) {
      console.error('Error loading user for conversation:', err);
      setError('Failed to start conversation');
    }
  };

  const selectConversation = async (conversation) => {
    setSelectedConversation(conversation);
    setMessages([]);

    if (conversation.lastMessage) {
      // Load existing messages
      try {
        const username = localStorage.getItem('username');
        const response = await api.get(`/api/users/messages/${username}`);
        const allMessages = response.data.messages || [];

        // Filter messages for this conversation
        const conversationMessages = allMessages.filter(msg =>
          (msg.fromUsername === username && msg.toUsername === conversation._id) ||
          (msg.fromUsername === conversation._id && msg.toUsername === username)
        );

        setMessages(conversationMessages);
      } catch (err) {
        console.error('Error loading messages:', err);
      }
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    setSending(true);
    try {
      const username = localStorage.getItem('username');
      await api.post('/api/users/messages', {
        from_username: username,
        to_username: selectedConversation._id,
        content: newMessage.trim()
      });

      // Add message to local state
      const message = {
        id: Date.now().toString(),
        fromUsername: username,
        toUsername: selectedConversation._id,
        content: newMessage.trim(),
        createdAt: new Date().toISOString(),
        isRead: false
      };

      setMessages(prev => [...prev, message]);
      setNewMessage('');

      // Update conversation last message
      setConversations(prev => prev.map(conv => {
        if (conv._id === selectedConversation._id) {
          return {
            ...conv,
            lastMessage: message
          };
        }
        return conv;
      }));

    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="text-center py-4"><div className="spinner-border"></div></div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="container mt-4">
      <h2>💬 My Messages</h2>

      <div className="row">
        {/* Conversations List */}
        <div className="col-md-4">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Conversations</h5>
            </div>
            <div className="card-body p-0">
              {conversations.length === 0 ? (
                <p className="text-muted p-3">No conversations yet</p>
              ) : (
                conversations.map(conv => (
                  <div
                    key={conv._id}
                    className={`p-3 border-bottom ${selectedConversation?._id === conv._id ? 'bg-light' : 'cursor-pointer'}`}
                    onClick={() => selectConversation(conv)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="d-flex align-items-center">
                      <div className="flex-grow-1">
                        <strong>{conv.otherUser?.firstName} {conv.otherUser?.lastName}</strong>
                        {conv.lastMessage && (
                          <p className="mb-0 small text-muted">
                            {conv.lastMessage.content.length > 30
                              ? conv.lastMessage.content.substring(0, 30) + '...'
                              : conv.lastMessage.content}
                          </p>
                        )}
                      </div>
                      {conv.unreadCount > 0 && (
                        <span className="badge bg-primary">{conv.unreadCount}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Messages Panel */}
        <div className="col-md-8">
          {selectedConversation ? (
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">
                  Chat with {selectedConversation.otherUser?.firstName} {selectedConversation.otherUser?.lastName}
                </h5>
              </div>
              <div className="card-body" style={{ height: '400px', overflowY: 'auto' }}>
                {messages.map(message => (
                  <div
                    key={message.id}
                    className={`mb-3 ${message.fromUsername === localStorage.getItem('username') ? 'text-end' : 'text-start'}`}
                  >
                    <div
                      className={`d-inline-block p-2 rounded ${message.fromUsername === localStorage.getItem('username') ? 'bg-primary text-white' : 'bg-light'}`}
                      style={{ maxWidth: '70%' }}
                    >
                      {message.content}
                    </div>
                    <div className="small text-muted">
                      {new Date(message.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="card-footer">
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    disabled={sending}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={sendMessage}
                    disabled={sending || !newMessage.trim()}
                  >
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-body text-center">
                <p className="text-muted">Select a conversation to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;
