import path from 'node:path';
import { QC_THRESHOLDS } from './config.js';
import { probeAudio, runFfmpeg } from './ffmpegUtils.js';

/**
 * @typedef {Object} ClipAnalysis
 * @property {string} filename
 * @property {number | null} duration
 * @property {number | null} sampleRate
 * @property {number | null} channels
 * @property {number} leadingSilenceMs
 * @property {number} trailingSilenceMs
 * @property {boolean} valid
 * @property {string | null} error
 */

/**
 * @param {string} filePath
 * @returns {ClipAnalysis}
 */
export function analyzeClip(filePath) {
  const filename = path.basename(filePath);
  const base = {
    filename,
    duration: null,
    sampleRate: null,
    channels: null,
    leadingSilenceMs: 0,
    trailingSilenceMs: 0,
    valid: false,
    error: null,
  };

  try {
    const probe = probeAudio(filePath);
    const silence = measureSilence(filePath, probe.duration);

    return {
      filename,
      duration: probe.duration,
      sampleRate: probe.sampleRate,
      channels: probe.channels,
      leadingSilenceMs: silence.leadingSilenceMs,
      trailingSilenceMs: silence.trailingSilenceMs,
      valid: true,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ...base, error: message };
  }
}

/**
 * @param {string} filePath
 * @param {number} durationSec
 */
function measureSilence(filePath, durationSec) {
  const { silenceNoiseDb, silenceMinDurationSec } = QC_THRESHOLDS;

  const result = runFfmpeg([
    '-hide_banner',
    '-nostats',
    '-i',
    filePath,
    '-af',
    `silencedetect=noise=${silenceNoiseDb}dB:d=${silenceMinDurationSec}`,
    '-f',
    'null',
    '-',
  ]);

  const output = `${result.stdout}\n${result.stderr}`;
  const starts = [...output.matchAll(/silence_start:\s*([0-9.+-eE]+)/g)].map(
    (match) => parseFloat(match[1])
  );
  const ends = [...output.matchAll(/silence_end:\s*([0-9.+-eE]+)/g)].map(
    (match) => parseFloat(match[1])
  );

  let leadingSilenceMs = 0;
  let trailingSilenceMs = 0;

  if (starts.length > 0 && starts[0] <= 0.001) {
    const end = ends[0];
    leadingSilenceMs = end != null ? Math.round(end * 1000) : 0;
  }

  if (starts.length > 0) {
    const lastStart = starts[starts.length - 1];
    if (durationSec > 0 && lastStart < durationSec) {
      trailingSilenceMs = Math.round((durationSec - lastStart) * 1000);
    }
  }

  return { leadingSilenceMs, trailingSilenceMs };
}
