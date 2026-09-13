import { createRoot } from 'react-dom/client'
import App from './App'
import { ResetPage, VerifyPage } from './features/auth'
import './styles.css'

/**
 * Two paths are served by the app itself because the confirmation and reset
 * emails link to them; everything else is the editor.
 */
function Root() {
  const path = window.location.pathname.replace(/\/+$/, '')
  if (path === '/verify') return <VerifyPage />
  if (path === '/reset') return <ResetPage />
  return <App />
}

createRoot(document.getElementById('root')!).render(<Root />)
