#!/bin/bash
# Fix Missing Invitation Tokens for Bulk-Imported Invitations

echo "================================================================================"
echo "🔧 FIXING MISSING INVITATION TOKENS"
echo "================================================================================"

# Check how many invitations are missing tokens
echo ""
echo "📊 Checking for invitations without tokens..."
MISSING_COUNT=$(mongosh matrimonialDB --quiet --eval "
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
mongosh matrimonialDB --quiet --eval "
db.invitations.find({
  \$or: [
    {invitationToken: {\$exists: false}},
    {invitationToken: null}
  ]
}).limit(5).forEach(inv => {
  print('  - ' + inv.name + ' (' + inv.email + ')');
});
"

# Confirm
echo ""
read -p "Proceed with fixing $MISSING_COUNT invitations? (yes/no): " response

if [[ ! "$response" =~ ^[Yy]([Ee][Ss])?$ ]]; then
  echo "❌ Operation cancelled"
  exit 1
fi

# Generate tokens and update invitations
echo ""
echo "🔧 Generating tokens and updating invitations..."

mongosh matrimonialDB --quiet --eval "
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
print('✅ Fixed ' + fixedCount + ' invitations');
if (errors > 0) {
  print('⚠️  Errors: ' + errors);
}
"

# Verify the fix
echo ""
echo "================================================================================"
echo "🔍 VERIFICATION"
echo "================================================================================"

REMAINING=$(mongosh matrimonialDB --quiet --eval "
db.invitations.countDocuments({
  \$or: [
    {invitationToken: {\$exists: false}},
    {invitationToken: null}
  ]
})
")

echo ""
if [ "$REMAINING" -eq 0 ]; then
  echo "✅ All invitations now have valid tokens!"
else
  echo "⚠️  Warning: $REMAINING invitations still missing tokens"
fi

# Show sample invitation link
echo ""
echo "📧 Sample invitation link:"
mongosh matrimonialDB --quiet --eval "
const sample = db.invitations.findOne({invitationToken: {\$ne: null}});
if (sample) {
  print('   https://y3xmatches.com/register2?invitation=' + sample.invitationToken + '&email=' + encodeURIComponent(sample.email));
}
"

echo ""
echo "================================================================================"
echo "✅ TOKEN FIX COMPLETE"
echo "================================================================================"
echo ""
echo "Next steps:"
echo "1. ✅ All existing invitations now have valid tokens"
echo "2. ⚠️  Users who already received 'invitation=None' links need to be re-invited"
echo "3. 📧 Resend invitations to users using the 'Resend' button in Invitation Manager"
echo "4. ✅ New invitation links will have proper tokens"
echo ""
