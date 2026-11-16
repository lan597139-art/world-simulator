import { StrictMode } from 'react'
import '@fontsource-variable/geist'
import '@fontsource-variable/noto-sans-sc'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './styles/design-system.css'
import AuthGate from './components/AuthGate'
import { installApiOriginBridge } from './api/config'
import { applyAppearance, loadAppearance } from './utils/appearance'

installApiOriginBridge()
applyAppearance(loadAppearance())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </StrictMode>,
)
