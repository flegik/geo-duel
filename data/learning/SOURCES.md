# Country facts

Country attributes: https://github.com/mledoze/countries (ODbL-1.0; derived country database under the same license, attribution required).
Capitals are included only when matched against uppercase capital-city entries in UN Demographic Yearbook 2024 table 8: https://unstats.un.org/unsd/demographic-social/products/dyb/documents/DYB2024/table08.xls . Complex/transition/disputed cases excluded rather than treated as single unqualified capitals. German city spellings are explicitly mapped in the preparation script. Borders from the community source are NOT trusted without separate geometric validation; known India–Sri Lanka sea adjacency is not a land boundary.

Fetched 2026-11-10. Source hashes:
- country-facts.json: SHA-256 0d92fb23b43ae080bd439f5dc5d61a8845395fdd0af1479b433c59fe079bd6fd
- un-capitals.xls: SHA-256 0c6784df022e1c8b167ad2ff344665ed9d6adf4726efa968ab422b31ae3cd41a

## UNESCO site metadata
Official UNESCO World Heritage dataset: https://data.unesco.org/explore/dataset/whc001/ . Retrieved 2026-11-10, SHA-256 6196d8c571e9a07c8987368e4a64f5af2dd8cc0038fcd8f52f990c2d8dd78c83. Only factual site names, list IDs, inscription year and single-country attribution retained. Transboundary sites excluded. No photos or copyrighted descriptive text copied. New text questions intentionally have no unlicensed image. Existing original CC0 illustrations retained only with the same site.

## Border audit and generation

`borders-audit.json` admits a positive boundary only when the country database agrees in both directions and Natural Earth polygons share a line. The union of reported and mapped neighbors blocks false alternatives. Maritime contacts and point contacts are not admitted. Countries with sensitive overseas/disputed boundary definitions are conservatively excluded from these questions. This is an educational map convention, not a legal border determination.

## Reproduction

Install `scripts/requirements-learning.txt` plus GDAL. Download the cited source files, then run `prepare-learning-facts.py`, `prepare-borders.py`, `prepare-unesco.py`, and `build-pool.py <category>` from the repository root. `world-review.json` retains reviewed distractors/explanations for the existing physical-geography subjects. All generators use stable hashing/shuffling; no network requests occur during pool generation or the app build.

The derived country attribute database is offered under ODbL 1.0: https://opendatacommons.org/licenses/odbl/1-0/ . Natural Earth geometries remain Public Domain. Site names and country attribution are factual metadata; UNESCO photos/descriptive paragraphs are not redistributed.
