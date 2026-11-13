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

## 2026-11-13 — athlete application @533
Home redesigned around the next session, daily status and direct nutrition/coach actions. Added brand-led responsive welcome layout and reused the exact official logo asset instead of copying its SVG markup. Removed fake 3-sets-per-movement and estimated session-duration claims. Home now reads modern SF training plans before legacy plans and counts actual cells as one set per exercise/set, keeping multi-step cells from inflating volume. Corrected weekday initials. Login-only stylesheet is removed when rendering authenticated application to avoid its global rules leaking into themes. Existing 8 theme definitions preserved. New home fixtures verify modern/legacy/empty states and completion counts. No database migration, OTP, standalone PWA or domain changes in this increment.

Follow-up: restored athlete-only coach-note routes (previous guard redirected dietTip/workoutTip back home); modern workout coachNotes now join the recommendations. Fixed a cache/bootstrap installation race that could leave the old home renderer visible until a second navigation. Light theme and return to dark were tested in the live UI; the new coach shortcut opened the actual chat composer. Login layout is source-validated; authenticated session was retained, so a fresh login flow has not been smoke-tested in this increment.
