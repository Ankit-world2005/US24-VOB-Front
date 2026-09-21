import React from 'react';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-inner">
        <span>© {year} US24 Solutions</span>
        <span>Need access? Contact your administrator</span>
      </div>
    </footer>
  );
}
