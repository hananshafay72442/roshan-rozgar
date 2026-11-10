import { createContext, useCallback, useContext, useLayoutEffect, useState } from 'react'
import { messages } from './messages'

export const languages = [
  { id: 'roman', label: 'Roman Urdu', lang: 'ur-Latn-PK', dir: 'ltr' },
  { id: 'ur', label: 'اردو', lang: 'ur-PK', dir: 'rtl' },
  { id: 'en', label: 'English', lang: 'en', dir: 'ltr' },
]

const LanguageContext = createContext(null)

export function useLanguage() {
  return useContext(LanguageContext)
}

export default function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => (
    languages.find(({ lang }) => lang === document.documentElement.lang)?.id || 'roman'
  ))
  const locale = languages.find(({ id }) => id === language)
  const t = useCallback((message = '', values = {}) => {
    const translations = messages[message]
    const localized = (language === 'roman' ? translations?.[0] : language === 'ur' ? translations?.[1] : null) || message
    return localized.replace(/\{(\w+)\}/g, (match, key) => Object.hasOwn(values, key) ? values[key] : match)
  }, [language])

  useLayoutEffect(() => {
    const root = document.documentElement
    root.lang = locale.lang
    root.dir = locale.dir
    document.title = `${t('Roshan Rozgar')} — ${t('Local skills, closer to home')}`
    try { localStorage.setItem('roshan-language', language) } catch { /* optional persistence */ }
  }, [language, locale, t])

  return <LanguageContext.Provider value={{ language, setLanguage, locale, t }}>{children}</LanguageContext.Provider>
}
