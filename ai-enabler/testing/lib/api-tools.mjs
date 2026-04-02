import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(rootDir, 'output');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function loadLocalEnv() {
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
      const parsed = raw.replace(/^['\"]|['\"]$/g, '');

      if (key && !(key in process.env)) {
        process.env[key] = parsed;
      }
    }
  } catch {
    return;
  }
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) {
      continue;
    }

    const equalsIndex = current.indexOf('=');
    if (equalsIndex !== -1) {
      const key = current.slice(2, equalsIndex);
      args[key] = current.slice(equalsIndex + 1);
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

export function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringifyPreview(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return value.slice(0, 120);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  return String(value).slice(0, 120);
}

export function summarizeShape(value, depth = 2) {
  if (depth < 0) {
    return { type: typeof value };
  }

  if (Array.isArray(value)) {
    const firstItem = value.length > 0 ? summarizeShape(value[0], depth - 1) : null;
    return {
      type: 'array',
      length: value.length,
      itemShape: firstItem,
    };
  }

  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    const sample = {};

    for (const key of keys.slice(0, 10)) {
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
  if (typeof value !== 'string') {
    return false;
  }

  return /\d{4}-\d{2}(-\d{2})?/.test(value) || /\d{4}\/\d{2}(\/\d{2})?/.test(value) || /\d{4}/.test(value);
}

function toDate(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const yearMonth = value.match(/^(\d{4})-(\d{2})$/);
  if (yearMonth) {
    const parsed = new Date(`${yearMonth[1]}-${yearMonth[2]}-01T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function detectPagination(value) {
  const signals = [];
  const names = new Set();

  walk(value, (_nested, pathParts) => {
    const key = pathParts[pathParts.length - 1];
    if (!key) {
      return;
    }

    if (/^(next|prev|page|pages|limit|offset|count|total|pagecount|totalpages|maxrecords|startposition|endposition)$/i.test(key)) {
      names.add(key);
    }
  });

  for (const name of names) {
    signals.push(name);
  }

  return signals;
}

function detectFreshness(value) {
  const dates = [];

  walk(value, (nested, pathParts) => {
    const key = pathParts[pathParts.length - 1] || '';
    if (!/date|updated|published|released|time|period/i.test(key)) {
      return;
    }

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

function detectTimeSeries(value) {
  const paths = [];

  walk(value, (_nested, pathParts) => {
    const last = pathParts[pathParts.length - 1] || '';
    if (/series|history|historical|timeseries|time_series|observations|data/i.test(last)) {
      paths.push(pathParts.join('.'));
    }
  });

  return [...new Set(paths)].slice(0, 20);
}

function detectRateLimit(headers) {
  const entries = [];

  for (const [key, value] of Object.entries(headers)) {
    if (/rate|limit|quota/i.test(key) || /rate|limit|quota/i.test(String(value))) {
      entries.push([key, String(value)]);
    }
  }

  return entries;
}

export async function requestJson({ url, method = 'GET', headers = {}, body, timeoutMs = 30000 }) {
  const controller = new AbortController();
  const startedAt = Date.now();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });

    const text = await response.text();
    let json = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    return {
      url,
      method,
      status: response.status,
      ok: response.ok,
      durationMs: Date.now() - startedAt,
      headers: Object.fromEntries(response.headers.entries()),
      text,
      json,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureOutputDirs() {
  await mkdir(path.join(outputDir, 'raw'), { recursive: true });
  await mkdir(path.join(outputDir, 'reports'), { recursive: true });
}

function unique(items) {
  return [...new Set(items)];
}

function average(values) {
  if (values.length === 0) {
    return 0;
  }

  return Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 10) / 10;
}

export async function runApiTest(name, buildRequest, { calls = 3, delayMs = 0 } = {}) {
  await ensureOutputDirs();

  const results = [];

  for (let index = 0; index < calls; index += 1) {
    const request = await buildRequest(index);
    const result = await requestJson(request);
    results.push(result);

    if (delayMs > 0 && index < calls - 1) {
      await sleep(delayMs);
    }
  }

  const first = results[0];
  const firstJson = first?.json;
  const topShape = firstJson ? summarizeShape(firstJson) : summarizeShape(first?.text ?? '');
  const statuses = unique(results.map((entry) => entry.status));
  const durations = results.map((entry) => entry.durationMs);
  const rateLimit = results.flatMap((entry) => detectRateLimit(entry.headers));
  const freshness = firstJson ? detectFreshness(firstJson) : [];
  const pagination = firstJson ? detectPagination(firstJson) : [];
  const timeSeries = firstJson ? detectTimeSeries(firstJson) : [];
  const shapeSignatures = results.map((entry) => JSON.stringify(entry.json ? summarizeShape(entry.json) : summarizeShape(entry.text)));
  const shapeStable = unique(shapeSignatures).length === 1;

  const report = {
    name,
    calls,
    statuses,
    statusStable: statuses.length === 1,
    timingMs: {
      min: Math.min(...durations),
      max: Math.max(...durations),
      avg: average(durations),
    },
    shapeStable,
    topShape,
    freshness,
    pagination,
    rateLimit,
    timeSeries,
    requestUrl: first?.url,
    requestMethod: first?.method,
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rawPath = path.join(outputDir, 'raw', `${name}-${stamp}.json`);
  const reportPath = path.join(outputDir, 'reports', `${name}-${stamp}.json`);

  await writeFile(rawPath, JSON.stringify({
    name,
    generatedAt: new Date().toISOString(),
    results,
  }, null, 2));

  await writeFile(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n${name}`);
  console.log(`status: ${statuses.join(', ')}`);
  console.log(`timing ms: min ${report.timingMs.min}, avg ${report.timingMs.avg}, max ${report.timingMs.max}`);
  console.log(`shape stable: ${shapeStable ? 'yes' : 'no'}`);
  if (freshness.length > 0) {
    console.log(`freshness: ${freshness[0].value}`);
  }
  if (pagination.length > 0) {
    console.log(`pagination: ${pagination.join(', ')}`);
  }
  if (rateLimit.length > 0) {
    console.log(`rate limit: ${rateLimit.map(([key, value]) => `${key}=${value}`).join(', ')}`);
  }
  if (timeSeries.length > 0) {
    console.log(`time series paths: ${timeSeries.join(', ')}`);
  }
  console.log(`raw: ${rawPath}`);
  console.log(`report: ${reportPath}`);

  return report;
}

export function buildQueryUrl(baseUrl, params = {}) {
  const url = new URL(baseUrl);

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

export function jsonHeaders(extra = {}) {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...extra,
  };
}