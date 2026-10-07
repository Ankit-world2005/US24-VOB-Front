import React, { useState, useEffect } from 'react';
import { vobsApi } from '../../api/vobs';
import { StatusBadge } from './StatusBadge';
import { ClientBadge } from './ClientBadge';
import { ProvenanceBadge } from './ProvenanceBadge';
import { CANONICAL_FIELDS } from '../../data/clients';

export function RecordDetailModal({ vobId, isOpen, onClose }) {
  const [vob, setVob] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && vobId) {
      setLoading(true);
      vobsApi.getVobById(vobId).then((vobData) => {
        setVob(vobData);
        setLoading(false);
      }).catch(err => {
        console.error(err);
        setLoading(false);
      });
    }
  }, [isOpen, vobId]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container record-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-eyebrow">
              {vob && <ClientBadge clientId={vob.client} />}
              <span>Record ID: {vobId}</span>
              {vob && <StatusBadge status={vob.vobStatus} />}
            </div>
            <h2 className="modal-title">{vob?.patientName || 'Loading Record…'}</h2>
          </div>
          <button type="button" className="drawer-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="modal-loading">Loading verified record details…</div>
          ) : vob ? (
            <div className="canonical-fields-grid">
              {CANONICAL_FIELDS.map(f => {
                const val = vob[f.key];
                const prov = vob.provenance?.[f.key];
                return (
                  <div key={f.key} className="canonical-field-cell">
                    <div className="cell-header">
                      <span className="cell-label">{f.label}</span>
                      {prov && <ProvenanceBadge provenance={prov} />}
                    </div>
                    <div className="cell-value">
                      {val ? String(val) : <span className="empty-val">—</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
