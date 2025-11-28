# Bulk Invitation System Implementation

## Status: Backend Complete ✅ | Frontend Pending 📝

### Completed (Backend):

1. **Migration Script** (`fastapi_backend/migrations/import_invitation_data.py`)
   - Reads Excel files from `data_migration/` folder
   - Imports 367 valid email invitations
   - Sets default subject: "You're Invited to Join USVedika for US Citizens & GC Holders"
   - Stores gender in `comments` field (Male/Female)
   - Status: `pending` (ready to send)

2. **Bulk Send API** (`POST /api/invitations/bulk-send`)
   - Accepts array of invitation IDs
   - Optional custom email subject
   - Returns send results (sent/failed counts)

3. **Email Service Updated**
   - Supports custom `emailSubject` parameter
   - Falls back to default if not provided

---

## Next Steps: Frontend Updates

### Required Changes to `InvitationManager.js`:

#### 1. Add State for Bulk Selection
```javascript
const [selectedInvitations, setSelectedInvitations] = useState([]);
const [bulkEmailSubject, setBulkEmailSubject] = useState("You're Invited to Join USVedika for US Citizens & GC Holders");
const [showBulkSendModal, setShowBulkSendModal] = useState(false);
```

#### 2. Add "Select All" Checkbox in Table Header
```javascript
<th>
  <input 
    type="checkbox"
    checked={selectedInvitations.length === displayedInvitations.length}
    onChange={handleSelectAll}
  />
</th>
```

#### 3. Add Individual Checkboxes in Table Rows
```javascript
<td>
  <input
    type="checkbox"
    checked={selectedInvitations.includes(invitation._id)}
    onChange={() => handleToggleSelection(invitation._id)}
  />
</td>
```

#### 4. Add New Table Columns
- **Comments** - Show gender (Male/Female)
- **Email Subject** - Show/edit subject line

#### 5. Add "Send Selected" Button
```javascript
<button 
  className="btn-primary"
  onClick={() => setShowBulkSendModal(true)}
  disabled={selected Invitations.length === 0}
>
  📧 Send Selected ({selectedInvitations.length})
</button>
```

#### 6. Add Bulk Send Modal
- Edit email subject before sending
- Preview selected count
- Confirm and send

#### 7. Implement Bulk Send Function
```javascript
const handleBulkSend = async () => {
  const response = await fetch(`${getBackendUrl()}/api/invitations/bulk-send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      invitationIds: selectedInvitations,
      channel: 'email',
      emailSubject: bulkEmailSubject
    })
  });
  
  const result = await response.json();
  // Show toast with results
  // Reload invitations
};
```

---

## How to Use:

### Step 1: Import Data
```bash
cd fastapi_backend
python migrations/import_invitation_data.py --dry-run  # Preview
python migrations/import_invitation_data.py            # Import 367 invitations
```

### Step 2: Go to Invitations Manager
- Navigate to https://l3v3lmatches.com/invitations
- See 367 pending invitations loaded

### Step 3: Send Invitations (After Frontend Updates)
- Select invitations using checkboxes
- Edit email subject if needed
- Click "Send Selected"
- Emails sent in bulk!

---

## Data Structure:

Each invitation has:
```javascript
{
  "_id": "...",
  "name": "Venkata",
  "email": "venkatasap610@gmail.com",
  "phone": "201 323 4865",
  "invitedBy": "admin",
  "channel": "email",
  "emailStatus": "pending",  // Will be 'sent' after sending
  "smsStatus": "not_sent",
  "customMessage": "",
  "emailSubject": "You're Invited to Join USVedika for US Citizens & GC Holders",
  "comments": "Female",  // Gender from Excel
  "createdAt": "2025-11-28T...",
  "updatedAt": "2025-11-28T...",
  "archived": false
}
```

---

## API Endpoints:

### List Invitations
```
GET /api/invitations
Response: { invitations: [...], total, pending, accepted }
```

### Bulk Send
```
POST /api/invitations/bulk-send
Body: {
  "invitationIds": ["id1", "id2", ...],
  "channel": "email",
  "emailSubject": "Custom subject (optional)"
}
Response: {
  "message": "Bulk send completed: X sent, Y failed",
  "results": { total, sent, failed, errors: [] }
}
```

---

## Files Modified:

### Backend:
1. `fastapi_backend/migrations/import_invitation_data.py` (NEW)
2. `fastapi_backend/routers/invitations.py` (bulk-send endpoint added)
3. `fastapi_backend/services/email_sender.py` (email_subject parameter added)

### Frontend (Pending):
1. `frontend/src/components/InvitationManager.js` (needs bulk selection UI)
2. `frontend/src/components/InvitationManager.css` (styling for checkboxes/buttons)

---

## Testing:

1. **Dry Run Import**:
   ```bash
   python migrations/import_invitation_data.py --dry-run
   ```
   Expected: Shows 367 valid emails

2. **Live Import**:
   ```bash
   python migrations/import_invitation_data.py
   ```
   Expected: 367 invitations created in MongoDB

3. **View in UI**:
   Go to `/invitations` - should show all pending invitations

4. **Bulk Send** (after frontend complete):
   - Select 10 invitations
   - Click "Send Selected"
   - Check email status changes to "sent"

---

## Current Branch:
```
feature/bulk-invitation-system
```

Ready to merge after frontend updates are complete!
