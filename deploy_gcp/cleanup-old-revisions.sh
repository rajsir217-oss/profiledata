#!/bin/bash
# Cleanup old Cloud Run revisions
# Keeps only the latest N revisions per service
# Usage: ./cleanup-old-revisions.sh [--all]
#   --all : Skip confirmation prompts and delete all old revisions

set -e

PROJECT_ID="matrimonial-staging"
REGION="us-central1"
KEEP_COUNT=3  # Keep latest 3 revisions (reduced from 7 to save storage costs)
IMAGE_KEEP_DAYS=7  # Keep images from the last N days regardless of revision status
MAX_IMAGE_DELETE=50  # Safety limit: max images to delete per service per run

# Parse arguments
AUTO_YES=false
if [[ "$1" == "--all" ]] || [[ "$1" == "-a" ]]; then
  AUTO_YES=true
fi

# Services to clean up
SERVICES=("matrimonial-backend" "matrimonial-frontend")

echo "============================================="
echo "🧹 Cloud Run Revision Cleanup"
echo "============================================="
echo ""
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Strategy: Keep latest $KEEP_COUNT revisions per service"
echo ""

TOTAL_DELETED=0

for SERVICE_NAME in "${SERVICES[@]}"; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📦 Service: $SERVICE_NAME"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  
  # Get current serving revision (never delete this!)
  echo "🔍 Fetching current serving revision..."
  SERVING_REVISION=$(gcloud run services describe $SERVICE_NAME \
    --region=$REGION \
    --project=$PROJECT_ID \
    --format="value(status.traffic[0].revisionName)" 2>/dev/null || echo "")
  
  if [ -z "$SERVING_REVISION" ]; then
    echo "⚠️  Service $SERVICE_NAME not found or not deployed"
    echo ""
    continue
  fi
  
  echo "🟢 Active revision: $SERVING_REVISION (will be protected)"
  echo ""
  
  # Get all revisions sorted by creation time (newest first)
  echo "📋 Fetching all revisions..."
  ALL_REVISIONS=$(gcloud run revisions list \
    --service=$SERVICE_NAME \
    --region=$REGION \
    --project=$PROJECT_ID \
    --format="value(metadata.name)" \
    --sort-by="~metadata.creationTimestamp")
  
  # Count total revisions
  TOTAL=$(echo "$ALL_REVISIONS" | grep -c . || echo "0")
  echo "📊 Found $TOTAL total revisions"
  
  if [ $TOTAL -le $KEEP_COUNT ]; then
    echo "✅ No revision cleanup needed - only $TOTAL revisions exist"
    echo ""
  else
    # Calculate how many to delete
    TO_DELETE=$((TOTAL - KEEP_COUNT))
    echo "🗑️  Will delete $TO_DELETE old revisions (keeping latest $KEEP_COUNT)"
    echo ""
    
    # Get revisions to delete (skip first KEEP_COUNT, delete the rest)
    REVISIONS_TO_DELETE=$(echo "$ALL_REVISIONS" | tail -n +$((KEEP_COUNT + 1)))
    
    # Show what will be deleted
    echo "Revisions to delete (oldest first):"
    echo "$REVISIONS_TO_DELETE" | head -10
    if [ $TO_DELETE -gt 10 ]; then
      echo "... and $((TO_DELETE - 10)) more"
    fi
    echo ""
    
    # Ask for confirmation (skip if --all flag is set)
    SKIP_REVISIONS=false
    if [ "$AUTO_YES" = true ]; then
      echo "🚀 Auto-confirm enabled (--all flag)"
    else
      read -p "Delete these $TO_DELETE revisions from $SERVICE_NAME? (y/N) " -n 1 -r
      echo
      if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "⏭️  Skipped revision cleanup for $SERVICE_NAME"
        SKIP_REVISIONS=true
      fi
    fi
    
    if [ "$SKIP_REVISIONS" = false ]; then
      # Delete revisions
      echo ""
      echo "🗑️  Deleting old revisions..."
      DELETED_COUNT=0
      while IFS= read -r revision; do
        if [ -n "$revision" ]; then
          # Double-check we're not deleting the serving revision
          if [ "$revision" = "$SERVING_REVISION" ]; then
            echo "  ⚠️  Skipped $revision (serving revision)"
            continue
          fi
          
          echo "  Deleting: $revision"
          if gcloud run revisions delete "$revision" \
            --region=$REGION \
            --project=$PROJECT_ID \
            --quiet 2>/dev/null; then
            DELETED_COUNT=$((DELETED_COUNT + 1))
          else
            echo "    ⚠️  Failed to delete $revision (might be in use)"
          fi
        fi
      done <<< "$REVISIONS_TO_DELETE"
      
      REMAINING=$((TOTAL - DELETED_COUNT))
      TOTAL_DELETED=$((TOTAL_DELETED + DELETED_COUNT))
      
      echo ""
      echo "✅ Deleted $DELETED_COUNT revisions from $SERVICE_NAME"
      echo "📊 Remaining: $REMAINING revisions"
      echo ""
    fi
  fi

  # --- Image Cleanup (Artifact Registry + GCR) --- (always runs regardless of revision cleanup)
  echo "🧹 Cleaning up orphaned container images..."
  
  # Get images still in use by ANY remaining revision
  echo "  🔍 Checking which images are still in use by revisions..."
  STILL_IN_USE=$(gcloud run revisions list \
    --service=$SERVICE_NAME \
    --region=$REGION \
    --project=$PROJECT_ID \
    --format="value(spec.containers[0].image)" 2>/dev/null || echo "")
  
  IN_USE_COUNT=$(echo "$STILL_IN_USE" | grep -c . || echo "0")
  echo "  📊 Found $IN_USE_COUNT images referenced by active revisions"

  IMAGE_DELETED_COUNT=0
  IMAGE_FAILED_COUNT=0
  IMAGE_KEPT_COUNT=0
  IMAGES_FOUND=false

  # --- 1. Artifact Registry (cloud-run-source-deploy) ---
  REPO_NAME="cloud-run-source-deploy"
  REGISTRY_PATH="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME"
  
  echo "  📋 Checking Artifact Registry ($REPO_NAME)..."
  AR_IMAGES=$(gcloud artifacts docker images list "$REGISTRY_PATH/$SERVICE_NAME" \
    --include-tags \
    --format="value(format('{0}@{1}', package, version))" 2>/dev/null || echo "")
  
  AR_COUNT=$(echo "$AR_IMAGES" | grep -c . || echo "0")
  if [ -n "$AR_IMAGES" ] && [ "$AR_COUNT" -gt 0 ]; then
    IMAGES_FOUND=true
    echo "  📊 Found $AR_COUNT images in Artifact Registry"
    
    # Count orphaned images first
    AR_ORPHAN_COUNT=0
    while IFS= read -r image_full; do
      if [ -z "$image_full" ]; then continue; fi
      IMAGE_DIGEST=$(echo "$image_full" | grep -o 'sha256:[a-f0-9]*')
      if echo "$STILL_IN_USE" | grep -q "$IMAGE_DIGEST"; then continue; fi
      AR_ORPHAN_COUNT=$((AR_ORPHAN_COUNT + 1))
    done <<< "$AR_IMAGES"
    
    echo "  🗑️  $AR_ORPHAN_COUNT orphaned images in Artifact Registry"
    
    if [ $AR_ORPHAN_COUNT -gt $MAX_IMAGE_DELETE ]; then
      echo "  ⚠️  Large cleanup: will delete oldest $MAX_IMAGE_DELETE of $AR_ORPHAN_COUNT. Re-run for more."
    fi
    
    AR_ROUND_ATTEMPTS=0
    while IFS= read -r image_full; do
      if [ -z "$image_full" ]; then continue; fi
      if [ $AR_ROUND_ATTEMPTS -ge $MAX_IMAGE_DELETE ]; then
        echo "  ⛔ Reached max delete limit ($MAX_IMAGE_DELETE). Re-run to delete more."
        break
      fi
      IMAGE_DIGEST=$(echo "$image_full" | grep -o 'sha256:[a-f0-9]*')
      if echo "$STILL_IN_USE" | grep -q "$IMAGE_DIGEST"; then
        IMAGE_KEPT_COUNT=$((IMAGE_KEPT_COUNT + 1))
        continue
      fi
      AR_ROUND_ATTEMPTS=$((AR_ROUND_ATTEMPTS + 1))
      echo "  🗑️ Deleting orphaned AR image: ...@${IMAGE_DIGEST:0:20}..."
      if gcloud artifacts docker images delete "$image_full" \
        --project=$PROJECT_ID \
        --quiet --delete-tags 2>&1 | tail -1; then
        IMAGE_DELETED_COUNT=$((IMAGE_DELETED_COUNT + 1))
      else
        IMAGE_FAILED_COUNT=$((IMAGE_FAILED_COUNT + 1))
      fi
    done <<< "$AR_IMAGES"
  else
    echo "  ℹ️  No images in Artifact Registry for $SERVICE_NAME"
  fi

  # --- 2. GCR (gcr.io) ---
  GCR_PATH="gcr.io/$PROJECT_ID/$SERVICE_NAME"
  
  echo "  📋 Checking GCR ($GCR_PATH)..."
  # Get images with timestamps so we can apply age-based retention
  GCR_IMAGES_RAW=$(gcloud container images list-tags "$GCR_PATH" \
    --format="csv[no-heading](digest,timestamp.datetime)" \
    --sort-by="~timestamp" 2>/dev/null || echo "")
  
  GCR_COUNT=$(echo "$GCR_IMAGES_RAW" | grep -c . || echo "0")
  if [ -n "$GCR_IMAGES_RAW" ] && [ "$GCR_COUNT" -gt 0 ]; then
    IMAGES_FOUND=true
    echo "  📊 Found $GCR_COUNT images in GCR"
    
    # Calculate cutoff date for age-based retention
    if [[ "$OSTYPE" == "darwin"* ]]; then
      CUTOFF_DATE=$(date -v-${IMAGE_KEEP_DAYS}d +%Y-%m-%d)
    else
      CUTOFF_DATE=$(date -d "-${IMAGE_KEEP_DAYS} days" +%Y-%m-%d)
    fi
    echo "  📅 Keeping images newer than $CUTOFF_DATE ($IMAGE_KEEP_DAYS days)"
    
    # First pass: count how many would be deleted
    GCR_DELETE_CANDIDATES=0
    while IFS=',' read -r digest timestamp; do
      digest=$(echo "$digest" | xargs)  # trim whitespace
      if [ -z "$digest" ]; then continue; fi
      # Ensure digest has sha256: prefix for consistent matching
      if [[ "$digest" != sha256:* ]]; then
        digest="sha256:$digest"
      fi
      # Skip images in use by active revisions
      if echo "$STILL_IN_USE" | grep -q "$digest"; then continue; fi
      # Skip images newer than cutoff
      IMAGE_DATE=$(echo "$timestamp" | cut -d' ' -f1)
      if [[ -n "$IMAGE_DATE" && "$IMAGE_DATE" > "$CUTOFF_DATE" ]]; then continue; fi
      GCR_DELETE_CANDIDATES=$((GCR_DELETE_CANDIDATES + 1))
    done <<< "$GCR_IMAGES_RAW"
    
    echo "  🗑️  $GCR_DELETE_CANDIDATES orphaned images older than $IMAGE_KEEP_DAYS days"
    
    # Safety: confirm if deleting many images
    if [ $GCR_DELETE_CANDIDATES -gt $MAX_IMAGE_DELETE ]; then
      echo "  ⚠️  Large cleanup: $GCR_DELETE_CANDIDATES images to delete (limit: $MAX_IMAGE_DELETE per run)"
      echo "  ℹ️  Will delete oldest $MAX_IMAGE_DELETE images this run. Re-run to delete more."
    fi
    
    if [ $GCR_DELETE_CANDIDATES -gt 10 ] && [ "$AUTO_YES" != true ]; then
      read -p "  Delete up to $MAX_IMAGE_DELETE of $GCR_DELETE_CANDIDATES orphaned GCR images? (y/N) " -n 1 -r
      echo
      if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "  ⏭️  Skipped GCR image cleanup for $SERVICE_NAME"
      else
        # Second pass: actually delete (with limit)
        GCR_ROUND_ATTEMPTS=0
        while IFS=',' read -r digest timestamp; do
          digest=$(echo "$digest" | xargs)  # trim whitespace
          if [ -z "$digest" ]; then continue; fi
          if [ $GCR_ROUND_ATTEMPTS -ge $MAX_IMAGE_DELETE ]; then
            echo "  ⛔ Reached max delete limit ($MAX_IMAGE_DELETE). Re-run to delete more."
            break
          fi
          # Ensure digest has sha256: prefix
          if [[ "$digest" != sha256:* ]]; then
            digest="sha256:$digest"
          fi
          FULL_REF="$GCR_PATH@$digest"
          if echo "$STILL_IN_USE" | grep -q "$digest"; then
            IMAGE_KEPT_COUNT=$((IMAGE_KEPT_COUNT + 1))
            continue
          fi
          IMAGE_DATE=$(echo "$timestamp" | cut -d' ' -f1)
          if [[ -n "$IMAGE_DATE" && "$IMAGE_DATE" > "$CUTOFF_DATE" ]]; then
            IMAGE_KEPT_COUNT=$((IMAGE_KEPT_COUNT + 1))
            continue
          fi
          GCR_ROUND_ATTEMPTS=$((GCR_ROUND_ATTEMPTS + 1))
          echo "  🗑️ Deleting orphaned GCR image: ...@${digest:0:20}..."
          DELETE_OUTPUT=$(gcloud container images delete "$FULL_REF" \
            --project=$PROJECT_ID \
            --quiet --force-delete-tags 2>&1) && {
            IMAGE_DELETED_COUNT=$((IMAGE_DELETED_COUNT + 1))
          } || {
            IMAGE_FAILED_COUNT=$((IMAGE_FAILED_COUNT + 1))
            echo "    ⚠️  Failed: $(echo "$DELETE_OUTPUT" | tail -1)"
          }
        done <<< "$GCR_IMAGES_RAW"
      fi
    elif [ $GCR_DELETE_CANDIDATES -gt 0 ]; then
      # Small number, delete without extra prompt
      GCR_ROUND_ATTEMPTS=0
      while IFS=',' read -r digest timestamp; do
        digest=$(echo "$digest" | xargs)  # trim whitespace
        if [ -z "$digest" ]; then continue; fi
        if [ $GCR_ROUND_ATTEMPTS -ge $MAX_IMAGE_DELETE ]; then
          echo "  ⛔ Reached max delete limit ($MAX_IMAGE_DELETE). Re-run to delete more."
          break
        fi
        # Ensure digest has sha256: prefix
        if [[ "$digest" != sha256:* ]]; then
          digest="sha256:$digest"
        fi
        FULL_REF="$GCR_PATH@$digest"
        if echo "$STILL_IN_USE" | grep -q "$digest"; then
          IMAGE_KEPT_COUNT=$((IMAGE_KEPT_COUNT + 1))
          continue
        fi
        IMAGE_DATE=$(echo "$timestamp" | cut -d' ' -f1)
        if [[ -n "$IMAGE_DATE" && "$IMAGE_DATE" > "$CUTOFF_DATE" ]]; then
          IMAGE_KEPT_COUNT=$((IMAGE_KEPT_COUNT + 1))
          continue
        fi
        GCR_ROUND_ATTEMPTS=$((GCR_ROUND_ATTEMPTS + 1))
        echo "  🗑️ Deleting orphaned GCR image: ...@${digest:0:20}..."
        DELETE_OUTPUT=$(gcloud container images delete "$FULL_REF" \
          --project=$PROJECT_ID \
          --quiet --force-delete-tags 2>&1) && {
          IMAGE_DELETED_COUNT=$((IMAGE_DELETED_COUNT + 1))
        } || {
          IMAGE_FAILED_COUNT=$((IMAGE_FAILED_COUNT + 1))
          echo "    ⚠️  Failed: $(echo "$DELETE_OUTPUT" | tail -1)"
        }
      done <<< "$GCR_IMAGES_RAW"
    else
      echo "  ✅ No orphaned images to delete in GCR"
    fi
  else
    echo "  ℹ️  No images in GCR for $SERVICE_NAME"
  fi

  # Summary
  if [ "$IMAGES_FOUND" = true ]; then
    echo "  ✅ Kept $IMAGE_KEPT_COUNT images (in use by revisions)"
    echo "  ✅ Deleted $IMAGE_DELETED_COUNT orphaned images for $SERVICE_NAME"
    if [ $IMAGE_FAILED_COUNT -gt 0 ]; then
      echo "  ⚠️ Failed to delete $IMAGE_FAILED_COUNT images (may require manual cleanup)"
    fi
  else
    echo "  ℹ️  No images found in any registry for $SERVICE_NAME"
  fi
  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Cleanup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Total revisions deleted: $TOTAL_DELETED"
echo ""
