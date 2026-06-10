import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyClip, padWithinTarget } from '../src/qcRules.js';

test('padWithinTarget accepts values near configured pad', () => {
  assert.equal(padWithinTarget(75, 75), true);
  assert.equal(padWithinTarget(60, 75), true);
  assert.equal(padWithinTarget(20, 75), false);
});

test('classifyClip returns PASS when padding matches target', () => {
  const result = classifyClip(
    {
      filename: 'clip.wav',
      duration: 2.15,
      sampleRate: 44100,
      channels: 1,
      leadingSilenceMs: 75,
      trailingSilenceMs: 75,
      valid: true,
      error: null,
    },
    {
      leadingPadMs: 75,
      trailingPadMs: 75,
      sourceDurationSec: 2,
      outputDurationSec: 2.15,
    }
  );

  assert.equal(result.status, 'PASS');
});

test('classifyClip returns REVIEW when padding is outside expected range', () => {
  const result = classifyClip(
    {
      filename: 'clip.wav',
      duration: 2,
      sampleRate: 44100,
      channels: 1,
      leadingSilenceMs: 10,
      trailingSilenceMs: 10,
      valid: true,
      error: null,
    },
    {
      leadingPadMs: 75,
      trailingPadMs: 75,
      sourceDurationSec: 2,
      outputDurationSec: 2,
    }
  );

  assert.equal(result.status, 'REVIEW');
  assert.ok(result.notes.length >= 2);
});
