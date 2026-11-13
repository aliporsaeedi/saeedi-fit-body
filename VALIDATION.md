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

Production welcome inspection caught Apps Script filtering out the :has selector used to release the desktop frame. Replaced it with an explicit sf-login-mode body class, added on login and removed on authenticated render. This avoids unsupported CSS and keeps athlete-app framing separate from the welcome page.

## Athlete journey follow-up @536
User signed into a real athlete account. Confirmed original assigned program names, home session title and working coach-recommendations route. Workout now renders only the selected day, retains the existing day preference and preserves exercise keys/log bindings; modern structured programs no longer render an additional legacy program list below them. Home subscription card moved below the next-session/daily content so the workout action comes first. No exercise, water or message was saved during UI smoke testing.

Final athlete smoke evidence: selected day 2 and observed exactly one day heading with 13 movements; restored the user's day 3 selection and observed home title update to session 3 with 11 movements. Coach-note route opened as the athlete. Desktop welcome at full width and compact single-column welcome were inspected after the explicit login-class fix. Distinct legacy programs are retained; only exact same-name modern/legacy views are suppressed. Late-bootstrap notice now says loading is still in progress and is removed on root render; delayed-render fixture passes. All 12 test files passed. Full app cleanup, migration, OTP and standalone offline installation remain separate work; existing legacy management functions still require later extraction.

Production @538 final check: athlete home loaded directly after reload, displayed the selected third session with 11 movements and preserved original program names. No stale failure notice remained. Login was completed by the user; no credentials were read or stored by this work. Git checkpoint includes all published source changes.

## Reference implementation review, 2026-11-13
Production remains @538. Separate review deployment: AKfycbzO_LMU-DubcWtLc2ediWJJVO5lAHwPBQPoV0LzGq9MOJ8g8pYgviCHkDy2LwbVyxNs. Added reference-derived home/effects, nutrition macros, 8-week progress, WorkoutSessions and WellnessLogs. See REFERENCE-IMPLEMENTATION.md for coverage and limits. All 15 test files passed; server JavaScript and app/reference CSS parse. Session ownership/idempotency/schema mismatch and wellness own-day upsert/account isolation/input bounds/schema mismatch were tested in mocked sheets. No real athlete exercise or wellness test data was saved.

Browser evidence before control-tool removal: reference home with actual athlete data, effects loaded, quick-entry weight +5 updated the real weight input to 5 and rep 10 updated the real rep input to 10, without saving. Latest session/wellness/nutrition/progress changes have no completed visual acceptance because the browser-control tool was removed from this session. Do not label this as a complete production release or silently replace the main deployment.


## 2026-11-13 — full supplied HTML reference, review @543
Received complete 66 KB HTML and preserved it byte-for-byte as design/Final.original.txt. ReferenceDesign is generated from its original CSS, symbol and component structures, with demo state excluded. Shadow DOM prevents legacy global CSS and runtime style injectors from overriding the reference. Connected the five main pages and live session to existing athlete data/APIs. Deep account/payment/chat forms remain functional legacy views; do not claim every subpage is visually converted.

16 test files pass. DOM integration covers navigation, actual meal-form handler wiring, macro layout, heatmap, eight-week report, session start/log/finish, previous own weight prefilling, login-style cleanup and style isolation. Component CSS declarations are compared directly with the original source. Builds are reproducible, original attachment bytes match, scripts and real styles parse. Retired 9 old home functions/helpers. File-status check confirms only 31 runtime files are uploaded; source demo, build tools, dependency manifests and tests are excluded.

Uploaded and deployed only to the review deployment @543. Primary deployment stays @538. No real athlete exercise, water, message or wellness data was written during this turn. Browser control is unavailable; no pixel comparison or real-browser end-to-end acceptance of @543 is claimed. Three whitespace-only blank lines were cleaned after deployment; behavior is unchanged.
