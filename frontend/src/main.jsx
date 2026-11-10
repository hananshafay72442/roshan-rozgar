import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/manrope'
import '@fontsource-variable/space-grotesk'
import '@fontsource-variable/noto-nastaliq-urdu'
import LanguageProvider from './i18n/LanguageProvider'
import './styles/global.css'
import App from './app/App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider><App /></LanguageProvider>
  </StrictMode>,
)
