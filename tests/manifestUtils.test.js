import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import {
  appendProcessing,
  buildStageManifest,
  readManifest,
  resolveStageManifestPath,
  writeManifest,
} from '../src/manifestUtils.js';

const voiceclipperManifest = {
  schema_version: 2,
  session: { session_id: 'session_001', recording_location_type: 'studio' },
  speaker: { speaker_id: 'speaker_test', speaker_name: 'Test Speaker' },
  processing: { voiceclipper: { version: '0.5.0' } },
  clips: [
    {
      filename: 'close_the_door.wav',
      phrase_id: 'close_the_door',
      content_metadata: { emotion: 'tense' },
    },
  ],
};

test('readManifest loads Voiceclipper manifest JSON', async (t) => {
  const dir = path.join(process.cwd(), 'tests', '.tmp', 'read-manifest');
  const manifestPath = path.join(dir, 'manifest.json');
  await fs.mkdir(dir, { recursive: true });
  t.after(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  await writeManifest(manifestPath, voiceclipperManifest);
  const loaded = await readManifest(manifestPath);

  assert.equal(loaded.speaker.speaker_id, 'speaker_test');
  assert.equal(loaded.session.session_id, 'session_001');
});

test('appendProcessing preserves prior stage metadata', () => {
  const updated = appendProcessing(voiceclipperManifest, 'corpus_finisher', {
    version: '1.0.0',
    leading_pad_ms: 75,
  });

  assert.equal(updated.processing.voiceclipper.version, '0.5.0');
  assert.equal(updated.processing.corpus_finisher.leading_pad_ms, 75);
});

test('resolveStageManifestPath uses output folder', () => {
  assert.equal(
    resolveStageManifestPath('/tmp/training_clips'),
    path.join('/tmp/training_clips', 'manifest.final.json')
  );
});

test('buildStageManifest preserves metadata and writes finisher QC', () => {
  const stageManifest = buildStageManifest({
    manifest: voiceclipperManifest,
    qcEntries: [
      {
        filename: 'close_the_door.wav',
        status: 'PASS',
        notes: [],
        sourceDurationSec: 2,
        outputDurationSec: 2.15,
        leadingSilenceMs: 75,
        trailingSilenceMs: 75,
      },
    ],
    qcSummary: { total: 1, pass: 1, review: 0, reject: 0 },
    processingData: {
      version: '1.0.0',
      leading_pad_ms: 75,
      trailing_pad_ms: 75,
      fade_ms: 3,
    },
    sourceManifestPath: '/tmp/manifest.json',
  });

  assert.equal(stageManifest.speaker.speaker_name, 'Test Speaker');
  assert.equal(stageManifest.session.recording_location_type, 'studio');
  assert.equal(stageManifest.clips[0].content_metadata.emotion, 'tense');
  assert.equal(stageManifest.clips[0].qc.corpus_finisher.status, 'PASS');
  assert.equal(stageManifest.processing.corpus_finisher.leading_pad_ms, 75);
});

test('writes manifest.final.json without touching source manifest', async (t) => {
  const dir = path.join(process.cwd(), 'tests', '.tmp', 'final-manifest');
  const sourcePath = path.join(dir, 'manifest.json');
  const stagePath = resolveStageManifestPath(dir);
  await fs.mkdir(dir, { recursive: true });
  t.after(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  await writeManifest(sourcePath, voiceclipperManifest);
  const stageManifest = buildStageManifest({
    manifest: voiceclipperManifest,
    qcEntries: [],
    qcSummary: { total: 0, pass: 0, review: 0, reject: 0 },
    processingData: { version: '1.0.0' },
    sourceManifestPath: sourcePath,
  });
  await writeManifest(stagePath, stageManifest);

  const sourceAfter = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
  const stageAfter = JSON.parse(await fs.readFile(stagePath, 'utf8'));

  assert.equal(sourceAfter.processing.corpus_finisher, undefined);
  assert.equal(stageAfter.processing.corpus_finisher.version, '1.0.0');
});
