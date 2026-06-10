import { spawnSync } from 'node:child_process';

export class FfmpegNotFoundError extends Error {
  constructor() {
    super(
      'FFmpeg is not installed or not available on PATH. Install FFmpeg to use Corpus Finisher.'
    );
    this.name = 'FfmpegNotFoundError';
  }
}

/**
 * @returns {void}
 */
export function assertFfmpegAvailable() {
  const ffmpeg = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  const ffprobe = spawnSync('ffprobe', ['-version'], { encoding: 'utf8' });

  if (ffmpeg.error?.code === 'ENOENT' || ffprobe.error?.code === 'ENOENT') {
    throw new FfmpegNotFoundError();
  }

  if (ffmpeg.status !== 0 || ffprobe.status !== 0) {
    throw new Error('FFmpeg or ffprobe failed to run. Verify your installation.');
  }
}

/**
 * @param {string[]} args
 */
export function runFfmpeg(args) {
  const result = spawnSync('ffmpeg', args, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.error?.code === 'ENOENT') {
    throw new FfmpegNotFoundError();
  }

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status,
  };
}

/**
 * @param {string[]} args
 */
export function runFfprobe(args) {
  const result = spawnSync('ffprobe', args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error?.code === 'ENOENT') {
    throw new FfmpegNotFoundError();
  }

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status,
  };
}

/**
 * @param {string} filePath
 * @returns {{ sampleRate: number, channels: number, duration: number }}
 */
export function probeAudio(filePath) {
  const result = runFfprobe([
    '-v',
    'quiet',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    filePath,
  ]);

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `Failed to probe ${filePath}`);
  }

  let payload;
  try {
    payload = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Unable to parse ffprobe output for ${filePath}`);
  }

  const stream = (payload.streams ?? []).find((item) => item.codec_type === 'audio');
  if (!stream) {
    throw new Error(`No audio stream found in ${filePath}`);
  }

  const sampleRate = parseInt(String(stream.sample_rate ?? ''), 10);
  const channels = parseInt(String(stream.channels ?? ''), 10);
  const duration = parseFloat(String(payload.format?.duration ?? ''));

  if (!Number.isFinite(sampleRate) || !Number.isFinite(channels) || !Number.isFinite(duration)) {
    throw new Error(`Missing audio metadata for ${filePath}`);
  }

  return { sampleRate, channels, duration };
}
