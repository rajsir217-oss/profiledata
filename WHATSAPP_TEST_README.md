# WhatsApp Group Test App - Unipile API Integration

## Overview

This is a quick test application for WhatsApp group messaging using the Unipile API. It allows you to:
- List connected WhatsApp accounts
- View WhatsApp groups and chats
- Send messages to groups
- Read messages from groups
- Create new group chats
- Manage group members

## Setup

### 1. Configuration

The Unipile API credentials are already configured in:
- `fastapi_backend/.env` - UNIPILE_API_KEY and UNIPILE_DSN
- `fastapi_backend/config.py` - Settings class with unipile_api_key and unipile_dsn

### 2. Start Backend

```bash
cd fastapi_backend
./bstart.sh
# or
uvicorn main:app --reload
```

The backend will be available at `http://localhost:8000`

### 3. Open Test App

Open the test HTML file in your browser:
```
frontend/public/whatsapp-test.html
```

Or access it via:
```
http://localhost:3000/whatsapp-test.html
```

## API Endpoints

The backend provides the following endpoints:

### Configuration
- `GET /api/whatsapp/test` - Test API configuration

### Account Management
- `GET /api/whatsapp/accounts` - List all connected accounts

### Chat/Group Management
- `GET /api/whatsapp/chats` - List all chats/groups
  - Query params: `account_id`, `account_type`, `limit`, `unread_only`
- `GET /api/whatsapp/chats/{chat_id}/messages` - Get messages from a chat
- `POST /api/whatsapp/chats/{chat_id}/messages` - Send message to a chat
- `POST /api/whatsapp/chats` - Create new chat/group
- `GET /api/whatsapp/chats/{chat_id}/attendees` - Get chat participants

### Webhook
- `POST /api/whatsapp/webhook` - Receive real-time message updates

## Usage Flow

### 1. Test Configuration
Click "Test API Configuration" to verify the Unipile API is properly configured.

### 2. Connect WhatsApp Account
You'll need to connect your WhatsApp account through Unipile's hosted authentication:
- Use Unipile's Hosted Auth flow
- Or use Custom Auth with QR code scanning
- The account will appear in the accounts list

### 3. List Groups
- Select "WhatsApp" as account type
- Click "List Chats" to see all WhatsApp groups
- Note the `chat_id` for groups you want to interact with

### 4. Send Message
- Enter the chat ID from the list
- Type your message
- Click "Send Message"

### 5. Read Messages
- Enter the chat ID
- Click "Get Messages" to retrieve message history

### 6. Create Group
- Enter your account ID
- Add attendee IDs (WhatsApp numbers in format: number@s.whatsapp.net)
- Optionally set a group name
- Add an initial message
- Click "Create Group"

## Unipile API Features

Based on the documentation, Unipile supports:

### WhatsApp Features ✅
- Account connection (Hosted Auth, Custom Auth)
- Send messages
- Reply to messages
- List messages
- List chats
- List attendees
- Sync history
- Send file attachments
- Send voice notes
- Retrieve user profiles
- Webhooks for real-time updates
- **Create group chats**
- **Add/remove group members**

### Limitations
- Requires Unipile subscription
- Rate limits apply
- WhatsApp account must be connected first
- Some features may require specific WhatsApp Business account types

## Webhook Setup

To receive real-time message updates:

1. Configure webhook URL in Unipile dashboard pointing to:
   ```
   https://your-domain.com/api/whatsapp/webhook
   ```

2. The webhook endpoint handles:
   - `message_received` - New messages
   - `message_read` - Read receipts
   - `message_reaction` - Reactions
   - `message_edited` - Edited messages
   - `message_deleted` - Deleted messages

## Next Steps

### For Production Integration

1. **Authentication**: Integrate with your existing JWT auth system
2. **Database**: Store chat IDs, message history in MongoDB
3. **UI**: Build React components for group management
4. **Webhooks**: Set up proper webhook handling and event processing
5. **Error Handling**: Add comprehensive error handling and retry logic
6. **Rate Limiting**: Implement rate limiting for API calls
7. **Caching**: Cache chat lists and message history

### Integration with L3V3L Matches

Consider integrating WhatsApp groups for:
- Family group introductions
- Match coordination
- Event planning
- Community building

## Troubleshooting

### "Unipile API credentials not configured"
- Check `.env` file has UNIPILE_API_KEY and UNIPILE_DSN
- Restart backend after changing .env

### "Failed to connect to Unipile API"
- Check network connectivity
- Verify DSN URL is correct
- Check Unipile service status

### No accounts listed
- You need to connect a WhatsApp account first via Unipile
- Use Unipile's Hosted Auth or Custom Auth flow

### "Chat not found"
- Verify the chat ID is correct
- Check the account has access to that chat
- Ensure the chat hasn't been deleted

## Security Notes

⚠️ **Important Security Considerations:**

- The API key is in `.env` - never commit this to git
- In production, use environment variables or secret management
- Implement proper authentication for the API endpoints
- Validate all user inputs
- Rate limit webhook endpoints to prevent abuse
- Sanitize webhook data before processing

## Documentation Links

- [Unipile Developer Docs](https://developer.unipile.com/docs)
- [Unipile WhatsApp Features](https://developer.unipile.com/docs/list-provider-features)
- [Send Messages API](https://developer.unipile.com/docs/send-messages)
- [Webhooks](https://developer.unipile.com/docs/new-messages-webhook)

## Support

For issues with:
- **Unipile API**: Contact Unipile support
- **Backend integration**: Check FastAPI logs
- **Frontend**: Check browser console for errors
