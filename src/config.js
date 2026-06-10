/** @typedef {'PASS' | 'REVIEW' | 'REJECT'} QcStatus */

/**
 * Centralized padding and QC defaults for training-ready clips.
 */
export const DEFAULTS = {
  leadingPadMs: 75,
  trailingPadMs: 75,
  fadeMs: 3,
};

export const QC_THRESHOLDS = {
  /** Acceptable deviation from configured pad duration (ms) */
  padToleranceMs: 25,
  /** Minimum measured silence after finalize (ms) */
  minMeasuredPadMs: 50,
  /** Maximum measured silence before REVIEW (ms) */
  maxMeasuredPadMs: 150,
  /** Silence above this at either edge triggers REVIEW */
  excessiveSilenceMs: 500,
  /** FFmpeg silencedetect noise floor */
  silenceNoiseDb: -50,
  /** Minimum silence segment for silencedetect (seconds) */
  silenceMinDurationSec: 0.05,
  /** Output duration shorter than source by this factor triggers REJECT */
  minDurationRatio: 0.95,
};

export const SUPPORTED_EXTENSIONS = new Set(['.wav']);
