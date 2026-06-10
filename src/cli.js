#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULTS } from './config.js';
import { finalizeCorpus } from './finalizeCorpus.js';
import { FfmpegNotFoundError } from './ffmpegUtils.js';

function printHelp() {
  console.log(`Corpus Finisher — pad and finalize clips for Corpus Voces training

Usage:
  corpus-finisher <inputFolder> <outputFolder> [options]

Options:
  --pad <ms>          Leading and trailing pad duration (default: ${DEFAULTS.leadingPadMs})
  --leading-pad <ms>  Leading pad duration (default: ${DEFAULTS.leadingPadMs})
  --trailing-pad <ms> Trailing pad duration (default: ${DEFAULTS.trailingPadMs})
  --fade <ms>         Edge fade duration (default: ${DEFAULTS.fadeMs}, 0 to disable)
  --report <folder>   Report output folder (default: ../reports relative to output)
  --dry-run           Analyze without writing finalized files
  --help, -h          Show this help message

Examples:
  corpus-finisher ./normalized_clips ./training_clips
  corpus-finisher ./normalized_clips ./training_clips --pad 80
  corpus-finisher ./normalized_clips ./training_clips --dry-run
`);
}

/**
 * @param {string[]} argv
 */
export function parseCliArgs(argv) {
  const positional = [];
  let leadingPadMs = DEFAULTS.leadingPadMs;
  let trailingPadMs = DEFAULTS.trailingPadMs;
  let fadeMs = DEFAULTS.fadeMs;
  let reportFolder;
  let dryRun = false;
  let help = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }

    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg === '--pad') {
      const value = Number(argv[i + 1]);
      if (!Number.isFinite(value)) {
        throw new Error('Missing or invalid value for --pad');
      }
      leadingPadMs = value;
      trailingPadMs = value;
      i += 1;
      continue;
    }

    if (arg === '--leading-pad') {
      leadingPadMs = Number(argv[i + 1]);
      if (!Number.isFinite(leadingPadMs)) {
        throw new Error('Missing or invalid value for --leading-pad');
      }
      i += 1;
      continue;
    }

    if (arg === '--trailing-pad') {
      trailingPadMs = Number(argv[i + 1]);
      if (!Number.isFinite(trailingPadMs)) {
        throw new Error('Missing or invalid value for --trailing-pad');
      }
      i += 1;
      continue;
    }

    if (arg === '--fade') {
      fadeMs = Number(argv[i + 1]);
      if (!Number.isFinite(fadeMs) || fadeMs < 0) {
        throw new Error('Missing or invalid value for --fade');
      }
      i += 1;
      continue;
    }

    if (arg === '--report') {
      reportFolder = argv[i + 1];
      if (!reportFolder) {
        throw new Error('Missing value for --report');
      }
      i += 1;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }

    positional.push(arg);
  }

  if (help) {
    return { help: true };
  }

  if (positional.length < 2) {
    throw new Error('Input and output folders are required.');
  }

  const [inputFolder, outputFolder] = positional;

  return {
    help: false,
    inputFolder,
    outputFolder,
    reportFolder:
      reportFolder ?? path.join(path.dirname(path.resolve(outputFolder)), 'reports'),
    leadingPadMs,
    trailingPadMs,
    fadeMs,
    dryRun,
  };
}

async function main() {
  try {
    const args = parseCliArgs(process.argv.slice(2));

    if (args.help) {
      printHelp();
      return;
    }

    const result = await finalizeCorpus(args);

    console.log(`Finalized ${result.clips.length} clip(s).`);
    console.log(
      `Summary: PASS=${result.summary.pass}, REVIEW=${result.summary.review}, REJECT=${result.summary.reject}`
    );

    if (result.dryRun) {
      console.log('Dry run complete — no finalized files were written.');
    }

    if (result.failures.length > 0) {
      console.error('\nFailures:');
      for (const failure of result.failures) {
        console.error(`  - ${failure}`);
      }
      process.exitCode = 1;
    }
  } catch (err) {
    if (err instanceof FfmpegNotFoundError) {
      console.error(err.message);
      process.exitCode = 1;
      return;
    }

    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

const cliPath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (invokedPath === cliPath) {
  main();
}
