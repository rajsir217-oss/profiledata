#!/usr/bin/env mongosh
/**
 * Fix Working Status Data Quality Issue
 * Convert "Yes"/"No" to proper employment status values
 */

use matrimonialDB;

print("🔍 Current workingStatus distribution:");
db.users.aggregate([
  { $group: { _id: "$workingStatus", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]).forEach(doc => {
  print(`  ${doc._id || 'null'}: ${doc.count} users`);
});

print("\n📊 Converting invalid values...");

// Convert "Yes" to "Employed" (most likely interpretation)
const yesResult = db.users.updateMany(
  { workingStatus: "Yes" },
  { $set: { workingStatus: "Employed" } }
);
print(`✅ Converted "Yes" → "Employed": ${yesResult.modifiedCount} users`);

// Convert "No" to "Unemployed"
const noResult = db.users.updateMany(
  { workingStatus: "No" },
  { $set: { workingStatus: "Unemployed" } }
);
print(`✅ Converted "No" → "Unemployed": ${noResult.modifiedCount} users`);

print("\n✨ Final distribution:");
db.users.aggregate([
  { $group: { _id: "$workingStatus", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]).forEach(doc => {
  print(`  ${doc._id || 'null'}: ${doc.count} users`);
});

print("\n🎯 Migration complete!");
