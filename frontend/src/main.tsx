import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import faviconUrl from './assets/mobiface-logo.svg'
import { App } from './App'
import './index.css'

// Keep the favicon in sync with the supplied Mobiface logo. Vite fingerprints
// the asset in production, so setting the resolved URL here is safer than a
// hard-coded public path.
const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
if (favicon) favicon.href = faviconUrl

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
