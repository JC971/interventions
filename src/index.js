import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

// Styles globaux
const globalStyles = document.createElement('style');
globalStyles.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  /* Smooth scrolling */
  html {
    scroll-behavior: smooth;
  }
  
  /* Prevent overscroll bounce on iOS */
  body {
    overscroll-behavior-y: contain;
  }
  
  /* Better focus styles */
  *:focus-visible {
    outline: 2px solid #667eea;
    outline-offset: 2px;
  }
  
  /* Remove tap highlight on mobile */
  * {
    -webkit-tap-highlight-color: transparent;
  }
  
  /* Prevent text selection on buttons */
  button {
    user-select: none;
    -webkit-user-select: none;
  }
  
  /* Smooth transitions */
  button, input, select, textarea {
    transition: border-color 0.2s, box-shadow 0.2s, background-color 0.2s;
  }
  
  /* Input focus states */
  input:focus, select:focus, textarea:focus {
    border-color: #667eea !important;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
  }
  
  /* Button hover states */
  button:active {
    transform: scale(0.98);
  }
  
  /* Scrollbar styling */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  ::-webkit-scrollbar-track {
    background: #f1f5f9;
  }
  
  ::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
`;
document.head.appendChild(globalStyles);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Enregistrer le Service Worker pour le mode hors-ligne et l'installation PWA
serviceWorkerRegistration.register({
  onSuccess: (registration) => {
    console.log('✅ PWA installée avec succès!');
  },
  onUpdate: (registration) => {
    console.log('🔄 Nouvelle version disponible!');
    // Optionnel: afficher une notification à l'utilisateur
    if (window.confirm('Une nouvelle version est disponible. Voulez-vous mettre à jour?')) {
      if (registration.waiting) {
        registration.waiting.postMessage('SKIP_WAITING');
        window.location.reload();
      }
    }
  },
});
