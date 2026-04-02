import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) continue;

    const equalsIndex = current.indexOf('=');
    if (equalsIndex !== -1) {
      args[current.slice(2, equalsIndex)] = current.slice(equalsIndex + 1);
      continue;
    }

    const key = current.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }

  return args;
}

export async function loadEnv() {
  const envPath = path.join(rootDir, '.env');

  try {
    const text = await readFile(envPath, 'utf8');
    for (const line of text.split('\n')) {
      const value = line.trim();
      if (!value || value.startsWith('#') || !value.includes('=')) continue;

      const equalsIndex = value.indexOf('=');
      const key = value.slice(0, equalsIndex).trim();
      const raw = value.slice(equalsIndex + 1).trim();
      if (key && !(key in process.env)) {
        process.env[key] = raw.replace(/^['"]|['"]$/g, '');
      }
    }
  } catch {
    return;
  }
}

export function normalizePid(pid) {
  const digits = String(pid || '').replace(/\D/g, '');
  return digits.slice(0, 8);
}

function stringifyPreview(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.slice(0, 120);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value).slice(0, 120);
}

export function summarizeShape(value, depth = 2) {
  if (depth < 0) return { type: typeof value };

  if (Array.isArray(value)) {
    return {
      type: 'array',
      length: value.length,
      itemShape: value.length > 0 ? summarizeShape(value[0], depth - 1) : null,
    };
  }

  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    const sample = {};
    for (const key of keys.slice(0, 12)) {
      sample[key] = summarizeShape(value[key], depth - 1);
    }

    return {
      type: 'object',
      keys: keys.slice(0, 25),
      sample,
    };
  }

  return {
    type: typeof value,
    value: stringifyPreview(value),
  };
}

function walk(value, callback, pathParts = []) {
  callback(value, pathParts);

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      walk(value[index], callback, [...pathParts, String(index)]);
    }
    return;
  }

  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      walk(nested, callback, [...pathParts, key]);
    }
  }
}

function isDateLike(value) {
  return typeof value === 'string' && (/\d{4}-\d{2}(-\d{2})?/.test(value) || /\d{4}\/\d{2}(\/\d{2})?/.test(value));
}

function toDate(value) {
  if (typeof value !== 'string') return null;
  const direct = new Date(value);
  return Number.isNaN(direct.getTime()) ? null : direct;
}

function detectFreshness(value) {
  const dates = [];

  walk(value, (nested, pathParts) => {
    const key = pathParts[pathParts.length - 1] || '';
    if (!/date|updated|published|released|time|period/i.test(key)) return;
    if (typeof nested === 'string' && isDateLike(nested)) {
      const parsed = toDate(nested);
      if (parsed) {
        dates.push({ path: pathParts.join('.'), value: nested, iso: parsed.toISOString() });
      }
    }
  });

  dates.sort((left, right) => right.iso.localeCompare(left.iso));
  return dates.slice(0, 10);
}

function detectPagination(value) {
  const names = new Set();

  walk(value, (_nested, pathParts) => {
    const key = pathParts[pathParts.length - 1];
    if (key && /^(next|prev|page|pages|limit|offset|count|total|pagecount|totalpages)$/i.test(key)) {
      names.add(key);
    }
  });

  return [...names];
}

export function parseCsv(text) {
  const rows = [];
  let current = '';
  let row = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === ',' && !quoted) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(current);
      current = '';
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    if (row.some((value) => value.trim() !== '')) rows.push(row);
  }

  const headers = rows.shift() || [];
  return rows.map((values) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header.trim()] = (values[index] ?? '').trim();
    });
    return record;
  });
}

export function buildUrl(baseUrl, params = {}) {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export async function runCsvTest({ name, pid, url, outputDir, calls = 3, mapRow }) {
  await mkdir(outputDir, { recursive: true });
  await loadEnv();

  const results = [];
  const startedAt = Date.now();
  const tablePid = normalizePid(pid);
  const requestUrl = `${url}/${tablePid}/en`;

  for (let index = 0; index < calls; index += 1) {
    const response = await fetch(requestUrl);
    const metaText = await response.text();
    let meta = null;

    try {
      meta = metaText ? JSON.parse(metaText) : null;
    } catch {
      meta = null;
    }

    let downloadUrl = meta?.object || '';
    let zipBuffer = null;
    let csvText = '';
    let rows = [];

    if (downloadUrl) {
      const downloadResponse = await fetch(downloadUrl);
      const arrayBuffer = await downloadResponse.arrayBuffer();
      zipBuffer = Buffer.from(arrayBuffer);

      const zip = new AdmZip(zipBuffer);
      const entry = zip.getEntries().find((item) => !item.isDirectory && item.entryName.toLowerCase().endsWith('.csv')) || zip.getEntries().find((item) => !item.isDirectory);

      if (entry) {
        csvText = entry.getData().toString('utf8');
        rows = parseCsv(csvText);
      }

      results.push({ requestUrl, status: response.status, ok: response.ok, downloadUrl, rowCount: rows.length, csvText, rows, meta, zipBuffer });
    } else {
      results.push({ requestUrl, status: response.status, ok: response.ok, downloadUrl, rowCount: 0, csvText: '', rows: [], meta, zipBuffer });
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rawPath = path.join(outputDir, `${name}-${stamp}.zip`);
  const reportPath = path.join(outputDir, `${name}-${stamp}.report.json`);

  await writeFile(rawPath, results[0]?.zipBuffer || Buffer.from(''));

  const first = results[0] || {};
  const firstRows = first.rows || [];
  const mappedRows = typeof mapRow === 'function' ? firstRows.slice(0, 8).map(mapRow) : firstRows.slice(0, 8);
  const freshness = detectFreshness(firstRows);
  const pagination = detectPagination(firstRows);

  await writeFile(reportPath, JSON.stringify({
    name,
    url,
    tablePid,
    status: first.status,
    ok: first.ok,
    durationMs: Date.now() - startedAt,
    rowCount: first.rowCount || 0,
    fieldCount: firstRows[0] ? Object.keys(firstRows[0]).length : 0,
    downloadUrl: first.downloadUrl || '',
    shape: summarizeShape(firstRows),
    freshness,
    pagination,
    sampleRows: mappedRows,
  }, null, 2));

  console.log(`status: ${first.status}`);
  console.log(`duration ms: ${Date.now() - startedAt}`);
  console.log(`rows: ${first.rowCount || 0}`);
  console.log(`raw: ${rawPath}`);
  console.log(`report: ${reportPath}`);
}