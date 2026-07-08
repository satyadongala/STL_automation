"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveHeaded = resolveHeaded;
exports.headedOverrideNote = headedOverrideNote;
/** Headed browsers need a display (X11). Docker/Linux servers usually don't have one. */
function resolveHeaded(requested) {
    if (!requested)
        return false;
    if (process.platform === 'linux' && !process.env.DISPLAY)
        return false;
    return true;
}
function headedOverrideNote(requested) {
    if (!requested)
        return null;
    if (process.platform === 'linux' && !process.env.DISPLAY) {
        return '[SYS] Headed mode requested but no DISPLAY — running headless (normal in Docker/production).\n';
    }
    return null;
}
