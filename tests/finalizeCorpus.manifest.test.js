import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { finalizeCorpus } from '../src/finalizeCorpus.js';
import { readManifest, resolveStageManifestPath } from '../src/manifestUtils.js';
import { makeTempDir, removeDir, writeTestWav } from './helpers/wav.js';

const voiceclipperManifest = {
  schema_version: 2,
  session: {
    session_id: 'session_001',
    recording_location_type: 'home office',
  },
  speaker: {
    speaker_id: 'speaker_ariel_001',
    speaker_name: 'Ariel Goldman',
  },
  processing: {
    voiceclipper: { version: '0.5.0' },
    lufs_buff: { version: '1.0.0', target_lufs: -23 },
  },
  clips: [
    {
      clip_id: 'session_001_000001',
      filename: 'close_the_door.wav',
      phrase_id: 'close_the_door',
      content_metadata: { emotion: 'tense' },
      qc: {
        lufs_buff: { status: 'PASS', lufs: -23 },
      },
    },
  ],
};

test('finalizeCorpus writes manifest.final.json and preserves source manifest', async () => {
  const root = await makeTempDir('manifest-finalize-');
  const inputDir = path.join(root, 'normalized');
  const outputDir = path.join(root, 'training');
  const reportDir = path.join(root, 'reports');
  const sourceManifestPath = path.join(root, 'manifest.json');

  try {
    await fs.mkdir(inputDir, { recursive: true });
    await writeTestWav({ filePath: path.join(inputDir, 'close_the_door.wav') });
    await fs.writeFile(sourceManifestPath, `${JSON.stringify(voiceclipperManifest, null, 2)}\n`);

    const result = await finalizeCorpus({
      inputFolder: inputDir,
      outputFolder: outputDir,
      reportFolder: reportDir,
      manifestPath: sourceManifestPath,
      dryRun: true,
      analyzeFn: () => ({
        filename: 'close_the_door.wav',
        duration: 1,
        sampleRate: 44100,
        channels: 1,
        leadingSilenceMs: 75,
        trailingSilenceMs: 75,
        valid: true,
        error: null,
      }),
    });

    const sourceAfter = await readManifest(sourceManifestPath);
    const stageAfter = await readManifest(resolveStageManifestPath(outputDir));

    assert.equal(result.stageManifestPath, resolveStageManifestPath(outputDir));
    assert.equal(sourceAfter.processing.corpus_finisher, undefined);
    assert.equal(stageAfter.processing.corpus_finisher.leading_pad_ms, 75);
    assert.equal(stageAfter.speaker.speaker_name, 'Ariel Goldman');
    assert.equal(stageAfter.clips[0].content_metadata.emotion, 'tense');
    assert.equal(stageAfter.clips[0].qc.lufs_buff.status, 'PASS');
    assert.equal(stageAfter.clips[0].qc.corpus_finisher.status, 'PASS');
  } finally {
    await removeDir(root);
  }
});
