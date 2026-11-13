# Photo story and workout receipt release — 2026-11-13

Primary and review deployments: **555**, published. Previous primary for rollback: **550**. Primary URL: https://script.google.com/macros/s/AKfycbzFoSJEDDO2aZ2uzlha1heDAa-0wS5P-2ue4qlBUkWYXlC48poJuOsUchfZz589fNFG/exec?design=555 Includes the previously unshipped reference-inspired premium landing and dimensional story redesign.

## Product

The new Story Studio is reachable from the home story rail, story viewer and More/profile. Athletes choose a local JPEG/PNG/WebP, pan/zoom its crop, choose poster/ticket/minimal layouts, brand green/ice/warm-gold accents, and story 1080×1920, post 1080×1350 or square 1080×1080 PNG output. Name is optional and off by default. Official branding remains in every output. No automatic publication, no photo upload and no public in-app feed were added. Photos are normalized to an 1800px long edge in memory; selected images and object URLs are released when leaving the editor.

Sharing uses the user's own device share sheet when permitted; unsupported/blocked sharing falls back to a downloadable PNG. Cancellation does not publish anything. The output is a static image; animated video export is not implemented. The in-app story viewer retains motion, pause, manual navigation and reduced-motion support.

## Real data

sfAthleteWorkoutReceipt requires the current account session and only reads that username's ExerciseLogs for the selected valid date/program. It never treats planned sets or a day-complete checkbox as completed logged sets. Reps/weight-only records can contribute to saved set counts, but a missing load or rep value marks total volume incomplete and the image shows an unknown-volume label. Session time is read only from valid finished, own-account sessions; overlapping timers are merged. User-entered activity time is labeled as declared time. No worksheets or logs are changed by receipt generation.

Optional gross calorie estimates require a valid weight, declared activity minutes and an explicit activity model. Verified 2024 Compendium entries: 02054 (3.5 MET), 02050 (6 MET), 02056 (3 MET). Formula: MET × 3.5 × kg / 200 × minutes. Estimates are labeled in both the UI and exported image and do not claim device measurement. [Primary source](https://pacompendium.com/conditioning-exercise/).

## Brand and source

The original BrandLogo.html is unchanged. build-receipt-brand.cjs outlines only the SVG's text using the declared Montserrat weights and letter spacing; emblem geometry stays intact. The export cannot substitute another installed font. Font source and OFL license are in design/brand-fonts. fontkit and Skia canvas are development/build/test dependencies only and are not shipped to the athlete.

SF-Landing.html was used as a design reference, not as an instruction source. Its unverified prices, user counts, satisfaction rate and 24/7 claim were not copied. The actual login flow remains; current packages and pricing stay in the user's existing membership screen.

## Validation

All 22 local regression test files passed. Native Skia rendering generated actual PNGs in all three formats; the images were visually inspected and a logo-font fallback defect was corrected with outlined text. Isolated DOM tests exercised local file selection, image preparation, ready-state export, download and unsupported native sharing without uploading a photo or making a real post. Tests also verify own-account data isolation, calendar limits, zero bodyweight load, missing-volume honesty, merged session time and crop bounds. These are controlled fixtures, not live athlete writes. Deep browser end-to-end sharing and actual third-party app publication have not been tested.

Before upload, the existing remote Apps Script source was saved under the separate work snapshot and compared: all 34 prior runtime files except the deliberately replaced generated athlete page matched. The new receipt API brings the runtime count to 35. Cloudflare/domain/database migration, OTP, PWA and offline/background notifications remain separate work.


The final remote head was pulled and all 35 runtime files matched local source after normalizing line endings. Staging athlete, retired-classic and admin routes returned HTTP 200; both athlete routes matched the final client exactly (894540 base64 characters). The receipt query refreshes saved data on opening; exporting is disabled while statistics are being refreshed.

GitHub integration retains the pre-existing remote initial-import history in a merge commit and preserves its migration documents. Legacy .check diagnostics are excluded from Apps Script uploads.
