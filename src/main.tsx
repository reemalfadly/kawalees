import { MotionConfig } from 'motion/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import { App } from './App';
import { installInteractions } from './lib/interactions';
import { installTracker } from './lib/tracker';
import './styles/index.css';

// The tracker goes in first so even a crash during start-up gets recorded.
installTracker();
installInteractions();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </HashRouter>
  </StrictMode>,
);
