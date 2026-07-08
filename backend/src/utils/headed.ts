/** Headed browsers need a display (X11). Docker/Linux servers usually don't have one. */
export function resolveHeaded(requested?: boolean): boolean {
  if (!requested) return false;
  if (process.platform === 'linux' && !process.env.DISPLAY) return false;
  return true;
}

export function headedOverrideNote(requested?: boolean): string | null {
  if (!requested) return null;
  if (process.platform === 'linux' && !process.env.DISPLAY) {
    return '[SYS] Headed mode requested but no DISPLAY — running headless (normal in Docker/production).\n';
  }
  return null;
}
