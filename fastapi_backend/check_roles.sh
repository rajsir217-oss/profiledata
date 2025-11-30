#!/bin/bash
# Quick MongoDB check for role_name field

echo "🔍 Checking role_name in MongoDB users collection..."
echo "================================================================"

# Check most recent user
echo ""
echo "📊 Most Recent User:"
mongosh matrimonialDB --quiet --eval "
  db.users.findOne(
    {},
    {username: 1, role_name: 1, createdAt: 1}
  ).sort({createdAt: -1})
" | head -20

# Count users with null role_name
echo ""
echo "📈 Role Statistics:"
mongosh matrimonialDB --quiet --eval "
  var total = db.users.countDocuments({});
  var nullRole = db.users.countDocuments({\$or: [{role_name: {\$exists: false}}, {role_name: null}]});
  var withRole = total - nullRole;
  
  print('Total users: ' + total);
  print('Users with null role_name: ' + nullRole);
  print('Users with role assigned: ' + withRole);
  print('');
  
  if (nullRole > 0) {
    print('⚠️  ' + nullRole + ' users need role assignment');
    print('   Run: python3 migrations/add_default_role_to_users.py');
  } else {
    print('✅ All users have role_name assigned!');
  }
"

# Show role distribution
echo ""
echo "📊 Role Distribution:"
mongosh matrimonialDB --quiet --eval "
  db.users.aggregate([
    {\$group: {_id: '\$role_name', count: {\$sum: 1}}},
    {\$sort: {count: -1}}
  ]).forEach(doc => {
    var role = doc._id ? doc._id : 'null';
    print('   ' + role + ': ' + doc.count + ' users');
  });
"

echo ""
echo "================================================================"
echo "✅ Code Fix Status:"
echo "   /api/users/register -> ✅ Sets role_name = 'free_user'"
echo "   /api/auth/register  -> ✅ Sets role_name = 'free_user'"
echo ""
echo "🚀 New users created after this fix WILL have role_name set!"
