import React from 'react';
import { UI_CONTENT } from '../DB';

export function Footer() {
  const year = new Date().getFullYear();
  const { company, support } = UI_CONTENT.footer;

  return (
    <footer className="footer">
      <div className="footer-inner">
        <span>© {year} {company}</span>
        <span>{support}</span>
      </div>
    </footer>
  );
}
