---
description: Update SEO metadata, brand kit, sitemap, robots, and canonical URLs.
---

# Skill: Update SEO Metadata

## Central sources

- `frontend/src/config/seoBrandKit.js` — brand/SEO taxonomy source.
  - `SEO_KEYWORD_UNIVERSE`
  - Taglines, meta description options, ad copy variants, dashboard category labels, platform taxonomy.
- `frontend/src/utils/seo.js` — page-level SEO mapping.
- `frontend/src/components/SEO.js` — reusable SEO component.

## How to make SEO changes

1. Use grouped keyword families in `utils/seo.js` (brand, coreServices, diaspora, relationship, registration, algorithm, support).
2. Map focused keywords by page:
   - `home`
   - `register`
   - `l3v3l-info`
   - legal pages (`terms`, `privacy`, `community-guidelines`, `cookie-policy`)
   - `help`
3. Use `createKeywordString` / `createKeywords` helpers for deduplication.
4. Keep fallback keywords narrow in `SEO.js` so pages without explicit keywords do not inherit an oversized list.

## Domain and canonical URLs

- Normalize site URL via `REACT_APP_SITE_URL`, then `window.RUNTIME_CONFIG.FRONTEND_URL`, defaulting to `https://l3v3lmatches.com`.
- Canonical routes:
  - `/terms`
  - `/privacy`
  - `/refund`
  - `/register3`
  - `/help`
- Set `/contact` to `noindex` and point to the support tab URL.
- Default OG/Twitter image: `public/android-chrome-512x512.png`.

## Static files

- `public/index.html` — baseline meta/OG/Twitter, align keywords with `home` mapping.
- `public/robots.txt` — allow crawl by default, explicitly disallow private/auth routes. Do not use blanket `Disallow: /`.
- `public/sitemap.xml` — include current public/indexable routes; remove outdated/protected redirects.

## Admin utilities

- `frontend/src/components/SEOBrandKitExport.js` provides JSON/CSV/clipboard export for `SEO_BRAND_KIT`.
- It is wired as the `seo-brand-kit` tab in `AdminUtilities.js`.
- Backward-compatible redirect: `/seo-brand-kit-export` -> `/admin-utilities?tab=seo-brand-kit`.

## Verification

- Run `node --check` on modified JS files.
- Confirm canonical URLs, OG/Twitter tags, robots, and sitemap are consistent.
