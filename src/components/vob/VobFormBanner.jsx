import React, { useMemo } from 'react';
import { StatusBadge } from './StatusBadge';
import { ClientBadge } from './ClientBadge';
import { getVerificationProgress } from '../../data/clients';

/** The layout toggle's modes, as the verification-split-layout's mode-* classes name them. */
const LAYOUT_MODES = [
  { id: 'split', label: '◫ Split View', title: 'Side-by-side: Form & Parker VOB Preview' },
  { id: 'form', label: '▤ Form Only', title: 'Form & Call Verification only' },
  { id: 'preview', label: '📄 Live Preview', title: 'Parker VOB document preview only' }
];

/**
 * The fill screen's top card: the VOB's tags and patient line, the layout
 * toggle and the switcher to another assigned VOB. `children` are the screen's
 * own actions, shown last.
 */
export function VobFormBanner({ vob, formData, layoutMode, onLayoutChange, myVobsList, activeVobId, onSwitchVob, children }) {
  const { filledCount, totalCount } = useMemo(() => getVerificationProgress(formData), [formData]);

  return (
    <div className="vob-form-banner">
      <div className="vob-header-left">
        <div className="vob-tags-row">
          <ClientBadge clientId={vob.client} />
          <StatusBadge status={vob.vobStatus} />
          <span className="mono text-xs">Record ID: {vob.id}</span>
          <span className="mono text-xs">v{vob.version}</span>
          <span className="tag-progress-pill">Verified {filledCount}/{totalCount}</span>
        </div>
        <h2 className="vob-patient-name">{formData.patientName || 'Unnamed Patient'}</h2>
        <div className="vob-patient-meta">
          <span>DOB: <strong>{formData.dob || '—'}</strong></span>
          <span>DOS: <strong>{formData.dos || '—'}</strong></span>
          <span>Type: <strong>{formData.serviceType || 'PT'}</strong></span>
          <span>Insurance: <strong>{formData.insurance || '—'}</strong></span>
        </div>
      </div>

      <div className="vob-header-actions">
        {/* Layout Mode Segmented Control */}
        <div className="layout-toggle-group">
          {LAYOUT_MODES.map(mode => (
            <button
              key={mode.id}
              type="button"
              className={`layout-btn ${layoutMode === mode.id ? 'active' : ''}`}
              onClick={() => onLayoutChange(mode.id)}
              title={mode.title}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {/* Quick switcher to next task */}
        {myVobsList.length > 1 && (
          <select
            className="select-input select-sm"
            value={activeVobId}
            onChange={(e) => onSwitchVob(e.target.value)}
            title="Switch to another assigned VOB"
          >
            {myVobsList.map(v => (
              <option key={v.id} value={v.id}>{v.patientName} ({v.vobStatus})</option>
            ))}
          </select>
        )}

        {children}
      </div>
    </div>
  );
}
