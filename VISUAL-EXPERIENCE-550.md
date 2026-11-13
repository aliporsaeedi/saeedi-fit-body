# Visual experience release — 2026-11-13

Staging and primary: **550**, published. Rollback: **549**. Primary: https://script.google.com/macros/s/AKfycbzFoSJEDDO2aZ2uzlha1heDAa-0wS5P-2ue4qlBUkWYXlC48poJuOsUchfZz589fNFG/exec?design=550

The user's correction supersedes the opaque light logo backing in release 549.

- Official source SVG remains unchanged in BrandLogo.html. Athlete and admin views render it as transparent inline vector, adapt only the wordmark/caption color to the page, and remove unused outer whitespace while keeping the emblem and complete brand wording. Per-instance SVG IDs prevent gradient/mask collisions. Larger header, loader, landing and admin placements use restrained float, glow and pulse-line motion.
- Landing has three keyboard-accessible interactive feature tabs. Selecting one changes its description, included capabilities and vector graphic. Glass panels, perspective artwork and bounded entry/draw effects add depth; the login and account APIs remain the existing ones. No fabricated testimonials, success percentages or public user records.
- The existing profile photo is shown in the home header, the story entry and private story viewer. Missing or failed photos use a neutral profile icon. Other main pages keep the brand header. No photo is published or sent to another account.
- Personal stories have four real-account slides: overview, selected training day/completion, recorded food/water and latest valid weight/goal. The viewer supports previous/next, pause/resume, Escape, manual reduced-motion mode, swipe and a link to the relevant app section. Seven-second automatic progress pauses when the page is hidden; timers/frames clean up on close. Vector charts are explicitly illustrative.
- Reminders use app-shaped cards, type chips, an accessible enabled switch, custom title, time, daily/one-day mode and a clear dirty/save state. The real own-account save and bot-link APIs remain. Background push is still not enabled.
- Page transitions are 320ms; viewport metrics replay a bounded 650ms count toward the actual value and stop outside the viewport or when hidden. Screen readers receive the final value. Forms, prescriptions and stored data are unaffected by numeric animation.
- Admin has a unified adaptive dark/light visual layer across sidebar, hierarchy, dashboard, controls, tables, chat and modals. Two older visual override blocks were removed before adding the canonical layer. Full official animated logos are used in the login and sidebar. The obsolete external athlete link was removed. Existing widgets gained keyboard access. Admin view/count animations are bounded and respect reduced motion. Existing routes, permission checks, data and write logic remain.

## Evidence

All 21 regression test files passed. A new isolated DOM interaction test clicks feature tabs, opens/navigates/pauses/closes stories, saves a reminder enabled-state while preserving its title/time, checks unique SVG IDs, and verifies that viewport count animations cancel on exit/unmount. No live database writes or messages are made by this test. Real React rendering and existing account/data regression tests passed; admin inline scripts parse.

Staging athlete and retired classic routes match the local client exactly (836616 base64 characters). All three routes including admin returned HTTP 200; admin remains separate. The new features use existing data without adding bootstrap RPCs or production dependencies. Client JS is 627420 bytes before transport encoding, CSS 97205 bytes; real-device performance is not benchmarked.

Browser evidence: the public staging page opened in Edge InPrivate and rendered the complete transparent adaptive logo, new landing typography, feature tab panel and login form. The signed-in browser initially redirected to a Google /u/1 route and showed Google’s Page Not Found page; the exact canonical URL worked without that Google session. Further browser actions were interrupted by user input, then the review window was closed. Deep authenticated screens were tested with isolated DOM fixtures, not a new live login. No authentication UI was automated.

Cloudflare, DNS, database migration, OTP and offline/background notification work remain separate from this visual release.
