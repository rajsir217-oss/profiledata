#!/bin/bash
# Retroactively Match Existing Users to Invitations
# Decrypts user emails and updates invitation status for users who already registered

echo "================================================================================"
echo "🔄 RETROACTIVE MATCHING: Users → Invitations"
echo "================================================================================"
echo ""
echo "This script will:"
echo "  1. Get all registered users from database"
echo "  2. Decrypt their contactEmail (encrypted PII)"
echo "  3. Find matching invitations by email"
echo "  4. Update invitation status to 'ACCEPTED'"
echo "  5. Link invitation to registered username"
echo ""
echo "================================================================================"
echo ""

# Check if running in dry-run or live mode
if [ "$1" == "--live" ]; then
    echo "⚠️  LIVE MODE - Will update database"
    echo ""
    python3 retroactive_match_users_to_invitations.py --live
else
    echo "🔍 DRY RUN MODE - No changes will be made"
    echo "   (Use --live flag to apply changes)"
    echo ""
    python3 retroactive_match_users_to_invitations.py
fi

echo ""
echo "================================================================================"
echo "✅ RETROACTIVE MATCHING COMPLETE"
echo "================================================================================"
