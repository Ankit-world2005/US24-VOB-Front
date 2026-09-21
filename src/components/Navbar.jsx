import React from 'react';
import { ThemeToggle } from './ThemeToggle';

export function Navbar({ isDark, onToggleTheme }) {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <a className="logo" href="#">
          <span className="logo-mark">
            <span>U<span className="orange">S</span>24</span>
          </span>
          <span className="wordmark">
            <span className="wordmark-name">
              U<span className="orange">S</span>24 SOLUTIONS
            </span>
            <span className="tagline">Innovative Technology Driven</span>
          </span>
        </a>
        <div className="nav-right">
          <span className="nav-link hide-sm" style={{ cursor: 'default' }}>
            Employee Portal
          </span>
          <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
        </div>
      </div>
    </nav>
  );
}
