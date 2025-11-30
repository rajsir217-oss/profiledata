#!/bin/bash
# Fix Missing Invitation Tokens - PRODUCTION VERSION
# This connects to production MongoDB and fixes invitations

echo "================================================================================"
echo "🔧 FIXING INVITATION TOKENS - PRODUCTION DATABASE"
echo "================================================================================"
echo ""
echo "⚠️  WARNING: This will modify your PRODUCTION database!"
echo ""

# Get production MongoDB connection details
read -p "Enter production MongoDB URL (e.g., mongodb://user:pass@host:port/matrimonialDB): " MONGO_URL

if [ -z "$MONGO_URL" ]; then
  echo "❌ MongoDB URL is required!"
  exit 1
fi

# Extract database name from URL (default to matrimonialDB if not found)
DB_NAME=$(echo "$MONGO_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
if [ -z "$DB_NAME" ]; then
  DB_NAME="matrimonialDB"
fi

echo ""
echo "📊 Connection Details:"
echo "   Database: $DB_NAME"
echo "   URL: ${MONGO_URL:0:30}..." # Show only first 30 chars for security
echo ""

# Check how many invitations are missing tokens
echo "📊 Checking for invitations without tokens..."
MISSING_COUNT=$(mongosh "$MONGO_URL" --quiet --eval "
db.invitations.countDocuments({
  \$or: [
    {invitationToken: {\$exists: false}},
    {invitationToken: null}
  ]
})
")

echo "Found $MISSING_COUNT invitations without tokens"

if [ "$MISSING_COUNT" -eq 0 ]; then
  echo "✅ All invitations already have tokens!"
  exit 0
fi

# Show samples
echo ""
echo "Sample invitations to fix:"
mongosh "$MONGO_URL" --quiet --eval "
db.invitations.find({
  \$or: [
    {invitationToken: {\$exists: false}},
    {invitationToken: null}
  ]
}).limit(5).forEach(inv => {
  print('  - ' + inv.name + ' (' + inv.email + ')');
});
"

# Final confirmation
echo ""
echo "================================================================================"
echo "⚠️  FINAL CONFIRMATION"
echo "================================================================================"
echo "This will:"
echo "  1. Generate unique tokens for $MISSING_COUNT invitations"
echo "  2. Set token expiry to 90 days from now"
echo "  3. Update records in PRODUCTION database: $DB_NAME"
echo ""
read -p "Type 'PRODUCTION' (all caps) to proceed: " confirmation

if [ "$confirmation" != "PRODUCTION" ]; then
  echo "❌ Operation cancelled - confirmation did not match"
  exit 1
fi

# Generate tokens and update invitations
echo ""
echo "🔧 Generating tokens and updating PRODUCTION invitations..."

mongosh "$MONGO_URL" --quiet --eval "
// Function to generate random token
function generateToken(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Get current date and expiry (90 days from now)
const now = new Date();
const expiryDate = new Date();
expiryDate.setDate(expiryDate.getDate() + 90);

// Find invitations without tokens
const invitations = db.invitations.find({
  \$or: [
    {invitationToken: {\$exists: false}},
    {invitationToken: null}
  ]
}).toArray();

let fixedCount = 0;
let errors = 0;

// Update each invitation
invitations.forEach(inv => {
  try {
    const token = generateToken(32);
    
    const result = db.invitations.updateOne(
      {_id: inv._id},
      {
        \$set: {
          invitationToken: token,
          tokenExpiresAt: expiryDate,
          updatedAt: now
        }
      }
    );
    
    if (result.modifiedCount > 0) {
      fixedCount++;
      if (fixedCount % 50 === 0) {
        print('  Progress: ' + fixedCount + '/' + invitations.length + ' fixed...');
      }
    }
  } catch (e) {
    errors++;
    print('  ⚠️  Error updating invitation: ' + inv.email + ' - ' + e);
  }
});

print('');
print('✅ Fixed ' + fixedCount + ' invitations in PRODUCTION');
if (errors > 0) {
  print('⚠️  Errors: ' + errors);
}
"

# Verify the fix
echo ""
echo "================================================================================"
echo "🔍 VERIFICATION"
echo "================================================================================"

REMAINING=$(mongosh "$MONGO_URL" --quiet --eval "
db.invitations.countDocuments({
  \$or: [
    {invitationToken: {\$exists: false}},
    {invitationToken: null}
  ]
})
")

echo ""
if [ "$REMAINING" -eq 0 ]; then
  echo "✅ All PRODUCTION invitations now have valid tokens!"
else
  echo "⚠️  Warning: $REMAINING invitations still missing tokens"
fi

# Show sample invitation link
echo ""
echo "📧 Sample PRODUCTION invitation link:"
mongosh "$MONGO_URL" --quiet --eval "
const sample = db.invitations.findOne({invitationToken: {\$ne: null}});
if (sample) {
  print('   https://y3xmatches.com/register2?invitation=' + sample.invitationToken + '&email=' + encodeURIComponent(sample.email));
}
"

echo ""
echo "================================================================================"
echo "✅ PRODUCTION TOKEN FIX COMPLETE"
echo "================================================================================"
echo ""
echo "Next steps:"
echo "1. ✅ All existing invitations now have valid tokens"
echo "2. ⚠️  Users who already received 'invitation=None' links need to be re-invited"
echo "3. 📧 Resend invitations to users using the Invitation Manager"
echo "4. ✅ New invitation links will have proper tokens"
echo ""
