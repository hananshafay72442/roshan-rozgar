import { useLanguage } from '../../i18n/LanguageProvider'
import { useEffect, useRef } from 'react'
import Icon from '../Icon'

export default function Panel({ title, kicker, wide = false, onClose, children }) {
  const { t } = useLanguage()
  const dialog = useRef(null)

  useEffect(() => {
    const element = dialog.current
    const previous = document.activeElement
    element.showModal()
    return () => {
      element.close()
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])

  return (
    <dialog ref={dialog} className={`panel${wide ? ' panel-wide' : ''}`} aria-labelledby="panel-title"
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="panel-content">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{kicker}</p>
            <h2 id="panel-title">{title}</h2>
          </div>
          <button type="button" className="icon-button" aria-label={t('Close dialog')} onClick={onClose}><Icon name="close" size={19} /></button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
