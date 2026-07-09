export type ArtifactUiMode = 'on' | 'off' | 'failed';

const VIDEO: Record<ArtifactUiMode, string> = {
  on: 'on',
  off: 'off',
  failed: 'retain-on-failure',
};

const TRACE: Record<ArtifactUiMode, string> = {
  on: 'on',
  off: 'off',
  failed: 'retain-on-failure',
};

const SCREENSHOT: Record<ArtifactUiMode, string> = {
  on: 'on',
  off: 'off',
  failed: 'only-on-failure',
};

export function resolveArtifactMode(value: unknown, fallback: ArtifactUiMode): ArtifactUiMode {
  if (value === 'on' || value === 'off' || value === 'failed') return value;
  return fallback;
}

export function toPlaywrightVideo(mode: ArtifactUiMode): string {
  return VIDEO[mode];
}

export function toPlaywrightTrace(mode: ArtifactUiMode): string {
  return TRACE[mode];
}

export function toPlaywrightScreenshot(mode: ArtifactUiMode): string {
  return SCREENSHOT[mode];
}
