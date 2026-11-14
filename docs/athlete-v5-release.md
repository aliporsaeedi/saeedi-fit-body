# Athlete v5

The main navigation is Home, Training, Nutrition, Supplements and More. Progress is under More. Coach management remains in the separate admin portal; there is no management shortcut in the athlete menu.

Home focuses on the next assigned session, one water entry, recovery check-in and coach contact. Nutrition separates the assigned plan from the food log and displays one meal option at a time. Supplement schedules use one representation of the assigned data, grouped by timing. All eight existing themes remain available.

The receipt editor keeps photo, design and statistics in separate sheets. Five visibly different canvas templates support FHD, QHD, 4K, post and square exports, with original English motivational caption presets. Photos stay local. Saved exercise sets, actual session time and explicitly labelled calorie estimates retain their existing provenance rules.

The avatar editor is a customizable SVG illustration adapted from the supplied pack. It saves only validated traits to the owner's `SF_Avatars` row with revision conflict protection. Photo color sampling stays local. It does not claim AI facial reconstruction or a rigged 3D mesh.

## Nutrition repair

The authorized repair retained all four assigned program names and all 105 source descriptions. Original records were backed up in `SF_DietRepairBackups` before mutation. `SF_Diets` gained `NutritionJSON`, `MacroStatus`, `OriginalNutritionJSON` and `SectionMode`. Results: 51 reference estimates, 43 instructional rows and 11 rows still needing ingredient or product clarification. Unknown portions never become false zero-calorie complete meals.

Reference estimates record individual ingredient IDs, grams, assumptions and known nutrient subtotals. Selected substitutes are examples, not simultaneous foods. Conditional guidance remains visible. Explicit weekly frequencies seed editable shopping allocations; optional meals default to zero and notes are not daily food. This is quantity accounting for the existing prescription, not a new dietary recommendation.

Admin → Programs → Nutrition ingredients provides ingredient selection, gram correction, live recalculation and revision-checked saving with a prior-record backup. Unrelated edits preserve reconciled ingredients; changed prescriptions require review again. PDF output labels estimates and does not sum all meal alternatives into a claimed daily calorie total.

The native preview database's four diet documents were also synchronized with independent backups and exact readback. The production app still uses the existing Google backend bridge. This release does not complete backend migration or OTP activation.

## Verification

- Full repository regression suite passed; targeted nutrition and avatar tests cover ownership, reference portions, unknown data, alternatives, weekly allocation, optimistic concurrency and backups.
- All 105 written Sheet rows were read back exactly; names, descriptions and original records were checked. The signed deployed source read matched them.
- Four native diet programs were backed up, updated with compare-and-swap and read back exactly.
- Browser checks at 320, 390 and 430 px found no horizontal page overflow. Primary content was shortened without hiding long details; additional details remain available in sheets.
- Admin ingredient editing was exercised at 390 and 1440 px against a synthetic API, including live macro recalculation and the exact revision save contract.
- Canvas tests generated all five export sizes and confirmed that all five templates render distinct PNG images.

Private source snapshots, mutation receipts and database backup records are outside Git. Application rollback alone does not undo normalized source data; retain the backup rows when rolling back code.
