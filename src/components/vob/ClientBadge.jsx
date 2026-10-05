import React, { memo } from 'react';
import { CLIENTS_BY_ID } from '../../data/clients';

export const ClientBadge = memo(function ClientBadge({ clientId }) {
  const client = CLIENTS_BY_ID.get(clientId) || { name: clientId, color: '#0a2463' };

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
});

