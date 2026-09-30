import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

document.documentElement.dataset.theme = 'light';
try {
  localStorage.removeItem('us24-theme');
} catch {}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
