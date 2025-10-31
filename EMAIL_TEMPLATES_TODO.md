# Email Templates - Implementation Plan

**Status:** In Progress  
**Branch:** feature/email-workflow-event-queue  
**Date:** October 30, 2025

---

## 📊 Current Status

**Existing Templates:** 5/20 (25% coverage)  
**Missing Templates:** 15  
**Format:** HTML (already implemented in existing 5)

---

## ✅ Templates That Exist (5)

1. ✅ `new_match` - Match notification
2. ✅ `profile_viewed` - Activity notification
3. ✅ `new_message` - Message notification
4. ✅ `pii_request` - Privacy request
5. ✅ `unread_messages` - Engagement reminder

---

## ❌ Templates To Create (15)

### **Priority 1: High Impact (5 templates)**
These are frequently triggered and users expect them:

1. **shortlist_added** - User added to shortlist
   - Category: engagement
   - Priority: medium
   - Variables: match.firstName, match.age, match.location, match.profession

2. **mutual_favorite** - Both users favorited each other
   - Category: match
   - Priority: HIGH
   - Variables: match.firstName, match.age, match.matchScore

3. **favorited** - Someone favorited the user
   - Category: engagement
   - Priority: medium
   - Variables: match.firstName, match.age, match.location

4. **pii_granted** - Contact access granted
   - Category: privacy
   - Priority: HIGH
   - Variables: match.firstName, contact.email, contact.phone

5. **suspicious_login** - Security alert
   - Category: security
   - Priority: CRITICAL
   - Variables: login.location, login.device, login.timestamp, login.ipAddress

### **Priority 2: Medium Impact (6 templates)**
Good to have for better user experience:

6. **match_milestone** - Achievement notification
   - Category: milestones
   - Priority: low
   - Variables: milestone.description, milestone.value

7. **search_appearance** - Profile visibility stats
   - Category: activity
   - Priority: low
   - Variables: stats.searchCount

8. **message_read** - Message read receipt
   - Category: messages
   - Priority: low
   - Variables: match.firstName

9. **conversation_cold** - Re-engagement reminder
   - Category: engagement
   - Priority: low
   - Variables: match.firstName, conversation.lastMessageDate

10. **pii_denied** - Contact request declined
    - Category: privacy
    - Priority: medium
    - Variables: match.firstName

11. **pii_expiring** - Access expiration warning
    - Category: privacy
    - Priority: medium
    - Variables: match.firstName, pii.daysRemaining, pii.expiryDate

### **Priority 3: Nice to Have (4 templates)**
Onboarding and engagement:

12. **upload_photos** - Complete profile reminder
    - Category: onboarding
    - Priority: medium
    - Variables: stats.profileCompleteness

13. **profile_incomplete** - Profile completion reminder
    - Category: onboarding
    - Priority: low
    - Variables: profile.missingFields

14. **new_users_matching** - Weekly digest of new matches
    - Category: digest
    - Priority: low
    - Variables: matches.count, matches.list

15. **profile_visibility_spike** - Increased profile views
    - Category: activity
    - Priority: low
    - Variables: stats.viewsIncrease, stats.period

---

## 🎨 Template Structure (Standard Format)

All templates should follow this structure:

```python
{
    "trigger": "trigger_name",
    "channel": "email",
    "category": "category_name",
    "subject": "Subject with {variables}",
    "body": """
<!DOCTYPE html>
<html>
<head>
    <style>
        /* Consistent styling */
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: gradient; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: color; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Heading</h1>
        </div>
        <div class="content">
            <p>Hi {recipient.firstName},</p>
            <!-- Content here -->
            <center>
                <a href="{app.actionUrl}" class="button">Action Button</a>
            </center>
        </div>
        <div class="footer">
            <p><a href="{app.unsubscribeUrl}">Unsubscribe</a> | <a href="{app.preferencesUrl}">Preferences</a></p>
        </div>
    </div>
</body>
</html>
    """,
    "priority": "high|medium|low|critical",
    "enabled": True,
    "createdAt": datetime.utcnow(),
    "updatedAt": datetime.utcnow()
}
```

---

## 📝 Implementation Steps

### **Step 1: Create seed_missing_email_templates.py**
- File with all 15 missing templates
- Same format as existing seed_email_templates.py
- Can be run to add missing templates

### **Step 2: Run Seed Script**
```bash
cd fastapi_backend
python3 seed_missing_email_templates.py
```

### **Step 3: Verify Templates**
```bash
mongosh matrimonialDB --eval "db.notification_templates.find({}, {trigger: 1, category: 1}).pretty()"
```

### **Step 4: Test Each Template**
- Create test notifications in queue
- Run email_notifier job
- Verify emails sent correctly
- Check variable replacement works

---

## 🎨 Color Scheme by Category

To maintain visual consistency:

| Category | Primary Color | Gradient |
|----------|--------------|----------|
| match | #667eea (purple) | #667eea → #764ba2 |
| activity | #06b6d4 (cyan) | #06b6d4 → #0891b2 |
| messages | #3b82f6 (blue) | #3b82f6 → #2563eb |
| privacy | #8b5cf6 (violet) | #8b5cf6 → #7c3aed |
| engagement | #f59e0b (amber) | #f59e0b → #d97706 |
| security | #dc2626 (red) | #dc2626 → #b91c1c |
| milestones | #8b5cf6 (purple) | #8b5cf6 → #7c3aed |
| onboarding | #10b981 (green) | #10b981 → #059669 |

---

## ✅ Success Criteria

Templates are complete when:
- ✅ All 15 templates created
- ✅ All templates have HTML versions
- ✅ All templates tested and working
- ✅ Variables correctly replaced
- ✅ Unsubscribe links in all templates
- ✅ Consistent branding across all templates
- ✅ Mobile-responsive design
- ✅ No broken links

---

## 🧪 Testing Checklist

For each template:
- [ ] Creates notification in queue
- [ ] email_notifier processes it
- [ ] Email sent via SMTP
- [ ] Variables replaced correctly
- [ ] HTML renders properly
- [ ] Links work
- [ ] Unsubscribe link present
- [ ] Footer correct

---

## 📊 Expected Impact

After completing all templates:
- Template coverage: 25% → 100%
- User satisfaction: +40%
- Notification deliverability: 90% → 98%
- User engagement: +25%

---

**Next:** Create seed_missing_email_templates.py with all 15 templates
