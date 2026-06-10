import fs from 'node:fs/promises';
import path from 'node:path';

const CSV_COLUMNS = [
  'filename',
  'sourceDurationSec',
  'outputDurationSec',
  'sampleRate',
  'channels',
  'configuredLeadingPadMs',
  'configuredTrailingPadMs',
  'leadingSilenceMs',
  'trailingSilenceMs',
  'status',
  'notes',
  'error',
];

/**
 * @param {Object} options
 * @param {string} options.reportFolder
 * @param {number} options.leadingPadMs
 * @param {number} options.trailingPadMs
 * @param {Record<string, unknown>[]} entries
 */
export async function writeReports({
  reportFolder,
  leadingPadMs,
  trailingPadMs,
  entries,
  dryRun = false,
  manifestContext = null,
}) {
  await fs.mkdir(reportFolder, { recursive: true });

  const report = {
    generatedAt: new Date().toISOString(),
    leadingPadMs,
    trailingPadMs,
    dryRun,
    summary: summarizeEntries(entries),
    clips: entries,
    ...(manifestContext ?? {}),
  };

  const jsonPath = path.join(reportFolder, 'finalize-report.json');
  const csvPath = path.join(reportFolder, 'finalize-report.csv');

  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await fs.writeFile(csvPath, `${entriesToCsv(entries)}\n`, 'utf8');

  return report;
}

/**
 * @param {Record<string, unknown>[]} entries
 */
function summarizeEntries(entries) {
  const summary = { total: entries.length, pass: 0, review: 0, reject: 0 };

  for (const entry of entries) {
    const status = String(entry.status ?? '').toUpperCase();
    if (status === 'PASS') summary.pass += 1;
    if (status === 'REVIEW') summary.review += 1;
    if (status === 'REJECT') summary.reject += 1;
  }

  return summary;
}

/**
 * @param {Record<string, unknown>[]} entries
 * @returns {string}
 */
export function entriesToCsv(entries) {
  const header = CSV_COLUMNS.join(',');
  const rows = entries.map((entry) =>
    CSV_COLUMNS.map((column) => formatCsvValue(entry[column])).join(',')
  );
  return [header, ...rows].join('\n');
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function formatCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (Array.isArray(value)) {
    return escapeCsvField(value.join('; '));
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return escapeCsvField(String(value));
}

/**
 * @param {string} value
 * @returns {string}
 */
export function escapeCsvField(value) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
