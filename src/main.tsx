// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { MotionConfig } from 'motion/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import { App } from './App';
import { installInteractions } from './lib/interactions';
import { stampDocument } from './lib/provenance';
import { installTracker } from './lib/tracker';
import './styles/index.css';

// The tracker goes in first so even a crash during start-up gets recorded.
installTracker();
installInteractions();
stampDocument();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </HashRouter>
  </StrictMode>,
);
