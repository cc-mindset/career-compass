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
    occupation: pick(record, ['Occupation', 'Detailed occupation']),
    employment2024: pick(record, ['Employment 2024']),
    employment2034: pick(record, ['Employment 2034']),
    employmentChange: pick(record, ['Employment change']),
    employmentPercentChange: pick(record, ['Employment percent change']),
    annualOpenings: pick(record, ['Annual openings']),
    medianWage: pick(record, ['Median wage']),
    entryLevelEducation: pick(record, ['Entry level education']),
    onTheJobTraining: pick(record, ['On-the-job training']),
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
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rawPath = path.join(outputDir, `projections-${stamp}.xlsx`);
  const reportPath = path.join(outputDir, `projections-${stamp}.report.json`);

  await writeFile(rawPath, buffer);

  const occupationRows = rows.filter((row) => pick(row, ['Occupation', 'Detailed occupation']));
  const percentRanked = occupationRows
    .map((row) => ({
      ...summarizeRow(row),
      employmentPercentChangeValue: numberValue(pick(row, ['Employment percent change'])),
      annualOpeningsValue: numberValue(pick(row, ['Annual openings'])),
      medianWageValue: numberValue(pick(row, ['Median wage'])),
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
    employment2024: headers.some((header) => header.toLowerCase() === 'employment 2024'),
    employment2034: headers.some((header) => header.toLowerCase() === 'employment 2034'),
    employmentChange: headers.some((header) => header.toLowerCase() === 'employment change'),
    employmentPercentChange: headers.some((header) => header.toLowerCase() === 'employment percent change'),
    annualOpenings: headers.some((header) => header.toLowerCase() === 'annual openings'),
    medianWage: headers.some((header) => header.toLowerCase() === 'median wage'),
    entryLevelEducation: headers.some((header) => header.toLowerCase() === 'entry level education'),
    onTheJobTraining: headers.some((header) => header.toLowerCase() === 'on-the-job training'),
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