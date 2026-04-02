import path from 'path';
import { fileURLToPath } from 'url';
import { runCsvTest } from '../lib/statcan-tools.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

await runCsvTest({
  name: 'jvws',
  pid: '1410032501',
  url: 'https://www150.statcan.gc.ca/t1/wds/rest/getFullTableDownloadCSV',
  outputDir: path.join(rootDir, 'statscan', 'outputs', 'jvws'),
  calls: 1,
  mapRow: (row) => row,
});