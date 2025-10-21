# 📧 Email Template Setup Guide

Complete guide for setting up and managing email notification templates.

---

## 🚀 Quick Setup

### Step 1: Run Setup Script

```bash
cd /Users/rajsiripuram02/opt/appsrc/profiledata
python3 setup_email_templates.py
```

This will create all email templates in the `notification_templates` MongoDB collection.

**Output:**
```
🔧 Setting up email templates...
✨ Created: new_match (email)
✨ Created: mutual_favorite (email)
✨ Created: shortlist_added (email)
✨ Created: match_milestone (email)
✨ Created: profile_view (email)
✨ Created: favorited (email)
✨ Created: new_message (email)
✨ Created: message_read (email)
✨ Created: pii_request (email)
✨ Created: pii_granted (email)
✨ Created: unread_messages (email)

🎉 Successfully set up 11 email templates!
```

### Step 2: Verify Templates

Check MongoDB:
```javascript
use matrimonialDB
db.notification_templates.find().pretty()
```

Or use the API:
```bash
curl http://localhost:8000/api/notifications/templates \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📋 Template Categories

### 1. Match Notifications (category: "match")
- **new_match** - New match found
- **mutual_favorite** - Mutual favorite match
- **shortlist_added** - Added to shortlist
- **match_milestone** - Milestone achievements

### 2. Activity Notifications (category: "activity")
- **profile_view** - Profile was viewed
- **favorited** - Someone favorited you
- **visibility_spike** - Profile getting more views
- **search_appearance** - Appeared in search results

### 3. Message Notifications (category: "messages")
- **new_message** - New chat message received
- **message_read** - Message was read
- **conversation_cold** - Conversation going cold

### 4. Privacy Notifications (category: "privacy")
- **pii_request** - Someone requested contact info
- **pii_granted** - Contact info access granted
- **pii_denied** - Contact info access denied
- **pii_expiring** - Access expiring soon

### 5. Engagement Notifications (category: "engagement")
- **unread_messages** - Unread messages digest
- **new_users_matching** - New potential matches
- **profile_incomplete** - Complete your profile
- **upload_photos** - Add more photos

---

## 🎨 Template Variables

### Recipient Variables
```
{recipient.firstName}     - Recipient's first name
{recipient.username}      - Recipient's username
{recipient.age}          - Recipient's age
{recipient.location}     - Recipient's location
{recipient.gender}       - Recipient's gender
```

### Match/Sender Variables
```
{match.firstName}        - Match's first name
{match.username}         - Match's username
{match.age}             - Match's age
{match.matchScore}      - Compatibility score (0-100)
{match.location}        - Match's location
{match.occupation}      - Match's job
{match.education}       - Match's education
```

### Event Variables
```
{event.type}            - Event type
{event.timestamp}       - Event timestamp
{event.message}         - Event message
```

### App URLs
```
{app.profileUrl}        - Link to view profile
{app.chatUrl}           - Link to chat/messages
{app.matchUrl}          - Link to matches page
{app.settingsUrl}       - Link to settings
{app.unsubscribeUrl}    - Unsubscribe link
```

### Statistics
```
{stats.mutualMatches}    - Number of mutual matches
{stats.unreadMessages}   - Number of unread messages
{stats.profileViews}     - Profile view count (24h)
{stats.newMatches}       - New matches (7 days)
```

---

## 🔧 Conditional Logic

### Basic Conditions

**If statement:**
```html
{% if match.matchScore >= 90 %}
  <p style="color: #10b981;">This is a high compatibility match!</p>
{% endif %}
```

**If-else statement:**
```html
{% if match.age < 30 %}
  <p>Connect with {match.firstName}, a young professional!</p>
{% else %}
  <p>Connect with {match.firstName}, an experienced individual!</p>
{% endif %}
```

**Multiple conditions:**
```html
{% if match.matchScore >= 90 %}
  <p>🔥 Exceptional Match!</p>
{% elif match.matchScore >= 75 %}
  <p>⭐ Great Match!</p>
{% elif match.matchScore >= 60 %}
  <p>👍 Good Match!</p>
{% else %}
  <p>💫 Potential Match!</p>
{% endif %}
```

### Complex Conditions

**AND operator:**
```html
{% if match.matchScore >= 80 and match.location == recipient.location %}
  <p>🎯 High match score AND same location!</p>
{% endif %}
```

**OR operator:**
```html
{% if stats.unreadMessages > 5 or stats.newMatches > 3 %}
  <p>You have lots of activity!</p>
{% endif %}
```

**NOT operator:**
```html
{% if not match.profilePicture %}
  <p>Note: This user hasn't uploaded a profile picture yet.</p>
{% endif %}
```

---

## 📧 Complete Template Examples

### Example 1: New Match (Simple)

```python
{
  "trigger": "new_match",
  "channel": "email",
  "subject": "🎉 New Match: {match.firstName}",
  "body": """
<div style="font-family: Arial; max-width: 600px;">
  <h2>Hi {recipient.firstName}! 🎉</h2>
  
  <p>You matched with <strong>{match.firstName}</strong>, {match.age}.</p>
  
  <p>Match Score: <strong>{match.matchScore}%</strong></p>
  
  <a href="{app.matchUrl}" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
    View Profile
  </a>
</div>
  """
}
```

### Example 2: New Match (With Conditionals)

```python
{
  "trigger": "new_match",
  "channel": "email",
  "subject": "🎉 New Match: {match.firstName}",
  "body": """
<div style="font-family: Arial; max-width: 600px;">
  <h2>Hi {recipient.firstName}! 🎉</h2>
  
  <p>You matched with <strong>{match.firstName}</strong>, {match.age}, from {match.location}.</p>
  
  <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
    <p>Match Score: <strong style="color: #6366f1; font-size: 1.2em;">{match.matchScore}%</strong></p>
    
    {% if match.matchScore >= 90 %}
      <p style="color: #10b981; font-weight: bold;">🔥 This is an exceptional match!</p>
    {% elif match.matchScore >= 75 %}
      <p style="color: #3b82f6;">⭐ This is a great match!</p>
    {% endif %}
  </div>
  
  {% if match.location == recipient.location %}
    <p style="background: #dbeafe; padding: 10px; border-radius: 6px;">
      📍 <strong>Same location!</strong> You're both in {match.location}
    </p>
  {% endif %}
  
  <p style="margin: 20px 0; text-align: center;">
    <a href="{app.matchUrl}" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      View {match.firstName}'s Profile
    </a>
  </p>
  
  <p>Don't keep them waiting - start chatting now!</p>
  
  <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
  
  <p style="font-size: 0.9em; color: #6b7280;">
    <a href="{app.settingsUrl}" style="color: #6b7280;">Notification Settings</a> | 
    <a href="{app.unsubscribeUrl}" style="color: #6b7280;">Unsubscribe</a>
  </p>
</div>
  """
}
```

### Example 3: Unread Messages Digest

```python
{
  "trigger": "unread_messages",
  "channel": "email",
  "subject": "💬 You have {stats.unreadMessages} unread messages",
  "body": """
<div style="font-family: Arial; max-width: 600px;">
  <h2>Don't miss out, {recipient.firstName}! 💬</h2>
  
  {% if stats.unreadMessages == 1 %}
    <p>You have <strong>1 unread message</strong> waiting for you.</p>
  {% else %}
    <p>You have <strong>{stats.unreadMessages} unread messages</strong> waiting for you.</p>
  {% endif %}
  
  {% if stats.unreadMessages >= 5 %}
    <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; color: #92400e;">
        ⚠️ <strong>Popular!</strong> Multiple people are trying to reach you!
      </p>
    </div>
  {% endif %}
  
  <p style="margin: 20px 0; text-align: center;">
    <a href="{app.chatUrl}" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      Read Your Messages
    </a>
  </p>
  
  <p style="color: #6b7280; font-size: 0.9em;">
    Tip: Quick responses lead to better conversations!
  </p>
</div>
  """
}
```

---

## 🛠️ Managing Templates

### View All Templates

**API:**
```bash
curl http://localhost:8000/api/notifications/templates \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**MongoDB:**
```javascript
db.notification_templates.find().pretty()
```

### Update a Template

**API:**
```bash
curl -X PUT http://localhost:8000/api/notifications/templates/TEMPLATE_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "New subject line",
    "body": "New HTML body..."
  }'
```

**MongoDB:**
```javascript
db.notification_templates.updateOne(
  { trigger: "new_match", channel: "email" },
  { $set: { 
    subject: "New subject",
    body: "New HTML...",
    updated_at: new Date()
  }}
)
```

### Disable a Template

```javascript
db.notification_templates.updateOne(
  { trigger: "new_match", channel: "email" },
  { $set: { active: false }}
)
```

### Create Custom Template

```javascript
db.notification_templates.insertOne({
  trigger: "custom_event",
  channel: "email",
  category: "custom",
  subject: "Custom Event: {event.message}",
  body: "<h1>Custom notification</h1><p>{event.message}</p>",
  active: true,
  version: 1,
  created_at: new Date(),
  updated_at: new Date()
})
```

---

## 🎯 Best Practices

### 1. Subject Lines
- ✅ Keep under 50 characters
- ✅ Use emojis sparingly (1-2 max)
- ✅ Personalize with {recipient.firstName}
- ✅ Be clear and actionable
- ❌ Don't use ALL CAPS
- ❌ Don't overuse exclamation marks!!!

**Examples:**
```
✅ "🎉 New match: {match.firstName}"
✅ "You have {stats.unreadMessages} unread messages"
❌ "AMAZING NEWS!!! YOU WON'T BELIEVE THIS!!!"
❌ "🎉🎊🎈🎁 NEW MATCH 🎁🎈🎊🎉"
```

### 2. Email Body
- ✅ Use inline CSS (Gmail strips <style> tags)
- ✅ Max width: 600px
- ✅ Mobile-friendly design
- ✅ Clear call-to-action button
- ✅ Include unsubscribe link
- ❌ Don't use JavaScript
- ❌ Don't use external stylesheets
- ❌ Don't embed large images

### 3. Personalization
- ✅ Use recipient's first name
- ✅ Reference specific actions
- ✅ Include relevant stats
- ✅ Contextualize with conditionals
- ❌ Don't over-personalize (creepy)

### 4. Call-to-Action
- ✅ One primary CTA button
- ✅ Descriptive button text
- ✅ High contrast colors
- ✅ Adequate button size (min 44x44px)
- ❌ Don't use multiple competing CTAs
- ❌ Don't use vague text like "Click Here"

---

## 🧪 Testing Templates

### Method 1: Use Test Endpoint

```bash
curl -X POST http://localhost:8000/api/notifications/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_user",
    "trigger": "new_match",
    "channels": ["email"],
    "templateData": {
      "match": {
        "firstName": "John",
        "age": 28,
        "matchScore": 92,
        "location": "New York"
      }
    }
  }'
```

### Method 2: Use NotificationTester Component

Navigate to: `http://localhost:3000/notification-tester`

1. Select trigger type
2. Fill in test data
3. Choose email channel
4. Click "Send Test Notification"
5. Check your email inbox

---

## 📊 Template Variables Reference

### Complete List

| Variable | Type | Example | Description |
|----------|------|---------|-------------|
| `{recipient.firstName}` | string | "Sarah" | Recipient's first name |
| `{recipient.username}` | string | "sarah_j" | Recipient's username |
| `{recipient.age}` | number | 27 | Recipient's age |
| `{recipient.location}` | string | "Boston" | Recipient's city |
| `{match.firstName}` | string | "Mike" | Match's first name |
| `{match.age}` | number | 30 | Match's age |
| `{match.matchScore}` | number | 85 | Compatibility (0-100) |
| `{match.location}` | string | "Boston" | Match's city |
| `{match.occupation}` | string | "Engineer" | Match's job |
| `{match.education}` | string | "MBA" | Match's degree |
| `{event.type}` | string | "new_match" | Event type |
| `{event.message}` | string | "..." | Event message |
| `{app.profileUrl}` | string | "https://..." | Profile link |
| `{app.chatUrl}` | string | "https://..." | Chat link |
| `{app.matchUrl}` | string | "https://..." | Matches link |
| `{app.settingsUrl}` | string | "https://..." | Settings link |
| `{app.unsubscribeUrl}` | string | "https://..." | Unsubscribe link |
| `{stats.mutualMatches}` | number | 12 | Mutual match count |
| `{stats.unreadMessages}` | number | 5 | Unread msg count |
| `{stats.profileViews}` | number | 23 | Profile views (24h) |
| `{stats.newMatches}` | number | 3 | New matches (7d) |

---

## 🚨 Troubleshooting

### Template Not Rendering

**Problem:** Variables showing as `{variable}` in email

**Solution:**
- Check variable spelling
- Ensure data is passed in `templateData`
- Verify template syntax (no typos)

### Conditional Not Working

**Problem:** `{% if %}` block not executing

**Solution:**
- Check condition syntax
- Ensure variables exist in data
- Test with simple condition first
- Check for extra spaces

### Email Not Sending

**Problem:** Template saved but email not sent

**Solution:**
1. Check template is active: `"active": true`
2. Verify user has email notifications enabled
3. Check email job is running
4. Review backend logs for errors

### Styling Issues

**Problem:** Email looks broken in Gmail/Outlook

**Solution:**
- Use inline CSS only
- Avoid `<style>` tags
- Test with table-based layouts
- Use web-safe fonts
- Don't use `position: absolute/fixed`

---

## 📚 Additional Resources

### Template Engine Documentation
- [Jinja2 Template Syntax](https://jinja.palletsprojects.com/)
- [Email HTML Best Practices](https://templates.mailchimp.com/resources/email-client-css-support/)

### Tools
- [HTML Email Tester](https://www.html email.io/)
- [Can I Email](https://www.caniemail.com/) - CSS support checker
- [Litmus](https://litmus.com/) - Email preview across clients

### Examples
- See `/fastapi_backend/job_templates/email_notifier.py` for sending logic
- See `/frontend/src/components/NotificationTester.js` for testing UI

---

## ✅ Next Steps

1. **Run setup script:** `python3 setup_email_templates.py`
2. **Configure SMTP:** Set environment variables in `.env`
3. **Test templates:** Use NotificationTester or API
4. **Customize:** Edit templates in MongoDB or via API
5. **Monitor:** Check `notification_log` collection for sent emails

---

**Need help?** Check the main documentation: `COMMUNICATION_MODULE.md`
