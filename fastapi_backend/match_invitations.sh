#!/bin/bash
# Match Invitations to Registered Users
# This script finds registered users and updates their invitation status to "accepted"

echo "================================================================================"
echo "🔍 MATCH INVITATIONS TO REGISTERED USERS"
echo "================================================================================"
echo ""
echo "This script will:"
echo "  1. Find all invitations that are not marked as 'accepted'"
echo "  2. Check if a user exists with the invitation email"
echo "  3. Update invitation status to 'accepted' and link to the user"
echo ""
echo "================================================================================"
echo ""

# Check if running in dry-run or live mode
if [ "$1" == "--live" ]; then
    echo "⚠️  LIVE MODE - Will update database"
    echo ""
    python3 match_invitations_to_users.py --live
else
    echo "🔍 DRY RUN MODE - No changes will be made"
    echo "   (Use --live flag to apply changes)"
    echo ""
    python3 match_invitations_to_users.py
fi

echo ""
echo "================================================================================"
echo "✅ MATCHING COMPLETE"
echo "================================================================================"
