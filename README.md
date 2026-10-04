# Composer Catalog Data

Public composer catalog data for the konzert application.

## Directory Structure

- `xlsx/` - Source XLSX files (edit these in Excel or Google Sheets)
- `csv/` - Auto-generated CSV files (do not edit manually)
- `scripts/` - Conversion utilities

## Supported Catalog Systems

- **KV** - Mozart (Köchel-Verzeichnis)
- **TWV** - Telemann (Telemann-Werke-Verzeichnis)
- **RV** - Vivaldi (Ryom-Verzeichnis)
- **CPE** - C.P.E. Bach (Wotquenne/Helm catalog)
- **BWV** - J.S. Bach (Bach-Werke-Verzeichnis)
- **HWV** - Handel (Händel-Werke-Verzeichnis)

## Workflow

### Editing Data

1. Edit XLSX files in the `xlsx/` directory using Excel or Google Sheets
2. Commit and push changes to GitHub
3. GitHub Actions automatically converts XLSX to CSV
4. The konzert application reads CSV files from this repository

### Local Testing

To test the conversion locally:

```bash
# Install dependencies
npm install

# Convert a specific file
npm run convert:csv xlsx/Hob.xlsx

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
