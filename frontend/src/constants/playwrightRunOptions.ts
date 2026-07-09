export type ArtifactMode = 'on' | 'off' | 'failed';

export const ARTIFACT_MODE_OPTIONS: { value: ArtifactMode; label: string }[] = [
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
  { value: 'failed', label: 'On failure' },
];

export function loadArtifactMode(key: string, fallback: ArtifactMode): ArtifactMode {
  const v = localStorage.getItem(key);
  return v === 'on' || v === 'off' || v === 'failed' ? v : fallback;
}

export function saveArtifactMode(key: string, value: ArtifactMode): void {
  localStorage.setItem(key, value);
}
