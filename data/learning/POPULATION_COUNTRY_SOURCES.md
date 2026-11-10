# Country population evidence for GeoDuel

Extracted **195/195 existing flag-register countries**, no invented population values. `countries-population-2025.json` has a single global definition/source/year and ISO-keyed values in persons. Suggested 60 familiar question subjects are a separate ISO list; German labels remain authoritative in the existing registry. `country-audit.csv` is a review aid with source value in thousands and derived persons.

## Authoritative original sources

- Official catalogue (downloaded): https://population.un.org/wpp/assets/downloads.json
- UN WPP2024 medium bulk CSV: https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/CSV_FILES/WPP2024_Demographic_Indicators_Medium.csv.gz
- UN indicator/unit notes: https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/CSV_FILES/WPP2024_Demographic_Indicators_notes.csv
- Official interim update (19 January 2026): https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/WPP2024_CSV_files_update.zip
- UNdata confirms WPP2024 estimates run 1950–2023 and projections 2024–2100: https://data.un.org/Data.aspx?c=2%2C4%2C6%2C7&d=PopDiv&f=variableID%3A12%3BtimeID%3A85%3BvarID%3A2&s=_crEngNameOrderBy%3Aasc%2C_timeEngNameOrderBy%3Adesc%2C_varEngNameOrderBy%3Aasc&v=1
- UNdata Togo confirmation of update and rounded 2025 8,592 thousand: https://data.un.org/en/iso/TG.html

## Exact definition

`TPopulation1July`, both sexes combined, all ages, on **1 July 2025**, WPP2024 **Medium projection**. Source units thousands. Decimal source value multiplied by 1000 exactly (Python Decimal), yielding integer modeled persons. These are projections, not observed 2025 census populations. Questions should say `laut UN-Projektion für 2025` / `1. Juli 2025` and round displayed values sensibly. All alternatives in a comparison must use this same source/date/definition. Countries/areas follow UN delineations, not an independently inferred boundary sum.

## Reproduction and licence

`python prepare.py` processes downloaded raw files, applies the official Togo update over baseline rows, and verifies all 195 ISO codes are present and source decimals convert exactly. SHA-256 hashes are embedded in the JSON. CC BY 3.0 IGO is explicitly documented in the downloaded official catalogue Footer. Keep attribution: United Nations, Department of Economic and Social Affairs, Population Division (2024). World Population Prospects 2024, Online Edition.

Do not commit the 16 MB raw CSV into the PWA. The compact extract plus preparation script, exact original URLs/hashes and attribution are sufficient for traceability and later reproducible updates.
