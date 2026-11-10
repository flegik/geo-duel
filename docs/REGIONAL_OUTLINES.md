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
