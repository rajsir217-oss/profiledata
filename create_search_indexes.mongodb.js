// MongoDB Search Performance Indexes
// Run this in MongoDB Atlas or mongosh connected to production

use('matrimonialDB');

// Show existing indexes
print("📌 Current indexes on users collection:");
db.users.getIndexes().forEach(idx => print("   - " + idx.name + ": " + JSON.stringify(idx.key)));

print("\n🔧 Creating search performance indexes...\n");

// 1. Compound index for most common search (status + gender + newest sorting)
try {
    db.users.createIndex(
        { "accountStatus": 1, "gender": 1, "createdAt": -1 },
        { name: "search_status_gender_created", background: true }
    );
    print("✅ Created: search_status_gender_created");
} catch (e) {
    print("⏭️  search_status_gender_created: " + e.message);
}

// 2. Compound index for status + newest sorting
try {
    db.users.createIndex(
        { "accountStatus": 1, "createdAt": -1 },
        { name: "search_status_created", background: true }
    );
    print("✅ Created: search_status_created");
} catch (e) {
    print("⏭️  search_status_created: " + e.message);
}

// 3. Index for birthYear (age filtering)
try {
    db.users.createIndex(
        { "birthYear": 1 },
        { name: "birthYear_1", background: true }
    );
    print("✅ Created: birthYear_1");
} catch (e) {
    print("⏭️  birthYear_1: " + e.message);
}

// 4. Index for heightInches (height filtering)
try {
    db.users.createIndex(
        { "heightInches": 1 },
        { name: "heightInches_1", background: true }
    );
    print("✅ Created: heightInches_1");
} catch (e) {
    print("⏭️  heightInches_1: " + e.message);
}

// 5. Index for religion filtering
try {
    db.users.createIndex(
        { "religion": 1 },
        { name: "religion_1", background: true }
    );
    print("✅ Created: religion_1");
} catch (e) {
    print("⏭️  religion_1: " + e.message);
}

// 6. Index for gender filtering
try {
    db.users.createIndex(
        { "gender": 1 },
        { name: "gender_1", background: true }
    );
    print("✅ Created: gender_1");
} catch (e) {
    print("⏭️  gender_1: " + e.message);
}

// 7. Index for created_at (Admin Dashboard sorting)
try {
    db.users.createIndex(
        { "created_at": -1 },
        { name: "created_at_desc", background: true }
    );
    print("✅ Created: created_at_desc");
} catch (e) {
    print("⏭️  created_at_desc: " + e.message);
}

// 8. Compound index for Admin Dashboard (status + created_at sorting)
try {
    db.users.createIndex(
        { "accountStatus": 1, "created_at": -1 },
        { name: "admin_status_created", background: true }
    );
    print("✅ Created: admin_status_created");
} catch (e) {
    print("⏭️  admin_status_created: " + e.message);
}

// 9. Compound index for exclusions lookup
try {
    db.exclusions.createIndex(
        { "userUsername": 1 },
        { name: "userUsername_1", background: true }
    );
    print("✅ Created: exclusions.userUsername_1");
} catch (e) {
    print("⏭️  exclusions.userUsername_1: " + e.message);
}

print("\n📊 Final indexes on users collection:");
db.users.getIndexes().forEach(idx => print("   - " + idx.name + ": " + JSON.stringify(idx.key)));

print("\n🎉 Done! Search performance should be improved.");
