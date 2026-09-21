import React from 'react';

export function StatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  let className = "status-badge ";
  let label = status;

  if (s === "approved" || s === "saved records") {
    className += "status-approved";
    label = "Approved";
  } else if (s === "auth queue" || s === "auth_queue") {
    className += "status-auth";
    label = "Auth Queue";
  } else if (s === "error") {
    className += "status-error";
    label = "Error";
  } else if (s === "in progress" || s === "in_progress") {
    className += "status-in-progress";
    label = "In Progress";
  } else {
    className += "status-assigned";
    label = "Assigned";
  }

  return (
    <span className={className}>
      <span className="status-dot" />
      {label}
    </span>
  );
}
