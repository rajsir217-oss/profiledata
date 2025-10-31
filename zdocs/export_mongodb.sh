#!/bin/bash
# Export MongoDB Database for Cloud Migration
# Run this script to backup your local MongoDB data

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="mongodb_backup_${TIMESTAMP}"

echo "📦 Exporting MongoDB database..."
echo "📂 Backup directory: $BACKUP_DIR"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Export the entire database
mongodump --db matrimonialDB --out "$BACKUP_DIR"

if [ $? -eq 0 ]; then
    echo "✅ MongoDB export successful!"
    echo "📊 Backup location: $BACKUP_DIR"
    
    # Show statistics
    echo ""
    echo "📈 Backup Statistics:"
    du -sh "$BACKUP_DIR"
    
    # List collections
    echo ""
    echo "📚 Collections backed up:"
    ls -lh "$BACKUP_DIR/matrimonialDB/"
    
    # Create compressed archive
    tar -czf "${BACKUP_DIR}.tar.gz" "$BACKUP_DIR"
    echo ""
    echo "📦 Compressed backup: ${BACKUP_DIR}.tar.gz"
    echo "💾 Size: $(du -sh ${BACKUP_DIR}.tar.gz | cut -f1)"
    
    # Cleanup uncompressed backup
    rm -rf "$BACKUP_DIR"
    
    echo ""
    echo "🎉 Ready to upload to cloud!"
    echo "📁 File to upload: ${BACKUP_DIR}.tar.gz"
else
    echo "❌ Export failed!"
    exit 1
fi
