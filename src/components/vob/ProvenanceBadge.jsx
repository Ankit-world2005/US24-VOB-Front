import React, { memo } from 'react';

export const ProvenanceBadge = memo(function ProvenanceBadge({ provenance }) {
  if (!provenance || !provenance.source) return null;

  const { source, date } = provenance;

  if (source === 'recent_vob') {
    return (
      <span className="prov-badge prov-recent" title="Pre-filled from patient's previous VOB record">
        <span className="prov-dot" />
        Recent VOB {date ? `· ${date}` : ''}
      </span>
    );
  }

  if (source === 'master_data') {
    return (
      <span className="prov-badge prov-master" title="Pre-filled from admin-uploaded master data">
        <span className="prov-dot" />
        Master Data
      </span>
    );
  }

  if (source === 'ai') {
    return (
      <span className="prov-badge prov-ai" title="Auto-extracted from call / portal transcript by AI">
        <span className="prov-dot" />
        AI Transcript
      </span>
    );
  }

  return (
    <span className="prov-badge prov-manual">
      Manual Entry
    </span>
  );
});

