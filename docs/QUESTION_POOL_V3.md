# Question pool v3 / PWA 0.5.0

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
