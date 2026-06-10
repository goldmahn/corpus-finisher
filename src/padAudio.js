import { DEFAULTS } from './config.js';
import { probeAudio, runFfmpeg } from './ffmpegUtils.js';

/**
 * @typedef {Object} PadOptions
 * @property {string} inputPath
 * @property {string} outputPath
 * @property {number} [leadingPadMs]
 * @property {number} [trailingPadMs]
 * @property {number} [fadeMs]
 */

/**
 * Add leading/trailing silence and optional edge fades for training-ready clips.
 * @param {PadOptions} options
 */
export function padAudio({
  inputPath,
  outputPath,
  leadingPadMs = DEFAULTS.leadingPadMs,
  trailingPadMs = DEFAULTS.trailingPadMs,
  fadeMs = DEFAULTS.fadeMs,
}) {
  const source = probeAudio(inputPath);
  const filter = buildPadFilter({
    leadingPadMs,
    trailingPadMs,
    fadeMs,
    speechDurationSec: source.duration,
  });

  const result = runFfmpeg([
    '-hide_banner',
    '-nostats',
    '-y',
    '-i',
    inputPath,
    '-af',
    filter,
    '-ar',
    String(source.sampleRate),
    '-ac',
    String(source.channels),
    '-c:a',
    'pcm_s16le',
    outputPath,
  ]);

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `Padding failed for ${inputPath}`);
  }
}

/**
 * @param {Object} options
 * @param {number} options.leadingPadMs
 * @param {number} options.trailingPadMs
 * @param {number} options.fadeMs
 * @param {number} options.speechDurationSec
 * @returns {string}
 */
export function buildPadFilter({
  leadingPadMs,
  trailingPadMs,
  fadeMs,
  speechDurationSec,
}) {
  const leadingSec = leadingPadMs / 1000;
  const trailingSec = trailingPadMs / 1000;
  const fadeSec = fadeMs / 1000;
  const parts = [
    `adelay=${leadingPadMs}:all=1`,
    `apad=pad_dur=${trailingSec}`,
  ];

  if (fadeMs > 0 && speechDurationSec > 0) {
    parts.push(`afade=t=in:st=${leadingSec}:d=${fadeSec}`);
    const fadeOutStart = leadingSec + speechDurationSec - fadeSec;
    if (fadeOutStart > leadingSec) {
      parts.push(`afade=t=out:st=${fadeOutStart}:d=${fadeSec}`);
    }
  }

  return parts.join(',');
}

/**
 * @param {number} sourceDurationSec
 * @param {number} leadingPadMs
 * @param {number} trailingPadMs
 * @returns {number}
 */
export function expectedDurationSec(sourceDurationSec, leadingPadMs, trailingPadMs) {
  return sourceDurationSec + leadingPadMs / 1000 + trailingPadMs / 1000;
}
