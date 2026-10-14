# Composer Catalog Data

Public composer catalog data for the konzert application.

## Directory Structure

- `xlsx/` - Source XLSX files (edit these in Excel or Google Sheets)
- `xlsx/stage works/` - Work-in-progress XLSX files; ignored by the converter,
  which only scans the top level of `xlsx/`
- `csv/` - Auto-generated CSV files (do not edit manually)
- `scripts/` - Conversion utilities

## Supported Catalog Systems

- **KV** - Mozart (Köchel-Verzeichnis)
- **TWV** - Telemann (Telemann-Werke-Verzeichnis)
- **RV** - Vivaldi (Ryom-Verzeichnis)
- **CPE** - C.P.E. Bach (Wotquenne/Helm catalog, includes Wq.)
- **BWV** - J.S. Bach (Bach-Werke-Verzeichnis)
- **HWV** - Handel (Händel-Werke-Verzeichnis)
- **Hob** - Haydn (Hoboken catalogue)
- **BuxWV** - Buxtehude (Buxtehude-Werke-Verzeichnis)
- **D.** - Schubert (Deutsch catalogue)
- **G.** - Boccherini (Gérard thematic catalogue)
- **GMW** - Mahler (Gustav-Mahler-Werke)
- **LWV** - Lully (Lully-Werke-Verzeichnis)
- **M.** - Ravel (Marnat thematic catalogue)
- **MWV** - Mendelssohn (Mendelssohn-Werke-Verzeichnis)
- **RCT** - Rameau (Rameau-Catalogue Thématique)
- **TH** - Tchaikovsky (Tchaikovsky Handbook)

Corelli and Shostakovich works are numbered by opus rather than a thematic
catalogue prefix. `composers.csv` is not a work catalogue — it is the composer
index (name, dates, era, nationalities, aliases) shared by all catalogs.

## Workflow

### Editing Data

1. Edit XLSX files in the `xlsx/` directory using Excel or Google Sheets
2. Double-click `commit-xlsx.bat` at the repository root
3. The script regenerates the affected CSVs, stages `xlsx/` and `csv/`, shows
   the staged files and asks for a commit message
4. Type your own message and press Enter, or press Enter again to accept the
   suggested one (`data: update Hob`); type `q` to abort without committing
5. The commit is pushed to `origin/main`, which triggers the GitHub Actions
   conversion; the konzert application then reads the new CSVs

`commit-xlsx.bat` only stages `xlsx/` and `csv/`; anything else you have edited
is listed at the end of the run and left untouched. If there is nothing new to
commit but commits are still unpushed, running it again pushes them.
If a GitHub Actions CSV-conversion commit reaches the remote first, the script
temporarily stashes any uncommitted work, rebases over that CSV-only commit,
restores the work, and retries the push. Other remote changes are reported for
manual synchronization rather than overwritten.

```bash
npm run commit:xlsx                        # commit (with prompt) and push
npm run commit:xlsx -- --no-push           # skip the push
npm run commit:xlsx -- --message "data: add Hob opus 108"
npm run commit:xlsx -- --ask               # force the prompt when piping input
```

To commit from a terminal without the batch file, use the npm script above.

### Local Testing

To test the conversion locally:

```bash
# Install dependencies
npm install

# Convert a specific file (path is relative to xlsx/)
npm run convert:csv Hob.xlsx

# Convert all XLSX files
npm run convert:csv
```

## CSV Format

The CSV files follow the format expected by the konzert composer-works module:
- First row: headers (e.g., Catalogue, Title, Type, Key)
- Subsequent rows: data
- Fields may contain commas and will be properly quoted

## GitHub Actions

This repository uses GitHub Actions to automatically convert XLSX files to CSV when changes are pushed to the `xlsx/` directory. The workflow:

1. Detects changes to `xlsx/*.xlsx` files
2. Runs the conversion script
3. Commits and pushes the generated CSV files

You can also manually trigger the workflow from the GitHub Actions tab.

## License

This data is provided for use with the konzert application.
