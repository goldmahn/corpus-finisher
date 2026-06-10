import path from 'node:path';
import { analyzeClip } from './analyzeClip.js';
import { DEFAULTS } from './config.js';
import {
  buildOutputPath,
  discoverWavFiles,
  ensureFolder,
} from './fileUtils.js';
import { assertFfmpegAvailable, probeAudio } from './ffmpegUtils.js';
import {
  PACKAGE_VERSION,
  buildStageManifest,
  enrichReportEntry,
  manifestReportContext,
  readManifest,
  resolveStageManifestPath,
  writeManifest,
} from './manifestUtils.js';
import { expectedDurationSec, padAudio } from './padAudio.js';
import { buildReportEntry, classifyClip } from './qcRules.js';
import { writeReports } from './writeReports.js';

/**
 * @typedef {Object} FinalizeCorpusOptions
 * @property {string} inputFolder
 * @property {string} outputFolder
 * @property {string} [reportFolder]
 * @property {number} [leadingPadMs]
 * @property {number} [trailingPadMs]
 * @property {number} [fadeMs]
 * @property {string} [manifestPath]
 * @property {boolean} [writeSourceManifest]
 * @property {boolean} [dryRun]
 * @property {typeof padAudio} [padFn]
 * @property {typeof analyzeClip} [analyzeFn]
 */

/**
 * @typedef {Object} FinalizeCorpusResult
 * @property {Record<string, unknown>[]} clips
 * @property {Record<string, number>} summary
 * @property {string[]} failures
 * @property {boolean} dryRun
 * @property {string | null} stageManifestPath
 */

/**
 * Pad and finalize normalized clips for training export.
 * @param {FinalizeCorpusOptions} options
 * @returns {Promise<FinalizeCorpusResult>}
 */
export async function finalizeCorpus(options) {
  const {
    inputFolder,
    outputFolder,
    reportFolder = path.join(path.dirname(outputFolder), 'reports'),
    leadingPadMs = DEFAULTS.leadingPadMs,
    trailingPadMs = DEFAULTS.trailingPadMs,
    fadeMs = DEFAULTS.fadeMs,
    dryRun = false,
    manifestPath,
    writeSourceManifest = false,
    padFn = padAudio,
    analyzeFn = analyzeClip,
  } = options;

  assertFfmpegAvailable();

  const inputDir = path.resolve(inputFolder);
  const outputDir = path.resolve(outputFolder);
  const reportDir = path.resolve(reportFolder);

  let manifest = null;
  if (manifestPath) {
    manifest = await readManifest(path.resolve(manifestPath));
  }

  const wavFiles = await discoverWavFiles(inputDir);
  const failures = [];
  const entries = [];

  if (!dryRun) {
    await ensureFolder(outputDir);
  }
  await ensureFolder(reportDir);

  for (const filePath of wavFiles) {
    const filename = path.basename(filePath);

    try {
      let sourceDurationSec = null;
      try {
        sourceDurationSec = probeAudio(filePath).duration;
      } catch {
        sourceDurationSec = null;
      }

      if (!dryRun) {
        try {
          padFn({
            inputPath: filePath,
            outputPath: buildOutputPath(filePath, outputDir),
            leadingPadMs,
            trailingPadMs,
            fadeMs,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          failures.push(`${filename}: ${message}`);
          entries.push({
            filename,
            sourceDurationSec,
            outputDurationSec: null,
            sampleRate: null,
            channels: null,
            configuredLeadingPadMs: leadingPadMs,
            configuredTrailingPadMs: trailingPadMs,
            leadingSilenceMs: 0,
            trailingSilenceMs: 0,
            status: 'REJECT',
            notes: ['Padding failed'],
            error: message,
          });
          continue;
        }
      }

      const analysisPath = dryRun ? filePath : buildOutputPath(filePath, outputDir);
      const analysis = analyzeFn(analysisPath);

      const outputDurationSec = dryRun
        ? sourceDurationSec != null
          ? expectedDurationSec(sourceDurationSec, leadingPadMs, trailingPadMs)
          : analysis.duration
        : analysis.duration;

      const qcAnalysis = dryRun
        ? {
            ...analysis,
            leadingSilenceMs: leadingPadMs,
            trailingSilenceMs: trailingPadMs,
            duration: outputDurationSec,
          }
        : analysis;

      const qc = classifyClip(qcAnalysis, {
        leadingPadMs,
        trailingPadMs,
        sourceDurationSec,
        outputDurationSec,
      });

      entries.push(
        manifest
          ? enrichReportEntry(
              buildReportEntry(qcAnalysis, qc, {
                filename,
                leadingPadMs,
                trailingPadMs,
                sourceDurationSec,
                outputDurationSec,
              }),
              manifest
            )
          : buildReportEntry(qcAnalysis, qc, {
              filename,
              leadingPadMs,
              trailingPadMs,
              sourceDurationSec,
              outputDurationSec,
            })
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push(`${filename}: ${message}`);
      entries.push({
        filename,
        sourceDurationSec: null,
        outputDurationSec: null,
        sampleRate: null,
        channels: null,
        configuredLeadingPadMs: leadingPadMs,
        configuredTrailingPadMs: trailingPadMs,
        leadingSilenceMs: 0,
        trailingSilenceMs: 0,
        status: 'REJECT',
        notes: ['Processing failed'],
        error: message,
      });
    }
  }

  const report = await writeReports({
    reportFolder: reportDir,
    leadingPadMs,
    trailingPadMs,
    entries,
    dryRun,
    manifestContext: manifest ? manifestReportContext(manifest) : null,
  });

  let stageManifestPath = null;
  if (manifest) {
    const resolvedSourceManifest = manifestPath ? path.resolve(manifestPath) : null;
    const stageManifest = buildStageManifest({
      manifest,
      qcEntries: entries,
      qcSummary: report.summary,
      processingData: {
        version: PACKAGE_VERSION,
        leading_pad_ms: leadingPadMs,
        trailing_pad_ms: trailingPadMs,
        fade_ms: fadeMs,
        completed_at: new Date().toISOString(),
      },
      sourceManifestPath: resolvedSourceManifest ?? undefined,
    });

    stageManifestPath = resolveStageManifestPath(outputDir);
    await writeManifest(stageManifestPath, stageManifest);

    if (writeSourceManifest && resolvedSourceManifest) {
      await writeManifest(resolvedSourceManifest, stageManifest);
    }
  }

  return {
    clips: entries,
    summary: report.summary,
    failures,
    dryRun,
    stageManifestPath,
  };
}
