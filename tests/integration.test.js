import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { finalizeCorpus } from '../src/finalizeCorpus.js';
import { makeTempDir, removeDir, writeTestWav } from './helpers/wav.js';

test('integration: finalize clips with padding and reports', async (t) => {
  if (spawnSync('ffmpeg', ['-version']).status !== 0) {
    t.skip('FFmpeg is not available');
    return;
  }

  const root = await makeTempDir('finalize-');
  const inputDir = path.join(root, 'normalized');
  const outputDir = path.join(root, 'training');
  const reportDir = path.join(root, 'reports');

  try {
    await fs.mkdir(inputDir, { recursive: true });
    await writeTestWav({ filePath: path.join(inputDir, 'phrase.wav'), durationSec: 0.5 });

    const result = await finalizeCorpus({
      inputFolder: inputDir,
      outputFolder: outputDir,
      reportFolder: reportDir,
      leadingPadMs: 75,
      trailingPadMs: 75,
    });

    assert.equal(result.clips.length, 1);
    await fs.access(path.join(outputDir, 'phrase.wav'));
    await fs.access(path.join(reportDir, 'finalize-report.json'));

    const entry = result.clips[0];
    assert.ok(entry.outputDurationSec > entry.sourceDurationSec);
  } finally {
    await removeDir(root);
  }
});

test('finalizeCorpus preserves filenames', async (t) => {
  if (spawnSync('ffmpeg', ['-version']).status !== 0) {
    t.skip('FFmpeg is not available');
    return;
  }

  const root = await makeTempDir('names-');
  const inputDir = path.join(root, 'in');
  const outputDir = path.join(root, 'out');
  const reportDir = path.join(root, 'reports');

  try {
    await fs.mkdir(inputDir, { recursive: true });
    await writeTestWav({ filePath: path.join(inputDir, 'dangerous_mistake.wav') });

    await finalizeCorpus({
      inputFolder: inputDir,
      outputFolder: outputDir,
      reportFolder: reportDir,
    });

    await fs.access(path.join(outputDir, 'dangerous_mistake.wav'));
  } finally {
    await removeDir(root);
  }
});
