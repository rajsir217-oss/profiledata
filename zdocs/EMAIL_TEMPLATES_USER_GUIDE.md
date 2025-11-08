# Email Templates - User Guide

**For:** App Administrators & Content Managers  
**Last Updated:** November 7, 2025  
**Version:** 1.0

---

## 📧 What Are Email Templates?

Email templates are pre-designed email formats that automatically send to users when specific events happen in your app. Think of them as smart email blueprints that fill in user-specific information automatically.

**Example:** When someone favorites your profile, they receive a beautifully formatted email saying: *"Sarah added you to their favorites!"* with Sarah's actual name filled in automatically.

---

## 🎯 Available Email Templates (20 Total)

### **High Priority - Critical Notifications**

| Template Name | When It Sends | Example |
|---------------|---------------|---------|
| **Mutual Favorite** 💖 | Both users favorite each other | "It's a match! You and Sarah both favorited each other" |
| **PII Granted** ✅ | Someone shares contact details | "Sarah shared their contact details with you" |
| **Suspicious Login** 🔒 | Unusual login detected | "Security Alert: New login from San Francisco" |
| **New Message** 💬 | Someone sends you a message | "You have a new message from Mike" |
| **PII Request** 🔐 | Someone requests contact access | "John wants to connect with you" |

### **Medium Priority - Engagement**

| Template Name | When It Sends | Example |
|---------------|---------------|---------|
| **Favorited** 💝 | Someone favorites you | "Sarah added you to their favorites!" |
| **Shortlist Added** ✨ | Added to someone's shortlist | "Mike added you to their shortlist" |
| **Profile Viewed** 👀 | Someone views your profile | "Sarah viewed your profile" |
| **Unread Messages** ⏰ | You have unread messages | "You have 3 unread messages" |
| **PII Denied** ❌ | Contact request declined | "Your contact request was declined" |
| **PII Expiring** ⏳ | Contact access expires soon | "Access expires in 3 days" |

### **Low Priority - Informational**

| Template Name | When It Sends | Example |
|---------------|---------------|---------|
| **Match Milestone** 🎊 | Achievement unlocked | "Congratulations! 10 Profile Views" |
| **Search Appearance** 📊 | Profile visibility stats | "You appeared in 50 searches this week" |
| **Message Read** ✓ | Message was read | "Sarah read your message" |
| **Conversation Cold** 🔄 | Re-engagement reminder | "Continue your chat with Mike" |
| **Upload Photos** 📸 | Complete profile reminder | "Add photos to get more matches" |
| **Profile Incomplete** 📝 | Profile completion reminder | "Complete your profile for better matches" |
| **New Users Matching** 📬 | Weekly digest | "5 new users match your criteria" |
| **Profile Visibility Spike** 📈 | Increased views | "Your profile views increased 50%" |

---

## 🖥️ How to Preview Email Templates

### **Step 1: Access Email Templates**
1. Login as **admin**
2. Open the **sidebar menu** (☰)
3. Click **"📧 Email Templates"**

### **Step 2: Browse Templates**
- See all 20 templates in the list
- Filter by category (match, engagement, security, etc.)
- Each template shows:
  - ✅ **Status** (Enabled/Disabled)
  - 🎯 **Priority** (Critical/High/Medium/Low)
  - 📂 **Category** (What type of notification)

### **Step 3: Preview a Template**
1. **Click any template** in the list
2. Right side shows:
   - Email subject line
   - Full HTML preview with sample data
   - Template details
3. Scroll through the preview to see how it looks

---

## 📊 Understanding the Event Queue

### **What Is the Event Queue?**

The Event Queue shows all pending notifications waiting to be sent. It's like a "to-do list" for the email system.

**Access:** Admin Menu → Notification Management → Event Queue Manager

### **Queue Status:**

| Status | Meaning | Icon |
|--------|---------|------|
| **Queued** | Waiting to be sent | ⏳ |
| **Processing** | Currently being sent | ⚙️ |
| **Sent** | Successfully delivered | ✅ |
| **Failed** | Delivery failed | ❌ |

### **Reading the Queue:**

```
┌──────────────┬────────────┬──────────┬─────────┐
│ Recipient    │ Event      │ Channel  │ Status  │
├──────────────┼────────────┼──────────┼─────────┤
│ john_doe     │ favorited  │ 📧 EMAIL │ Queued  │
│ sarah_smith  │ new_match  │ 📲 PUSH  │ Sent    │
└──────────────┴────────────┴──────────┴─────────┘
```

- **Recipient:** Who receives the notification
- **Event:** Which template is used (favorited, new_match, etc.)
- **Channel:** How it's delivered (EMAIL, PUSH, SMS)
- **Status:** Current state

---

## ⚙️ Email Delivery Settings

### **When Emails Are Sent**

Emails are sent automatically by the **Email Notifier** job:
- Runs every **5 minutes** (configurable)
- Processes up to **100 emails** per run
- Respects **quiet hours** (10 PM - 8 AM by default)
- Prioritizes **critical** and **high** priority emails

### **Quiet Hours**

Users won't receive emails during quiet hours (configurable per user):
- Default: 10 PM - 8 AM in user's timezone
- Users can customize in **Settings → Notifications**
- Emergency emails (security alerts) ignore quiet hours

### **Email Priority Levels**

| Priority | When Sent | Examples |
|----------|-----------|----------|
| **Critical** 🔴 | Immediate, ignores quiet hours | Security alerts, suspicious login |
| **High** 🟠 | Within 5 minutes | Mutual match, contact granted |
| **Medium** 🟡 | Within 30 minutes | Favorited, shortlisted |
| **Low** ⚪ | Batched, sent during active hours | Weekly digests, stats |

---

## 🎨 Email Design Features

All email templates include:
- ✅ **Mobile-responsive** design (looks great on phones)
- ✅ **Unsubscribe link** (required by law)
- ✅ **Brand colors** and logo
- ✅ **Action buttons** (View Profile, Reply, etc.)
- ✅ **Category-specific colors**:
  - 💖 Match notifications: Pink gradient
  - 🔒 Security alerts: Red gradient
  - ✨ Engagement: Amber/orange gradient
  - 📧 Messages: Blue gradient

---

## 🔍 Troubleshooting

### **"Why didn't I receive an email?"**

**Check these things:**

1. **Spam Folder**
   - Our emails might be in spam/junk
   - Add `noreply@yourapp.com` to contacts

2. **Email Address**
   - Verify email in profile settings
   - Must be a valid, active email

3. **Notification Settings**
   - Check Settings → Notifications
   - Ensure email notifications are enabled

4. **Quiet Hours**
   - Email might be delayed due to quiet hours
   - Check event queue for "queued" status

5. **Template Status**
   - Admin can verify template is enabled
   - Go to Email Templates → check ✓ Enabled

### **"Email looks broken on mobile"**

All our templates are tested for mobile, but if you see issues:
1. Try a different email app
2. Report to support with screenshots
3. Include device and email app name

### **"How do I unsubscribe?"**

Every email has an **Unsubscribe** link at the bottom:
1. Click "Unsubscribe" in any email
2. Or go to Settings → Notifications → Turn off specific types
3. Note: You'll still receive critical security alerts

---

## 📈 Best Practices

### **For Users:**

1. **Keep Email Updated**
   - Use a valid, frequently checked email
   - Update if you change email addresses

2. **Whitelist Our Emails**
   - Add to contacts: `noreply@yourapp.com`
   - Prevents spam filtering

3. **Customize Notifications**
   - Settings → Notifications
   - Choose what you want to receive
   - Set quiet hours for your schedule

### **For Admins:**

1. **Monitor the Queue**
   - Check Event Queue Manager daily
   - Look for failed deliveries
   - Review logs for patterns

2. **Test Notifications**
   - Use Test Mode to send to yourself
   - Verify templates look correct
   - Check on mobile devices

3. **Review Metrics**
   - Email Analytics dashboard
   - Open rates, click rates
   - Adjust templates based on engagement

---

## 🆘 Getting Help

**For Users:**
- **In-App:** Settings → Help & Support
- **Email:** support@yourapp.com

**For Admins:**
- **Tech Docs:** See `EMAIL_TEMPLATES_TECHNICAL.md`
- **Support:** admin@yourapp.com
- **Emergency:** Check system logs in admin panel

---

## 📝 Glossary

| Term | Definition |
|------|------------|
| **Template** | Pre-designed email format with placeholders |
| **Trigger** | Event that causes an email to send (e.g., "favorited") |
| **Queue** | List of pending notifications waiting to send |
| **Channel** | Delivery method (EMAIL, PUSH, SMS) |
| **Priority** | How urgently the email should be sent |
| **Quiet Hours** | Time period when non-urgent emails are delayed |
| **Variable** | Placeholder in template (e.g., {recipient.firstName}) |
| **SMTP** | Email server protocol for sending emails |

---

**Last Updated:** November 7, 2025  
**Questions?** Contact your system administrator
