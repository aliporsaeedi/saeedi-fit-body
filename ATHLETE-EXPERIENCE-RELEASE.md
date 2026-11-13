# Athlete experience release — 2026-11-13

Review and primary deployments: **549**, published and checked. Previous primary for rollback: **547**. Primary URL: https://script.google.com/macros/s/AKfycbzFoSJEDDO2aZ2uzlha1heDAa-0wS5P-2ue4qlBUkWYXlC48poJuOsUchfZz589fNFG/exec?design=549

The requested changes extend the imported Lovable UI. The upstream base stylesheet remains intact; explicit overrides are isolated in experience.css and the requested redesigned components.

## Implemented

- Branded static startup plus account-data loader: complete original SVG including the SAEEDI/FIT BODY wordmark, animated rings, energy bars and a CSS perspective stage. No fake progress or artificial wait. Reduced-motion support. A delayed network notice appears after 12 seconds.
- Responsive login/landing with formal Persian copy, actual product benefits and the existing account login. Header uses a time-appropriate formal greeting. The complete admin logo has a light backing so its original navy lettering stays readable.
- Movement guide is fetched on demand for an exercise in the current account's assigned plan. Exact bank names/IDs only, no fuzzy substitution. Instructions, tips, muscles, equipment and movement model are shown when recorded. Missing guides are labeled honestly. Compound legacy names get per-part tabs.
- Modern training blocks retain technique, group, peers, position and each movement's own rep/weight cells. Explicit zero rest survives even without a bank match. Superset/group rows share an accent and show position/size. Automatic rest begins after an independent movement or the last group member.
- Reminders, supplements and PDF are native new-UI pages under More. The old athlete full-version link is removed. classic=1 now serves the current UI; admin remains separately routed.
- Reminders read/write the existing own-account Reminders sheet and expose actual bot configuration/link state. The existing scheduler now handles saved vitamin/medicine, supplement and nutrition labels. Scheduler dedup tests use mocks; no real message was sent for QA.
- All assigned supplement plans retain schedules, groups, dosage, timing and coach instructions, including legacy item rows previously omitted by the new UI.
- Private PDF is built from exactly the selected resolved plan, including legacy plans, without selecting a different modern plan or creating a public Drive file. Client validates the PDF signature. Full original logo, coach notes, group metadata, prescribed set detail, food portions/macros and supplement instructions are included.
- All eight skins remain. Light, pink and day surfaces and text tokens were revised; measured normal text contrast for foreground, muted text, accent, gold, aqua and ember against all three surfaces is at least 4.5:1. Switching back to dark removes previous overrides.

## Verification and limits

All 20 local regression test files passed on the final source, including the PDF renderer and admin-logo changes. Tests cover actual server functions with isolated mocks, real React server rendering, private assigned-plan access, exact bank lookup, distinct group cells, zero values, PDF content escaping, scheduler labels/dedup and theme contrast/reset. All server JS parsed.

Browser observation on review 548 confirmed the branded loader, complete logo, real assigned home data, new More entries and grouped training rows. Further click actions were repeatedly refused by the desktop helper because user input was detected; a generated PDF download, guide details and live reminder save/send have not been verified end to end. No test workout, meal, water, payment, AI request or reminder was saved or sent.

Both staging and primary athlete, classic-retired and admin routes returned HTTP 200. The athlete and classic-retired embedded client matched the local build exactly (804032 base64 characters). The admin route remained separate and had no athlete React mount. An immediate first staging fetch still returned a previous artifact; a repeated fetch after propagation matched exactly, and final primary checks all passed.

Only runtime files are uploaded (34 files). Design source, build dependencies and tests are excluded. Media remains lazy; no full-bank fetch was added to bootstrap, no new third-party UI library, and no forced loading delay. Real-device performance measurement is still needed.

## Separate migration stage

Cloudflare/domain/database migration, OTP, installable standalone PWA, background push and offline synchronization are not implemented by this release. DNS and the live Sheet data have not been moved. Browser notifications are explicitly described as foreground-only and cannot request permission inside the current Google frame. Migration architecture and data reconciliation requirements are recorded in MIGRATION.md. Browser login is not treated as an API credential.
