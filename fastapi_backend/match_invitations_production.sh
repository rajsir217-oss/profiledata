#!/bin/bash
# Match Invitations to Registered Users - PRODUCTION VERSION
# Works with remote MongoDB database

echo "================================================================================"
echo "🔍 MATCH INVITATIONS TO USERS - PRODUCTION"
echo "================================================================================"
echo ""

# Get MongoDB URL
read -p "Enter MongoDB URL: " MONGO_URL

if [ -z "$MONGO_URL" ]; then
  echo "❌ MongoDB URL is required!"
  exit 1
fi

# Extract database name
DB_NAME=$(echo "$MONGO_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
if [ -z "$DB_NAME" ]; then
  DB_NAME="matrimonialDB"
fi

echo ""
echo "📊 Database: $DB_NAME"
echo ""

# Check if live mode
MODE="DRY RUN"
if [ "$1" == "--live" ]; then
  MODE="LIVE"
  echo "⚠️  WARNING: LIVE MODE - Will update database"
  echo ""
  read -p "Type 'YES' to confirm: " CONFIRM
  
  if [ "$CONFIRM" != "YES" ]; then
    echo "❌ Cancelled"
    exit 1
  fi
  echo ""
else
  echo "🔍 DRY RUN MODE - No changes will be made"
  echo ""
fi

# Run matching script using mongosh
echo "🔄 Matching invitations to users..."
echo ""

mongosh "$MONGO_URL" --quiet <<EOF

print("=" + "=".repeat(79));
print("🔍 MATCHING INVITATIONS TO USERS");
print("=" + "=".repeat(79));
print("");

// Get invitations that are not accepted
const invitations = db.invitations.find({
  \$or: [
    {emailStatus: {\$ne: "ACCEPTED"}},
    {registeredUsername: {\$exists: false}},
    {registeredUsername: null}
  ],
  archived: false
}).toArray();

print("📊 Found " + invitations.length + " invitations to check");
print("");

let matched = 0;
let notMatched = 0;
let updated = 0;

// Check each invitation
invitations.forEach((inv, idx) => {
  const email = inv.email;
  const name = inv.name;
  
  if (!email) {
    print("  ⚠️  [" + (idx+1) + "/" + invitations.length + "] Invitation has no email");
    return;
  }
  
  // Look for user with this email
  const user = db.users.findOne({ contactEmail: email });
  
  if (user) {
    matched++;
    const username = user.username;
    const registeredAt = user.created_at || user.createdAt;
    
    print("  ✅ [" + (idx+1) + "/" + invitations.length + "] MATCH: " + name + " (" + email + ") → " + username);
    
    if ("$MODE" === "LIVE") {
      // Update invitation
      const result = db.invitations.updateOne(
        { _id: inv._id },
        {
          \$set: {
            emailStatus: "ACCEPTED",
            smsStatus: "ACCEPTED",
            registeredUsername: username,
            registeredAt: registeredAt,
            updatedAt: new Date()
          }
        }
      );
      
      if (result.modifiedCount > 0) {
        updated++;
        print("      ✅ Updated!");
      }
    }
  } else {
    notMatched++;
    if ((idx+1) % 10 === 0 || (idx+1) <= 5) {
      print("  ⏭️  [" + (idx+1) + "/" + invitations.length + "] No user: " + name + " (" + email + ")");
    }
  }
});

print("");
print("=" + "=".repeat(79));
print("📊 SUMMARY");
print("=" + "=".repeat(79));
print("Total Checked: " + invitations.length);
print("✅ Matched: " + matched);
print("⏭️  Not Matched: " + notMatched);

if ("$MODE" === "LIVE") {
  print("✅ Updated: " + updated);
  
  // Show final counts
  const acceptedCount = db.invitations.countDocuments({ emailStatus: "ACCEPTED" });
  const withUsernameCount = db.invitations.countDocuments({ 
    registeredUsername: { \$exists: true, \$ne: null } 
  });
  
  print("");
  print("🔍 VERIFICATION:");
  print("   Total Accepted: " + acceptedCount);
  print("   With Username: " + withUsernameCount);
} else {
  print("");
  print("⚠️  DRY RUN - No changes made");
  print("   Run with --live to apply changes");
}

print("=" + "=".repeat(79));

EOF

echo ""
echo "================================================================================"
echo "✅ MATCHING COMPLETE"
echo "================================================================================"
