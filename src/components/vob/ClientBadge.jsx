import React from 'react';
import { CLIENTS } from '../../data/clients';

export function ClientBadge({ clientId }) {
  const client = CLIENTS.find(c => c.id === clientId) || { name: clientId, color: '#0a2463' };

  return (
    <span
      className="client-badge"
      style={{
        borderColor: `${client.color}40`,
        color: client.color,
        background: `${client.color}12`
      }}
    >
      <span className="client-badge-dot" style={{ background: client.color }} />
      {client.name}
    </span>
  );
}
