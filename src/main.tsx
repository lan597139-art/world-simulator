import { StrictMode } from 'react'
import '@fontsource-variable/geist'
import '@fontsource-variable/noto-sans-sc'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './styles/design-system.css'
import './styles/navigation.css'
import './styles/appearance-studio.css'
// 阶段二：移动端信息分层层（必须最后引入，用于覆盖各页面的桌面栅格）
import './styles/mobile-layering.css'
import AuthGate from './components/AuthGate'
import { installApiOriginBridge } from './api/config'
import { applyAppearance, loadAppearance } from './utils/appearance'
import { installErrorReporting } from './utils/errorReporting'

installApiOriginBridge()
installErrorReporting()
applyAppearance(loadAppearance())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </StrictMode>,
)
