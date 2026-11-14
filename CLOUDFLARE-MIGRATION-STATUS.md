# Cloudflare migration — 2026-11-14

## Live hosting

- Athlete / landing: https://saeedi-fit-body.aliisaeedi7116.workers.dev
- Separate portal: https://saeedi-fit-body.aliisaeedi7116.workers.dev/admin
- Custom domains registered on the Worker: `saeedifitbody.ir`, `www.saeedifitbody.ir`, `admin.saeedifitbody.ir`.
- Zone is active after the owner's nameserver recheck. Root and admin hosts returned HTTPS 200; www redirects to the root. Nameservers are `clarissa.ns.cloudflare.com` and `fattouche.ns.cloudflare.com`.
- The current React UI runs directly on Cloudflare, without the Google iframe. Content-hashed JS/CSS and embedded local fonts preserve the existing design and themes. Admin is a separate HTML asset.

## Runtime boundary — migration is NOT complete

The Worker currently proxies an explicit list of authenticated RPC methods to Apps Script deployment **556**. The original server still enforces sessions, roles, plan ownership and subscriptions. There is no automatic retry of writes. Cross-origin API requests are rejected. API responses are not cached.

**Production reads and writes still use Google Sheets.** D1 contains isolated snapshots and a separate native preview, not the live application database. There is no dual-write or automatic synchronization. Changes made in Sheets after the snapshot are not reflected in D1. Existing private media still resides in Drive. Telegram scheduling, AI and PDF generation still run in Apps Script. `/api/health` exposes this distinction explicitly.

## UI and offline release

- Main domain serves the campaign landing, official transparent logo, locally hosted 104 KB WebP hero, bounded procedural WebGL equipment scene and all existing themes.
- Dashboard secondary metrics are collapsed; water, sleep check-in and assigned supplements share a quick strip. Sleep records use the existing authenticated wellness API.
- Story exports default to English and offer FHD/QHD/4K 9:16, 4:5 and 1:1. Calorie estimates remain explicitly estimated; only saved sets count as completed work.
- Public shell/PWA assets are cached by an explicit allowlist. No API, admin, private image, message, payment or authentication response is put in that cache.
- Downloading assigned plans is opt-in and device-local. The separate offline screen is read-only, carries a saved-at timestamp and has no live metrics. Every login/logout invalidates the account partition; logout clears the downloaded copy. GIFs are not included in the offline download. No offline write queue or background push is implemented.
- Browser fixture checks at 390/1440 px passed landing/login/home/story/QHD, offline reload with exact assigned plan, logout deletion, no horizontal overflow/page errors, and reduced-motion fallback. These are synthetic browser checks, not a claim of inspecting a real athlete's authenticated session.
- Design preview: https://saeedi-fit-body-design-preview.aliisaeedi7116.workers.dev — uses the real Google backend and visibly warns that saves affect the real account.

## Isolated native backend preview

`saeedi-fit-body-native` uses a separate D1 database and cookie sessions. A signed read-only owner export was reconciled across 6 accounts and 14 bootstrap fields; historical subscription entitlements were preserved. Native authentication, owned reads, water/profile/body/wellness/reminder writes and private uploads have targeted SQLite tests. Many remaining production APIs and admin workflows are still unported and explicitly return an unavailable response; do not point the main domain at it.

R2 is not enabled. The owner chose a route without payment/card activation. New native-preview private uploads use private KV with a bounded temporary D1 buffer for propagation delay. Real deployed acceptance checks created and deleted only a synthetic account and verified exact uploaded bytes, access controls, logout and cleanup. No real Telegram message, AI call or payment decision was made by those tests.

Apps Script remains online. Hosting rollback is version 555; current compatible bridge version is 556. Do not disable Google services or repoint Telegram while these dependencies remain.

## Verified private snapshot

- D1 database: `saeedi-fit-body-staging`.
- 64 original sheet names, including archives and original program names, preserved exactly.
- 9,198 nonempty source rows, with original row/column coordinates, formula text and cached values where present in the export.
- Batch: `86b9ab131698cfb557e57c16`.
- Source XLSX SHA-256: `86b9ab131698cfb557e57c1633d180b5604da8af813eb3ff7428370625257fd9`.
- Every row in all 64 D1 sheets was read back and matched against its content hash. Counts alone were not used as proof.
- XLSX backup, manifest and generated SQL are outside the public repository, in the owner's local private migration folder. There is no public API for snapshot contents.
- Source workbook timezone is `America/Los_Angeles`; Apps Script runtime timezone is `Asia/Tehran`. Preserve source values and explicitly test date interpretation during native conversion.

## Reproducible commands

Run `npm ci`, `npm --prefix design/lovable-ui ci --ignore-scripts`, `npm run build:cloudflare`, and `npm test`.

Use Wrangler 4.162.0 with the owner's normal CLI login. Deploy from `cloudflare/`. Credentials and `.wrangler` state are not committed. Domain definitions are in `cloudflare/wrangler.jsonc`.

Private snapshot tools:

```
python cloudflare/prepare-snapshot.py PRIVATE_BACKUP.xlsx PRIVATE_OUTPUT_DIRECTORY
node cloudflare/verify-snapshot.cjs PRIVATE_OUTPUT_DIRECTORY/manifest.json
```

The preparation tool refuses to generate private data under this public repository. Native account/plan/log tables and server endpoints must be implemented and tested before using this snapshot in production. A fresh snapshot and a final reconciliation window are required before cutover; this snapshot must never silently replace newer live records.

## Remaining exit criteria

1. Athlete login and own home/programs were confirmed by the owner on the Cloudflare origin. The root/admin domain, HTTPS certificate and www redirect have been verified. The generated admin RPC bridge is now parsed and browser-tested as part of release validation.
2. Replace Google authentication/cache and every used API with native Worker/D1 implementations, preserving roles, ownership and idempotency. Upgrade password storage without exposing old credentials. Keep a complete endpoint inventory.
3. Convert snapshot tables into indexed domain tables; preserve IDs, plan names, assignments, sets, subscriptions, financial history and date semantics. Validate against fresh source data.
4. Migrate private files to authenticated object storage; separately validate any storage activation/billing requirements. Do not publish body photos or payment receipts.
5. Move Telegram webhook/schedulers and server-side AI secrets; replace Google PDF generation with a tested alternative. Do not execute live reminder or AI requests as tests.
6. Reconcile writes, run athlete/coach/admin regression tests, switch the database, and only then retire Apps Script. OTP, installability and authenticated offline synchronization remain separate planned features.

References: [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/), [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).

Public program requests use a separate native D1 database and an idempotent signed mirror to Google Sheets. Actual requests are queued for owner follow-up and one initial Telegram notification; delivery failure is visible rather than presented as success. This feature does not migrate the remaining athlete/admin APIs or automatically activate paid plans.
