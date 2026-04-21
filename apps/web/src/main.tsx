import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import './index.css';

const CLERK_PK = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

if (!CLERK_PK) {
  console.warn('[EFB] VITE_CLERK_PUBLISHABLE_KEY not set — running in demo mode');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {CLERK_PK ? (
      <ClerkProvider publishableKey={CLERK_PK} afterSignOutUrl="/">
        <App />
      </ClerkProvider>
    ) : (
      // Demo mode — no auth wrapper
      <App />
    )}
  </StrictMode>,
);
