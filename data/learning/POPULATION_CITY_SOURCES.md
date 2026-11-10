# GeoDuel — City population source research

Prepared 2026-11-10. **No app, GitHub or database changes were made by this research task.**

## Authoritative numeric source

United Nations, Department of Economic and Social Affairs, Population Division (2025). *World Urbanization Prospects: The 2025 Revision*, Online Edition. File 21, `POP/DB/WUP/Rev.2025/F21`.

- Download page: https://population.un.org/wup/downloads?tab=Cities
- Official workbook: https://population.un.org/wup/assets/Download/Cities/WUP2025-F21-DEGURBA-Cities_Pop.xlsx
- Official full CSV crosscheck: https://population.un.org/wup/assets/Download/Cities/WUP2025-DB-DEGURBA-Cities-Population-Surface-Data.csv.gz
- Additional independent table-format crosscheck: https://population.un.org/wup/assets/Download/Cities/WUP2025-F19-DEGURBA-100_Largest_Cities_in_2025_by_time.xlsx
- Methodology: https://population.un.org/wup/assets/Publications/undesa_pd_2025_wup2025_methodological_report.pdf
- Definitions and cautions: https://population.un.org/wup/assets/Publications/undesa_pd_2025_faq_wup25.pdf
- License in official workbook: **CC BY 3.0 IGO**, https://creativecommons.org/licenses/by/3.0/igo/ . Credit UN DESA Population Division, WUP 2025. German display-name translations and the curated selection are GeoDuel adaptations.

## Definition: one consistent population concept

All selected numeric values describe an **urban centre under the harmonized UN Degree of Urbanization (DEGURBA) definition**, **mid-2025**. A city is delineated from spatially contiguous 1-km² population-grid cells meeting density criteria (at least 1,500 persons/km²) and at least 50,000 residents overall.

This is **not** the administrative municipality and **not** a metropolitan/commuter region. Connected settlements can form one urban centre, while lower-density suburbs can fall outside. Do not mix these values with municipal population, metropolitan population or the older WUP 2018 nationally defined agglomeration series.

The official WUP 2025 FAQ classifies 1950–2025 as the estimate period and later years through 2050 as projections. The 2025 values nevertheless rely on modelling of census/grid data; they are not exact headcounts from a single 2025 census. Metadata retains this as `modelled-estimate`.

Some numbers deliberately differ from familiar municipal or metro figures. For example the source gives Berlin 3,560,908; Tokyo 33,412,512; Jakarta 41,913,860; London 10,416,420. Rounded question wording **must explicitly say** "urbanes Zentrum nach UN-DEGURBA, Mitte 2025" and the explanation should distinguish it from city limits/metropolitan definitions.

## Files prepared

- `cities-2025.json`: compact, generator-ready source. 91 familiar cities with stable UN `City_Code`, country ISO2, German display name, untouched source name, exact population in persons, original value in thousands, workbook row/year-column, one population-definition ID, metadata and source hashes. Each city now includes the UN `populationPlausibility` class and `quizEligible`.
- `selected-cities.tsv`: curated stable `(ISO2, City_Code, German label)` keys. Values are never manually typed into the generator.
- `prepare_city_source.py`: reproducible extraction using `openpyxl` and exact `Decimal` ×1,000 conversion. Optional arguments: workbook, output JSON, reference year.
- `audit_csv.py`: checks every curated value against the full official CSV and incorporates the population-plausibility class. Optional arguments: source JSON, full CSV gzip.
- `city-csv-audit.json`: **91/91 exact matches, zero mismatches**; High 55, Moderate 34, Low 2.
- `city-source-crosscheck.json`: **48/48 overlapping top-100-city values exact, zero mismatches** against official File 19.

Raw workbook/CSV are scratch research inputs, not intended to be copied into the app bundle. Numeric extraction uses one central data file, so updates do not require hand-editing questions.

## Conservative quiz eligibility and comparison margins

Exclude **Perth** and **Accra** from automatic question generation because the official UN metadata classifies their 2025 population plausibility as **Low**. They remain in the research dataset with `quizEligible: false` for auditability. This leaves **89 eligible familiar cities**, more than sufficient for 60 city-related questions.

The original 91-city selection has 27 Europe, 27 Asia, 13 Africa, 11 North America, 7 South America, 6 Oceania, classified through the existing atlas by country ISO. Filtering Low leaves Africa 12 and Oceania 5, 89 total. This country-based grouping is suitable for selection weights; it is not a claim that every city (e.g. Istanbul) lies wholly on one physical continent.

For comparisons use substantial numerical gaps, especially for Moderate entries. A 20% minimum ratio to the nearest wrong answer is a conservative application rule, **not** a published UN confidence interval. Avoid comparisons of almost-equal city values, and compare only values from the same reference year and DEGURBA definition. For approximate questions use separated intervals/rounded orders of magnitude; never pretend model outputs are accurate to the last person.
