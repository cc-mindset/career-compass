import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const outputDir = path.join(rootDir, 'bls', 'outputs', 'cps');
const apiUrl = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';

async function loadEnv() {
  const envPath = path.join(rootDir, '.env');

  try {
    const text = await readFile(envPath, 'utf8');

    for (const line of text.split('\n')) {
      const value = line.trim();
      if (!value || value.startsWith('#') || !value.includes('=')) {
        continue;
      }

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

function summarize(value) {
  if (Array.isArray(value)) {
    return {
      type: 'array',
      length: value.length,
      first: value[0] ? summarize(value[0]) : null,
    };
  }

  if (value && typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value).slice(0, 12)) {
      result[key] = summarize(value[key]);
    }
    return { type: 'object', keys: Object.keys(value).slice(0, 20), sample: result };
  }

  return { type: typeof value, value };
}

async function main() {
  await loadEnv();
  await mkdir(outputDir, { recursive: true });

  const seriesIds = (process.env.CPS_SERIES_IDS || 'LNS14000000,LNS11300000,LNS12000000,LNS13327709')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const body = JSON.stringify({
    seriesid: seriesIds,
    startyear: String(new Date().getFullYear() - 2),
    endyear: String(new Date().getFullYear()),
    ...(process.env.BLS_API_KEY ? { registrationkey: process.env.BLS_API_KEY } : {}),
  });

  const startedAt = Date.now();
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  });

  const text = await response.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rawPath = path.join(outputDir, `cps-${stamp}.json`);
  const reportPath = path.join(outputDir, `cps-${stamp}.report.json`);

  await writeFile(rawPath, JSON.stringify({
    url: apiUrl,
    status: response.status,
    ok: response.ok,
    durationMs: Date.now() - startedAt,
    body: json ?? text,
  }, null, 2));

  const series = json?.Results?.series || [];

  await writeFile(reportPath, JSON.stringify({
    status: response.status,
    ok: response.ok,
    durationMs: Date.now() - startedAt,
    seriesCount: series.length,
    seriesIds: series.map((item) => item.seriesID),
    responseShape: summarize(json ?? text),
  }, null, 2));

  console.log(`status: ${response.status}`);
  console.log(`duration ms: ${Date.now() - startedAt}`);
  console.log(`series: ${series.length}`);
  console.log(`raw: ${rawPath}`);
  console.log(`report: ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});