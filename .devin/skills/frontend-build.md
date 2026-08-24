---
description: Build the React frontend or messenger-web reliably from the repo root.
---

# Skill: Build the Frontend

## When to use

Any task that requires running `npm run build` for `frontend/` or `messenger-web/`.

## Why not `cd`?

In this workspace, terminal commands run via Cascade may execute from the repo root even when a `Cwd` is supplied. Using `npm --prefix <dir>` is reliable.

## Main frontend

From the repo root:

```bash
npm --prefix /Users/rajsiripuram02/opt/appsrc/profiledata/frontend run build
```

## messenger-web

```bash
npm install --prefix /Users/rajsiripuram02/opt/appsrc/profiledata/messenger-web
npm run build --prefix /Users/rajsiripuram02/opt/appsrc/profiledata/messenger-web
```

Replace `build` with the appropriate script name (e.g., `start`, `build`, `test`).

## Verification

- Confirm `frontend/build/` or `messenger-web/dist/` is produced.
- Check that `frontend/public/build-info.json` was generated as expected.
