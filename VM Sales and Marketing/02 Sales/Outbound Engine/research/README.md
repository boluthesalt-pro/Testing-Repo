# Outbound Engine research

This folder holds the research behind the 10 `prospects.pdf` files. The PDFs are generated from the files here, so the data lives here and the PDFs are only a view of it.

## Files

| File | What it is |
| --- | --- |
| `prospects-original.json` | The 500 rows extracted from the old `prospects.pdf` files before they were replaced. It is kept for reference only. Its emails and Instagram handles are not used, because most emails were guesses and many handles were corrupted. |
| `results.jsonl` | Research records, one per line, keyed by vertical (`v`) and row (`n`). Each record has named contacts with role and source URL, an optional verified general email with its source, and a note. If a row appears more than once, the last line wins. |
| `legacy/` | Put the JSON files from the earlier research run here (see below). This folder does not exist yet. |
| `build.py` | Merges everything and regenerates the 10 PDFs and the three CSVs. Run `python3 build.py`, which needs `reportlab`. |
| `master-prospects.csv` | Every row and every contact, one line per contact, with a LinkedIn search link. Use this for a CRM or a mail-merge tool. |
| `lookup-needed.csv` | 191 named contacts at real, in-scope companies that still need a verified personal email from Hunter or Apollo. |
| `coverage.csv` | Research status per vertical. |
| `add.py` | Appends records to `results.jsonl`. |

## Rules the data follows

- Nothing is guessed. A name appears only when a source URL names that person in that role at that company.
- An email appears only when it was found published. Every verified email is a general address. No personal director or marketing-head email was found in public sources for any company.
- Rows that could not be matched to a real business are tinted red and flagged. They stay in the sheet so the numbering still matches the outreach copy.
- Same-company duplicates are marked and point to the row to contact. Revolution Plus (04/5) and RevolutionPlus Property (04/50) are merged into 04/5.
- Instagram handles were dropped from the new sheets. About 40 contained a stray string ("aborian"), and the rest were never verified.

## Status on 10 October 2026

| Vertical | Researched | Named contact | Not matched | Not Nigerian | Duplicate |
| --- | --- | --- | --- | --- | --- |
| 01 Fashion | 50 of 50 | 47 | 3 | 1 | 0 |
| 02 Beauty | 50 of 50 | 25 | 18 | 10 | 2 |
| 03 Food & Beverage | 50 of 50 | 40 | 8 | 0 | 4 |
| 04 Real Estate | 50 of 50 | 37 | 9 | 1 | 2 |
| 05 Hospitality | 15 of 50 | 13 | 0 | 0 | 3 |
| 06 Tech | 2 of 50 | 1 | 0 | 0 | 1 |
| 07 Fintech | 0 of 50 | 0 | 0 | 0 | 8 |
| 08 Health | 9 of 50 | 2 | 6 | 0 | 3 |
| 09 Entertainment | 1 of 50 | 1 | 0 | 0 | 1 |
| 10 Education | 0 of 50 | 0 | 0 | 0 | 2 |

The 07 duplicates are fintechs that also appear in 06, plus TeamApt, which is Moniepoint.

This pass researched verticals 01 to 04 in full and started 05. It stopped at row 05/11 when the session's 200-search limit ran out. The earlier run covered parts of 03, 04, 05, 06, 08, 09 and 10. Once its JSON files are copied into `legacy/`, coverage of 05 to 10 will rise.

## Merging the earlier research run

The earlier run saved one JSON file per vertical in a temporary folder on your Mac:

```
/private/tmp/claude-501/-Users-boluwatife-Desktop-PROJECTS-02-VISIOMINDS/494ac6ef-372a-4eaa-8deb-a952af171b57/scratchpad/research/
```

macOS clears that folder on restart, so copy it soon. On your Mac, run:

```
mkdir -p "<repo>/VM Sales and Marketing/02 Sales/Outbound Engine/research/legacy"
cp /private/tmp/claude-501/-Users-boluwatife-Desktop-PROJECTS-02-VISIOMINDS/494ac6ef-372a-4eaa-8deb-a952af171b57/scratchpad/research/*.json "<repo>/VM Sales and Marketing/02 Sales/Outbound Engine/research/legacy/"
cd "<repo>/VM Sales and Marketing/02 Sales/Outbound Engine/research" && python3 build.py
```

Each file name must start with its two-digit vertical number, for example `05-hospitality-events.json`. Records are matched to rows by company name. Where both runs found a contact, the contacts are combined, and this pass's values win where the two conflict.

## What is left

1. Research the 274 rows still marked "Not yet researched". These are most of 05 to 10, starting at 05/12 (Hard Rock Cafe Lagos). Each new session can run about 200 searches, which covers about 190 rows.
2. Copy the earlier run's JSON into `legacy/` and run `build.py`. This should fill in many of the 05 to 10 gaps without new searches.
3. Run `lookup-needed.csv` through Hunter or Apollo (see below).
4. Decide what to do with the 44 unmatched rows and 12 non-Nigerian rows. They can be replaced with real companies, or dropped so each vertical goes below 50.

## Getting verified personal emails

Public search finds names and roles, but almost never personal emails. To get them:

1. Upload `lookup-needed.csv` to Hunter (Bulk Email Finder) or Apollo (People search with CSV import). Both need the company domain. The `domain` column is filled only where a domain was confirmed, so add the rest from each company's website first.
2. Send only to addresses the tool marks as verified or deliverable. Treat "accept-all" or "risky" results as unverified.
3. Start with contacts whose source is from 2023 or later. Several sources date from 2013 to 2018 and are flagged in the note column, so confirm those people are still in the role on LinkedIn before sending.
4. Rows marked "low" priority are local offices of global brands or government bodies. Brand decisions there sit abroad or go through procurement, so they are unlikely to buy a Visio Rebuild or Sprint.

## Risk flags found during research

- 04/1 Sujimoto: Wikipedia reports that the EFCC declared the CEO wanted in September 2025 over alleged diversion of funds.
- 01/37 Grey Projects closed in 2019. Its co-founder now runs Dye Lab.
- 03/4 Cafe Neo is listed by CB Insights as having ceased operations.
- 03/14 FoodCourt may have suspended operations in 2026, per a single unverified source.
