import React from 'react';
import { cardsFor } from '../../data/dashboardCards';

/**
 * The dashboard's KPI cards. Tapping one opens that card's own page (FR-13
 * scoping for specialists comes from the API, which counts only their queue).
 */
export function KpiCardGrid({ role, summary, loading, loadError, onOpen }) {
  return (
    <div className="kpi-cards-grid">
      {cardsFor(role).map(card => (
        <div
          key={card.id}
          className={`kpi-card ${card.tone}`}
          role="button"
          tabIndex={0}
          title={`Open ${card.label}`}
          onClick={() => onOpen(card.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpen(card.id);
            }
          }}
        >
          <div className="kpi-label">{card.label}</div>
          <div className="kpi-number">{loading ? '…' : loadError ? '—' : summary[card.summaryKey]}</div>
          <div className="kpi-meta">{card.meta}</div>
        </div>
      ))}
    </div>
  );
}
