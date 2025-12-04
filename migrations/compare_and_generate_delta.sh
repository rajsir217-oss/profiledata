#!/bin/bash
# Compare local and production job configurations
# Generate delta migration scripts for differences

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Job Configuration Delta Generator"
echo "=========================================="
echo ""

# Configuration
LOCAL_MONGODB=${LOCAL_MONGODB_URL:-"mongodb://localhost:27017/matrimonialDB"}
PROD_MONGODB=${PRODUCTION_MONGODB_URL:-""}

# Check if production URL is set
if [ -z "$PROD_MONGODB" ]; then
    echo -e "${RED}❌ PRODUCTION_MONGODB_URL not set!${NC}"
    echo ""
    echo "Please set your production MongoDB URL:"
    echo "  export PRODUCTION_MONGODB_URL='mongodb://...'"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Local MongoDB:${NC} $LOCAL_MONGODB"
echo -e "${GREEN}✅ Production MongoDB:${NC} ${PROD_MONGODB:0:30}..."
echo ""

# Create output directory
OUTPUT_DIR="./migrations/delta_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$OUTPUT_DIR"

echo "📁 Output directory: $OUTPUT_DIR"
echo ""

# ============================================================
# Step 1: Export job definitions from both environments
# ============================================================
echo "=========================================="
echo "Step 1: Exporting Job Definitions"
echo "=========================================="

echo "📤 Exporting from LOCAL..."
mongosh "$LOCAL_MONGODB" --quiet --eval "
    db.dynamic_jobs.find({}).forEach(function(job) {
        print(JSON.stringify(job, null, 2));
        print('---SEPARATOR---');
    });
" > "$OUTPUT_DIR/local_jobs_raw.txt"

LOCAL_COUNT=$(mongosh "$LOCAL_MONGODB" --quiet --eval "print(db.dynamic_jobs.countDocuments({}))")
echo "  ✅ Found $LOCAL_COUNT jobs in local"

echo "📤 Exporting from PRODUCTION..."
mongosh "$PROD_MONGODB" --quiet --eval "
    db.dynamic_jobs.find({}).forEach(function(job) {
        print(JSON.stringify(job, null, 2));
        print('---SEPARATOR---');
    });
" > "$OUTPUT_DIR/prod_jobs_raw.txt"

PROD_COUNT=$(mongosh "$PROD_MONGODB" --quiet --eval "print(db.dynamic_jobs.countDocuments({}))")
echo "  ✅ Found $PROD_COUNT jobs in production"
echo ""

# ============================================================
# Step 2: Parse and compare job configurations
# ============================================================
echo "=========================================="
echo "Step 2: Comparing Configurations"
echo "=========================================="

# Create comparison script
cat > "$OUTPUT_DIR/compare_jobs.js" << 'EOF'
// Compare job configurations between local and production

const fs = require('fs');

function parseJobs(filename) {
    const content = fs.readFileSync(filename, 'utf8');
    const jobs = {};
    
    content.split('---SEPARATOR---').forEach(block => {
        const trimmed = block.trim();
        if (trimmed) {
            try {
                const job = JSON.parse(trimmed);
                jobs[job.name] = job;
            } catch (e) {
                // Skip invalid JSON
            }
        }
    });
    
    return jobs;
}

function compareJobs(local, prod) {
    const results = {
        new_jobs: [],
        modified_jobs: [],
        deleted_jobs: [],
        unchanged_jobs: []
    };
    
    // Find new and modified jobs
    Object.keys(local).forEach(name => {
        if (!prod[name]) {
            results.new_jobs.push({ name, config: local[name] });
        } else {
            // Compare parameters
            const localParams = JSON.stringify(local[name].parameters);
            const prodParams = JSON.stringify(prod[name].parameters);
            
            if (localParams !== prodParams) {
                results.modified_jobs.push({
                    name,
                    local: local[name],
                    prod: prod[name]
                });
            } else {
                results.unchanged_jobs.push(name);
            }
        }
    });
    
    // Find deleted jobs (in prod but not in local)
    Object.keys(prod).forEach(name => {
        if (!local[name]) {
            results.deleted_jobs.push({ name, config: prod[name] });
        }
    });
    
    return results;
}

// Main
const localJobs = parseJobs('./local_jobs_raw.txt');
const prodJobs = parseJobs('./prod_jobs_raw.txt');
const comparison = compareJobs(localJobs, prodJobs);

// Write results
fs.writeFileSync('./comparison_results.json', JSON.stringify(comparison, null, 2));

// Print summary
console.log('\n📊 Comparison Results:');
console.log('  ➕ New jobs:', comparison.new_jobs.length);
console.log('  🔄 Modified jobs:', comparison.modified_jobs.length);
console.log('  ➖ Deleted jobs:', comparison.deleted_jobs.length);
console.log('  ✅ Unchanged jobs:', comparison.unchanged_jobs.length);

console.log('\n📝 Details saved to: comparison_results.json');

process.exit(0);
EOF

# Run comparison
echo "🔍 Analyzing differences..."
cd "$OUTPUT_DIR"
node compare_jobs.js
cd - > /dev/null
echo ""

# ============================================================
# Step 3: Generate delta migration scripts
# ============================================================
echo "=========================================="
echo "Step 3: Generating Delta Migration Scripts"
echo "=========================================="

# Read comparison results
COMPARISON_FILE="$OUTPUT_DIR/comparison_results.json"

if [ ! -f "$COMPARISON_FILE" ]; then
    echo -e "${RED}❌ Comparison failed!${NC}"
    exit 1
fi

# Generate migration script
cat > "$OUTPUT_DIR/delta_migration_$(date +%Y%m%d).js" << 'MIGRATION_SCRIPT'
/**
 * Delta Migration - Auto-generated
 * Date: $(date)
 * 
 * This script applies only the differences between local and production
 */

print("\n========================================");
print("Delta Migration: Job Configuration Updates");
print("Date: " + new Date().toISOString());
print("========================================\n");

db = db.getSiblingDB('matrimonialDB');

var results = {
    new_jobs: 0,
    modified_jobs: 0,
    errors: []
};

MIGRATION_SCRIPT

# Parse comparison results and generate specific migrations
node << 'NODEJS_SCRIPT'
const fs = require('fs');
const comparison = JSON.parse(fs.readFileSync('./migrations/delta_*/comparison_results.json', 'utf8'));

let migrationJS = fs.readFileSync('./migrations/delta_*/delta_migration_*.js', 'utf8');

// Add new jobs
if (comparison.new_jobs.length > 0) {
    migrationJS += '\n// ============================================================\n';
    migrationJS += '// NEW JOBS\n';
    migrationJS += '// ============================================================\n\n';
    
    comparison.new_jobs.forEach(job => {
        const config = JSON.parse(JSON.stringify(job.config));
        delete config._id;  // Remove _id for clean insert
        
        migrationJS += `print("➕ Creating new job: ${job.name}");\n`;
        migrationJS += `try {\n`;
        migrationJS += `    db.dynamic_jobs.insertOne(${JSON.stringify(config, null, 4)});\n`;
        migrationJS += `    print("  ✅ Job '${job.name}' created");\n`;
        migrationJS += `    results.new_jobs++;\n`;
        migrationJS += `} catch(e) {\n`;
        migrationJS += `    print("  ❌ Error:", e.message);\n`;
        migrationJS += `    results.errors.push("${job.name}: " + e.message);\n`;
        migrationJS += `}\n\n`;
    });
}

// Add modified jobs
if (comparison.modified_jobs.length > 0) {
    migrationJS += '\n// ============================================================\n';
    migrationJS += '// MODIFIED JOBS\n';
    migrationJS += '// ============================================================\n\n';
    
    comparison.modified_jobs.forEach(job => {
        migrationJS += `print("🔄 Updating job: ${job.name}");\n`;
        migrationJS += `try {\n`;
        migrationJS += `    // Backup current configuration\n`;
        migrationJS += `    var currentJob = db.dynamic_jobs.findOne({ name: "${job.name}" });\n`;
        migrationJS += `    if (currentJob) {\n`;
        migrationJS += `        db.migration_history.insertOne({\n`;
        migrationJS += `            migration_id: "delta_" + new Date().toISOString(),\n`;
        migrationJS += `            job_name: "${job.name}",\n`;
        migrationJS += `            backup_data: currentJob,\n`;
        migrationJS += `            applied_at: new Date()\n`;
        migrationJS += `        });\n`;
        migrationJS += `    }\n\n`;
        migrationJS += `    // Update with new configuration\n`;
        migrationJS += `    var result = db.dynamic_jobs.updateOne(\n`;
        migrationJS += `        { name: "${job.name}" },\n`;
        migrationJS += `        { $set: ${JSON.stringify({ parameters: job.local.parameters, description: job.local.description }, null, 12)} }\n`;
        migrationJS += `    );\n`;
        migrationJS += `    print("  ✅ Job '${job.name}' updated (matched:", result.matchedCount, ", modified:", result.modifiedCount + ")");\n`;
        migrationJS += `    results.modified_jobs++;\n`;
        migrationJS += `} catch(e) {\n`;
        migrationJS += `    print("  ❌ Error:", e.message);\n`;
        migrationJS += `    results.errors.push("${job.name}: " + e.message);\n`;
        migrationJS += `}\n\n`;
    });
}

// Add summary
migrationJS += '\n// ============================================================\n';
migrationJS += '// SUMMARY\n';
migrationJS += '// ============================================================\n\n';
migrationJS += 'print("\\n========================================");\n';
migrationJS += 'print("📊 Migration Summary:");\n';
migrationJS += 'print("  ➕ New jobs created:", results.new_jobs);\n';
migrationJS += 'print("  🔄 Jobs updated:", results.modified_jobs);\n';
migrationJS += 'print("  ❌ Errors:", results.errors.length);\n';
migrationJS += 'if (results.errors.length > 0) {\n';
migrationJS += '    print("\\n⚠️  Errors encountered:");\n';
migrationJS += '    results.errors.forEach(function(err) { print("    -", err); });\n';
migrationJS += '}\n';
migrationJS += 'print("========================================\\n");\n';

// Write final migration script
const files = fs.readdirSync('./migrations').filter(f => f.startsWith('delta_'));
const outputFile = `./migrations/${files[0]}/delta_migration_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.js`;
fs.writeFileSync(outputFile, migrationJS);
console.log('✅ Delta migration script generated');
NODEJS_SCRIPT

echo ""

# ============================================================
# Step 4: Show summary
# ============================================================
echo "=========================================="
echo "Summary"
echo "=========================================="
echo ""

# Display comparison results
cat "$COMPARISON_FILE" | node << 'NODEJS'
const results = JSON.parse(require('fs').readFileSync(0, 'utf8'));

console.log('📊 Changes Detected:\n');

if (results.new_jobs.length > 0) {
    console.log('➕ NEW JOBS (' + results.new_jobs.length + '):');
    results.new_jobs.forEach(job => {
        console.log('   -', job.name);
    });
    console.log('');
}

if (results.modified_jobs.length > 0) {
    console.log('🔄 MODIFIED JOBS (' + results.modified_jobs.length + '):');
    results.modified_jobs.forEach(job => {
        console.log('   -', job.name);
        console.log('     Local params:', Object.keys(job.local.parameters).join(', '));
        console.log('     Prod params:', Object.keys(job.prod.parameters).join(', '));
    });
    console.log('');
}

if (results.deleted_jobs.length > 0) {
    console.log('➖ DELETED JOBS (in prod but not local) (' + results.deleted_jobs.length + '):');
    results.deleted_jobs.forEach(job => {
        console.log('   -', job.name);
    });
    console.log('');
}

if (results.unchanged_jobs.length > 0) {
    console.log('✅ UNCHANGED JOBS (' + results.unchanged_jobs.length + '):');
    results.unchanged_jobs.forEach(name => {
        console.log('   -', name);
    });
    console.log('');
}
NODEJS

echo ""
echo "=========================================="
echo "✅ Analysis Complete!"
echo "=========================================="
echo ""
echo "📁 Output Location: $OUTPUT_DIR"
echo ""
echo "Files Generated:"
echo "  1. local_jobs_raw.txt          - Local job configurations"
echo "  2. prod_jobs_raw.txt           - Production job configurations"
echo "  3. comparison_results.json     - Detailed comparison"
echo "  4. delta_migration_*.js        - Migration script with ONLY differences"
echo ""
echo "Next Steps:"
echo "  1. Review the comparison: cat $OUTPUT_DIR/comparison_results.json | jq"
echo "  2. Review the migration: cat $OUTPUT_DIR/delta_migration_*.js"
echo "  3. Test locally: mongosh \$LOCAL_MONGODB < $OUTPUT_DIR/delta_migration_*.js"
echo "  4. Deploy to prod: mongosh \$PRODUCTION_MONGODB_URL < $OUTPUT_DIR/delta_migration_*.js"
echo ""
