#!/bin/bash
# Test Status Change Notification

echo "🧪 Testing Status Change Notification System"
echo ""

# Get admin token (you'll need to replace with actual token)
echo "⚠️  You need an admin auth token to run this test"
echo "   Get token by logging in as admin in the browser"
echo ""

# Uncomment and add your admin token here:
# ADMIN_TOKEN="your_admin_jwt_token_here"

# If token is set, run the test
if [ -n "$ADMIN_TOKEN" ]; then
    echo "📝 Changing yogeshmukherjee010 status to 'paused'..."
    
    curl -X PATCH http://localhost:8000/api/admin/users/yogeshmukherjee010/status \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"status": "paused", "reason": "Testing status change notification system"}' \
      | jq .
    
    echo ""
    echo "✅ Status change request sent!"
    echo ""
    echo "Now check:"
    echo "1. Event Queue Manager - should show 1 Queued"
    echo "2. Wait 1 minute for email job to process"
    echo "3. Refresh - should show 1 Sent"
    echo ""
    echo "To check database directly:"
    echo "  mongosh matrimonialDB --eval \"db.notification_queue.find({type: 'status_paused'}).pretty()\""
else
    echo "❌ ADMIN_TOKEN not set"
    echo "   Please set ADMIN_TOKEN in this script or use the admin UI"
fi
