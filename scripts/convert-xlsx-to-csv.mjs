#!/usr/bin/env node

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, basename, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Clamp a worksheet's declared range to the cells that actually hold data.
 * Excel frequently reports a bloated !ref (e.g. A1:XFB1046 after a
 * Ctrl+Shift+Right), which sheet_to_csv would turn into thousands of
 * empty trailing columns.
 * @param {object} worksheet - Worksheet to trim in place
 * @returns {object} The same worksheet
 */
function trimToUsedRange(worksheet) {
  if (!worksheet || !worksheet['!ref']) return worksheet;

  const range = xlsx.utils.decode_range(worksheet['!ref']);
  let maxCol = range.s.c;
  let maxRow = range.s.r;

  for (const address of Object.keys(worksheet)) {
    if (address[0] === '!') continue;
    const cell = worksheet[address];
    if (!cell || cell.v === undefined || cell.v === null || cell.v === '') continue;
    const { c, r } = xlsx.utils.decode_cell(address);
    if (c > maxCol) maxCol = c;
    if (r > maxRow) maxRow = r;
  }

  range.e.c = maxCol;
  range.e.r = maxRow;
  worksheet['!ref'] = xlsx.utils.encode_range(range);
  return worksheet;
}

/**
 * Convert XLSX file to CSV
 * @param {string} xlsxPath - Path to XLSX file
 * @param {string} csvPath - Path to output CSV file
 */
async function convertXlsxToCsv(xlsxPath, csvPath) {
  try {
    console.log(`Reading XLSX file: ${xlsxPath}`);
    const workbook = xlsx.readFile(xlsxPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = trimToUsedRange(workbook.Sheets[sheetName]);
    const csv = xlsx.utils.sheet_to_csv(worksheet);

    // Ensure output directory exists
    const outputDir = dirname(csvPath);
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

    await writeFile(csvPath, csv, 'utf-8');
    console.log(`✓ Converted to CSV: ${csvPath}`);
  } catch (error) {
    console.error(`✗ Error converting ${xlsxPath}:`, error.message);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  const dataDir = join(__dirname, '..');
  const xlsxDir = join(dataDir, 'xlsx');
  const csvDir = join(dataDir, 'csv');

  // Get all XLSX files
  const xlsxFiles = process.argv.slice(2);

  if (xlsxFiles.length === 0) {
    console.log('Usage: node convert-xlsx-to-csv.mjs <xlsx-file> [<xlsx-file> ...]');
    console.log('Or convert all XLSX files in xlsx directory');
    console.log('Converting all XLSX files in xlsx...');
  }

  if (xlsxFiles.length > 0) {
    // Convert specified files
    for (const xlsxFile of xlsxFiles) {
      const xlsxPath = isAbsolute(xlsxFile) ? xlsxFile : join(xlsxDir, xlsxFile);
      const fileName = basename(xlsxFile).replace('.xlsx', '');
      const csvPath = join(csvDir, `${fileName}.csv`);
      await convertXlsxToCsv(xlsxPath, csvPath);
    }
  } else {
    // Convert all XLSX files in xlsx
    if (!existsSync(xlsxDir)) {
      console.log('No xlsx directory found, skipping.');
      return;
    }

    const fs = await import('fs');
    const files = fs.readdirSync(xlsxDir).filter(f => f.endsWith('.xlsx'));

    if (files.length === 0) {
      console.log('No XLSX files found in xlsx.');
      return;
    }

    for (const file of files) {
      const xlsxPath = join(xlsxDir, file);
      const fileName = file.replace('.xlsx', '');
      const csvPath = join(csvDir, `${fileName}.csv`);
      await convertXlsxToCsv(xlsxPath, csvPath);
    }
  }

  console.log('\n✓ All conversions completed!');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
