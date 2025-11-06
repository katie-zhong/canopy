import React from 'react';
import { createRoot } from 'react-dom/client';
// Fix: Changed to a named import for the App component.
import { App } from './App';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
    console.error("Root container not found. Failed to mount React app.");
}