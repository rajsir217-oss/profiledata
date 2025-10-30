# Uploads Directory

This directory contains uploaded files and assets.

## Structure

```
uploads/
├── .gitkeep                 # Ensures directory is tracked in git
├── default-avatar.svg       # Default placeholder avatar for new users
└── README.md               # This file
```

## Default Avatar

- **File:** `default-avatar.svg`
- **Purpose:** Placeholder image for seeded/new users without profile pictures
- **URL:** `/uploads/default-avatar.svg`
- **Format:** SVG (scalable, lightweight)
- **Size:** 200x200 pixels
- **Usage:** Automatically assigned to seeded users in `seed_data_generator.py`

## User Uploads

User-uploaded profile images and other files will be saved directly to this directory.

### .gitignore Rules

The `.gitignore` is configured to:
- ✅ **Track:** `default-avatar.svg` (version controlled)
- ✅ **Track:** `.gitkeep` (ensures directory exists)
- ❌ **Ignore:** All other files (user uploads)

This ensures the default avatar is available in all environments while keeping user uploads private.

## Notes

- The backend serves this directory as static files at `/uploads/`
- User-uploaded images are not tracked in git (for privacy and size reasons)
- If you need subdirectories, create them as needed (e.g., `contact_tickets/`)
