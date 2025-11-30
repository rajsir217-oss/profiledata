#!/bin/bash
# Check invitation statuses in MongoDB

echo "================================================================================"
echo "🔍 INVITATION STATUS CHECKER"
echo "================================================================================"

# Total invitations
echo ""
echo "📊 Total Invitations:"
mongosh matrimonialDB --quiet --eval "db.invitations.countDocuments({})"

# Email Status Breakdown
echo ""
echo "📧 Email Status Breakdown:"
mongosh matrimonialDB --quiet --eval "
db.invitations.aggregate([
  {\$group: {_id: '\$emailStatus', count: {\$sum: 1}}},
  {\$sort: {count: -1}}
]).forEach(doc => {
  var status = doc._id ? doc._id : 'null';
  print('   ' + status + ': ' + doc.count);
});
"

# SMS Status Breakdown
echo ""
echo "📱 SMS Status Breakdown:"
mongosh matrimonialDB --quiet --eval "
db.invitations.aggregate([
  {\$group: {_id: '\$smsStatus', count: {\$sum: 1}}},
  {\$sort: {count: -1}}
]).forEach(doc => {
  var status = doc._id ? doc._id : 'null';
  print('   ' + status + ': ' + doc.count);
});
"

# Invitations with registeredAt
echo ""
echo "✅ Invitations with registeredAt field set:"
mongosh matrimonialDB --quiet --eval "
db.invitations.countDocuments({registeredAt: {\$ne: null}})
"

# Invitations with registeredUsername
echo ""
echo "✅ Invitations with registeredUsername field set:"
mongosh matrimonialDB --quiet --eval "
db.invitations.countDocuments({registeredUsername: {\$ne: null}})
"

# Show sample accepted invitations
echo ""
echo "================================================================================"
echo "📋 SAMPLE ACCEPTED INVITATIONS:"
echo "================================================================================"

mongosh matrimonialDB --quiet --eval "
var count = 0;
db.invitations.find({registeredAt: {\$ne: null}}).limit(5).forEach(inv => {
  count++;
  print('');
  print('🎯 Invitation #' + count + ':');
  print('   Name: ' + (inv.name || 'N/A'));
  print('   Email: ' + (inv.email || 'N/A'));
  print('   Email Status: ' + (inv.emailStatus || 'N/A'));
  print('   SMS Status: ' + (inv.smsStatus || 'N/A'));
  print('   Registered Username: ' + (inv.registeredUsername || 'N/A'));
  print('   Registered At: ' + (inv.registeredAt || 'N/A'));
  print('   Invited By: ' + (inv.invitedBy || 'N/A'));
  print('   Archived: ' + (inv.archived || false));
});

if (count === 0) {
  print('');
  print('⚠️  No accepted invitations found in database!');
  print('   This means either:');
  print('   1. No one has registered via invitation link, OR');
  print('   2. The registration process is not calling /api/invitations/accept/{token}');
}
"

# Check for inconsistencies
echo ""
echo "================================================================================"
echo "🔍 CHECKING FOR INCONSISTENCIES:"
echo "================================================================================"

echo ""
echo "⚠️  Invitations with emailStatus='accepted' but registeredAt is null:"
mongosh matrimonialDB --quiet --eval "
var count = db.invitations.countDocuments({emailStatus: 'accepted', registeredAt: null});
print(count + ' found');

if (count > 0) {
  print('');
  print('Showing samples:');
  db.invitations.find({emailStatus: 'accepted', registeredAt: null}).limit(3).forEach(inv => {
    print('');
    print('   - ' + inv.name + ' (' + inv.email + ')');
    print('     Email Status: ' + inv.emailStatus);
    print('     Registered At: ' + inv.registeredAt);
  });
}
"

echo ""
echo "⚠️  Invitations with registeredAt but emailStatus != 'accepted':"
mongosh matrimonialDB --quiet --eval "
var count = db.invitations.countDocuments({registeredAt: {\$ne: null}, emailStatus: {\$ne: 'accepted'}});
print(count + ' found');

if (count > 0) {
  print('');
  print('Showing samples:');
  db.invitations.find({registeredAt: {\$ne: null}, emailStatus: {\$ne: 'accepted'}}).limit(3).forEach(inv => {
    print('');
    print('   - ' + inv.name + ' (' + inv.email + ')');
    print('     Email Status: ' + inv.emailStatus);
    print('     SMS Status: ' + inv.smsStatus);
    print('     Registered At: ' + inv.registeredAt);
    print('     Registered Username: ' + inv.registeredUsername);
  });
}
"

echo ""
echo "================================================================================"
echo "✅ DIAGNOSIS COMPLETE"
echo "================================================================================"
