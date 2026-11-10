import { useEffect, useId, useRef, useState } from 'react'
import { languages, useLanguage } from '../i18n/LanguageProvider'
import Icon from './Icon'

export default function LanguageToggle() {
  const { language, setLanguage, locale, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const trigger = useRef(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    function dismiss(event) {
      if (!root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])

  function closeAndFocus() {
    setOpen(false)
    trigger.current?.focus()
  }

  return (
    <div className="language-toggle" ref={root}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
      onKeyDown={(event) => { if (event.key === 'Escape' && open) { event.stopPropagation(); closeAndFocus() } }}>
      <button className="language-trigger" type="button" ref={trigger} aria-label={t('Language')} title={locale.label}
        aria-expanded={open} aria-controls={id} onClick={() => setOpen((current) => !current)}>
        <Icon name="globe" size={17} />
        <span lang={locale.lang} dir={locale.dir}>{locale.label}</span>
        <Icon name="down" size={12} />
      </button>
      <div className="language-options" id={id} hidden={!open} role="group" aria-label={t('Language')}>
        {languages.map(({ id: option, label, lang, dir }) => (
          <button type="button" key={option} lang={lang} dir={dir} aria-pressed={language === option}
            onClick={() => { setLanguage(option); closeAndFocus() }}>
            {label}{language === option && <Icon name="check" size={15} />}
          </button>
        ))}
      </div>
    </div>
  )
}
