import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const outputDir = path.join(rootDir, 'bls', 'outputs', 'projections');
const workbookUrl = 'https://www.bls.gov/emp/ind-occ-matrix/occupation.xlsx';

function numberValue(value) {
  const cleaned = String(value || '').replace(/[$,%]/g, '').replace(/,/g, '').trim();
  if (!cleaned) return null;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildRows(sheet) {
  const table = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const headers = table[1] || [];

  return table.slice(2).map((values) => {
    const record = {};
    headers.forEach((header, index) => {
      if (header) {
        record[String(header).trim()] = values[index] ?? '';
      }
    });
    return record;
  });
}

function pick(record, names) {
  const lowerMap = new Map(Object.keys(record).map((key) => [key.toLowerCase(), key]));

  for (const name of names) {
    const key = lowerMap.get(name.toLowerCase());
    if (key) {
      return record[key];
    }
  }

  return '';
}

function summarizeRow(record) {
  return {
    occupation: pick(record, ['2024 National Employment Matrix title']),
    code: pick(record, ['2024 National Employment Matrix code']),
    occupationType: pick(record, ['Occupation type']),
    employment2024: pick(record, ['Employment, 2024']),
    employment2034: pick(record, ['Employment, 2034']),
    employmentChange: pick(record, ['Employment change, numeric, 2024–34']),
    employmentPercentChange: pick(record, ['Employment change, percent, 2024–34']),
    annualOpenings: pick(record, ['Occupational openings, 2024–34 annual average']),
    medianWage: pick(record, ['Median annual wage, dollars, 2024[1]']),
    entryLevelEducation: pick(record, ['Typical education needed for entry']),
    onTheJobTraining: pick(record, ['Typical on-the-job training needed to attain competency in the occupation']),
  };
}

async function main() {
  await mkdir(outputDir, { recursive: true });

  const startedAt = Date.now();
  const response = await fetch(workbookUrl);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames.find((name) => name === 'Table 1.2') || workbook.SheetNames.find((name) => name.startsWith('Table 1.2')) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = buildRows(sheet);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rawPath = path.join(outputDir, `projections-${stamp}.xlsx`);
  const reportPath = path.join(outputDir, `projections-${stamp}.report.json`);

  await writeFile(rawPath, buffer);

  const occupationRows = rows.filter((row) => pick(row, ['2024 National Employment Matrix title']));
  const percentRanked = occupationRows
    .map((row) => ({
      ...summarizeRow(row),
      employment2024Value: numberValue(pick(row, ['Employment, 2024'])),
      employment2034Value: numberValue(pick(row, ['Employment, 2034'])),
      employmentChangeValue: numberValue(pick(row, ['Employment change, numeric, 2024–34'])),
      employmentPercentChangeValue: numberValue(pick(row, ['Employment change, percent, 2024–34'])),
      annualOpeningsValue: numberValue(pick(row, ['Occupational openings, 2024–34 annual average'])),
      medianWageValue: numberValue(pick(row, ['Median annual wage, dollars, 2024[1]'])),
    }))
    .filter((row) => row.occupation);

  const topGrowth = [...percentRanked]
    .filter((row) => row.employmentPercentChangeValue !== null)
    .sort((left, right) => (right.employmentPercentChangeValue ?? -Infinity) - (left.employmentPercentChangeValue ?? -Infinity))
    .slice(0, 10);

  const topOpenings = [...percentRanked]
    .filter((row) => row.annualOpeningsValue !== null)
    .sort((left, right) => (right.annualOpeningsValue ?? -Infinity) - (left.annualOpeningsValue ?? -Infinity))
    .slice(0, 10);

  const headers = rows[0] ? Object.keys(rows[0]) : [];
  const fieldPresence = {
    employment2024: headers.includes('Employment, 2024'),
    employment2034: headers.includes('Employment, 2034'),
    employmentChange: headers.includes('Employment change, numeric, 2024–34'),
    employmentPercentChange: headers.includes('Employment change, percent, 2024–34'),
    annualOpenings: headers.includes('Occupational openings, 2024–34 annual average'),
    medianWage: headers.includes('Median annual wage, dollars, 2024[1]'),
    entryLevelEducation: headers.includes('Typical education needed for entry'),
    onTheJobTraining: headers.includes('Typical on-the-job training needed to attain competency in the occupation'),
  };

  await writeFile(reportPath, JSON.stringify({
    url: workbookUrl,
    sheetName,
    status: response.status,
    ok: response.ok,
    durationMs: Date.now() - startedAt,
    rowCount: rows.length,
    headerCount: headers.length,
    fieldPresence,
    topGrowth,
    topOpenings,
    sampleRows: occupationRows.slice(0, 5).map(summarizeRow),
  }, null, 2));

  console.log(`status: ${response.status}`);
  console.log(`duration ms: ${Date.now() - startedAt}`);
  console.log(`rows: ${rows.length}`);
  console.log(`raw: ${rawPath}`);
  console.log(`report: ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});