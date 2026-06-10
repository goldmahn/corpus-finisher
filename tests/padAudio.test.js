import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildPadFilter,
  expectedDurationSec,
  padAudio,
} from '../src/padAudio.js';

test('buildPadFilter includes delay, pad, and fades', () => {
  const filter = buildPadFilter({
    leadingPadMs: 75,
    trailingPadMs: 75,
    fadeMs: 3,
    speechDurationSec: 1.5,
  });

  assert.match(filter, /adelay=75:all=1/);
  assert.match(filter, /apad=pad_dur=0\.075/);
  assert.match(filter, /afade=t=in:st=0\.075:d=0\.003/);
  assert.match(filter, /afade=t=out:st=1\.572:d=0\.003/);
});

test('buildPadFilter omits fades when fadeMs is zero', () => {
  const filter = buildPadFilter({
    leadingPadMs: 50,
    trailingPadMs: 50,
    fadeMs: 0,
    speechDurationSec: 1,
  });

  assert.doesNotMatch(filter, /afade/);
});

test('expectedDurationSec adds both pads', () => {
  assert.ok(Math.abs(expectedDurationSec(2, 75, 75) - 2.15) < 0.001);
});

test('padAudio increases duration by configured pad amount', async (t) => {
  const { makeTempDir, removeDir, writeTestWav } = await import('./helpers/wav.js');
  const { probeAudio } = await import('../src/ffmpegUtils.js');
  const { spawnSync } = await import('node:child_process');

  if (spawnSync('ffmpeg', ['-version']).status !== 0) {
    t.skip('FFmpeg is not available');
    return;
  }

  const root = await makeTempDir('pad-');
  const input = `${root}/in.wav`;
  const output = `${root}/out.wav`;

  try {
    await writeTestWav({ filePath: input, durationSec: 0.4 });
    const before = probeAudio(input).duration;

    padAudio({
      inputPath: input,
      outputPath: output,
      leadingPadMs: 75,
      trailingPadMs: 75,
      fadeMs: 3,
    });

    const after = probeAudio(output).duration;
    assert.ok(Math.abs(after - expectedDurationSec(before, 75, 75)) < 0.02);
  } finally {
    await removeDir(root);
  }
});
