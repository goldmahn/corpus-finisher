import { QC_THRESHOLDS } from './config.js';

/**
 * @typedef {import('./analyzeClip.js').ClipAnalysis} ClipAnalysis
 * @typedef {import('./config.js').QcStatus} QcStatus
 */

/**
 * @typedef {Object} QcResult
 * @property {QcStatus} status
 * @property {string[]} notes
 */

/**
 * @typedef {Object} FinalizeContext
 * @property {number} leadingPadMs
 * @property {number} trailingPadMs
 * @property {number | null} sourceDurationSec
 * @property {number | null} outputDurationSec
 */

/**
 * @param {ClipAnalysis} analysis
 * @param {FinalizeContext} context
 * @returns {QcResult}
 */
export function classifyClip(analysis, context) {
  const notes = [];

  if (!analysis.valid) {
    return {
      status: 'REJECT',
      notes: [analysis.error ?? 'Invalid or corrupted audio file'],
    };
  }

  if (analysis.duration === null || analysis.duration <= 0) {
    return { status: 'REJECT', notes: ['Missing audio content'] };
  }

  evaluateRejectRules(analysis, context, notes);
  if (notes.length > 0) {
    return { status: 'REJECT', notes };
  }

  evaluateReviewRules(analysis, context, notes);
  if (notes.length > 0) {
    return { status: 'REVIEW', notes };
  }

  return { status: 'PASS', notes: [] };
}

/**
 * @param {ClipAnalysis} analysis
 * @param {FinalizeContext} context
 * @param {string[]} notes
 */
function evaluateRejectRules(analysis, context, notes) {
  if (
    context.sourceDurationSec !== null &&
    context.outputDurationSec !== null &&
    context.sourceDurationSec > 0 &&
    context.outputDurationSec <
      context.sourceDurationSec * QC_THRESHOLDS.minDurationRatio
  ) {
    notes.push('Output duration shorter than source');
  }
}

/**
 * @param {ClipAnalysis} analysis
 * @param {FinalizeContext} context
 * @param {string[]} notes
 */
function evaluateReviewRules(analysis, context, notes) {
  const { leadingPadMs, trailingPadMs } = context;

  if (!padWithinTarget(analysis.leadingSilenceMs, leadingPadMs)) {
    notes.push('Leading padding outside expected range');
  }

  if (!padWithinTarget(analysis.trailingSilenceMs, trailingPadMs)) {
    notes.push('Trailing padding outside expected range');
  }

  if (
    analysis.leadingSilenceMs > QC_THRESHOLDS.excessiveSilenceMs ||
    analysis.trailingSilenceMs > QC_THRESHOLDS.excessiveSilenceMs
  ) {
    notes.push('Excessive leading or trailing silence');
  }
}

/**
 * @param {number} measuredMs
 * @param {number} targetMs
 * @returns {boolean}
 */
export function padWithinTarget(measuredMs, targetMs) {
  const delta = Math.abs(measuredMs - targetMs);
  if (delta <= QC_THRESHOLDS.padToleranceMs) {
    return true;
  }

  return (
    measuredMs >= QC_THRESHOLDS.minMeasuredPadMs &&
    measuredMs <= QC_THRESHOLDS.maxMeasuredPadMs
  );
}

/**
 * @param {ClipAnalysis} analysis
 * @param {QcResult} qc
 * @param {FinalizeContext & { filename: string }} context
 */
export function buildReportEntry(analysis, qc, context) {
  return {
    filename: context.filename,
    sourceDurationSec: roundOrNull(context.sourceDurationSec, 3),
    outputDurationSec: roundOrNull(context.outputDurationSec ?? analysis.duration, 3),
    sampleRate: analysis.sampleRate,
    channels: analysis.channels,
    configuredLeadingPadMs: context.leadingPadMs,
    configuredTrailingPadMs: context.trailingPadMs,
    leadingSilenceMs: analysis.leadingSilenceMs,
    trailingSilenceMs: analysis.trailingSilenceMs,
    status: qc.status,
    notes: qc.notes,
    ...(analysis.error ? { error: analysis.error } : {}),
  };
}

/**
 * @param {number | null} value
 * @param {number} digits
 * @returns {number | null}
 */
function roundOrNull(value, digits) {
  if (value === null) {
    return null;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
