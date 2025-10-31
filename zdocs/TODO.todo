# TODO List

## UI/UX Improvements

### Layout Issues
- [x] **Fix row format overflow on L3V3L matches page** - Fixed by adding proper width constraints and overflow handling to `.results-rows`, `.result-row`, and `.row-content` (Oct 26, 2025)
  - File: `/frontend/src/components/SearchPage.css`

### Mobile Responsiveness
- [ ] **Fix "+Add" button styling for mobile** - Button should be rounded/circular on mobile view for Education and Work Experience sections (change was lost during environment configuration updates)
  - Files: `/frontend/src/components/shared/EducationHistory.js`, `/frontend/src/components/shared/WorkExperience.js`
  - CSS: Button should be circular with just "+" icon on mobile, full text "Add" on desktop

## Environment Configuration

### Completed ✅
- [x] Set up environment detection (local vs GCP)
- [x] Create `.env.local` and `.env.production` files
- [x] Fix boolean parsing in Pydantic (False vs false)
- [x] Fix `public/config.js` runtime config override issue
- [x] Add environment switcher script (`switch-env.sh`)
- [x] Create deployment scripts (`deploy-gcp.sh`, `set-gcp-secrets.sh`)

### Pending
- [ ] Test GCP deployment with new environment configuration
- [ ] Set up CI/CD pipeline for automatic deployments
- [ ] Create staging environment configuration

## Image Storage

### Issue
- Database stores full GCP URLs instead of relative paths
- When running locally, images still reference GCP

### Solutions to Implement
- [ ] **Option 1 (Quick)**: Keep hybrid approach - local API, GCP images
- [ ] **Option 2 (Clean)**: Database migration to store only relative paths
  - Update all image URLs in MongoDB to relative paths
  - Update upload service to save relative paths
  - Create migration script
- [ ] **Option 3**: Image sync script to download GCP images locally for development

## Testing
- [ ] Test image upload in local environment (after storage solution chosen)
- [ ] Test all notification triggers
- [ ] Test SMS notifications
- [ ] Verify all API endpoints work with new environment detection

## Documentation
- [ ] Update README with new environment setup instructions
- [ ] Document deployment process
- [ ] Add troubleshooting guide for common environment issues

---
**Last Updated:** October 26, 2025
