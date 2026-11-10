# Regional silhouette/context maps — PWA 0.5.2

Shared `AtlasGeography` now renders regional context for silhouette questions, map questions, answer previews and both atlas geography tabs. Legacy question media URLs resolve to the same registered country before rendering, so saved older rounds can use the new presentation too. No question records, scoring, profiles or backend migrations are changed.

## Camera selection

- Parse polygon rings from the existing atlas world paths. Normalize longitude to the shortest arc across the date line.
- Rank components by projected area, cluster nearby components using separate east/west and north/south thresholds. Remote islands/territories receive separate selectable regional views; microscopic offshore fragments do not create dozens of buttons.
- Fit each regional cluster with 1.65 times its extent (about 32.5% margin per side before aspect-ratio fitting), plus a minimum surrounding extent for small states. Portrait framing for tall shapes, landscape otherwise.
- Scale longitude by the cosine of the region's center latitude (bounded at 0.25 near the poles). This is an equirectangular regional approximation with local latitude correction, not a terrain/orthographic projection. North remains up. SVG preserves the camera aspect ratio.
- If the country occupies under 3.5% of the regional width, show a locator ring and a second close-up with actual surrounding land/water. The country itself is not artificially enlarged in the regional map.
- Neutral surrounding countries, mint target, subdued borders, blue water, no labels revealing a quiz answer. No invented relief. Existing coastlines/islands are reused. Added 336 major Natural Earth lakes/reservoirs, scale rank <=5, simplified at 0.015 degrees to remain suitable for offline/mobile delivery; source and checksum in `data/atlas/WATER_SOURCES.md`.

## Validation

45 automated tests pass; production build succeeds. Tests cover finite non-global views for all 195 countries, microstate context close-ups, Chile portrait framing, date-line islands, separate Kiribati/US regions, shared rendering, lake-layer validity and the existing scoring/history/flag invariants. The shared lazy geometry chunk remains below the existing 3 MB PWA precache limit.

Physical iOS/Android devices are unavailable. Browser checks cover Switzerland, Vatican City, Fiji, Chile, Nepal and the quiz/answer-preview path. Publication details and final live check are recorded after deployment.

## Published result

Released on the existing public site as **PWA 0.5.2 / hosting version 13**.
URL: https://geoduel-flegik.flegik.chatgpt.site
Hosting source: `a70448b2b4d50e479b96229b5c7dca981f4f000e`.
GitHub implementation checkpoint: `55d8e7a5d37e2961ee7c5223b1105aa5aac2113c`.

The hosting checkout ran all **45 tests**, TypeScript and production build successfully. A regular PWA update was applied in live Chrome. A live silhouette question correctly showed Poland highlighted with surrounding countries and Baltic coastline; choosing the correct answer awarded 2 points. Selecting Estonia afterward displayed Estonia's regional context with islands and water, while the saved score remained 2 points. Browser checks also covered the shared Atlas views for Switzerland, Vatican City, Fiji, Chile and Nepal before publication. No backend writes/migrations were performed in this change.

For sparse island states, a contextual closeup can also supplement the overview when the main island would otherwise be too small. Polar camera bounds stay within the geographic latitude range. Underlying microstate outlines are the existing generalized Natural Earth geometry, not cadastral borders. Terrain relief is intentionally omitted; water/land layers supply geographic orientation without adding speculative features.
