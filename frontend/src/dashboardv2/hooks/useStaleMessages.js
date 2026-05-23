// frontend/src/dashboardv2/hooks/useStaleMessages.js
//
// Derives the "Follow up on chats" action card data CLIENT-SIDE from the
// conversations list that useDashboardData already fetched. No new backend
// endpoint needed.
//
// Definition of "stale":
//   - I am the last sender in the conversation (lastMessageBy === me)
//   - The last message is older than `staleAfterDays` days (default 7)
//
// Graceful degradation:
//   If the conversations API does not include a "last message sender" field,
//   this hook returns an empty list — the action card will simply not appear.
//   To enable it, the conversations endpoint should include `lastMessageBy`
//   (or `lastMessageSenderUsername`) in its response. That is a 5-line change
//   to messenger_service.get_conversations(), NOT a new endpoint.

import { useMemo } from 'react';

const DEFAULT_STALE_AFTER_DAYS = 7;

/**
 * Best-effort extraction of "who sent the last message" from a conversation.
 * Tries several common field names since the existing conversations endpoint
 * may return one of these shapes.
 */
function getLastMessageBy(conv) {
  return (
    conv?.lastMessageBy ||
    conv?.lastMessageSenderUsername ||
    conv?.lastMessage?.senderUsername ||
    conv?.lastMessage?.from ||
    conv?.lastMessage?.sender ||
    null
  );
}

function getLastMessageAt(conv) {
  const v =
    conv?.lastMessageAt ||
    conv?.lastMessage?.createdAt ||
    conv?.lastMessage?.timestamp ||
    conv?.updatedAt ||
    null;
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function useStaleMessages(conversations, options = {}) {
  const {
    currentUsername = typeof window !== 'undefined'
      ? localStorage.getItem('username')
      : null,
    staleAfterDays = DEFAULT_STALE_AFTER_DAYS,
  } = options;

  return useMemo(() => {
    if (!Array.isArray(conversations) || !currentUsername) return [];

    const cutoff = Date.now() - staleAfterDays * 24 * 60 * 60 * 1000;

    return conversations.filter((conv) => {
      const sender = getLastMessageBy(conv);
      if (!sender || sender !== currentUsername) return false;

      const at = getLastMessageAt(conv);
      if (!at) return false;

      return at.getTime() < cutoff;
    });
  }, [conversations, currentUsername, staleAfterDays]);
}
