# Outbound Engine research

This folder holds the research behind the 10 `prospects.pdf` files. The PDFs are generated from the files here, so the data lives here and the PDFs are only a view of it.

## Files

| File | What it is |
| --- | --- |
| `prospects-original.json` | The 500 rows extracted from the old `prospects.pdf` files before they were replaced. It is kept for reference only. Its emails and Instagram handles are not used, because most emails were guesses and many handles were corrupted. |
| `linkedin.jsonl` | LinkedIn profiles found for named decision makers, one per line. A profile counts only when its title shows the person's name together with the company. |
| `results.jsonl` | Research records, one per line, keyed by vertical (`v`) and row (`n`). Each record has named contacts with role and source URL, an optional verified general email with its source, and a note. If a row appears more than once, the last line wins. |
| `legacy/` | Put the JSON files from the earlier research run here (see below). This folder does not exist yet. |
| `build.py` | Merges everything and regenerates the 10 PDFs and the three CSVs. Run `python3 build.py`, which needs `reportlab`. |
| `master-prospects.csv` | Every row and every contact, one line per contact, with a LinkedIn search link. Use this for a CRM or a mail-merge tool. |
| `lookup-needed.csv` | 320 named contacts at real, in-scope companies that still need a verified personal email from Hunter or Apollo. |
| `coverage.csv` | Research status per vertical. |
| `add.py` | Appends records to `results.jsonl`. |

## Rules the data follows

- Nothing is guessed. A name appears only when a source URL names that person in that role at that company.
- An email appears only when it was found published. Every verified email is a general address. No personal director or marketing-head email was found in public sources for any company.
- Rows that could not be matched to a real business are tinted red and flagged. They stay in the sheet so the numbering still matches the outreach copy.
- Same-company duplicates are marked and point to the row to contact. Revolution Plus (04/5) and RevolutionPlus Property (04/50) are merged into 04/5.
- Instagram handles were dropped from the new sheets. About 40 contained a stray string ("aborian"), and the rest were never verified.

## Status on 10 October 2026

| Vertical | Researched | Named contact | Personal LinkedIn profile | Not matched | Not Nigerian |
| --- | --- | --- | --- | --- | --- |
| 01 Fashion | 50 of 50 | 47 | 18 | 3 | 1 |
| 02 Beauty | 50 of 50 | 25 | 12 | 18 | 10 |
| 03 Food & Beverage | 50 of 50 | 40 | 24 | 8 | 0 |
| 04 Real Estate | 50 of 50 | 37 | 16 | 9 | 1 |
| 05 Hospitality | 22 of 50 | 19 | 8 | 0 | 0 |
| 06 Tech | 37 of 50 | 37 | 30 | 0 | 0 |
| 07 Fintech | 33 of 50 | 31 | 23 | 0 | 0 |
| 08 Health | 21 of 50 | 13 | 9 | 6 | 0 |
| 09 Entertainment | 23 of 50 | 20 | 17 | 0 | 0 |
| 10 Education | 20 of 50 | 18 | 15 | 0 | 0 |

In total, 172 companies have a decision maker with their own LinkedIn profile linked. Another 115 have a named decision maker without a confirmed profile. The PDF links each of those names to a LinkedIn people search, so the right profile is usually one click away. Both counts include duplicate rows.

Two research passes have run so far. Each stopped when the session's 200-search limit ran out.

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

1. Research the 144 rows still marked "Not yet researched". Most are hotels, venues and gyms in 05 and 08, plus some banks, insurers, schools and media brands in 07, 09 and 10. One more session of about 200 searches should cover them.
2. Copy the earlier run's JSON into `legacy/` and run `build.py`. This should fill in many of the 05 to 10 gaps without new searches.
3. Run `lookup-needed.csv` through Hunter or Apollo (see below).
4. Decide what to do with the 44 unmatched rows and 12 non-Nigerian rows. They can be replaced with real companies, or dropped so each vertical goes below 50.

## Getting verified personal emails

Public search finds names and roles, but almost never personal emails. To get them:

1. Where a contact has a `linkedin_profile`, open it with Apollo's or Hunter's Chrome extension, which can return a verified email straight from the profile. For the rest, upload `lookup-needed.csv` to Hunter (Bulk Email Finder) or Apollo (People search with CSV import). Both need the company domain. The `domain` column is filled only where a domain was confirmed, so add the rest from each company's website first.
2. Send only to addresses the tool marks as verified or deliverable. Treat "accept-all" or "risky" results as unverified.
3. Start with contacts whose source is from 2023 or later. Several sources date from 2013 to 2018 and are flagged in the note column, so confirm those people are still in the role on LinkedIn before sending.
4. Rows marked "low" priority are local offices of global brands or government bodies. Brand decisions there sit abroad or go through procurement, so they are unlikely to buy a Visio Rebuild or Sprint.

## Risk flags found during research

- 04/1 Sujimoto: Wikipedia reports that the EFCC declared the CEO wanted in September 2025 over alleged diversion of funds.
- 01/37 Grey Projects closed in 2019. Its co-founder now runs Dye Lab.
- 03/4 Cafe Neo is listed by CB Insights as having ceased operations.
- 03/14 FoodCourt may have suspended operations in 2026, per a single unverified source.
