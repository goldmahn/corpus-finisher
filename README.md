# Corpus Finisher

Corpus Finisher is the third stage of the Corpus Voces audio pipeline. It takes loudness-normalized clips from LUFS Buff and adds consistent leading/trailing silence plus short edge fades to produce training-ready WAV files.

## Pipeline position

```text
VoiceClipper → LUFS Buff → Corpus Finisher → (future training export)
```

VoiceClipper extracts tight phrase clips. LUFS Buff normalizes loudness and runs QC. Corpus Finisher pads and finalizes clips for model training.

## Requirements

- Node.js 18+
- FFmpeg and ffprobe on your PATH

## Installation

```bash
cd corpus-finisher
npm install
npm link   # optional: global `corpus-finisher` command
```

## Command Line

```bash
corpus-finisher ./normalized_clips ./training_clips
corpus-finisher ./normalized_clips ./training_clips --pad 80
corpus-finisher ./normalized_clips ./training_clips --leading-pad 75 --trailing-pad 100
corpus-finisher ./normalized_clips ./training_clips --fade 0
corpus-finisher ./normalized_clips ./training_clips --dry-run
```

### Expected folder layout

```text
Project/
├── raw_clips/              # VoiceClipper output (preserved)
├── normalized_clips/       # LUFS Buff output
├── training_clips/         # Corpus Finisher output
└── reports/
    ├── qc-report.json      # from LUFS Buff
    └── finalize-report.json
```

Filenames stay identical at every stage.

## Programmatic API

```javascript
import { finalizeCorpus } from 'corpus-finisher';

const result = await finalizeCorpus({
  inputFolder: './normalized_clips',
  outputFolder: './training_clips',
  reportFolder: './reports',
  leadingPadMs: 75,
  trailingPadMs: 75,
  fadeMs: 3,
});

console.log(result.summary);
```

## Defaults

| Setting | Default | Purpose |
|---------|---------|---------|
| Leading pad | 75 ms | Silence before speech |
| Trailing pad | 75 ms | Silence after speech |
| Edge fade | 3 ms | Prevent boundary clicks |

Adjust in `src/config.js` or via CLI flags.

## Quality Control

Each finalized clip is classified as **PASS**, **REVIEW**, or **REJECT** based on measured padding, duration, and file validity.

Clips that were **REVIEW** in LUFS Buff for low silence should typically become **PASS** here if padding applied correctly.

## Testing

```bash
npm test
```

## Architecture

```text
src/
├── cli.js
├── finalizeCorpus.js
├── padAudio.js
├── analyzeClip.js
├── qcRules.js
├── writeReports.js
├── fileUtils.js
├── ffmpegUtils.js
├── config.js
└── index.js
```
