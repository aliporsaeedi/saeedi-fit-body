# Saeedi Fit Body: direct Lovable UI port

This supersedes the earlier approximation in ReferenceDesign.html for the default athlete route. The actual React screens and components were copied from the user's connected Lovable project, not re-created from a screenshot.

Reference project: `907a0a70-1aca-4a5c-8c6a-bee97bcaee2b`. Athlete components are unchanged upstream between source commits `7dc9162a24570c6fb3efea5f6a8e14d91997d445` and `c3d744f816eec0dd1579ccc3c4cc96457eb7dae8`; the latter's complete stylesheet is used. Source hashes, preserved literal layout classes and intentional adaptations are recorded in `design/lovable-ui/REFERENCE.json`.

## Delivered UI

The same login, home, workout/day list, exercise sheet, nutrition, food search/barcode sheet, progress, profile/more, membership/payment steps, coach chat, AI screen and shared controls are compiled into LovableApp.html. Original Tailwind tokens, spacing, typography, glass surfaces, navigation, transitions, count-up numbers, modals and button effects are retained. Fonts are embedded WOFF2 assets, with OFL licenses already in design/.

Explicit pre-existing requirements take precedence over the reference: the actual official SVG badge is used; all eight theme IDs and a theme sheet are retained; Persian/Arabic digits in displayed React text become English digits through one JSX runtime adapter. That adapter changes children for display, not program names/IDs in API arguments, input values or stored records.

The default Apps Script athlete route serves LovableApp. The existing classic app remains at `?classic=1` for the reference's classic-only features. The admin portal remains its separate `?page=admin` route. Its administration code is not bundled into the new athlete UI. This port does not claim a new admin redesign, independent offline mode, OTP, Cloudflare hosting or domain migration.

## Live data and compatibility

The React `gas()` adapter calls the original authenticated google.script.run functions; it does not call the Lovable Supabase database. Accounts and Sheet records stay with the existing Apps Script app. All 27 RPC functions used by the imported screens have actual server definitions. LovableBridge adds own-payment history, coupon preview, barcode lookup and an adapter for the already configured Apps Script AI provider. No Lovable gateway key or Google credentials are copied into browser code.

AI uses existing configuration, enablement, entitlement and daily quota. If the provider is not configured, the reference screen shows that state. A live paid model call was not performed. Goals use the app's existing Properties mechanism; model context follows the existing AI_SEND_CONTEXT setting. The original -1 unlimited entitlement is recognized consistently as enabled, rather than incorrectly locked.

Small correctness adaptations accompany the port: a first-time account starts at day 1; plan/day preferences are account-scoped; explicit zero rest stays zero; exercise-history responses cannot replace a newer exercise or edited inputs; receipt upload failure aborts payment creation; water uses absolute setWater requests; failed optimistic changes refresh from the server; completion feedback waits for save success; bootstrap refreshes its day key at midnight. Existing worksheet media entitlements are applied to workout media before returning bootstrap. Runtime errors use the existing redacted error-report pipeline, capped per page.

## Verification

- The existing regression suite and two new test files pass (18 test files total).
- Reference-fidelity tests verify the exact source stylesheet hash and preservation of every original literal className attribute from imported athlete components, except the explicitly replaced official logo component.
- Real React rendering tests exercise all eight main/login/subpage views with isolated fixtures and prove English display numbers and absence of admin navigation for an athlete.
- RPC tests exercise real adapter success/error propagation, classic-link destinations, endpoint availability, own-account AI state/goals/history and failed receipt handling with mocks.
- Source classes and stylesheet checks are code evidence, not a full pixel-comparison claim.
- In the review deployment @546, browser inspection with an already signed-in athlete confirmed real home data, workout/day switching and assigned movement list, the exercise sheet and real movement image, profile, nutrition, progress and membership state/packages/payment history. No test exercise set, water log, meal, message, payment or AI request was submitted. Numeric count-up animations were allowed to finish before assessing values.
- Subsequent minor changes update unused upstream story CSS tokens, logo aspect ratio, English text rendering and redacted RPC-error reporting. Their rendering/contract tests pass and they are included in the final @547 deployment.

## Publication and artifact verification

The review deployment and the existing primary deployment both point to version **547**. Primary URL: `https://script.google.com/macros/s/AKfycbzFoSJEDDO2aZ2uzlha1heDAa-0wS5P-2ue4qlBUkWYXlC48poJuOsUchfZz589fNFG/exec`. Existing primary deployment permissions and address are retained. Previous primary version for rollback: **538**.

Both the main athlete route and separate `?page=admin` route returned HTTP 200 without a reported server syntax/HtmlService error. The main response contains the React mount and current stylesheet; the admin response has admin markup and no athlete React mount. After decoding Google's outer HTML/JavaScript string escapes, the primary response's embedded client base64 matches the built local client **exactly** (765456 base64 characters). An initial naive base64 scan did not account for Google's escaped slashes; that comparison was inconclusive, not evidence of a stale deployment. The corrected comparison passed.

The browser also showed a working pink/light theme after a user theme change; no theme preference was overwritten during final publication. Sending a live coach/AI message, uploading a receipt, writing exercise sets and every deep classic workflow were not tested against real data during this release. Those functional limits do not change the direct-source UI fidelity checks. No remote Lovable project files or Supabase records were edited by this port.

Install the UI build dependencies with `npm ci --prefix design/lovable-ui --ignore-scripts`. Build with `npm run build:lovable`; run regression checks with `npm test`. The generated HTML embeds the client script as base64 to avoid HtmlService parsing failures. Tests, dependencies, source snapshots and build tools are excluded from clasp uploads; only the 33 runtime files are uploaded.


## Subsequent requested experience changes

See ATHLETE-EXPERIENCE-RELEASE.md for the 2026-11-13 follow-up release. Its explicit design overrides, restored new-UI features, tests and verification limits supersede the unchanged-layout claim for those redesigned components. The original import provenance above is retained.
