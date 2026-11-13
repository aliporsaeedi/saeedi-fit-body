# Validation and deployment checkpoint

Current verified deployment: 525. This is a progress checkpoint, not final project completion.

Run from this directory with Node:

    node tests/test-program-studio.cjs
    node tests/test-anatomy.cjs
    node tests/test-bank-and-preview.cjs
    node tests/test-import.cjs
    node tests/test-schema.cjs
    node tests/test-athlete-separation.cjs
    node tests/test-error-redaction.cjs

After editing AppJs.html, run build-client.ps1 before uploading. AppBundle.html must contain its matching base64-encoded script. HtmlService cannot safely consume the raw client source as HTML.

Verified changes include library template snapshots/repair, real-set anatomy with separate secondary muscle counts, program metadata and batch editing, image source review records, official logo and preserved themes, obsolete client declaration cleanup, and removal of legacy management entry points from athlete navigation/chat.

Live data: all 32 vitamin/mineral photos are reviewed; 21/64 supplement photos are reviewed. Food photo review is incomplete. Local original 1323 GIFs decode successfully; older additional bank media still needs standardization.

Known remaining work: full legacy admin code extraction, comprehensive student account acceptance, food and remaining supplement photos, final report download validation, full visual redesign, and later Cloudflare/domain/database migration. Anatomy is a rotatable schematic, not a medical model. Missing goal/level/audience must be entered rather than fabricated.

## 2026-11-13 — priority correction
Food-photo work paused at user request. Draft builder now uses precise region/category metadata from bank responses and saved-plan exercise info, excludes cardio from resistance sets, keeps secondary volume separate, and explicitly reports missing mapping and cardio-method conflicts. Removed arbitrary set-count-based intensity recommendations. All 11 test files pass, including a new independent fixture covering compound blocks, cardio, secondary deduplication, missing mapping and conflicts. Production UI verification for this increment is pending; no student plan was changed by these tests.
Production @532 verified through the actual admin UI: added an unsaved dumbbell chest-press draft, selected pyramid (4 sets; 15,12,10,8; rest 120), then changed it to FST-7. Inputs changed to 7 sets, 10-12 and rest 35; direct chest volume changed immediately from 4 to 7, with secondary volume separately expandable. No student plan was saved. Dashboard loaded with actual student attendance data. This verifies this increment only, not complete admin acceptance.
