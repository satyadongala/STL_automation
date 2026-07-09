import React from 'react';
import { ARTIFACT_MODE_OPTIONS, type ArtifactMode } from '../constants/playwrightRunOptions';

export const ArtifactModeSelect: React.FC<{
  id: string;
  label: string;
  value: ArtifactMode;
  onChange: (value: ArtifactMode) => void;
}> = ({ id, label, value, onChange }) => (
  <div>
    <label htmlFor={id} className="block text-[10px] font-semibold text-label uppercase tracking-wider mb-1.5">
      {label}
    </label>
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as ArtifactMode)}
      className="bg-white/85 border border-brand-200/50 rounded-lg px-2 py-1.5 text-xs font-semibold text-text-primary outline-none focus:border-brand-500 transition-colors w-[7.5rem]"
    >
      {ARTIFACT_MODE_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);
