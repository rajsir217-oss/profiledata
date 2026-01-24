#!/bin/bash
# Cleanup old Cloud Run revisions
# Keeps only the latest N revisions per service
# Usage: ./cleanup-old-revisions.sh [--all]
#   --all : Skip confirmation prompts and delete all old revisions

set -e

PROJECT_ID="matrimonial-staging"
REGION="us-central1"
KEEP_COUNT=7  # Keep latest 7 revisions

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
    echo "✅ No cleanup needed - only $TOTAL revisions exist"
    echo ""
    continue
  fi
  
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
  if [ "$AUTO_YES" = true ]; then
    echo "🚀 Auto-confirm enabled (--all flag)"
  else
    read -p "Delete these $TO_DELETE revisions from $SERVICE_NAME? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "⏭️  Skipped $SERVICE_NAME"
      echo ""
      continue
    fi
  fi
  
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

  # --- NEW: Artifact Registry Image Cleanup ---
  echo "🧹 Cleaning up associated images in Artifact Registry..."
  
  # Get repository name (usually based on project and region)
  REPO_NAME="cloud-run-source-deploy"
  
  # Get all image digests for this service in the repository
  # Images are usually tagged with the service name or similar
  # For Cloud Run source deploys, they are in the cloud-run-source-deploy repo
  IMAGES=$(gcloud artifacts docker images list "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME" \
    --filter="package ~ $SERVICE_NAME" \
    --format="value(format('{0}@{1}', package, version))" 2>/dev/null || echo "")
  
  if [ -n "$IMAGES" ]; then
    # Get images still in use by ANY remaining revision
    STILL_IN_USE=$(gcloud run revisions list \
      --service=$SERVICE_NAME \
      --region=$REGION \
      --project=$PROJECT_ID \
      --format="value(spec.template.spec.containers[0].image)")
    
    IMAGE_DELETED_COUNT=0
    while IFS= read -r image_full; do
      if [ -z "$image_full" ]; then continue; fi
      
      # Check if this specific image (with digest) is in the STILL_IN_USE list
      if echo "$STILL_IN_USE" | grep -q "$image_full"; then
        # echo "  ✅ Keeping image: $image_full (in use)"
        continue
      fi
      
      echo "  🗑️ Deleting orphaned image: $image_full"
      if gcloud artifacts docker images delete "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$image_full" \
        --project=$PROJECT_ID \
        --quiet --delete-tags 2>/dev/null; then
        IMAGE_DELETED_COUNT=$((IMAGE_DELETED_COUNT + 1))
      fi
    done <<< "$IMAGES"
    echo "  ✅ Deleted $IMAGE_DELETED_COUNT orphaned images for $SERVICE_NAME"
  else
    echo "  ℹ️ No images found to clean up in $REPO_NAME"
  fi
  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Cleanup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Total revisions deleted: $TOTAL_DELETED"
echo ""
