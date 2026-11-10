# Question pool v3 / PWA 0.5.1

## Intended active pool

| Category | Questions | Coverage / source |
|---|---:|---|
| Flags | 585 unchanged | 195 countries, original registry and assets |
| Capitals | 264 | 132 unambiguous capital pairs, both directions, UN DYB 2024 cross-check |
| Silhouettes | 195 | Shared Natural Earth atlas geometry, native aspect ratio |
| Maps | 195 | Shared atlas, regional viewport and microstate locator |
| Borders | 294 | Mutual country records plus shared mapped land boundary; conservative exclusions |
| Landmarks | 120 | 30 retained original CC0 illustrations; 90 sourced UNESCO text questions |
| World knowledge | 150 | 30 improved existing physical-geography questions; 40 UNESCO nature-region locations; 40 relative total-area questions; 20 landlocked-country and 20 continent questions |
| **Total** | **1,803** | **1,218 revised/new nonflag questions** |

The original 210 JSON question records remain unchanged. The original 180 nonflag IDs are retained on the server for historical/active duels and disabled only for future selection. The existing 30 historical flag rows and 585 active flag variants are untouched.

## Scope and qualifications

- Capitals with multiple functions, contested designations or transitions are excluded from unqualified questions (including ZA/LK/BO/CH/NL/IL/PS/ID/GQ).
- New UNESCO names retain their official English proper names, inside German prompts/explanations. No licensed photos were assumed: 90 new landmarks intentionally use text. Additional landmark photography is not supplied.
- Shape confusion groups are educational curation, supplemented by aspect-ratio/regional ranking. Natural Earth map boundaries are a cartographic convention.
- Area questions use total area including inland water, avoid small numerical ties and exclude sensitive territorial cases. The country database is attributed under ODbL 1.0.
- World knowledge is expanded through documented topic families, not a claim of exhaustive river/mountain/lake coverage.
- Server answers remain authoritative; option order is stored once per match. New question IDs are opaque hashes. Client media does not contain the answer in its alternative text.
- Optional category selection is additive; old clients/default rooms keep four random categories. A single-category duel is supported. Existing selected questions, answers, scores, histories and profiles are not rewritten.
- Solo rounds prioritize unseen learning subjects before difficulty targets. Multiplayer balances difficulty and considers both participants' recorded history. Limited easy subject pools can necessarily recycle before the larger hard pool.

## Verification and rollout

See final execution record below (to be completed after production checks). `npm test` covers 41 tests including source/coverage/legacy invariants, scoring/idempotence, repeated subjects, preview selection and map viewport regression checks. Browser QA checks actual question rendering and feedback persistence; physical iOS/Android devices are not available in this environment.

Migrations stage data disabled, verify completeness, and activate only after the compatible frontend has been published. No profile/history deletion, answer updates or flag edits are included.

## Landmark content review

Nine UNESCO prompts containing an obvious country name were replaced with different sourced sites. Their original IDs/content remain stored disabled for any duels already using them. The 111 retained landmark questions were compared byte-for-byte at field level; they were not rewritten. The active landmark count stays 120.

## Executed production rollout — 2026-11-10

Applied migrations, in server-recorded order:

1. `20261110184919_question_pool_v3_support.sql` — optional category selection; old rooms/default clients retain their four-category behavior; recorded-room category count drives totals.
2. `20261110185002_question_pool_v3_seed_capitals.sql` — 264 rows staged disabled.
3. `20261110185010_question_pool_v3_seed_silhouettes.sql` — 195 rows staged disabled.
4. `20261110185019_question_pool_v3_seed_maps.sql` — 195 rows staged disabled.
5. `20261110185028_question_pool_v3_seed_borders.sql` — 294 rows staged disabled.
6. `20261110185036_question_pool_v3_seed_landmarks.sql` — 120 rows staged disabled.
7. `20261110185049_question_pool_v3_seed_world.sql` — 150 rows staged disabled.
8. `20261110185754_question_pool_v3_activate.sql` — after frontend publication/browser check, enabled 1,218 nonflag questions and disabled precisely the 180 historical nonflag IDs, retaining their content.
9. `20261110190713_question_pool_v3_landmark_review.sql` — after the corrective frontend publication, inserted nine replacements under new IDs and retired nine country-revealing prompts. No existing question content was updated.

The initial capital seed attempt was rolled back because `subject_key` is generated. The corrected insert omits that column and lets the existing expression derive it. An unrelated CLI telemetry request was rejected by automatic review; remaining SQL preparation ran offline and migrations used the connected Supabase tool.

### Publication

- PWA 0.5.0: existing Sites project, hosting version 11, source `bc13f136e82dfa49ee665be81df8a35927f1bb8b`.
- Final PWA **0.5.1**: same project, hosting version **12**, source `5d8e8b7fb5a78512c2b2c09353953c3989f016dd`.
- Public URL unchanged: https://geoduel-flegik.flegik.chatgpt.site
- No APK, new Site, logo change or data reset.

### Tests actually completed

- `npm test`: **42 passed**; TypeScript check passed. Production builds succeeded for both published releases. Vite reports large bundle-size warnings; all relevant chunks remain below the configured PWA cache size limit.
- All six staged server packages were compared field-for-field to source, zero mismatches. Final 120 active landmark records were compared again after the content review: zero mismatches.
- Independent spherical-polygon area ranking agreed with all **40** total-area comparisons. See `QUESTION_POOL_AREA_AUDIT.json`.
- **Eight complete production duels** using two independent anonymous guests: four random categories, then each of the seven categories alone. **66 player answers**, identical question/media/option order, correct 1/2/3 scoring, incorrect answers zero, repeated answer idempotency, hidden opponent scores, restored session feedback, reviews/results/stats, host-only configuration and invalid-category rejection.
- **One further complete production landmark duel** after the review using a new independent guest pair: **6 player answers**, same checks. See `QUESTION_POOL_MULTIPLAYER_TEST.json` and `QUESTION_POOL_REVIEW_TEST.json`. Reports contain room/question IDs, no tokens.
- Live Chrome browser: new regional map question, correct answer, preview of a different country with unchanged score; feedback retained after reload. A complete 12-question map round was finished during the update check.
- Actual two-release PWA update: 0.5.0 detected 0.5.1; update button remained disabled while the round was open; after completion the update reloaded normally. Settings then showed **0.5.1**, and the completed local record remained **12 questions, 5/24 points, 2 correct**. No storage clearing/reinstallation.
- Existing profile rows, all 615 flag rows including activation state, and all 795 preexisting question contents match before/after hashes. Historical original 180 nonflag rows remain disabled; nine reviewed v3 rows remain disabled. Active total **1,803**, stored total **2,022**. See `QUESTION_POOL_DB_AUDIT.json`.
- Live traffic continued during rollout, so global room/answer hashes changed through real gameplay and QA. Migrations do not delete or rewrite profiles, participants, match questions or answers. Test profiles/results were retained, not deleted.
- Physical Android/iPhone testing was **not available**; no claim of device-specific certification. Ninety additional landmark questions intentionally remain text-only. Official UNESCO proper names are retained in English within German prompts.
